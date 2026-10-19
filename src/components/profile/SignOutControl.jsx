"use client";

// Account > Account actions > Sign out (owner G29, 19 Oct: "I seriously don't see sign out of this browser"). It is the
// first row of the Account actions group, above "Sign out of other devices" and "Delete account", and it is labelled in
// words wherever it appears (this page, the line under the page title, the top bar, the phone's You sheet). Every one of
// those keys is the same SignOutButton (SignOutConfirm.jsx): it never signs out on the first tap, it asks first with
// "Stay signed in" first and focused (release 11 walk: the top bar and the sheet used to sign out at once).
import { LogOut } from 'lucide-react';
import { SIGN_OUT_COPY, SignOutButton } from './SignOutConfirm';
import './account.css';

const COPY = {
  title: SIGN_OUT_COPY.title,
  plain: SIGN_OUT_COPY.plain,
  go: SIGN_OUT_COPY.go,
  signedInAs: 'Signed in as',
  signedIn: 'You are signed in.',
};

export default function SignOutControl() {
  return (
    <div className="acct-act acct-signout">
      <div className="acct-act__text">
        <h3 id="acct-signout-h">{COPY.title}</h3>
        <p>{COPY.plain}</p>
      </div>
      <div className="acct-act__keys">
        <SignOutButton className="acct-key">
          <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />{COPY.go}
        </SignOutButton>
      </div>
    </div>
  );
}

// The line under the Account title (release 11 walk: the Account actions group is 7.6 screens down a phone): who is
// signed in, and a plain Sign out beside it, on the first screen at every width. The full group stays at the foot.
export function SignedInLine({ email = '' }) {
  return (
    <div className="acct-who" id="signed-in">
      <p className="acct-who__text">{email ? <>{COPY.signedInAs} <b>{email}</b></> : COPY.signedIn}</p>
      <SignOutButton className="acct-key acct-who__key">
        <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />{COPY.go}
      </SignOutButton>
    </div>
  );
}
