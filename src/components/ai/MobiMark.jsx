// Mobi's flat face mark (ASK-MOBI-1018, section 2): the volt diamond, the dark visor and two cream eyes from the character
// art, the "o" of logo B. Static: no glass, no liquid, no light. It is the only volt inside the Ask Mobi panel. `blinking`
// is the one motion it has, used only while a written reply is really on its way (the eyes close once every 1.6 s).
export default function MobiMark({ size = 24, blinking = false, className = '' }) {
  return (
    <svg
      className={`mobi-mark${blinking ? ' mobi-mark--blink' : ''}${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 1.6c.5 0 1 .2 1.4.6l8.4 8.4c.8.8.8 2 0 2.8l-8.4 8.4c-.8.8-2 .8-2.8 0l-8.4-8.4c-.8-.8-.8-2 0-2.8l8.4-8.4c.4-.4.9-.6 1.4-.6z" fill="#d2f000" />
      <path d="M12.6 2.2l9.2 9.2c.2.2.3.4.4.6L12 13.4z" fill="#b9d400" opacity=".55" />
      <rect x="5.4" y="8.6" width="13.2" height="6.2" rx="3.1" fill="#10140c" />
      <ellipse className="mobi-mark__eye" cx="9.6" cy="11.7" rx="1.05" ry="1.65" fill="#f4f0e0" />
      <ellipse className="mobi-mark__eye" cx="14.4" cy="11.7" rx="1.05" ry="1.65" fill="#f4f0e0" />
    </svg>
  );
}
