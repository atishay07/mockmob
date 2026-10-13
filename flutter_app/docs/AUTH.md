# Sign-in and staying signed in (Android app)

Last updated 13 Oct 2026 (auth review fixes applied the same day). The code is the authority: `lib/core/auth/**` (Supabase, session,
refresh) and `lib/features/account_access/**` (screens and widgets). Tests:
`test/unit/core_auth/**` and `test/unit/account_access/**`.

Last year's feedback was that students had to sign in again and again, and that Google and the
email code were unreliable. This app fixes it in three ways:

1. A session lasts until Supabase says it is over. Being offline, timeouts, server errors, rate
   limits and Keystore hiccups never sign anyone out.
2. Google works the way it does on the website (in the browser), plus a one-tap account sheet
   when it is configured.
3. Students who want it can set a password, so they do not have to wait for an email code.

## Methods at a glance

| Method | Default | Needs | Notes |
|---|---|---|---|
| Email code (8 digits) | On | Nothing new | Same `POST /api/auth/email-login` as the website (sent by Resend). Creates the account. |
| Google, browser | On (`GOOGLE_SIGN_IN=auto`) | Redirect URL in Supabase (owner step S1) | The same Supabase OAuth as the website, with PKCE, returning to `in.mockmob.app://login-callback`. Needs no Android OAuth client. |
| Google, one-tap sheet | On when `GOOGLE_WEB_CLIENT_ID` is set | Android OAuth clients in Google Cloud (owner steps G1 to G3) | Android Credential Manager through `google_sign_in` 7, then Supabase `signInWithIdToken` with a nonce. Falls back to the browser by itself. |
| Email and password | On | Email provider settings (owner step S2, with **Confirm email on**) | For students who set a password after signing in. The app has no password sign-up: accounts are made by email code or Google. Supabase's public sign-up endpoint still exists, so "Confirm email" must be on (S2.4) and the server refuses identities without a confirmed email. |
| Set a password | On | Same | "Set a password for faster sign-in" nudge after a code or Google sign-in, plus a screen under You, Account. |
| Forgot password | On | Nothing new | The emailed 8-digit code signs the student in, then "Choose a new password". Saving it signs out every other device. There is no recovery link to bring back into the app, and Supabase's own mailer is not used. |
| Sign out of other devices | On | Nothing new | `SignOutOtherDevicesCard` for You, Account (the integrator places it). Ends the website and other phones, keeps this phone. The website's account page has the same control. |
| Phone (SMS code) | **Off** (`PHONE_SIGN_IN=false`) | An SMS provider, DLT registration, and money per SMS (see "Phone sign-in") | Built and tested. You can switch it on later without code changes. |

Accounts are matched by email, as on the website. Supabase links a Google sign-in to an
existing account that has the same verified email, so a student who used the code before and
uses Google now keeps the same account. The server (`src/lib/auth.ts`) looks the MockMob user
up by Supabase user id first, then by email, and only for an identity whose email Supabase has
confirmed (`email_confirmed_at`).

## Build flags (`--dart-define`)

| Define | Values | Meaning |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | required | Without them auth is off and the app stays signed out. |
| `GOOGLE_WEB_CLIENT_ID` | the Web client ID (`…apps.googleusercontent.com`) | Turns on the one-tap sheet. This is the **Web** client that Supabase uses, not an Android client. It is public, not a secret. |
| `GOOGLE_SIGN_IN` | `auto` (default), `native`, `browser`, `off` | `auto` tries the sheet when a web client ID is set and uses the browser when the sheet is not available on the phone. `browser` always uses the browser. `off` hides Google. |
| `PHONE_SIGN_IN` | `false` (default), `true` | Shows "Sign in with your phone number" and "Add your phone number". Turn it on only after owner step P1 to P4. |

`dart_defines/README.md` still says that an empty `GOOGLE_WEB_CLIENT_ID` hides Google. That is
no longer true: the browser flow works without it. The README owner should add the two new
defines.

## Staying signed in

### Rules

- **Only a definitive answer from Supabase signs a student out.** That means the token endpoint
  answers 400, 401 or 403 with `refresh_token_not_found`, `refresh_token_already_used`,
  `session_not_found`, `session_expired`, `user_not_found`, `user_banned`, `invalid_grant` or
  "Invalid Refresh Token" (`token_client.dart`, `classifyRefreshFailure`).
