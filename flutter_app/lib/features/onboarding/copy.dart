/// Every user-facing string of the onboarding ("Your sheet"). The voice of a sharp senior who
/// has been through CUET: short, specific, a little dry. Sentence case, no emoji, no
/// exclamation marks, no arrows in buttons, 12-hour times, no defensive footers.
library;

import '../../core/domain/cuet_rules.dart';
import '../../core/copy/formatters.dart' show categoryWords;

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

  /// The stored sheet could not be read and nothing was lost: the key reads it again.
  static const String sheetUnreadable = "Couldn't open the sheet saved on this phone.";

  /// A sheet this build cannot read was kept aside, and the key starts a new one.
  static const String sheetFromNewer = 'Your saved sheet is from a newer MockMob. Update to pick it up, or start a new one here. The old one is kept.';
  static const String sheetBroken = "Your saved sheet couldn't be read, so this starts a new one. The old one is kept.";

  /// The way out when the saved sheet cannot be read or kept aside (the phone's storage is full
  /// or failing): starting a new sheet gives up the old one, so it is confirmed first.
  static const String startOver = 'Start a new sheet';
  static const String startOverTitle = 'Start a new sheet?';
  static const String startOverBody =
      "The sheet saved on this phone can't be opened or copied aside, so starting again replaces it. Freeing some space on the phone and trying again may bring it back.";
  static const String startOverConfirm = 'Start a new sheet';
  static const String startOverKeep = 'Keep trying';

  /// An answer that could not be written to the phone (storage full or failing).
  static const String saveFailed = "Couldn't save your last answer on this phone. It's still on screen.";
  static String welcomeBackLine(int filled, int of) => '$filled of $of filled';
  static const String mobiHello = 'Mobi, the MockMob mascot, waving hello';
  static const String mobiSleepy = 'Mobi, the MockMob mascot, yawning';

  /// From 1 to 5 AM Mobi sleeps on the desk until a tap wakes him.
  static const String mobiAsleep = 'Mobi, the MockMob mascot, asleep. Tap to wake him';

  /// From 11 PM until 5 AM: Mobi says it, yawning (from 1 AM, once a tap has woken him).
  static const String lateNight = 'Late one tonight. Two minutes, then sleep.';

  // Mobi's lines. Short, about what happens next, never about the person.
  static const String mobiWelcome = "Hi, I'm Mobi. Let's find yours.";
  static const String mobiWelcomeBack = 'Your sheet kept your place.';
  static String mobiRight(int seconds) => seconds <= 1 ? 'About a second. Clean.' : '$seconds seconds. Clean.';
  static const String mobiTrap = 'Classic trap. Fix below.';

  /// Said when the hold is let go early: the plan is still his to seal, nothing is lost.
  static const String mobiStillYours = 'Still yours to seal.';
  static const String mobiSealed = "Sealed. It's yours.";
  static const String mobiSave = 'Keep it with you.';

  /// What Mobi says on arriving at each step: short, about the step, never about the student.
  static const Map<String, String> mobiArrive = {
    'stage': 'First, where you are now.',
    'course': 'Now, where you want to get.',
    'subjects': 'Be honest about each one.',
    'worry': 'What costs you the most marks?',
    'question': 'One quick question. Clock on.',
    'rhythm': 'How often can you sit down?',
    'plan': 'Here is your plan. Read it through.',
  };

  // Stage.
  static const String stageTitle = 'Which CUET are you writing?';
  static const String stageSupport = 'No dates to type. We work them out.';
  static const String weeksPlaceholder = 'Your weeks to May land here.';
  static String weeksUnit(int year) => 'weeks to the expected May $year window';
  static const String datesNotOut = 'Dates not out yet';
  static const String classElevenNote = 'You\'re early.';
  static const String boardsNote = 'Boards land mid-February to early April. The plan goes lighter then.';
  static const String trackToday = 'Today';
  static String trackMay(int year) => 'May $year';
  static String stageWindow(int year) => 'CUET in May $year';
  static const String stageWindowProbably = 'CUET in May 2027, probably';
  static String stageWeeksSpoken(int year) => 'weeks to the expected May $year window';

  // Course and colleges.
  static const String courseTitle = 'Which seat are you after?';
  static const String courseSupport = 'Commerce at DU, with how many colleges offered seats in Round 1, 2026.';
  static String collegesCount(int n) => n == 1 ? '1 college' : '$n colleges';
  static String collegesUnit(int n) => n == 1 ? 'college' : 'colleges';
  static const String notSure = 'Not sure yet';
  static const String notSureNote = 'You can pick one later in Colleges.';
  static const String ladderTitle = 'Which colleges would you say yes to tomorrow?';
  static const String ladderSupport = 'Lowest Round 1 score in 2026, out of 1000.';
  static String showing(String category) => 'Showing ${categoryWords(category)}';
  static const String categoryTitle = 'Category for the figures';
  static const String categoryNote = 'It only changes which figures you see.';
  static const String openToAny = 'Any college is fine';
  static String showAll(int n) => 'Show all $n';
  static const String showFewer = 'Show fewer';
  static const String changeCourse = 'Change course';
  static const String eightIsMost = '8 is the most. Drop one to add another.';
  static const String findCollege = 'Find a college';
  static const String clearSearch = 'Clear search';
  static String noCollegeMatch(String q) => 'No college matches "$q" in this course.';

  /// "3 of 8 picked.", then what Today does with them once there is a pick.
  static const String pickedTail = 'The first 3 show on Today.';
  static const String onToday = 'On Today';
  static String pickedSpoken(int picked, int of, {required bool tail}) =>
      tail ? '$picked of $of picked. The first 3 show on Today.' : '$picked of $of picked';
  static String barLine(String college, String score, int perPaper) =>
      '$college needed $score of 1000 in Round 1, 2026. That\'s about $perPaper of 250 a paper.';
  static String noSeatsFor(String category) => 'No seats went to ${categoryWords(category)} here in Round 1, 2026.';

  // Subjects.
  static const String subjectsTitle = 'Your subjects. How solid is each, honestly?';
  static const String subjectsSupport = 'Be harsh. Your first check shows where your gut was right.';
  static const String fiveMax = 'Five is the most CUET allows. Drop one to add another.';
  static const String pickOne = 'Pick at least one subject.';
  static const String pickCollege = 'Pick a college to continue, or say any college is fine.';
  static const String commonPicks = 'Common picks';
  static const String addSubject = 'Add a subject';
  static const String addSubjectNote = 'Science, humanities and the rest of the 15 MockMob offers';
  static const String pickerTitle = 'Add a subject';
  static const String searchHint = 'Search subjects';
  static String pickerCount(int n) => n == 0 ? 'Pick up to $kCuetMaxWord. A language or the General Test uses one.' : '$n of $kCuetMaxSubjects on your sheet.';
  static const String notOfferedTitle = 'Not on MockMob yet';
  static const String notOfferedNote = "CUET has these. There's no practice for them here yet, so they can't go on your plan.";
  static const String notOfferedShort = 'No practice here yet';
  static const String languagesLabel = 'Language papers';
  static const String otherPapersLabel = 'Other papers';
  static const String checkingList = 'Checking the full CUET list';
  static const String registryOffline = "Offline, so these are the subjects MockMob offers. The rest of CUET shows when you're back.";
  static String noMatch(String q) => 'Nothing matches "$q". Try a shorter word.';

  // Worry.
  static const String worryTitle = 'Where do your marks actually go?';
  static const String worrySupport = 'Pick the one that stings most. It changes where you start.';

  // Question.
  static String questionTitle(String subject) => 'One question from $subject.';
  static const String questionSupport = 'Answer the way you would in the hall.';
  static String rightIn(int seconds) => seconds <= 1 ? 'Right, in about a second.' : 'Right, in $seconds seconds.';
  static const String trapLead = 'That\'s the trap. The ten-second fix';

  /// Beside the measured seconds, set as a monumental number.
  /// The tick on the pace line under a right warm-up answer.
  static const String examPace = 'Exam pace, about a minute';
  static String paceSpoken(int seconds) =>
      seconds <= 60 ? 'Inside exam pace, about a minute a question.' : 'Slower than exam pace, about a minute a question.';
  static String rightSeconds(int seconds) => seconds <= 1 ? 'second. Right.' : 'seconds. Right.';
  static String optionSemantics(String letter, String text) => 'Option $letter, $text';
  static const String correctAnswer = 'Correct answer';
  static const String yourAnswer = 'Your answer';

  // Rhythm.
  static const String rhythmTitle = 'Pick a pace you can keep.';
  static const String minutesLabel = 'Each session';
  static const String daysLabel = 'Study days';
  static const String timeLabel = 'Around';
  static const String restDays = 'Dotted days are rest days.';
  static const String boardWeeks = 'During boards we count two a week.';
  static String minutes(int m) => '$m min';
  static String minutesSpoken(int m) => '$m minutes';
  static const String minutesUnit = 'minutes';

  // Plan.
  static const String planLead = 'Your plan, built from your answers.';
  static const String planLeadDefaults = 'Your plan, built from your answers and a few defaults.';
  static const String ourDefault = 'our default, change it any time';
  static String planFrom(String date) => 'From $date';
  static const String holdToSeal = 'Hold to seal';
  static const String sealing = 'Keep holding';
  static const String sealIt = 'Tap to seal instead';

  /// The one line under Hold to seal: how the hold works, and the tap for anyone who cannot hold
  /// (the whole line is the tap; TalkBack reads it as [sealIt]).
  static const String sealHint = 'Hold for a second, or tap here to seal.';

  /// The plan shows three lines (week one, the pace, the aim); the rest unfold in place.
  static String seeAllLines(int n) => 'See all $n';
  static const String fewerLines = 'Show fewer';
  static const String change = 'Change';
  static const String sealed = 'Sealed';
  static const String planSet = 'Your plan is set.';
  static const String changeSomething = 'Change something';
  static const String sharpens = 'It sharpens after your first check.';
  static const String changeTitle = 'What do you want to change?';

  // Save.
  static const String saveTitle = 'Keep your sheet.';
  static const String saveSupport = 'Sign in and it follows you to mockmob.in and any phone.';

  /// The quiet line under the sheet: no fixed set of mocks, a fresh paper from the live bank. The
  /// number is quoted only when `/api/stats` was read; "never repeats" is not claimed (the
  /// selector favours questions not yet seen, it does not forbid a repeat).
  static String bankLine(int? questions) => questions == null
      ? 'Practice is not a fixed set of mocks: every paper is built fresh from the live question bank.'
      : 'Practice is not a fixed set of mocks: every paper is built fresh from the live question bank of ${groupThousands(questions)} questions.';

  /// 8197 as "8,197".
  static String groupThousands(int n) {
    final s = n.abs().toString();
    final out = StringBuffer(n < 0 ? '-' : '');
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) out.write(',');
      out.write(s[i]);
    }
    return out.toString();
  }
  static const String ageQuestion = 'Quick one: are you 18 yet?';
  static const String ageNote = 'Under 18, usage tracking stays off.';

  /// The hint on a sign-in key that waits for the age question above it.
  static const String ageFirst = 'Answer the age question first';
  static const String continueWithGoogle = 'Continue with Google';
  static const String googleBusy = 'Signing in';
  static const String cancelBrowser = 'Cancel';
  static const String useEmailCode = 'Use an email code';
  static const String notNow = 'Not now';
  static const String offline = 'You\'re offline. Connect to save your sheet.';
  static String sealedAt(String time, String chapter) => 'Sealed at $time. Week one starts with $chapter.';

  // First move.
  static const String firstMoveTitle = 'Your starting point';
  static const String firstMoveUnit = 'questions to your starting point';
  static String firstMoveChapter(String chapter) => 'Week one starts with $chapter.';
  static const String startNow = 'Start now, about 10 minutes';
  static const String checkNeedsAccount = 'The check is marked on our server, so it needs your account.';

  // First move when none of the subjects has a starting-point check: plain practice, said plainly.
  static const String firstPracticeTitle = 'Your first move';
  static String practiceUnit(String subject) => 'questions in $subject';
  static String startPractice(String subject) => 'Start with 10 questions in $subject';
  static const String practiceNeedsAccount = 'Practice is marked on our server, so it needs your account.';
  static const String mobiFirstMove = 'Ten minutes. I\'ll be here after.';
  static String setFor(String when) => 'Set for ${when[0].toLowerCase()}${when.substring(1)}. It waits here when you open MockMob.';
  static const String saveNow = 'Save my sheet';

  // The first seven days under the first move.
  static const String weekAheadTitle = 'Your first week';
  static const String today = 'Today';
  static String weekAheadPace(int minutes, String time) => '$minutes min, around $time';
  static String weekAheadSpoken(List<String> days, int minutes, String time) {
    if (days.isEmpty) return '$weekAheadTitle: rest this week.';
    final list = days.length == 1 ? days.first : '${days.sublist(0, days.length - 1).join(', ')} and ${days.last}';
    return '$weekAheadTitle: $list, $minutes minutes around $time.';
  }

  // After sign-in (the "Before you start" sheet).
  static const String savingSheet = 'Saving your sheet';
  static const String savedSheet = 'Saved to your account.';
  /// What the account holds, said once the server has it. The colleges are named only after the
  /// server's own list shows them (never before): [savedWhat] when the sheet has none,
  /// [savedWhatColleges] once they are on the account, and [savedWhatCollegesLater] when they
  /// could not be moved yet (nothing is claimed that is not so).
  static const String savedWhat = 'Subjects, study days and study time are on your account.';
  static const String savedWhatColleges = 'Subjects, study days, your course and colleges are on your account.';
  static const String savedWhatCollegesLater =
      "Subjects and study days are on your account. Your colleges are still on this phone; they move when you're back online.";
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
      'version. We do not collect your answers, marks, questions, contacts, location or an advertising ID. You '
      'can turn this off any time here and collection stops straight away.';
  static const String usageSummary = 'Counts which parts of the app are used. Never your answers, marks or location.';
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
