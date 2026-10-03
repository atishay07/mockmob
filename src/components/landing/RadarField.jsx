"use client";

import { useEffect, useRef } from 'react';

// Full-bleed canvas backdrop for the hero: a dot grid swept by a rotating
// radar beam. Dots charge volt as the beam passes and decay back; the pointer
// gently repels nearby dots. Single canvas + one rAF loop, paused when the
// section is off-screen or the tab is hidden. Reduced motion gets one static
// frame and no loop.
export function RadarField({ className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let dots = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;
    let running = false;
    let visible = true;
    let angle = -Math.PI / 2;
    let lastTs = 0;
    const pointer = { x: -9999, y: -9999 };

    const GAP = 34;
    const BEAM_WIDTH = Math.PI / 7;

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.parentElement.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      dots = [];
      for (let y = GAP / 2; y < height; y += GAP) {
        for (let x = GAP / 2; x < width; x += GAP) {
          dots.push({ x, y, charge: 0 });
        }
      }
    }

    function drawFrame(dt) {
      ctx.clearRect(0, 0, width, height);
      const cx = width * 0.5;
      const cy = height * 0.62;

      for (const dot of dots) {
        const dxB = dot.x - cx;
        const dyB = dot.y - cy;
        const dotAngle = Math.atan2(dyB, dxB);
        let diff = Math.abs(dotAngle - angle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < BEAM_WIDTH) {
          dot.charge = Math.max(dot.charge, 1 - diff / BEAM_WIDTH);
        }
        dot.charge = Math.max(0, dot.charge - dt * 0.55);

        // Pointer repulsion: draw-time offset only, grid positions stay fixed.
        const dxP = dot.x - pointer.x;
        const dyP = dot.y - pointer.y;
        const distP = Math.hypot(dxP, dyP);
        let ox = 0;
        let oy = 0;
        if (distP < 110 && distP > 0.001) {
          const push = ((110 - distP) / 110) * 10;
          ox = (dxP / distP) * push;
          oy = (dyP / distP) * push;
        }

        const c = dot.charge;
        const radius = 1 + c * 1.6;
        if (c > 0.02) {
          ctx.fillStyle = `rgba(210, 240, 0, ${0.10 + c * 0.55})`;
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
        }
        ctx.beginPath();
        ctx.arc(dot.x + ox, dot.y + oy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Beam edge line, faint.
      const reach = Math.hypot(width, height);
      const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * reach, cy + Math.sin(angle) * reach);
      grad.addColorStop(0, 'rgba(210,240,0,0.20)');
      grad.addColorStop(1, 'rgba(210,240,0,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * reach, cy + Math.sin(angle) * reach);
      ctx.stroke();
    }

    function tick(ts) {
      if (!running) return;
      const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.1) : 0.016;
      lastTs = ts;
      angle += dt * 0.5;
      if (angle > Math.PI) angle -= Math.PI * 2;
      drawFrame(dt);
      rafId = window.requestAnimationFrame(tick);
    }

    function start() {
      if (running || reduceMotion || !visible || document.hidden) return;
      running = true;
      lastTs = 0;
      rafId = window.requestAnimationFrame(tick);
    }

    function stop() {
      running = false;
      window.cancelAnimationFrame(rafId);
    }

    build();
    if (reduceMotion) {
      // One calm static frame: no beam, just the grid.
      drawFrame(0);
    } else {
      start();
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    }, { threshold: 0.05 });
    observer.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onPointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };
    const onPointerLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };
    const host = canvas.parentElement;
    host.addEventListener('pointermove', onPointerMove, { passive: true });
    host.addEventListener('pointerleave', onPointerLeave, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      build();
      if (reduceMotion) drawFrame(0);
    });
    resizeObserver.observe(host);

    return () => {
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ position: 'absolute', inset: 0, display: 'block' }}
    />
  );
}
