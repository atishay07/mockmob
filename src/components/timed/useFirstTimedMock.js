"use client";
// The facts behind the first-timed-mock line, read once per surface from GET /api/me/timed-mock, and the prompt they
// make (data/first_timed_mock.js). Nothing shows while the facts load, when they cannot be read, or once the student
// has a timed paper: an unknown count is never treated as zero.
import { useContext, useEffect, useState } from 'react';
import { apiGet } from '@/lib/fetcher';
import { AuthContext } from '@/components/AuthProvider';
import { firstTimedMockPrompt } from '@/../data/first_timed_mock';

const idle = (userId) => ({ userId, facts: null });

/** The student's facts, or null until they are known. */
export function useTimedMockFacts(userId) {
  const [state, setState] = useState(idle(null));
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    apiGet('/api/me/timed-mock')
      .then((facts) => { if (alive) setState({ userId, facts }); })
      .catch(() => { if (alive) setState(idle(userId)); });
    return () => { alive = false; };
  }, [userId]);
  return state.userId === userId ? state.facts : null;
}

/** The prompt for one surface ('today', 'result' or 'radar'), or null. `resultMode` is the mode of the paper on screen. */
export function useFirstTimedMock(surface, { resultMode = null } = {}) {
  const auth = useContext(AuthContext);
  const facts = useTimedMockFacts(auth?.user?.id || null);
  return firstTimedMockPrompt(facts, { surface, resultMode });
}
