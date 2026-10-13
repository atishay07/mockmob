import { respondEpisode } from './learning';
import { episodeCheckInput } from './sessionFinaliser';

// Reports a deadline-finalised fresh-check session to its learning episode, as finishSession does.
// Every finaliser pass (daily cron and the per-student pass on the results routes) must pass this as
// onEpisodeCheck: once a check session is closed without it, startSession answers
// SESSION_ALREADY_SUBMITTED for that episode revision and the episode cannot move on.
export async function reportFinalisedEpisodeCheck(row, scored) {
  const { input, options } = episodeCheckInput(row, scored);
  await respondEpisode(row.user_id, row.selection_meta.episodeId, input, options);
}
