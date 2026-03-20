# WMS Portal — Deployment Guide

## Stack
- **Frontend + API**: Next.js 14 → Vercel
- **Database + Auth + Storage**: Supabase
- **Email**: Resend

---

## Step 1 — Supabase setup (15 min)

1. Go to https://supabase.com and create a free account
2. Click **New project** → choose a name (e.g. `wms-portal`) and a strong DB password → **Create project**
3. Wait ~2 minutes for provisioning

### Run the database migration
4. In your Supabase project go to **SQL Editor**
5. Click **New query**
6. Open `supabase/migrations/001_initial_schema.sql` from this repo, paste the entire contents, click **Run**
7. You should see: *Success. No rows returned*

### Create storage buckets
8. Go to **Storage** → **New bucket**
   - Name: `documents` — toggle **Private** → Create
   - Name: `generated-docs` — toggle **Private** → Create

### Get your API keys
9. Go to **Settings → API**
10. Copy:
    - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
    - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` *(keep this secret)*

### Create first staff account
11. Go to **Authentication → Users → Add user**
12. Enter your email + password
13. In **SQL Editor** run:
```sql
insert into profiles (id, customer_id, role, full_name, email)
values (
  '<paste-user-id-from-auth-users-table>',
  null,
  'warehouse_staff',
  'Your Name',
  'your@email.com'
);
```

---

## Step 2 — Resend setup (5 min)

1. Go to https://resend.com → sign up free
2. Go to **API Keys → Create API key** → copy it → `RESEND_API_KEY`
3. Go to **Domains → Add domain** → follow DNS instructions for your domain
   - *(For testing, Resend allows sending from `onboarding@resend.dev` on the free plan)*

---

## Step 3 — Deploy to Vercel (10 min)

### Push code to GitHub first
```bash
cd wms
git init
git add .
git commit -m "Initial WMS Portal"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/wms-portal.git
git push -u origin main
```

### Deploy on Vercel
1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repo
3. Framework preset will auto-detect **Next.js**
4. Click **Environment Variables** and add all of these:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | From Supabase Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase Settings → API |
| `RESEND_API_KEY` | From Resend dashboard |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` (update after first deploy) |
| `NEXT_PUBLIC_APP_NAME` | `WMS Portal` |
| `TRIAL_DAYS` | `14` |

5. Click **Deploy** → wait ~2 minutes

### After first deploy
6. Copy your Vercel URL (e.g. `https://wms-portal-xyz.vercel.app`)
7. Go back to Vercel → **Settings → Environment Variables**
8. Update `NEXT_PUBLIC_APP_URL` to your actual Vercel URL → **Redeploy**

---

## Step 4 — Local development

```bash
# Clone / enter the project
cd wms

# Copy env file
cp .env.example .env.local
# Fill in your keys from steps 1 and 2 above

# Install dependencies
npm install

# Run dev server
npm run dev
# → Open http://localhost:3000
```

---

## Custom domain (optional, 5 min)

1. In Vercel → **Settings → Domains** → add your domain
2. Follow the DNS instructions (add a CNAME or A record at your registrar)
3. Update `NEXT_PUBLIC_APP_URL` to `https://yourdomain.com`
4. Redeploy

---

## Ongoing deployments

Every `git push` to `main` triggers an automatic redeploy on Vercel. No action needed.

```bash
git add .
git commit -m "your change"
git push
# Vercel auto-deploys in ~1 min
```

---

## Costs at launch

| Service | Free tier | Paid (when you scale) |
|---|---|---|
| Vercel | Unlimited deploys, 100GB bandwidth | $20/mo Pro |
| Supabase | 500MB DB, 1GB storage, 50MB file uploads | $25/mo Pro |
| Resend | 3,000 emails/month | $20/mo for 50k |
| **Total** | **$0** | **~$45–65/mo** |

---

## Troubleshooting

**"relation does not exist" errors** → Migration hasn't been run yet. Re-run `001_initial_schema.sql` in Supabase SQL Editor.

**Auth redirects loop** → Check `NEXT_PUBLIC_APP_URL` matches your actual deployed URL exactly (no trailing slash).

**Emails not sending** → Verify `RESEND_API_KEY` is set in Vercel env vars and you've verified your sending domain in Resend.

**Storage upload errors** → Make sure both `documents` and `generated-docs` buckets exist in Supabase Storage and are set to **Private**.
