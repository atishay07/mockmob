// Words for the insights feature: the record, the question stream, saved questions and Ask.
// Sentence case, no exclamation marks, every number with what it counts.

abstract final class InsightsCopy {
  // ---- Your record -------------------------------------------------------------------------
  static const recordTitle = 'Your record';
  static String recordBasis(int sessions, int questions) =>
      'From your last ${_n(sessions, 'scored session')}, ${_n(questions, 'question')} in all.';
  static const netLabel = 'net marks';
  static const ledgerHeading = 'Where the marks went';
  static String ledgerRight(int n, int marks) => marks == 0 ? '$n right, 0' : '$n right, +$marks';
  static String ledgerWrong(int n) => n == 0 ? '0 wrong, 0' : '$n wrong, -$n';
  static String ledgerBlank(int n) => '$n left blank, 0';
  static const ledgerNote = 'Marking as CUET counts it: +5 right, -1 wrong, 0 blank.';
  static String accuracyLine(int pct, int low, int high, int n) => '$pct% right of $n answered. Likely range $low to $high%.';
  static const signedOutTitle = 'Sign in to open the stream';
  static const signedOutMessage = 'The stream picks questions from your own subjects and remembers what you answered, so it needs your account.';
  static const signIn = 'Sign in';
  static const notNow = 'Not now';
  static String accuracyHeroLine(int low, int high) => 'of answered right, likely $low to $high%';
  static String netOver(int net, int sessions) => '${net > 0 ? '+' : ''}$net net marks over ${sessions == 1 ? '1 session' : '$sessions sessions'}';

  // The figure when the share answered right is not known yet (sparse record).
  static const sparseTitle = 'Record your first 10 answered questions to see your share right';
  static String sparseLine(int answered) => answered == 0
      ? 'Nothing answered yet. Right and wrong answers both count toward it.'
      : '$answered answered so far. Right and wrong answers both count toward it.';

  // Show me: the sessions behind a claim.
  static String showMeSessions(int n) => n == 1 ? 'Show me, the session behind this' : 'Show me, the $n sessions behind this';
  static String evidenceCount(int n) => n == 1 ? '1 session, opens its result.' : '$n sessions, newest first. Each opens its result.';
  static String evidenceMore(int n) => '${_n(n, 'older session')} not listed.';
  static const openSession = 'Opens its result';
  static const behindLedger = 'The sessions behind these marks';
  static const behindFinding = 'The sessions behind this';
  static const behindChanges = 'Sessions with changed answers';
  static const behindPace = 'Sessions with timed answers';
  static const behindWeek = 'Sessions in the last 14 days';

  // The attempts list (trend and by subject) while it loads or after it failed.
  static const attemptsFailed = 'Your sessions did not load, so the trend and subjects are missing.';
  static const attemptsOffline = 'You are offline. Sessions show here once they have loaded.';

  // The trend's points.
  static String trendPointLabel(String day, int marks, int max, int total) => '$day. $marks of $max marks, $total questions.';
  static String trendPointMarks(int marks, int max) => '$marks of $max marks';
  static String trendPointPaper(int total) => '$total questions';

  static const findingsHeading = 'What stands out';
  static String basedOn(int n) => 'Based on ${_n(n, 'question')}';

  static const trendHeading = 'Marks, session by session';
  static const trendCaption = 'Same paper, same length. Formats are never mixed.';
  static const trendOnePoint = 'One more session in this format and the line appears.';
  static String trendLatest(int marks, int max) => '$marks of $max';
  static String trendSessions(int n) => _n(n, 'session');

  static const chaptersHeading = 'Chapters by marks left open';
  static const chaptersCaption = 'Ranked once 4 or more questions are answered in a chapter.';
  static String chapterCounts(int r, int w, int b, int n) => '$r right, $w wrong, $b blank of $n';
  static String chapterOpen(int marks) => '$marks open';
  static String thinToggle(int n) => '${_n(n, 'chapter')} with fewer than 4 answered';
  static const practiseChapter = 'Practise';
  static const practiseThisChapter = 'Practise this chapter';

  static const changesHeading = 'Changed answers';
  static String changesLine(int count, int gains, int losses) => '${_n(count, 'change')}: $gains helped, $losses hurt';
  static const changesNote = 'Changes are counted from device events in timed sessions.';
  static const changesNone = 'No changed answers in timed sessions yet.';

