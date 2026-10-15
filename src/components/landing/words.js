// Small copy helpers shared by the landing's server page and its client components.

/** "A", "A and B", "A, B and C". */
export function listWords(items) {
  const list = (items || []).filter(Boolean);
  if (list.length <= 1) return list[0] || '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}
