'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PipActor } from './PipActor';
import { stationIndex, clamp } from './pipJourney';
import { guideFacing, guidePose } from './pipIntent';
import { getMobiPrefs, initMobiPrefs } from '@/lib/mobiPrefs';
import { FOLLOW } from '@/lib/mobiMoments';
// The same acts as the app's table (lib/mobiMoments.js), with the app's lengths: a right answer is
// `correct` (a small hop), a wrong one is `encourage` (the warm pose and a head tilt, D38), a finished
// drill is `cheer` or `celebrate` by how it went. Reduced motion turns the guide off entirely.
const REACTIONS = {
  correct: { pose: 'celebrating', motion: 'hop', ms: 1150 },
  cheer: { pose: 'celebrating', motion: 'hop', ms: 1200 },
  celebrate: { pose: 'celebrating', motion: 'hop', ms: 2000 },
  encourage: { pose: 'encouraging', motion: 'tilt', ms: 1450 },
  eureka: { pose: 'celebrating', motion: 'jump', ms: 1900 },
  nod: { pose: null, motion: 'nod', ms: 800 },
};
// Celebrations setting: Quiet turns a celebration into a nod, Off plays nothing.
function calmMood(kind) {
  if (kind !== 'celebrate' && kind !== 'eureka' && kind !== 'cheer') return kind;
  const { celebrations } = getMobiPrefs();
  return celebrations === 'full' ? kind : celebrations === 'quiet' ? 'nod' : null;
}
// Where he looks. A mouse or pen pulls his eyes toward the pointer (and leans his head up to 2.6 degrees,
// --pip-follow) and lets go after 1.2 s, the app's FOLLOW (lib/mobiMoments.js); on a phone the scroll does, his
// eyes running ahead in the direction the page moves and settling 260 ms after it stops. The values (-1 to 1)
// are written only on the Mobis in view (the flyer, or the seats on screen), so the rest of the page never
// restyles. Off under Reduce motion, where the guide does not run at all.
const LOOK_VARS = ['--pip-look-x', '--pip-look-y', '--pip-follow'];
function setLook(nodes, x, y, follow = 0) {
  for (const node of nodes) {
    node.style.setProperty('--pip-look-x', x.toFixed(2));
    node.style.setProperty('--pip-look-y', y.toFixed(2));
    node.style.setProperty('--pip-follow', follow.toFixed(3));
  }
}
function clearLook(nodes) {
  for (const node of nodes) {
    for (const name of LOOK_VARS) node.style.removeProperty(name);
    delete node.dataset.pipLooking;
  }
}
// When the hero's headline changes its last line (HeroMorph, 'pip:glance'), the hero's Mobi looks at it: his eyes
// go to the line and his head dips toward it (about 3 degrees, 680 ms), then he looks back after 1.15 s unless a
// mouse has caught his eyes since. `node` carries the look variables, `head` turns (WAAPI, rotate only, so the
// CSS breath, float and acts on the other properties carry on).
const pointer = { at: 0 };
let glanceTimer = 0;
function glanceAt(node, head, target) {
  const t = target?.getBoundingClientRect();
  const box = node?.getBoundingClientRect();
  if (!t || !box?.width) return;
  const x = clamp(((t.left + t.right) / 2 - (box.left + box.width / 2)) / Math.max(160, box.width * 1.5), -1, 1);
  const y = clamp(((t.top + t.bottom) / 2 - (box.top + box.height * 0.4)) / Math.max(160, box.height * 1.5), -1, 1);
  const started = performance.now();
  setLook([node], x, y, 0);
  node.dataset.pipLooking = 'true';
  head?.animate?.([{ rotate: '0deg' }, { rotate: `${x < 0 ? -3 : 3}deg`, offset: 0.4 }, { rotate: '0deg' }], { duration: 680, easing: 'cubic-bezier(0.37, 0, 0.63, 1)' });
  clearTimeout(glanceTimer);
  glanceTimer = setTimeout(() => {
    if (pointer.at > started) return;
    setLook([node], 0, 0, 0);
    delete node.dataset.pipLooking;
  }, 1150);
}
function useLook(targets, enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    const inViewNow = targets.current;
    let raf = 0;
    let release = 0;
    let lastY = scrollY;
    let lastT = 0;
    const settle = (ms) => {
      clearTimeout(release);
      release = setTimeout(() => {
        const nodes = inViewNow();
        setLook(nodes, 0, 0, 0);
        nodes.forEach((n) => delete n.dataset.pipLooking);
      }, ms);
    };
    const onMove = (event) => {
      if (event.pointerType === 'touch' || raf) return;
      pointer.at = performance.now();
      const px = event.clientX;
      const py = event.clientY;
      raf = requestAnimationFrame(() => {
        raf = 0;
        for (const node of inViewNow()) {
          const box = node.getBoundingClientRect();
          if (!box.width) continue;
          const x = clamp((px - (box.left + box.width / 2)) / Math.max(240, innerWidth * 0.3), -1, 1);
          const y = clamp((py - (box.top + box.height * 0.4)) / Math.max(200, innerHeight * 0.35), -1, 1);
          setLook([node], x, y, clamp((px - innerWidth / 2) / (innerWidth * 0.35), -FOLLOW.clampX, FOLLOW.clampX));
          node.dataset.pipLooking = 'true';
        }
        settle(FOLLOW.releaseAfterMs);
      });
    };
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    const onScroll = () => {
      if (raf || fine.matches) return;
      raf = requestAnimationFrame((now) => {
        raf = 0;
        const dt = lastT ? Math.max(16, now - lastT) : 16;
        const v = clamp((scrollY - lastY) / dt / 1.4, -1, 1);
        lastY = scrollY;
        lastT = now;
        const nodes = inViewNow();
        setLook(nodes, 0, v * 0.9, 0);
        nodes.forEach((n) => { n.dataset.pipLooking = 'true'; });
        settle(260);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
      clearTimeout(release);
      clearLook(inViewNow());
    };
  }, [targets, enabled]);
}
/**
 * One Mobi in view (W-074), wherever the seats show their own figures (phones; any width under Reduce motion). Two
 * seats can share a screen (the Mistake Lab's and the Compass's on a phone), and the sample's own small Mobi can
 * share one with the hero's seat. Of the figures on screen the one most on screen stays and any other yields: its
 * figure fades out, its line stays, until it is the one most on screen. A challenger must be clearly bigger (by
 * 15%) to take over, so a slow scroll never flickers between two. `entered`: only seats whose Mobi has arrived count.
 */
