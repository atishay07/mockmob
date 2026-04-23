import React from 'react';

export function ProgressBar({ 
  value = 0, 
  color = 'volt', // 'volt', 'amber', 'red'
  className = '' 
}) {
  const safeValue = Math.min(Math.max(value, 0), 100);
  
  return (
    <div className={`bar ${className}`}>
      <div 
        className={`fill fill-${color}`} 
        style={{ width: `${safeValue}%` }} 
      />
    </div>
  );
}
