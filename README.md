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
├── Frontend/            pnpm workspace — apps/host (shell) + apps/employee_mf (first remote app)
└── Backend/              OmniRemit.slnx — AuthService + ModuleRegistry + EmployeeService (separate Postgres DBs each)
```

## Services

| Service | Purpose | Default port |
| --- | --- | --- |
| `Frontend/apps/host` | Host shell: login, sidebar, topbar settings, dynamic remote loading | 5173 |
| `Frontend/apps/employee_mf` | Employee remote micro-frontend (Module Federation) | 5001 |
| `Backend/AuthService` | Users, roles, dynamic permissions catalog, JWT auth, platform audit log | 5155 |
| `Backend/ModuleRegistry` | Registered remote apps, status/maintenance, sidebar feed | 5200 |
| `Backend/EmployeeService` | Employees CRUD, backing the employee remote app; path base `/api/employee-service` | 5285 |

## Prerequisites

- Node.js v24, pnpm 9+ (`corepack enable` will pick up the pinned version)
- .NET SDK 10
- Three Neon Postgres databases (one each for AuthService, ModuleRegistry, EmployeeService) —
  connection strings are supplied via environment variables, never committed

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

Each service has a `.claude/launch.json` entry (`frontend-dev`, `backend-dev`, `registry-dev`,
`employee-service-dev`, `employee-mf-dev`) for use with the Claude Code preview tools. To run
manually:

```bash
# Terminal 1 — AuthService
dotnet run --project Backend/AuthService

# Terminal 2 — ModuleRegistry
dotnet run --project Backend/ModuleRegistry

# Terminal 3 — EmployeeService
dotnet run --project Backend/EmployeeService

# Terminal 4 — Frontend host
cd Frontend
pnpm --filter host dev

# Terminal 5 — employee_mf remote (only needed to actually load the Employee app)
cd Frontend
pnpm --filter employee-mf preview
```

Each backend service applies its own EF Core migrations automatically on startup once its connection
string is set (`db.Database.MigrateAsync()` in `Program.cs`) — you don't need to run `dotnet ef
database update` by hand for normal use. It's still available if you want to apply migrations ahead
of time (e.g. in CI):

```bash
dotnet ef database update --project Backend/AuthService
dotnet ef database update --project Backend/ModuleRegistry
dotnet ef database update --project Backend/EmployeeService
```

On first run against an empty AuthDb, AuthService seeds the host's built-in permission catalog, six
starter roles (Super Admin, Admin, Manager, Agent, Normal User, Read Only User), and one bootstrap
Super Admin account. The generated temporary password is logged **once**, to the console, at that
first startup only — copy it from the log, sign in, and change it immediately
(`MustChangePassword` forces this). It is never written anywhere else.

### Generating the RS256 key pair

Access tokens are signed RS256. Generate a key pair once and put both values in
`Backend/AuthService/.env`; put only the public key in `Backend/ModuleRegistry/.env` and
`Backend/EmployeeService/.env` (every other service validates tokens locally against it, never
issues or forges them):

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl rsa -pubout -in private.pem -out public.pem
```

Paste each PEM's contents as a single `.env` line with real newlines replaced by literal `\n`
sequences — every service unescapes that automatically (see `RsaKeyLoader`/`Program.cs`).

## Contract for future remote apps

Any remote app registered in the Module Registry must:
1. Build with `@module-federation/vite` (or compatible MF 2.0 tooling) and publish an
   `mf-manifest.json` — that single URL is all an admin needs to paste into Setup → Applications.
2. Expose its root component as `./App` — the host always calls `loadRemote(`${key}/App`)`.
3. Never import the host's global CSS. Style only with the remote's own CSS Modules.
4. Treat `react` / `react-dom` as federation-shared singletons matching the host's versions.
5. Get the current user's auth state from `window.__omniremitHost__` (installed once at host boot,
   see `Frontend/apps/host/src/shared/federation/hostBridge.ts`) instead of managing its own login —
   `getAccessToken()` / `ensureFreshAccessToken()` for API calls, `hasCapability(featureKey, capability)`
   for local UI gating. A remote is loaded with zero React props (well after the host's own render
   tree is up), so this is a live global read, not a snapshot.
6. Declare its own capability set dynamically instead of a hand-maintained list: expose a
   `GET /permissions` discovery endpoint returning `{ "capabilities": [{ "key", "displayName" }] }`,
   point the RemoteApp's `PermissionsSourceUrl` at it, and gate each mutating action locally with a
   `[RequiresCapability("...")]`-style attribute that reads the JWT's `perms` claim (see
   `Backend/EmployeeService/Infrastructure/Security/RequiresCapabilityAttribute.cs` for the reference
   implementation). ModuleRegistry fetches that endpoint on save/resync and pushes the result into
   AuthService's catalog — adding a new capability there is enough for it to show up in the host's
   Role editor, nothing to hand-register.