function oneMobi(seats, { entered }) {
  const root = document.documentElement;
  let primary = null;
  let frame = 0;
  const drillFigures = () => [...document.querySelectorAll('.pip-drill-reaction, .pip-drill-result')].map((node) => ({ node, box: node.matches('.pip-drill-result') ? node : node.querySelector('.pip-image') }));
  const choose = () => {
    frame = 0;
    const all = [...seats.filter((seat) => !entered || seat.dataset.pipEnter).map((node) => ({ node, box: node.querySelector('.pip-seat__art') })), ...drillFigures()];
    // From the top of the window, not the site bar's foot: the bar is see-through, so a Mobi under it still shows.
    const shown = [];
    for (const f of all) {
      const r = f.box?.getBoundingClientRect();
      if (!r?.width) continue;
      const h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
      if (h > 0 && w > 0) shown.push({ ...f, area: h * w });
    }
    shown.sort((a, b) => b.area - a.area);
    const held = shown.find((f) => f.node === primary);
    if (!held || (shown[0].node !== primary && shown[0].area > held.area * 1.15)) primary = shown[0]?.node || null;
    for (const f of all) {
      if (f.node !== primary && shown.some((x) => x.node === f.node)) f.node.dataset.pipYield = 'true';
      else delete f.node.dataset.pipYield;
    }
  };
  const recheck = () => { if (!frame) frame = requestAnimationFrame(choose); };
  const drill = document.getElementById('try-practice');
  const changes = drill ? new MutationObserver(recheck) : null;
  changes?.observe(drill, { childList: true, subtree: true });
  root.dataset.pipOne = 'true';
  window.addEventListener('scroll', recheck, { passive: true });
  window.addEventListener('resize', recheck);
  recheck();
  return {
    recheck,
    dispose() {
      cancelAnimationFrame(frame);
      changes?.disconnect();
      window.removeEventListener('scroll', recheck);
      window.removeEventListener('resize', recheck);
      seats.forEach((seat) => delete seat.dataset.pipYield);
      drillFigures().forEach((f) => delete f.node.dataset.pipYield);
      delete root.dataset.pipOne;
    },
  };
}

