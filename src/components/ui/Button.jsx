import React from 'react';
import { Icon } from './Icons';

export function Button({ 
  children, 
  variant = 'volt', // 'volt', 'outline', 'ghost'
  size = 'md',      // 'sm', 'md', 'lg'
  icon,
  asChild = false,
  className = '',
  ...props 
}) {
  // mk-press: the same spring press as the app (motion-kit.css); reduced motion drops it.
  const baseClass = `btn-${variant} ${size} mk-press ${className}`;

  if (asChild) {
    const child = React.Children.toArray(children).find(React.isValidElement);
    if (!child) return null;

    return React.cloneElement(child, {
      ...props,
      className: `${baseClass} ${child.props.className || ''}`.trim(),
    });
  }
  
  return (
    <button className={baseClass} type="button" {...props}>
      {children}
      {icon && <Icon name={icon} />}
    </button>
  );
}