- These never sign anyone out: no network, timeouts, 5xx, 429, captive-portal pages, a busy
  lock, a failed Keystore read, or a 401 from the MockMob API while Supabase still accepts the
  session. In the last case `onSessionLost` asks Supabase `GET /auth/v1/user` before it decides.
- The student sees why. A real loss shows "Please sign in again. Your work is still on this
  phone." (`AuthSnapshot.sessionExpired`).
- **The email's sign-in button opens the website, not the app.** App Links deliberately leave out
  `/auth/callback`, so a student reading the email on the phone with the app installed is signed
  into the website by the button. The email now says "Using the MockMob app? Type this code in
  the app." Students use the code in the app.

### How it works

- **One refresher.** supabase_flutter's own session handling is off (`autoRefreshToken: false`,
  an inert `LocalStorage`, `detectSessionInUri: false`). Left on, it refreshes outside the
  lock and signs out on any 4xx, including 429, or when an expired session cannot be
  refreshed at launch. `SessionKeeper` is the only code that spends a refresh token, in the
  foreground and in the WorkManager isolate alike.
- **A lock across isolates.** Before each refresh the keeper takes `SessionLock` (an exclusive
  file in the cache directory) and re-reads storage, so the newest refresh token is always the
  one sent and no token is spent twice. Supabase's reuse detection would otherwise revoke the
  whole session. A lost answer is retried once within Supabase's reuse window (30 s on both
  projects, owner step S4). Taking over a lock left by a killed isolate is serialized by a
  second file (`<lock>.reclaim`), so two waiters can never both take it.
- **Cold start.** `AuthService.restore()` loads the stored session without the network, so a
  signed-in student opens the app signed in even when offline. If the token expires within 5
  minutes, it is refreshed in the background.
- **Resume.** On `AppLifecycleState.resumed`, `syncFromStorage()` takes over a session the
  background job refreshed and refreshes ahead when less than 5 minutes are left.
- **Each API call.** `accessToken()` hands out a token that has at least 30 s left, refreshing
  first when it does not. When the network is down it hands out what it has.
- **Phone clocks that are wrong.** Freshness is judged by this phone's clock plus `expires_in`,
  recorded when the token arrived (`mm_local_expires_at`). A budget phone whose clock is hours
  off therefore neither refreshes on every request nor never.
- **Process death.** A refreshed session is written to secure storage under the lock before
  the lock is released, and a new sign-in is written as soon as it arrives. A killed app
  restarts signed in.
- **App updates and Keystore hiccups.** The session lives in its own secure-storage namespace
  (`SessionVault`, namespace `mm_auth`, `resetOnError: false`). With flutter_secure_storage's
  defaults, one failed Keystore read deletes the entry, and an unexpected plugin error deletes
  every entry, which would sign the student out without a word. Now a failed read is retried
  and nothing is deleted. A session stored by an earlier build is moved over on its first read,
  so updating the app keeps the student signed in. If the namespace ever cannot be written, the
  session goes to the general store as a last resort. `android:allowBackup="false"` means a
  phone restore never brings back Keystore entries that cannot be decrypted.
- **Sign-out on purpose** (You, Sign out) clears the tokens and this account's local data.
  A PKCE verifier is removed when its code is exchanged. A sign-in or sign-out bumps an epoch, so a refresh still in flight can never bring
  a session back.

### Tests (all in `test/unit/core_auth/`)

