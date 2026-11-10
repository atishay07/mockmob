'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Maximize2, Minimize2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { FILM, chapterAt, pickSource } from './heroFilmConfig.mjs';

export { FILM };

// The home hero's film. Round 7 (owner, 7 Nov 2026: "the promo video playing as the main hero", like klayprep.com) put the
// launch teaser here; round 9 (owner, 9 Nov 2026: "the main walkthrough video of the platform ... highly converting")
// plays the narrated walkthrough (Hero16 r4): muted first, nine chapters: the opening, seven numbered features, sign up.
//   - The poster (the film's "Preparing for CUET 2027?" frame) is drawn first in a fixed 16:9 frame, so nothing shifts;
//     it is the hero's largest paint on desktop, so it asks for high priority.
//   - The film's file is picked on mount by the frame's rendered width in device pixels (heroFilmConfig pickSource; Data
//     Saver takes 480p) and nothing is fetched until it plays (preload none). It plays by itself only after the page's
//     load event, only while at least half of the picture is on screen, and pauses when it leaves or the tab hides.
//   - It never plays by itself under Reduce motion (the system's or the site's own, html[data-motion='reduced']) or Data
//     Saver: then a round Play key sits on the poster.
//   - Nothing else is drawn on the picture: a tap or click on it pauses or plays (pointer; keyboards use the keys). Under
//     the frame, one row: the pause/play key, the chapter bar (one segment per chapter: it seeks to that chapter and
//     plays; the current one fills as it plays; arrow keys move between them), the current chapter's name, the sound key,
//     the full-screen key.
//   - The first time sound comes on (the corner "Sound on", the sound key, or full screen), the film starts again from its
//     first frame, so the narrator is heard from his first line (round 12, owner 10 Nov 2026: "Whenever someone turns the
//     sound on for the first time, it should play from the start"). After that the sound key only mutes and unmutes.
//   - Full screen (owner, 9 Nov 2026, the share-link prototype; round 12, 10 Nov 2026: "Implement that also right now"): the
//     key after the sound key puts the film's frame full screen (the Fullscreen API, webkit-prefixed where needed; an iPhone,
//     where only a video can go full screen, opens its own player), letterboxed on black, with the browser's own controls
//     (sound, time) while it lasts and a "Leave full screen" key in its corner; a phone may turn sideways. Asking for full
//     screen means "I'm watching": the first time with sound still off, sound comes on from the start, as above. Leaving it
//     (the key, Escape, a phone's back gesture) returns to the page as it was, the film playing as it was set; what is drawn
//     follows the browser's fullscreenchange event. Where neither API exists the key is not drawn. On phones the row has no
//     room for a fourth 44 px key beside nine 24 px chapters (hero-film.css), so there it sits in the picture's top corner.
//   - The fill moves only while the film plays and is on screen (one animation frame at a time; under Reduce motion it
//     steps with the film's own time updates). Paused, nothing runs.

