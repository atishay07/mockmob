"use client";

import React, { useEffect, useState } from 'react';

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

export function DynamicCompassPreview({ className = '' }) {
  const [index, setIndex] = useState(0);
  const scenario = SCENARIOS[index];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % SCENARIOS.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={`compass-shot ${className}`} aria-label="DU Compass preview">
      <div key={scenario.score} className="compass-scenario">
        <div className="shot-top">
          <div>
            <div className="mono-label">Mock CUET score</div>
            <div className="shot-score">{scenario.score}<span>/1000</span></div>
          </div>
          <span className="pill volt shot-band">{scenario.band}</span>
        </div>
        <div className="shot-bars">
          {scenario.subjects.map(([subject, marks]) => (
            <div key={subject}>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                <span>{subject}</span>
                <span className="font-mono tabular-nums">{marks}/200</span>
              </div>
              <div className="bar">
                <div className="fill fill-volt" style={{ width: `${Math.round((marks / 200) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="shot-insights">
          <div>
            <span>Eligibility</span>
            <strong>{scenario.eligibility}</strong>
          </div>
          <div>
            <span>Next move</span>
            <strong>{scenario.nextMove}</strong>
          </div>
        </div>
        <div className="shot-list">
          {scenario.colleges.map(([college, course, chance]) => (
            <div key={`${college}-${course}`} className="shot-row">
              <div>
                <b>{college}</b>
                <span>{course}</span>
              </div>
              <em>{chance}</em>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
