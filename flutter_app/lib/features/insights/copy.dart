// Words for the insights feature: the record, the question stream, saved questions and Ask.
// Sentence case, no exclamation marks, every number with what it counts.

abstract final class InsightsCopy {
  // ---- Your record -------------------------------------------------------------------------
  static const recordTitle = 'Your record';
  // Short on purpose: it must sit on one line over the figure, with no word left alone below it.
  static String recordBasis(int sessions, int questions) => '${_n(sessions, 'scored session')}, ${_n(questions, 'question')}';
  /// A signed figure with a true minus sign (U+2212), never a hyphen: +5, 0, −1.
  static String signed(int n) => n > 0 ? '+$n' : (n < 0 ? '−${-n}' : '0');
  static const netLabel = 'net marks';
  static const ledgerHeading = 'Where the marks went';
  // The marks arithmetic is said once, in netOver; the legend names each kind and its count.
  static String ledgerRight(int n, int marks) => '$n right';
  static String ledgerWrong(int n) => '$n wrong';
  static String ledgerBlank(int n) => '$n blank';
  static String sheetScrubRight(int n, int answered) => 'Right, $n of $answered answered';
  static String sheetScrubWrong(int n, int answered) => 'Wrong, $n of $answered answered';
  static String sheetScrubBlank(int n, int questions) => 'Left blank, $n of $questions questions';
  static String sinceLastLook(int change) {
    final n = change.abs();
    return '${change > 0 ? 'Up' : 'Down'} $n ${n == 1 ? 'point' : 'points'} since your last look';
  }
  /// The chip over the trend chart while a finger drags along it.
  static String trendScrub(int marks, int max, String day, int? delta) {
    final base = '${marks < 0 ? '−${-marks}' : marks} of $max on $day';
    if (delta == null) return base;
    if (delta == 0) return '$base, level with the session before';
    return '$base, ${delta.abs()} ${delta > 0 ? 'up' : 'down'} on the session before';
  }
  static String sheetScale(int per) => 'Each bubble stands for about $per questions.';
  static const kindLeak = 'Where marks leak';
  static const kindGood = 'Working';
  static const kindNote = 'Worth knowing';
  static const ledgerNote = 'CUET marking: +5 right, −1 wrong, 0 blank.';
  static String accuracyLine(int pct, int low, int high, int n) => '$pct% right of $n answered. Likely range $low to $high%.';
  static const signedOutTitle = 'Sign in to open the stream';
  static const signedOutMessage = 'The stream picks questions from your own subjects and remembers what you answered, so it needs your account.';
  static const signIn = 'Sign in';
  static const notNow = 'Not now';
  static String accuracyHeroLine(int low, int high) => 'of answered right, likely $low to $high%';
  // Net marks are never stated alone: papers differ in length, so a sum over sessions means
  // nothing by itself. It always carries the marks that were on offer.
  static String netOver(int net, int offered, int sessions) =>
      '${signed(net)} net marks of $offered on offer over ${sessions == 1 ? '1 session' : '$sessions sessions'}';

  // The figure when the share answered right is not known yet (sparse record).
  static const sparseTitle = 'Not enough answers yet';
  static String sparseLine(int answered, {int blank = 0}) {
    if (answered == 0) {
      return blank > 0
          ? 'You left ${blank == 1 ? 'it' : 'all $blank'} blank. Answer 10 questions to see your share right.'
          : 'Answer 10 questions to see your share right.';
    }
    final more = answered >= 10 ? 1 : 10 - answered;
    return '$answered answered so far. Answer $more more to see your share right.';
  }

