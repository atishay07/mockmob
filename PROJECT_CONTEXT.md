# MockMob Project Context

## 1. PROJECT OVERVIEW
**MockMob** is a community-driven mock test and prep platform targeting competitive exams (CUET, JEE, NEET, UPSC, etc.). It enables users to take live "Mock Sprints", review their weaknesses via an AI radar, and climb a global leaderboard. 
- **Current Stage:** Phase 1 MVP. Core infrastructure is built, focusing on the question contribution engine, moderation pipeline, and test generation.

## 2. CURRENT SYSTEMS IMPLEMENTED

### A. Authentication
- **Mechanism:** Supabase OAuth (Google Provider) running in the browser. 
- **Handling:** Managed contextually via `src/components/AuthProvider.jsx`. Exposes `useAuth()` hook for components to access session data, `signInWithGoogle()`, `signOut()`, and `refreshSession()`.
- **Key Files:** `src/lib/supabase-browser.js`, `src/app/api/auth/me/route.js`, `src/app/auth/callback/AuthCallbackPageClient.jsx`.

### B. User System
- **Schema:** The `users` table stores `id` (TEXT), `email`, `username`, `reputation_total`, `hidden_trust_score`, `trust_tier`, `subscription_status`.
- **APIs:** 
  - `GET/PATCH /api/users/[id]` 
  - Data access managed via `data/db.js` (`Database.getUserById`, `Database.updateUser`).

### C. Credit System (CRITICAL)
A fully functional, ledger-backed atomic credit economy is live.
- **Database Structure:**
  - `users.credit_balance` (INTEGER, defaults to 0).
  - `credit_transactions` (id, user_id, amount, type: earn/spend/bonus, reference, created_at) which acts as an append-only ledger.
- **RPC Functions (Supabase):** 
  - `spend_credits(p_user_id, p_amount, p_reference)`: Uses row-level locks (`FOR UPDATE`) to atomically check balance and deduct credits.
  - `grant_credits(p_user_id, p_amount, p_reference)`: Atomically adds credits.
- **API Endpoints:**
  - `POST /api/credits/spend`: Accepts `{ amount, reference }`. Deducts credits from the authenticated user.
  - `POST /api/credits/grant`: Accepts `{ user_id, amount, reference }`.
- **Integration Points:**
  - **Earning:** When a question is approved via `POST /api/questions/moderate`, the `uploadedBy` user automatically receives **15 credits**.
  - **Spending:** Generating a premium mock test in the Dashboard costs **1 credit**, calling `/api/credits/spend` before navigating to the test.

### D. Existing Features
- **Upload System:** Users can submit new questions for peer review.
- **Moderation Pipeline:** A dedicated moderator UI to approve/reject pending questions. AI moderation capabilities exist in the backend schema.
- **Dashboard (Arena):** The authenticated command center where users select subjects/chapters, view their rank, and spend credits to generate mock sprints.

## 3. FRONTEND STATE
- **Implemented:** 
  - Marketing landing page with high-end glassmorphism UI, morphing text, and dot-matrix patterns.
  - Private `/dashboard` layout (`AppLayoutClient.jsx`) featuring a live credit pill and role-switching (Student/Mod).
  - `/features` and `/pricing` pages.
- **Missing / Broken:**
  - Login panel/routing occasionally traps users or fails to handle edge cases gracefully.
  - UI inconsistencies between public marketing pages and private dashboard states.
  - Missing dynamic CTA routing on the landing page for already logged-in users.

## 4. FILE STRUCTURE
- `src/app/(app)/`: Contains the authenticated dashboard and tools (`dashboard`, `explore`, `leaderboard`, `upload`, `moderation`). Uses `AppLayoutClient.jsx`.
- `src/app/api/`: All backend endpoints (Next.js App Router).
- `src/components/`: Reusable UI components (NavBar, AuthProvider, Magic UI elements).
- `src/components/ui/`: Low-level design system components (Button, Cards, InteractiveGridPattern, MorphingText).
- `data/db.js`: The central data access layer wrapping Supabase Postgres calls and RPCs.
- `supabase/migrations/`: Database schema definitions, notably `0005_phase1_schema.sql` (core) and `0011_credits_system.sql` (ledger).

## 5. KNOWN ISSUES / TODO
- Fix the login panel flow and ensure AuthCallback seamlessly hands off to `/dashboard` or `/onboarding`.
- Ensure the main marketing Navbar is aware of `useAuth()` so logged-in users see "Go to Arena" instead of "Log in / Sign up".
- Create seamless UI bridges between the marketing pages and the private AppLayout.
- Refine error handling across the application.

## 6. CONSTRAINTS
- **DO NOT break existing backend APIs.** The data access layer in `db.js` must remain intact.
- **DO NOT re-implement credits.** The ledger system via RPCs is strictly defined and active. Always use `Database.spendCredits` and `Database.grantCredits`.
- Maintain the Next.js App Router paradigm. Use Server Components where possible, and `"use client"` exclusively for interactive UI.
