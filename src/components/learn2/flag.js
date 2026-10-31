"use client";
// Whether this screen draws the Learn v2 world: on the real site only while NEXT_PUBLIC_LEARN2 is exactly 'on'; in the development
// preview always, unless the address says &l2=off (the same rule DiscoveryFeed and ExploreCovers use). Used by the entry points outside
// learn2 that lead into Key cards (Review's chapter rows, the Learn hub row), so one student meets one Key cards world, not two.
import { usePathname, useSearchParams } from 'next/navigation';

export const LEARN2_ENV_ON = process.env.NEXT_PUBLIC_LEARN2 === 'on';

export function useLearn2On() {
  const pathname = usePathname() || '';
  const params = useSearchParams();
  return LEARN2_ENV_ON || (pathname.startsWith('/preview/') && params?.get('l2') !== 'off');
}
