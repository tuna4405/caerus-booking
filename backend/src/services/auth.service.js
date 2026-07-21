// Business logic for POST /auth/register and /auth/login.
// register: validate → hash (bcryptjs, cost 10) → insert → signToken.
// login:    validate → look up → bcrypt.compare → signToken (same 401 either way).
// The email UNIQUE constraint (not a pre-check SELECT) enforces EMAIL_ALREADY_EXISTS.
// JWT signing lives in lib/jwt.js so register, login, and the auth middleware share it.

const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { ValidationError, EmailAlreadyExistsError, UnauthorizedError } = require('../lib/errors');
const { signToken } = require('../lib/jwt');

// A deliberately simple email check — full RFC validation isn't worth it (api-spec §3.1).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_COST = 10;

async function registerUser({ name, email, password }) {
  // 1. Validate everything before touching the DB.
  if (typeof name !== 'string' || name.trim() === '') {
    throw new ValidationError('name is required.');
  }
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    throw new ValidationError('A valid email is required.');
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw new ValidationError('password must be at least 8 characters.');
  }

  // 2. Normalize email (schema doc §3.1) and hash the password — never store plaintext.
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  // 3. Insert. role defaults to 'customer' in the DB, so we don't set it.
  //    Parameterized query — never string-concatenate SQL.
  let user;
  try {
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, role`,
      [name.trim(), normalizedEmail, passwordHash]
    );
    user = result.rows[0];
  } catch (err) {
    // Let the UNIQUE(email) constraint fire (no pre-check SELECT → no race).
    // Postgres unique_violation = 23505 → EMAIL_ALREADY_EXISTS (409).
    if (err.code === '23505') {
      throw new EmailAlreadyExistsError();
    }
    throw err;
  }

  // 4. Sign a JWT via the shared helper (payload { id, role } — api-spec §2.3).
  const token = signToken(user);

  // `user` is exactly { id, name, email, role } from RETURNING — no password_hash leaks.
  return { user, token };
}

async function loginUser({ email, password }) {
  // 1. Validate presence + type first. An empty/missing body is 400, not 401.
  if (typeof email !== 'string' || email.trim() === '') {
    throw new ValidationError('email is required.');
  }
  if (typeof password !== 'string' || password.length === 0) {
    throw new ValidationError('password is required.');
  }

  // 2. Normalize email the same way register did on insert, then look up (parameterized).
  const normalizedEmail = email.trim().toLowerCase();
  const result = await pool.query(
    `SELECT id, name, email, role, password_hash
     FROM users
     WHERE email = $1`,
    [normalizedEmail]
  );
  const row = result.rows[0];

  // 3. SECURITY (api-spec §3.1): return the identical 401 whether the email is
  //    unknown OR the password is wrong — never reveal which, so attackers can't
  //    enumerate registered emails.
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  // 4. Strip password_hash; shape `user` exactly like registerUser returns it.
  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  const token = signToken(user);
  return { user, token };
}

module.exports = { registerUser, loginUser };
