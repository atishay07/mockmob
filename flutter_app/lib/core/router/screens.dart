import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'placeholder_screen.dart';
import 'routes.dart';

// One builder per route of spec 4.2. Each returns a placeholder until its feature module
// replaces the body (and only the body) with the real screen. Route paths and transitions
// live in `router.dart` and never change when a screen is swapped in.

Widget splashScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Splash', route: AppRoutes.splash);

Widget welcomeScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Welcome', route: AppRoutes.welcome);

Widget onboardingSubjectScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Which paper first', route: AppRoutes.onboardingSubject);

Widget onboardingSampleScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Sample question', route: '/onboarding/sample/:i');

Widget onboardingSampleResultScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Sample result', route: AppRoutes.onboardingSampleResult);

Widget signInScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Sign in', route: AppRoutes.signIn);

Widget signInCodeScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Enter your code', route: AppRoutes.signInCodeBase);

Widget beforeYouStartScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Before you start', route: AppRoutes.beforeYouStart, isSheet: true);

Widget todayScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Today', route: AppRoutes.today);

Widget todayWhyScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Why this', route: '/today/why/:actionId', isSheet: true);

Widget todayWeekScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'This week', route: AppRoutes.todayWeek, isSheet: true);

Widget todayAlternativesScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Choose something else', route: AppRoutes.todayAlternatives, isSheet: true);

Widget todayWeeklyEndingScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Weekly ending', route: AppRoutes.todayWeeklyEnding);

Widget practiceScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Practice', route: AppRoutes.practice);

Widget practiceSetupScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Practice setup', route: '/practice/setup/:mode');

Widget practiceStartScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Starting practice', route: AppRoutes.practiceStart);

Widget practiceResultScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Practice result', route: '/practice/result/:attemptId');

Widget runScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Runner', route: '/run/:sessionId');

Widget runSubmitScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Submit', route: '/run/:sessionId/submit');

Widget resultSealedScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Your sheet', route: '/result/:attemptId/sealed');

Widget resultRecapScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Recap', route: '/result/:attemptId/recap/:card');

Widget resultScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Result', route: '/result/:attemptId');

Widget reviewScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Review', route: AppRoutes.review);

Widget reviewMistakesScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Mistakes', route: AppRoutes.reviewMistakes);

Widget reviewRecordScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Repair record', route: AppRoutes.reviewRecord);

Widget reviewRepairScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Mistake repair', route: '/review/repair/:attemptId/:questionId');

Widget reviewRepairEndingScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Repair ending', route: '/review/repair/:attemptId/ending');

Widget learnScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Learn', route: AppRoutes.learn);

Widget learnUnitScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Unit', route: '/learn/:unitId');

Widget learnRunScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Learn run', route: '/learn/run/:runId');

Widget learnRunDoneScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Run ending', route: '/learn/run/:runId/done');

Widget youScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'You', route: AppRoutes.you);

Widget youGoalScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Weekly goal', route: AppRoutes.youGoal);

Widget youRhythmScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Rhythm', route: AppRoutes.youRhythm);

Widget youNotificationsScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Notifications', route: AppRoutes.youNotifications);

Widget youPrivacyScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Usage data', route: AppRoutes.youPrivacy);

Widget youAccountScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Account', route: AppRoutes.youAccount);

Widget youDeleteScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Delete account', route: AppRoutes.youDelete);

Widget youMilestonesScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Milestones', route: AppRoutes.youMilestones);

Widget youBestsScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Personal bests', route: AppRoutes.youBests);

Widget youAppearanceScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Appearance', route: AppRoutes.youAppearance);

Widget youHelpScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Help', route: AppRoutes.youHelp);

Widget permissionsNotificationsScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Reminders', route: AppRoutes.permissionsNotifications, isSheet: true);
