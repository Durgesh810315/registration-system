require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const db = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const { csrfProtection, csrfErrorHandler } = require('./middleware/csrf.middleware');

const app = express();
const isProd = process.env.NODE_ENV === 'production';
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error('SESSION_SECRET must be set to at least 32 characters in .env');
  process.exit(1);
}
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5500';
app.disable('x-powered-by');
app.set('trust proxy', isProd ? 1 : false);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use((req,res,next) => {
  const origin = req.get('Origin');
  if (origin && origin === frontendOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(origin === frontendOrigin ? 204 : 403);
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

const sessionOptions = {
  key: 'reg.sid',
  secret: process.env.SESSION_SECRET,
  store: new MySQLStore({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'registration_system',
    clearExpired: true, checkExpirationInterval: 15 * 60 * 1000,
    expiration: 2 * 60 * 60 * 1000, createDatabaseTable: true
  }),
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 2 * 60 * 60 * 1000 }
};
app.use(session(sessionOptions));
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many login attempts. Please try again later.' } });
app.use('/api/auth/admin-login', loginLimiter);

app.get('/api/csrf-token', csrfProtection, (req,res) => res.json({ csrfToken: req.csrfToken() }));
app.use('/api/auth', csrfProtection, authRoutes);
app.use('/api/admin', csrfProtection, adminRoutes);

const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'backend/uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir, { dotfiles: 'deny', index: false, fallthrough: false, maxAge: isProd ? '1d' : 0 }));
app.use(csrfErrorHandler);
app.use((err, req, res, _next) => {
  if (err instanceof require('multer').MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Profile photo is too large.' : 'Profile photo upload failed.' });
  if (err.message && err.message.includes('Profile photo must')) return res.status(400).json({ error: err.message });
  console.error('Request failed:', err.code || err.name || 'Error');
  res.status(500).json({ error: 'An unexpected server error occurred. Please try again.' });
});
const port = Number(process.env.PORT || 3000);
db.query('SELECT 1').then(() => {
  app.listen(port, () => console.log(`Registration API running at http://localhost:${port}`));
}).catch(err => {
  console.error('Could not connect to MySQL. Check .env and ensure MySQL is running.', err.code || '');
  process.exit(1);
});