| Case | Test |
|---|---|
| Cold start offline with an expired token stays signed in | `auth_service_test` "a cold start offline…" |
| Cold start online refreshes once and stores the new session | "a cold start online refreshes…" |
| Resume refreshes ahead, and takes over the background job's session | "a token near expiry…", "on resume a session the background job refreshed…" |
| 5xx and 429 keep the student signed in | "5xx and 429 on refresh…" |
| Only a definitive rejection signs out | "only a definitive rejection signs out…" |
| MockMob API 401 handling (three cases) | "a 401 from the MockMob API…", "…signs out when Supabase confirms…", "an offline check…", plus the "with the real API client" group |
| Phone clock hours off | "a phone clock hours off…" |
| Process death | "the session survives process death…" |
| Sign-out racing a background refresh | "a sign-out while the background job is refreshing…" |
| Damaged stored entry | "a damaged stored entry is refreshed…" |
| Failure classification, token never in a URL, retry inside the reuse window | `session_store_test` |
| Two isolates refresh at once and spend the token once | `session_store_test` "two isolates refreshing at once…" |
| Waiters that find an abandoned lock never hold it together; a dead reclaimer's guard is cleared | `session_store_test` "SessionLock" group |
| Sign out of other devices: fresh token, `scope=others`, this phone stays signed in; offline sends nothing | `auth_service_test` "other devices" group |
| After Forgot password, other devices are signed out; a failure is named, the password still counts | `account_access_test` "after Forgot password", "SignOutOtherDevicesCard" |
| The native Google nonce is used once per run | `auth_service_test` "native: the nonce is used once…" |
| Background job never deletes a session; a 503 means "try next run" | `session_store_test` |
| App update migration, Keystore read and write failures, sign-out from both stores | `session_vault_test` |

## Google

`AuthService.signInWithGoogle()` chooses the method by itself:

1. **One-tap sheet** (when `GOOGLE_WEB_CLIENT_ID` is set and `GOOGLE_SIGN_IN` is `auto` or
   `native`). The code makes a raw nonce, sends its SHA-256 to Google
   (`GoogleSignIn.initialize(serverClientId:, nonce:)`), and gets an ID token from Credential
   Manager. Supabase receives the ID token and the raw nonce (`signInWithIdToken`) and checks
   them against each other. "Skip nonce check" stays **off**. google_sign_in 7 can be
   initialized only once per app run, so the nonce cannot change within a run: after one
   successful one-tap sign-in the raw nonce is dropped, and any later Google sign-in in the same
   run (after a sign-out) uses the browser. The next app start gets a new nonce. If the student closes the sheet,
   nothing changes. If the sheet cannot be used on the phone (no Play services, no Android
   client for this signing key), the app switches to the browser for the rest of the run, and
   the button also offers "Use the browser instead".
2. **Browser** (the fallback, or `GOOGLE_SIGN_IN=browser`). The app asks Supabase for the OAuth
   URL with PKCE (`authFlowType: pkce`), `redirectTo: in.mockmob.app://login-callback` and
   `prompt=select_account` (so a shared family phone can pick an account), then opens it in the
   phone's browser. Google returns to Supabase, and Supabase returns to the app with a one-time
   `?code=`. The app exchanges that code once, using the code verifier from secure storage.

Security of the callback:

- The link carries a code, never a token. The code cannot be used without the verifier in this
  app's Keystore-backed storage. Another app that registers the same scheme gets nothing usable.
- Only `in.mockmob.app://login-callback` is acted on (`AuthCallback.parse`). Any other link is
  ignored. Each code is exchanged at most once. Nothing about the link is logged.
- The verifier survives the app being killed while the browser is open, so a slow phone that
  drops the app still finishes the sign-in.
- The website's `/auth/callback` does not take part in this flow.

## Email and password

- **Sign in** (`PasswordSignInForm`, `/sign-in/password`): checks the input before any call,
  shows "Signing in" while it works, keeps what the student typed when it fails, and tells the
  phone's password manager to save the pair (autofill hints). Supabase gives the same answer for
  "no password set yet" and "wrong password", so the error explains both: "…or sign in with an
  email code and set a new password."
- **Set a password** (`SetPasswordForm`, `SetPasswordScreen`, `/you/account/password`):
  `updateUser(password:)` runs on the current session after the token has been refreshed.
  "Password saved" appears only after the server has confirmed it. The minimum is 8
  characters, checked on the phone and by Supabase (owner step S2).
- **The nudge** (`SetPasswordNudge`): "Set a password for faster sign-in", once per account on
  this phone. It goes away after "Not now", after a password is set, or after a password
  sign-in.
