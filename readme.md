# Nibir-Fashion

Modern web POS/admin dashboard for Nibir Fashion, built as a pnpm workspace monorepo with a separate Electron desktop shell.

## Project Structure

- `artifacts/nibir-fashion` - React + Vite web frontend.
- `artifacts/api-server` - Express API backend.
- `lib/db` - Drizzle schema and PostgreSQL connection used by the web backend.
- `lib/api-client-react` - generated React/API client helpers used by the frontend.
- `lib/api-zod` and `lib/api-spec` - API schemas and OpenAPI tooling.
- `artifacts/desktop-shell` - Electron desktop packaging. Keep this separate from web POS development.

## Web Stack

- Node.js 24
- pnpm workspaces
- React + Vite + Tailwind CSS
- Express 5
- PostgreSQL 16
- Drizzle ORM
- Zod validation

## Windows Docker Development

Prerequisites:

- Docker Desktop for Windows
- Git
- Node.js 24 if you also want to run package scripts outside Docker

Start the web app with PostgreSQL:

```powershell
copy .env.example .env
docker compose up -d --build
```

Open:

- Frontend: http://localhost:12500
- Backend health check: http://localhost:12501/api/healthz
- PostgreSQL: `localhost:12502`

Stop containers:

```powershell
docker compose down
```

Reset the local PostgreSQL data volume:

```powershell
docker compose down -v
docker compose up -d --build
```

View logs:

```powershell
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f database
```

## Environment

Copy `.env.example` to `.env` for local Docker development.

Important variables:

- `POSTGRES_DB` - database name used by the PostgreSQL container.
- `POSTGRES_USER` - database user.
- `POSTGRES_PASSWORD` - database password.
- `POSTGRES_PORT` - host port for PostgreSQL.
- `BACKEND_PORT` - host port for the Express API.
- `FRONTEND_PORT` - host port for the Vite frontend.
- `DATABASE_URL` - used when running the backend directly outside Docker.
- `JWT_SECRET` - signs the HTTP-only auth cookie. Change this before VPS deployment.
- `DEFAULT_ADMIN_EMAIL` - default admin email created when the users table is empty.
- `DEFAULT_ADMIN_PASSWORD` - default admin password created when the users table is empty.

Inside Docker, the backend uses:

```text
postgres://fashion:fashion@database:5432/nibir_fashion
```

## Database

The web backend now uses PostgreSQL through `DATABASE_URL`.

On startup, `lib/db/src/index.ts` creates the development tables if they do not exist, so `docker compose up -d --build` works on a fresh database volume without a separate migration command. It also creates the first admin user when the `users` table is empty.

## Authentication

Default first-run login:

```text
Email: admin@example.com
Password: Admin@12345
```

The backend stores only a bcrypt password hash in PostgreSQL. Login sets a secure HTTP-only JWT cookie named `nibir_fashion_auth`; frontend code cannot read the token directly. The sales, products, product inventory, stock movement, settings, user management, and backup APIs require this cookie.

For VPS deployment, set a strong `JWT_SECRET` and change the default admin password after first login or set a different `DEFAULT_ADMIN_PASSWORD` before the first startup.

Settings is available to every signed-in user. Users can view their profile and change their own password from Settings. Admin users also see User Management, where they can create staff accounts, edit name/email/role/status, reset staff passwords, and enable or disable accounts. Disabled users cannot log in, and the API prevents disabling or demoting the last active admin account.

Product Inventory is visible to both admin and staff users. Admin users can add products, edit products, delete products, add stock, and view stock movement history. Staff users can view products, stock totals, and stock movement history only; product and stock mutation API calls return `403 Forbidden` for staff users.

For direct local development outside Docker, run PostgreSQL first, then:

```powershell
corepack pnpm install
$env:DATABASE_URL="postgres://fashion:fashion@localhost:12502/nibir_fashion"
$env:JWT_SECRET="change-this-local-dev-secret"
$env:PORT="12501"
node artifacts\api-server\build.mjs
node --enable-source-maps artifacts\api-server\dist\index.mjs
```

In a second terminal:

```powershell
$env:PORT="12500"
$env:API_TARGET="http://localhost:12501"
$env:VITE_API_BASE_URL="http://localhost:12501"
cd artifacts\nibir-fashion
node .\node_modules\vite\bin\vite.js --config vite.config.ts --host 0.0.0.0
```

## Electron Desktop

The Electron desktop project remains in `artifacts/desktop-shell`. It is intentionally not part of `docker-compose.yml`; the Docker setup is for web-based billing/POS development with PostgreSQL.

Desktop build commands remain separate:

```powershell
corepack pnpm run build:desktop
corepack pnpm run dist:desktop
```

## Changed Files Notes

- `docker-compose.yml` - defines frontend, backend, and PostgreSQL services.
- `.env.example` - documents local Docker and direct backend environment variables.
- `.dockerignore` - keeps Docker builds focused and avoids copying generated/native desktop output.
- `artifacts/api-server/Dockerfile` - builds and runs the Express backend container.
- `artifacts/nibir-fashion/Dockerfile` - runs the Vite frontend container.
- `lib/db/*` - switches the web DB layer from SQLite to PostgreSQL.
- `lib/db/src/schema/users.ts` - adds the users table schema for web authentication.
- `artifacts/api-server/src/index.ts` - waits for database initialization before listening.
- `artifacts/api-server/src/lib/auth.ts` and `artifacts/api-server/src/routes/auth.ts` - add HTTP-only JWT cookie authentication and password changes.
- `artifacts/api-server/src/routes/users.ts` - adds admin-only user management APIs.
- `artifacts/nibir-fashion/src/lib/auth.tsx`, `artifacts/nibir-fashion/src/pages/Login.tsx`, and `artifacts/nibir-fashion/src/pages/Settings.tsx` - add frontend login state, clean login form, Settings, password changes, and user management.
- `artifacts/api-server/src/routes/backup.ts` - updates restore transactions for PostgreSQL/async Drizzle.
- `pnpm-workspace.yaml` and `pnpm-lock.yaml` - add PostgreSQL packages and non-interactive build-script policy.

## Useful Commands

```powershell
docker compose up -d --build
docker compose ps
docker compose logs -f
docker compose down
docker compose down -v
```
