const csrf = require('csurf');
// Session-backed CSRF tokens. The token endpoint is read-only; state-changing
// requests must include the token in the X-CSRF-Token header.
const csrfProtection = csrf({
  cookie: false,
  value: req => req.get('X-CSRF-Token') || req.body?._csrf || ''
});
function csrfErrorHandler(err, req, res, next) {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Security token expired or invalid. Refresh the page and try again.' });
  }
  next(err);
}
module.exports = { csrfProtection, csrfErrorHandler };
