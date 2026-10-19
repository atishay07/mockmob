import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import MobGame, { GAME_VIEWS } from '@/components/mob/v3/play/MobGame';

export const metadata = { title: 'Mob game', robots: { index: false, follow: false } };

// A Mob v3 game (MOB-BUILD-SPEC-V3 5.3 R1 to R9): the run, the podium, everyone's moment and Fix it together.
// Behind MOB_ENABLED and MOB_V3_ENABLED: with either off, the page does not exist and the web Mob stays as it is.
export default async function MobGameRoute({ params, searchParams }) {
  await connection();
  if (process.env.MOB_ENABLED !== 'true' || process.env.MOB_V3_ENABLED !== 'true') notFound();
  const { id } = await params;
  const query = await searchParams;
  const raw = String(id || '');
  if (!/^[0-9a-f-]{36}$/i.test(raw)) notFound();
  const view = GAME_VIEWS.includes(query?.view) ? query.view : 'run';
  return <MobGame gameId={raw} view={view} autoStart={query?.play === '1'} />;
}
