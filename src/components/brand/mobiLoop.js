// The frame loop for one Mobi: steps his sim and paints, and stops when he is at rest. Idle life comes
// in beats with rests between them, so a Mobi standing at ease costs nothing between a blink and the
// next glance: the loop sleeps until `idleWait` has passed (never less than 250 ms, so it can never
// spin), then wakes for the beat. No React: the component owns the sim and the figure and hands this
// two functions.

/**
 * @param {() => import('./mobiSim.js').Sim | null} getSim
 * @param {(rig: object) => void} paint
 * @returns {{ wake(): void, stop(): void }}
 */
export function createLoop(getSim, paint) {
  let raf = 0;
  let timer = 0;
  let last = 0;

  function frame(now) {
    raf = 0;
    const sim = getSim();
    if (!sim) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;
    sim.step(dt);
    paint(sim.rig);
    if (sim.busy) { raf = window.requestAnimationFrame(frame); return; }
    last = 0;
    const waitFor = Math.max(0.25, sim.idleWait);
    timer = window.setTimeout(() => {
      timer = 0;
      sim.elapse(waitFor);
      last = 0;
      raf = window.requestAnimationFrame(frame);
    }, waitFor * 1000);
  }

  return {
    /** Runs the loop now (he has something to do), or lets a sleeping loop carry on. */
    wake() {
      if (!getSim()) return;
      if (timer) { window.clearTimeout(timer); timer = 0; }
      if (!raf) { last = 0; raf = window.requestAnimationFrame(frame); }
    },
    stop() {
      if (raf) window.cancelAnimationFrame(raf);
      if (timer) window.clearTimeout(timer);
      raf = 0; timer = 0; last = 0;
    },
  };
}
