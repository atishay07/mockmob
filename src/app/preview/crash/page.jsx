import { notFound } from 'next/navigation';
import CrashPreview from './CrashPreview';

export const metadata = { robots: { index: false, follow: false } };

// Development only: makes a screen crash on purpose, so each error page can be seen and its Try again pressed.
//   ?at=page            the page crashes in the browser once per load (src/app/error.js catches it)
//   ?at=server&n=<any>  the server fails the first request for that n (src/app/error.js, with a Reference digest)
//   ?at=global          the crash also takes the root error page down (src/app/global-error.js)
// The signed-in shell's page and the paper's page are seen in the Arena preview, with the real shell around them:
//   /preview/arena?view=today&crash=app   and   /preview/arena?view=test&crash=paper&subject=accountancy&mode=quick&count=10&generationKey=previewcrash01
// (each has a "Crash this screen" key in the preview bar).
const failedOnce = new Set();

export default async function CrashPreviewPage({ searchParams }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const query = await searchParams;
  const at = typeof query.at === 'string' ? query.at : '';
  const nonce = typeof query.n === 'string' ? query.n : '';
  if (at === 'server' && nonce && !failedOnce.has(nonce)) {
    failedOnce.add(nonce);
    throw new Error('Preview crash on the server');
  }
  return <CrashPreview at={at} />;
}
