/// Every user-facing string of the onboarding ("Your sheet"). The voice of a sharp senior who
/// has been through CUET: short, specific, a little dry. Sentence case, no emoji, no
/// exclamation marks, no arrows in buttons, 12-hour times, no defensive footers.
library;

abstract final class OnboardingCopy {
  // Shared.
  static const String back = 'Back';
  static const String next = 'Continue';
  static const String skip = 'Skip';
  static const String sheetTitle = 'Your sheet';

  // Welcome (the brief's own words).
  static const String welcomeHeadline = 'Every lost mark has a pattern.';

  /// The same line, broken where it reads best at the moment size.
  static const String welcomeHeadlineSet = 'Every lost mark\nhas a pattern.';
  static const String welcomeSupport =
      'MockMob finds yours, helps you repair it, and checks the repair holds. Two minutes to set up.';
  static const String buildPlan = 'Build my plan';
  static const String haveAccount = 'I already have an account';
  static const String continuePlan = 'Pick up my sheet';
  static String welcomeBackLine(int filled, int of) => 'Your sheet is where you left it. $filled of $of filled.';
  static const String mobiHello = 'Mobi, the MockMob mascot, waving hello';
  static const String mobiSleepy = 'Mobi, the MockMob mascot, yawning';

  /// After 11 PM, above the headline.
  static const String lateNight = 'Late one tonight. Two minutes, then sleep.';

  // Stage.
  static const String stageTitle = 'Which CUET are you writing?';
  static const String stageSupport = 'No dates to type. We work them out.';
  static const String weeksPlaceholder = 'Your weeks to May land here.';
  static String weeksUnit(int year) => 'weeks to the expected May $year window';
  static const String datesNotOut = 'Dates not out yet';
  static const String classElevenNote = 'You\'re early. That helps.';
  static const String boardsNote = 'Boards land mid-February to early April. The plan goes lighter then.';

  // Course and colleges.
  static const String courseTitle = 'Which seat are you after?';
  static const String courseSupport = 'Commerce at DU, with how many colleges offered seats in CSAS 2026, Round 1.';
  static String collegesCount(int n) => n == 1 ? '1 college' : '$n colleges';
  static String collegesUnit(int n) => n == 1 ? 'college' : 'colleges';
  static const String notSure = 'Not sure yet';
  static const String notSureNote = 'Fine. The plan works without it.';
  static const String ladderTitle = 'Which colleges would you say yes to tomorrow?';
  static const String ladderSupport = 'The lowest score that got a seat in CSAS 2026, Round 1, out of 1000. Pick up to three.';
  static String showing(String category) => 'Showing $category';
  static const String categoryTitle = 'Category for the figures';
  static const String categoryNote = 'This stays on your phone. It only changes which figures you see.';
  static const String openToAny = 'Any college is fine';
  static String showAll(int n) => 'Show all $n';
  static const String showFewer = 'Show fewer';
  static String courseChange(String course) => '$course, change';
  static const String changeCourse = 'Change course';
  static const String threeIsPlenty = 'Three is plenty. Drop one to swap it.';
  static String barLine(String college, String score, int perPaper) =>
      '$college needed $score of 1000 in Round 1. That\'s about $perPaper of 250 a paper.';
  static String noSeatsFor(String category) => 'No Round 1 seats went to $category here.';

  // Subjects.
  static const String subjectsTitle = 'Your subjects. How solid is each, honestly?';
  static const String subjectsSupport = 'Be harsh. Your first check shows where your gut was right.';
  static const String fiveMax = 'Five is the most a profile takes. Drop one to add another.';
  static const String pickOne = 'Pick at least one subject.';

  // Worry.
  static const String worryTitle = 'Where do your marks actually go?';
  static const String worrySupport = 'Pick the one that stings most. It changes where you start.';

