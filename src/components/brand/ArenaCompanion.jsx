import { Mascot } from './Mascot';

/** A quiet companion. All supplied facts belong to the parent server readout. */
export default function ArenaCompanion({ pose = 'attentive', title = 'One step at a time.', children, compact = false }) {
  return <aside className={`arena-companion${compact ? ' arena-companion--compact' : ''}`} aria-label="Pip, your study companion">
    <div className="arena-companion__art"><Mascot pose={pose} /></div>
    <div><b>{title}</b>{children ? <p>{children}</p> : null}</div>
  </aside>;
}
