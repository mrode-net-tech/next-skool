# Day 16 — Postgres in Docker

## Goal
Run a **Postgres** instance locally with `docker-compose`, ready for Prisma.

## Estimated time
~45 minutes.

## Where to put your code
In the `my-api` project from Week 3.

## Explanation

We avoid installing Postgres on your machine. Docker spins it up in seconds and gives us a reproducible environment we can later use in CI.

## Step-by-step

Create `docker-compose.yml` next to `package.json`:

```yaml name=docker-compose.yml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: my_api
    ports:
      - '5432:5432'
    volumes:
      - db_data:/var/lib/postgresql/data

  db_test:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: my_api_test
    ports:
      - '5433:5432'

volumes:
  db_data:
```

Start it:
```bash
docker compose up -d
docker compose ps
```

Create `.env`:
```env name=.env
DATABASE_URL="postgresql://app:app@localhost:5432/my_api?schema=public"
DATABASE_URL_TEST="postgresql://app:app@localhost:5433/my_api_test?schema=public"
```

Add `.env` to `.gitignore`. Add a sample:
```env name=.env.example
DATABASE_URL="postgresql://app:app@localhost:5432/my_api?schema=public"
DATABASE_URL_TEST="postgresql://app:app@localhost:5433/my_api_test?schema=public"
```

## Mini-task
Connect to the DB with any client (DataGrip, `psql`, TablePlus). Confirm `my_api` and `my_api_test` exist.

## Glossary
- **Docker Compose** — declares multi-container apps in YAML.
- **Volume** — persistent disk for the container.
- **`.env`** — file holding env vars; never commit secrets.

## Resources
- [Docker Compose docs](https://docs.docker.com/compose/)
- [Postgres image](https://hub.docker.com/_/postgres)

## Checklist
- [ ] `docker compose up -d` works
- [ ] You can connect to both DBs
- [ ] `.env` is gitignored
