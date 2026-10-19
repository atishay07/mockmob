// Every string of the Colleges tab, the chooser's ladder and Check a score. Plain words, real
// figures with their scale, no "CUET score", no "CSAS", no chances.

import '../../../core/models/my_colleges.dart';
import '../copy.dart' show categoryLabel;
import '../estimate/estimate.dart';

abstract final class CollegesCopy {
  static const String title = 'Colleges';

  // My colleges.
  static const String myColleges = 'My colleges';
  static const String edit = 'Edit';
  // Today shows the three that need the most marks, with "See all" for the rest (19 Oct, D104).
  static String caption(int n) => n > 3 ? '$n of ${MyColleges.maxColleges}. Today shows the 3 that need the most marks.' : '$n of ${MyColleges.maxColleges}';
  static const String addCollege = 'Add a college';
  static const String loading = 'Loading your colleges';

  // The rung.
  static const String roundOne = 'Round 1, 2026';
  static const String noSeat = 'No Round 1 seat';
  static const String figureOffline = 'Figure loads when you’re online';
  static String rungChoice(int n, String college, String programme) => programme.isEmpty ? 'Choice $n, $college' : 'Choice $n, $college, $programme';
  static String rungFigure(String f) => 'Round 1, 2026: $f of 1000';
  static String rungVerdict(String words) => 'Your estimate: $words';

  // The estimate bar.
  static const String yourEstimate = 'Your estimate';
  static const String of1000 = 'of 1000';
  static const String change = 'Change';
  static String source(EstimateSource s, String category) => '${switch (s) {
        EstimateSource.mocks => 'From your latest full mocks',
        EstimateSource.projection => 'From your practice projection',
        EstimateSource.typed => 'Typed by you',
      }}, ${categoryLabel(category)}';
  static const String noEstimate = 'Your full mocks will show here against each college.';
  static const String typeEstimate = 'Type an estimate';

  // Empty.
  static const String emptyTitle = 'Which colleges are you aiming for?';
  static const String emptyBody = 'Pick a course, then the colleges you’d say yes to. Each shows its lowest Round 1 score from 2026.';
  static const String choose = 'Choose your colleges';

  /// The sample row of the empty state (tagged "Example"): the first choice and what it will show.
  static const String sampleTitle = 'Your first choice';
  static const String sampleNote = 'Your course. Its lowest Round 1 score shows here.';
  static const String signedOut = 'Sign in to keep a list of colleges.';
  static const String signIn = 'Sign in';

  // Compass card.
  static const String compassTitle = 'Admission Compass';
  static String compassFigure(int open, int total) => '$open of $total';
  static String compassOpens(int subjects) => 'DU programmes open to your $subjects ${subjects == 1 ? 'subject' : 'subjects'}';
  static const String compassNoSubjects = 'See which DU programmes your subjects open.';
  static const String openCompass = 'Open Compass';

  // Tools.
  static const String checkTitle = 'Check a score';
  static const String checkNote = 'See which colleges a score clears';
  static const String comboTitle = 'Combo planner';
  static const String comboNote = 'Find the papers that open your courses';
  static const String guideTitle = 'CUET 2027 exam guide';
  static const String guideNote = 'Expected dates and a month-by-month plan';
  static const String pyqTitle = 'Previous-year questions';
  static const String pyqNote = 'How to practise with past papers. Opens the website';
  static const String docsTitle = 'Official DU documents';
  static const String docsNote = 'The Bulletin and the three round lists';

  static const String dataLine = 'DU data: 2026 admission rounds and the UG Bulletin 2026-27.';

  // The ladder in the chooser.
  static String picked(int n) => n >= 1 ? '$n of ${MyColleges.maxColleges} picked. Today shows the 3 that need the most marks.' : 'Pick up to ${MyColleges.maxColleges}. Today shows the 3 that need the most marks.';
  static const String onToday = 'On Today';
  static const String full = '8 is the most. Drop one to add another.';
  static String showAll(int n) => 'Show all $n';
  static String noRoundOneFor(String category) => 'No Round 1 seat for ${categoryLabel(category)}';
  static const String findCollege = 'Find a college';
  static const String findProgramme = 'Find a course, like B.Com';
  static String programmeCount(int n) => n == 1 ? '1 programme' : '$n programmes';
  static String programmeNote(int colleges, String? low, String? high) {
    final n = colleges == 1 ? '1 college' : '$colleges colleges';
    if (low == null || high == null) return n;
    return low == high ? '$n. Round 1: $low' : '$n. Round 1: $low to $high';
  }
  static const String noList = 'No CUET cutoff list published';
  static String nothingMatches(String q) => 'Nothing matches “$q”. Try the course’s short name, like B.Com.';
  static String searchCollegesIn(String course) => 'Search $course colleges';
  static const String addTitle = 'Add a college';
  static const String done = 'Done';
  static const String back = 'Back';
  static String courseChip(String name) => '$name · Change';
  static const String onTodayLine = 'On Today above this line';
  static String removed(String college) => 'Removed $college.';
  static const String undo = 'Undo';
  static String pickLabel(String college, String figure, bool picked, int? n) =>
      picked ? 'Choice $n, $college, $figure. Tap to remove.' : 'Add $college, $figure.';

  // Check a score.
  static const String checkHeading = 'Check a score';
  static const String category = 'Category';
  static const String from = 'From';
  static const String to = 'To';
  // The field's help and problems, and the headline's words, live in EstimateCopy (one parser and
  // one pair of words, "safe" and "in reach", for every screen: owner, 19 Oct, G18).
  static const String typeToSee = 'Type a score to see which colleges it reaches.';
  static const String seeEvery = 'See every programme';
  static const String useAsEstimate = 'Use as my estimate';
  static const String savedEstimate = 'Saved as your estimate.';
  static const String typeToUse = 'Type a score first.';
  static const String toWord = 'to';

  // The estimate sheet.
  static const String fromMocks = 'From your latest full mocks';
  static const String fromProjection = 'From your practice projection';
  static const String typeOwn = 'Type your own';
  static const String clearEstimate = 'Clear my estimate';
  static String partial(int filled, List<String> missing) {
    final need = missing.isEmpty
        ? ''
        : ' ${_and(missing)} still ${missing.length == 1 ? 'needs' : 'need'} one.';
    return 'Full mocks in $filled of the 4 papers DU counts.$need';
  }

  static String practise(String subject) => 'Practise $subject';
  static String _and(List<String> xs) => xs.length <= 1 ? xs.join() : '${xs.sublist(0, xs.length - 1).join(', ')} and ${xs.last}';

  static const String loadingCutoffs = 'Loading DU cutoffs';
  static const String cutoffsOffline = 'Cutoffs load once with a connection, then stay on this phone.';
  static const String tryAgain = 'Try again';
}
