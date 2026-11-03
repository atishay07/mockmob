import React from 'react';

// First grapheme of the name, so an emoji or a combined Devanagari syllable is never cut in half
// (charAt(0) returned half a surrogate pair for a name that starts with an emoji).
export function firstGrapheme(name) {
  const text = typeof name === 'string' ? name.trim() : '';
  if (!text) return '?';
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const first = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)[Symbol.iterator]().next().value;
    if (first) return first.segment.toLocaleUpperCase();
  }
  return Array.from(text)[0].toLocaleUpperCase();
}

export function Avatar({
  name = '?',
  size = 'md', // 'sm', 'md', 'lg', 'xl'
  className = ''
}) {
  const sizeClass = size !== 'md' ? size : '';

  return (
    <div className={`avatar ${sizeClass} ${className}`}>
      {firstGrapheme(name)}
    </div>
  );
}
