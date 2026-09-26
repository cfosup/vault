# Vault — Complete Cloud Deployment & Setup Guide

This guide covers deploying **Vault** to production with **Vercel** for the frontend, **Render (Free Tier)** for the backend, **MongoDB Atlas** for persistence, and configuring the **Keep-Alive Trigger** so Render never goes to sleep.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │             Vercel (Frontend)          │
                      │  React + Vite SPA + OKLCH Theme        │
                      │  https://vault-app.vercel.app          │
                      └──────────────────┬─────────────────────┘
                                         │
                         HTTPS GraphQL   │   REST / Health
                                         ▼
                      ┌────────────────────────────────────────┐
                      │       Render (Backend Free Tier)       │
                      │  Express + Apollo Server + Nodemailer  │
                      │  https://vault-api.onrender.com        │
                      └──────────────┬──────────────────┬──────┘
                                     │                  │
                                     ▼                  ▼
               ┌───────────────────────────┐      ┌─────────────────────────┐
               │    MongoDB Atlas Cluster  │      │ GitHub Actions / Cron   │
               │    (Multi-Tenant Data)    │      │ (Keep-Alive Trigger)    │
               └───────────────────────────┘      └─────────────────────────┘
```

---

## Step 1: MongoDB Atlas Preparation

1. Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create or select a cluster (Free M0 Sandbox).
3. **Whitelist IP Addresses (Crucial for Cloud Deployment)**:
   - Navigate to **Security** -> **Network Access**.
   - Click **Add IP Address**.
   - Select **Allow Access from Anywhere** (`0.0.0.0/0`).
   - *Why:* Render free-tier instances have dynamic outbound IP addresses that change on deploy. Whitelisting `0.0.0.0/0` ensures Render connects without connection timeout errors.
4. **Create Database User**:
   - Go to **Security** -> **Database Access**.
   - Add a new user with read/write privileges (e.g. `vault_user`).
5. **Get Connection String**:
   - Click **Database** -> **Connect** -> **Drivers** -> Node.js.
   - Copy the URI, replacing `<password>` and setting database name to `/vault`:
     ```
     mongodb+srv://vault_user:<password>@cluster0.xxxxx.mongodb.net/vault?retryWrites=true&w=majority
     ```

---

## Step 2: Deploy Backend to Render (Free Tier)

1. Push your code to GitHub.
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repository.
5. Configure the web service settings:
   - **Name**: `vault-api` (or your choice)
   - **Region**: Choose the closest region (e.g. Singapore, Oregon, Frankfurt)
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/index.js`
   - **Instance Type**: `Free`
6. Scroll down to **Environment Variables** and add:

| Key | Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production optimizations |
| `PORT` | `10000` | Render assigns ports automatically (or defaults to 4000) |
| `MONGODB_URI` | `mongodb+srv://...` | Your MongoDB Atlas connection URI |
| `JWT_SECRET` | `generate-a-strong-secret-key-32-chars` | Secure key for authentication |
| `JWT_EXPIRY` | `7d` | Token validity |
| `CLIENT_URL` | `https://your-vault-app.vercel.app` | Your Vercel frontend URL |
| `GROQ_API_KEY` | `gsk_...` | Groq API Key for Vault AI assistant |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Groq AI LLM model |
| `KEEP_ALIVE` | `true` | Enables built-in self-pinging |
| `RENDER_EXTERNAL_URL` | `https://vault-api.onrender.com` | Your Render public service URL |

7. Click **Create Web Service**. Wait for the build and deployment to finish.
8. Verify by visiting `https://your-api.onrender.com/health` in your browser. It should return:
   ```json
   { "status": "ok", "service": "Vault API", "db": "connected" }
   ```

---

## Step 3: Configure Render Keep-Alive Trigger (No Cold Starts)

Render free tier puts instances to sleep after **15 minutes** of inactivity, which causes a 30–50 second cold-start delay on the next visit. Vault provides **two automated triggers** to keep it warm 24/7:

### Option A: Built-in Server Keep-Alive (Zero Setup)
In your Render Environment Variables:
- Set `KEEP_ALIVE=true`
- Set `RENDER_EXTERNAL_URL=https://your-api.onrender.com`
The server process will automatically ping its own `/health` endpoint every 10 minutes.

### Option B: GitHub Actions Automated Pinger (Recommended & 100% Free)
The repository includes an automated workflow at [render-keep-alive.yml](file:///.github/workflows/render-keep-alive.yml):
1. In your GitHub repository, go to **Settings** -> **Secrets and variables** -> **Actions**.
2. Click **New repository secret**.
3. Name: `RENDER_BACKEND_URL`
4. Value: `https://your-api.onrender.com` (your Render backend URL).
5. The GitHub Action will run automatically every **14 minutes**, pinging the `/health` endpoint so Render never goes to sleep!

### Option C: External Pinger (Alternative)
You can also use [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com):
- URL to ping: `https://your-api.onrender.com/health`
- Interval: Every 10 to 14 minutes.

---

## Step 4: Deploy Frontend to Vercel

1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository.
4. Configure the project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click "Edit" and choose `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Expand **Environment Variables** and add:

| Key | Value | Description |
|---|---|---|
| `VITE_GRAPHQL_URL` | `https://your-api.onrender.com/graphql` | Render backend GraphQL URL |
| `VITE_API_URL` | `https://your-api.onrender.com` | Render backend base URL (for exports & reset) |

6. Click **Deploy**.
7. Vercel will build and deploy the React application.
8. The included [`client/vercel.json`](file:///client/vercel.json) rewrites all client-side routes (e.g. `/expenses`, `/login`, `/companies`) to `/index.html` to eliminate 404s on browser refresh.

---

## Step 5: Post-Deployment Verification

1. **Sign Up & Instant Activation**:
   - Open your Vercel URL (e.g. `https://vault-app.vercel.app/login`).
   - Create a new account with your name, organization name, email, and password.
   - You are instantly authenticated and redirected directly into your Vault financial dashboard!
2. **Explore Financial Intelligence**:
   - Add companies/branches (e.g. Core Branch with auto-provisioned Chart of Accounts).
   - Record expenses and income ledgers with dynamic category tagging.
   - Test proactive budget cap monitoring and AI financial chatbot queries.
3. **Theme & Aesthetics**:
   - Notice the sleek Pitch Black / Clean White monochrome OKLCH theme with Geist typography.
   - Click the theme toggle icon in the header to switch between Light and OLED Dark modes.
4. **Resetting Database anytime**:
   - Via CLI: `npm run clear-db` in the `server` directory.
   - Via UI: Go to **Settings** -> scroll down to **Danger Zone** -> click **Reset Complete Database**.
   - Via REST: `curl -X POST https://your-api.onrender.com/api/admin/reset-database`.
