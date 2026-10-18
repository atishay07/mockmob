"use client";

// Today's included 10-question set for the signed-in student: 'free' | 'priced' | 'unknown' (src/lib/dailySet.mjs), read once a
// minute from the server quote and shared by every surface that prices a 10-question set (src/lib/useDailySet.js).
import { useAuth } from '@/components/AuthProvider';
import { useDailySet } from '@/lib/useDailySet';

export function useMyDailySet() {
  const { user } = useAuth() || {};
  return useDailySet({ userId: user?.id || null, premium: Boolean(user?.isPremium), subject: Array.isArray(user?.subjects) ? user.subjects[0] || null : null });
}
