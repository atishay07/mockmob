import React from 'react';
import { Icon } from './Icons';

export function StatCard({ 
  label, 
  value, 
  icon, 
  highlight = false,
  className = '' 
}) {
  return (
    <div className={`stat ${highlight ? 'highlight' : ''} ${className}`}>
      <div className="flex items-center gap-2 text-sm text-zinc-400 font-semibold mb-1">
        {icon && <Icon name={icon} />} {label}
      </div>
      <div className="value">{value}</div>
    </div>
  );
}
