"use client";

import React, { useEffect, useRef, useState } from 'react';

const SCENARIOS = [
  {
    score: 872,
    band: 'High · 850-1000',
    subjects: [
      ['Accountancy', 184],
      ['Economics', 172],
      ['English', 178],
    ],
    eligibility: '5/5 subjects fit',
    nextMove: 'Push Maths +12',
    colleges: [
      ['SRCC', 'B.Com (Hons)', 'Aspirational'],
      ['Hansraj', 'Economics (Hons)', 'Moderate'],
      ['Sri Venkateswara', 'B.Com (Hons)', 'High'],
    ],
  },
  {
    score: 642,
    band: 'Builder · 600-700',
    subjects: [
      ['English', 164],
      ['Psychology', 128],
      ['History', 118],
    ],
    eligibility: '3/5 strong subjects',
    nextMove: 'Fix History +18',
    colleges: [
      ['Hansraj', 'History (Hons)', 'Reach'],
      ['Ramjas', 'Psychology (Hons)', 'Moderate'],
      ['Gargi', 'B.A. Programme', 'High'],
    ],
  },
  {
    score: 558,
    band: 'Recovery · 500-600',
    subjects: [
      ['Political Science', 142],
      ['History', 104],
      ['English', 156],
    ],
    eligibility: '2 urgent gaps',
    nextMove: 'Replay History traps',
    colleges: [
      ['Kirori Mal', 'B.A. Programme', 'Reach'],
      ['ARSD', 'History (Hons)', 'Moderate'],
      ['Dyal Singh', 'B.A. Programme', 'High'],
    ],
  },
];

function AnimatedNumber({ value, duration = 800 }) {
  const ref = useRef(null);
  const prevRef = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    if (from === to) return;

    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span ref={ref}>{value}</span>;
}

function AnimatedBar({ percent }) {
  return (
    <div className="bar">
      <div
        className="fill fill-volt"
        style={{
          width: `${percent}%`,
          transition: 'width 900ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  );
}

export function DynamicCompassPreview({ className = '' }) {
  const [index, setIndex] = useState(0);
  const scenario = SCENARIOS[index];

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % SCENARIOS.length);
    }, 3400);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={`compass-shot ${className}`} aria-label="DU Compass preview">
      <div className="shot-top">
        <div>
          <div className="mono-label">Mock CUET score</div>
          <div className="shot-score">
            <AnimatedNumber value={scenario.score} duration={900} />
            <span>/1000</span>
          </div>
        </div>
        <span
          className="pill volt shot-band"
          style={{ transition: 'opacity 400ms ease' }}
        >
          {scenario.band}
        </span>
      </div>

      <div className="shot-bars">
        {scenario.subjects.map(([subject, marks]) => (
          <div key={subject}>
            <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
              <span
                style={{
                  transition: 'opacity 300ms ease',
                }}
              >
                {subject}
              </span>
              <span className="font-mono tabular-nums">
                <AnimatedNumber value={marks} duration={800} />
                /200
              </span>
            </div>
            <AnimatedBar percent={Math.round((marks / 200) * 100)} />
          </div>
        ))}
      </div>

      <div className="shot-insights">
        <div style={{ transition: 'opacity 400ms ease 100ms' }}>
          <span>Eligibility</span>
          <strong>{scenario.eligibility}</strong>
        </div>
        <div style={{ transition: 'opacity 400ms ease 150ms' }}>
          <span>Next move</span>
          <strong>{scenario.nextMove}</strong>
        </div>
      </div>

      <div className="shot-list">
        {scenario.colleges.map(([college, course, chance], i) => (
          <div
            key={`${college}-${course}`}
            className="shot-row"
            style={{
              opacity: 1,
              transform: 'translateY(0)',
              transition: `opacity 400ms ease ${200 + i * 80}ms, transform 400ms ease ${200 + i * 80}ms`,
            }}
          >
            <div>
              <b>{college}</b>
              <span>{course}</span>
            </div>
            <em>{chance}</em>
          </div>
        ))}
      </div>
    </div>
  );
}
