// Opens the exact previously sealed map only after the independent blind output has been frozen.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const base = resolve('artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713/fresh-custody');
const sha = name => createHash('sha256').update(readFileSync(resolve(base, name))).digest('hex');
const read = name => JSON.parse(readFileSync(resolve(base, name), 'utf8'));
const blind = read('blind/blind-freeze-r2.json'), map = read('sealed/map-r2.json');
if (sha('blind/output-r2.json') !== blind.output_sha256 || sha('blind/packet-r2.json') !== blind.packet_sha256 ||
    map.packet_sha256 !== blind.packet_sha256 || map.author_sha256 !== sha('sealed/authored-r2.json') ||
    blind.study_id !== map.study_id || blind.freeze_sha256 !== map.freeze_sha256) throw Error('sealed_blind_custody_changed');
const at = new Date().toISOString();
if (Date.parse(at) <= Date.parse(blind.created_at)) throw Error('reveal_must_follow_blind_freeze');
writeFileSync(resolve(base, 'sealed/reveal-r2.json'), JSON.stringify({ schema: 'cuet-v713-reveal-v1',
  study_id: map.study_id, freeze_sha256: map.freeze_sha256, created_at: at,
  author_sha256: map.author_sha256, blind_freeze_sha256: sha('blind/blind-freeze-r2.json'),
  map_sha256: sha('sealed/map-r2.json'), rows: map.rows }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ revealed: 'sealed/reveal-r2.json', sha256: sha('sealed/reveal-r2.json'), denominator: map.rows.length, provider_calls: 0 }));
