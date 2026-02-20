# Advanced Personal Finance & Budget Management System

Monorepo with:
- `backend/`: Django + DRF + JWT + Swagger
- `frontend/`: React + Tailwind + Recharts

## Newly Added Features

### 1. Recurring Transactions
- CRUD endpoint: `GET/POST /api/recurring-transactions/`
- Update/Delete: `PATCH/DELETE /api/recurring-transactions/{id}/`
- Run due schedules: `POST /api/recurring-transactions/run_due/`
- Management command:
  ```bash
  python manage.py process_recurring_transactions --as-of 2026-02-20
  ```

### 2. Accounts / Wallets
- CRUD endpoint: `GET/POST /api/wallets/`
- Update/Delete: `PATCH/DELETE /api/wallets/{id}/`
- Wallet-specific transaction summary: `GET /api/wallets/{id}/transactions/`
- Transactions now support optional `account` field.
- Wallet currency is currently restricted to `INR`.

### 3. Financial Goals
- CRUD endpoint: `GET/POST /api/goals/`
- Update/Delete: `PATCH/DELETE /api/goals/{id}/`
- Add contribution: `POST /api/goals/{id}/contribute/`

### 4. Security Upgrades
- Login lockout after repeated failed attempts (configurable).
- JWT refresh token rotation + blacklist.
- Secure logout with refresh token blacklist.
- Email verification endpoints:
  - `POST /api/auth/email-verify/request/`
  - `POST /api/auth/email-verify/confirm/`
- Password change endpoint:
  - `POST /api/auth/change-password/`
- DRF throttling for auth-sensitive endpoints.

### 5. Quality / Ops
- Health endpoint: `GET /api/health/`
- CI workflow added: `.github/workflows/ci.yml`
- Backend tests for recurring/wallets/goals/security.

## Quick Start

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## AI Features

### 1. Category Suggestion
- `POST /api/ai/categorize/`
- Payload:
```json
{
  "description": "Uber ride to office",
  "txn_type": "expense"
}
```

### 2. Feedback Loop
- `POST /api/ai/categorize/feedback/`
- Payload:
```json
{
  "description": "Uber ride to office",
  "predicted_category": 3,
  "corrected_category": 2,
  "confidence": 0.71,
  "was_accepted": false,
  "source": "manual"
}
```

### 3. Manual/Periodic Retraining
- `POST /api/ai/retrain/` (current user; staff can retrain all users)
- Scheduled retraining command:
```bash
python manage.py retrain_category_models --force
```

### 4. Receipt OCR Ingestion
- `POST /api/ai/receipt/ingest/` (`multipart/form-data`)
- Fields: `file`, `txn_type`, `create_transaction`

Install OCR dependencies and ensure local Tesseract is installed for image OCR.