- **Forgot password** (`ForgotPasswordScreen`, `/sign-in/forgot`): email, then the 8-digit
  code, which signs the student in, then "Choose a new password"
  (`/you/account/password?mode=reset`, reached through the router's remembered route). The
  resend key counts down 60 s, the server's rate. Once the new password is saved, every other
  session is ended (`signOut(scope: others)`), so whoever knew the old password, or holds a
  stolen session, loses access. If that call fails, "Password saved" still shows, with a line
  naming You, Account, Sign out of other devices.
- **Sign out of other devices** (`SignOutOtherDevicesCard`): one key, a working state, then
  "Done. Your other devices need to sign in again." The token is refreshed first, because
  Supabase silently ignores a logout sent with an expired token; offline sends nothing and says
  so.

All errors map from Supabase error codes to `AccessFailure` (`access_failure.dart`). Server
messages are never shown or logged. Each message says what to do next (`AccessCopy.problem`).

## Phone sign-in (off; honest assessment)

Data rules for minors (India's DPDP Act; many CUET students are 17): keep Google scopes to
`openid`, `email` and `profile`; keep phone sign-in off; keep tokens and emails out of analytics
(the app's only auth log line prints an error type). Before the DPDP Rules' obligations start
(phased in to about mid-2027), plan one age and guardian-consent checkbox at sign-up, not an
onboarding quiz. This is not legal advice.

What is built: `sendPhoneCode`, `verifyPhoneCode`, `addPhone`, `verifyPhoneChange`, the screens
`/sign-in/phone` and `/you/account/phone`, Indian number normalisation to `+91XXXXXXXXXX`, and
tests. A phone code signs in only to an account that already has that number confirmed
(`shouldCreateUser: false`). Accounts stay keyed by email, so the website's `/api/auth/me` and
payments are untouched. With the flag off, every phone call is refused before it reaches the
network and the UI is hidden.

Why it is off: Supabase does not send SMS itself.

- **Provider.** Supabase supports Twilio, Twilio Verify, MessageBird, Vonage and Textlocal
  directly. MSG91, usually the cheapest in India, works through Supabase's "Send SMS" auth hook
  (a small HTTPS function that calls MSG91).
- **DLT registration is mandatory in India (TRAI).** You register MockMob as the principal entity
  on an operator DLT portal (Jio, Airtel, Vi). Expect roughly INR 5,000 to 6,000 one-time, and
  a few days to two weeks. You also register a 6-character sender header (for example
  `MCKMOB`) and the exact OTP message template. Messages that do not match are dropped by the
  operators.
- **Cost per SMS** (check current prices before you decide): MSG91 is roughly INR 0.15 to 0.30
  per OTP SMS. Twilio to India is roughly USD 0.05 to 0.08 (INR 4 to 7) per SMS and still
  needs DLT. At 10,000 sign-ins a month that is roughly INR 2,000 to 3,000 with MSG91, or INR
  40,000 to 70,000 with Twilio. Retries and abuse add to it, so keep Supabase's SMS rate
  limits on.
- **Recommendation:** leave phone off. Password sign-in plus long-lived sessions removes the
  repeated sign-ins that phone login would have solved, at no cost.

To switch it on later (owner steps P1 to P4 below), build with `PHONE_SIGN_IN=true`. No code
changes are needed.

## Owner steps

You do these in dashboards. Nothing here goes into the repository, and none of these values is a
secret except provider auth tokens, which go only into the Supabase dashboard.

### Supabase (production project; repeat on staging for testing)

**S1. Redirect URL for the app** (required for Google in the browser)
1. Supabase dashboard → your project → Authentication → URL Configuration.
2. Under "Redirect URLs", click "Add URL", enter exactly `in.mockmob.app://login-callback`, and
   save.
3. Keep the Site URL as `https://www.mockmob.in`. Do not add wildcards for this scheme.

**S2. Email and password**
1. Authentication → Sign In / Providers → Email. It must be enabled (the website already uses
   it).
2. Set "Minimum password length" to `8`. Under "Password requirements", "No required
   characters" is fine; the app explains the 8-character rule.
3. Turn "Secure password change" **on**. Without it, anyone holding a stolen session could set
   a password and keep access. With it, a student who taps "Set a password" more than 24 hours
   after signing in is asked to sign in with a code again first; the app already says so
   (`AccessFailure.reauthRequired`: "For safety, sign in with an email code again, then set your
   password."). Forgot password is unaffected: the code sign-in is fresh.
4. Turn "Confirm email" **on** (both projects). The app never signs anyone up with a password,
   but Supabase's public sign-up endpoint accepts one from anyone. With "Confirm email" off, a
   stranger could sign up with a student's email and a password and get a session at once.
   With it on, the email code and Google still work exactly as before, the server refuses
   unconfirmed identities, and the migration `supabase/migrations/20261013150000_auth_unconfirmed_passwords.sql`
   removes any password set before the email was confirmed. Apply that migration (staging
   first, then production).

**S3. Google provider** (already on for the website; for the one-tap sheet)
1. Authentication → Sign In / Providers → Google.
2. In "Client IDs", make sure the **Web** client ID (the one already used for the website) is
   listed. If you also list other IDs, separate them with commas and keep the Web client first.
3. Leave "Skip nonce check" **off**. The app sends a nonce.

**S4. Sessions** (the main cause of "signing in again and again")
1. Authentication → Sessions (some dashboards show it under Authentication → Settings).
2. "Detect and revoke potentially compromised refresh tokens": **on**. "Refresh token reuse
   interval": `30` seconds on both projects (the website and the app can refresh at nearly the
   same moment on a slow network, and the app's retry relies on the window).
3. "Enforce single session per user": **off**. When it is on, signing in on the website signs
   the app out.
4. "Time-box user sessions": `0` (never). "Inactivity timeout": `0` (never). Any other value
   signs students out after that time, whatever the app does.
5. Access token (JWT) expiry: keep the default `3600` seconds.

**S5. Rate limits** (Indian mobile networks put many students behind one IP address)
1. Authentication → Rate Limits.
2. Raise "Token refreshes" and "Sign-ups and sign-ins" well above the defaults (for example 1,800
   and 300 per 5 minutes per IP). The app already treats a 429 as "try later" and never signs
   out because of one, but low limits slow everyone on a shared carrier IP. This matters even
   more for the website: its proxy and API routes refresh from Vercel's servers, so every
   student shares a few outgoing addresses. The website now keeps the session on a 429 too, but
   a student stays "unavailable" until the limit resets.

### Google Cloud (only for the one-tap sheet; the browser flow works without it)

**G1. Open the right project**
1. Go to console.cloud.google.com and choose the project that owns the **Web** OAuth client the
   website uses (APIs & Services → Credentials lists it under "OAuth 2.0 Client IDs").
2. Copy that Web client's "Client ID" into `GOOGLE_WEB_CLIENT_ID` in `dart_defines/prod.json`
   (and `dev.json` for staging builds). Never copy the client secret into the app.

**G2. Android OAuth clients** (one per signing key, all with package `in.mockmob.app`)
1. APIs & Services → Credentials → "+ Create credentials" → "OAuth client ID".
2. Application type: **Android**. Name: for example `MockMob Android (debug, this PC)`.
3. Package name: `in.mockmob.app`.
4. SHA-1 certificate fingerprint: see the list below. Click Create.
5. Repeat for each SHA-1. The Android client IDs do not go into the app or into Supabase. Google
   only needs them to exist so that Credential Manager trusts this app.

SHA-1 fingerprints:

| Key | SHA-1 | How to get it |
|---|---|---|
| Debug key on the owner's PC (emulator and USB builds) | `76:56:F0:C1:49:4E:A0:73:45:C1:60:92:6A:D3:70:17:AA:0A:8E:27` | Printed on 13 Oct 2026 with `keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android`. Every PC has its own debug key; another PC needs its own client. |
| Upload key (signs the bundle you upload) | from your upload keystore | `keytool -list -v -keystore <path to upload .jks> -alias <alias>`, or Play Console → your app → Test and release → App integrity → App signing → "Upload key certificate" → SHA-1. |
| Play App Signing key (what students actually install from Play) | from Play Console | Play Console → your app → Test and release → App integrity → App signing → "App signing key certificate" → SHA-1. **This one is required for Play installs.** |

**G3. OAuth consent screen**
1. Google Auth Platform (or APIs & Services → OAuth consent screen) → Audience: the publishing
   status must be **In production**, not Testing. In Testing, only listed test users can sign in.
2. Branding: app name `MockMob`, support email, logo and the `mockmob.in` domain. The website
   already needs these.

Until G2 is done for a build's key, the app shows the sheet, sees that Google refuses it, and
moves to the browser by itself. Students can still sign in.

### Phone (only if you decide to pay for SMS)

- **P1.** Register on a DLT portal (Jio TrueConnect, Airtel or Vi Vilpower) as principal entity.
  Register the header `MCKMOB` and an OTP template such as
  `{#var#} is your MockMob sign-in code. It expires in 10 minutes. Do not share it.`
- **P2.** Create an MSG91 account (or Twilio). Link the DLT entity ID, header and template ID.
- **Before P3, add these guards** (once the phone provider is on, anyone can call
  `/auth/v1/otp` directly, whatever the app does):
  1. Authentication → Attack Protection → enable CAPTCHA protection with **Cloudflare
     Turnstile** (site key in the app and website, secret in Supabase). The app and website
     then need to send the CAPTCHA token; ask for that change before enabling.
  2. Authentication → Hooks → **Before User Created** hook that rejects any new user without an
     email. A phone-only account would get 401 from every MockMob API, which is keyed by email.
  3. The **Send SMS** hook (needed for MSG91 anyway) refuses any number that does not start
     with `+91`, which blocks international SMS fraud.
  4. Keep the SMS rate limit low (P4).
- **P3.** Supabase → Authentication → Sign In / Providers → Phone: enable it. Then either choose
  Twilio or Twilio Verify and paste its Account SID, auth token and message service SID, or,
  for MSG91, Authentication → Hooks → "Send SMS hook" pointing at a function that calls MSG91
  (ask for it to be written; it is not in this repository). Set the OTP length to `6` and the
  expiry to `600` seconds. Keep "Enable phone signup" **off**: phone is for existing accounts
  only.
- **P4.** Authentication → Rate Limits: keep the SMS limit low (for example 30 per hour).
  Then build with `PHONE_SIGN_IN=true`.

## For the integrator (sign-in and onboarding owners)

Import `package:mockmob/features/account_access/account_access.dart`.

- `SignInMethods(emailCode: <existing email-code block>)` goes on the sign-in screen. It shows
  Google on top, then a choice of Email code or Password, then phone when that is on. One method
  works at a time.
- The parts on their own: `GoogleSignInButton`, `PasswordSignInForm`, `SetPasswordForm`,
  `PhoneCodeForm`, `SetPasswordNudge(onSetPassword: …)` (for the after-sign-in sheet or You,
  Account).
- `SignOutOtherDevicesCard()` goes on You, Account, below the password nudge and above Sign out.
  It needs a signed-in student and draws its own working, done and failure states.
- Routes: bind `AccountAccessRoutes.passwordSignIn` (`/sign-in/password`) → `passwordSignInScreen`,
  `forgotPassword` (`/sign-in/forgot`) → `forgotPasswordScreen`, `phoneSignIn`
  (`/sign-in/phone`) → `phoneSignInScreen`, `setPassword` (`/you/account/password`) →
  `setPasswordScreen`, and `addPhone` (`/you/account/phone`) → `addPhoneScreen`. The
  `/sign-in/*` paths are already allowed while signed out. The `/you/account/*` paths need a
  signed-in student.
- **The router must ignore the callback link.** Flutter's own deep linking hands
  `in.mockmob.app://login-callback?code=…` to go_router as `/?code=…`, while `AuthService`
  handles the same link through app_links. In the redirect, when `AuthLinks.isCallback(uri)` is
  true, or the location is `/` with a `code` query, go to the sign-in screen (or stay where
  you are) and never log or report that location.
- Forgot password relies on the router's remembered route: a signed-in student on a
  `/sign-in/*` path goes to `intendedRouteProvider`'s location.
- The email-code copy in `lib/features/auth/copy.dart` says "No password to remember." That is
  still true for the code, but update it if it sits next to the Password option.
- `AuthController` (`ref.read(authSnapshotProvider.notifier)`) now also has
  `continueWithGoogle`, `continueWithGoogleInBrowser`, `oauthReturns`, `signInWithPassword`,
  `setPassword`, `signOutOtherDevices`, `sendPhoneCode`, `verifyPhoneCode`, `addPhone` and `verifyPhoneChange`. These
  throw `AccessException(AccessFailure…)`. The older `signInWithGoogle` still returns `bool` and
  throws `SignInException`.
