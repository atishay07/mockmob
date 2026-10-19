"use client";
// The room on the invite page (Mob v3): the den's own lamp-lit room (den.css), five seats on its floor, and no names.
// Taken seats are neutral silhouettes (SOCIAL-SPEC P1, P3: the public page says how many, never who). Your seat is dashed and
// named "Your seat" before you sign in; once you are signed in it holds the Fold you are choosing, which blinks and
// breathes like any Fold in the den. The Mob's name and subject sit over the room, as they do in the den.
// Motion: the den's own (the room rises, Folds pop in 90 ms apart, tags engrave); a new pick pops in again at once (key, no stagger delay). Reduced
// motion is handled by den.css.
import { Plus } from 'lucide-react';
import { JoinCopy, SILHOUETTE_FOLDS } from '@/lib/mob/v3/joinModel.mjs';
import { FoldFigure } from '../den/FoldFigure';
import '../den/den.css';
import './join.css';

export function JoinStage({ name = '', subline = '', slots = [], fold = 'dart', swap = false, yourName = '', skeleton = false, label }) {
  return (
    <div className={`den-stage join-stage${skeleton ? ' den-stage--skeleton' : ''}`} data-count={5} data-empty={slots.length === 0 && !skeleton ? true : undefined}>
      <div className="den-room" aria-hidden="true">
        <span className="den-room__art den-room__art--night" />
        <span className="den-room__art den-room__art--day" />
        <span className="den-room__lamp" />
        <span className="den-room__floor" />
        <span className="den-room__scrim" />
      </div>
      {name ? (
        <header className="den-stage__head">
          <div className="den-stage__title">
            <p className="den-stage__name" data-join-name="">{name}</p>
            {subline ? <p className="den-stage__sub">{subline}</p> : null}
          </div>
        </header>
      ) : null}
      {skeleton ? <span className="den-stage__pennant"><span className="den-paperblock" /></span> : null}
      <ol className="den-floor" aria-label={label}>
        {slots.map((slot) => (
          <li key={slot.i} className={`den-slot${slot.kind === 'open' || slot.kind === 'yours' ? ' den-slot--seat' : ''}`} style={{ '--i': slot.i }}>
            {slot.kind === 'taken' ? (
              <>
                <span className="den-shadow" aria-hidden="true" />
                <FoldFigure fold={SILHOUETTE_FOLDS[slot.i % SILHOUETTE_FOLDS.length]} locked className="den-slot__fold" />
              </>
            ) : null}
            {slot.kind === 'you' ? (
              <>
                <span className="den-shadow" aria-hidden="true" />
                <FoldFigure key={fold} fold={fold} live index={slot.i} name={yourName} className={`den-slot__fold join-stage__you${swap ? ' join-stage__you--swap' : ''}`} />
                <span className="den-tag">{JoinCopy.you}</span>
              </>
            ) : null}
            {slot.kind === 'yours' ? (
              <>
                <span className="den-seat join-seat--yours" aria-hidden="true"><Plus size={18} aria-hidden="true" /></span>
                <span className="den-tag den-tag--seat join-seat__tag">{JoinCopy.yourSeat}</span>
              </>
            ) : null}
            {slot.kind === 'open' ? <span className="den-seat" aria-hidden="true"><Plus size={18} aria-hidden="true" /></span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default JoinStage;
