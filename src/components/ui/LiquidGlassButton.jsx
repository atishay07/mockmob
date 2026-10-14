import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { buttonClass, withoutTrailingArrow } from './Button';

// Kept for its callers (PrepOS pricing and the credit purchase button). It used to be a glass
// pill with an uppercase label and a sweeping sheen; glass belongs to chrome only (owner D6), so
// it now renders the brand buttons: variant 'volt' is the primary pill, 'ghost' the secondary.
const VARIANT = { volt: 'primary', ghost: 'secondary' };
const SIZE = { sm: 'sm', md: 'md', lg: 'lg' };

export function LiquidGlassButton({ asChild = false, variant = 'volt', size = 'md', className = '', children, ...props }) {
  const classes = buttonClass({ variant: VARIANT[variant] || 'primary', size: SIZE[size] || 'md', className });
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      className: `${classes} ${children.props.className || ''}`.trim(),
    }, <span className="ui-btn__label">{withoutTrailingArrow(children.props.children)}</span>);
  }
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp className={classes} {...(asChild ? {} : { type: 'button' })} {...props}>
      <span className="ui-btn__label">{withoutTrailingArrow(children)}</span>
    </Comp>
  );
}
