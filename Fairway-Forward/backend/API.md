# Fairway Forward API

All protected endpoints expect `Authorization: Bearer <JWT>`.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Register a member and create an active subscription record |
| POST | `/api/auth/login` | Return a JWT and public profile |
| POST | `/api/billing/checkout` | Create a Stripe Checkout subscription session |
| POST | `/api/billing/webhook` | Verify Stripe events and synchronize subscription status |
| GET | `/api/dashboard` | Member profile, subscription, five scores, draw and winnings overview |
| GET / POST | `/api/scores` | Read or add a Stableford score |
| DELETE | `/api/scores/:id` | Remove one of the member's scores |
| GET | `/api/charities` | List active charity partners |
| PATCH | `/api/me/charity` | Change selected charity and contribution percentage |
| GET | `/api/draws` | Read current and previous draws |
| GET | `/api/draws/:id/entry` | Read the member's five-number draw entry |
| POST | `/api/winners/:id/proof` | Upload a winner-proof image |
| POST | `/api/admin/draws/:id/publish` | Publish a draw and calculate winners (admin) |
| GET | `/api/admin/winners` | Read all winners (admin) |
| PATCH | `/api/admin/winners/:id` | Verify proof or mark payout paid (admin) |

The backend is intentionally the authority for score limits, duplicate dates, subscription access and role access. Do not implement these rules only in React.