  // Show me: the sessions behind a claim.
  static String showMeSessions(int n) => n == 1 ? 'Show me, the session behind this' : 'Show me, the $n sessions behind this';
  static String evidenceCount(int n) => n == 1 ? '1 session, opens its result.' : '$n sessions, newest first. Each opens its result.';
  static String evidenceMore(int n) => '${_n(n, 'older session')} not listed.';
  static const openSession = 'Opens its result';
  static String showMeCount(int n) => n == 1 ? '1 session' : '$n sessions';
  static const behindLedger = 'The sessions behind these marks';
  static const behindFinding = 'The sessions behind this';
  static const behindChanges = 'Sessions with changed answers';
  static const behindPace = 'Sessions with timed answers';
  static const behindWeek = 'Sessions in the last 14 days';

  // The attempts list (trend and by subject) while it loads or after it failed.
  static const attemptsFailed = 'Your sessions did not load, so the trend and subjects are missing.';
  static const attemptsOffline = 'You are offline. Sessions show here once they have loaded.';
  static const staleNote = 'Offline. Showing what was last loaded.';

  // The trend's points.
  static String trendPointLabel(String day, int marks, int max, int total) => '$day. $marks of $max marks, $total questions.';
  static String trendPointMarks(int marks, int max) => '$marks of $max marks';
  static String trendPointPaper(int total) => '$total questions';

  static const findingsHeading = 'What stands out';
  static String basedOn(int n) => 'Based on ${_n(n, 'question')}';

  static const trendHeading = 'Marks, session by session';
  static const trendCaption = 'Same paper, same length. Formats are never mixed.';
  static String trendBest(int marks) => 'Best $marks';
  static const trendDeltaNote = 'on the session before';
  static String trendDeltaLabel(int d) => d == 0
      ? 'The same marks as the session before'
      : (d > 0 ? '$d marks more than the session before' : '${-d} marks fewer than the session before');
  static const trendOnePoint = 'Not enough yet. One more session in this format and the line appears.';
  static String trendReadout(String day, int total) => '$day, ${trendPointPaper(total)}';
  static String trendLatest(int marks, int max) => '$marks of $max';
  static String trendSessions(int n) => _n(n, 'session');

  static const trendFormats = 'Paper formats';
  static const savedSubjects = 'Saved subjects';
  static const streamFilters = 'Stream filters';
  static const chaptersHeading = 'Chapters costing you the most marks';
  static const chaptersCaption = 'Ranked once 4 or more questions are answered in a chapter.';
  static String chapterCounts(int r, int w, int b, int n) => '$r right, $w wrong, $b blank of ${_n(n, 'question')}';
  static String chapterOpen(int marks) => '${_n(marks, 'mark')} open';
  static String thinToggle(int n) => '${_n(n, 'chapter')} with fewer than 4 answered';
  static const practiseChapter = 'Practise';
  static const practiseThisChapter = 'Practise this chapter';

  static const changesHeading = 'Changed answers';
  static String changesLine(int count, int gains, int losses) => '${_n(count, 'change')}: $gains helped, $losses hurt';
  static const changesNone = 'No changed answers in timed sessions yet.';

  static const paceHeading = 'Pace';
  static const paceTypical = 'Typical question';
  static const paceSlow = 'Slowest 10%';
  static const paceRight = 'On right answers';
  static const paceWrong = 'On wrong answers';
  static String paceShare(int pct) => '$pct% of your timed minutes went on questions you got wrong.';
  static String paceBasis(int q) => 'Timed on this phone, ${_n(q, 'timed question')}.';
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

  static const askKey = 'Ask Mobi';
  static const askStripNote = 'Questions about this record, answered on your phone.';
  static const emptyTitle = 'Your record starts with one session';
  static const emptyMessage = 'Finish a practice set and this page shows where every mark went, with the questions behind it.';
  static const emptyAction = 'Start a quick 10';
  static const errorTitle = 'Your record could not be read just now';
  static const errorMessage = 'Nothing was charged. Try again in a moment.';
  static const offlineTitle = 'You are offline';
  static const offlineMessage = 'Your record loads when you are back online.';
  static const retry = 'Try again';

