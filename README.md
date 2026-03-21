# Advanced Personal Finance & Budget Management System

Monorepo with:
- `backend/`: Django + DRF + JWT + Swagger
- `frontend/`: React + Tailwind + Recharts

Deployment steps for Vercel + Netlify are documented in:
- `docs/deploy-vercel-netlify.md`

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

### Prerequisites
- Python 3.14+
- Node.js 24+
- Git

### Installation and Setup

1. **Clone the repository** (if not already done)
   ```bash
   git clone <repository-url>
   cd expense-tracker
   ```

2. **Backend Setup**
   ```bash
   cd backend
   # Install dependencies (using system Python)
   c:\python314\python.exe -m pip install -r requirements.txt
   # Run migrations
   c:\python314\python.exe manage.py migrate
   # Create superuser (optional)
   c:\python314\python.exe manage.py createsuperuser
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application

#### Option 1: Using the start script (Windows)
Double-click `start.bat` in the root directory, or run:
```bash
start.bat
```

#### Option 2: Manual start
1. **Start Backend** (in one terminal)
   ```bash
   cd backend
   c:\python314\python.exe manage.py runserver 0.0.0.0:8000
   ```

2. **Start Frontend** (in another terminal)
   ```bash
   cd frontend
   npm run dev -- --host 0.0.0.0
   ```

### Accessing the Application

- **Local PC**: 
  - Frontend: http://localhost:5173
  - Backend API: http://localhost:8000

- **Mobile/Phone**: Use your PC's IP address
  - Find your PC's IP: Open command prompt and run `ipconfig`
  - Frontend: http://[YOUR_IP]:5173
  - Backend API: http://[YOUR_IP]:8000

The app is now PWA-enabled, so you can install it on your mobile device by visiting the URL in your mobile browser and selecting "Add to Home Screen".

### API Documentation
- Swagger UI: http://localhost:8000/api/docs/
- ReDoc: http://localhost:8000/api/redoc/

### Development
- Backend tests: `cd backend && c:\python314\python.exe manage.py test`
- Frontend build: `cd frontend && npm run build`

## Production Deployment

### Option 1: Railway (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   # Create repo on GitHub and push
   ```

2. **Deploy on Railway**
   - Go to [Railway.app](https://railway.app)
   - Connect your GitHub repo
   - Railway will auto-detect Django and deploy
   - Set environment variables in Railway dashboard:
     ```
     DEBUG=False
     DJANGO_SECRET_KEY=your-secret-key-here
     ALLOWED_HOSTS=your-app-name.up.railway.app
     ```

3. **Access your app**
   - Your app will be available at `https://your-app-name.up.railway.app`

### Option 2: Heroku

1. **Install Heroku CLI**
2. **Create Heroku app**
   ```bash
   heroku create your-app-name
   ```

3. **Set environment variables**
   ```bash
   heroku config:set DEBUG=False
   heroku config:set DJANGO_SECRET_KEY=your-secret-key
   heroku config:set ALLOWED_HOSTS=your-app-name.herokuapp.com
   ```

4. **Deploy**
   ```bash
   git push heroku main
   ```

### Environment Variables

For production, set these environment variables:

- `DEBUG=False`
- `DJANGO_SECRET_KEY` - A long random string
- `ALLOWED_HOSTS` - Comma-separated list of allowed domains
- `DB_ENGINE` - For PostgreSQL: `django.db.backends.postgresql`
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` - Database credentials

### Local Production Test

To test production locally:
```bash
cd backend
DEBUG=False c:/python314/python.exe manage.py runserver
```

The frontend is now served from the Django backend, so the entire app runs on a single port.
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
