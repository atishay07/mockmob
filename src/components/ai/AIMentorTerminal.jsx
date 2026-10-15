"use client";

// The Ask Mobi page surface (web IA plan 2.2 and 6). The name is the old file's; what it renders is Ask Mobi
// only: no tabs, no terminal styling. /mentor and /ask (IA9 rewrites it to /mentor?tab=ask) open this.
import MockMobAIHub from './MockMobAIHub';

export default function AIMentorTerminal({ variant = 'page', onClose }) {
  return <MockMobAIHub variant={variant} onClose={onClose} />;
}
