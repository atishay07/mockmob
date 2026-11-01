#!/usr/bin/env bash
# Records the Learn v2 routes from the web dev preview into test/fixtures/learn2/ (APP-1101 section 3, APP-1102-A section 2), for
# the data models, FixtureLearnApi, the widget tests and the goldens. Source: the live web, origin/main 31af5f9dc (rounds 2 to 4,
# worktree wt-1102-web), whose preview dev server runs on port 3452.
#
# Usage, from flutter_app:   bash tool/record_learn2_fixtures.sh [tag]
#
# The preview must already be running (port 3452, or LEARN2_PREVIEW_PORT): this script never starts, stops or restarts it.
# Every request goes to
#   http://localhost:3452/preview/arena/realdeck?_to=/api/learn/<route>&<the route's own query>&_plan=&_student=&_s=
# which is the production service (web src/lib/server/learn.js) over the preview's in-memory student. Each run makes its
# own students, named app-rec2-<tag> (commerce and new, Pro and Free) and app-rec2-<tag>-scratch (commerce, Pro: answers
# every question once to learn the keys), so the owner's own preview sessions are never touched. The preview keeps at most
# 48 students, so run this rarely. tag defaults to the time (MMDDHHMM).
#
# Writes test/fixtures/learn2/*.json (pretty), manifest.json (status, method, route and request of every file) and
# README.md. The parity/ folder belongs to the stage packet and is left alone. Needs bash, curl and node (node only reads
# and formats JSON). Stops at the first answer that is not the expected status.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."

PORT="${LEARN2_PREVIEW_PORT:-3452}"
BASE="http://localhost:$PORT/preview/arena/realdeck"
TAG="${1:-$(date +%m%d%H%M)}"
OUT="test/fixtures/learn2"
WEB_COMMIT="31af5f9dc"

PRO="_student=commerce&_plan=pro&_s=app-rec2-$TAG"
FREE="_student=commerce&_plan=free&_s=app-rec2-$TAG"
NEWPRO="_student=new&_plan=pro&_s=app-rec2-$TAG"
NEWFREE="_student=new&_plan=free&_s=app-rec2-$TAG"
SCRATCH="_student=commerce&_plan=pro&_s=app-rec2-$TAG-scratch"

AOP="accountancy.admission-of-partner"
PF="accountancy.partnership-fundamentals"
CPSR="accountancy.change-in-profit-sharing-ratio"
CCSS="accountancy.comparative-and-common-size-statements"
MISSING="accountancy.no-such-chapter"

