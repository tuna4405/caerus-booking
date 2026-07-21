// Business logic for POST /auth/register and /auth/login.
// register: validate → hash (bcryptjs, cost 10) → insert → sign JWT.
// The email UNIQUE constraint (not a pre-check SELECT) enforces EMAIL_ALREADY_EXISTS.
// TODO: login — compare passwords with bcryptjs, throw UnauthorizedError on mismatch.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { ValidationError, EmailAlreadyExistsError } = require('../lib/errors');

// A deliberately simple email check — full RFC validation isn't worth it (api-spec §3.1).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_COST = 10;
const TOKEN_TTL = '7d';

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

  // 4. Sign a JWT carrying id + role so protected routes need no DB lookup (api-spec §2.3).
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );

  // `user` is exactly { id, name, email, role } from RETURNING — no password_hash leaks.
  return { user, token };
}

async function login({ email, password }) {
  throw new Error('auth.service#login not implemented yet');
}

module.exports = { registerUser, login };
