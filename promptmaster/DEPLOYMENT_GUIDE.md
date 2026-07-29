# Deployment & Production Sync Guide — Grace Ledger v2

This document records the official production deployment configuration, URLs, and deployment workflows for Grace Ledger v2.

---

## 🚀 Live Production Information

- **GitHub Repository:** [https://github.com/Suriyong1993/grace-ledger.git](https://github.com/Suriyong1993/grace-ledger.git)
- **Primary Vercel Production URL:** [https://grace-ledger-pearl.vercel.app](https://grace-ledger-pearl.vercel.app)
- **Secondary Deployment URL:** [https://grace-ledger-apahjy16n-tlcs-projects-ab505ecc.vercel.app](https://grace-ledger-apahjy16n-tlcs-projects-ab505ecc.vercel.app)
- **Vercel Project Dashboard:** [https://vercel.com/tlcs-projects-ab505ecc/grace-ledger](https://vercel.com/tlcs-projects-ab505ecc/grace-ledger)

---

## 🛠️ Production Environment Variables Checklist

Ensure these variables are configured in Vercel or Portainer:

| Variable Name | Client / Server | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Client | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Client | Supabase Anonymous Public Key |
| `FIREWORKS_API_KEY` | **Server-Only** | Fireworks AI API Key (`kimi-k3` model for OCR parsing) |
| `GEMINI_API_KEY` | **Server-Only** | Google Gemini API Key (`gemini-2.0-flash`) |
| `JWT_SECRET` | **Server-Only** | Secret key for signing user auth tokens |
| `APP_URL` | Both | Application domain URL (e.g. `https://grace-ledger-pearl.vercel.app`) |

> ⚠️ **CRITICAL SECURITY REQUIREMENT:** `FIREWORKS_API_KEY`, `GEMINI_API_KEY`, and `JWT_SECRET` must **NEVER** be prefixed with `VITE_` and must **NEVER** be exposed in client code.

---

## 📦 Deployment Workflows

### Option 1: Automatic Vercel Deployment via Git Push (Recommended)
Every commit pushed to `main` branch automatically triggers Vercel production build:
```bash
git add .
git commit -m "feat: your new feature"
git push origin main
```

### Option 2: Direct Vercel CLI Deployment
```bash
npx vercel --prod --yes
```

### Option 3: Docker Deployment (Dedicated VPS)
```bash
# 1. Configure production environment
cp .env.example .env

# 2. Build and run containers
docker compose up -d --build
```