## What's built

- **AuthService**: RS256 JWT login/refresh/logout/me with an httpOnly refresh cookie, Users CRUD,
  Roles CRUD with a Features×Capabilities permission matrix, per-user permission overrides, and the
  internal endpoints ModuleRegistry and remote-app backends sync through. The permission catalog is
  dynamic per feature (`PermissionFeatureCapability`) rather than one fixed capability enum applied
  everywhere — each host feature and each registered remote app declares its own capability set, and
  the Role/User override editors render exactly that set. AuthService is also the single sink for the
  platform's audit log (`AuditLog`): host mutations write directly, other services (ModuleRegistry,
  EmployeeService, future remotes) write through an internal API-key-protected endpoint, so "every
  audit, host or remote" is one table. Global exception handling returns safe, consistent
  `ProblemDetails` JSON for any unhandled error (never a bare 500 or a leaked stack trace).
- **ModuleRegistry**: RemoteApps CRUD, Active/Maintenance/Disabled status with an admin-authored
  maintenance message, the `for-sidebar` feed the host consumes, and the resync-permissions recovery
  endpoint. Each RemoteApp can carry a `PermissionsSourceUrl` pointing at the remote's own capability
  discovery endpoint — ModuleRegistry fetches it on save/resync and pushes the result into
  AuthService's catalog. Validates JWTs with AuthService's public key only.
- **EmployeeService**: a real backend for the Employee remote app — Employees CRUD, JWT validation
  against AuthService's public key, a `GET /permissions` discovery endpoint that reflects its own
  `[RequiresCapability]`-attributed actions (see "Contract for future remote apps" above), and an
  `AuthServiceClient` that writes into the shared audit log. Served under path base
  `/api/employee-service`.
- **Host frontend**: blue "OmniConnect" theme (`shared/styles/theme.css` — the only place a raw
  color/spacing/radius value is allowed to live), a redesigned split-panel login page, dynamic sidebar
  (Dashboard + registered apps + a System section gated to Audit Logs) with a Module Federation
  runtime loader (zero build-time remotes), a Topbar gear-icon settings dropdown that replaces
  in-sidebar Setup links and surfaces exactly the Users / Roles / Applications screens the signed-in
  user can reach, a System → Audit Logs page, skeleton loading throughout, CSS Modules only (no
  Tailwind/CSS-in-JS), and Zustand for auth and registry state. Exposes `window.__omniremitHost__`
  (`shared/federation/hostBridge.ts`) so a loaded remote can read auth state and capabilities without
  its own login flow.
- **employee_mf**: the first real remote micro-frontend, built to the contract above — federated with
  `@module-federation/vite` under the name `employee_mf`, exposes `./App`, and reads the host's
  bridge instead of managing its own auth. Not registered in ModuleRegistry by default; an admin
  registers it the same way any future remote would be — pasting its `mf-manifest.json` URL into
  Setup → Applications.

## Known limitations / not yet built

- A real remote micro-frontend (`employee_mf` + `EmployeeService`) now exists and is built to the
  federation/auth/permissions contract, but it isn't seeded into ModuleRegistry — it has to be
  registered manually via Setup → Applications before it shows up in the sidebar. Whether that's
  already been done in your environment is a runtime DB question, not something this README can
  answer; check the RemoteApps table (or the sidebar once signed in) to confirm.
- Full login → CRUD → dynamic-loading verification requires real Neon connection strings and a real
  RS256 key pair, which this environment doesn't have. Everything below "Verification" describes
  what *has* been checked without them.
- Service-to-service auth (ModuleRegistry/EmployeeService → AuthService) is a shared static API key,
  not mTLS/OAuth client-credentials — a documented v1 simplification, see the plan's risk notes.
- No CI pipeline, containerization, or deployment config yet.

## Verification performed

Without a live Neon database, these were verified directly:

- All three backend services `dotnet build` clean and boot correctly with **and** without a
  configured connection string/JWT keys (degrading gracefully — health check still responds;
  DB-backed endpoints return a clear error instead of crashing the process).
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
confirm the sidebar/Topbar settings menu reflects exactly what that role grants → register
`employee_mf`'s `mf-manifest.json` in Setup → Applications (or any other remote's) → confirm it
appears in the sidebar and loads → flip it to Maintenance and confirm the configured message appears
instead.
