// Where an attempt's score came from. Server-scored attempts were marked against a
// server-held question snapshot; older attempts were scored in the browser before
// the server-scoring change and are shown to their owner only as labelled history.
export const SERVER_SCORING_VERSIONS = Object.freeze(['server_practice_v1', 'server_snapshot_v1']);

export function attemptScoring(attempt) {
  return SERVER_SCORING_VERSIONS.includes(attempt?.selectionMeta?.scoringVersion) ? 'server' : 'device';
}

// Score Recovery evidence is narrower: only pilot sessions carry a replayable timeline.
export function isRecoverySession(attempt) {
  return attempt?.selectionMeta?.scoringVersion === 'server_snapshot_v1';
}
