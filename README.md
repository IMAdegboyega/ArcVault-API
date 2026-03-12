# ArcVault — Backend API

A custom Node.js banking platform API with Plaid bank linking and a provider-agnostic payment service layer.

## Tech Stack

- **Runtime:** Node.js + Express
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** JWT (access + refresh token rotation) with bcrypt
- **Banking:** Plaid (account linking, transactions, balance sync)
- **Payments:** Simulated payment service (swappable — designed for Stripe, Paystack, etc.)
- **Validation:** Zod
- **Security:** Helmet, CORS, rate limiting, httpOnly cookies

## Architecture Highlights

### Payment Service Layer
The transfer system uses a **provider-agnostic payment service** (`src/services/payment.service.js`). The `SimulatedPaymentProvider` handles all payment logic in development. To integrate a real provider, implement the same interface:

```javascript
// Swap in any provider by implementing these methods:
// - createCustomer(userData)       → { customerId, status }
// - processTransfer(transferData)  → { transferId, status, processedAt }
// - getTransferStatus(transferId)  → { transferId, status, updatedAt }
// - refundTransfer(transferId)     → { refundId, status }

const PaystackProvider = require('./providers/paystack.provider');
const paymentService = new PaystackProvider(process.env.PAYSTACK_SECRET_KEY);
```

### Auth Flow
1. Register/login → receive `accessToken` (15min) + `refreshToken` (7d)
2. Tokens set as httpOnly cookies AND returned in response body
3. Frontend sends `Authorization: Bearer <token>` header
4. On expiry, call `/api/auth/refresh` — refresh tokens rotate on each use
5. Logout invalidates refresh token server-side

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (local or cloud)
- Plaid sandbox account: https://dashboard.plaid.com

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Fill in DATABASE_URL and Plaid credentials

# Setup database
npm run db:generate
npm run db:migrate

# Seed test data (optional)
npm run db:seed

# Start dev server
npm run dev
```

API runs at `http://localhost:5000`

## API Endpoints

### Auth
| Method | Endpoint             | Description          | Auth |
|--------|----------------------|----------------------|------|
| POST   | `/api/auth/register` | Create account       | No   |
| POST   | `/api/auth/login`    | Login                | No   |
| POST   | `/api/auth/refresh`  | Refresh access token | No   |
| POST   | `/api/auth/logout`   | Logout               | Yes  |

### User
| Method | Endpoint            | Description     | Auth |
|--------|---------------------|-----------------|------|
| GET    | `/api/user/profile` | Get profile     | Yes  |
| PUT    | `/api/user/profile` | Update profile  | Yes  |

### Plaid (Bank Linking)
| Method | Endpoint                          | Description             | Auth |
|--------|-----------------------------------|-------------------------|------|
| POST   | `/api/plaid/create-link-token`    | Get Plaid Link token    | Yes  |
| POST   | `/api/plaid/exchange-public-token`| Link bank account       | Yes  |

### Banks
| Method | Endpoint              | Description            | Auth |
|--------|-----------------------|------------------------|------|
| GET    | `/api/banks`          | List linked banks      | Yes  |
| GET    | `/api/banks/:id`      | Get bank details       | Yes  |
| DELETE | `/api/banks/:id`      | Remove linked bank     | Yes  |
| POST   | `/api/banks/:id/sync` | Sync balances/txns     | Yes  |

### Accounts
| Method | Endpoint                          | Description             | Auth |
|--------|-----------------------------------|-------------------------|------|
| GET    | `/api/accounts`                   | List all accounts       | Yes  |
| GET    | `/api/accounts/:id`               | Get account details     | Yes  |
| GET    | `/api/accounts/:id/transactions`  | Get transactions (paginated) | Yes  |

### Transfers
| Method | Endpoint             | Description          | Auth |
|--------|----------------------|----------------------|------|
| POST   | `/api/transfers`     | Create transfer      | Yes  |
| GET    | `/api/transfers`     | List transfers       | Yes  |
| GET    | `/api/transfers/:id` | Get transfer details | Yes  |

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma          # Database models
│   └── seed.js                # Test data seeder
├── src/
│   ├── config/
│   │   ├── database.js        # Prisma client singleton
│   │   └── plaid.js           # Plaid client config
│   ├── controllers/           # Route handlers
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── plaid.controller.js
│   │   ├── bank.controller.js
│   │   ├── account.controller.js
│   │   └── transfer.controller.js
│   ├── middleware/
│   │   ├── auth.js            # JWT authentication
│   │   ├── errorHandler.js    # Global error handling
│   │   ├── rateLimit.js       # Rate limiting
│   │   └── validate.js        # Zod validation
│   ├── routes/                # Express route definitions
│   ├── services/
│   │   └── payment.service.js # Provider-agnostic payment layer
│   ├── utils/
│   │   ├── errors.js          # Custom error classes
│   │   ├── helpers.js         # JWT, encryption, formatting
│   │   └── validators.js      # Zod schemas
│   └── server.js              # Express app entry point
├── .env.example
├── package.json
└── README.md
```

## Test Credentials (after seeding)

```
Email:    tommy@arcvault.dev
Password: Password123
```

## Built By

Tommy — Software Developer | Cybersecurity Professional
# ArcVault-API