  // Question.
  static String questionTitle(String subject) => 'One question from $subject.';
  static const String questionSupport = 'Answer the way you would in the hall.';
  static String rightIn(int seconds) => seconds <= 1 ? 'Right, in about a second.' : 'Right, in $seconds seconds.';
  static const String trapLead = 'That\'s the trap. The ten-second fix';
  static String optionSemantics(String letter, String text) => 'Option $letter, $text';
  static const String correctAnswer = 'Correct answer';
  static const String yourAnswer = 'Your answer';

  // Rhythm.
  static const String rhythmTitle = 'Pick a pace you can keep.';
  static const String minutesLabel = 'Each session';
  static const String daysLabel = 'Study days';
  static const String timeLabel = 'Around';
  static const String restDays = 'Dotted days are rest days. Rest is part of the plan.';
  static const String boardWeeks = 'During boards we count two a week.';
  static String minutes(int m) => '$m min';

  // Plan.
  static const String planLead = 'Your plan, built from your answers.';
  static const String planLeadDefaults = 'Your plan, built from your answers and a few defaults.';
  static const String ourDefault = 'our default, change it any time';
  static String planFrom(String date) => 'From $date';
  static const String holdToSeal = 'Hold to seal';
  static const String sealing = 'Keep holding';
  static const String sealIt = 'Seal it';
  static const String sealed = 'Sealed';
  static const String changeSomething = 'Change something';
  static const String sharpens = 'It sharpens after your first check.';
  static const String changeTitle = 'What do you want to change?';

  // Save.
  static const String saveTitle = 'Keep your sheet.';
  static const String saveSupport = 'Sign in and it follows you to mockmob.in and any phone.';
  static const String ageQuestion = 'Quick one: are you 18 yet?';
  static const String ageNote = 'Under 18, usage tracking stays off.';
  static const String continueWithGoogle = 'Continue with Google';
  static const String googleBusy = 'Signing in';
  static const String useEmailCode = 'Use an email code';
  static const String notNow = 'Not now';
  static const String offline = 'You\'re offline. Your sheet is safe here; connect to save it.';
  static String sealedAt(String time, String chapter) => 'Sealed at $time. Week one starts with $chapter.';

  // First move.
  static const String firstMoveTitle = 'Your starting point';
  static const String firstMoveUnit = 'questions to your starting point';
  static String firstMoveChapter(String chapter) => 'Week one starts with $chapter.';
  static const String startNow = 'Start now, about 10 minutes';
  static const String checkNeedsAccount = 'The check is marked on our server, so it needs your account. Your sheet comes with you.';
  static const String mobiFirstMove = 'Ten minutes. I\'ll be here after.';
  static String setFor(String when) => 'Set for ${when[0].toLowerCase()}${when.substring(1)}. It waits here when you open MockMob.';
  static const String saveNow = 'Save my sheet';

  // After sign-in (the "Before you start" sheet).
  static const String savingSheet = 'Saving your sheet';
  static const String savedSheet = 'Saved to your account.';
  static const String savedWhat = 'Subjects, study days and study time are on your account. Course and colleges stay on this phone for now.';
  static const String savedFailed = 'Couldn\'t save yet. Your sheet is still on this phone.';
  static const String savedOffline = 'You\'re offline. Your sheet is still on this phone and saves when you\'re back.';
  static const String keptExisting = 'Your account already had subjects, so we kept them. This sheet stays on this phone.';
  static const String tryAgain = 'Try again';
  static const String done = 'Done';
  static const String beforeTitle = 'Before you start';
  static const String ageQuestionPlain = 'Are you 18 or older?';
  static const String ageYes = 'Yes';
  static const String ageNo = 'No';
  static const String agePreferNot = 'Prefer not to say';
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
  static const String usageTurnOnFailed = 'We could not turn that on. Usage data is still off. Try again.';
  static const String usageTurnOffFailed = 'Your choice was saved, but deleting earlier data failed. Try again.';

  /// The server allowlist of usage events (API 2.2), in plain words.
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
