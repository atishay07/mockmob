import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// Welcome (brief section 11, step 2): the lamp-lit desk at night with the glowing answer sheet,
/// Mobi waving from the desk's edge, the promise and one dominant key. Works with no network.
/// A student with a sheet in progress gets "Pick up my sheet" instead.
class WelcomeView extends StatelessWidget {
  const WelcomeView({
    super.key,
    required this.onStart,
    required this.onHaveAccount,
    this.returning = false,
    this.filled = 0,
    this.lateNight = false,
    this.animate = true,
  });

  /// After 11 PM: a sleepy Mobi and one honest line about the hour.
  final bool lateNight;

  final VoidCallback onStart;
  final VoidCallback onHaveAccount;

  /// A sheet is in progress on this phone.
  final bool returning;

  /// How many of its bubbles are filled, for the return line.
  final int filled;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final size = MediaQuery.sizeOf(context);
    final pad = MediaQuery.paddingOf(context);
    final artHeight = (size.height * 0.62).clamp(360.0, 640.0);

    return ColoredBox(
      color: colors.ground,
      child: Stack(
        children: [
          // The room: the desk art, faded into the ground by a functional scrim so the words
          // below always sit on the solid ground.
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: artHeight,
            child: const ArtImage(MmArt.heroSlab, fit: BoxFit.cover, alignment: Alignment(0.25, 0.1)),
          ),
          Positioned(
            left: 0,
            right: 0,
            top: artHeight * 0.52,
            height: artHeight * 0.48 + 1,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [colors.ground.withValues(alpha: 0), colors.ground.withValues(alpha: 0.72), colors.ground],
                  stops: const [0, 0.55, 1],
                ),
              ),
            ),
          ),
          // A top scrim keeps the status bar and the wordmark legible over the bright lamp.
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: pad.top + 96,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [const Color(0xFF0D0C0A).withValues(alpha: 0.55), const Color(0xFF0D0C0A).withValues(alpha: 0)],
                ),
              ),
            ),
          ),
          const Positioned.fill(child: IgnorePointer(child: Grain())),
          Positioned(
            left: MmSpace.cardGutter,
            top: pad.top + MmSpace.s16,
            child: const Wordmark(height: 26, color: Color(0xFFF4F0E6)),
          ),
          Positioned(
            right: MmSpace.s12,
            top: artHeight - 150,
            child: Mobi(
              pose: lateNight ? MobiPose.sleepy : MobiPose.greet,
              size: 116,
              motion: animate ? MobiMotion.settle : MobiMotion.none,
              semanticLabel: lateNight ? OnboardingCopy.mobiSleepy : OnboardingCopy.mobiHello,
            ),
          ),
          Positioned(
            left: MmSpace.cardGutter,
            right: MmSpace.cardGutter,
            bottom: pad.bottom + MmSpace.s12,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (lateNight) ...[
                  Text(OnboardingCopy.lateNight, style: type.labelLarge.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s8),
                ],
                Semantics(
                  header: true,
                  label: OnboardingCopy.welcomeHeadline,
                  excludeSemantics: true,
                  child: Text(
                    OnboardingCopy.welcomeHeadlineSet,
                    style: type.moment,
                    textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3),
                  ),
                ),
                const SizedBox(height: MmSpace.s12),
                Text(OnboardingCopy.welcomeSupport, style: type.body.copyWith(color: colors.ink2)),
                const SizedBox(height: MmSpace.s24),
                if (returning) ...[
                  Row(
                    children: [
                      BubbleRow(
                        states: [for (var i = 0; i < 7; i++) i < filled ? BubbleState.filled : BubbleState.hollow],
                        bubbleSize: 12,
                        gap: 5,
                      ),
                      const SizedBox(width: MmSpace.s12),
                      Expanded(child: Text(OnboardingCopy.welcomeBackLine, style: type.small.copyWith(color: colors.ink2))),
                    ],
                  ),
                  const SizedBox(height: MmSpace.s16),
                ],
                KeyButton(label: returning ? OnboardingCopy.continuePlan : OnboardingCopy.buildPlan, onPressed: onStart),
                const SizedBox(height: MmSpace.s4),
                Align(child: KeyButton.quiet(label: OnboardingCopy.haveAccount, onPressed: onHaveAccount)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
