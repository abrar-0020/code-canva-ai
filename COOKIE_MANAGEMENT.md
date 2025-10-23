# 🍪 Cookie Management Implementation

## Overview
Your authentication system uses **HttpOnly secure cookies** for session management, providing robust security against XSS and CSRF attacks.

## Cookie Configuration

### Cookie Name
- **`session_token`** - Stores the user's session identifier

### Security Settings
```typescript
{
  httpOnly: true,              // ✅ Cannot be accessed by JavaScript
  secure: process.env.NODE_ENV === 'production', // ✅ HTTPS only in production
  sameSite: 'lax',            // ✅ CSRF protection
  maxAge: 60 * 60 * 24 * 7,   // ✅ 7 days (604,800 seconds)
  path: '/',                   // ✅ Available site-wide
}
```

## Cookie Lifecycle

### 1️⃣ **Sign Up** (`/api/auth/signup`)
**What happens:**
1. User submits email, password, username
2. Password is hashed with bcrypt (10 rounds)
3. User record created in `public.users` table
4. Random session token generated (32 bytes hex = 64 characters)
5. Session stored in `public.user_sessions` table
6. **Cookie set** with session token

**Code:**
```typescript
response.cookies.set('session_token', session_token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
})
```

### 2️⃣ **Sign In** (`/api/auth/signin`)
**What happens:**
1. User submits email and password
2. User fetched from database by email
3. Password verified with bcrypt.compare()
4. New session token generated
5. Session stored in database
6. **Cookie set** with new session token

**Result:** Old sessions remain valid, new cookie created for this login

### 3️⃣ **Session Validation** (`/api/auth/user`)
**What happens on every protected page:**
1. **Cookie read** from request headers
2. Session looked up in `user_sessions` table
3. Expiration checked (`expires_at > NOW()`)
4. User data joined from `users` table
5. `last_accessed` timestamp updated
6. User data returned (or null if invalid)

**Code:**
```typescript
const session_token = req.cookies.get('session_token')?.value
```

### 4️⃣ **Sign Out** (`/api/auth/signout`)
**What happens:**
1. **Cookie read** from request
2. Session deleted from `user_sessions` table
3. **Cookie cleared** from browser

**Code:**
```typescript
// Read cookie
const session_token = req.cookies.get('session_token')?.value

// Delete from database
await supabase
  .from('user_sessions')
  .delete()
  .eq('session_token', session_token)

// Clear cookie
response.cookies.delete('session_token')
```

## Security Features

### 🔒 HttpOnly Flag
**Protection:** Prevents JavaScript access to the cookie
```typescript
httpOnly: true
```
- ✅ Blocks `document.cookie` access
- ✅ Prevents XSS attacks from stealing tokens
- ✅ Cookie only sent in HTTP requests

### 🔐 Secure Flag (Production)
**Protection:** Ensures cookie only sent over HTTPS
```typescript
secure: process.env.NODE_ENV === 'production'
```
- ✅ Development: Works on `http://localhost`
- ✅ Production: Requires HTTPS connection
- ✅ Prevents man-in-the-middle attacks

### 🛡️ SameSite Protection
**Protection:** Prevents CSRF attacks
```typescript
sameSite: 'lax'
```
- ✅ Cookie sent on same-site requests
- ✅ Cookie sent on top-level navigation (clicking links)
- ✅ Cookie NOT sent on cross-site POST requests
- ✅ Blocks CSRF while allowing normal navigation

### ⏱️ Expiration (7 days)
**Protection:** Automatic session cleanup
```typescript
maxAge: 60 * 60 * 24 * 7 // 7 days in seconds
```
- ✅ Browser automatically deletes after 7 days
- ✅ Database has matching `expires_at` timestamp
- ✅ Expired sessions rejected by validation

## Cookie Flow Diagram

