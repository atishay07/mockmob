import React from 'react';

export function Card({ 
  children, 
  variant = 'default', // 'default', 'hover', 'active', 'volt-soft'
  className = '',
  onClick,
  type = 'button',
  ...props 
}) {
  const variantClass = variant !== 'default' ? variant : '';
  const classNames = `glass ${variantClass} ${onClick ? 'card-action' : ''} ${className}`;

  if (onClick) {
    return (
      <button
        type={type}
        className={classNames}
        onClick={onClick}
        {...props}
      >
        {children}
      </button>
    );
  }
  
  return (
    <div 
      className={classNames}
      {...props}
    >
      {children}
    </div>
  );
}