  // ---- Concept checks and playbook (Progress, `GET /api/recovery`) --------------------------
  static const checksHeading = 'Concept checks';
  static const checksCaption = 'Fresh, delayed questions only.';
  static String checkCount(int n) => n == 1 ? '1 delayed check' : '$n delayed checks';
  static const checksEmpty = 'No completed recovery checks yet. Ordinary practice is ready.';
  static const playbookHeading = 'Your playbook';
  static const playbookCaption = 'Strategies you saved from results.';
  static const playbookEmpty = 'Nothing here yet. A strategy and reason saved from a result on the website shows up here.';
  static const playbookUnavailable = 'The playbook could not be read just now. Your sessions are not affected.';
  static const playbookNoReflection = 'No reason written.';
  static const playbookEvidence = 'More evidence needed';
  static const recoveryFailed = 'Your checks and playbook did not load.';
  static const recoveryFailedAgain = 'They still did not load. Try again in a moment.';
  static const retrying = 'Trying again';
  static const recoveryOffline = 'You are offline. Checks and playbook show here once they have loaded.';

  // ---- Entry points ------------------------------------------------------------------------
  static const insightsEntryTitle = 'Where your marks go';
  // The share right means the same over papers of any length; a sum of net marks does not.
  static String insightsEntryNote(int? pctRight, int sessions) =>
      pctRight == null ? _n(sessions, 'session') : '$pctRight% right over ${_n(sessions, 'session')}';
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
  static const removedFromSaved = 'Removed from saved';
  static const undo = 'Undo';
  static const removing = 'Removing';
  static const swipePractise = 'Practise';
  static const swipeRemove = 'Remove';
  static const practiseThisAction = 'Practise this question';
  static const removeThisAction = 'Remove from saved';
  static const allSubjects = 'All';
  static String slotsLabel(int n, int limit) => '$n of $limit free save slots used';

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
  static const passageReadAll = 'Read all';
  static const passageFold = 'Show less';
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
  static const askTitle = 'Ask Mobi';
  static String askCaption(int sessions) => 'Reads your last ${_n(sessions, 'session')}';
  static const askIntro = 'Ask about your marks, chapters, timing or week. Those answers come from your own sessions.';
  static String askGreeting(String? name, int? sessions) {
    final hi = name == null ? 'Hi.' : 'Hi $name.';
    if (sessions == null || sessions == 0) return '$hi Ask me about your marks, chapters, pace or week.';
    return '$hi I have read your last ${_n(sessions, 'session')}. Ask me anything about them.';
  }

  static const askGroupRecord = 'About your marks';
  static const askGroupRecordNote = 'Free, from your own answers';
  static const askGroupOpen = 'Ask anything';
  static const askGroupOpenNote = 'Uses 1 credit';
  static const promptLosing = 'Where am I losing marks?';
  static const promptChapter = 'Which chapter should I practise?';
  static const promptPace = 'Am I too slow on wrong answers?';
  static const promptWeek = 'How is my week going?';
  static const promptChanges = 'Do I change answers too much?';
  static const promptBlank = 'What am I leaving blank?';
  static String promptExplain(String? chapter) => 'Explain ${chapter ?? 'the sacrificing ratio'} in simple words';
  static String promptPlan(String? chapter) =>
      chapter == null ? 'Give me a 10 minute revision plan for tonight' : 'Give me a 10 minute revision plan for $chapter';
  static const costFree = 'Free';
  static const previewLosing = 'Reads your wrong and blank answers';
  static const previewChapter = 'Ranks the chapters costing you the most marks';
  static const previewPace = 'Needs timed answers';
  static const previewWeek = 'Counts your last 7 days';
  static const costCredit = '1 credit';
  static const askThinking = 'Thinking it through';
  static const askStillThinking = 'Still thinking. Long questions take a little longer.';
  static const sourceRecord = 'From your record';
  static const sourceModel = 'MockMob AI';
  static const sourcePaused = 'AI replies paused';
  static const creditUsed = '1 credit used';
  static const noCreditsUsed = 'No credits used';
  static const behindAnswer = 'The sessions behind this answer';
  static const openRecord = 'Open your record';
  static const askHint = 'Ask a question';
  static const askHintQuestion = 'What about this mistake is unclear?';

