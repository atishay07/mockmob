import React from 'react';

// The notice a plan or payment page shows instead of its body when it was opened from the MockMob Android app (Play
// Payments policy: no steering app users to another way to pay). It is always in the markup and hidden by CSS; the
// rule `html[data-app-view]` in src/app/app-view.css shows it and hides the page body (the element marked
// data-commerce-page), so there is no flash and the page stays as static as it was. No link: nothing here leads to a
// purchase. The contract with the app is in src/app/app-view.css and in the root layout's script.
export function AppViewNotice() {
  return (
    <main className="app-view-notice" aria-label="Plans and payments">
      <p>Plans and payments for the app are in the MockMob app.</p>
    </main>
  );
}
