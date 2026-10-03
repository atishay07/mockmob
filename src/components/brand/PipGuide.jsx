'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PipActor } from './PipActor';
import { stationIndex, clamp } from './pipJourney';
import { guideFacing, guidePose } from './pipIntent';
const REACTIONS = {
  celebrate: { pose: 'celebrating', motion: 'hop', ms: 1700 },
  encourage: { pose: 'attentive', motion: 'nod', ms: 650 },
  eureka: { pose: 'celebrating', motion: 'jump', ms: 1900 },
  nod: { pose: null, motion: 'nod', ms: 420 },
};
/** One actor and one scheduled frame. The reserved desktop lane never covers the
 * reading canvas. Mobile arrivals stay within their own art box. */
export default function PipGuide() {
  const flyer = useRef(null);
  const peakPlayed = useRef(false);
  const [actor, setActor] = useState(null);
  const [blink, setBlink] = useState(0);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let dispose = () => {};
    function start() {
      dispose(); setActor(null);
      if (media.matches) return;
      const root = document.documentElement;
      // Static fallback opt-out also permits a layout-identical production cost baseline.
      if (root.hasAttribute('data-pip-static')) return;
      const lab = document.querySelector('.ml');
      const stations = [...document.querySelectorAll('[data-pip-station]')].map(seat => ({
        seat, id:seat.dataset.pipStation, pose:seat.dataset.pipPose, art:seat.querySelector('.pip-seat__art'),
      })).filter(s=>s.art);
      if (!stations.length) return;
      let raf=0,index=0,current=null,lastTime=0,disposed=false;
      let mood=null,reactionUntil=0,n=0;
      const pending=new Map();
      let activeId='',rendered='',previousY=scrollY,direction=1,visible=false,geometry=[],dirty=true,mainEnd=Infinity;
      function measure() {
        const wide=innerWidth>=1100;
        for (const s of stations) {
          s.seat.style.transform='none';
          if (wide) {
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
        const shown=(wide||onScreen) && scrollY < mainEnd-140;
        if(activeId!==s.id||visible!==shown){root.dataset.pipPerch=s.id;root.dataset.pipPerchVisible=String(shown);activeId=s.id;visible=shown;window.dispatchEvent(new CustomEvent('pip:presence',{detail:{station:s.id,visible:shown}}));}
        // Small scroll corrections should not keep swapping the face. Only a
        // substantial journey between stations gets the neutral travelling pose.
        const poseSettled=Math.abs(current.y-target.y)<18 && Math.abs(current.x-target.x)<18;
        const pose=guidePose(s.pose,{settled:poseSettled,reactionPose:mood?.pose});
        const facing=guideFacing(current.x,current.w,innerWidth);
        const state=`${s.id}:${pose}:${facing}:${mood?.motion||''}:${n}`;
        if(state!==rendered){rendered=state;setActor({pose,facing,motion:mood?`${mood.motion}-${n%2}`:''});}
        const node=flyer.current;
        if(node){
          // Uniform scale: pose imagery is always contained in the fixed-ratio frame.
          node.style.transform=`translate3d(${(current.x+(current.w-160*(current.h/180))/2).toFixed(2)}px,${current.y.toFixed(2)}px,0) scale(${(current.h/180).toFixed(4)})`;
          node.style.opacity=shown?'1':'0';node.dataset.scVerifyState=`${s.id}:${Math.round(current.y)}:${mood?.motion||'rest'}`;
        }
        if(!settled||!node)wake();
        // A timeout, not a running animation loop, clears a held reaction.
        if(mood && !reactionTimer) reactionTimer=setTimeout(()=>{reactionTimer=0;wake();},Math.max(1,reactionUntil-now));
      }
      let reactionTimer=0;
      const blinkTimer=setInterval(()=>{if(!document.hidden && visible)setBlink(b=>b+1);},5400);
      const react=e=>{const {station,mood:kind}=e.detail||{};if(!REACTIONS[kind]||(kind==='eureka'&&peakPlayed.current)||(kind==='nod'&&(mood||pending.get(station)==='eureka')))return;pending.set(station,kind);wake();};
      const observer=new ResizeObserver(resize);observer.observe(document.querySelector('main')||document.body);
      root.dataset.pipGuide='on';
      window.addEventListener('scroll',wake,{passive:true});window.addEventListener('resize',resize);window.addEventListener('pip:react',react);document.addEventListener('visibilitychange',wake);
      document.fonts.ready.then(()=>{if(!disposed)resize();});wake();
      dispose=()=>{disposed=true;cancelAnimationFrame(raf);clearTimeout(reactionTimer);clearInterval(blinkTimer);observer.disconnect();window.removeEventListener('scroll',wake);window.removeEventListener('resize',resize);window.removeEventListener('pip:react',react);document.removeEventListener('visibilitychange',wake);stations.forEach(s=>s.seat.style.removeProperty('transform'));delete root.dataset.pipGuide;delete root.dataset.pipPerch;delete root.dataset.pipPerchVisible;};
    }
    start();media.addEventListener('change',start);return()=>{dispose();media.removeEventListener('change',start);};
  },[]);
  return actor?createPortal(<span ref={flyer} className="pip-guide-flyer" aria-hidden="true"><PipActor pose={actor.pose} facing={actor.facing} motion={actor.motion} blink={blink}/></span>,document.body):null;
}
