# Fairway Forward

A responsive prototype for the Digital Heroes Level 1 assignment. It deliberately leads with charitable impact rather than conventional golf imagery, while implementing the essential user-facing flows in browser state.

## Run locally

Run the connected app from `backend/`:

```powershell
cd backend
npm install
npm run seed
npm run dev
```

Then open `http://localhost:5000`. The API serves the files from `frontend/` and the browser uses the API for authentication, dashboard data, scores, and contribution updates. For a separately hosted frontend, set the deployed backend URL in `frontend/config.js`.

## Stripe payments

Signup uses Stripe Checkout when the Stripe values in `backend/.env` are configured. Create monthly and yearly recurring Prices in Stripe test mode, then add their IDs plus a secret key and webhook secret. Forward local events with `stripe listen --forward-to localhost:5000/api/billing/webhook`. New subscriptions remain pending until Stripe confirms `checkout.session.completed`; only active webhook-confirmed subscriptions can enter draws or add scores.

Demo sign-in:

- Email: `member@fairwayforward.com`
- Password: `playforward`

## Included flows

- Landing page and membership auth flow
- Member dashboard, subscription status, draw entry, charity allocation and responsive layout
- Stableford score validation (1-45), one score per date, latest-five retention, reverse chronological listing and deletion
- Contribution selector enforcing a 10% floor
- Random draw simulation and prize tier explanation

## MERN backend

The project now includes a production-shaped Express/MongoDB API in [`backend/`](./backend). It contains JWT login/register, subscription guards, user/admin roles, the server-enforced five-score rolling rule, charities, draw publishing, prize-splitting, winner proof upload, and payout status endpoints.

1. Create a free MongoDB Atlas cluster and database user.
2. Copy `backend/.env.example` to `backend/.env`, then set its MongoDB URI and a long JWT secret.
3. From `backend/`, run `npm install`, then `npm run seed` and `npm run dev`.

The initial seed creates an admin account: `admin@fairwayforward.com` / `ChangeMe123!` (change this immediately on a real deployment) and the demo member account above. The client and server can also be deployed independently: deploy `frontend/` to Vercel or another static host, set `window.FF_API_BASE` in `frontend/config.js` to the deployed backend URL, and deploy `backend/` to Render/Railway with MongoDB Atlas.
