"use client";

// A signed-in student who opens the front page goes straight into the arena: the brochure is for people
// who are not in yet. Where they land follows their state (arenaHomePath): a student who has not chosen
// subjects goes to onboarding, everyone else to Today, which already fits new and returning students and
// free and paid access. The check waits for the session, so a signed-out visitor never waits on it and
// never sees a redirect. "/?stay=1" keeps the front page open for someone who wants to read it.
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { arenaHomePath } from '@/lib/auth-redirect';

export default function ArenaEntry() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, needsOnboarding } = useAuth();
  useEffect(() => {
    if (pathname !== '/' || status !== 'authenticated') return;
    try {
      if (new URLSearchParams(window.location.search).has('stay')) return;
    } catch { /* No query to read: go in. */ }
    router.replace(arenaHomePath({ needsOnboarding }));
  }, [pathname, status, needsOnboarding, router]);
  return null;
}
