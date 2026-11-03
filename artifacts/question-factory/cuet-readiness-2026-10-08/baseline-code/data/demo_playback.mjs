// A bounded demo timeline. Pauses preserve elapsed visible time; hidden time never catches up.
export function createDemoPlayback(events, emit, { now = () => performance.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
  let index = 0, elapsed = 0, started = null, timer = null, disposed = false;
  function tick() {
    timer = null;
    if (disposed || started === null) return;
    const current = elapsed + Math.max(0, now() - started);
    while (index < events.length && events[index].at <= current) emit(events[index++].value);
    if (index < events.length) timer = schedule(tick, Math.max(0, events[index].at - current));
    else { elapsed = current; started = null; }
  }
  function pause() {
    if (started !== null) elapsed += Math.max(0, now() - started);
    started = null;
    if (timer !== null) cancel(timer);
    timer = null;
  }
  return {
    resume() { if (disposed || started !== null || index >= events.length) return; started = now(); timer = schedule(tick, Math.max(0, events[index].at - elapsed)); },
    pause,
    dispose() { pause(); disposed = true; },
  };
}
