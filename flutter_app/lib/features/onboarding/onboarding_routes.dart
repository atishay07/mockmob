// Route builders for the onboarding feature ("Your sheet", brief section 11). This feature module
// owns this file. lib/core/router/screens.dart re-exports these names and router.dart binds them
// to the paths of spec 4.2.
//
// The five-question sample is gone from the app (it stays on the website). Its old paths
// (`/onboarding/subject`, `/onboarding/sample/:i`, `/onboarding/sample/result`) are still in the
// route table, so they open the onboarding, which resumes wherever the student's sheet is.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'screens/after_sign_in_sheet.dart';
import 'screens/onboarding_flow.dart';
import 'state/sheet_sync.dart';

/// `/welcome`: the cold open on first launch, Welcome, then the step deck.
Widget welcomeScreen(BuildContext context, GoRouterState state) => const OnboardingFlow();

/// Retired sample path: opens the onboarding.
Widget onboardingSubjectScreen(BuildContext context, GoRouterState state) => const OnboardingFlow(skipColdOpen: true);

/// Retired sample path: opens the onboarding.
Widget onboardingSampleScreen(BuildContext context, GoRouterState state) => const OnboardingFlow(skipColdOpen: true);

/// Retired sample path: opens the onboarding.
Widget onboardingSampleResultScreen(BuildContext context, GoRouterState state) => const OnboardingFlow(skipColdOpen: true);

/// `/before-you-start`, a sheet body after sign-in: the sheet's save state and usage data, or
/// the age question for a student who signed straight in. `MmSheetPage` supplies the frame.
Widget beforeYouStartScreen(BuildContext context, GoRouterState state) => const AfterSignInSheet();

/// The provider `app.dart` keeps alive for the whole session, under the name it already uses:
/// it writes the sealed sheet to the account after sign-in.
final sampleImportProvider = sheetSyncProvider;
