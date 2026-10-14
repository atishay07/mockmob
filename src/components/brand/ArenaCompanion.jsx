import { Mascot } from './Mascot';
import MobiReact from './MobiReact';

/**
 * A quiet companion. All supplied facts belong to the parent server readout.
 * Pass `act` (see MobiReact) to let him do something; the Celebrations and Reduce motion settings
 * apply either way (the still art follows the Celebrations level through Mascot).
 */
export default function ArenaCompanion({ pose = 'attentive', act, title = 'One step at a time.', children, compact = false }) {
  return <aside className={`arena-companion${compact ? ' arena-companion--compact' : ''}`} aria-label="Mobi, your study companion">
    <div className="arena-companion__art">{act ? <MobiReact act={act} size={compact ? 100 : 128} /> : <Mascot pose={pose} />}</div>
    <div><b>{title}</b>{children ? <p>{children}</p> : null}</div>
  </aside>;
}
