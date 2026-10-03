# MockMob bundled mobile beta

React/Vite/Capacitor 8. `dist` ships inside each app; no hosted `server.url` wrapper.
Use the hosted Next.js API and Supabase public configuration. No service keys here.

1. Copy `.env.example` to `.env.local` and supply the pilot URL/public Supabase config.
2. `npm ci`; `npm run build`.
3. Android source is generated; `npx cap add ios` on a Mac; `npm run sync`.
4. Android Studio/JDK/SDK for Android; Xcode/macOS for iOS signing.
5. Set unique production bundle IDs before a store submission. `in.mockmob.beta` is the beta identifier.

Native credentials, session drafts and downloaded reviews use SecureStorage (iOS
Keychain/Android Keystore). Browser preview uses memory only. OTP uses the existing
MockMob email sender and Supabase verifyOtp. Backend validates every bearer token.
Account-scoped caches cannot be displayed while signed out.

Beta is free with no purchase buttons or external purchase links. Online scored
practice only: pending events must reach the server before expiry; timer continues
in background. Offline reviews are historical snapshots, not new scored attempts.
An explicit user action schedules a local reminder; declining notifications does
not block practice. Gabarito and Hanken fonts are bundled with their licenses.
Real-device verification remains a launch gate. No JDK/adb is available in the
current shell, so no signed APK or Android device test has been completed here.

Required device checks: email delivery and invalid/expired codes; native storage
failure; refresh/expired token; offline/online; background/resume; interrupted submit;
retries; sign-out cache isolation; reminder permission; Android small-screen and iOS
safe areas. Building web assets does not certify any of these. Store enrollment,
signing and review remain separate from the October 8 pilot target.
