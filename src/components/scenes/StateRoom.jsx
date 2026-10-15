'use client';

// The room a quiet state shows (Skeleton.jsx EmptyState and ErrorState pass their `scene` here), by
// the app's StateView rule (sceneForState in sceneModel.mjs):
//   error  the loose cable and the repair tin, with one shrug on the first failure of a run; the
//          unplugged desk instead while the browser says it is offline (it switches back when the
//          connection returns)
//   empty  only the room the caller names: allClear, nothingYet, saved or noResults

import { useSyncExternalStore } from 'react';
import SceneVignette from './SceneVignette';
import { sceneForState } from './sceneModel.mjs';

function subscribeOnline(notify) {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
}
const onlineSnapshot = () => navigator.onLine !== false;
const serverOnline = () => true;

export function useOnline() {
  return useSyncExternalStore(subscribeOnline, onlineSnapshot, serverOnline);
}

export default function StateRoom({ kind, scene, compact = false }) {
  const online = useOnline();
  const room = sceneForState(kind, scene, { online });
  if (!room) return null;
  return <SceneVignette scene={room} compact={compact} entrance={kind === 'error' ? 'oops' : undefined} />;
}
