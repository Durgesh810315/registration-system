require('dotenv').config();
const bcrypt = require('bcrypt');
const readline = require('readline');
const db = require('../config/db');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(resolve => rl.question(q, resolve));
(async () => {
  try {
    const username = (await ask('New admin username (3-60 chars): ')).trim();
    const password = await ask('Strong admin password (input visible in terminal): ');
    if (!/^[A-Za-z0-9_.-]{3,60}$/.test(username)) throw new Error('Username format is invalid.');
    if (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) throw new Error('Password must be at least 12 characters and include letters and numbers.');
    const hash = await bcrypt.hash(password, 12);
    await db.execute('INSERT INTO admins (username,password_hash,role) VALUES (?,?,?)', [username,hash,'owner']);
    console.log(`Owner administrator "${username}" created.`);
  } catch (e) {
    console.error('Could not create administrator:', e.code === 'ER_DUP_ENTRY' ? 'That username already exists.' : e.message);
    process.exitCode = 1;
  } finally { rl.close(); await db.end(); }
})();
