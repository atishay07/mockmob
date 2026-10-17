// What the landing says about Score Recovery, by its real release state (data/capabilities.js, CAPABILITIES.recovery).
// Replay, find and plan run after every mock today, inside the result page's Mistake Lab. The delayed fresh checks
// and the Score Recovery Lab itself belong to Recovery, which is not released while recovery.state is anything but
// 'available' (/recovery itself says "Recovery steps open soon."), so until then the page sells only what runs today
// under the name the app shows (the Mistake Lab), names the checks as opening soon, and does not name the Score
// Recovery Lab at all. The in-app "Try five fresh questions" on a missed chapter (MistakeReplay) appears only where the
// bank holds five unseen, verified questions, so the page promises practice on the chapter, not five fresh questions.
// /pricing gates the same way.
const LIVE = {
  statement: 'Fix the reason, not just the answer. Prove it on fresh questions days later. Then test your DU shortlist against real cutoffs.',
  title: 'Fix it once. Check it holds.',
  mini: 'Score Recovery Lab',
  sub: 'The Mistake Lab reads one mock. The Score Recovery Lab works on one leak over days: it finds it, sets one next move, then checks the fix on fresh questions.',
  checkTitle: 'Check it on fresh questions',
  checkBody: 'New questions, days apart, show whether the fix held.',
  checkHead: 'Questions you have not answered before',
  checkStatus: 'Open for every repair you finish.',
  soon: false,
};

const SOON = {
  statement: 'Fix the reason, not just the answer. Then practise the chapter that cost you, and test your DU shortlist against real cutoffs.',
  title: 'Find the leak. Make one move.',
  mini: 'Across your mocks',
  sub: 'After every mock, the Mistake Lab also follows a leak across your mocks: it replays the answers, finds the chapter behind them and sets one next move. Fresh checks a few days apart open soon.',
  checkTitle: 'Fresh checks, opening soon',
  checkBody: 'Checks on new questions, a few days apart. They open soon.',
  checkHead: 'Questions you have not answered before',
  checkStatus: 'Until then, practise the chapter you missed after any mock, on questions you have not seen where the bank has them.',
  soon: true,
};

export function recoveryCopy(state) {
  return state === 'available' ? LIVE : SOON;
}
