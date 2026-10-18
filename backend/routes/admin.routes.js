const express = require('express');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth.middleware');
const router = express.Router();
router.use(requireAdmin);

const publicColumns = `id, full_name AS fullName, father_name AS fatherName, mother_name AS motherName,
 date_of_birth AS dateOfBirth, gender, email, mobile, alternate_mobile AS alternateMobile,
 address, city, state, country, pin_code AS pinCode, education, occupation, username,
 profile_photo_path AS profilePhotoPath, account_status AS accountStatus, created_at AS createdAt, updated_at AS updatedAt`;

router.get('/stats', async (_req, res, next) => {
  try {
    const [[{ total }]] = await db.execute('SELECT COUNT(*) AS total FROM users');
    const [[{ today }]] = await db.execute('SELECT COUNT(*) AS today FROM users WHERE created_at >= CURRENT_DATE()');
    const [recent] = await db.execute(`SELECT ${publicColumns} FROM users ORDER BY created_at DESC LIMIT 5`);
    res.json({ total, today, recent });
  } catch (e) { next(e); }
});

router.get('/users', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim().slice(0, 100);
    const education = String(req.query.education || '').trim().slice(0, 120);
    const status = String(req.query.status || '').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const where = [], params = [];
    if (search) {
      const q = `%${search}%`;
      where.push('(full_name LIKE ? OR email LIKE ? OR username LIKE ? OR mobile LIKE ?)');
      params.push(q,q,q,q);
    }
    if (education) { where.push('education = ?'); params.push(education); }
    if (['active','inactive','blocked'].includes(status)) { where.push('account_status = ?'); params.push(status); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) { where.push('created_at >= ?'); params.push(`${from} 00:00:00`); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { where.push('created_at <= ?'); params.push(`${to} 23:59:59`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM users ${clause}`, params);
    const [rows] = await db.execute(`SELECT ${publicColumns} FROM users ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    res.json({ users: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (e) { next(e); }
});


router.get('/users/export.csv', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim().slice(0,100);
    const params = [];
    let clause = '';
    if (search) { clause = 'WHERE full_name LIKE ? OR email LIKE ? OR username LIKE ? OR mobile LIKE ?'; const q=`%${search}%`; params.push(q,q,q,q); }
    const [rows] = await db.execute(`SELECT id,full_name,father_name,mother_name,date_of_birth,gender,email,mobile,alternate_mobile,address,city,state,country,pin_code,education,occupation,username,account_status,created_at FROM users ${clause} ORDER BY created_at DESC LIMIT 10000`, params);
    const esc = v => `"${String(v ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
    const csv = [Object.keys(rows[0] || {id:'',full_name:'',email:''}).join(','), ...rows.map(r => Object.values(r).map(esc).join(','))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="registrations.csv"');
    res.send('\uFEFF' + csv);
  } catch (e) { next(e); }
});


router.get('/users/:id', async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid user ID.' });
    const [rows] = await db.execute(`SELECT ${publicColumns} FROM users WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: rows[0] });
  } catch (e) { next(e); }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid user ID.' });
    const allowed = {
      fullName:['full_name',120], fatherName:['father_name',120], motherName:['mother_name',120],
      address:['address',2000], city:['city',100], state:['state',100], country:['country',100],
      pinCode:['pin_code',12], education:['education',120], occupation:['occupation',120],
      accountStatus:['account_status',10]
    };
    const sets=[], vals=[];
    for (const [key,[col,max]] of Object.entries(allowed)) {
      if (Object.prototype.hasOwnProperty.call(req.body,key)) {
        const val = typeof req.body[key] === 'string' ? req.body[key].trim() : '';
        if (key === 'accountStatus' && !['active','inactive','blocked'].includes(val)) return res.status(400).json({error:'Invalid account status.'});
        if (val.length > max) return res.status(400).json({error:`${key} is too long.`});
        sets.push(`${col} = ?`); vals.push(val || null);
      }
    }
    if (!sets.length) return res.status(400).json({error:'No editable fields supplied.'});
    vals.push(req.params.id);
    const [result] = await db.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
    if (!result.affectedRows) return res.status(404).json({error:'User not found.'});
    res.json({message:'User updated.'});
  } catch (e) { next(e); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid user ID.' });
    const [result] = await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User deleted.' });
  } catch (e) { next(e); }
});
module.exports = router;
