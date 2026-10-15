import { toggle } from '@/lib/haptics';

// The site's switch, the same spring and tick as the app's. Controlled: pass `checked` and `onChange(next)`.
// Name it with aria-label or aria-labelledby. Keeps a 44 px touch area.
export function Switch({ checked, onChange, disabled = false, className = '', ...aria }) {
  return (
    <button type="button" role="switch" aria-checked={Boolean(checked)} disabled={disabled} className={`mk-switch ${className}`.trim()} onClick={() => { toggle(!checked); onChange?.(!checked); }} {...aria}>
      <svg className="mk-switch__tick" viewBox="0 0 52 32" aria-hidden="true" focusable="false"><path pathLength="1" d="M11 16.5 L14.8 20.2 L21 12.6" /></svg>
      <span className="mk-switch__thumb" />
    </button>
  );
}
