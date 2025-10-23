# 🚀 Setup Guide - CodeCanvas AI

## Quick Start for New Developers

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/abrar-0020/code-canva-ai.git
cd code-canva-ai
```

### 2️⃣ Install Dependencies
```bash
npm install
```

### 3️⃣ Setup Environment Variables

**IMPORTANT:** You need to create your own Supabase project and add the API keys.

#### Step-by-step:

1. **Copy the example file:**
   ```bash
   cp .env.local.example .env.local
   ```

2. **Create a Supabase account:**
   - Go to https://supabase.com
   - Sign up (free tier available)
   - Create a new project

3. **Get your API keys:**
   - Go to your Supabase dashboard
   - Click on your project
   - Navigate to **Settings** → **API**
   - Copy the following:
     - Project URL
     - `anon` `public` key
     - `service_role` `secret` key

4. **Add keys to `.env.local`:**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxxxx...
   SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxx...
   ```

### 4️⃣ Setup Database Tables

1. **Go to Supabase SQL Editor:**
   - Navigate to **SQL Editor** in your Supabase dashboard
   - Click **New Query**

2. **Create users table:**
   ```sql
   CREATE TABLE public.users (
     id UUID NOT NULL DEFAULT gen_random_uuid(),
     email VARCHAR(255) NOT NULL UNIQUE,
     password_hash VARCHAR(255) NOT NULL,
     username VARCHAR(100) NOT NULL UNIQUE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     is_active BOOLEAN DEFAULT true,
     CONSTRAINT users_pkey PRIMARY KEY (id)
   );

   CREATE INDEX idx_users_email ON public.users(email);
   CREATE INDEX idx_users_username ON public.users(username);
   ```

3. **Create user_sessions table:**
   ```sql
   CREATE TABLE public.user_sessions (
     id UUID NOT NULL DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL,
     session_token VARCHAR(255) NOT NULL UNIQUE,
     expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     ip_address INET NULL,
     user_agent TEXT NULL,
     CONSTRAINT user_sessions_pkey PRIMARY KEY (id),
     CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) 
       REFERENCES users(id) ON DELETE CASCADE
   );

   CREATE INDEX idx_sessions_token ON public.user_sessions(session_token);
   CREATE INDEX idx_sessions_user_id ON public.user_sessions(user_id);
   CREATE INDEX idx_sessions_expires ON public.user_sessions(expires_at);
   ```

4. **Enable Row Level Security:**
   ```sql
   -- Enable RLS
   ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

   -- Users table policies
   CREATE POLICY "Allow public insert for signup" ON public.users
     FOR INSERT WITH CHECK (true);

   CREATE POLICY "Allow users to read own data" ON public.users
     FOR SELECT USING (true);

   CREATE POLICY "Allow users to update own data" ON public.users
     FOR UPDATE USING (true);

   -- Sessions table policies
   CREATE POLICY "Allow session creation" ON public.user_sessions
     FOR INSERT WITH CHECK (true);

   CREATE POLICY "Allow session read" ON public.user_sessions
     FOR SELECT USING (true);

   CREATE POLICY "Allow session deletion" ON public.user_sessions
     FOR DELETE USING (true);

   CREATE POLICY "Allow session update" ON public.user_sessions
     FOR UPDATE USING (true);
   ```

5. **Click "RUN"** to execute the SQL

### 5️⃣ Run Development Server
```bash
npm run dev
```

Your app should now be running at http://localhost:3000 (or the port shown in terminal)

### 6️⃣ Test Authentication
1. Navigate to http://localhost:3000
2. You should be redirected to `/sign-in`
3. Click **"Sign Up"** tab
4. Create an account with:
   - Email
   - Password
   - Username
5. Sign in with your credentials
6. You should see the main app!

---

## 🔒 Security Notes

### What's Protected:
- ✅ `.env.local` is in `.gitignore` - your API keys won't be committed
- ✅ Passwords are hashed with bcrypt (10 rounds)
- ✅ Sessions use HttpOnly secure cookies
- ✅ Row Level Security enabled on database

### What You Need to Do:
- ⚠️ **NEVER** commit `.env.local` to Git
- ⚠️ **NEVER** share your `SUPABASE_SERVICE_ROLE_KEY` publicly
- ⚠️ Keep your Supabase credentials private
- ⚠️ Use HTTPS in production

---

## 📂 Project Structure

```
code-canva-ai/
├── app/
│   ├── api/
│   │   └── auth/          # Authentication API routes
│   │       ├── signin/    # Sign in endpoint
│   │       ├── signup/    # Sign up endpoint
│   │       ├── signout/   # Sign out endpoint
│   │       └── user/      # Get current user endpoint
│   ├── sign-in/           # Auth UI page
│   ├── page.tsx           # Main app (protected)
│   └── layout.tsx         # Root layout with AuthProvider
├── contexts/
│   └── AuthContext.tsx    # Authentication state management
├── lib/
│   └── supabase.ts        # Supabase client configuration
├── components/            # React components
├── .env.local            # YOUR API KEYS (not in git)
├── .env.local.example    # Template for environment variables
└── .gitignore            # Git ignore rules (includes .env*)
```

---

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (via Supabase)
- **Authentication:** Custom (bcrypt + sessions)
- **Styling:** Tailwind CSS
- **UI Components:** Radix UI
- **Session Management:** HttpOnly Cookies

---

## 📚 Documentation

- **[CUSTOM_AUTH_IMPLEMENTATION.md](./CUSTOM_AUTH_IMPLEMENTATION.md)** - Complete authentication guide
- **[COOKIE_MANAGEMENT.md](./COOKIE_MANAGEMENT.md)** - Cookie security details
- **[README.md](./README.md)** - Project overview

---

## 🐛 Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env.local` exists (not `.env.local.example`)
- Check that all 3 variables are filled in
- Restart your dev server after adding environment variables

### "Failed to create user"
- Check that you've run all the SQL scripts in Supabase
- Verify tables exist in **Table Editor**
- Check RLS policies are enabled

### "Can't stay logged in"
- Check browser DevTools → Application → Cookies
- Should see `session_token` cookie
- Verify session exists in `user_sessions` table

### Need Help?
- Check the documentation files in this repo
- Verify your Supabase project is set up correctly
- Make sure all SQL scripts were executed

---

## 🎉 You're Ready!

Your CodeCanvas AI project is now set up with:
- ✅ Secure authentication
- ✅ PostgreSQL database
- ✅ Cookie-based sessions
- ✅ Protected routes
- ✅ Beautiful UI

Start building! 🚀
