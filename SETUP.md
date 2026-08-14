# OmniRemit — Setup Guide for New Collaborators

Follow this top-to-bottom to get all three services running locally: **AuthService** (`:5155`),
**ModuleRegistry** (`:5200`), and the **host** frontend (`:5173`). For architecture, endpoints, and
what's built so far, see [README.md](README.md) — this file is just the "get it running" runbook.

You'll provision your **own** Postgres databases and your **own** signing keys — nothing here is
shared with anyone else on the team, and you'll never need anyone else's secrets to run the project.

## 1. Prerequisites

Install these, then confirm each with its version command:

| Tool | Needed | Check |
|---|---|---|
| Node.js | v24+ | `node --version` |
| pnpm | 9+ | `pnpm --version` (see step 2 if missing) |
| .NET SDK | 10 | `dotnet --version` |
| Git | any recent | `git --version` |
| OpenSSL | any recent | `openssl version` |

- **pnpm**: if you don't have it, run `corepack enable` (ships with Node) — the repo pins the exact
  pnpm version via `packageManager` in `Frontend/package.json`, so pnpm will auto-install the right
  version the first time you run a pnpm command in that folder.
- **OpenSSL**: on Windows, Git Bash (installed alongside Git for Windows) already includes it. On
  macOS/Linux it's normally preinstalled. If truly unavailable, ask in the team chat — the key
  generation step below needs it.

## 2. Clone and install

```bash
git clone https://github.com/Ashok-2004/OmniRemit.git
cd OmniRemit
```

```bash
cd Frontend
pnpm install
```

```bash
cd ../Backend
dotnet restore
```

## 3. Provision your own two Neon Postgres databases

Each collaborator runs against their **own** databases — not a shared one. This keeps everyone's
local test data (users, roles, etc.) independent, and means nobody has to hand you a password over
chat.

