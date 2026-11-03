// Route builders for the onboarding feature (spec 5.1). This feature module owns this file.
// lib/core/router/screens.dart re-exports these names and router.dart binds them to the paths of
// spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'screens/before_you_start_sheet.dart';
import 'screens/sample_question_screen.dart';
import 'screens/sample_result_screen.dart';
import 'screens/subject_screen.dart';
import 'screens/welcome_screen.dart';

export 'state/sample_import.dart' show sampleImportProvider;

Widget welcomeScreen(BuildContext context, GoRouterState state) => const WelcomeScreen();

Widget onboardingSubjectScreen(BuildContext context, GoRouterState state) => const SubjectScreen();

/// `/onboarding/sample/:i`, where `i` is 1 to 5. Anything else opens the first question.
Widget onboardingSampleScreen(BuildContext context, GoRouterState state) =>
    SampleQuestionScreen(index: int.tryParse(state.pathParameters['i'] ?? '') ?? 1);

Widget onboardingSampleResultScreen(BuildContext context, GoRouterState state) => const SampleResultScreen();

/// A sheet body: `MmSheetPage` supplies the frame, so there is no `Scaffold` here.
Widget beforeYouStartScreen(BuildContext context, GoRouterState state) => const BeforeYouStartSheet();
