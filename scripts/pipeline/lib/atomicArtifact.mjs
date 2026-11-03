import {writeFileSync, renameSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

// Windows readers or antivirus may briefly hold the destination. Keep the
// completed checkpoint on disk and retry the rename; never truncate the live
// artifact or discard a failed checkpoint.
export function saveAtomicArtifact(path, value, {
  write = writeFileSync, rename = renameSync,
  wait = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms),
  attempts = 12
} = {}) {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  write(temporary, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { rename(temporary, path); return; }
    catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt === attempts - 1) {
        const failure = new Error(`artifact_checkpoint_blocked:${error.code || 'unknown'}`);
        failure.cause = error;
        failure.checkpoint = temporary;
        throw failure;
      }
      wait(Math.min(250, 25 * (attempt + 1)));
    }
  }
}

// A checkpoint failure stops new dispatches, but every already-started task
// finishes before the caller closes its ledger or exits.
export async function drainConcurrent(items, fn, {concurrency = 4, shouldStop = () => false} = {}) {
  let index = 0, failure;
  await Promise.allSettled(Array.from({length: concurrency}, async () => {
    while (!failure && !shouldStop()) {
      const item = items[index++];
      if (item === undefined) return;
      try { await fn(item); }
      catch (error) { failure ||= error; }
    }
  }));
  if (failure) throw failure;
}
