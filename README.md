# Registration System — Node.js, Express and MySQL

A runnable starter application with registration, password hashing, MySQL persistence, owner login, protected dashboard APIs, filters, pagination, edits, deletes and CSV export.

## Requirements
- Node.js 20 LTS or newer
- MySQL 8.x
- A browser and a local static web server (VS Code Live Server is convenient)

## 1. Install dependencies
Open a terminal in the `registration-system` root:
```bash
npm install
```

## 2. Create the database
Use MySQL Workbench or phpMyAdmin to run `database/schema.sql`. It creates `registration_system`, `users`, and `admins`.

For a least-privilege application account, run this as a MySQL administrator (replace the password with a strong unique one):
```sql
CREATE USER 'registration_app'@'localhost' IDENTIFIED BY 'REPLACE_WITH_A_STRONG_DB_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX ON registration_system.* TO 'registration_app'@'localhost';
FLUSH PRIVILEGES;
```
The session middleware creates its own session table on startup; the app account may need `CREATE` permission for that table. If your MySQL setup restricts this, create the session table with a DBA account or use a separately configured session-store account.

## 3. Configure environment
Copy `.env.example` to `.env`, then fill in:
- `DB_USER` and `DB_PASSWORD` from the account above
- `SESSION_SECRET`: use a random secret at least 32 characters long
- `FRONTEND_ORIGIN`: exactly the origin serving `frontend` (for Live Server this is often `http://127.0.0.1:5500`)
- `UPLOAD_DIR`: normally `backend/uploads`

Generate a session secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
Never commit `.env` to source control.

## 4. Create the owner administrator
```bash
npm run create-admin
```
Enter a unique admin username and a strong password of at least 12 characters. The script stores a bcrypt hash in `admins`; it does not ship with a default login.

## 5. Start backend
```bash
npm run dev
```
The API listens at `http://localhost:3000`. If it exits, check MySQL is running, `.env` values are correct, and the SQL schema was imported.

## 6. Serve frontend
In VS Code, open the `frontend` folder and start Live Server on `index.html`. Set `frontend/js/config.js` `API_BASE` to `http://localhost:3000`. Make sure the Live Server origin matches `FRONTEND_ORIGIN` exactly. Do not open pages with `file://`.

## 7. Verify end-to-end
1. Open the registration page from Live Server.
2. Register a fictional test user with a unique email, username and mobile number.
3. In MySQL Workbench run:
   ```sql
   USE registration_system;
   SELECT id, full_name, email, username, account_status, created_at FROM users ORDER BY id DESC LIMIT 5;
   SELECT password_hash FROM users ORDER BY id DESC LIMIT 1;
   ```
   The password column should look like a bcrypt hash, not the original password. Do not share or log this output.
4. Open `admin-login.html`, sign in with the owner account, and confirm the same record appears in the dashboard.
5. Test filters, pagination, view/edit, delete confirmation, CSV export, and logout.
6. While logged out, request `GET http://localhost:3000/api/admin/users`; expected response is `401`.

## API overview
- `POST /api/auth/register` — multipart form data; stores a user in MySQL.
- `POST /api/auth/admin-login` — administrator authentication.
- `POST /api/auth/admin-logout` — destroys the session.
- `GET /api/auth/session` — current admin session status.
- `GET /api/csrf-token` — obtains a CSRF token.
- `GET /api/admin/stats` — protected stats/recent registrations.
- `GET /api/admin/users?page=1&limit=10&search=...&education=...&status=...&from=YYYY-MM-DD&to=YYYY-MM-DD` — protected list and filters.
- `GET /api/admin/users/:id` — protected individual details (never includes password hash).
- `PUT /api/admin/users/:id` — protected update of permitted fields.
- `DELETE /api/admin/users/:id` — protected delete.
- `GET /api/admin/users/export.csv` — protected CSV export (up to 10,000 rows).

## Troubleshooting
- **ECONNREFUSED / DB connection error:** start MySQL and verify host, port, username and password.
- **Access denied:** re-run the least-privilege SQL using a MySQL administrator and verify `.env`.
- **CORS / failed fetch:** the frontend origin and `FRONTEND_ORIGIN` must match exactly (localhost and 127.0.0.1 are different origins); confirm backend is running.
- **CSRF token invalid:** reload the page and sign in again; keep cookies enabled.
- **Photo upload rejected:** only JPEG, PNG and WEBP up to the configured size are accepted.
- **Admin username exists:** run `npm run create-admin` with another username.
- **Port in use:** change `PORT` in `.env` and update the frontend API base if needed.

## Security notes before production
- Serve everything over HTTPS and set `NODE_ENV=production`; secure cookies require HTTPS.
- Put frontend and backend behind a reverse proxy or serve frontend from the same origin where possible.
- Review privacy notices, data retention, access logs and consent before collecting personal information.
- The optional photo is served as a public static asset in this starter. For sensitive production use, move photos to private storage and serve them through an authenticated endpoint.
- `csurf` is deprecated upstream. This project uses session-backed CSRF tokens for clarity; for a new production deployment, consider a maintained CSRF middleware and have the implementation reviewed.
- Add automated integration tests with a disposable MySQL database before production deployment. Do not treat a successful local startup as proof that every feature has been tested.
