import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// The common body of a step under the sheet: the question as a headline, one line of support,
/// the answers (scrolling when they need to), and the action area pinned at the bottom.
class StepLayout extends StatelessWidget {
  const StepLayout({
    super.key,
    required this.title,
    required this.body,
    this.support,
    this.bottom,
    this.scroll = true,
  });

  final String title;
  final String? support;
  final Widget body;

  /// Pinned under the body: the primary action, and anything that belongs with it.
  final Widget? bottom;
  final bool scroll;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // Short phones (360 by 640) give the answers the room: the head tightens by 16 dp.
    final short = MediaQuery.sizeOf(context).height < 720;
    final head = Padding(
      padding: EdgeInsets.fromLTRB(MmSpace.s4, short ? MmSpace.s16 : MmSpace.s24, MmSpace.s4, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: Text(
              title,
              style: type.headline,
              textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3),
            ),
          ),
          if (support != null) ...[
            const SizedBox(height: MmSpace.s8),
            Text(support!, style: type.body.copyWith(color: colors.ink2)),
          ],
          SizedBox(height: short ? MmSpace.s12 : MmSpace.s20),
        ],
      ),
    );

    final content = scroll
        ? SingleChildScrollView(
            // Clear of the 32 dp fade above the pinned key, so the last choice never sits under it.
            padding: const EdgeInsets.only(bottom: MmSpace.s40),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [head, body]),
          )
        : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [head, Expanded(child: body)]);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: bottom == null
              ? content
              : Stack(
                  children: [
                    Positioned.fill(child: content),
                    // A short fade into the ground above the pinned key, so a long list never
                    // runs under it with a hard edge.
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 32,
                      child: IgnorePointer(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [colors.ground.withValues(alpha: 0), colors.ground],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
        ),
        if (bottom != null)
          Padding(
            padding: EdgeInsets.only(top: MmSpace.s8, bottom: MediaQuery.paddingOf(context).bottom + MmSpace.s12),
            child: bottom,
          ),
      ],
    );
  }
}
