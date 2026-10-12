/// Every route of the app (spec 4.2) as constants and path builders. Features navigate with
/// these, never with string literals.
abstract final class AppRoutes {
  // First run and auth.
  static const String splash = '/splash';
  static const String welcome = '/welcome';
  static const String onboardingSubject = '/onboarding/subject';
  static const String onboardingSampleResult = '/onboarding/sample/result';
  static const String signIn = '/sign-in';
  static const String signInCodeBase = '/sign-in/code';
  static const String beforeYouStart = '/before-you-start';

  static String onboardingSample(int i) => '/onboarding/sample/$i';

  /// The email is passed as a query parameter as the spec lists it; it stays inside the app and
  /// is never sent anywhere.
  static String signInCode({String? email}) =>
      email == null ? signInCodeBase : Uri(path: signInCodeBase, queryParameters: {'email': email}).toString();

  // Shell tabs.
  static const String today = '/today';
  static const String practice = '/practice';
  static const String review = '/review';

  // Pushed over the shell: You from the avatar, Learn from Practice and Review.
  static const String learn = '/learn';
  static const String you = '/you';

  // Today.
  static const String todayWeek = '/today/week';
  static const String todayAlternatives = '/today/alternatives';
  static const String todayWeeklyEnding = '/today/weekly-ending';
  static String todayWhy(String actionId) => '/today/why/${Uri.encodeComponent(actionId)}';

  // Practice.
  static const String practiceStart = '/practice/start';
  static String practiceSetup(String mode) => '/practice/setup/${Uri.encodeComponent(mode)}';
  static String practiceResult(String attemptId) => '/practice/result/${Uri.encodeComponent(attemptId)}';

  // Runner.
  static String run(String sessionId) => '/run/${Uri.encodeComponent(sessionId)}';
  static String runSubmit(String sessionId) => '${run(sessionId)}/submit';

  // Result.
  static String result(String attemptId) => '/result/${Uri.encodeComponent(attemptId)}';
  static String resultSealed(String attemptId) => '${result(attemptId)}/sealed';
  static String resultRecap(String attemptId, int card) => '${result(attemptId)}/recap/$card';

  // Review.
  static const String reviewMistakes = '/review/mistakes';
  static const String reviewRecord = '/review/record';
  static String reviewRepair(String attemptId, String questionId) =>
      '/review/repair/${Uri.encodeComponent(attemptId)}/${Uri.encodeComponent(questionId)}';
  static String reviewRepairEnding(String attemptId) => '/review/repair/${Uri.encodeComponent(attemptId)}/ending';

  // Learn.
  static String learnUnit(String unitId) => '/learn/${Uri.encodeComponent(unitId)}';
  static String learnRun(String runId) => '/learn/run/${Uri.encodeComponent(runId)}';
  static String learnRunDone(String runId) => '${learnRun(runId)}/done';

  // You.
  static const String youGoal = '/you/goal';
  static const String youRhythm = '/you/rhythm';
  static const String youNotifications = '/you/notifications';
  static const String youPrivacy = '/you/privacy';
  static const String youAccount = '/you/account';
  static const String youDelete = '/you/delete';
  static const String youMilestones = '/you/milestones';
  static const String youBests = '/you/bests';
  static const String youAppearance = '/you/appearance';
  static const String youHelp = '/you/help';

  // Permissions.
  static const String permissionsNotifications = '/permissions/notifications';

  /// Alias of [today].
  static const String dashboard = '/dashboard';

  /// The shell tab roots in tab order (the split dock: Today, Practice, Review).
  static const List<String> tabRoots = [today, practice, review];

  /// The debug-only design lab.
  static const String lab = '/lab';

  /// Every path template of spec 4.2, with `:param` placeholders. Used to recognise native
  /// paths and by tests to prove the route table is complete.
  static const List<String> templates = [
    splash,
    welcome,
    onboardingSubject,
    '/onboarding/sample/:i',
    onboardingSampleResult,
    signIn,
    signInCodeBase,
    beforeYouStart,
    today,
    '/today/why/:actionId',
    practice,
    '/practice/setup/:mode',
    practiceStart,
    '/run/:sessionId',
    '/run/:sessionId/submit',
    '/result/:attemptId/sealed',
    '/result/:attemptId/recap/:card',
    '/result/:attemptId',
    review,
    reviewMistakes,
    reviewRecord,
    '/review/repair/:attemptId/:questionId',
    learn,
    '/learn/:unitId',
    '/learn/run/:runId',
    you,
    youGoal,
    youRhythm,
    youNotifications,
    youPrivacy,
    youAccount,
    youDelete,
    youMilestones,
    youBests,
    youAppearance,
    youHelp,
    todayWeek,
    todayAlternatives,
    todayWeeklyEnding,
    permissionsNotifications,
    '/practice/result/:attemptId',
    '/review/repair/:attemptId/ending',
    '/learn/run/:runId/done',
    dashboard,
  ];

  static final List<RegExp> _nativePatterns = [
    for (final t in templates) RegExp('^${t.replaceAll(RegExp(r':[A-Za-z]+'), r'[^/]+')}\$'),
  ];

  /// True when [path] (no query) matches one of the routes above.
  static bool isNativePath(String path) => _nativePatterns.any((p) => p.hasMatch(path));

  /// Auth-flow paths: the only ones a signed-out student may see.
  static bool isAuthPath(String path) =>
      path == splash || path == welcome || path.startsWith('/onboarding/') || path == signIn || path.startsWith('$signIn/');
}
