'use client';

// The shared ways in (LandingActions, the phone dock) link to the sample as "/#try-practice", the live home's address. On
// this page the sample is here, so those links are pointed at this page's own #try-practice: once on load, and again at the
// moment of a click, before DemoJump (a capture listener on the document) reads the link and places the question card.
// Without this a tap on "Try 5 questions first" here would leave for the live home page.
import { useEffect } from 'react';

const SAMPLE = '/#try-practice';

function retarget(anchor) {
  if (anchor?.getAttribute('href') === SAMPLE) anchor.setAttribute('href', `${window.location.pathname}#try-practice`);
}

export default function SampleHere() {
  useEffect(() => {
    document.querySelectorAll(`a[href="${SAMPLE}"]`).forEach(retarget);
    // The window's capture phase runs before the document's, so DemoJump sees the link already pointed here.
    const onClick = (event) => retarget(event.target instanceof Element ? event.target.closest('a[href]') : null);
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, []);
  return null;
}