  static const paceHeading = 'Pace';
  static const paceTypical = 'Typical question';
  static const paceSlow = 'Slowest 10%';
  static const paceRight = 'On right answers';
  static const paceWrong = 'On wrong answers';
  static String paceShare(int pct) => '$pct% of your timed minutes went on questions you got wrong.';
  static String paceBasis(int q) => 'Timing from device events, ${_n(q, 'timed question')}.';
  static const paceThin = 'Pace appears after 8 timed questions.';

  static const weekHeading = 'This week and last';
  static const thisWeek = 'Last 7 days';
  static const lastWeek = 'The 7 before';
  static String weekLine(int sessions, int questions) => '${_n(sessions, 'session')}, ${_n(questions, 'question')}';
  static const weekNone = 'No sessions';
  static String activeDays(int n) => 'Active on $n of the last 14 days.';
  static const weekNote = 'Counted from finished sessions, by the day they ended.';

  static const subjectsHeading = 'By subject';
  static String subjectLine(int sessions, int questions) => '${_n(sessions, 'session')}, ${_n(questions, 'question')}';
  static String subjectRight(int pct) => '$pct% right';
  static const subjectNoneAnswered = 'None answered';

  static const proTag = 'Pro';
  static String proMore(int n) => '${_n(n, 'more chapter')} with Pro';
  static const proChanges = 'Changed answers are part of Pro';
  static const proPace = 'Pace is part of Pro';

  static const askKey = 'Ask your record';
  static const emptyTitle = 'Your record starts with one session';
  static const emptyMessage = 'Finish a practice set and this page shows where every mark went, with the questions behind it.';
  static const emptyAction = 'Start a quick 10';
  static const errorTitle = 'Your record could not be read just now';
  static const errorMessage = 'Nothing was charged. Try again in a moment.';
  static const offlineTitle = 'You are offline';
  static const offlineMessage = 'Your record loads when you are back online.';
  static const retry = 'Try again';

  // ---- Entry points ------------------------------------------------------------------------
  static const insightsEntryTitle = 'Where your marks go';
  static String insightsEntryNote(int net, int sessions) => '$net net marks over ${_n(sessions, 'session')}';
  static const insightsEntryEmpty = 'Appears after your first session';
  static const savedEntryTitle = 'Saved questions';
  static String savedEntryNote(int n) => n == 0 ? 'Nothing saved yet' : '$n saved';
  static const streamEntryTitle = 'Question stream';
  static const streamEntryNote = 'Untimed. Answer, then see why.';
  static const findingShowMe = 'Show me, your record behind this';

  // ---- Saved -------------------------------------------------------------------------------
  static const savedTitle = 'Saved questions';
  static String savedCount(int n, int? limit) => limit == null ? '$n saved' : '$n of $limit free slots used';
  static String savedHeld(int n) => '${_n(n, 'saved question')} held for a quality check and hidden for now.';
  static const savedPractise = 'Practise these';
  static const savedEmptyTitle = 'Nothing saved yet';
  static const savedEmptyMessage = 'Save a question from the stream when it deserves another go. It waits here.';
  static const savedEmptyAction = 'Open the question stream';
  static const savedErrorTitle = 'Saved questions did not load';
  static const savedErrorMessage = 'Check your connection and try again.';
  static const remove = 'Remove';
  static const removing = 'Removing';

