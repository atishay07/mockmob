'use client';
import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn

// "Ask a parent to pay" on /pricing (lane F-B, 15 Nov 2026): one quiet key under Get Pro, for a signed-in student while monthly
// Pro is on sale and PARENT_PAY_ENABLED is on (the page decides). It opens the parent sheet with the page's own volt key.
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import ParentPaySheet from './ParentPaySheet';
import { PARENT_PAY_COPY } from './parentPayModel.mjs';

export function ParentPayKey({ rupees = 99, fixture = null, disabled = false }) {
  const [opener, setOpener] = useState(null);
  const router = useRouter();
  const onClose = useCallback((kind) => {
    setOpener(null);
    // The account turned out to have Pro (a parent already paid): the page redraws as the Pro page.
    if (kind === 'pro') router.refresh();
  }, [router]);
  return (
    <>
      <button type="button" className="mm-btn mm-btn--quiet pp-ask" onClick={(event) => setOpener(event.currentTarget)} disabled={disabled} aria-haspopup="dialog">
        {PARENT_PAY_COPY.key}
      </button>
      {opener ? <ParentPaySheet open rupees={rupees} goClass="mm-btn mm-btn--primary" fixture={fixture} returnFocus={opener} onClose={onClose} /> : null}
    </>
  );
}
