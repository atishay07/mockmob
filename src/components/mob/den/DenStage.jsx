"use client";
// The den's lamp-lit room on the web (MOB-BUILD-SPEC-V3 5.3 D1 to D6, 5.4 layers, 5.5 sizes, 5.6 M1).
// Layers, back to front: ground, the room art (scene-empty-nothing-{night,day}), the lamp light field, the floor fade,
// Fold shadows, Folds, name tags, the pennant and the shelf, stickers over the Folds. Cards and chrome belong to the page.
// D6 (skeleton): the same room, lamp, shelf and head at the same size, with paper blocks where the words, the chain chip
// and the pennant will be, and no Folds; `warm` skips the room's own entrance when the den replaces its skeleton, so the
// lamp never dips and the room never jumps (the Folds still rise in).
// Only transform and opacity animate (the light field's strength is an opacity too). Privacy (F2): nothing under a Fold
// but its name: no played tag, no dimmed Fold, no count.
import Link from 'next/link';
import { Plus, Settings } from 'lucide-react';
import { DenCopy, itemName } from '@/lib/mob/v3/denCopy.mjs';
import { FoldFigure } from './FoldFigure';
import { PaperSticker } from './Stickers';

const SHELF_ART = { den_stamp: '/mob/art/stamp-seal.webp', desk_bell: '/mob/art/hybrid-deskbell.webp', foil_seal: '/mob/art/foil-seal.webp' };

/** The Mob's pennant: paper on a string, the weeks figure, one cross-stitch per week along its foot (up to 5 drawn). */
export function Pennant({ weeks = 0, size = 64 }) {
  const w = size;
  const h = Math.round(size * 1.36);
  const stitches = Math.min(5, Math.max(0, weeks));
  return (
    <span className="den-pennant" style={{ width: w, height: h + 18 }} aria-hidden="true">
      <svg viewBox="0 0 64 105" width={w} height={h + 18} className="den-pennant__svg">
        <line x1="32" y1="0" x2="32" y2="14" className="den-pennant__string" />
        <circle cx="32" cy="2" r="2.2" className="den-pennant__pin" />
        <path d="M6 16 H50 L58 24 V80 L32 101 L6 80 Z" className="den-pennant__paper" />
        <path d="M50 16 L50 24 L58 24 Z" className="den-pennant__fold" />
        <path d="M10 20 H48.5 L54 25.5 V78 L32 96 L10 78 Z" className="den-pennant__seam" />
        {Array.from({ length: stitches }, (_, i) => {
          const x = 32 - ((stitches - 1) * 6) / 2 + i * 6;
          return <path key={i} d={`M${x - 2} 82 l4 4 M${x + 2} 82 l-4 4`} className="den-pennant__stitch" />;
        })}
      </svg>
      <span className="den-pennant__fig">{weeks}</span>
      <span className="den-pennant__word">{DenCopy.pennantWord(weeks)}</span>
    </span>
  );
}

function ShelfStrip({ items = [], next = null }) {
  const shown = items.slice(-3);
  return (
    <span className="den-shelf" aria-hidden="true">
      <span className="den-shelf__items">
        {shown.map((it) => <ShelfThing key={it} item={it} />)}
        {next ? <ShelfThing item={next.item} locked /> : null}
      </span>
      <span className="den-shelf__board" />
    </span>
  );
}

function ShelfThing({ item, locked = false }) {
  const src = SHELF_ART[item];
  if (!src) return <span className={`den-shelf__thing den-shelf__thing--paper${locked ? ' is-locked' : ''}`} title={itemName(item)} />;
  if (locked) return <span className="den-shelf__thing is-locked" style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="den-shelf__thing" src={src} alt="" width={28} height={28} decoding="async" />;
}

/**
 * v3: the server's den block, or null for the D0 preview (you and four dashed seats).
 * skeleton: D6 (the room and the lamp, no Folds, paper blocks for the words, the chip and the pennant). still: the
 * blocks do not pulse (the failed state). warm: the room was already on screen (its skeleton), so it does not rise again.
 * title, subtitle and the trailing chrome (chain chip, settings) sit over the room.
 * stickers: what shows over the Folds now, [{ id, memberId, kind, mode: 'rise' | 'landed', delay }], at most 3.
 */