TMPD="$(mktemp -d)"
TMPW="$(cygpath -m "$TMPD" 2>/dev/null || echo "$TMPD")"
trap 'rm -rf "$TMPD"' EXIT
HELPER="$TMPW/helper.mjs"
cat > "$HELPER" <<'JS'
import fs from 'node:fs';
const [cmd, ...args] = process.argv.slice(2);
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
if (cmd === 'pretty') {
  const [inp, out] = args;
  const text = fs.readFileSync(inp, 'utf8');
  let j;
  try { j = JSON.parse(text); } catch { console.error(`not JSON: ${text.slice(0, 300)}`); process.exit(3); }
  fs.writeFileSync(out, `${JSON.stringify(j, null, 2)}\n`);
} else if (cmd === 'get') {
  const [file, expr] = args;
  const v = new Function('j', `return (${expr});`)(read(file));
  process.stdout.write(v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
} else if (cmd === 'add') {
  const e = process.env;
  const who = Object.fromEntries(new URLSearchParams(e.WHO));
  const line = {
    name: e.NAME, status: Number(e.STATUS), method: e.METHOD, route: e.ROUTE, query: e.QUERY || null,
    body: e.BODY ? JSON.parse(e.BODY) : null, student: who._student, plan: who._plan, session: who._s, note: e.NOTE,
  };
  fs.appendFileSync(args[0], `${JSON.stringify(line)}\n`);
} else if (cmd === 'finish') {
  const [ndjson, outDir, tag, base, web] = args;
  const lines = fs.readFileSync(ndjson, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const fixtures = {};
  for (const l of lines) { const { name, ...rest } = l; fixtures[name] = rest; }
  const manifest = { web, tag, recorded: new Date().toISOString(), preview: base, command: `bash tool/record_learn2_fixtures.sh ${tag}`, fixtures };
  fs.writeFileSync(`${outDir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  const rows = lines.map((l) => `| \`${l.name}.json\` | ${l.status} | ${l.method} ${l.route.replace(/lr_[0-9a-f]{24}/g, ':run')}${l.query ? `?${l.query}` : ''} | ${l.student}, ${l.plan} | ${l.note} |`);
  const readme = [
    '# Learn v2 fixtures (recorded)',
    '',
    `Recorded from the web dev preview of the live Learn v2 build (rounds 2 to 4), web commit ${web} (origin/main, folder`,
    '`wt-1102-web`), by:',
    '',
    '```',
    `bash tool/record_learn2_fixtures.sh ${tag}     # from flutter_app, with the preview already running on port 3452`,
    '```',
    '',
    'Every answer is the production service (`src/lib/server/learn.js`) over the preview\'s in-memory student',
    `(\`${base}?_to=/api/learn/<route>&...&_plan=&_student=&_s=app-rec2-${tag}\`). Students: \`commerce\` (returning: due cards,`,
    'open mistakes from Mock 3 and Mock 4, an unfinished Admission of a Partner run) and `new` (nothing studied), each on Pro',
    'and Free. Bodies are exactly as the server sent them, pretty-printed. `manifest.json` names the status, method, route,',
    'query and request body of every file (FixtureLearnApi reads the status of the error files from it).',
    '',
    'Files are named `<route>_<what>_<plan>[_<state>]`; `error_<status>_<code>` holds an error body. Not recordable from the',
    'preview (Learn is always on there): `404 LEARN_OFF`, `409 QUESTION_CHANGED | QUESTION_HELD`; tests build those from',
    'the contract (`API-CONTRACT.md`). `parity/` belongs to the stage packet and is not written by this script.',
    '',
    '`answer_keys.json` is not a response: it is the key and explanation of every Accountancy question the runs above serve,',
    'learnt by answering each once in a scratch student (`app-rec2-<tag>-scratch`), so FixtureLearnApi can grade any choice.',
    '',
    '| File | Status | Request | Student | What it is |',
    '|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
  fs.writeFileSync(`${outDir}/README.md`, readme);
} else {
  console.error(`unknown helper command ${cmd}`);
  process.exit(2);
}
JS

get() { node "$HELPER" get "$1" "$2"; }
die() { echo "FAIL: $*" >&2; exit 1; }
check() { [ "$(get "$1" "$2")" = "true" ] || die "$1 does not hold: $2"; }
newkey() { printf 'lk_%s' "$(od -An -N12 -tx1 /dev/urandom | tr -d ' \n')"; }
enc() { printf '%s' "$1" | sed 's#/#%2F#g'; }

# call WHO METHOD ROUTE QUERY BODY OUTFILE -> prints the HTTP status
call() {
  local who="$1" method="$2" route="$3" query="$4" body="$5" out="$6"
  local url="$BASE?_to=$(enc "$route")${query:+&$query}&$who"
  if [ "$method" = GET ]; then
    curl -s -o "$out" -w '%{http_code}' --max-time 120 "$url"
  else
    printf '%s' "$body" > "$TMPW/body.json"
    curl -s -o "$out" -w '%{http_code}' --max-time 120 -X "$method" -H 'Content-Type: application/json' --data-binary @"$TMPW/body.json" "$url"
  fi
}

# rec NAME WHO METHOD ROUTE QUERY BODY EXPECTED_STATUS NOTE
rec() {
  local name="$1" who="$2" method="$3" route="$4" query="$5" body="$6" expect="$7" note="$8"
  local status
  status="$(call "$who" "$method" "$route" "$query" "$body" "$TMPW/raw.json")"
  if [ "$status" != "$expect" ]; then
    echo "FAIL $name: $method $route ${query:+?$query} answered $status, wanted $expect" >&2
    head -c 600 "$TMPW/raw.json" >&2 || true
    echo >&2
    exit 1
  fi
  node "$HELPER" pretty "$TMPW/raw.json" "$OUT/$name.json"
  NAME="$name" STATUS="$status" METHOD="$method" ROUTE="$route" QUERY="$query" BODY="$body" WHO="$who" NOTE="$note" \
    node "$HELPER" add "$TMPW/manifest.ndjson"
  echo "ok   $name ($status)"
}

# The answer keys, learnt once in the scratch student: "<question id> <key> <line on a wrong answer, put back as a NEW card, not moved: 1|0>" per line, and
# every scratch answer body (one JSON per line) for answer_keys.json.
KEYS="$TMPW/keys.txt"
: > "$KEYS"
: > "$TMPW/answers.ndjson"
learn_keys() {
  local run="$1" rid st
  rid="$(get "$run" 'j.id')"
  for pair in $(get "$run" 'j.items.filter((i) => i.type === "question").map((i) => i.id + "|" + i.question.id).join(" ")'); do
    local iid="${pair%%|*}" qid="${pair##*|}"
    st="$(call "$SCRATCH" POST "/api/learn/runs/$rid/answer" "" "{\"itemId\":\"$iid\",\"choice\":\"A\"}" "$TMPW/ans.json")"
    [ "$st" = 200 ] || { echo "scratch: $iid answered $st" >&2; continue; }
    echo "$qid $(get "$TMPW/ans.json" 'j.key') $(get "$TMPW/ans.json" 'j.correct === false && j.line && !j.line.locked && j.reinsert && !j.reinsert.moved ? 1 : 0')" >> "$KEYS"
    get "$TMPW/ans.json" "({ id: '$qid', key: j.key, explanation: j.explanation || '' })" >> "$TMPW/answers.ndjson"
    echo >> "$TMPW/answers.ndjson"
  done
}
key_of() { awk -v q="$1" '$1 == q { print $2; exit }' "$KEYS"; }
lined() { awk -v q="$1" '$1 == q { print $3; exit }' "$KEYS"; }
wrong_of() { case "$1" in A) echo B ;; *) echo A ;; esac; }

curl -s -o "$TMPW/ping.json" --max-time 60 "$BASE?_to=%2Fapi%2Flearn%2Fshelves&$SCRATCH" || die "the preview is not answering on port $PORT (start the web dev server first; this script never does)"
mkdir -p "$OUT"
echo "Recording Learn v2 fixtures from $BASE as app-rec2-$TAG into $OUT"

start_body() { # kind chapter minutes [extra json]
  printf '{"kind":"%s","chapterKey":"%s","minutes":%s,"leaveOut":[],"requestKey":"%s"%s}' "$1" "$2" "$3" "$(newkey)" "${4:+,$4}"
}
preview_body() { # chapter minutes leaveOutJson [extra json]
  printf '{"chapterKey":"%s","minutes":%s,"leaveOut":%s%s}' "$1" "$2" "$3" "${4:+,$4}"
}

# ---------------------------------------------------------------- 1. the answer keys (scratch student, Pro)
# A 20-minute feed of each Accountancy chapter with questions holds every one of them (the covers say 10, 10 and 7).
for ch in "$AOP" "$PF" "$CPSR"; do
  call "$SCRATCH" POST /api/learn/runs "" "$(start_body feed "$ch" 20)" "$TMPW/scratch_feed.json" > /dev/null
  learn_keys "$TMPW/scratch_feed.json"
done
echo "keys learnt: $(wc -l < "$KEYS")"
node -e 'const fs=require("fs");const out={};for(const l of fs.readFileSync(process.argv[1],"utf8").split("\n").filter(Boolean)){const a=JSON.parse(l);out[a.id]={key:a.key,explanation:a.explanation};}const sorted=Object.fromEntries(Object.keys(out).sort().map((k)=>[k,out[k]]));fs.writeFileSync(process.argv[2],JSON.stringify(sorted,null,2)+"\n");' "$TMPW/answers.ndjson" "$OUT/answer_keys.json"

# ---------------------------------------------------------------- 2. Pro, returning (commerce): reads before anything is done
rec subject_accountancy_pro "$PRO" GET /api/learn/subject "subject=accountancy" "" 200 "Learn home, Accountancy: parts (Part 2 with its option), units, chapter rows, three suggestions (pickup, due, fix)"
rec home_accountancy_pro "$PRO" GET /api/learn/home "subject=accountancy" "" 200 "Learn home in one read (the subject body plus the shelves), Accountancy: the roadmap offer (pick up the unfinished run), Or rows, parts with place and progress"
rec home_economics_pro "$PRO" GET /api/learn/home "subject=economics" "" 200 "Learn home, Economics: the returning offer (Today's 10 minutes), nothing unfinished"
rec home_business_studies_pro "$PRO" GET /api/learn/home "subject=business_studies" "" 200 "Learn home, Business Studies"
rec home_english_pro "$PRO" GET /api/learn/home "subject=english" "" 200 "Learn home, English (the subject note)"
rec subject_economics_pro "$PRO" GET /api/learn/subject "subject=economics" "" 200 "Learn home, Economics"
rec subject_business_studies_pro "$PRO" GET /api/learn/subject "subject=business_studies" "" 200 "Learn home, Business Studies"
rec subject_english_pro "$PRO" GET /api/learn/subject "subject=english" "" 200 "Learn home, English (the subject note: cards written for MockMob)"
rec covers_accountancy_pro "$PRO" GET /api/learn/covers "subject=accountancy" "" 200 "Explore covers: For you first, counts at 5, 10 and 20 min with hooks"
rec shelves_pro "$PRO" GET /api/learn/shelves "subject=accountancy" "" 200 "The three shelf tiles: due (all and by subject), missed, in Revise, Must-know"
rec search_goodwill_pro "$PRO" GET /api/learn/search "subject=accountancy&q=goodwill" "" 200 "Find: chapters, lessons and cards with match spans"
rec cards_aop_all_pro "$PRO" GET /api/learn/cards "chapter=$AOP&filter=all" "" 200 "Cards view, Admission of a Partner, every card"
rec cards_aop_must_pro "$PRO" GET /api/learn/cards "chapter=$AOP&filter=must" "" 200 "Cards view, Must-know filter"
rec cards_subject_due_pro "$PRO" GET /api/learn/cards "subject=accountancy&filter=due" "" 200 "Find's shelf over the subject, cards due today"
rec preview_aop_5_pro "$PRO" POST /api/learn/runs/preview "" "$(preview_body "$AOP" 5 '[]')" 200 "Chapter page at 5 min (resume row: the unfinished run)"
rec preview_aop_10_pro "$PRO" POST /api/learn/runs/preview "" "$(preview_body "$AOP" 10 '[]')" 200 "Chapter page at 10 min"
rec preview_aop_20_pro "$PRO" POST /api/learn/runs/preview "" "$(preview_body "$AOP" 20 '[]')" 200 "Chapter page at 20 min"
rec preview_aop_10_out_questions_pro "$PRO" POST /api/learn/runs/preview "" "$(preview_body "$AOP" 10 '["questions"]')" 200 "Chapter page, the Questions pile left out"
rec preview_pf_10_pro "$PRO" POST /api/learn/runs/preview "" "$(preview_body "$PF" 10 '[]')" 200 "Basic Concepts at 10 min: due cards and open mistakes"
rec preview_cpsr_20_pro "$PRO" POST /api/learn/runs/preview "" "$(preview_body "$CPSR" 20 '[]')" 200 "Change in Profit Sharing Ratio at 20 min: four piles (cards, questions, mistakes, lesson), nothing short"
rec preview_cpsr_20_addnext_pro "$PRO" POST /api/learn/runs/preview "" "$(preview_body "$CPSR" 20 '[]' '"addNext":true')" 200 "The same asking for the next chapter too (nothing short, so none is added)"
rec preview_ccss_20_pro "$PRO" POST /api/learn/runs/preview "" "$(preview_body "$CCSS" 20 '[]')" 200 "A short chapter at 20 min: shrink (pool) with addNext offered"
rec preview_ccss_20_addnext_pro "$PRO" POST /api/learn/runs/preview "" "$(preview_body "$CCSS" 20 '[]' '"addNext":true')" 200 "The same with the next chapter added (added)"
rec error_404_chapter_not_found_preview "$PRO" POST /api/learn/runs/preview "" "$(preview_body "$MISSING" 10 '[]')" 404 "A chapter that is not there (preview)"
rec error_404_chapter_not_found_start "$PRO" POST /api/learn/runs "" "$(start_body feed "$MISSING" 10)" 404 "A chapter that is not there (feed start)"

# ---------------------------------------------------------------- 3. Pro, returning: a feed (Admission of a Partner)
rec run_start_feed_aop_pro "$PRO" POST /api/learn/runs "" "$(start_body feed "$AOP" 10 '"source":"explore_cover","forYou":true,"position":0')" 200 "A 10-minute feed started from the For you cover"
F="$OUT/run_start_feed_aop_pro.json"
FEED_ID="$(get "$F" 'j.id')"
CARD1="$(get "$F" 'j.items.find((i) => i.type === "card").id')"
QRIGHT="$(get "$F" 'j.items.filter((i) => i.type === "question")[0].id')"
QRIGHT_Q="$(get "$F" 'j.items.filter((i) => i.type === "question")[0].question.id')"
QWRONG=""; QWRONG_Q=""
for pair in $(get "$F" 'j.items.filter((i) => i.type === "question").slice(1).map((i) => i.id + "|" + i.question.id).join(" ")'); do
  [ -z "$QWRONG" ] && { QWRONG="${pair%%|*}"; QWRONG_Q="${pair##*|}"; }
  if [ "$(lined "${pair##*|}")" = 1 ]; then QWRONG="${pair%%|*}"; QWRONG_Q="${pair##*|}"; break; fi
done
KRIGHT="$(key_of "$QRIGHT_Q")"; [ -n "$KRIGHT" ] || die "no key learnt for $QRIGHT_Q"
KWRONG="$(key_of "$QWRONG_Q")"; [ -n "$KWRONG" ] || die "no key learnt for $QWRONG_Q"
rec keep_pro "$PRO" POST "/api/learn/runs/$FEED_ID/rate" "" "{\"itemId\":\"$CARD1\",\"keep\":true}" 200 "Keep on the feed's first card: it joins Revise as new"
rec answer_right_pro "$PRO" POST "/api/learn/runs/$FEED_ID/answer" "" "{\"itemId\":\"$QRIGHT\",\"choice\":\"$KRIGHT\"}" 200 "A right answer in the feed"
check "$OUT/answer_right_pro.json" 'j.correct === true'
rec answer_wrong_pro "$PRO" POST "/api/learn/runs/$FEED_ID/answer" "" "{\"itemId\":\"$QWRONG\",\"choice\":\"$(wrong_of "$KWRONG")\"}" 200 "A wrong answer in the feed: the line you needed and its card put back in"
check "$OUT/answer_wrong_pro.json" 'j.correct === false'
rec run_get_feed_aop_pro "$PRO" GET "/api/learn/runs/$FEED_ID" "" "" 200 "The feed read again (?run=): only the items not done, resumed { done, of }"
rec covers_accountancy_pro_open "$PRO" GET /api/learn/covers "subject=accountancy" "" 200 "Covers with today's unfinished feed: resume and 'You stopped at'"
rec run_end_feed_aop_pro "$PRO" GET "/api/learn/runs/$FEED_ID/end" "" "" 200 "The feed's end: done, the kept pile, lines, Another 10 minutes, next, dueOffer"
rec error_409_run_ended "$PRO" GET "/api/learn/runs/$FEED_ID" "" "" 409 "The ended feed read again: RUN_ENDED with endHref"
rec error_404_run_not_found "$PRO" GET "/api/learn/runs/lr_000000000000000000000000" "" "" 404 "A run that is not there"

# ---------------------------------------------------------------- 4. Pro, returning: runs (mix, the resume, recap, cards)
rec run_start_mix_aop_resume_pro "$PRO" POST /api/learn/runs "" "$(start_body mix "$AOP" 10)" 200 "A mix start of Admission of a Partner picks up today's unfinished run"
rec run_start_mix_pf_pro "$PRO" POST /api/learn/runs "" "$(start_body mix "$PF" 10)" 200 "A 10-minute mix of Basic Concepts: due and new cards, questions, open mistakes"
M="$OUT/run_start_mix_pf_pro.json"
MIX_ID="$(get "$M" 'j.id')"
read -r CA CB CC <<< "$(get "$M" 'j.items.filter((i) => i.type === "card").slice(0, 3).map((i) => i.id).join(" ")')"
QMIST="$(get "$M" '(j.items.find((i) => i.type === "question" && i.origin === "mistake") || {}).id')"
QMIST_Q="$(get "$M" '((j.items.find((i) => i.type === "question" && i.origin === "mistake") || {}).question || {}).id')"
rec rate_missed_pro "$PRO" POST "/api/learn/runs/$MIX_ID/rate" "" "{\"itemId\":\"$CA\",\"rating\":1}" 200 "Missed: back later in this run (reinsert)"
rec rate_got_it_pro "$PRO" POST "/api/learn/runs/$MIX_ID/rate" "" "{\"itemId\":\"$CB\",\"rating\":3}" 200 "Got it: the card's return day"
rec rate_easy_pro "$PRO" POST "/api/learn/runs/$MIX_ID/rate" "" "{\"itemId\":\"$CC\",\"rating\":4}" 200 "Easy: the card's return day"
if [ -n "$QMIST" ] && [ -n "$(key_of "$QMIST_Q")" ]; then
  rec answer_mistake_fixed_pro "$PRO" POST "/api/learn/runs/$MIX_ID/answer" "" "{\"itemId\":\"$QMIST\",\"choice\":\"$(key_of "$QMIST_Q")\"}" 200 "An open mistake answered right: fixed, fixedText, the line collapsed"
  check "$OUT/answer_mistake_fixed_pro.json" 'j.fixed === true'
fi
rec run_end_mix_pf_pro "$PRO" GET "/api/learn/runs/$MIX_ID/end" "" "" 200 "The mix's end: done, numbers, lines, the Revise pile, reviseCards, lead and options"
rec run_start_recap_pf_pro "$PRO" POST /api/learn/runs "" "$(start_body recap "$PF" 5)" 200 "A quick recap of Basic Concepts (answers showing, nothing scheduled)"
DUE_RUN="$(get "$OUT/subject_accountancy_pro.json" '(j.suggestions.find((s) => s.kind === "due") || {}).action?.run')"
if [ -n "$DUE_RUN" ]; then
  DUE_BODY="$(printf '%s' "$DUE_RUN" | node -e 'let s="";process.stdin.on("data",(d)=>{s+=d;}).on("end",()=>{const r=JSON.parse(s);process.stdout.write(JSON.stringify({kind:"cards",chapterKey:r.chapterKey,cardIds:r.cardIds,minutes:r.minutes,leaveOut:[],requestKey:process.argv[1]}));});' "$(newkey)")"
  rec run_start_cards_due_pro "$PRO" POST /api/learn/runs "" "$DUE_BODY" 200 "Revise these: the due suggestion's cards as a cards run"
fi

RESUME_ID="$(get "$OUT/run_start_mix_aop_resume_pro.json" 'j.id')"
rec run_end_mix_aop_stopped_pro "$PRO" GET "/api/learn/runs/$RESUME_ID/end" "stop=1" "" 200 "A run stopped part way (Stop here): not ended, stopped true, Continue and the fix key"

# ---------------------------------------------------------------- 5. Free, returning: reads, then the day's one session
rec subject_accountancy_free "$FREE" GET /api/learn/subject "subject=accountancy" "" 200 "Learn home on Free (freeNote)"
rec home_accountancy_free "$FREE" GET /api/learn/home "subject=accountancy" "" 200 "Learn home on Free, Accountancy (freeNote: 5 Key cards free in each chapter)"
rec home_economics_free "$FREE" GET /api/learn/home "subject=economics" "" 200 "Learn home on Free, Economics: the returning offer on Free"
rec covers_accountancy_free "$FREE" GET /api/learn/covers "subject=accountancy" "" 200 "Covers on Free: 20 min composed as 10 (capped where it cuts)"
rec shelves_free "$FREE" GET /api/learn/shelves "subject=accountancy" "" 200 "Shelves on Free"
rec search_goodwill_free "$FREE" GET /api/learn/search "subject=accountancy&q=goodwill" "" 200 "Find on Free: locked cards"
rec cards_aop_all_free "$FREE" GET /api/learn/cards "chapter=$AOP&filter=all" "" 200 "Cards view on Free: locked rows and lockedCount"
rec cards_subject_due_free "$FREE" GET /api/learn/cards "subject=accountancy&filter=due" "" 200 "Find's due shelf on Free"
rec preview_aop_5_free "$FREE" POST /api/learn/runs/preview "" "$(preview_body "$AOP" 5 '[]')" 200 "Chapter page on Free at 5 min"
rec preview_aop_10_free "$FREE" POST /api/learn/runs/preview "" "$(preview_body "$AOP" 10 '[]')" 200 "Chapter page on Free at 10 min (freeSession not used)"
rec preview_aop_20_free "$FREE" POST /api/learn/runs/preview "" "$(preview_body "$AOP" 20 '[]')" 200 "Chapter page on Free at 20 min: composed at 10, capped"
rec run_start_feed_aop_free "$FREE" POST /api/learn/runs "" "$(start_body feed "$AOP" 10)" 200 "A feed on Free (open cards only)"
FF="$OUT/run_start_feed_aop_free.json"
FREE_FEED_ID="$(get "$FF" 'j.id')"
FCARD="$(get "$FF" 'j.items.find((i) => i.type === "card").id')"
FQ="$(get "$FF" 'j.items.find((i) => i.type === "question").id')"
FQ_Q="$(get "$FF" 'j.items.find((i) => i.type === "question").question.id')"
FKEY="$(key_of "$FQ_Q")"
rec keep_free "$FREE" POST "/api/learn/runs/$FREE_FEED_ID/rate" "" "{\"itemId\":\"$FCARD\",\"keep\":true}" 200 "Keep on Free"
rec answer_free_claim "$FREE" POST "/api/learn/runs/$FREE_FEED_ID/answer" "" "{\"itemId\":\"$FQ\",\"choice\":\"${FKEY:-A}\"}" 200 "The first answered question on Free: it claims today's session"
rec error_402_free_session_used "$FREE" POST /api/learn/runs "" "$(start_body feed "$PF" 10)" 402 "A second feed on Free the same day: FREE_SESSION_USED with line, options and resume"
rec subject_accountancy_free_used "$FREE" GET /api/learn/subject "subject=accountancy" "" 200 "Learn home on Free after the day's session (free)"
rec home_accountancy_free_used "$FREE" GET /api/learn/home "subject=accountancy" "" 200 "Learn home on Free after the day's session: That was today's free session, See Pro, the Or rows"
rec covers_accountancy_free_used "$FREE" GET /api/learn/covers "subject=accountancy" "" 200 "Covers on Free after the day's session (free)"
rec preview_pf_10_free_used "$FREE" POST /api/learn/runs/preview "" "$(preview_body "$PF" 10 '[]')" 200 "Chapter page on Free after the day's session: cards only, piles held"
rec run_start_mix_pf_free_cards_only "$FREE" POST /api/learn/runs "" "$(start_body mix "$PF" 10)" 200 "A mix on Free after the day's session: Key cards only (free)"
rec run_end_feed_aop_free "$FREE" GET "/api/learn/runs/$FREE_FEED_ID/end" "" "" 200 "The Free feed's end after the claim: free line, no Another 10 minutes"

# ---------------------------------------------------------------- 6. New students (nothing studied)
rec subject_accountancy_new_pro "$NEWPRO" GET /api/learn/subject "subject=accountancy" "" 200 "Learn home for a new student (the feed suggestion)"
rec home_accountancy_new_pro "$NEWPRO" GET /api/learn/home "subject=accountancy" "" 200 "Learn home for a new student: Start learning Accountancy, Start chapter 1 · 10 min, Skip what you already know, the feed row"
rec covers_accountancy_new_pro "$NEWPRO" GET /api/learn/covers "subject=accountancy" "" 200 "Covers for a new student"
rec shelves_new_pro "$NEWPRO" GET /api/learn/shelves "subject=accountancy" "" 200 "Shelves for a new student (all zero)"
rec preview_aop_10_new_pro "$NEWPRO" POST /api/learn/runs/preview "" "$(preview_body "$AOP" 10 '[]')" 200 "Chapter page on a first visit (firstVisit)"
rec run_start_feed_pf_new_pro "$NEWPRO" POST /api/learn/runs "" "$(start_body feed "$PF" 10)" 200 "A new student's first feed"
rec run_start_level_new_pro "$NEWPRO" POST /api/learn/runs "" "$(start_body level "$PF" 6)" 200 "Find your level: questions from the first chapters"
rec run_start_mix_aop_20_new_pro "$NEWPRO" POST /api/learn/runs "" "$(start_body mix "$AOP" 20)" 200 "A 20-minute mix with the chapter's lesson item"
rec subject_accountancy_new_free "$NEWFREE" GET /api/learn/subject "subject=accountancy" "" 200 "Learn home for a new student on Free"
rec home_accountancy_new_free "$NEWFREE" GET /api/learn/home "subject=accountancy" "" 200 "Learn home for a new student on Free (5 Key cards free in each chapter, real chapter sizes)"
rec covers_accountancy_new_free "$NEWFREE" GET /api/learn/covers "subject=accountancy" "" 200 "Covers for a new student on Free"
rec preview_aop_10_new_free "$NEWFREE" POST /api/learn/runs/preview "" "$(preview_body "$AOP" 10 '[]')" 200 "Chapter page, first visit on Free"

node "$HELPER" finish "$TMPW/manifest.ndjson" "$OUT" "$TAG" "$BASE" "$WEB_COMMIT"
echo "Done: $(wc -l < "$TMPW/manifest.ndjson") fixtures, manifest.json and README.md in $OUT"