  // ---- Stream ------------------------------------------------------------------------------
  static const streamTitle = 'Question stream';
  static const savedStreamTitle = 'Saved, one at a time';
  static const allChapters = 'All chapters';
  static const anyDifficulty = 'Any difficulty';
  static const difficultyAll = 'All';
  static const easy = 'Easy';
  static const medium = 'Medium';
  static const hard = 'Hard';
  static String tally(int right, int answered) => '$right of $answered right this sitting';
  static const correct = 'Correct. Keep the reasoning.';
  static String answerIs(String key, String text) => text.isEmpty ? 'The answer is $key.' : 'The answer is $key, $text.';
  static const explanation = 'Why';
  static const noExplanation = 'No written explanation for this one yet.';
  static const noKey = 'This question has no usable answer key. Try the next one.';
  static const next = 'Next question';
  static const skip = 'Skip';
  static const previous = 'Previous';
  static const save = 'Save';
  static const saved = 'Saved';
  static const saving = 'Saving';
  static const unsave = 'Remove from saved';
  static const limitReached = 'Your 25 free save slots are full. Remove a saved question to make room.';
  static const saveFailed = 'Not saved. Check your connection and try again.';
  static const voteUp = 'Good question';
  static const voteDown = 'Poor question';
  static const voteFailed = 'Your vote did not reach us. Try again.';
  static const flag = 'Flag a problem';
  static const flagTitle = 'What is wrong with it?';
  static const flagReasons = ['The answer key is wrong', 'The question is unclear', 'A typo or formatting problem', 'Something else'];
  static const flagSent = 'Flagged. It goes to a check.';
  static const flagFailed = 'The flag did not reach us. Try again.';
  static const askWhy = 'Ask why';
  static const passage = 'Passage';
  static const endTitle = 'That is every ready question here';
  static const endMessage = 'Try another chapter or difficulty, or practise what you saved.';
  static const changeFilters = 'Change filters';
  static const emptyFilterTitle = 'No questions for these filters yet';
  static const emptyFilterMessage = 'Try all chapters or another subject. Questions held for checks stay out of practice.';
  static const emptyPageTitle = 'No ready questions on these pages';
  static const emptyPageMessage = 'Some questions are held for checks. Keep looking further in.';
  static const keepLooking = 'Keep looking';
  static const failedTitle = 'Questions did not load';
  static const failedOffline = 'You are offline. Questions load when you are back.';
  static const failedMessage = 'MockMob could not load questions just now.';
  static const loadMoreOffline = 'Offline. Connect to load more.';
  static const chooseSubject = 'Subject';
  static const chooseChapter = 'Chapter';
  static const chaptersFailed = 'Chapters did not load. All chapters are on.';

  // ---- Ask ---------------------------------------------------------------------------------
  static const askTitle = 'Ask your record';
  static const askIntro = 'Ask about your marks, chapters, timing or week. Those answers come from your own sessions and cost nothing.';
  static const askSuggestions = ['Where am I losing marks?', 'Which chapter should I practise?', 'Am I too slow on wrong answers?'];
  static const askHint = 'Ask a question';
  static const askSend = 'Send';
  static const askSending = 'Sending';
  static String askCostLine(int? balance) =>
      balance == null ? 'Other questions use 1 AI credit.' : 'Other questions use 1 AI credit. You have $balance.';
  static const askPausedLine = 'AI replies are paused just now. Questions about your record still work.';
  static const originPhone = 'From your record. No credits used.';
  static const originRecord = 'From your record. No credits used.';
  static const originModel = 'MockMob AI. 1 credit used.';
  static const originPaused = 'AI replies are paused. No credits used.';
  static const failOffline = 'You are offline. Nothing was sent or charged.';
  static String failNoCredits(int? balance) =>
      'That needs 1 AI credit${balance == null ? '' : ' and you have $balance'}. Questions about your record are free.';
  static const failPaused = 'AI replies are paused just now. Nothing was charged.';
  static const failResend = 'That did not go through and nothing was charged. Send it again.';
  static const failRate = 'That is a lot of questions in a minute. Wait a moment, then send again.';
  static const failTooLong = 'That is too long. Keep it under 1,500 characters.';
  static const failUnavailable = 'MockMob could not answer just now. Nothing was charged.';
  static const sendAgain = 'Send again';

  // AI replies: a plain caveat, a way to report, and a one-time notice before the first send.
  static const aiCaveat = 'AI wrote this and can be wrong. Check it against your record.';
  static const reportReply = 'Report this reply';
  static const reportTitle = 'What is wrong with this reply?';
  static const reportReasons = ['It is wrong about my record', 'It is wrong about the subject', 'It is unsafe or unkind', 'Something else'];
  static const reportSent = 'Reported. It goes to a check.';
  static const reportWaiting = 'Report saved on this phone. It is sent when you are back online.';
  static const reportFailed = 'The report did not reach us. Try again in a moment.';
  static const disclosureTitle = 'This question goes to an AI service';
  static const disclosureBody = 'MockMob answers questions about your record on this phone. Other questions are sent, '
      'with a short summary of your record, to an AI service that writes the reply. It uses 1 AI credit and can be wrong.';
  static const disclosureSend = 'Send it';
  static const disclosureNotNow = 'Not now';
  static String askAboutQuestion(String body, String? key) {
    final trimmed = body.length > 900 ? '${body.substring(0, 900)}...' : body;
    return 'Explain this question step by step: "$trimmed"${key == null ? '' : ' The answer is $key.'}';
  }

  static String _n(int n, String word) => '$n $word${n == 1 ? '' : 's'}';
}
