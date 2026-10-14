import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../widgets/entrance.dart';
import '../widgets/welcome_scene.dart';

/// Welcome (brief section 11, step 2): the lamp-lit desk drawn in code, Mobi standing on it and
/// waving hello (yawning after 11 PM), the promise and one dominant key. Works with no network.
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
    this.pending = false,
    this.notice,
    this.retry = false,
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

  /// The key was tapped while the stored sheet is still being read: it waits, then opens.
  final bool pending;

  /// One line about a stored sheet that could not be read, above the key.
  final String? notice;

  /// The key reads the stored sheet again ("Try again") instead of starting.
  final bool retry;

  /// Where the desk's back edge sits in the scene.
  static const double deskAt = 0.82;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final size = MediaQuery.sizeOf(context);
    final pad = MediaQuery.paddingOf(context);
    final line = lateNight ? OnboardingCopy.lateNight : (returning ? OnboardingCopy.mobiWelcomeBack : OnboardingCopy.mobiWelcome);

    // The room fills everything above the words, so the desk meets the headline at every
    // height instead of leaving a band of empty floor between them.
    final room = LayoutBuilder(
      builder: (context, box) {
        final h = box.maxHeight;
        final deskY = h * deskAt;
        final mobiSize = (h * 0.36).clamp(110.0, 190.0);
        return Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned.fill(child: WelcomeScene(deskAt: deskAt, animate: animate)),
            // Mobi stands on the desk to the right of the sheet; his line rises above him.
            Positioned(
              right: size.width * 0.04,
              bottom: h - deskY - h * 0.1,
              child: MobiStage(
                size: mobiSize,
                entrance: lateNight ? MobiAct.sleepy : MobiAct.hello,
                say: line,
                bubbleWidth: (size.width * 0.62).clamp(200.0, 300.0),
                semanticLabel: lateNight ? OnboardingCopy.mobiSleepy : OnboardingCopy.mobiHello,
              ),
            ),
          ],
        );
      },
    );

    // The words build after Mobi has started his wave: the headline rises word by word, the
    // promise lifts, then the key (ui-blitz onboarding, Welcome).
    final words = Padding(
      padding: EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s8, MmSpace.cardGutter, pad.bottom + MmSpace.s12),
      child: StepEntrance(
        delay: const Duration(milliseconds: 260),
        child: Builder(builder: (context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(
            header: true,
            label: OnboardingCopy.welcomeHeadline,
            excludeSemantics: true,
            child: RiseHeadline(
              OnboardingCopy.welcomeHeadlineSet,
              style: type.moment,
              at: const Duration(milliseconds: 260),
              textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3),
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          EntranceItem(
            at: const Duration(milliseconds: 520),
            rise: 10,
            child: Text(OnboardingCopy.welcomeSupport, style: type.body.copyWith(color: colors.ink2)),
          ),
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
                Expanded(child: Text(OnboardingCopy.welcomeBackLine(filled, 7), style: type.small.copyWith(color: colors.ink2))),
              ],
            ),
            const SizedBox(height: MmSpace.s16),
          ],
          if (notice != null) ...[
            Semantics(liveRegion: true, child: Text(notice!, style: type.small.copyWith(color: colors.ink2))),
            const SizedBox(height: MmSpace.s12),
          ],
          EntranceItem(
            at: const Duration(milliseconds: 600),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                KeyButton(
                  label: retry ? OnboardingCopy.tryAgain : (returning ? OnboardingCopy.continuePlan : OnboardingCopy.buildPlan),
                  onPressed: onStart,
                  loading: pending,
                ),
                const SizedBox(height: MmSpace.s4),
                Align(child: KeyButton.quiet(label: OnboardingCopy.haveAccount, onPressed: onHaveAccount)),
              ],
            ),
          ),
        ],
      )),
      ),
    );

    return ColoredBox(
      color: colors.ground,
      child: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [Expanded(child: room), words],
          ),
          const Positioned.fill(child: IgnorePointer(child: Grain())),
          Positioned(
            left: MmSpace.cardGutter,
            top: pad.top + MmSpace.s16,
            child: Wordmark(height: 26, color: colors.ink),
          ),
        ],
      ),
    );
  }
}
