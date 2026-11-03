import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/guest_sample.dart';
import '../data/sample_questions.dart';
import '../state/onboarding_navigation.dart';
import '../state/onboarding_providers.dart';
import '../widgets/onboarding_page.dart';

/// First run (spec 5.1.1): Mobi, the promise, one dominant key. Works with no network.
/// A student returning part way through the sample is welcomed back to the same place.
class WelcomeScreen extends ConsumerWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final guest = ref.watch(guestSampleProvider).asData?.value ?? GuestSample.empty;
    return WelcomeView(
      guest: guest,
      onStart: () => context.push(sampleEntryRoute(guest)),
      onHaveAccount: () => context.push(AppRoutes.signIn),
    );
  }
}

/// The pure layout of Welcome, rendered by the goldens.
class WelcomeView extends StatelessWidget {
  const WelcomeView({super.key, required this.guest, required this.onStart, required this.onHaveAccount});

  final GuestSample guest;
  final VoidCallback onStart;
  final VoidCallback onHaveAccount;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final complete = guest.isComplete(kSampleQuestionCount);
    final returning = guest.hasStarted;

    final headline = type.display.copyWith(fontSize: 34, letterSpacing: 34 * -0.035);
    final cells = [
      for (var i = 0; i < kSampleQuestionCount; i++) QuestionCell.blank,
    ];

    return OnboardingPage(
      bodyAlignment: const Alignment(-1, -0.25),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Mobi(pose: MobiPose.greeting, size: 96, motion: MobiMotion.settle, semanticLabel: OnboardingCopy.mobiGreetingLabel),
          const SizedBox(height: MmSpace.s24),
          Semantics(header: true, child: Text(OnboardingCopy.welcomeHeadline, style: headline)),
          const SizedBox(height: MmSpace.s16),
          Text(OnboardingCopy.welcomeLead, style: type.lead.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s24),
          if (returning)
            Text(
              complete ? OnboardingCopy.welcomeBackComplete : OnboardingCopy.welcomeBack(guest.answeredCount, kSampleQuestionCount),
              style: type.body.copyWith(color: colors.ink),
            )
          else
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                QuestionStrip(cells: cells, columns: kSampleQuestionCount, cellSize: 20, gap: 4, semanticsLabel: OnboardingCopy.welcomeSheetHint),
                const SizedBox(width: MmSpace.s12),
                Expanded(child: Text(OnboardingCopy.welcomeSheetHint, style: type.small.copyWith(color: colors.ink3))),
              ],
            ),
        ],
      ),
      bottom: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          KeyButton(
            label: complete ? OnboardingCopy.seeMyResult : (returning ? OnboardingCopy.continueSample : OnboardingCopy.tryFive),
            onPressed: onStart,
          ),
          const SizedBox(height: MmSpace.s4),
          Align(child: KeyButton.quiet(label: OnboardingCopy.haveAccount, onPressed: onHaveAccount)),
          const SizedBox(height: MmSpace.s8),
          Text(OnboardingCopy.notAffiliated, style: type.small.copyWith(color: colors.ink3), textAlign: TextAlign.center),
        ],
      ),
    );
  }
}