```
┌─────────────┐
│   Sign Up   │
│  /sign-in   │
└──────┬──────┘
       │
       ▼
┌──────────────────────────┐
│ POST /api/auth/signup    │
│ - Hash password          │
│ - Create user            │
│ - Generate session token │
│ - Store in database      │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Set HttpOnly Cookie      │
│ session_token=abc123...  │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Redirect to /            │
│ (Cookie sent with req)   │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ GET /api/auth/user       │
│ - Read cookie            │
│ - Validate session       │
│ - Return user data       │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ User authenticated ✅     │
│ App renders protected UI │
└──────────────────────────┘
```

## Database Schema

### `public.user_sessions` Table
```sql
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,  -- Stored from cookie
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address INET NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Client-Side Usage

### AuthContext
The cookie is managed **automatically** by the browser. The AuthContext uses it via API calls:

```typescript
// Sign Up
const { user, error } = await signUp(email, password, username)
// Cookie is automatically set by the browser from response

// Check Session
useEffect(() => {
  checkUser() // Automatically sends cookie with request
}, [])

// Sign Out
await signOut()
// Cookie is automatically cleared
```

### No Manual Cookie Handling Needed
```typescript
// ❌ DON'T DO THIS - Cookie is HttpOnly
document.cookie = 'session_token=...' // Won't work!

// ✅ DO THIS - Use the API
await fetch('/api/auth/signin', {
  credentials: 'include' // Automatically includes cookies
})
```

## Testing Cookie Management

### 1. Check Cookie in Browser DevTools
1. Open DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Click **Cookies** → `http://localhost:3001`
4. Look for `session_token` cookie

**Expected Values:**
- Name: `session_token`
- Value: 64-character hex string
- HttpOnly: ✅
- Secure: ❌ (in development) / ✅ (in production)
- SameSite: `Lax`
- Expires: 7 days from creation

### 2. Verify Session in Database
```sql
-- Check active sessions
SELECT 
  us.session_token,
  us.expires_at,
  us.last_accessed,
  u.email,
  u.username
FROM user_sessions us
JOIN users u ON us.user_id = u.id
WHERE us.expires_at > NOW()
ORDER BY us.last_accessed DESC;
```

### 3. Test Cookie Deletion on Sign Out
1. Sign in to the app
2. Check cookie exists in DevTools
3. Click Sign Out
4. Cookie should disappear from DevTools
5. Database session should be deleted

## Troubleshooting

### Cookie Not Being Set
**Symptoms:** Can't stay logged in, redirected to sign-in page

**Check:**
1. Browser DevTools → Network tab → Check signup/signin response headers
2. Should see `Set-Cookie: session_token=...`
3. If missing, check server logs for errors

**Fix:**
```typescript
// Ensure credentials are included
fetch('/api/auth/signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // ✅ Required!
  body: JSON.stringify({ email, password })
})
```

### Cookie Not Being Sent with Requests
**Symptoms:** Session validation fails, user appears logged out

**Check:**
1. DevTools → Network → Click request → Check "Cookies" section
2. Should show `session_token` in request cookies

**Fix:**
```typescript
// Ensure credentials are included in all auth requests
fetch('/api/auth/user', {
  credentials: 'include' // ✅ Required!
})
```

### Cookie Expires Too Soon
**Check:** Database session `expires_at` vs cookie `maxAge`

**Current Settings:** 7 days (604,800 seconds)

**To Change:**
```typescript
// In signup/signin routes
maxAge: 60 * 60 * 24 * 30, // 30 days
```

## Production Checklist

- [x] HttpOnly flag enabled
- [x] Secure flag set for production
- [x] SameSite protection configured
- [x] Session expiration set (7 days)
- [x] Cookie deletion on sign out
- [x] Session validation on protected routes
- [ ] HTTPS configured on production server
- [ ] Environment variable `NODE_ENV=production` set
- [ ] Cookie domain configured if using subdomains

## Summary

✅ **Cookie Creation:** Sign up & sign in set HttpOnly secure cookies
✅ **Cookie Reading:** Every request automatically includes cookie
✅ **Cookie Validation:** `/api/auth/user` validates session from cookie
✅ **Cookie Deletion:** Sign out removes cookie and database session
✅ **Security:** HttpOnly + Secure + SameSite + Expiration
✅ **Database Sync:** Cookies map to `user_sessions` table records

**Your cookie management is production-ready!** 🎉
