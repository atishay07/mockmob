/// Every user-facing string of the onboarding feature (spec 5.1). Sentence case, no middle dots,
/// no emoji, no arrows on keys, no exclamation successes, 12-hour times. Work that has not left
/// the device is worded "On this phone"; the word for server-acknowledged work appears only
/// after the server has replied.
library;

abstract final class OnboardingCopy {
  // Shared.
  static const String back = 'Back';
  static const String notAffiliated = 'MockMob is not affiliated with NTA or Delhi University.';

  // Welcome (5.1.1).
  static const String welcomeHeadline = "Find the marks you're losing. Repair the mistake.";
  static const String welcomeLead = 'Start with five CUET-style questions. No account needed.';
  static const String welcomeSheetHint = 'Your answer sheet fills in as you go.';
  static const String tryFive = 'Try 5 questions';
  static const String continueSample = 'Continue the sample';
  static const String seeMyResult = 'See my result';
  static const String haveAccount = 'I already have an account';
  static const String mobiGreetingLabel = 'Mobi, the MockMob folded-sheet mascot, waving hello';

  /// Shown on a return to Welcome while the guest sample is part way through.
  static String welcomeBack(int answered, int total) =>
      'You answered $answered of $total. Your answers are on this phone. Pick up where you left off.';
  static const String welcomeBackComplete = 'You finished the sample. Your five answers are on this phone.';

  // Subject (5.1.2).
  static const String subjectTitle = 'Which paper first?';
  static const String subjectReason = 'We use this to set up your first mock. You can change this later in You.';
  static const String sameQuestions = 'The five sample questions are the same for every paper.';
  static const String otherSubjects = 'Other subjects';
  static const String otherSubjectsNote =
      'These papers work in MockMob. The free first diagnostic and the free first full mock are for English, '
      'Accountancy, Business Studies and Economics.';
  static const String otherSubjectsClose = 'Close';

  // Sample questions (5.1.3).
  static const String sampleCaption = 'Sample questions. This is not a diagnosis.';
  static const String sampleDisclaimer = 'Five original sample questions. No signup. Not an official PYQ or a scored diagnostic.';
  static const String nextQuestion = 'Next question';
  static const String answerCorrect = 'Correct';
  static const String answerWrong = 'Not quite';
  static const String onThisPhone = 'On this phone';

  static String position(int index, int total) => 'Question $index of $total';
  static String answerIs(String key, String text) => 'The answer is $key, $text.';
  static String optionLabel(String key, String text) => 'Option $key, $text';
  static const String semanticsYourAnswer = 'Your answer';
  static const String semanticsCorrectAnswer = 'Correct answer';
  static const String semanticsCorrect = 'Correct';
  static const String semanticsWrong = 'Wrong';

  // Sample result (5.1.4).
  static String resultFigureNumber(int correct) => '$correct';
  static String resultFigureRest(int total) => 'of $total correct';
  static String resultFigureSemantics(int correct, int total) => '$correct of $total correct';
  static const String resultLine =
      'Sample, not a diagnosis. Five questions can show how MockMob explains things. They cannot say where you stand.';
  static const String resultSheetNote = 'This is your answer sheet. After a mock, the same sheet shows every question.';
  static const String exampleLabel = 'Example, not your plan yet';
  static const String exampleBody = 'After your first full mock, your first thing to fix appears here, with the evidence behind it.';
  static const String saveAndContinue = 'Save this and continue';
  static const String tryAnotherSubject = 'Try another subject';
  static String unfinishedTitle(int answered, int total) => 'You have answered $answered of $total';
  static const String unfinishedMessage = 'Finish the sample to see your result. Your answers so far are on this phone.';

  // Account step and carry-over (5.1.5).
  static const String accountTitle = 'Create a free account to keep your five answers and start a mock.';
  static const String accountOnPhone = 'Your five answers are on this phone. Not sent yet.';
  static const String continueWithGoogle = 'Continue with Google';
  static const String useEmailCode = 'Use an email code';
  static const String notNow = 'Not now';
  static const String offlineSignIn = 'You are offline. Connect to sign in.';
  static const String googleUnavailable = 'Google sign-in is not available right now. Use an email code instead.';
  static const String signInFailed = 'Sign-in did not work. Your answers are still on this phone. Try again.';
  static const String importPending = 'Saving';
  static const String importAccepted = 'Saved to your account';
  static const String importFailed = 'We could not save yet. Your answers are still on this phone. Try again.';
  static const String tryAgain = 'Try again';

  // Before you start (5.1.6).
  static const String beforeTitle = 'Before you start';
  static const String ageQuestion = 'Are you 18 or older?';
  static const String ageYes = 'Yes';
  static const String ageNo = 'No';
  static const String agePreferNot = 'Prefer not to say';
  static const String ageNote = 'This only decides your data settings.';
  static const String skipForNow = 'Skip for now';
  static const String consentSaveFailed = 'We could not save that. Your choice was not changed. Try again.';
  static const String consentOffline = 'You are offline. Your choice was not changed.';
  static const String usageTitle = 'Usage data';
  static const String usageSwitchLabel = 'Allow usage data to improve MockMob';
  static const String usageExplanation =
      'We count which parts of the app are used, such as starting a mock or finishing a repair, along with the app '
      'version. We do not collect your answers, marks, questions, contacts, location or an advertising ID. Nothing '
      'goes to ad or analytics companies. You can turn this off any time here and collection stops straight away.';
  static const String seeEvents = 'See every event we collect';
  static const String hideEvents = 'Hide the event list';
  static const String eventsIntro = 'Each event below is sent with the time and the app version only.';
  static const String usageDone = 'Done';
  static const String usageTurnOnFailed = 'We could not turn that on. Usage data is still off. Try again.';
  static const String usageTurnOffFailed = 'Your choice was saved, but deleting earlier data failed. Try again.';
  static const String usageSaving = 'Saving';

  /// The server allowlist of usage events [API 2.2], in plain words.
  static const List<String> eventsPlain = [
    'Starting a mock or practice',
    'Submitting a mock or practice',
    'Opening a result',
    'Opening a recap',
    'Skipping a recap',
    'Seeing a suggested next step',
    'Opening the reason for a suggestion',
    'Starting a suggested step',
    'Dismissing a suggestion',
    'Starting a repair',
    'Finishing a repair',
    'Finishing a fresh check',
    'Answering the reminder permission',
    'Opening a notification',
    'Setting a weekly goal',
    'Meeting a weekly goal',
    'Choosing finish for now',
    'Opening a link into the app',
    'Opening the app',
  ];
}
