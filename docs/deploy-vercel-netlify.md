# Deploy Guide (Vercel + Netlify)

This project is easiest to deploy as:
- Backend (`backend/`, Django API): **Vercel**
- Frontend (`frontend/`, Vite React SPA): **Netlify**

## 1) Deploy Backend to Vercel

1. Push your repo to GitHub.
2. In Vercel, create a new project from this repo.
3. Set **Root Directory** to `backend`.
4. Keep the project settings default; `backend/vercel.json` routes all traffic to Django WSGI.
5. Add environment variables in Vercel:

```env
DEBUG=False
DJANGO_SECRET_KEY=<strong-random-secret>
ALLOWED_HOSTS=.vercel.app

DB_ENGINE=django.db.backends.postgresql
DB_NAME=<postgres-db-name>
DB_USER=<postgres-user>
DB_PASSWORD=<postgres-password>
DB_HOST=<postgres-host>
DB_PORT=5432
```

Optional but recommended:

```env
FRONTEND_BASE_URL=https://<your-netlify-site>.netlify.app
```

6. Deploy. Copy your backend URL:

```txt
https://<your-backend>.vercel.app
```

Important:
- Do not use SQLite on Vercel for production data (serverless filesystem is not persistent).
- OCR endpoints that depend on local Tesseract binaries may not work on Vercel unless you redesign that part.

## 2) Deploy Frontend to Netlify

1. In Netlify, create a site from the same GitHub repo.
2. Netlify will use `netlify.toml` automatically.
3. Add this environment variable:

```env
VITE_API_BASE_URL=https://<your-backend>.vercel.app/api
```

4. Deploy. Your frontend URL will look like:

```txt
https://<your-site>.netlify.app
```

Notes:
- `netlify.toml` already includes SPA redirect rules (`/* -> /index.html`).
- If backend URL changes, update `VITE_API_BASE_URL` and redeploy frontend.

## 3) Final Wiring Check

1. Update backend `FRONTEND_BASE_URL` in Vercel to your final Netlify URL.
2. Redeploy backend once.
3. Test:
   - Open Netlify app.
   - Register/login.
   - Verify API calls succeed in browser network tab.
   - Verify `https://<your-backend>.vercel.app/api/health/` responds.
