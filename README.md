# OmniRemit

Enterprise micro-frontend platform. A central **host** application (React 19.2 + Vite + Module
Federation 2.0) that authenticated users land in, which dynamically loads independently-deployed
**remote** micro-frontend apps at runtime based on a database-backed module registry — no remote is
ever hard-coded into the host's build.

> Full architecture, database schema, endpoint list and build order live in the plan this repo was
> built from. This README documents how to run what exists today.

**New to this repo?** Start with [SETUP.md](SETUP.md) — a step-by-step runbook for cloning, installing,
provisioning your own Neon databases, and getting all three services running locally.

## Repo layout

```
omniRemit/
├── Frontend/            pnpm workspace — apps/host is the shell app
└── Backend/              OmniRemit.sln — AuthService + ModuleRegistry (separate Postgres DBs each)
```

## Services

| Service | Purpose | Default port |
| --- | --- | --- |
| `Frontend/apps/host` | Host shell: login, sidebar, settings, dynamic remote loading | 5173 |
| `Backend/AuthService` | Users, roles, permissions catalog, JWT auth | 5155 |
| `Backend/ModuleRegistry` | Registered remote apps, status/maintenance, sidebar feed | 5200 |

## Prerequisites

- Node.js v24, pnpm 9+ (`corepack enable` will pick up the pinned version)
- .NET SDK 10
- Two Neon Postgres databases (one for AuthService, one for ModuleRegistry) — connection strings are
  supplied via environment variables, never committed

## First-time setup

```bash
# Frontend
cd Frontend
pnpm install

# Backend
cd ../Backend
dotnet restore
```

Copy every `.env.example` next to its real `.env` and fill in real values (Neon connection strings,
JWT keys, CORS origins, internal API key — see each file for the full list). `.env` files are
git-ignored; only `.env.example` files are committed.

## Running everything

Each service has a `.claude/launch.json` entry (`frontend-dev`, `backend-dev`, `registry-dev`) for use
with the Claude Code preview tools. To run manually:

```bash
# Terminal 1 — AuthService
dotnet run --project Backend/AuthService

# Terminal 2 — ModuleRegistry
dotnet run --project Backend/ModuleRegistry

# Terminal 3 — Frontend host
cd Frontend
pnpm --filter host dev
```

Each service applies its own EF Core migrations automatically on startup once its connection string
is set (`db.Database.MigrateAsync()` in `Program.cs`) — you don't need to run `dotnet ef database
update` by hand for normal use. It's still available if you want to apply migrations ahead of time
(e.g. in CI):

```bash
dotnet ef database update --project Backend/AuthService
dotnet ef database update --project Backend/ModuleRegistry
```

On first run against an empty AuthDb, AuthService seeds the host's built-in permission catalog, six
starter roles (Super Admin, Admin, Manager, Agent, Normal User, Read Only User), and one bootstrap
Super Admin account. The generated temporary password is logged **once**, to the console, at that
first startup only — copy it from the log, sign in, and change it immediately
(`MustChangePassword` forces this). It is never written anywhere else.

### Generating the RS256 key pair

Access tokens are signed RS256. Generate a key pair once and put both values in
`Backend/AuthService/.env`; put only the public key in `Backend/ModuleRegistry/.env`:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl rsa -pubout -in private.pem -out public.pem
```

Paste each PEM's contents as a single `.env` line with real newlines replaced by literal `\n`
sequences — both services unescape that automatically (see `RsaKeyLoader`/`Program.cs`).

## Contract for future remote apps

Any remote app registered in the Module Registry must:
1. Build with `@module-federation/enhanced` (or compatible MF 2.0 tooling) and publish an
   `mf-manifest.json` — that single URL is all an admin needs to paste into Setup → Maintenance.
2. Expose its root component as `./App` — the host always calls `loadRemote(`${key}/App`)`.
3. Never import the host's global CSS. Style only with the remote's own CSS Modules.
4. Treat `react` / `react-dom` as federation-shared singletons matching the host's versions.

## What's built (first delivery slice)

- **AuthService**: RS256 JWT login/refresh/logout/me with an httpOnly refresh cookie, Users CRUD,
  Roles CRUD with a Features×Capabilities permission matrix, per-user permission overrides, the
  permission catalog, and the internal endpoints ModuleRegistry syncs remote-app permissions
  through. Global exception handling returns safe, consistent `ProblemDetails` JSON for any
  unhandled error (never a bare 500 or a leaked stack trace).
- **ModuleRegistry**: RemoteApps CRUD, Active/Maintenance/Disabled status with an admin-authored
  maintenance message, the `for-sidebar` feed the host consumes, and the resync-permissions
  recovery endpoint. Validates JWTs with AuthService's public key only.
- **Host frontend**: Omni Suite–themed login, dynamic sidebar + Module Federation runtime loader
  (zero build-time remotes), Setup panel with permission-gated Users / Roles / Maintenance screens,
  skeleton loading throughout, CSS Modules only (no Tailwind/CSS-in-JS), Zustand for auth and
  registry state.

## Known limitations / not yet built

- No real remote micro-frontend exists yet — the registry and loader are implemented and boot-tested
  against an empty list, but end-to-end loading of an actual remote hasn't been exercised.
- Full login → CRUD → dynamic-loading verification requires real Neon connection strings and a real
  RS256 key pair, which this environment doesn't have. Everything below "Verification" describes
  what *has* been checked without them.
- Service-to-service auth (ModuleRegistry → AuthService) is a shared static API key, not mTLS/OAuth
  client-credentials — a documented v1 simplification, see the plan's risk notes.
- No CI pipeline, containerization, or deployment config yet.

## Verification performed

Without a live Neon database, these were verified directly:

- Both backend services `dotnet build` clean and boot correctly with **and** without a configured
  connection string/JWT keys (degrading gracefully — health check still responds; DB-backed
  endpoints return a clear error instead of crashing the process).
- The frontend typechecks clean (`pnpm exec tsc -b --noEmit`) and boots with zero console errors.
- End-to-end request wiring was confirmed live: the real Login form → `authStore` → `authServiceClient`
  → AuthService (running on a scratch port with a real, non-Neon-backed connection string) → a
  simulated failure correctly surfaces as a clean, safe error message in the UI — including through
  the newly-added global exception handler, which was added *because* this test caught a bare/opaque
  500 response before the fix.
- Permission gating, route guards, and the Setup sub-nav all correctly hide/redirect based on the
  authenticated user's capabilities.

Once real Neon connection strings and an RS256 key pair are supplied, run through: sign in as the
seeded Super Admin → create a role with a couple of capabilities → create a user with that role →
confirm the sidebar/Setup nav reflects exactly what that role grants → register a real remote app's
`mf-manifest.json` in Setup → Maintenance → confirm it appears in the sidebar and loads → flip it to
Maintenance and confirm the configured message appears instead.
