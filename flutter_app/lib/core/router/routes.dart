/// Every route of the app (spec 4.2) as constants and path builders. Features navigate with
/// these, never with string literals.
abstract final class AppRoutes {
  // First run and auth.
  static const String splash = '/splash';
  static const String welcome = '/welcome';

  /// Shown while the auth state is unknown because loading it failed (no dock, no sign-in).
  static const String loadFailed = '/load-failed';
  static const String onboardingSubject = '/onboarding/subject';
  static const String onboardingSampleResult = '/onboarding/sample/result';
  static const String signIn = '/sign-in';
  static const String signInCodeBase = '/sign-in/code';
  static const String beforeYouStart = '/before-you-start';

  static String onboardingSample(int i) => '/onboarding/sample/$i';

  /// The email is passed as a query parameter as the spec lists it; it stays inside the app and
  /// is never sent anywhere.
  /// Sign-in opened from the onboarding save step's "Use an email code": the email form alone,
  /// worded as saving the plan (v15 taste pass).
  static final String signInToSave = Uri(path: signIn, queryParameters: {'from': 'save', 'method': 'email'}).toString();

  static String signInCode({String? email}) =>
      email == null ? signInCodeBase : Uri(path: signInCodeBase, queryParameters: {'email': email}).toString();

  // Shell tabs (the bar, D105: Today, Practice, Start, Mob, You; Start is the centre key, an
  // action, not a tab).
  static const String today = '/today';
  static const String practice = '/practice';
  static const String mob = '/mob';
  static const String you = '/you';

  /// Your papers (D105, G20): the Review screen, inside Practice. Every old Review path (`/review`
  /// and everything under it, from deep links, notifications, results and older code) redirects
  /// here with the same tail, so `/review/mistakes` lands on `/practice/papers/mistakes`.
  static const String papers = '/practice/papers';

  /// The old Review tab's path. It redirects to [papers]; kept so every caller and every link that
  /// names it still lands on Your papers.
  static const String review = '/review';

  /// Colleges: My colleges, Admission Compass and the CUET tools. No longer a tab (D105): a page
  /// pushed over the bar from Today's colleges card, You's Aim row and Review, so Back returns to
  /// where the student came from.
  static const String colleges = '/colleges';

  /// You with the account sheet open over it (the website's `/profile`). The shell opens the
  /// sheet and drops the query.
  static const String youWithAccount = '/you?account=1';

  /// Check a score (the website's cutoff calculator), a sheet over Colleges
  /// (`?score=&category=`, app-ia-1016.md 5.3).
  static const String collegesCutoff = '/colleges/cutoff';
  static String collegesCutoffWith({String? score, String? category}) {
    final query = {'score': ?score, 'category': ?category};
    return query.isEmpty ? collegesCutoff : Uri(path: collegesCutoff, queryParameters: query).toString();
  }

  // Pushed over the shell: Learn from Practice and Review.
  static const String learn = '/learn';

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

  /// The Rule book (Mistake Lab v4 slice 3): rules from repairs and from how papers are taken.
  static const String reviewRules = '/review/rules';

  /// Revise: the student's own wrong answers come back after 1, 3, 7 and 21 days (Mistake Lab v4 slice 4).
  static const String reviewRevise = '/review/revise';

  /// Review again: repaired mistakes asked once more with the key hidden (`?keys=attemptId/questionId,...`).
  static const String reviewAgain = '/review/again';
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
  static const String youSubjects = '/you/subjects';
  static const String youSheet = '/you/sheet';

  // Review: the record and saved questions. Practice: the question stream.
  static const String reviewInsights = '/review/insights';
  static const String reviewSaved = '/review/saved';
  /// Credits: both balances, the plan and the history (the Credits feature owns the screen).
  static const String youCredits = '/you/credits';

  static const String practiceStream = '/practice/stream';

  /// Ask your record.
  static const String ask = '/ask';

  /// NTA mode's instructions page (`?subject=`), before any session exists.
  static const String examNta = '/exam/nta';

  // CUET tools: root pages over the bar, pushed from Colleges, Today's colleges card and
  // Practice's More rows; Back returns to the tab they came from. `/tools` itself redirects to
  // the Colleges tab (app-ia-1016.md D7).
  static const String tools = '/tools';
  static const String toolsCompass = '/tools/compass';
  static const String toolsCombo = '/tools/combo';
  static const String toolsGuide2027 = '/tools/guide-2027';

  // Permissions.
  static const String permissionsNotifications = '/permissions/notifications';

  /// Alias of [today].
  static const String dashboard = '/dashboard';

  /// The shell branch roots in branch order (the bar, D105: Today, Practice, Mob, You; Start sits
  /// between Practice and Mob, the centre key, an action and not a tab).
  static const List<String> branchRoots = [today, practice, mob, you];

  /// The places opened with `go`, never pushed: the four branch roots, then Your papers (inside
  /// Practice) under its new and its old path. A push of a page that lives in another branch would
  /// stack it in the wrong place (or build the shell twice from a page outside it).
  static const List<String> tabRoots = [...branchRoots, papers, review];

  /// The debug-only design lab.
  static const String lab = '/lab';

  /// Every path template of spec 4.2, with `:param` placeholders. Used to recognise native
  /// paths and by tests to prove the route table is complete.
  static const List<String> templates = [
    splash,
    loadFailed,
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
    reviewRules,
    reviewRevise,
    reviewAgain,
    '/review/repair/:attemptId/:questionId',
    learn,
    '/learn/:unitId',
    '/learn/run/:runId',
    '/learn/summary/:subject/:chapter',
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
    youSubjects,
    youSheet,
    reviewInsights,
    reviewSaved,
    practiceStream,
    ask,
    youCredits,
    '/you/mob',
    '/join/:code',
    mob,
    papers,
    '$papers/mistakes',
    '$papers/record',
    '$papers/rules',
    '$papers/revise',
    '$papers/again',
    '$papers/insights',
    '$papers/saved',
    '$papers/repair/:attemptId/:questionId',
    '$papers/repair/:attemptId/ending',
    examNta,
    tools,
    toolsCompass,
    '/tools/compass/:groupId',
    toolsCombo,
    toolsGuide2027,
    colleges,
    collegesCutoff,
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
