import React from 'react';

export function Avatar({ 
  name = '?', 
  size = 'md', // 'sm', 'md', 'lg', 'xl'
  className = '' 
}) {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const sizeClass = size !== 'md' ? size : '';
  
  return (
    <div className={`avatar ${sizeClass} ${className}`}>
      {initial}
    </div>
  );
}
