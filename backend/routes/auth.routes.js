const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const db = require('../config/db');

const router = express.Router();
const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'backend/uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' })[file.mimetype] || '.bin'}`)
});
const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 3) * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => allowed.has(file.mimetype) ? cb(null, true) : cb(new Error('Profile photo must be JPG, PNG or WEBP.'))
});

function clean(v) { return typeof v === 'string' ? v.trim() : ''; }
function validate(body) {
  const required = ['fullName','fatherName','dateOfBirth','gender','email','mobile','address','city','state','country','pinCode','education','occupation','username','password','confirmPassword'];
  for (const key of required) if (!clean(body[key])) return `${key} is required.`;
  if (clean(body.fullName).length > 120 || clean(body.fatherName).length > 120) return 'Name fields must be 120 characters or fewer.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(body.email)) || clean(body.email).length > 254) return 'Enter a valid email address.';
  if (!/^[0-9+\-\s()]{7,20}$/.test(clean(body.mobile))) return 'Enter a valid mobile number.';
  if (clean(body.alternateMobile) && !/^[0-9+\-\s()]{7,20}$/.test(clean(body.alternateMobile))) return 'Enter a valid alternate mobile number.';
  if (!/^\d{4,12}$/.test(clean(body.pinCode))) return 'PIN code must contain 4–12 digits.';
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(clean(body.username))) return 'Username must be 3–40 characters (letters, numbers, _, ., -).';
  if (body.password.length < 10 || !/[A-Za-z]/.test(body.password) || !/[0-9]/.test(body.password)) return 'Password must be at least 10 characters and contain a letter and a number.';
  if (body.password !== body.confirmPassword) return 'Passwords do not match.';
  if (body.terms !== 'on' && body.terms !== 'true') return 'Please accept the terms and conditions.';
  if (!['male','female','other','prefer_not_to_say'].includes(body.gender)) return 'Select a valid gender option.';
  const dob = new Date(`${body.dateOfBirth}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth) || Number.isNaN(dob.getTime()) || dob >= new Date()) return 'Enter a valid date of birth in the past.';
  return null;
}

router.post('/register', upload.single('profilePhoto'), async (req, res, next) => {
  try {
    const error = validate(req.body);
    if (error) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error });
    }
    const b = req.body;
    const email = clean(b.email).toLowerCase();
    const username = clean(b.username);
    const mobile = clean(b.mobile).replace(/\s+/g, '');
    const [existing] = await db.execute(
      'SELECT email, username, mobile FROM users WHERE email = ? OR username = ? OR mobile = ? LIMIT 1',
      [email, username, mobile]
    );
    if (existing.length) {
      if (req.file) fs.unlink(req.file.path, () => {});
      const duplicate = existing[0].email === email ? 'Email address' : existing[0].username === username ? 'Username' : 'Mobile number';
      return res.status(409).json({ error: `${duplicate} is already registered.` });
    }
    const passwordHash = await bcrypt.hash(b.password, 12);
    const photoPath = req.file ? `/uploads/${path.basename(req.file.filename)}` : null;
    const values = [
      clean(b.fullName), clean(b.fatherName), clean(b.motherName) || null, b.dateOfBirth,
      b.gender, email, mobile, clean(b.alternateMobile).replace(/\s+/g, '') || null,
      clean(b.address), clean(b.city), clean(b.state), clean(b.country), clean(b.pinCode),
      clean(b.education), clean(b.occupation), username, passwordHash, photoPath
    ];
    await db.execute(
      `INSERT INTO users
      (full_name,father_name,mother_name,date_of_birth,gender,email,mobile,alternate_mobile,address,city,state,country,pin_code,education,occupation,username,password_hash,profile_photo_path)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, values
    );
    return res.status(201).json({ message: 'Registration saved successfully.' });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email, username or mobile number is already registered.' });
    next(err);
  }
});

router.post('/admin-login', async (req, res, next) => {
  try {
    const username = clean(req.body.username);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    const [rows] = await db.execute('SELECT id, username, password_hash, role FROM admins WHERE username = ? LIMIT 1', [username]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      return res.status(401).json({ error: 'Invalid administrator credentials.' });
    }
    req.session.regenerate(async err => {
      if (err) return next(err);
      req.session.admin = { id: admin.id, username: admin.username, role: admin.role };
      try {
        await db.execute('UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);
        req.session.save(saveErr => {
          if (saveErr) return next(saveErr);
          res.json({ message: 'Login successful.', admin: { username: admin.username, role: admin.role } });
        });
      } catch (e) { next(e); }
    });
  } catch (err) { next(err); }
});

router.post('/admin-logout', (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('reg.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    res.json({ message: 'Logged out.' });
  });
});
router.get('/session', (req, res) => {
  res.json({ authenticated: Boolean(req.session?.admin), admin: req.session?.admin ? { username: req.session.admin.username, role: req.session.admin.role } : null });
});
module.exports = router;
