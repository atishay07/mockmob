// Ask the homepage guide for a reaction. The guide queues it until Pip settles at
// the visible station. Pages without the guide (including the Arena) are inert.
export function pipReact(station, mood) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('pip:react', { detail: { station, mood } }));
}