// No autoplay: Reduce motion (system or the site's switch) or Data Saver.
function stillOnly() {
  try {
    if (document.documentElement.getAttribute('data-motion') === 'reduced') return true;
    if (navigator.connection?.saveData === true) return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

// Reduce motion alone (the fill steps instead of gliding).
function reducedMotion() {
  try {
    return document.documentElement.getAttribute('data-motion') === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

// Full screen: the element API where there is one (desktop, Android, iPad); an iPhone has only the video's own player.
function fullscreenNow() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}
function canFullscreen() {
  try {
    const element = Boolean((document.fullscreenEnabled || document.webkitFullscreenEnabled)
      && (Element.prototype.requestFullscreen || Element.prototype.webkitRequestFullscreen));
    return element || typeof HTMLVideoElement.prototype.webkitEnterFullscreen === 'function';
  } catch {
    return false;
  }
}
const noSubscribe = () => () => {};
// Drawn on the server (nearly every browser has one or the other, so nothing shifts there); gone after hydration where not.
const drawnOnServer = () => true;

const COUNT = FILM.chapters.length;

export default function HeroFilm() {
  const frameRef = useRef(null);
  const videoRef = useRef(null);
  const barRef = useRef(null);
  const segRefs = useRef([]);
  // Whether the film should be playing while it is on screen: true by default unless autoplay is off; a reader's own
  // Play or Pause sets it.
  const wantPlay = useRef(false);
  const inView = useRef(false);
  // A chapter chosen before the film's length is known: applied once it is.
  const pendingSeek = useRef(null);
  const chapterRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  // The round Play key on the poster: autoplay is off here, or the browser refused to start the film.
  const [needsTap, setNeedsTap] = useState(false);
  const [chapter, setChapter] = useState(0);
  // The film is narrated: until sound has come on once, a small "Sound on" key sits in the picture's corner.
  const heardOnce = useRef(false);
  const [heard, setHeard] = useState(false);
  // Full screen: whether the frame (or an iPhone's player) is full screen now, as the browser's events say.
  const [full, setFull] = useState(false);
  const canFull = useSyncExternalStore(noSubscribe, canFullscreen, drawnOnServer);

  const start = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const run = video.play();
    if (run && typeof run.catch === 'function') {
      run.catch(() => {
        wantPlay.current = false;
        setNeedsTap(true);
      });
    }
  }, []);

  // Where the film is: the current chapter (a render only when it changes) and its fill (one custom property).
  const paint = useCallback(() => {
    const video = videoRef.current;
    const bar = barRef.current;
    if (!video || !bar || pendingSeek.current !== null) return;
    const { index, share } = chapterAt(video.currentTime, video.duration, FILM.chapters);
    bar.style.setProperty('--p', share.toFixed(4));
    if (index !== chapterRef.current) {
      chapterRef.current = index;
      setChapter(index);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame) return undefined;
    video.muted = true;
    video.src = pickSource(frame.getBoundingClientRect().width, window.devicePixelRatio, navigator.connection?.saveData === true);
    // Autoplay off here (Reduce motion or Data Saver): the round Play key shows on the poster whenever the film is paused.
    let autoOff = stillOnly();
    wantPlay.current = !autoOff;
    // It first plays by itself only once the page has loaded, so its file never competes with the first paint; a reader's
    // own Play works at once.
    let loaded = document.readyState === 'complete';

    const sync = () => {
      if (inView.current && !document.hidden && wantPlay.current && loaded) start();
      else if (!video.paused && (!inView.current || document.hidden)) video.pause();
    };
    const onLoad = () => { loaded = true; sync(); };
    if (!loaded) window.addEventListener('load', onLoad, { once: true });
    let io = null;
    if (typeof IntersectionObserver === 'undefined') {
      inView.current = true;
    } else {
      io = new IntersectionObserver((entries) => {
        const entry = entries[entries.length - 1];
        inView.current = entry.isIntersecting && entry.intersectionRatio >= FILM.visibleShare;
        if (autoOff && video.paused) setNeedsTap(true);
        sync();
      }, { threshold: [0, FILM.visibleShare, 1] });
      io.observe(frame);
    }
    // Reduce motion or Data Saver switched on while it plays by itself: it stops and waits for a tap.
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPrefs = () => {
      if (!stillOnly()) return;
      autoOff = true;
      wantPlay.current = false;
      if (!video.paused) video.pause();
      setNeedsTap(true);
    };

    // The fill: one frame at a time while it plays and is on screen; it stops itself when the film pauses or leaves.
    let raf = 0;
    const tick = () => {
      raf = 0;
      paint();
      if (!video.paused && !video.ended && inView.current && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const run = () => { if (!raf && !reducedMotion()) raf = requestAnimationFrame(tick); };
    const halt = () => { if (raf) cancelAnimationFrame(raf); raf = 0; paint(); };
    // Under Reduce motion the fill steps with the film's own time updates (they stop when it pauses).
    const onTime = () => { if (reducedMotion()) paint(); };
    const onMeta = () => {
      if (pendingSeek.current === null) return;
      const at = pendingSeek.current;
      pendingSeek.current = null;
      video.currentTime = at;
    };

    motion.addEventListener?.('change', onPrefs);
    window.addEventListener('mm-prefs', onPrefs);
    document.addEventListener('visibilitychange', sync);
    video.addEventListener('playing', run);
    video.addEventListener('pause', halt);
    video.addEventListener('seeked', paint);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    if (!io) sync();
    return () => {
      io?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      motion.removeEventListener?.('change', onPrefs);
      window.removeEventListener('mm-prefs', onPrefs);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('load', onLoad);
      video.removeEventListener('playing', run);
      video.removeEventListener('pause', halt);
      video.removeEventListener('seeked', paint);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.pause();
    };
  }, [start, paint]);

  const play = useCallback(() => {
    wantPlay.current = true;
    setNeedsTap(false);
    start();
  }, [start]);
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) play();
    else {
      wantPlay.current = false;
      video.pause();
    }
  };
  // A chapter's segment: to its first frame, and play.
  const seek = (index) => {
    const video = videoRef.current;
    if (!video) return;
    const at = FILM.chapters[index].start;
    chapterRef.current = index;
    setChapter(index);
    barRef.current?.style.setProperty('--p', '0');
    if (video.readyState >= 1) {
      pendingSeek.current = null;
      video.currentTime = at;
    } else pendingSeek.current = at;
    play();
  };
  // Sound on unmutes and plays. The first time sound comes on, the film starts again from its first frame (time 0, the
  // first chapter), so the narrator is heard from his first line; after that it only unmutes where the film is.
  const soundUp = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setSoundOn(true);
    if (!heardOnce.current) {
      heardOnce.current = true;
      setHeard(true);
      seek(0);
      return;
    }
    if (video.paused) play();
  };
  // Sound off only mutes, where the film is.
  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted) soundUp();
    else {
      video.muted = true;
      setSoundOn(false);
    }
  };
  // Full screen on, or off. Asking for it means "I'm watching": the first time with sound still off, sound comes on and the
  // film starts from its first frame (soundUp); otherwise sound stays as it was set and the film plays.
  const toggleFull = () => {
    const frame = frameRef.current;
    const video = videoRef.current;
    if (!frame || !video) return;
    if (fullscreenNow()) {
      const leave = document.exitFullscreen || document.webkitExitFullscreen;
      try { Promise.resolve(leave?.call(document)).catch(() => {}); } catch { /* already out */ }
      return;
    }
    const watch = () => { if (!heardOnce.current) soundUp(); else if (video.paused) play(); };
    const enter = frame.requestFullscreen || frame.webkitRequestFullscreen;
    if (enter && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
      let asked;
      try { asked = enter.call(frame, { navigationUI: 'hide' }); } catch { asked = Promise.reject(); }
      Promise.resolve(asked)
        .then(() => {
          // A phone turns sideways for the film where the browser allows it (Android in full screen); never a failure.
          if (!window.matchMedia('(pointer: coarse)').matches) return;
          try { screen.orientation?.lock?.('landscape')?.catch?.(() => {}); } catch { /* not allowed here */ }
        })
        .catch(() => {});
      watch();
    } else if (typeof video.webkitEnterFullscreen === 'function') {
      // iPhone: its own player (its own controls; it turns with the phone).
      watch();
      try { video.webkitEnterFullscreen(); } catch { /* not ready yet: the film plays in place, with sound */ }
    }
  };
  // What is drawn follows the browser: the frame is full screen or it is not (the key, Escape or a back gesture left it).
  useEffect(() => {
    const frame = frameRef.current;
    const video = videoRef.current;
    if (!frame || !video) return undefined;
    const onChange = () => {
      const on = fullscreenNow() === frame;
      // The browser's own controls (sound, time) only while the frame is full screen; without a full-screen button of their
      // own (controlsList="nofullscreen"), since the frame already is.
      // (A sideways lock ends by itself when the document leaves full screen: the Screen Orientation spec.)
      video.controls = on;
      setFull(on);
    };
    const onBegin = () => setFull(true);
    const onEnd = () => setFull(false);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    video.addEventListener('webkitbeginfullscreen', onBegin);
    video.addEventListener('webkitendfullscreen', onEnd);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      video.removeEventListener('webkitbeginfullscreen', onBegin);
      video.removeEventListener('webkitendfullscreen', onEnd);
    };
  }, []);
  // The chapter bar is one stop for Tab; the arrow keys, Home and End move between its segments.
  const onBarKey = (event) => {
    const from = Number(event.target?.dataset?.index);
    if (!Number.isInteger(from)) return;
    const to = { ArrowRight: from + 1, ArrowLeft: from - 1, Home: 0, End: COUNT - 1 }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    segRefs.current[Math.min(COUNT - 1, Math.max(0, to))]?.focus();
  };

  const current = FILM.chapters[chapter];
  return (
    <figure className="lp-film" aria-label={FILM.label} data-playing={playing ? 'true' : 'false'}>
      {/* A tap or click on the picture pauses or plays (a pointer's shortcut; the keys under it do the same for keyboards).
          In full screen the browser's own controls take taps on the film, so the frame leaves them alone. */}
      <div ref={frameRef} className="lp-film__frame" onClick={full ? undefined : togglePlay}>
        {/* The film's own first frame, the same file as the video's poster, so it is fetched once. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- one fixed poster under 60 KB, shared with the video's poster attribute */}
        <img className="lp-film__poster" src={FILM.poster} width={FILM.width} height={FILM.height} alt="" fetchPriority="high" decoding="async" draggable={false} />
        <video
          ref={videoRef}
          className="lp-film__video"
          muted
          playsInline
          loop
          preload="none"
          poster={FILM.poster}
          width={FILM.width}
          height={FILM.height}
          controlsList="nofullscreen"
          onPlay={() => { setPlaying(true); setNeedsTap(false); }}
          onPause={() => setPlaying(false)}
          onVolumeChange={(event) => setSoundOn(!event.currentTarget.muted)}
        />
        {needsTap && !playing ? (
          // A large pointer target on the poster; keyboards and screen readers use the "Play film" key under it.
          <button type="button" className="lp-film__start" onClick={(event) => { event.stopPropagation(); play(); }} tabIndex={-1} aria-hidden="true">
            <Play size={24} strokeWidth={2.25} aria-hidden="true" />
          </button>
        ) : null}
        {!heard && !needsTap ? (
          // The narrator is muted by default: one small key in the corner until sound has come on once (keyboards and
          // screen readers use the sound key under the frame).
          <button type="button" className="lp-film__unmute" onClick={(event) => { event.stopPropagation(); toggleSound(); }} tabIndex={-1} aria-hidden="true">
            <VolumeX size={16} strokeWidth={2.25} aria-hidden="true" />
            <span>Sound on</span>
          </button>
        ) : null}
        {full ? (
          // In full screen the row under the frame is out of sight: the way back is a key in the picture's corner (Escape and
          // a phone's back gesture work too).
          <button type="button" className="lp-film__leave" onClick={(event) => { event.stopPropagation(); toggleFull(); }} aria-label="Leave full screen">
            <Minimize2 size={18} strokeWidth={2.25} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="lp-film__keys">
        <button type="button" className="lp-film__key" onClick={togglePlay} aria-label={playing ? 'Pause film' : 'Play film'}>
          {playing ? <Pause size={20} strokeWidth={2} aria-hidden="true" /> : <Play size={20} strokeWidth={2} aria-hidden="true" />}
        </button>
        <div className="lp-film__track">
          <p className="lp-film__now"><span className="lp-sr">{`Chapter ${chapter + 1} of ${COUNT}: `}</span>{current.name}</p>
          <div ref={barRef} className="lp-film__chapters" role="toolbar" aria-label="Chapters" onKeyDown={onBarKey}>
            {FILM.chapters.map((c, i) => (
              <button
                key={c.id}
                ref={(el) => { segRefs.current[i] = el; }}
                type="button"
                className="lp-film__seg"
                data-index={i}
                data-state={i < chapter ? 'past' : i === chapter ? 'current' : 'next'}
                tabIndex={i === chapter ? 0 : -1}
                aria-current={i === chapter ? 'true' : undefined}
                aria-label={`Chapter ${i + 1} of ${COUNT}: ${c.name}`}
                onClick={() => seek(i)}
              >
                <span className="lp-film__rail" aria-hidden="true"><span className="lp-film__fill" /></span>
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="lp-film__key" onClick={toggleSound} aria-pressed={soundOn} aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}>
          {soundOn ? <Volume2 size={20} strokeWidth={2} aria-hidden="true" /> : <VolumeX size={20} strokeWidth={2} aria-hidden="true" />}
        </button>
        {canFull ? (
          // Not drawn where the browser has no full screen at all. On phones it sits in the picture's corner (hero-film.css);
          // in the tab order it stays after the sound key.
          <button type="button" className="lp-film__key lp-film__full" onClick={toggleFull} aria-label={full ? 'Leave full screen' : 'Play full screen'}>
            {full ? <Minimize2 size={20} strokeWidth={2} aria-hidden="true" /> : <Maximize2 size={20} strokeWidth={2} aria-hidden="true" />}
          </button>
        ) : null}
      </div>
    </figure>
  );
}
