'use client';

// Section 6 of /home-next: "How much of CUET does MockMob cover?" (spec section 6 and Revision 2). A rail of the 15 subjects
// Practice offers, each its own lamp-lit 3D object (the shelf's objects, SubjectObject); for the chosen one, its CUET syllabus
// chapter by chapter as numbered dots, the subject's true question count beside its name, and, for the dot tapped, the
// chapter's name and count. A dot is filled only when the bank holds a set's worth for that chapter (COVER_MIN, 10): one
// question is not coverage. Every figure is the stored daily inventory's, worked out on the server (coverageModel.mjs).
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { COVER_HEAD, COVER_MIN, chapterLine, subjectCovered } from './homeNextCopy.mjs';
import { OPENING_SUBJECT } from './coverageModel.mjs';

const n = (value) => Number(value).toLocaleString('en-IN');
// The art's own ids for the subject pages' ids (subject_art.mjs keys business, generaltest and the like).
const artId = (slug) => slug.replace(/-/g, '_');

export default function Coverage({ model }) {
  const { subjects } = model;
  const [subjectId, setSubjectId] = useState(() => (subjects.some((s) => s.id === OPENING_SUBJECT) ? OPENING_SUBJECT : subjects[0].id));
  const [picked, setPicked] = useState(1);
  const subject = subjects.find((s) => s.id === subjectId) || subjects[0];
  const chapter = subject.chapters.find((c) => c.n === picked) || subject.chapters[0];
  const choose = (id) => { setSubjectId(id); setPicked(1); };
  return (
    <div className="hn-cover">
      <div className="hn-cover__rail" role="group" aria-label="Subjects">
        {subjects.map((s) => (
          <button key={s.id} type="button" className="hn-subj" aria-pressed={s.id === subject.id} onClick={() => choose(s.id)}>
            <SubjectObject id={artId(s.slug)} size={52} life={false} sizes="52px" className="hn-subj__obj" />
            <span className="hn-subj__name">{s.name}</span>
          </button>
        ))}
      </div>
      <div className="hn-cover__card">
        <div className="hn-cover__head">
          <h3 className="hn-cover__name">CUET {subject.name}</h3>
          <p className="hn-cover__count"><b>{n(subject.questions)}</b> questions</p>
        </div>
        <p className="hn-cover__covered">{subjectCovered(subject)}</p>
        <ol className="hn-dots" aria-label={`${subject.name} syllabus chapters`}>
          {subject.chapters.map((c) => (
            <li key={`${subject.id}-${c.n}`}>
              <button type="button" className="hn-dot" data-has={c.count >= COVER_MIN ? 'true' : c.count > 0 ? 'some' : 'false'} aria-pressed={c.n === chapter.n}
                aria-label={`Chapter ${c.n}, ${c.name}: ${chapterLine(c)}`} onClick={() => setPicked(c.n)}>
                <span aria-hidden="true">{c.n}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="hn-cover__detail" aria-live="polite">
          <p className="hn-cover__chapter"><span className="hn-cover__n">{chapter.n}</span><b>{chapter.name}</b></p>
          <p className="hn-cover__line">
            <span data-has={chapter.count >= COVER_MIN ? 'true' : 'false'}>{chapterLine(chapter)}</span>
            {chapter.unit !== chapter.name ? <small>{chapter.unit}</small> : null}
          </p>
        </div>
        <Link href={`/cuet/${subject.slug}#syllabus`} className="hn-cover__link">
          {COVER_HEAD.link}<span className="hn-sr"> for CUET {subject.name}</span><ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
