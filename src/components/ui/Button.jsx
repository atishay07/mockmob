import React from 'react';
import { Icon } from './Icons';

export function Button({ 
  children, 
  variant = 'volt', // 'volt', 'outline', 'ghost'
  size = 'md',      // 'sm', 'md', 'lg'
  icon,
  className = '',
  ...props 
}) {
  const baseClass = `btn-${variant} ${size} ${className}`;
  
  return (
    <button className={baseClass} {...props}>
      {children}
      {icon && <Icon name={icon} />}
    </button>
  );
}
