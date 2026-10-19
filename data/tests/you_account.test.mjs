// Account (/profile) with the restructure's You page inside it: the pure rules in
// src/components/profile/accountModel.mjs, and source checks that the page keeps every live setting,
// its anchors and the copy rules. Run: node --test data/tests/you_account.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACCOUNT_ANCHORS, COMMUNITY_ROWS, GOAL_COPY, GUIDE_EVENT, HELP_ROWS, SUBJECTS_EDIT_HREF, SUBJECT_LIMIT,
  activePause, anchorFromHash, formatTime12, goalErrorLine, goalFromServer, goalPauseLine, goalSaveBody, goalSavedLine,
  goalSplitLine, goalDaysNotChosenLine, goalWeekdaysLine, sameWeekdays, toggleWeekday, GOAL_WEEKDAYS, mocksSummary, sheetSubjects, subjectCountLine, subjectName, walletLine,
} from '../../src/components/profile/accountModel.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('subject names are the short names students read, never a raw id', () => {
  assert.equal(subjectName('business_studies'), 'Business Studies');
  assert.equal(subjectName('economics'), 'Economics');
  assert.equal(subjectName('gat'), 'General Test');
  assert.equal(subjectName('ECONOMICS'), 'Economics');
  assert.equal(subjectName('some_new_subject'), 'Some new subject');
  assert.equal(subjectName(''), 'Subject');
  assert.equal(subjectName(null), 'Subject');
});

test('the sheet keeps the student order, drops repeats and junk', () => {
  const rows = sheetSubjects(['accountancy', 'economics', 'accountancy', '', 7, null, 'english']);
  assert.deepEqual(rows.map((r) => r.id), ['accountancy', 'economics', 'english']);
  assert.deepEqual(rows.map((r) => r.name), ['Accountancy', 'Economics', 'English']);
  assert.deepEqual(sheetSubjects(undefined), []);
  assert.equal(SUBJECT_LIMIT, 5);
  assert.equal(subjectCountLine(4), '4 of 5 picked');
  assert.equal(subjectCountLine(0), 'None picked yet. Pick up to 5.');
  assert.equal(SUBJECTS_EDIT_HREF, '/onboarding?edit=true');
});

test('mocks at a glance never invent a zero average', () => {
  assert.deepEqual(mocksSummary([]), { count: 0, average: null });
  assert.deepEqual(mocksSummary(null), { count: 0, average: null });
  assert.deepEqual(mocksSummary([{ score: 50 }, { score: 61 }]), { count: 2, average: 56 });
  // A row without a usable score still counts as a mock taken, but not toward the average.
  assert.deepEqual(mocksSummary([{ score: 40 }, { score: null }, { score: 'x' }]), { count: 3, average: 40 });
  assert.deepEqual(mocksSummary([{ score: undefined }]), { count: 1, average: null });
});

test('the credits line: loading, unknown and known are three different things', () => {
  assert.equal(walletLine({ status: 'idle', wallet: null }).state, 'loading');
  const unknown = walletLine({ status: 'unavailable', wallet: { known: false, total: null } });
  assert.equal(unknown.state, 'unknown');
  assert.equal(unknown.total, null);
  assert.match(unknown.line, /did not load/);
  assert.deepEqual(walletLine({ status: 'fresh', wallet: { known: true, total: 9, state: 'available' } }), { state: 'known', total: 9, line: 'Credits left. The free ones are used first.' });
  assert.equal(walletLine({ status: 'fresh', wallet: { known: true, total: 0, state: 'empty' } }).line, 'No credits left.');
  assert.match(walletLine({ status: 'cached', wallet: { known: true, total: 4, state: 'paused' } }).line, /paused/);
});

