import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  generateOfflineQuestionFiles,
  importOfflineQuestionBatch,
  validateOfflineQuestionBatch,
} from '../lib/offlineBatchFactory.mjs';

test('offline dry-run import does not write DB', async () => {
  const env = snapshotEnv();
  try {
    disableDbEnv();
    const dir = mkdtempSync(join(tmpdir(), 'mockmob-offline-import-'));
    generateOfflineQuestionFiles({ subject: 'Economics', chapter: 'Money & Banking', quality: 'balanced', count: 10, batchSize: 10, out: dir });
    await validateOfflineQuestionBatch({ dir, quality: 'balanced' });

    const result = await importOfflineQuestionBatch({ dir, quality: 'balanced', dryRun: true, write: false });
    assert.equal(result.importResults.dry_run, true);
    assert.equal(result.importResults.inserted_count, 0);
    assert.ok(result.importResults.blocked_reasons.includes('dry_run_enabled'));
  } finally {
    restoreEnv(env);
  }
});

test('offline write is blocked unless OFFLINE_IMPORT_ALLOW_DB_WRITE is true', async () => {
  const env = snapshotEnv();
  try {
    disableDbEnv();
    process.env.OFFLINE_IMPORT_ALLOW_DB_WRITE = 'false';
    const dir = mkdtempSync(join(tmpdir(), 'mockmob-offline-write-'));
    generateOfflineQuestionFiles({ subject: 'Economics', chapter: 'Money & Banking', quality: 'balanced', count: 10, batchSize: 10, out: dir });
    await validateOfflineQuestionBatch({ dir, quality: 'balanced' });

    const result = await importOfflineQuestionBatch({ dir, quality: 'balanced', dryRun: false, write: true });
    assert.equal(result.importResults.dry_run, true);
    assert.equal(result.importResults.inserted_count, 0);
    assert.ok(result.importResults.blocked_reasons.includes('OFFLINE_IMPORT_ALLOW_DB_WRITE_not_true'));
  } finally {
    restoreEnv(env);
  }
});

function snapshotEnv() {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    OFFLINE_IMPORT_ALLOW_DB_WRITE: process.env.OFFLINE_IMPORT_ALLOW_DB_WRITE,
    OFFLINE_IMPORT_DRY_RUN: process.env.OFFLINE_IMPORT_DRY_RUN,
  };
}

function disableDbEnv() {
  process.env.SUPABASE_URL = '';
  process.env.NEXT_PUBLIC_SUPABASE_URL = '';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';
  process.env.OFFLINE_IMPORT_DRY_RUN = 'true';
}

function restoreEnv(env) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
