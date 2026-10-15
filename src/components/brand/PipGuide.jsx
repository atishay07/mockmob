'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PipActor } from './PipActor';
import { stationIndex, clamp } from './pipJourney';
import { guideFacing, guidePose } from './pipIntent';
import { getMobiPrefs, initMobiPrefs } from '@/lib/mobiPrefs';
import { FOLLOW } from '@/lib/mobiMoments';
// The same acts as the app's table (lib/mobiMoments.js), with the app's lengths: a right answer is
// `correct` (a small hop), a wrong one is `encourage` (the warm pose and a lean in), a finished
// drill is `cheer` or `celebrate` by how it went. Reduced motion turns the guide off entirely.
const REACTIONS = {
  correct: { pose: 'celebrating', motion: 'hop', ms: 1150 },
  cheer: { pose: 'celebrating', motion: 'hop', ms: 1200 },
  celebrate: { pose: 'celebrating', motion: 'hop', ms: 2000 },
  encourage: { pose: 'encouraging', motion: 'nod', ms: 1450 },
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
    // His idle life (breath, blinks, the reading glance) runs only where he can be seen: a seat off screen is
    // marked data-pip-off and brand-pip.css pauses its loops; the flyer is marked the same while it is hidden.
    let idle = null;
    const watchIdle = () => {
      idle?.disconnect();
      idle = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) delete entry.target.dataset.pipOff; else entry.target.dataset.pipOff = 'true';
        }
      });
      document.querySelectorAll('.pip-seat').forEach((seat) => idle?.observe(seat));
    };
    function start() {
      dispose(); setActor(null); setRunning(false);
      watchIdle();
      if (media.matches || root0.dataset.motion === 'reduced') return;
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
          if (!host) return;
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
        // time most of his seat is on screen; until then the seat keeps its space, empty. Seats on screen get
        // the scroll look.
        const seats = [...document.querySelectorAll('.pip-seat[data-pip-station]')];
        const arrive = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.55) { entry.target.dataset.pipEnter = 'true'; arrive.unobserve(entry.target); }
          }
        }, { threshold: [0, 0.55, 1] });
        const watch = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            const art = entry.target.querySelector('.pip-seat__art');
            if (!art) continue;
            if (entry.isIntersecting) inView.current.add(art);
            else { inView.current.delete(art); clearLook([art]); }
          }
        });
        seats.forEach((seat) => { arrive.observe(seat); watch.observe(seat); });
        root.dataset.pipGuide = 'local';
        setRunning(true);
        window.addEventListener('pip:react', react);
        document.addEventListener('visibilitychange', visibility);
        dispose = () => { clear(); arrive.disconnect(); watch.disconnect(); clearLook([...inView.current]); inView.current.clear(); seats.forEach((seat) => delete seat.dataset.pipEnter); delete root.dataset.pipGuide; window.removeEventListener('pip:react', react); document.removeEventListener('visibilitychange', visibility); };
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
      let activeId='',rendered='',previousY=scrollY,direction=1,visible=false,geometry=[],dirty=true,mainEnd=Infinity;
      function measure() {
        const wide=innerWidth>=1100;
        for (const s of stations) {
          s.seat.style.transform='none';
          // The close seat is his last stop: he lands on it, standing over the close's own key, not in a lane.
          if (wide && s.id!=='close') {
            const r=s.seat.getBoundingClientRect();
            s.seat.style.transform=`translateX(${innerWidth-174-r.left}px)`;
          }
        }
        geometry=stations.map(s=>{const r=s.art.getBoundingClientRect();return {x:r.left,y:r.top+scrollY,w:r.width,h:r.height};});
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
        // He no longer rides the right-hand lane down the whole page: on wide screens he shows only while the
        // seat he is headed for is in the window (the sample card at the top, then the close), and stays out of
        // every section in between.
        const near=y<innerHeight && y+g.h>0;
        const shown=(wide?near:onScreen) && scrollY < mainEnd-140;
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
        const motion=mood?`${mood.motion}-${n%2}`:arriving?'arrive-0':'';
        const state=`${s.id}:${pose}:${facing}:${motion}:${n}`;
        if(state!==rendered){rendered=state;setActor({pose,facing,motion,station:s.id});}
        if(arriving && !arriveTimer) arriveTimer=setTimeout(()=>{arriveTimer=0;wake();},920);
        const node=flyer.current;
        if(node){
          // Uniform scale: pose imagery is always contained in the fixed-ratio frame.
          node.style.transform=`translate3d(${(current.x+(current.w-160*(current.h/180))/2).toFixed(2)}px,${current.y.toFixed(2)}px,0) scale(${(current.h/180).toFixed(4)})`;
          node.style.opacity=shown?'1':'0';if(shown)delete node.dataset.pipOff;else node.dataset.pipOff='true';node.dataset.scVerifyState=`${s.id}:${Math.round(current.y)}:${mood?.motion||'rest'}`;
        }
        if(!settled||!node)wake();
        // A timeout, not a running animation loop, clears a held reaction.
        if(mood && !reactionTimer) reactionTimer=setTimeout(()=>{reactionTimer=0;wake();},Math.max(1,reactionUntil-now));
      }
      let reactionTimer=0;
      let arriveTimer=0;
      const react=e=>{const {station}=e.detail||{};const kind=calmMood(e.detail?.mood);if(!REACTIONS[kind]||(kind==='eureka'&&peakPlayed.current)||(kind==='nod'&&(mood||pending.get(station)==='eureka')))return;pending.set(station,kind);wake();};
      const observer=new ResizeObserver(resize);observer.observe(document.querySelector('main')||document.body);
      root.dataset.pipGuide='on';setRunning(true);
      window.addEventListener('scroll',wake,{passive:true});window.addEventListener('resize',resize);window.addEventListener('pip:react',react);document.addEventListener('visibilitychange',wake);
      document.fonts.ready.then(()=>{if(!disposed)resize();});wake();
      dispose=()=>{disposed=true;cancelAnimationFrame(raf);clearTimeout(reactionTimer);clearTimeout(arriveTimer);observer.disconnect();window.removeEventListener('scroll',wake);window.removeEventListener('resize',resize);window.removeEventListener('pip:react',react);document.removeEventListener('visibilitychange',wake);stations.forEach(s=>s.seat.style.removeProperty('transform'));delete root.dataset.pipGuide;delete root.dataset.pipPerch;delete root.dataset.pipPerchVisible;};
    }
    initMobiPrefs();start();media.addEventListener('change',start);desktop.addEventListener('change',start);window.addEventListener('mm-prefs',start);return()=>{dispose();idle?.disconnect();media.removeEventListener('change',start);desktop.removeEventListener('change',start);window.removeEventListener('mm-prefs',start);};
  },[]);
  return actor?createPortal(<span ref={flyer} className={actor.host ? 'pip-guide-local' : 'pip-guide-flyer'} aria-hidden="true"><PipActor pose={actor.pose} facing={actor.facing} motion={actor.motion} station={actor.station} alive/></span>,actor.host || document.body):null;
}
