"use client";

import MockMobAIHub from './MockMobAIHub';

export default function AIMentorTerminal({ variant = 'page', onClose }) {
  return <MockMobAIHub variant={variant} initialTab="ai" onClose={onClose} />;
}
