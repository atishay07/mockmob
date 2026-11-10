"use client";

import Link from 'next/link';
import { useState } from 'react';
import { FoldHead } from '@/components/mob/den/FoldFigure';
import { useMobEnabled } from '@/components/mob/MobFlag';
import RenameDialog from '@/components/mob/MobIdentityDialog';
import { useMob } from '@/components/mob/useMob';
import '@/components/mob/den/den.css';

export default function AccountMobIdentity({ userId }) {
  const enabled = useMobEnabled();
  const mob = useMob(enabled ? userId : null, { identity: true });
  const [editing, setEditing] = useState(false);
  if (!enabled || !userId || mob.status === 'disabled') return null;

  const data = mob.mob;
  const you = data?.you;
  const fold = data?.v3?.members?.find((member) => member.you)?.fold;
  const group = data?.v3?.name?.text || (data?.subjectName ? `${data.subjectName} Mob` : null);
  const loading = mob.status === 'idle' || mob.status === 'loading';

  return (
    <section className="acct-mob" aria-labelledby="acct-mob-title" aria-busy={loading || undefined}>
      <h3 id="acct-mob-title">How your Mob sees you</h3>
      {loading ? (
        <p className="acct-mob__note" role="status">Loading your Mob profile</p>
      ) : mob.status === 'error' ? (
        <div className="acct-mob__row">
          <p className="acct-mob__note" role="status">Your Mob profile did not load.</p>
          <button type="button" className="acct-link" onClick={() => mob.load()}>Try again</button>
        </div>
      ) : you ? (
        <div className="acct-mob__row">
          <FoldHead key={fold || 'disc'} fold={fold} name={you.name} colour={you.colour} size={36} />
          <p className="acct-mob__name"><b>{you.name}</b>{group ? <span>{group}</span> : null}</p>
          <button type="button" className="acct-link" onClick={() => setEditing(true)}>Edit Mob profile</button>
          {editing ? <RenameDialog open onClose={() => setEditing(false)} you={you} run={mob.run} busy={mob.busy} /> : null}
        </div>
      ) : (
        <div className="acct-mob__row">
          <p className="acct-mob__note">You have no Mob yet.</p>
          <Link className="acct-link" href="/mob">Start or join a Mob</Link>
        </div>
      )}
    </section>
  );
}
