import React from 'react';

export function Input({ 
  type = 'text', 
  className = '', 
  isTextarea = false,
  isSelect = false,
  options = [],
  ...props 
}) {
  if (isTextarea) {
    return <textarea className={`textarea ${className}`} {...props} />;
  }
  
  if (isSelect) {
    return (
      <select className={`select ${className}`} {...props}>
        {options.map((opt, i) => (
          <option key={i} value={opt.value || opt}>{opt.label || opt}</option>
        ))}
      </select>
    );
  }
  
  return <input type={type} className={`input ${className}`} {...props} />;
}
