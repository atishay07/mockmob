import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';

const liquidGlassButtonVariants = cva(
  [
    'group relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl border',
    'font-display font-bold uppercase tracking-[0.08em] transition-all duration-300',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/50',
    'disabled:pointer-events-none disabled:opacity-50',
    "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-[inherit] before:content-['']",
    'before:bg-gradient-to-b before:from-white/20 before:to-transparent before:opacity-60',
    "after:pointer-events-none after:absolute after:inset-y-[-120%] after:left-[-40%] after:z-0 after:w-[45%] after:rotate-12 after:content-['']",
    'after:bg-gradient-to-r after:from-transparent after:via-white/25 after:to-transparent',
    'after:transition-transform after:duration-500 group-hover:after:translate-x-[220%]',
  ].join(' '),
  {
    variants: {
      variant: {
        volt: 'border-volt/45 bg-[rgba(210,240,0,0.14)] text-volt hover:bg-[rgba(210,240,0,0.2)] hover:border-volt/70',
        ghost:
          'border-white/15 bg-[rgba(255,255,255,0.03)] text-white hover:bg-[rgba(255,255,255,0.08)] hover:border-white/35',
      },
      size: {
        sm: 'h-10 px-4 text-[11px]',
        md: 'h-11 px-5 text-xs',
        lg: 'h-12 px-6 text-[13px]',
      },
    },
    defaultVariants: {
      variant: 'volt',
      size: 'md',
    },
  }
);

export function LiquidGlassButton({
  asChild = false,
  variant,
  size,
  className = '',
  children,
  ...props
}) {
  const Comp = asChild ? Slot : 'button';
  const classes = `${liquidGlassButtonVariants({ variant, size })} ${className}`.trim();

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children,
      {
        ...props,
        className: `${classes} ${children.props.className || ''}`.trim(),
      },
      <span className="relative z-10 inline-flex items-center gap-2">{children.props.children}</span>
    );
  }

  if (asChild) {
    return (
      <Comp className={classes} {...props}>
        {children}
      </Comp>
    );
  }

  return (
    <Comp className={classes} {...props}>
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </Comp>
  );
}
