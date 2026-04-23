import React from 'react';

export function Card({ 
  children, 
  variant = 'default', // 'default', 'hover', 'active', 'volt-soft'
  className = '',
  onClick,
  ...props 
}) {
  const variantClass = variant !== 'default' ? variant : '';
  
  return (
    <div 
      className={`glass ${variantClass} ${className}`} 
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}