  // Ask Mobi about a repaired mistake (`/ask?q=`): the card the screen opens with.
  static String questionCardTitle(String? chapter) =>
      chapter == null ? 'About the mistake you repaired' : 'About the mistake you repaired, $chapter';
  static String questionPicked(String letter, {required bool hasKey}) =>
      'You picked $letter.${hasKey ? '' : ' The key is being re-checked, so Mobi will not name an answer.'}';
  static String questionRule(String rule) => 'Your rule: $rule';
  static const questionOpening = 'Opening your question.';
  static const questionBlocked = 'Mobi cannot answer this question right now. Nothing was charged.';
  static const questionErrorHelp = 'You can still ask about your recorded practice.';
  static const questionAskRecord = 'Ask about my record';
  static const questionAskElse = 'Ask something else';
  static const questionHint = 'Ask about the mistake above. Your reply uses its text, your pick, the key and your rule, and nothing else about you.';
  static const askSend = 'Send';
  static const askSending = 'Sending';
  static const askPausedLine = 'AI replies are paused just now. Questions about your record still work.';

  // The AI credit wallet, in the website's words where it has them (MockMobAIHub, pricing/prepos):
  // 50 a month on Free, 50 on Pro, purchased credits never expire, a failed reply costs nothing.
  static String aiCredits(int n) => n == 1 ? '1 AI credit' : '$n AI credits';
  static String credits(int n) => n == 1 ? '1 credit' : '$n credits';

  /// Under the field, before anything is sent: what the question in the field will cost.
  static String askNoteIdle(int? balance) => balance == null
      ? 'Questions about your record are free. Others use 1 AI credit.'
      : 'Questions about your record are free. Others use 1 of your ${aiCredits(balance)}.';
  static const askNoteFree = 'Free. Mobi answers this from your record.';
  static String askNoteCost(int? balance) => switch (balance) {
        null => 'Uses 1 AI credit',
        1 => 'Uses your last AI credit',
        final n => 'Uses 1 of your $n AI credits',
      };
  static String askNoteEmpty(String renew) => 'No AI credits left. They renew on $renew. Questions about your record stay free.';

  // The balance in the header, and the sheet it opens.
  static const walletPillUnknown = 'Credits';
  static const walletPillPaused = 'Paused';
  static String walletPillLabel(int? balance, {bool paused = false}) => paused
      ? 'AI replies paused. Credit details'
      : balance == null
          ? 'AI credits. Credit details'
          : '${aiCredits(balance)}. Credit details';
  static const walletTitle = 'Your AI credits';
  static const walletUnknown = 'Your credits could not be read just now. Nothing has been charged.';
  static const walletPaused = 'AI replies are paused just now. Your credits have not been used.';
  static const walletIncluded = 'Included this month';
  static String walletIncludedValue(int left, int of) => '$left of $of left';
  static const walletPurchased = 'Purchased, never expire';
  static const walletRenews = 'Renews';
  static const walletRenewNote = 'Unused included credits do not carry over.';
  static const walletHow = 'How Ask uses credits';
  static const walletHowRecord = 'Questions about your record are free.';
  static const walletHowModel = 'Other questions use 1 credit for a written reply.';
  static const walletHowFailed = 'A reply that fails costs nothing; the credit returns automatically.';
  static const walletAllowance = '50 credits a month on Free, 50 on Pro. Separate from practice credits.';
  static const walletHistory = 'Used in this conversation';
  static const walletHistoryEmpty = 'Nothing yet. Questions about your record never use a credit.';
  static const creditDetails = 'Credit details';
  static const outTitle = 'No AI credits left this month';
  static String outBody(String renew) => 'They renew on $renew. Questions about your record stay free.';
  static const outPro = 'Pro includes 50 AI credits a month.';

