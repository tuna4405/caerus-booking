// Business logic for POST /auth/register and /auth/login.
// TODO: hash/compare passwords with bcryptjs, sign JWTs with jsonwebtoken,
// throw EmailAlreadyExistsError / UnauthorizedError from lib/errors.js.

async function register({ name, email, password }) {
  throw new Error('auth.service#register not implemented yet');
}

async function login({ email, password }) {
  throw new Error('auth.service#login not implemented yet');
}

module.exports = { register, login };
