const { Pool } = require('pg');

// RDS requires SSL; the local docker-compose Postgres doesn't speak it at
// all, so only turn SSL on when DATABASE_URL isn't pointing at localhost.
const isLocal = /^postgresql:\/\/[^@]+@(localhost|127\.0\.0\.1)/.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

module.exports = pool;