  /// What a reply cost, as the server reported it.
  static String chargedLine(int? charged, int? left) => switch (charged) {
        null => 'Check your credits for the final charge',
        0 => 'No credit used',
        final n => left == null ? '${credits(n)} used' : '${credits(n)} used. $left left',
      };
  static const originPhone = 'From your record. No credits used.';
  static String originModel(int? charged, int? left) => 'MockMob AI. ${chargedLine(charged, left)}.';
  static const originPaused = 'AI replies are paused. No credits used.';

  // Why a question got no reply (the server's codes, in plain words), then what it cost.
  static const failOffline = 'You are offline. Send it again when you are back.';
  static String failNoCredits(int? balance, String renew) => balance == null
      ? 'That needs 1 AI credit. Yours renew on $renew. Questions about your record stay free.'
      : 'That needs 1 AI credit and you have $balance. They renew on $renew. Questions about your record stay free.';
  static const failPaused = 'AI replies are paused just now. Questions about your record still work.';
  static const failResend = 'That did not go through. Send it again.';
  static const failRate = 'That is a lot of questions in a minute. Wait a moment, then send again.';
  static const failTooLong = 'That is too long. Keep it under 1,500 characters.';
  static const failUnavailable = 'Mobi could not write a reliable reply just now. Try again in a little while.';
  static const failInProgress = 'That reply is still being written. Send again in a moment.';
  static const failAlreadyAnswered = 'That question was answered once already, but the reply did not reach this phone. Asking again uses 1 more credit.';
  static String failBudget(String renew) => 'AI replies are paused until $renew. Questions about your record still work.';
  static const failWallet = 'MockMob could not reach your credits. Try again.';
  static const failInterrupted = 'That question was cut off. Send it again.';
  static const creditNone = 'No credit used';
  static const creditHeld = 'Your credit is held briefly and returns automatically';
  static const creditNotTwice = 'A question is never charged twice';
  static const creditNoMore = 'Nothing more was charged';
  static const sendAgain = 'Send again';
  static const askAgain = 'Ask again';

  // AI replies: a plain caveat, a way to report, and a one-time notice before the first send.
  static const aiCaveat = 'AI wrote this and can be wrong. Check it against your record.';
  static const aboutReply = 'About this reply';
  static const reportReply = 'Report this reply';
  static const reportTitle = 'What is wrong with this reply?';
  static const reportReasons = ['It is wrong about my record', 'It is wrong about the subject', 'It is unsafe or unkind', 'Something else'];
  static const reportSent = 'Reported. It goes to a check.';
  static const reportWaiting = 'Report saved on this phone. It is sent when you are back online.';
  static const reportFailed = 'The report did not reach us. Try again in a moment.';
  static const disclosureTitle = 'This question goes to an AI service';
  static const disclosureBody = 'MockMob answers questions about your record on this phone. Other questions are sent, '
      'with a short summary of your record, to an AI service that writes the reply. It uses 1 AI credit and can be wrong.';
  static const disclosureTitleQuestion = 'This message goes to an AI service';
  static const disclosureBodyQuestion = 'Your message, the question, your pick, the key and your rule are sent to an AI service '
      'that writes the reply. Nothing else about you is sent. It uses 1 AI credit and can be wrong.';
  static const disclosureSend = 'Send it';
  static const disclosureNotNow = 'Not now';
  static String askAboutQuestion(String body, String? key) {
    final trimmed = body.length > 900 ? '${body.substring(0, 900)}...' : body;
    return 'Explain this question step by step: "$trimmed"${key == null ? '' : ' The answer is $key.'}';
  }

  static String _n(int n, String word) => '$n $word${n == 1 ? '' : 's'}';
}
