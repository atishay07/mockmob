// The landing draws each section below the statement only as it nears the screen (content-visibility: auto,
// landing.css). Until then, reading a node's geometry inside it (a rect, scrollWidth, offsetHeight) makes the
// browser lay that whole section out on the spot, during the page's first second. Callers that also measure
// from a ResizeObserver skip the read while the node is undrawn: the observer fires once the section is drawn.
// Browsers without checkVisibility's contentVisibilityAuto option answer false here and measure as before.
export function undrawn(node) {
  if (!node || typeof node.checkVisibility !== 'function') return false;
  try {
    return !node.checkVisibility({ contentVisibilityAuto: true });
  } catch {
    return false;
  }
}

// The nearest node at or above `node` that is drawn: a section held back by content-visibility is itself laid
// out (at its reserved height), only its contents wait, so its box answers "above or below the screen?" cheaply.
export function drawnAncestor(node) {
  let current = node;
  while (current && undrawn(current)) current = current.parentElement;
  return current || node;
}