export function DenStage({
  v3 = null, mobName = '', subtitle = '', you = null, previewFold = null, previewName = null, skeleton = false, still = false, warm = false,
  chainHref = null, mobChainHref = null, shelfHref = null, onSettings = null, onOpenSeat = null, stickers = [], onStickerDone = null, titleId = 'den-title',
}) {
  const members = v3?.members || (previewFold ? [{ memberId: 'preview', name: previewName || DenCopy.you, colour: 0, fold: previewFold, you: true }] : []);
  const size = members.length;
  const preview = !v3 && !skeleton;
  const seats = skeleton ? 0 : Math.max(0, 5 - size);
  const slots = [...members.map((m, i) => ({ m, i })), ...Array.from({ length: seats }, (_, k) => ({ seat: true, i: size + k }))];
  const one = size <= 1;
  const chip = v3?.chainChip;
  const weeks = v3?.mobChain?.weeks ?? 0;
  const onStage = new Map();
  for (const st of stickers) onStage.set(st.memberId, [...(onStage.get(st.memberId) || []), st]);
  // Spacing: when the slot to the left also holds a sticker (and stands at the usual height), this one stands higher on a
  // narrow stage (den.css), so neighbours never cover each other; a lone sticker always sits just over its Fold.
  const lifted = new Set();
  members.forEach((m, i) => { if (i > 0 && onStage.has(m.memberId) && onStage.has(members[i - 1].memberId) && !lifted.has(members[i - 1].memberId)) lifted.add(m.memberId); });
  const cls = `den-stage${skeleton ? ' den-stage--skeleton' : ''}${still ? ' den-stage--still' : ''}${warm ? ' den-stage--warm' : ''}${preview ? ' den-stage--preview' : ''}`;
  return (
    <div className={cls} data-count={Math.max(size, 1)} data-seats={seats} aria-hidden={skeleton || undefined}>
      <div className="den-room" aria-hidden="true">
        <span className="den-room__art den-room__art--night" />
        <span className="den-room__art den-room__art--day" />
        <span className="den-room__lamp" />
        <span className="den-room__floor" />
        <span className="den-room__scrim" />
      </div>

      {skeleton ? (
        <div className="den-stage__head">
          <div className="den-stage__title">
            <span className="den-skelbar den-skelbar--name" />
            <span className="den-skelbar den-skelbar--sub" />
          </div>
          <div className="den-stage__tools">
            <span className="den-skelbar den-skelbar--chip" />
            <span className="den-skelbar den-skelbar--tool" />
          </div>
        </div>
      ) : null}
      {!preview && !skeleton ? (
        <header className="den-stage__head">
          <div className="den-stage__title">
            <h2 id={titleId} className="den-stage__name">{mobName}</h2>
            {subtitle ? <p className="den-stage__sub">{subtitle}</p> : null}
          </div>
          <div className="den-stage__tools">
            {chip && !chip.hidden && chainHref ? (
              <Link className="den-chip" href={chainHref} aria-label={DenCopy.chainChipLabel(chip.days)}>
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" className="den-chip__icon"><path d="M8 12.5 6.6 13.9a2.6 2.6 0 0 1-3.7-3.7L5.4 7.7a2.6 2.6 0 0 1 3.7 0M12 7.5l1.4-1.4a2.6 2.6 0 0 1 3.7 3.7l-2.5 2.5a2.6 2.6 0 0 1-3.7 0M7.5 12.5l5-5" /></svg>
                <span className="den-chip__text">{DenCopy.chainChip(chip.days)}</span>
              </Link>
            ) : null}
            {onSettings ? (
              <button type="button" className="den-tool" aria-label={DenCopy.settings} onClick={onSettings}><Settings size={18} aria-hidden="true" /></button>
            ) : null}
          </div>
        </header>
      ) : null}

      {!preview && !skeleton ? (
        <>
          {mobChainHref ? (
            <Link className="den-stage__pennant" href={mobChainHref} aria-label={DenCopy.pennantLabel(weeks)}><Pennant weeks={weeks} /></Link>
          ) : <span className="den-stage__pennant"><Pennant weeks={weeks} /></span>}
          {shelfHref ? (
            <Link className="den-stage__shelf" href={shelfHref} aria-label={DenCopy.shelfLabel(mobName, v3?.shelf?.items || [], v3?.shelf?.nextItem)}>
              <ShelfStrip items={v3?.shelf?.items} next={v3?.shelf?.nextItem} />
            </Link>
          ) : null}
        </>
      ) : null}
      {skeleton ? (
        <>
          <span className="den-stage__pennant"><span className="den-paperblock" /></span>
          <span className="den-stage__shelf"><span className="den-shelf"><span className="den-shelf__items" /><span className="den-shelf__board" /></span></span>
        </>
      ) : null}

      <ol className="den-floor" aria-label={preview ? DenCopy.denPreviewLabel : undefined}>
        {slots.map((slot, k) => {
          if (slot.seat) {
            const caption = !one || k === size;
            return (
              <li key={`seat-${slot.i}`} className="den-slot den-slot--seat" style={{ '--i': slot.i }}>
                {onOpenSeat ? (
                  <button type="button" className="den-seat" onClick={onOpenSeat} aria-label={DenCopy.openSeat}><Plus size={18} aria-hidden="true" /></button>
                ) : <span className="den-seat" aria-hidden="true"><Plus size={18} aria-hidden="true" /></span>}
                {!preview && caption && !one ? <span className="den-tag den-tag--seat">{DenCopy.openSeat}</span> : null}
              </li>
            );
          }
          const { m, i } = slot;
          return (
            <li key={m.memberId} className="den-slot" style={{ '--i': i }} data-lift={lifted.has(m.memberId) || undefined}>
              {/* Where a sticker sits over this Fold: the flight lands on this point (bottom centre). */}
              <span className="den-sticker-anchor" data-member={m.memberId} aria-hidden="true" />
              {(onStage.get(m.memberId) || []).map((st) => (
                <span key={st.id} className={`den-sticker den-sticker--${st.mode}`} style={st.delay ? { '--delay': `${st.delay}ms` } : undefined}
                  onAnimationEnd={(e) => { if (e.animationName.startsWith('den-sticker-') && e.target === e.currentTarget) onStickerDone?.(st.id); }}>
                  <PaperSticker kind={st.kind} small />
                </span>
              ))}
              <span className="den-shadow" aria-hidden="true" />
              <FoldFigure fold={m.fold} name={m.name} colour={m.colour} live index={i} className="den-slot__fold" />
              <span className="den-tag">{m.you ? DenCopy.you : m.name}</span>
            </li>
          );
        })}
      </ol>
      {!preview && !skeleton && one ? <p className="den-stage__seats">{DenCopy.seatsOpen(seats)}</p> : null}
      {preview && you ? <span className="sr-only">{you}</span> : null}
    </div>
  );
}

export default DenStage;
