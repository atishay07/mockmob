# Website: home page and test screen follow the visitor, 13 Oct 2026

Branch `fix/web-state-home`. Owner direction: signed-in students land in the Arena, the home page
follows the visitor's state, no obvious defensive disclaimers.

## How state reaches the page

- `<html data-visitor>` (`new` | `returning` | `member`) and `<html data-visitor-plan>` (`free` | `pro`)
  are set by an inline script in `<head>` before first paint, from the hint in
  `localStorage['mm:visitor:v1']`. `VisitorSync` keeps both current from the real auth status.
- Parts of a page that depend on state are rendered for everyone and shown or hidden by
  `src/app/visitor.css` (`vs-guest-only`, `vs-member-only`, `vs-new-only`, `vs-returning-only`,
  `vs-hide-pro`). The guest server HTML is therefore the same for crawlers and for the cached page.
- `new` means signed out and never signed in on this device, however often they visit.
  `returning` means signed out after having been signed in here. A first visit, a reload or a tenth
  look at the sample never produces "Welcome back".
- Signing out (and a `SIGNED_OUT` event) clears `mm:arena-first:v1`, so the next person to sign in
  on a shared device is not sent into the Arena.

## Decisions

- Test screen: the practice-bank audit line is gone. An offline or waiting-to-submit state is a toast
  that overlays the test (never pushes it), inside the same `role="status"` region.
- Result page: no disclaimer about the practice bank. A quiet pointer to the existing per-question
  "Report a problem with this question" button stays.
- Home, signed in: pricing shows no "Start free"; a free member gets "Go Pro" (to `/pricing`), a Pro
  member sees no button. The "Can I try it before signing up?" FAQ is hidden (it stays in the page and
  its structured data). The Mistake Repair tour slide opens `/recovery` (or `/review` while Recovery is
  not released) instead of `/signup`.
- Mobile dock: "Pick up where you left off." and a "Resume your test" button appear only when a
  resumable test is saved on this device; otherwise a full-width "Enter the Arena".
- The menu sheet shows a neutral placeholder row, not "Log in" or "Sign out", while the sign-in check
  runs or MockMob cannot be reached. The top bar follows the remembered hint instead, so it is right
  on first paint.

## Follow-ups (not done)

1. **Seed the boot script from the Supabase auth cookie.** Students who were already signed in when
   this ships have no hint yet, so their first load shows the marketing hero for the 0.3 to 2 seconds
   the auth check takes, then switches (once; the hint is written after that). The same gap appears
   if a student clears site data but keeps the session. The boot script could also read the
   `sb-<project-ref>-auth-token` cookie (non-HttpOnly, possibly chunked as `.0`, `.1`) and treat its
   presence as `member` when there is no hint. Cost: an expired cookie briefly shows the member hero
   until the check ends signed out. Needs the project ref at build time and a test for chunked names.
2. **CSP.** None exists today. If one is added, both inline boot scripts in `src/app/layout.js` (theme
   and visitor) need a nonce or a hash.
