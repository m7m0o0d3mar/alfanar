# 🏗️ Construction ERP System

> ✨ A complete ERP system for construction and real estate development companies.
> **No programming experience required.** Follow the steps in order.

## Quick Start (30 minutes)

| Step | What to do | Time |
|------|-----------|------|
| 1 | Create [Supabase](https://supabase.com) account | 5 min |
| 2 | Run SQL files in Supabase SQL Editor | 2 min |
| 3 | Create Cloudflare account | 5 min |
| 4 | Deploy frontend to Cloudflare Pages | 10 min |
| 5 | Create admin user | 5 min |
| 6 | Start using the system! | - |

---

## Step 1: Create Supabase Account

1. Go to **[https://supabase.com](https://supabase.com)**
2. Click **"Start your project"**
3. Sign up with **GitHub** (easiest) or email
4. Create Organization → any name (e.g. "My Company")
5. Click **"New project"** and fill:
   - **Name**: `erp-construction`
   - **Database Password**: Choose a strong password → **SAVE IT**
   - **Region**: Closest to you
   - Click **"Create new project"**
6. **Wait 2-3 minutes** for the project to spin up

---

## Step 2: Create Database Tables

### 2.1 Run the main schema
1. In Supabase Dashboard → Left menu → **"SQL Editor"**
2. Click **"New query"**
3. Open the file `database/999_full_migration.sql` with Notepad
4. **Copy all text** (Ctrl+A → Ctrl+C)
5. **Paste** into the SQL Editor (Ctrl+V)
6. Click **"Run"** ▶️
7. Wait for ✅ success message

### 2.2 Run the seed data
1. Open a **new query** (SQL Editor → New query)
2. Open `supabase/migrations/seed_data.sql`
3. Copy, paste, and **Run**
4. ✅ 13 modules + 40+ statuses + KPIs created

---

## Step 3: Install Node.js

1. Go to **[https://nodejs.org](https://nodejs.org)**
2. Download the **LTS** version (left button)
3. Run the installer (Next → Next → Install)
4. **Restart your computer**

---

## Step 4: Configure Environment

### 4.1 Get Supabase Keys
1. In Supabase Dashboard → Left menu → **"Project Settings"** ⚙️
2. Click **"API"** from the left sub-menu
3. Copy these two values:
   - **Project URL** (ends with `.supabase.co`)
   - **anon public key** (long string starting with `eyJ...`)

### 4.2 Create .env file
1. Go to the `erp-frontend` folder
2. Copy `.env.example` and rename to `.env`
3. Open `.env` in Notepad
4. Replace the values:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```
5. **Save** (Ctrl+S)

### 4.3 Run the App Locally
1. Open **PowerShell** (right-click Start → Windows PowerShell)
2. Type these commands (press Enter after each):

```powershell
cd D:\OpenCode\ERP\erp-frontend
npm install
npm run dev
```

3. **Click the link** `http://localhost:5173/` that appears
4. 🎉 **The app is running!** You'll see the login page.

---

## Step 5: Deploy to Cloudflare Pages (Go Online)

### 5.1 Build for production
```powershell
npm run build
```
(This creates a `dist` folder)

### 5.2 Create Cloudflare account
1. Go to **[https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)**
2. Sign up (free, no credit card needed)
3. Verify your email

### 5.3 Upload your app
1. Cloudflare Dashboard → Left menu → **"Pages"**
2. Click **"Create a project"** → **"Upload directly"**
3. **Project name**: `erp-construction`
4. **Drag & drop** the `dist` folder from your computer
5. Wait 30 seconds
6. **Your app is live!** at: `https://erp-construction.pages.dev`

---

## Step 6: Create Admin User

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Click **"Add user"**
3. Enter: `admin@yourcompany.com` / `Admin123!`
4. Click **"Create user"** → Copy the **User ID** (UUID)
5. Go to **SQL Editor** → New query → Run:

```sql
INSERT INTO user_profiles (id, email, full_name_en, full_name_ar, role)
VALUES ('USER-ID-FROM-ABOVE', 'admin@yourcompany.com', 'System Admin', 'مدير النظام', 'admin');
```

6. Now **login** to your app with:
   - Email: `admin@yourcompany.com`
   - Password: `Admin123!`
7. 🎉 **You're the admin!**

---

## Step 7: Start Using the System

### Add a project:
1. Go to **"Projects"** from the sidebar
2. Click **"Create"**
3. Fill in project details

### Add yourself to the project:
```sql
INSERT INTO user_projects (user_id, project_id, project_role)
VALUES ('YOUR-USER-ID', 'THE-PROJECT-ID', 'owner');
```

### Customize the system:
1. Go to **"Settings"** → **"System Designer"**
2. Manage: Modules, Statuses, Workflows, Custom Fields, KPIs

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **White screen** | Check `.env` file is correct, run `npm install` again |
| **Login fails** | User must exist in Auth.Users table, not just user_profiles |
| **404 on page reload** | Make sure `public/_redirects` file exists |
| **Sidebar empty** | Run `seed_data.sql` in Supabase |
| **Forgot DB password** | Project Settings → Database → Reset password |

---

## Project Structure

```
ERP/
├── database/                    # SQL schema files (run in order)
│   ├── 001-005_*.sql           # Core + Business + RLS
│   └── 999_full_migration.sql  # Complete schema (run this)
├── erp-frontend/                # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/         # Shared UI components
│   │   ├── context/            # Auth, Settings, Theme state
│   │   ├── hooks/              # Custom React hooks
│   │   ├── i18n/               # Arabic/English translation
│   │   ├── pages/              # All pages + System Designer
│   │   ├── services/           # Supabase API services
│   │   └── types/              # TypeScript types
│   └── public/
├── supabase/
│   ├── functions/              # Edge Functions (WIR, KPI, AI, Notifications)
│   └── config.toml
└── README_AR.md                # Arabic instructions
```

---

> **Need help?** Contact the developer for deployment assistance or customization.

**Built with:** React + Vite + Supabase + Tailwind CSS + Cloudflare Pages
