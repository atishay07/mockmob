"use client";
// The Mob page's one entry to class leagues: a row under the Mob that opens "Your class" on the Sunday Mock page
// (/sunday#class), where a class is started, joined and read. A Mob is a few friends who see each other; a class is the whole
// section, where nobody is named, so it lives beside the Mob, not in it. Quiet (the Mob page keeps its own volt). Nothing while
// it is off, loading, or when the read failed.
import Link from 'next/link';
import { ChevronRight, School } from 'lucide-react';
import { CLASS_COPY, membersLine } from '@/lib/classLeague/model.mjs';
import { useClassLeague } from './useClassLeague';
import { useClassLeaguesOn } from './ClassSwitch';
import './class.css';

function ClassMobEntryOn() {
  const league = useClassLeague(true);
  if (league.status === 'off' || league.status === 'loading') return null;
  const cls = league.data?.class || null;
  return (
    <Link className="cls-entry" href="/sunday#class">
      <span className="tcls__mark cls-entry__mark" aria-hidden="true"><School size={20} strokeWidth={2} /></span>
      <span className="cls-entry__text">
        <b>{cls ? `${CLASS_COPY.name}: ${cls.name}` : CLASS_COPY.name}</b>
        <span>{cls ? `${membersLine(cls.members)}. Your class's average on the Sunday Mock, each Monday.` : 'Your whole class on the Sunday Mock: the class average each Monday, beside your marks. No names, no ranks.'}</span>
      </span>
      <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}

/** Mounts only while CLASS_LEAGUES_ENABLED is on (./ClassSwitch.jsx): off, nothing is read or drawn. */
export default function ClassMobEntry(props) {
  return useClassLeaguesOn() ? <ClassMobEntryOn {...props} /> : null;
}
