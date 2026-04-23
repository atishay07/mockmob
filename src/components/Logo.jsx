import React from 'react';
import Link from 'next/link';
import { Icon } from './ui/Icons';

export function Logo({ className = '' }) {
  return (
    <Link href="/" className={`logo ${className}`}>
      <span className="bolt">
        <Icon name="zap" style={{ width: '14px', height: '14px', color: '#000' }} />
      </span>
      MockMob<span className="dot">.</span>
    </Link>
  );
}
