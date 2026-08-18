# Deploying OmniRemit

Target topology: **two Vercel projects** (host + employee remote) and **three Render web services**
(AuthService, ModuleRegistry, EmployeeService), with **Neon** Postgres.

Everything below assumes a domain you control, with all five components on subdomains of it. That is
not cosmetic — see [Why one parent domain](#why-one-parent-domain).

| Component | Suggested host | Serves |
|---|---|---|
| host (SPA) | Vercel | `app.yourdomain.com` |
| employee_mf (static remote) | Vercel | `emp.yourdomain.com` |
| AuthService | Render | `api.yourdomain.com` |
| ModuleRegistry | Render | `registry.yourdomain.com` |
| EmployeeService | Render | `employee-api.yourdomain.com` |

---

## Why one parent domain

The refresh token is an httpOnly cookie. When the SPA and the API share a registrable domain
(`app.yourdomain.com` → `api.yourdomain.com`), the request is **same-site**, so the default
`SameSite=Lax` cookie is sent and everything works with no special configuration.

Put the SPA on `*.vercel.app` and the API elsewhere and they become **cross-site**: the browser
withholds the cookie on `POST /api/auth/refresh`, which presents as a login that succeeds and then
drops the session a minute later. If you must run that way, set `Auth__SameSite=None` (it requires a
Secure cookie, enforced at startup) and accept the dependency on third-party cookies, which browsers
are progressively restricting.

Keep `Auth__RefreshCookieDomain` **empty**. That yields a host-only cookie on the API's own domain.
Setting `.yourdomain.com` would broadcast the refresh token to every subdomain, including the
statically-hosted frontends that have no use for it.

---

## Step 1 — Databases

Create three Neon databases (one project is fine): `omniremit_auth`, `omniremit_registry`,
`omniremit_employee`. Collect a pooled connection string for each.

All three services run `db.Database.MigrateAsync()` at startup, so schema is applied automatically on
first boot. Deploy **one instance per service initially** — several instances racing the same
migration on a cold database is asking for trouble. Scale out after the first successful boot.

## Step 2 — Production secrets

Generate fresh values. Do not reuse anything from local development.

- **RSA keypair** for JWT signing (RS256). AuthService needs `Jwt__SigningKeyPrivate` **and**
  `Jwt__SigningKeyPublic`; the other two services get the **public key only** — they verify, they
  never issue.
- **`Internal__ApiKey`** — one random secret, shared by all three services, for internal
  service-to-service calls (permission-feature sync).

These go **only** into the platform dashboards. Never into the repo; `.env` is git-ignored and must
stay that way.

## Step 3 — Deploy AuthService (Render)

New **Web Service** → Docker.

- **Dockerfile path:** `Backend/AuthService/Dockerfile`
- **Docker build context:** `Backend` ← **required**, not the service folder

> The context must be `Backend/` because `AuthService.csproj` and `ModuleRegistry.csproj` inherit
> `TargetFramework` from `Backend/Directory.Build.props`. Build them from the service folder and
> restore fails with `NETSDK1013: The TargetFramework value '' was not recognized`.
> (`EmployeeService.csproj` happens to declare it inline, but uses the same context for consistency.)

Environment:

```
ConnectionStrings__AuthDb=<neon auth connection string>
Jwt__Issuer=omniremit-auth-service
Jwt__Audience=omniremit-host
Jwt__SigningKeyPrivate=<production private key>
Jwt__SigningKeyPublic=<production public key>
Auth__RefreshCookieName=omniremit_refresh
Auth__RefreshCookieDomain=
Auth__SameSite=Lax
Internal__ApiKey=<shared secret>
Cors__AllowedOrigins__0=https://app.yourdomain.com
ASPNETCORE_ENVIRONMENT=Production
PORT=8081
```

Optional, all with sane defaults: `Jwt__AccessTokenMinutes`, `Jwt__RefreshTokenDays`,
`Jwt__AbsoluteSessionHours`, `PasswordPolicy__*`, `RateLimiting__*`, `Google__ClientId`,
`Google__AllowedDomains`.

Verify: `https://<render-url>/health` → **200**.

## Step 4 — Capture the bootstrap admin password ⚠️

On its **first** boot against an empty database, `AuthDbSeeder` creates:

- email `superadmin@omniremit.local`
- a **randomly generated password, written to the logs exactly once**

Copy it out of the Render logs immediately. It is not recoverable afterwards and it is the only way
into the platform. The account is flagged `mustChangePassword`, so change it at first login.

## Step 5 — Deploy ModuleRegistry and EmployeeService

Same pattern, context `Backend`, Dockerfiles `Backend/ModuleRegistry/Dockerfile` and
`Backend/EmployeeService/Dockerfile`.

```
ConnectionStrings__RegistryDb=<neon registry>     # EmployeeService: ConnectionStrings__EmployeeDb
Jwt__Issuer=omniremit-auth-service                # identical across all three
Jwt__Audience=omniremit-host
Jwt__SigningKeyPublic=<public key only>
AuthService__BaseUrl=https://api.yourdomain.com
AuthService__InternalApiKey=<same Internal__ApiKey>
Cors__AllowedOrigins__0=https://app.yourdomain.com
ASPNETCORE_ENVIRONMENT=Production
PORT=8081
```

Verify both `/health` endpoints → 200. Note EmployeeService serves under a path base, so its API
root is `https://employee-api.yourdomain.com/api/employee-service`.

## Step 6 — DNS

Add the three custom domains in Render and point DNS at them. Wait for certificates to issue before
continuing — the frontends will be built against these URLs.

## Step 7 — Deploy employee_mf (Vercel)

New project from this repo.

- **Root Directory:** `Frontend` ← **required**. Both apps depend on the
  `@omniremit/federation-config` workspace package, which will not resolve if the root is the app
  folder.
- Build command, install command and output directory are already declared in
  `Frontend/apps/employee_mf/vercel.json`.

Environment (build-time — Vite inlines these, so changing one needs a redeploy):

```
VITE_EMPLOYEE_API=https://employee-api.yourdomain.com/api/employee-service
VITE_AUTH_API=https://api.yourdomain.com
```

Attach `emp.yourdomain.com`. Then verify the federation artifacts are actually reachable:

```bash
curl -sI https://emp.yourdomain.com/mf-manifest.json | grep -i "access-control-allow-origin"
```

That header must be present. The Module Federation runtime `fetch`es the manifest cross-origin from
the host's page, and **Vercel serves static files with no CORS header by default** — without the
rules in `vercel.json` the remote silently fails to load.

## Step 8 — Deploy host (Vercel)

Second project, same repo, **Root Directory `Frontend`** again.

```
VITE_AUTH_SERVICE_URL=https://api.yourdomain.com
VITE_MODULE_REGISTRY_URL=https://registry.yourdomain.com
VITE_GOOGLE_CLIENT_ID=            # optional; blank shows an honest "not configured" SSO state
```

Both `VITE_` values are **required** — `src/config/env.ts` throws at startup if either is missing, so
a misconfigured deploy fails loudly rather than producing confusing network errors later.

Attach `app.yourdomain.com`.

## Step 9 — Confirm CORS origins, redeploy backends

Make sure all three Render services have `Cors__AllowedOrigins__0=https://app.yourdomain.com` and
redeploy them.

## Step 10 — Point the registry at the deployed remote

This is **data, not configuration** — the host declares zero build-time remotes and resolves them at
runtime from the registry database. Nothing is rebuilt.

Log in as the bootstrap admin, change the password, then **Setup → Applications → Employee**:

- **Manifest URL** → `https://emp.yourdomain.com/mf-manifest.json`
- **Permissions Source URL** → `https://employee-api.yourdomain.com/api/employee-service/permissions`

ModuleRegistry fetches the manifest **server-side** on save and rejects it unless it is a real
Module Federation manifest carrying a `name` (this build emits `employee_mf`). It then re-probes on a
schedule to drive the health indicators.

---

## Verification checklist

1. All three `/health` endpoints → 200.
2. **Log in, wait a minute, hard-refresh.** Still logged in ⇒ the refresh cookie path is correct.
   This is the single most valuable check.
3. Network tab shows API calls returning **200 directly, with no 307 hop**. A 307 means forwarded
   headers are not being honoured.
4. An audit log entry's source IP is a **real client IP**, not a constant Render address. This is the
   observable proof that `UseForwardedHeaders` is working — and therefore that the login rate limiter
   is partitioning per client rather than sharing one platform-wide bucket.
5. Employee app opens from the sidebar and renders; `mf-manifest.json` loads from `emp.` with CORS
   headers present.
6. Employee CRUD round-trips against `employee-api.`.
7. Dashboard shows real non-zero counts. Stop ModuleRegistry and the Applications card should read
   **"Registry unreachable"** while user and role counts stay real — degradation, not a blank page.

## Notes and gotchas

- **Vercel preview deployments will fail CORS** against production APIs, because each preview gets a
  new URL and `WithOrigins` does not accept wildcards. This is intended: previews should not talk to
  production data. Give previews their own backend if you need them working.
- **Render free tier cold-starts** after inactivity. The first request after idle can take tens of
  seconds, which reads as a hung login. Use a paid instance for anything user-facing.
- `.dockerignore` in `Backend/` deliberately excludes `.env`. Every service calls
  `Env.TraversePath().Load()`, which walks up the tree — a `.env` copied into an image would be found
  and would silently override the platform's environment variables with development credentials.
- Containers run as a **non-root** user and honour the platform's injected `$PORT`.
