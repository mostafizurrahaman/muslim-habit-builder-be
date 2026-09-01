# Muslim Habit Builder — Backend

REST API for the Muslim Habit Builder app: authentication, user habits (prayer, Quran, dhikr, deeds), daily progress, and an admin dashboard for templates, content, users, and bugs.

Base URL (local): `http://localhost:{PORT}/api/v1`  
Default port: `5000` (from `PORT` in `.env`).

## Documentation

Start here if you are new to this codebase:

| Guide | What it covers |
|-------|----------------|
| [docs/README.md](docs/README.md) | Docs index and suggested reading order |
| [docs/architecture.md](docs/architecture.md) | Boot path, folders, middleware, auth, how to add a module |
| [docs/models.md](docs/models.md) | All 14 Mongoose models and how they relate |
| [docs/flows.md](docs/flows.md) | Register, login, habit lifecycle, progress, admin journeys |
| [docs/api-reference.md](docs/api-reference.md) | Every mounted endpoint: method, auth, body/params, models |

## Tech stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js, TypeScript |
| Framework | Express 5 |
| Database | MongoDB via Mongoose 9 |
| Validation | Zod 4 |
| Auth | JWT (access + refresh), bcrypt, Google OAuth |
| Email | Nodemailer (Gmail SMTP) |
| Uploads | Multer + Sharp + Cloudinary |

## Local setup

1. Clone the repo and install dependencies:

```bash
npm install
```

2. Copy [`.env.example`](.env.example) to `.env` and fill in real values (MongoDB URL, JWT secrets, Gmail, Cloudinary, Google client IDs, admin seed credentials).

3. Start MongoDB locally or point `MONGODB_URL` at a remote cluster.

4. Run the API:

```bash
npm run dev
```

The server connects to MongoDB, then listens. On first start it upserts a super-admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

Health checks: `GET /health_check`, `GET /root`.

## Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| Dev | `npm run dev` | `ts-node-dev` with reload (`src/server.ts`) |
| Build | `npm run build` | Compile TypeScript to `dist/` |
| Start | `npm start` | Run compiled `dist/server.js` |
| Seed | `npm run seed` | Insert sample data (`src/scripts/seed.ts`) |
| Seed fresh | `npm run seed:fresh` | Clear seed collections, then reseed |
| Lint | `npm run lint` | ESLint on `src/**/*.ts` |
| Format | `npm run format` | Prettier |

## Auth in one line

Protected routes expect `Authorization: Bearer <accessToken>`. Roles: `user`, `guest`, `admin`, `super-admin`. See [docs/architecture.md](docs/architecture.md) and [docs/flows.md](docs/flows.md).

## Not currently wired

These exist in the repo but are **not live**. Do not treat them as working APIs:

- **Subscription** module (`src/app/modules/subscription/`) — routes are not mounted in `version1.ts`
- **Stripe webhook** — commented out in `src/app.ts`
- **Firebase Admin** — config is commented out (`fcmToken` is accepted on some auth payloads but push is not sent)
- **Socket.IO** — dependency only; no server setup in `server.ts`
