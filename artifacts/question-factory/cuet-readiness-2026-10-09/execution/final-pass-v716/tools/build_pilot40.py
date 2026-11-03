# Builds the V716 40-job pilot plan from the R2 measurement plan (fresh ids; R2 ids/requests untouched).
# Usage: python -X utf8 build_pilot40.py <final-freeze-path> <pilot-dir>
import json, secrets, datetime, sys, os
freeze, D = sys.argv[1], sys.argv[2]
os.makedirs(D, exist_ok=True)
F = 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/'
r2 = json.load(open(F + 'final-pass-v713/measurement-continuation-40-r2/campaign.json', encoding='utf8'))
reg = json.load(open(F + 'final-pass-v716/diagnostic-native-r1/registry.json', encoding='utf8'))
base = {j['number']: j for j in r2['jobs']}
keep = ['subject','chapter','topic','kind','format','difficulty','branch','source_pack_id','source_pack_version','variant_index','requested_answer_position','avoidance','official_syllabus_topic','source_refs','passage_text']
now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
def new_job(src, **over):
    j = {k: src.get(k) for k in keep}; j.update(over)
    nid = secrets.token_hex(16); j['id'] = nid; j['family_id'] = 'original:' + nid; j['r2_source_number'] = src['number']
    reg['families'][j['family_id']] = {'state': 'active', 'version': 1, 'subject': j['subject'], 'kind': 'original_practice', 'note': 'V716 pilot40 measurement; publication only after separate approval'}
    return j
def stim_ref(sid):
    s = reg['sources'][sid]; return {'id': sid, 'version': s['version'], 'locator': 'stimulus', 'support_hash': s['supports']['stimulus']}, s['facts']['stimulus']['text']
def group(sid, chapter, topics, positions, difficulties, src):
    ref, text = stim_ref(sid); gid = 'grp716-' + secrets.token_hex(8)
    members = [new_job(src, chapter=chapter, topic=t, requested_answer_position=p, difficulty=d, source_refs=[ref], passage_text=text) for t, p, d in zip(topics, positions, difficulties)]
    for i, m in enumerate(members):
        m['passage_group_id'] = gid; m['order_index'] = i + 1; m['passage_group'] = {'id': gid, 'member_ids': [x['id'] for x in members]}
    reg.setdefault('passage_groups', {})[gid] = {'id': gid, 'state': 'active', 'kind': 'original_practice', 'candidate_ids': [x['id'] for x in members], 'passage_text': text, 'source_pack_id': src['source_pack_id']}
    return members
# English: two 2-question passage groups + 2 antonym + 2 correct word usage + 2 synonym (R2: 5 single reading, 1 antonym).
g1 = group('mockmob-original-stimulus-diverse-510f9bbd4bc64432d387', 'Narrative Passage',
           ['Narrative Passage: test a distinct explicitly stated detail in this printed fictional passage.',
            "Narrative Passage: test a supported inference about the character's reason or principle in this printed fictional passage; do not repeat a factual-detail question."],
           ['C', 'A'], ['easy', 'medium'], base[1])
g2 = group('mockmob-original-stimulus-diverse-417811c0a74bd16691b0', 'Narrative Passage',
           ['Narrative Passage: test a distinct explicitly stated detail in this printed fictional passage.',
            'Narrative Passage: test a supported inference or textual relationship in this printed fictional passage; do not repeat a factual-detail question.'],
           ['B', 'D'], ['easy', 'medium'], base[17])
def oxford(*words):
    out = []
    for w in words:
        s = reg['sources']['oxford-quality-' + w]; out.append({'id': 'oxford-quality-' + w, 'version': s['version'], 'locator': 'definition', 'support_hash': s['supports']['definition']})
    return out
ant2 = new_job(base[5], source_refs=oxford('candid', 'discreet', 'arrogant'), requested_answer_position='C')
english = {1: g1[0], 9: g1[1], 17: g2[0], 25: g2[1], 33: ant2}
jobs = []
for n in range(1, 41):
    jobs.append(english[n] if n in english else new_job(base[n]))
for i, j in enumerate(jobs): j['number'] = i + 1
# Group siblings must share a wave of ten: (1,9) wave 1, (17,25) waves 2/3 -> move 25's slot next to 17.
w = lambda n: (n - 1) // 10
assert w(1) == w(9)
if w(17) != w(25):
    a, b = jobs.index(g2[1]), next(i for i in range(10, 20) if jobs[i]['subject'] == 'english' and jobs[i] not in g2)
    jobs[a], jobs[b] = jobs[b], jobs[a]
for i, j in enumerate(jobs): j['number'] = i + 1
for g in (g1, g2): assert len({w(j['number']) for j in g}) == 1
json.dump(reg, open(os.path.join(D, 'registry.json'), 'w', encoding='utf8'))
json.dump({'id': 'cuet-v716-pilot40', 'adapted_from': 'cuet-v713-measurement-continuation-40 (plan only; its ids, requests and outcomes untouched)', 'jobs': jobs}, open(os.path.join(D, 'campaign.json'), 'w', encoding='utf8'), indent=1, ensure_ascii=False)
study = {'schema': 'cuet-v716-pilot-v1', 'id': 'cuet-v716-pilot40', 'kind': 'pilot', 'publication': 'never', 'max_repairs': 0, 'cap_usd': 3, 'wave_size': 10,
         'execution_freeze_path': freeze, 'created_at': now,
         'stop_rule': 'Two consecutive completed waves under 40% eligible stop the campaign; remaining jobs stay in the denominator as not started.',
         'measurement_rules': 'Fixed 40 jobs, 10 per subject, waves of 10 in registered order; every job, failure, retry and cost stays in the denominator; approved = V716 eligible (signed, practice >=6, NTA >=7); cost per approved = all settled campaign spend / approved; no repairs (at most one targeted repair would need separate versioned integration); English reading as two atomic 2-question passage groups; English matching excluded (near-exhausted pool).'}
json.dump(study, open(os.path.join(D, 'study.json'), 'w', encoding='utf8'), indent=2)
import collections
print(collections.Counter((j['subject'], j['format']) for j in jobs))
print([(j['number'], j['subject'][:3], j['format'][:6]) for j in jobs[:20]])
