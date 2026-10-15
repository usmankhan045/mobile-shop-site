# Ledgerline Mobile Shop Management

Next.js mobile shop inventory and ledger workspace backed by Neon Postgres.

## First run

The Neon project and schema are already created. Start the app with:

```bash
npm install
npm run dev
```

Open `http://localhost:3000/setup` and create the shop administrator account. After setup, the dashboard is protected by the session cookie and all inventory writes require authentication.

## Live configuration

`.env.local` is generated locally from the linked Neon branch and is ignored by Git. For another machine or deployment, configure:

```text
DATABASE_URL=your-Neon-pooled-or-serverless-connection-string
SESSION_SECRET=a-long-random-secret
NEXT_PUBLIC_SHOP_NAME=Ledgerline Mobiles
```

The database schema is versioned in `database/schema.sql`. Apply migrations in `database/migrations/` after the base schema.

## Production deployment

Deploy the Next.js app to a server-capable host such as Cloudflare Workers/Vinext or Vercel. Add `DATABASE_URL`, `SESSION_SECRET`, and `NEXT_PUBLIC_SHOP_NAME` as encrypted runtime environment variables. Do not commit `.env.local`.

## Available live endpoints

- `GET /api/health`
- `POST /api/auth/setup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/phones?q=...`
- `POST /api/phones`
- `GET /api/phones/:id`
- `PATCH /api/phones/:id` with `{ "action": "sell", "salePrice": number }`
- `GET /api/ledger?from=YYYY-MM-DD&to=YYYY-MM-DD`
