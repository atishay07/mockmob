// The emailed sign-in button for a code asked for in the MockMob app (20 Oct, I2). On a phone with the app,
// the verified App Link for /app/login opens the app, which spends the link itself. Anywhere else this page
// finishes the sign-in on the website exactly like /auth/callback (the student taps Continue first).
export const dynamic = "force-dynamic";
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

import AuthCallbackPageClient from '../../auth/callback/AuthCallbackPageClient';

export default function Page() {
  return <AuthCallbackPageClient />;
}
