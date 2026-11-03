// Every user-facing string of lesson help (owner ledger L39). The credit words are the website's
// (`usesLine`, `usedLine` in src/lib/creditCopy.mjs and StudyHelp.jsx): the pool is named, the cost
// comes before the send, a failed call costs nothing, and zero credits says when they renew.
// Sentence case, no middle dots, no emoji, no appended arrows.

abstract final class LessonHelpCopy {
  static const String entryLabel = 'Explain this another way';
  static const String entryReady = 'Read your explanation';
  static const String entryReadyNote = 'Already written for this step';
  static const String sheetTitle = 'Explain this another way';

  static const String scope =
      'The reply uses only what this lesson publishes. It does not change your marks or create review cards.';
  static const String freeNote = 'Lessons and recall cards use no AI credits.';

  static const String fieldLabel = 'Your question';
  static const String defaultQuestion = 'Explain this more simply with an example.';
  static const String ask = 'Ask';
  static const String writing = 'Writing your explanation';
  static const String stillWriting = 'Still writing. Longer explanations take a little longer.';
  static const String back = 'Back to the lesson';

  static String aiCredits(int n) => n == 1 ? '1 AI credit' : '$n AI credits';

  /// Before anything is sent: what the question will cost, against the balance the server last
  /// reported. An unknown balance is never written as zero.
  static String cost(int? balance) => switch (balance) {
        null => 'Uses 1 AI credit',
        1 => 'Uses your last AI credit',
        final n => 'Uses 1 of your ${aiCredits(n)}',
      };

  static String empty(String renew) => 'No AI credits left. They renew on $renew. Lessons and recall cards stay free.';
  static const String paused = 'AI replies are paused just now. Lessons and recall cards still work.';
  static const String entryPaused = 'AI replies are paused just now';
  static String entryEmpty(String renew) => 'No AI credits left. They renew on $renew';

  /// The line under a reply: what it cost, as the server reported it.
  static String charged(int? charged, int? left, {bool replayed = false}) {
    if (replayed) return 'Already answered. No more credit used';
    return switch (charged) {
      null => 'Check your AI credits for the final charge',
      0 => 'No credit used',
      final n => left == null ? '${aiCredits(n)} used' : '${aiCredits(n)} used. $left left',
    };
  }

  static const String caveat = 'AI wrote this and can be wrong. Check it against the lesson.';

  // Why a question got no reply, in plain words, then what it cost.
  static const String failOffline = 'You are offline. Send it again when you are back.';
  static String failNoCredits(int? balance, String renew) => balance == null
      ? 'That needs 1 AI credit. Yours renew on $renew. Lessons and recall cards stay free.'
      : 'That needs 1 AI credit and you have $balance. They renew on $renew. Lessons and recall cards stay free.';
  static const String failPaused = paused;
  static const String failResend = 'That did not go through. Send it again.';
  static const String failRate = 'That is a lot of questions in a minute. Wait a moment, then send again.';
  static const String failTooLong = 'That is too long. Keep it under 500 characters.';
  static const String failUnavailable = 'A reliable explanation could not be written just now. Try again in a little while.';
  static const String failInProgress = 'That explanation is still being written. Send again in a moment.';
  static const String failAlreadyAnswered =
      'That question was answered once already, but the reply did not reach this phone. Asking again uses 1 more AI credit.';
  static String failBudget(String renew) => 'AI replies are paused until $renew. Lessons and recall cards still work.';
  static const String failWallet = 'Your AI credits could not be reached. Try again.';
  static const String failStepMoved = 'This step has moved on. Answer the current card first, or reopen the lesson, then ask again.';
  static const String failInterrupted = 'That question was cut off. Send it again.';

  static const String creditNone = 'No credit used';
  static const String creditHeld = 'Your credit is held briefly and returns automatically';
  static const String creditNotTwice = 'A question is never charged twice';
  static const String creditNoMore = 'Nothing more was charged';
  static const String sendAgain = 'Send again';
  static const String askAgain = 'Ask again';
  static const String checkCredits = 'Check your AI credits';

  static const String disclosureTitle = 'This question goes to an AI service';
  static const String disclosureBody =
      'Your question and this step of the lesson are sent to an AI service that writes the reply. '
      'Nothing else about you is sent. It uses 1 AI credit and can be wrong.';
  static const String disclosureSend = 'Send it';
  static const String disclosureNotNow = 'Not now';
}