1. Sign up at [neon.tech](https://neon.tech) (there's a free tier, more than enough for local dev).
2. Create **two separate databases** — one for AuthService, one for ModuleRegistry. (Either two
   databases in the same Neon project, or two separate projects — either works, they just need to be
   two distinct databases, never the same one for both services.)
3. For each, copy its connection string from the Neon dashboard. It'll look like:
   ```
   postgresql://neondb_owner:AbCdEf123456@ep-something-12345.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
   **Don't use it in that exact form yet** — see the callout in step 5, it needs reformatting for
   this app's database driver (Npgsql).

## 4. Generate your own RS256 key pair

AuthService signs login tokens with a private key; ModuleRegistry checks them with the matching
public key. Generate your own pair — nobody else's key material is needed or should be reused:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl rsa -pubout -in private.pem -out public.pem
```

Both `.env` files need each PEM's contents as a **single line**, with real newlines replaced by the
two literal characters `\n`. For example, a private key file like:
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7...
...
-----END PRIVATE KEY-----
```
becomes one `.env` line:
```
Jwt__SigningKeyPrivate=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7...\n...\n-----END PRIVATE KEY-----\n
```
Do the same for `public.pem`. Once both keys are copied into your `.env` files (step 6), delete
`private.pem` and `public.pem` from wherever you generated them — don't leave loose copies lying
around, and never commit them.

## 5. ⚠️ Connection string format — the one gotcha

Neon gives you a `postgresql://user:pass@host/db?sslmode=require&channel_binding=require` URL. The
database driver this project uses (Npgsql) **rejects that format outright** and will crash on
startup with `ArgumentException: Couldn't set postgresql://...`. Convert it to Npgsql's own format
first:

**Neon gives you:**
```
postgresql://neondb_owner:AbCdEf123456@ep-something-12345.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**Use this instead** (same host/database/username/password, different syntax):
```
Host=ep-something-12345.us-east-2.aws.neon.tech;Port=5432;Database=neondb;Username=neondb_owner;Password=AbCdEf123456;SSL Mode=Require;Trust Server Certificate=true
```

Do this conversion for **both** of your Neon connection strings before pasting them into the `.env`
files below. (The `channel_binding` parameter has no Npgsql equivalent and is safely dropped — TLS,
via `SSL Mode=Require`, is still fully enforced.)

## 6. Configure your `.env` files

Copy each `.env.example` to `.env` in the same folder, then fill in the blanks:

### `Backend/AuthService/.env`
```bash
cd Backend/AuthService
cp .env.example .env
```
Fill in:
- `ConnectionStrings__AuthDb` — your reformatted AuthService connection string (step 5)
- `Jwt__SigningKeyPrivate` — your private key, single-line `\n`-escaped (step 4)
- `Jwt__SigningKeyPublic` — your public key, single-line `\n`-escaped (step 4)
- `Internal__ApiKey` — any long random string you make up, e.g. `openssl rand -base64 32`. **Must
  match** `AuthService__InternalApiKey` in ModuleRegistry's `.env` below — copy the same value into
  both.

Everything else in this file already has a working default (`Cors__AllowedOrigins__0` is already set
to `http://localhost:5173`, which is correct as long as you run the frontend on its default port).

### `Backend/ModuleRegistry/.env`
```bash
cd ../ModuleRegistry
cp .env.example .env
```
Fill in:
- `ConnectionStrings__RegistryDb` — your reformatted ModuleRegistry connection string (step 5)
- `Jwt__SigningKeyPublic` — **the exact same public key** you put in AuthService's `.env` above
  (copy-paste it, don't regenerate)
- `AuthService__InternalApiKey` — **the exact same value** as `Internal__ApiKey` in AuthService's
  `.env` above

### `Frontend/apps/host/.env`
```bash
cd ../../Frontend/apps/host
cp .env.example .env
```
No changes needed — the defaults (`VITE_AUTH_SERVICE_URL=http://localhost:5155`,
`VITE_MODULE_REGISTRY_URL=http://localhost:5200`) already point at the other two services' default
ports.

## 7. Run all three services

Each in its own terminal, from the repo root:

```bash
dotnet run --project Backend/AuthService
```
```bash
dotnet run --project Backend/ModuleRegistry
```
```bash
cd Frontend
pnpm --filter host dev
```

Each backend **automatically applies its database migrations on first startup** — you don't need to
run any `dotnet ef` commands yourself. Watch the AuthService terminal for a one-time line like:

```
warn: AuthService[0]
      Seeded bootstrap Super Admin account. Email: superadmin@omniremit.local | Temporary password: ...
```

That only appears **once**, the very first time AuthService starts against your empty database — copy
that password down immediately, since it's never logged again. (There's currently no self-service
"change password" screen in the app, so treat that value as your login for now.)

## 8. Verify it's working

Open **http://localhost:5173**, sign in with the email/password from the log line above. You should
land on the dashboard showing real counts (1 user, 6 roles, 0 registered apps) — that confirms the
frontend, both backends, and your Neon databases are all talking to each other correctly.

## Troubleshooting

- **A backend crashes immediately on startup** ("address already in use") — something else is already
  running on that port. Stop it, or check nothing else on your machine uses 5155/5200/5173.
- **Frontend terminal says it can't bind to 5173** — same thing, one instance at a time; the dev
  server is configured to fail loudly here instead of silently switching ports (a silent port switch
  would break login with a confusing CORS error instead).
- **Login fails with a CORS error in the browser console** — your `Cors__AllowedOrigins__0` in both
  backend `.env` files must exactly match the URL the frontend is actually running at
  (`http://localhost:5173` by default — no trailing slash, exact scheme/host/port).
- **A backend crashes with an Npgsql/connection-string error** — you're probably still using Neon's
  raw `postgresql://...` URL; see step 5.
- Anything else: check the terminal output of whichever service is failing — both backends log
  clear error messages rather than crashing silently.
