import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The frame of every full-screen onboarding step: ground colour, a centred column no wider than
/// 600 dp, an optional Back key, a scrolling body and an optional pinned bottom area. At large
/// text sizes the body scrolls while the pinned keys stay reachable.
class OnboardingPage extends StatelessWidget {
  const OnboardingPage({super.key, required this.body, this.bottom, this.onBack, this.header, this.scrollBody = true, this.bodyAlignment = Alignment.topCenter});

  final Widget body;

  /// Pinned under the scrolling body (the dominant key and its companions).
  final Widget? bottom;
  final VoidCallback? onBack;

  /// Sits beside the Back key on the same row (the position label of a question).
  final Widget? header;

  /// False when [body] scrolls by itself (a `StateView`).
  final bool scrollBody;

  /// Where [body] sits when it is shorter than the screen. Welcome uses a point above the middle.
  final Alignment bodyAlignment;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (onBack != null || header != null)
                  Padding(
                    padding: const EdgeInsets.only(right: MmSpace.gutter),
                    child: Row(
                      children: [
                        if (onBack != null) KeyButton.quiet(label: OnboardingCopy.back, onPressed: onBack),
                        if (header != null) Expanded(child: Align(alignment: AlignmentDirectional.centerEnd, child: header)),
                      ],
                    ),
                  ),
                Expanded(
                  child: scrollBody
                      ? LayoutBuilder(
                          builder: (context, constraints) => SingleChildScrollView(
                            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s24),
                            child: ConstrainedBox(
                              constraints: BoxConstraints(minHeight: constraints.maxHeight - MmSpace.s8 - MmSpace.s24),
                              child: Align(alignment: bodyAlignment, child: body),
                            ),
                          ),
                        )
                      : body,
                ),
                if (bottom != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16),
                    child: bottom,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
