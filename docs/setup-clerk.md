# Clerk Authentication Setup Guide

This guide walks through configuring **Clerk** (free tier) for the **Hostel–Library Pass & Student Movement System**.

---

## 1. Create a Clerk Application

1. Log in to [Clerk Dashboard](https://dashboard.clerk.com).
2. Click **Add application**.
3. Application name: `Hostel Library Pass System`.
4. Choose **User & password** sign-in:
   - **Check:** Username, Password.
   - **Uncheck:** Email address, Phone number, and Social logins (Google, GitHub, etc.).
5. Click **Create Application**.

---

## 2. Configure Restricted Sign-up (No Public Registration)

In accordance with Section 6.1 of the system specifications:
1. Navigate to **Configure → User & Authentication → Restrictions**.
2. Under **Sign-up mode**, select **Restricted**.
3. Toggle off public sign-ups. Only the server Backend API (invoked when an Admin registers a student) can create accounts.

---

## 3. Configure Session Token Claims (Role & Profile ID)

To enable Next.js Middleware and Supabase RLS to read the user's role and profile without extra database roundtrips:
1. Navigate to **Configure → Sessions → Customize session token**.
2. Click **Edit**.
3. Add the following claims to the token payload:
```json
{
  "role": "{{user.public_metadata.role}}",
  "profile_id": "{{user.public_metadata.profile_id}}"
}
```
4. Click **Save**.

---

## 4. Configure Clerk ↔ Supabase Third-Party Integration

1. In Clerk Dashboard, go to **Configure → Integrations → Supabase**.
2. If using Supabase Third-Party Auth: follow Clerk's official integration docs to configure Supabase JWT signing key or Clerk JWKS URL in your Supabase project settings.

---

## 5. Configure Webhooks (Session Logs)

1. Navigate to **Configure → Webhooks**.
2. Click **Add Endpoint**.
3. Endpoint URL: `https://your-domain.vercel.app/api/webhooks/clerk` (or your local ngrok/tunnel URL during testing).
4. Subscribe to the following events:
   - `session.created`
   - `session.ended`
   - `session.removed`
5. Copy the **Signing Secret** (`whsec_...`) and add it to your environment variables as `CLERK_WEBHOOK_SECRET`.

---

## 6. Retrieve API Keys

1. Navigate to **Developers → API Keys**.
2. Copy:
   - **Publishable Key**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...`
   - **Secret Key**: `CLERK_SECRET_KEY=sk_test_...`
3. Add them to your `.env.local`.