/** One actor and one scheduled frame. The reserved desktop lane never covers the
 * reading canvas. Mobile arrivals stay within their own art box. */
export default function PipGuide() {
  const flyer = useRef(null);
  const peakPlayed = useRef(false);
  const [actor, setActor] = useState(null);
  const [running, setRunning] = useState(false);
  // The Mobis in view: the flyer while it flies (desktop), else the seats on screen (phones).
  const inView = useRef(new Set());
  const targets = useRef(() => (flyer.current && flyer.current.classList.contains('pip-guide-flyer') ? [flyer.current] : [...inView.current]));
  useLook(targets, running);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const root0 = document.documentElement;
    const desktop = matchMedia('(min-width: 1100px)');
    let dispose = () => {};
    function start() {
      dispose(); setActor(null); setRunning(false);
      // Reduce motion: no guide, every seat keeps its still pose, and still only one of them shows at a time.
      if (media.matches || root0.dataset.motion === 'reduced') {
        const one = oneMobi([...document.querySelectorAll('.pip-seat[data-pip-station]')], { entered: false });
        dispose = one.dispose;
        return;
      }
      const root = document.documentElement;
      // Static fallback opt-out also permits a layout-identical production cost baseline.
      if (root.hasAttribute('data-pip-static')) return;
      // Phones keep each character in its own reserved art box. No scroll tracking,
      // hidden fallback or delayed reaction from a section the reader has passed.
      if (!desktop.matches) {
        let timer = 0, count = 0;
        let activeSeat = null;
        const clear = () => {
          clearTimeout(timer); timer = 0;
          if (activeSeat) delete activeSeat.dataset.pipReacting;
          activeSeat = null; setActor(null);
        };
        const react = (event) => {
          const { station } = event.detail || {};
          const mood = calmMood(event.detail?.mood);
          if (!REACTIONS[mood] || document.hidden || (mood === 'eureka' && peakPlayed.current)) return;
          const id = station === 'lab' ? 'lab-inline' : station;
          const seat = document.querySelector(`[data-pip-station="${id}"]`);
          const host = seat?.querySelector('.pip-seat__art');
          if (!host || seat.dataset.pipYield) return;
          const box = host.getBoundingClientRect();
          const top = document.querySelector('.mm-nav')?.getBoundingClientRect().bottom || 0;
          const dock = document.querySelector('.mm-dock')?.getBoundingClientRect();
          const bottom = dock?.height ? Math.min(innerHeight, dock.top) : innerHeight;
          if (!box.height || box.top < top || box.bottom > bottom) return;
          if (station === 'lab' && mood === 'eureka' && document.querySelector('.ml')?.dataset.pipMove !== 'true') return;
          if (activeSeat === seat && timer) return;
          clear(); activeSeat = seat;
          seat.dataset.pipReacting = 'true';
          const reaction = REACTIONS[mood];
          if (mood === 'eureka') peakPlayed.current = true;
          setActor({ host, pose: reaction.pose || seat.dataset.pipPose, facing: seat.dataset.pipPose === 'pointing' ? 'left' : 'right', motion: `${reaction.motion}-${++count % 2}`, station: id });
          timer = setTimeout(clear, reaction.ms);
        };
        const visibility = () => { if (document.hidden) clear(); };
        // Arrival: each seat's Mobi hops in once (anticipation squash, hop, landing squash, settle) the first
        // time most of his seat is on screen; until then the seat keeps its space, empty. The hero's Mobi flies
        // in instead (brand-pip.css, Round 7). Seats on screen get the scroll look; a seat off screen pauses its
        // breath, float and blink (data-pip-off).
        const seats = [...document.querySelectorAll('.pip-seat[data-pip-station]')];
        let heroAt = 0;
        const arrive = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
              entry.target.dataset.pipEnter = 'true';
              if (entry.target.dataset.pipStation === 'hero') heroAt = performance.now();
              arrive.unobserve(entry.target);
              recheck();
            }
          }
        }, { threshold: [0, 0.55, 1] });
        const one = oneMobi(seats, { entered: true });
        const recheck = one.recheck;
        const watch = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            const art = entry.target.querySelector('.pip-seat__art');
            if (!art) continue;
            if (entry.isIntersecting) { inView.current.add(art); delete entry.target.dataset.pipOff; }
            else { inView.current.delete(art); clearLook([art]); entry.target.dataset.pipOff = 'true'; }
          }
          recheck();
        });
        // The headline changed: the hero's Mobi looks at it, once he has landed and waved, unless he is reacting.
        const glance = () => {
          const seat = document.querySelector('.pip-seat[data-pip-station="hero"]');
          const art = seat?.querySelector('.pip-seat__art');
          if (!art || !inView.current.has(art) || seat.dataset.pipYield || !heroAt || performance.now() - heroAt < 2600 || (activeSeat === seat && timer) || document.hidden) return;
          glanceAt(art, art.querySelector('.pip-rig__breath'), document.querySelector('.lp-morph'));
        };
        seats.forEach((seat) => { arrive.observe(seat); watch.observe(seat); });
        root.dataset.pipGuide = 'local';
        setRunning(true);
        window.addEventListener('pip:react', react);
        window.addEventListener('pip:glance', glance);
        document.addEventListener('visibilitychange', visibility);
        dispose = () => { clear(); arrive.disconnect(); watch.disconnect(); one.dispose(); clearLook([...inView.current]); inView.current.clear(); seats.forEach((seat) => { delete seat.dataset.pipEnter; delete seat.dataset.pipOff; }); delete root.dataset.pipGuide; window.removeEventListener('pip:react', react); window.removeEventListener('pip:glance', glance); document.removeEventListener('visibilitychange', visibility); };
        return;
      }
      const lab = document.querySelector('.ml');
      const stations = [...document.querySelectorAll('[data-pip-station]')].map(seat => ({
        seat, id:seat.dataset.pipStation, pose:seat.dataset.pipPose, art:seat.querySelector('.pip-seat__art'),
      })).filter(s=>s.art && s.art.getBoundingClientRect().height > 0);
      if (!stations.length) return;
      let raf=0,index=0,current=null,lastTime=0,disposed=false,arrivedAt=0;const greeted=new Set();
      let mood=null,reactionUntil=0,n=0;
      const pending=new Map();
      let activeId='',rendered='',previousY=scrollY,direction=1,visible=false,geometry=[],dirty=true,mainEnd=Infinity,awayId='',away=false;
      // A seat's place in the page is read from layout (offsetTop), not from its painted box: a seat inside a
      // Reveal (the close band's) is painted 1.5rem low until the band has risen in, and a transform ending fires
      // no resize, so the painted box left him standing that much low, his feet on his own line.
      const layoutTop=(el)=>{let y=0;for(let n=el;n;n=n.offsetParent)y+=n.offsetTop;return y;};
      function measure() {
        const wide=innerWidth>=1100;
        for (const s of stations) {
          s.seat.style.transform='none';
          if (wide) {
            const r=s.seat.getBoundingClientRect();
            s.seat.style.transform=`translateX(${innerWidth-174-r.left}px)`;
          }
        }
        geometry=stations.map(s=>{const r=s.art.getBoundingClientRect();return {x:r.left,y:layoutTop(s.art),w:r.width,h:r.height};});
        mainEnd=(document.querySelector('main')?.getBoundingClientRect().bottom || innerHeight)+scrollY;
        dirty=false;
      }
      const wake=()=>{if(!disposed && !raf && !document.hidden) raf=requestAnimationFrame(frame);};
      const resize=()=>{dirty=true;wake();};
      function frame(now) {
        raf=0;
        if(disposed || document.hidden) return;
        if(dirty) measure();
        const wide=innerWidth>=1100;
        const next=stationIndex(geometry.map(g=>g.y+g.h/2),scrollY+innerHeight*.43,index);
        direction=scrollY===previousY?direction:Math.sign(scrollY-previousY); previousY=scrollY;
        if(next!==index){index=next;mood=null;reactionUntil=0;}
        const s=stations[index],g=geometry[index],y=g.y-scrollY;
        const onScreen=y>=72 && y+g.h<=innerHeight-100;
        const target={x:g.x,y:wide?clamp(y,100,Math.max(100,innerHeight-g.h-110)):y,w:g.w,h:g.h};
        // Phone frames follow the document exactly; only an 8px local arrival eases.
        // Easing the viewport coordinate itself would trail fast scroll over controls.
        if(!wide && (!current || current.station!==s.id)) current={...target,arrival:direction*8,station:s.id};
        if(!current) current={...target,station:s.id};
        const elapsed=clamp(now-lastTime||16,1,40);lastTime=now;
        const slow=process.env.NODE_ENV!=='production'?Math.max(1,window.__pipSlow||1):1;
        const alpha=1-Math.exp(-elapsed/(65*slow));
        for(const key of ['x','y','w','h']) current[key]+=(target[key]-current[key])*alpha;
        if(!wide){current.arrival=(current.arrival||0)*(1-alpha);current.x=target.x;current.y=target.y+current.arrival;}
        current.station=s.id;
        const settled=Math.abs(current.y-target.y)<.5 && Math.abs(current.x-target.x)<.5;
        if(mood && now>=reactionUntil) mood=null;
        const queued=pending.get(s.id);
        const labMove=lab?.dataset.pipMove==='true';
        if(queued && settled && (wide||onScreen) && !mood && (queued!=='eureka'||labMove)) {
          if(queued!=='eureka'||!peakPlayed.current){mood=REACTIONS[queued];reactionUntil=now+mood.ms;n++;if(queued==='eureka')peakPlayed.current=true;}
          pending.delete(s.id);
        }
        const shown=(wide||onScreen) && scrollY < mainEnd-140;
        // His line stays under him while he stands on his seat. When he is held in the lane lower than his seat (the
        // seat has gone up past the top of the lane, or he is still catching up with the scroll), his feet would
        // stand on it, so it steps out until he is back on the seat (nothing overlaps).
        const off=wide && current.y-y>8;
        if(awayId!==s.id||away!==off){
          if(awayId&&awayId!==s.id) stations.find(x=>x.id===awayId)?.seat.removeAttribute('data-pip-away');
          if(off) s.seat.dataset.pipAway='true'; else s.seat.removeAttribute('data-pip-away');
          awayId=s.id;away=off;
        }
        if(activeId!==s.id||visible!==shown){root.dataset.pipPerch=s.id;root.dataset.pipPerchVisible=String(shown);activeId=s.id;visible=shown;window.dispatchEvent(new CustomEvent('pip:presence',{detail:{station:s.id,visible:shown}}));}
        // Small scroll corrections should not keep swapping the face. Only a
        // substantial journey between stations gets the neutral travelling pose.
        const poseSettled=Math.abs(current.y-target.y)<18 && Math.abs(current.x-target.x)<18;
        const pose=guidePose(s.pose,{settled:poseSettled,reactionPose:mood?.pose});
        const facing=guideFacing(current.x,current.w,innerWidth);
        // He arrives once (a hop in from below with squash and stretch), and the first time he settles at the
        // hero or the close he waves; at the lab he reads (brand-pip.css, data-station).
        if(shown && !arrivedAt) arrivedAt=now;
        const arriving=arrivedAt>0 && now-arrivedAt<900;
        if(!arriving && !mood && poseSettled && (s.id==='hero'||s.id==='close') && !greeted.has(s.id)){greeted.add(s.id);mood={pose:null,motion:'wave',ms:1400};reactionUntil=now+1400;n++;}
        // At the hero he flies in on a short arc and settles (Round 7); everywhere else he hops in.
        const motion=mood?`${mood.motion}-${n%2}`:arriving?(s.id==='hero'?'fly-0':'arrive-0'):'';
        const state=`${s.id}:${pose}:${facing}:${motion}:${n}`;
        if(state!==rendered){rendered=state;setActor({pose,facing,motion,station:s.id});}
        if(arriving && !arriveTimer) arriveTimer=setTimeout(()=>{arriveTimer=0;wake();},920);
        const node=flyer.current;
        if(node){
          // Uniform scale: pose imagery is always contained in the fixed-ratio frame.
          node.style.transform=`translate3d(${(current.x+(current.w-160*(current.h/180))/2).toFixed(2)}px,${current.y.toFixed(2)}px,0) scale(${(current.h/180).toFixed(4)})`;
          node.style.opacity=shown?'1':'0';node.dataset.pipShown=String(shown);node.dataset.scVerifyState=`${s.id}:${Math.round(current.y)}:${mood?.motion||'rest'}`;
        }
        if(!settled||!node)wake();
        // A timeout, not a running animation loop, clears a held reaction.
        if(mood && !reactionTimer) reactionTimer=setTimeout(()=>{reactionTimer=0;wake();},Math.max(1,reactionUntil-now));
      }
      let reactionTimer=0;
      let arriveTimer=0;
      // The headline changed: he looks at it from the lane, once he has flown in and waved, never mid-act.
      const glance=()=>{if(disposed||document.hidden||activeId!=='hero'||!visible||mood||!greeted.has('hero')||!flyer.current)return;glanceAt(flyer.current,flyer.current.querySelector('.pip-art-direction'),document.querySelector('.lp-morph'));};
      const react=e=>{const {station}=e.detail||{};const kind=calmMood(e.detail?.mood);if(!REACTIONS[kind]||(kind==='eureka'&&peakPlayed.current)||(kind==='nod'&&(mood||pending.get(station)==='eureka')))return;pending.set(station,kind);wake();};
      const observer=new ResizeObserver(resize);observer.observe(document.querySelector('main')||document.body);
      root.dataset.pipGuide='on';setRunning(true);
      window.addEventListener('scroll',wake,{passive:true});window.addEventListener('resize',resize);window.addEventListener('pip:react',react);window.addEventListener('pip:glance',glance);document.addEventListener('visibilitychange',wake);
      document.fonts.ready.then(()=>{if(!disposed)resize();});wake();
      dispose=()=>{disposed=true;cancelAnimationFrame(raf);clearTimeout(reactionTimer);clearTimeout(arriveTimer);observer.disconnect();window.removeEventListener('scroll',wake);window.removeEventListener('resize',resize);window.removeEventListener('pip:react',react);window.removeEventListener('pip:glance',glance);document.removeEventListener('visibilitychange',wake);stations.forEach(s=>{s.seat.style.removeProperty('transform');s.seat.removeAttribute('data-pip-away');});delete root.dataset.pipGuide;delete root.dataset.pipPerch;delete root.dataset.pipPerchVisible;};
    }
    initMobiPrefs();start();media.addEventListener('change',start);desktop.addEventListener('change',start);window.addEventListener('mm-prefs',start);return()=>{dispose();media.removeEventListener('change',start);desktop.removeEventListener('change',start);window.removeEventListener('mm-prefs',start);};
  },[]);
  return actor?createPortal(<span ref={flyer} className={actor.host ? 'pip-guide-local' : 'pip-guide-flyer'} aria-hidden="true"><PipActor pose={actor.pose} facing={actor.facing} motion={actor.motion} station={actor.station} alive/></span>,actor.host || document.body):null;
}
