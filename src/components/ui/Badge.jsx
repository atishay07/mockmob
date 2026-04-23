import React from 'react';

export function Badge({ 
  children, 
  variant = 'subtle', // 'subtle', 'volt', 'red'
  className = '',
  isEyebrow = false,
  noDot = false
}) {
  if (isEyebrow) {
    return (
      <div className={`eyebrow ${noDot ? 'no-dot' : ''} ${className}`}>
        {children}
      </div>
    );
  }
  
  return (
    <span className={`pill ${variant} ${className}`}>
      {children}
    </span>
  );
}
