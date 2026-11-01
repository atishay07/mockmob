"use client";
// Whether this screen draws the Learn v2 world: on the real site only while NEXT_PUBLIC_LEARN2 is exactly 'on'; in the development
// preview always, unless the address says &l2=off (the same rule DiscoveryFeed and ExploreCovers use). Used by the entry points outside
// learn2 that lead into Key cards (Review's chapter rows, the Learn hub row), so one student meets one Key cards world, not two.
// R3 X7: the preview's &l2=off is read the hydration-safe way. The server (and the first client render) answer "not off", then the
// address is read; the page flips once if it says off. Reading it in the first render made the server's tree and the client's differ.
import { useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

export const LEARN2_ENV_ON = process.env.NEXT_PUBLIC_LEARN2 === 'on';

const noSubscription = () => () => {};
const addressSays = (key, value) => () => {
  try { return new URLSearchParams(window.location.search).get(key) === value; } catch { return false; }
};
const l2OffNow = addressSays('l2', 'off');
const navN1Now = addressSays('nav', 'n1');

/** The preview's &l2=off: false on the server and during hydration, the address's answer after. */
export function useL2Off() {
  return useSyncExternalStore(noSubscription, l2OffNow, () => false);
}

/** The preview's &nav=n1 (Learn as a place of its own in the sidebar), read the same hydration-safe way. */
export function useNavN1() {
  return useSyncExternalStore(noSubscription, navN1Now, () => false);
}

export function useLearn2On() {
  const pathname = usePathname() || '';
  const off = useL2Off();
  return LEARN2_ENV_ON || (pathname.startsWith('/preview/') && !off);
}
