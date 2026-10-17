// What the landing says about Score Recovery, by its real release state (data/capabilities.js, CAPABILITIES.recovery).
// Replay, find and plan run after every mock today. The delayed fresh checks belong to Recovery, which is not released
// while recovery.state is anything but 'available' (/recovery itself says "Recovery steps open soon."), so until then
// the page sells only what runs today and names the checks as opening soon. The in-app "Try five fresh questions" on a
// missed chapter (MistakeReplay) is live, so the statement can promise that. /pricing gates the same way.
const LIVE = {
  statement: 'Fix the reason, not just the answer. Prove it on fresh questions days later. Then test your DU shortlist against real cutoffs.',
  title: 'Fix it once. Check it holds.',
  sub: 'The Mistake Lab reads one mock. The Score Recovery Lab works on one leak over days: it finds it, sets one next move, then checks the fix on fresh questions.',
  checkTitle: 'Check it on fresh questions',
  checkBody: 'New questions, days apart, show whether the fix held.',
  checkHead: 'Questions you have not answered before',
  checkStatus: 'Open for every repair you finish.',
  soon: false,
};

const SOON = {
  statement: 'Fix the reason, not just the answer. Practise five fresh questions on the chapter that cost you. Then test your DU shortlist against real cutoffs.',
  title: 'Find the leak. Make one move.',
  sub: 'The Mistake Lab reads one mock. The Score Recovery Lab follows one leak across your mocks: it replays the answers, finds the chapter behind them and sets one next move. Fresh checks, a few days apart, open soon.',
  checkTitle: 'Fresh checks, opening soon',
  checkBody: 'Checks on new questions, a few days apart. Not open yet.',
  checkHead: 'When it opens: questions you have not answered before',
  checkStatus: 'Opens soon. Until then, practise five fresh questions on the chapter after any mock.',
  soon: true,
};

export function recoveryCopy(state) {
  return state === 'available' ? LIVE : SOON;
}
