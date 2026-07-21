# Caerus — Local Database (setup & reset)

How to build, seed, reset, and inspect the local PostgreSQL database.

Postgres runs in Docker (see `../docker-compose.yml`). We don't rely on a locally
installed `psql` — every command runs **through the container**, which already has
`psql` inside it. Commands below are written for **Windows PowerShell**, run from the
`backend/` folder.

---

## Prerequisites (once)

- Docker Desktop running
- `npm install` already run in `backend/` (needed for the bcrypt step)

---

## First-time setup

### 1. Start Postgres

```powershell
docker compose up -d
```

Check it's running:

```powershell
docker compose ps
```

The `db` service should show as running/healthy.

### 2. Run the migration (build the 5 tables)

```powershell
docker compose cp db/migrations/001_init.sql db:/tmp/001_init.sql
docker compose exec db psql -U caerus -d caerus -f /tmp/001_init.sql
```

Expect a run of `CREATE TABLE` / `CREATE INDEX` lines.

### 3. Generate a bcrypt hash for the seed users

`seed.sql` ships with `<bcrypt-hash-here>` placeholders — the DB stores password
**hashes**, never plaintext. Generate one:

```powershell
node -e "console.log(require('bcryptjs').hashSync('password123', 10))"
```

Copy the whole `$2b$10$...` string. Open `db/seed.sql`, replace **both**
`<bcrypt-hash-here>` placeholders with it (keep the surrounding single quotes), save.
Both demo users share the password `password123`, so the same hash goes in both spots.

> Do this once. After it's pasted in, you don't regenerate it on every reseed —
> unless you ever commit `seed.sql` with a real hash, in which case scrub it back to
> the placeholder before committing (a hash is low-risk, but keep the habit).

### 4. Run the seed (demo data)

```powershell
docker compose cp db/seed.sql db:/tmp/seed.sql
docker compose exec db psql -U caerus -d caerus -f /tmp/seed.sql
```

Expect `INSERT 0 2` (users), `INSERT 0 3` (events), and a larger number for seats.

### 5. Verify it landed

```powershell
docker compose exec db psql -U caerus -d caerus
```

At the `caerus=#` prompt:

```sql
\dt
SELECT count(*) FROM users;    -- expect 2
SELECT count(*) FROM events;   -- expect 3
SELECT count(*) FROM seats;    -- expect 180  (3 events x 60 seats)
\q
```

`180` seats confirms the `generate_series` auto-generation worked (6 rows x 10 seats
per event).

**Demo logins** (once `/auth/login` exists), both password `password123`:
- `admin@caerus.local` — admin
- `a@example.com` — customer

---

## Reset & reseed (wipe everything, start clean)

Use this after changing the schema, or whenever local data gets messy.

### Option A — quick reset (keep the container, drop the schema)

Drops all tables and rebuilds from the migration + seed. Steps 2 and 4 above already
run cleanly on an existing DB **only if** `001_init.sql` starts fresh, so the safest
quick reset is to drop the schema first:

```powershell
docker compose exec db psql -U caerus -d caerus -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

Then re-run the migration (step 2) and seed (step 4).

### Option B — full reset (destroy the container + volume)

Nuclear option — wipes the Postgres data volume entirely, so you're back to a blank
database:

```powershell
docker compose down -v
docker compose up -d
```

The `-v` removes the `pgdata` volume. Then run the migration (step 2) and seed (step 4)
again. Use this if the DB is in a weird state Option A can't fix.

---

## Handy inspection commands

Open an interactive prompt any time:

```powershell
docker compose exec db psql -U caerus -d caerus
```

Useful things once inside:

```sql
\dt                          -- list tables
\d seats                     -- describe the seats table
SELECT * FROM events;        -- see all screenings
SELECT status, count(*) FROM seats GROUP BY status;   -- available vs booked
\q                           -- quit
```

---

## Notes

- `db:` in the `cp` commands is the **service name** from `docker-compose.yml`, not a
  drive letter.
- If you ever install the Postgres client locally (`winget install PostgreSQL.psql`),
  you can use the shorter form from `database-schema.md` §7 instead:
  `psql postgresql://caerus:caerus_dev@localhost:5432/caerus -f db/migrations/001_init.sql`
- Credentials (`caerus` / `caerus_dev` / `caerus`) are **local dev only** — RDS gets a
  real secret in Week 2, stored in `.env`, never committed.