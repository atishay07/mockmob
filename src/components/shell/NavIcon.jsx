import React from 'react';
import { ChevronDown, Ellipsis, Layers, Play, Swords } from 'lucide-react';
import { AppIcon } from '@/components/ui/Glyph';

// The shell's icons: the product's own set (AppIcon) plus the few the new menus need. Same family
// (lucide) and stroke as AppIcon, decorative, currentColor.
const EXTRA = { combinations: Layers, rival: Swords, start: Play, more: Ellipsis, chevron: ChevronDown };

export function NavIcon({ name, size = 18, className = '' }) {
  const Extra = EXTRA[name];
  if (Extra) return <Extra size={size} strokeWidth={1.75} className={className} aria-hidden="true" />;
  return <AppIcon name={name} size={size} className={className} />;
}
