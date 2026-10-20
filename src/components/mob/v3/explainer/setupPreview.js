// The den above the setup, changing as the student answers (the prototype's setPreviewBuild and setPreviewUpdate): the
// room, four open seats, the pennant that takes the Mob's name and then its subject, the Fold that hops into the centre
// seat and cheers, and the name tag that takes the name and colour typed below. Decorative (aria-hidden): every answer is
// also on the step itself.
import { MOB_NAMES, validNameKey } from '../../../../lib/mob/names.mjs';
import { SETUP_COPY } from './explainerModel.mjs';
import { ART, E, TL, fold, h, icon, img, motionKit } from './motion';

export function buildSetupPreview(el, { reduced = false } = {}) {
  el.innerHTML = '';
  const H = 184;
  const sc = h('div', { class: 'mx-scene' }, [img(ART.sceneNight, 'mx-night', 'object-position:58% 66%'), img(ART.sceneDay, 'mx-day', 'object-position:58% 66%')]);
  el.append(sc);
  el.append(h('div', { class: 'mx-pool', style: `left:30px;top:${H - 98}px;width:300px;height:90px` }));
  el.append(h('div', { class: 'mx-stage-fade', style: 'height:44px' }));
  for (const x of [44, 104, 256, 316]) el.append(h('div', { class: 'mx-seat', style: `left:${x - 20}px;top:${H - 80}px;width:40px;height:52px` }, [icon('plus', 16)]));
  const holder = h('div', { class: 'mx-abs', style: 'inset:0' }); el.append(holder);
  const pen = h('div', { class: 'mx-ppen' });
  const cloth = h('div', { class: 'mx-pennant__cloth mx-grain' });
  const pn = h('div', { class: 'mx-ppen__name' }); const ps = h('div', { class: 'mx-ppen__sub' });
  cloth.append(pn, ps); pen.append(h('div', { class: 'mx-pennant__rod' }), cloth); el.append(pen);
  const nameTag = h('div', { class: 'mx-nametag', style: `left:180px;top:${H - 24}px` }); el.append(nameTag);
  const K = motionKit({ rm: reduced });
  let f = null; let tl = null; const tls = new Set();
  const state = { fold: undefined, name: undefined, sub: undefined };

  function update(st, { subjectName = '', showSubject = false, onYou = false, first = false } = {}) {
    const want = st.fold || null;
    if ((f?.key || null) !== want) {
      const old = f;
      if (old) {
        const a = old.root.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(6px) scale(.96)' }], { duration: reduced ? 120 : 160, easing: E.leave, fill: 'forwards' });
        a.onfinish = () => old.root.remove();
      }
      if (tl) { tl.kill(); tls.delete(tl); tl = null; }
      if (want) {
        f = fold(want, { x: 180, base: H - 26, size: 86, poses: ['cheer'] }); holder.append(f.root);
        tl = new TL(); tls.add(tl);
        if (!reduced) { K.hopIn(tl, f, 60, 26); K.poseTo(tl, f, 'cheer', 520); K.poseTo(tl, f, 'idle', 1300); K.idle(tl, f, 1400, 4); } else K.fadeIn(tl, f.root, 0);
        tl.play();
      } else f = null;
    }
    const named = validNameKey(st.nameKey);
    const nm = named ? MOB_NAMES[st.nameKey] : SETUP_COPY.previewName;
    if (state.name !== nm) {
      pn.textContent = nm; pn.classList.toggle('is-empty', !named);
      if (state.name !== undefined && !first && !reduced && named) {
        pn.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 280, easing: E.out });
        pen.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(-1.5deg)' }, { transform: 'rotate(0)' }], { duration: 700, easing: E.out });
      }
      state.name = nm;
    }
    const sub = showSubject ? subjectName : '';
    if (state.sub !== sub) {
      ps.textContent = sub;
      if (state.sub !== undefined && !first && !reduced && sub) ps.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: E.out });
      state.sub = sub;
    }
    const showName = Boolean(want) && onYou;
    nameTag.textContent = showName ? (String(st.name || '').trim() || SETUP_COPY.you) : want ? SETUP_COPY.you : SETUP_COPY.pickAFold;
    nameTag.classList.toggle('is-named', showName);
    nameTag.classList.toggle('is-you', Boolean(want) && !showName);
    nameTag.dataset.colour = String(st.colour ?? 0);
  }
  return { update, destroy() { for (const t of tls) t.kill(); tls.clear(); el.innerHTML = ''; } };
}
