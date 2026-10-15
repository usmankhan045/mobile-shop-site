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
RESEND_API_KEY=re_...                         # server-only email delivery key
EMAIL_FROM=Ledgerline <no-reply@yourdomain.com>
APP_URL=https://yourdomain.com
```

Recovery email delivery uses Resend's HTTPS API. The sender domain must be verified with the email provider before production use. Keep `RESEND_API_KEY` server-only; never prefix it with `NEXT_PUBLIC_` and never commit `.env.local`.

## First-time account and recovery flow

1. Open `/setup` and enter the admin name, username, password, and an email address the shop owner controls.
2. Ledgerline creates the account and sends a verification link to that email. The link is single-use and expires after 30 minutes.
3. The admin can sign in with the username and password. Email verification is specifically used to prove ownership for recovery; it is not exposed as the login username.
4. If access is lost, `/forgot-password` accepts the verified recovery email and sends a single-use reset link valid for 15 minutes.
5. An existing admin can change or add the recovery email from Settings. The current password is required and the new address must be verified again.

The forgot-password endpoint intentionally returns the same message for unknown, unverified, and known emails so it cannot be used to discover whether an account exists.

The database schema is versioned in `database/schema.sql`. Apply migrations in `database/migrations/` after the base schema.

## Production deployment

Deploy the Next.js app to a server-capable host such as Cloudflare Workers/Vinext or Vercel. Add `DATABASE_URL`, `SESSION_SECRET`, and `NEXT_PUBLIC_SHOP_NAME` as encrypted runtime environment variables. Do not commit `.env.local`.

## Available live endpoints

- `GET /api/health`
- `POST /api/auth/setup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/verify-email`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/recovery-email`
- `GET /api/phones?q=...`
- `POST /api/phones`
- `GET /api/phones/:id`
- `PATCH /api/phones/:id` with `{ "action": "sell", "salePrice": number }`
- `GET /api/ledger?from=YYYY-MM-DD&to=YYYY-MM-DD`
