"use client";
// A native <details> that opens and closes with a smooth height. It stays a real details element, so
// find-in-page, the toggle event, `open` and every page style keep working; the body is wrapped once so
// its height can be eased. Opening: open, then grow from 0. Closing: shrink, then close. While it
// closes, data-closing is set so chevrons can turn back at once. Reduced motion: instant, as before.
// `chevron` adds the turning chevron for a summary that has none of its own.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { isMotionReduced } from '@/lib/motion/draw';
import './controls.css';

const OPEN_MS = 280;
const CLOSE_MS = 220;
const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

export const SmoothDetails = forwardRef(function SmoothDetails({ summary, summaryClassName, bodyClassName = '', chevron = false, children, className = '', onToggle, ...rest }, ref) {
  const detailsRef = useRef(null);
  const bodyRef = useRef(null);
  const running = useRef(null);
  useImperativeHandle(ref, () => detailsRef.current);

  const stop = () => { if (running.current) { running.current.cancel(); running.current = null; } };
  useEffect(() => () => stop(), []);

  const animateBody = useCallback((from, to, duration, done) => {
    const body = bodyRef.current;
    if (!body || typeof body.animate !== 'function') { done?.(); return; }
    stop();
    body.style.overflow = 'hidden';
    const animation = body.animate(
      [{ height: `${from}px`, opacity: from === 0 ? 0 : 1 }, { height: `${to}px`, opacity: to === 0 ? 0 : 1 }],
      { duration, easing: EASE },
    );
    running.current = animation;
    animation.onfinish = () => { running.current = null; body.style.overflow = ''; done?.(); };
    animation.oncancel = () => { body.style.overflow = ''; };
  }, []);

  const onSummaryClick = (event) => {
    const details = detailsRef.current, body = bodyRef.current;
    if (!details || !body || isMotionReduced() || typeof body.animate !== 'function') return; // native toggle
    event.preventDefault();
    if (details.open && !details.dataset.closing) {
      const from = body.getBoundingClientRect().height;
      details.dataset.closing = 'true';
      animateBody(from, 0, CLOSE_MS, () => { delete details.dataset.closing; details.open = false; });
    } else {
      const from = details.dataset.closing ? body.getBoundingClientRect().height : 0;
      delete details.dataset.closing;
      details.open = true;
      const to = body.scrollHeight;
      animateBody(from, to, OPEN_MS);
    }
  };

  return (
    <details ref={detailsRef} className={className} onToggle={onToggle} {...rest}>
      <summary className={summaryClassName} onClick={onSummaryClick}>{summary}{chevron ? <ChevronDown size={18} aria-hidden="true" className="ctl-details__chev" /> : null}</summary>
      <div ref={bodyRef} className={`ctl-details__body ${bodyClassName}`.trim()}>{children}</div>
    </details>
  );
});

export default SmoothDetails;
