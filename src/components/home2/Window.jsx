// The one product frame of /home-next (spec section 3, reused in section 5): a plain window on the app's own surface, a
// title bar with the address of the screen inside, and a body that holds every screen in one grid cell, so the frame keeps
// the tallest screen's height and nothing below it moves when the screen changes. Day: the app's light paper; Night: the
// app's own raised dark. No glow, no colour world of its own.
export function Window({ path, tag = null, className = '', children }) {
  return (
    <div className={`hn-win ${className}`.trim()}>
      <div className="hn-win__bar" aria-hidden="true">
        <span className="hn-win__dots"><i /><i /><i /></span>
        <span className="hn-win__path">{path}</span>
        {tag ? <span className="hn-win__tag">{tag}</span> : <span className="hn-win__end" />}
      </div>
      <div className="hn-win__body">{children}</div>
    </div>
  );
}

export default Window;
