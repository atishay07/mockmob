import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The deck's top bar: Back, the guide Mobi standing on the answer sheet below him, his line in
/// a bubble beside him, and Skip when the step allows it. 48 dp targets. The bubble may run
/// below the bar for a moment while Mobi talks, so the flow lays this over the sheet.
class GuideBar extends StatelessWidget {
  const GuideBar({
    super.key,
    required this.controller,
    required this.onBack,
    required this.onSkip,
    this.showMobi = true,
  });

  static const double height = 56;
  static const double mobiSize = 64;

  final MobiController controller;
  final VoidCallback onBack;
  final VoidCallback? onSkip;

  /// Off where the step has its own, larger Mobi.
  final bool showMobi;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final mobiWidth = MobiFigure.widthFor(mobiSize);
    const mobiLeft = 56.0;
    return SizedBox(
      height: height,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Row(
            children: [
              // The label sits on the pressable itself, so TalkBack's double tap reaches onTap.
              MmPressable(
                semanticsLabel: OnboardingCopy.back,
                onTap: onBack,
                pressedScale: 0.9,
                builder: (context, pressed, _) => SizedBox.square(
                  dimension: 48,
                  child: Center(child: Icon(LucideIcons.arrowLeft, size: 22, color: pressed ? colors.ink2 : colors.ink)),
                ),
              ),
              const Spacer(),
              if (onSkip != null) KeyButton.quiet(label: OnboardingCopy.skip, onPressed: onSkip),
            ],
          ),
          if (showMobi) ...[
            Positioned(
              left: mobiLeft,
              bottom: 0,
              // An input-heavy screen: he does not twitch at every tap. The flow glances on purpose, at
              // the thing the student just changed (GuideGlance), and the sheet's bubble inks.
              child: MobiCharacter(
                controller: controller,
                size: mobiSize,
                entrance: MobiAct.hello,
                interactive: true,
                watchTaps: false,
                seed: 11,
              ),
            ),
            Positioned(
              left: mobiLeft + mobiWidth + 2,
              right: onSkip == null ? 0 : 72,
              top: 2,
              child: ValueListenableBuilder<MobiSpeech?>(
                valueListenable: controller.speech,
                builder: (context, speech, _) => Align(
                  alignment: Alignment.topLeft,
                  child: speech == null
                      ? const SizedBox.shrink()
                      : MobiBubble(key: ValueKey(speech.id), speech: speech, tail: MobiTail.left, maxWidth: 260),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