test('weekly goal: what the server says, what a save sends, and the words', () => {
  assert.equal(goalFromServer({ daysPerWeek: 0 }), null);
  assert.equal(goalFromServer({ daysPerWeek: 8 }), null);
  assert.equal(goalFromServer(null), null);
  // The live server sends no `set`: the days in force are the goal.
  assert.deepEqual(goalFromServer({ daysPerWeek: 4, timezone: 'Asia/Kolkata', pausedUntil: null }), { days: 4, set: true, pausedUntil: null, weekdays: null });
  assert.equal(goalFromServer({ daysPerWeek: 4, set: false }).set, false);

  const now = new Date(2026, 9, 15, 12).getTime();
  assert.equal(activePause('2026-10-20', now), '2026-10-20');
  assert.equal(activePause('2026-10-15', now), '2026-10-15');
  assert.equal(activePause('2026-10-14', now), null);
  assert.equal(activePause('soon', now), null);
  // Changing the goal keeps a pause that is still ahead, and drops one that has ended.
  assert.deepEqual(goalSaveBody(5, '2026-10-20', now), { daysPerWeek: 5, pausedUntil: '2026-10-20' });
  assert.deepEqual(goalSaveBody(5, '2026-10-01', now), { daysPerWeek: 5, pausedUntil: null });
  assert.match(goalPauseLine('2026-11-02', now), /^Study days are paused until 2 Nov\. Changing the goal keeps the pause\.$/);
  assert.equal(goalPauseLine(null, now), null);

  // The chosen weekdays (0 = Monday) are believed only while their count is the goal.
  assert.deepEqual(goalFromServer({ daysPerWeek: 4, weekdays: [5, 0, 3, 1] }).weekdays, [0, 1, 3, 5]);
  assert.equal(goalFromServer({ daysPerWeek: 3, weekdays: [0, 1, 3, 5] }).weekdays, null);
  assert.equal(goalFromServer({ daysPerWeek: 2, weekdays: [0, 9] }).weekdays, null);
  assert.equal(goalFromServer({ daysPerWeek: 2, weekdays: 'Mon' }).weekdays, null);
  assert.deepEqual(goalSaveBody(4, '2026-10-20', now, [5, 3, 1, 0]), { daysPerWeek: 4, pausedUntil: '2026-10-20', weekdays: [0, 1, 3, 5] });
  assert.equal('weekdays' in goalSaveBody(4, null, now), false);
  assert.deepEqual(GOAL_WEEKDAYS.map((d) => d.short), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  assert.equal(GOAL_WEEKDAYS[0].name, 'Monday');
  assert.deepEqual(toggleWeekday([0, 3], 1), [0, 1, 3]);
  assert.deepEqual(toggleWeekday([0, 1, 3], 1), [0, 3]);
  assert.deepEqual(toggleWeekday(null, 6), [6]);
  assert.deepEqual(toggleWeekday([2, 2, 9, -1], 4), [2, 4]);
  assert.equal(sameWeekdays([3, 1], [1, 3]), true);
  assert.equal(sameWeekdays([1], [1, 3]), false);
  assert.equal(sameWeekdays(null, [1]), false);
  assert.equal(sameWeekdays(null, null), false);
  assert.equal(goalDaysNotChosenLine(3), 'Your goal is 3 days a week. Choose which days.');
  assert.equal(goalDaysNotChosenLine(1), 'Your goal is 1 day a week. Choose which days.');
  assert.equal(goalWeekdaysLine([0, 1, 3, 5]), 'You study Mon, Tue, Thu and Sat.');
  assert.equal(goalWeekdaysLine([]), '');
  assert.equal(goalSplitLine(4), '4 study days and 3 rest days.');
  assert.equal(goalSplitLine(1), '1 study day and 6 rest days.');
  assert.equal(goalSplitLine(6), '6 study days and 1 rest day.');
  assert.equal(goalSplitLine(7), GOAL_COPY.everyDay);
  assert.equal(formatTime12(new Date(2026, 9, 15, 16, 30)), '4:30 PM');
  assert.equal(goalSavedLine(new Date(2026, 9, 15, 9, 5)), 'Goal saved at 9:05 AM.');
  assert.match(goalErrorLine({ kind: 'network' }), /not changed/);
  assert.match(goalErrorLine({ status: 422 }), /1 to 7/);
  assert.match(goalErrorLine({ status: 401 }), /Sign in again/);
  assert.match(goalErrorLine(new Error('x')), /Nothing was changed/);
});

test('community and help rows match the live navigation and lead somewhere real', () => {
  const nav = read('src/lib/arenaNavigation.js');
  for (const row of COMMUNITY_ROWS) {
    assert.ok(nav.includes(`'${row.label}'`), `${row.label} is a live navigation label`);
    assert.ok(row.href.startsWith('/'), row.id);
  }
  assert.ok(COMMUNITY_ROWS.some((row) => row.href === '/leaderboard'), 'the leaderboard is linked from Account');
  for (const row of HELP_ROWS) assert.ok(row.href || row.action === 'guide', row.id);
  for (const path of ['src/app/(app)/leaderboard/page.js', 'src/app/(app)/upload', 'src/app/(app)/my-uploads', 'src/app/contact', 'src/app/privacy']) {
    assert.doesNotThrow(() => readFileSync(join(root, path, path.endsWith('.js') ? '' : 'page.js')), path);
  }
  assert.equal(GUIDE_EVENT, 'mockmob:open-guide');
});

test('anchors: a link to /profile#... lands only on a section that exists', () => {
  assert.equal(anchorFromHash('#goal'), 'goal');
  assert.equal(anchorFromHash('#PLAN'), 'plan');
  assert.equal(anchorFromHash('#nowhere'), null);
  assert.equal(anchorFromHash(''), null);
  const sources = [
    'src/app/(app)/profile/ProfilePageClient.jsx', 'src/components/colleges/MyColleges.jsx', 'src/components/profile/YourSheet.jsx',
    'src/components/profile/PlanCredits.jsx', 'src/components/profile/CreditsSection.jsx', 'src/components/profile/AccountLinks.jsx',
  ].map(read).join('\n');
  for (const id of ACCOUNT_ANCHORS) assert.ok(sources.includes(`id="${id}"`), `#${id} exists on the page`);
});

test('the account page keeps every live setting and has one Mobi slot beside the name', () => {
  const page = read('src/app/(app)/profile/ProfilePageClient.jsx');
  for (const piece of ['<UsageDataSection />', '<SignOutOtherDevicesSection />', '<DeleteAccountSection />', '<LookAndFeelCard />', '<PlanCredits', '<YourSheet', '<GoalControl />', '<AccountLinks />', '<SignOutControl />', 'ArenaHead']) {
    assert.ok(page.includes(piece), `${piece} is on the page`);
  }
  assert.ok(read('src/components/profile/PlanCredits.jsx').includes('<PlanCard />'), 'the live plan card stays');
  assert.ok(page.includes('lookMobi ? \'hidden\' : \'visible\''), 'the sheet Mobi steps aside while the Appearance Mobi is on screen');
  assert.equal((page.match(/<MobiReact /g) || []).length, 1, 'one Mobi in the page itself');
  assert.ok(read('src/components/profile/YourSheet.jsx').includes("from '@/components/brand/SubjectObject'"), 'subjects use the shared 3D objects');
});

test('copy rules: no exclamation marks, no em dashes, no middle dots in what students read', () => {
  const files = [
    'src/components/profile/accountModel.mjs', 'src/components/profile/YourSheet.jsx', 'src/components/profile/PlanCredits.jsx',
    'src/components/profile/GoalControl.jsx', 'src/components/profile/SignOutControl.jsx', 'src/components/profile/SignOutConfirm.jsx', 'src/components/profile/AccountLinks.jsx',
    'src/app/(app)/profile/ProfilePageClient.jsx', 'src/app/(app)/profile/LookAndFeelCard.jsx', 'src/app/(app)/profile/page.js',
  ];
  for (const file of files) {
    const strings = read(file).match(/'[^'\n]*'|`[^`\n]*`|>[^<>{}\n]+</g) || [];
    for (const s of strings) {
      assert.ok(!s.includes('—'), `${file}: em dash in ${s}`);
      assert.ok(!s.includes('·'), `${file}: middle dot in ${s}`);
      assert.ok(!/[A-Za-z]!(\s|$|['`<])/.test(s), `${file}: exclamation in ${s}`);
    }
  }
});

// 19 Oct 2026 (owner G29: "I seriously don't see sign out of this browser"): Sign out is a labelled row, first in its own group.
test('G29 account actions: Sign out leads the group, then Sign out of other devices, then Delete account; Sign out is in words in the top bar and the phone More sheet', () => {
  const page = read('src/app/(app)/profile/ProfilePageClient.jsx');
  const group = page.slice(page.indexOf('id="account-actions"'));
  const at = (piece) => { const i = group.indexOf(piece); assert.ok(i > 0, `${piece} is in Account actions`); return i; };
  assert.ok(at('<SignOutControl />') < at('<SignOutOtherDevicesSection />') && at('<SignOutOtherDevicesSection />') < at('<DeleteAccountSection />'));
  assert.ok(!page.slice(0, page.indexOf('id="account-actions"')).includes('<SignOutControl />'), 'Sign out is no longer tucked inside the name card');
  // Release 11 walk: every Sign out key is the one confirm (SignOutConfirm.jsx), which holds the words.
  assert.match(read('src/components/profile/SignOutConfirm.jsx'), /title: 'Sign out'/);
  assert.match(read('src/components/profile/SignOutControl.jsx'), /<SignOutButton className="acct-key">/);
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  assert.equal((shell.match(/<span>Sign out<\/span>/g) || []).length, 2, 'the top bar and the phone More sheet both say Sign out in words');
  assert.ok(!/aria-label="Sign out"/.test(shell), 'no icon-only Sign out left');
  assert.ok(ACCOUNT_ANCHORS.includes('account-actions') && ACCOUNT_ANCHORS.includes('sign-out') && ACCOUNT_ANCHORS.includes('sign-in') && ACCOUNT_ANCHORS.includes('delete'));
});
