import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import 'entrance.dart';

/// The common body of a step under the sheet: the question as a headline, one line of support,
/// the answers (scrolling when they need to), and the action area pinned at the bottom. It builds
/// in order when it appears (MOTION.md 4.2): the headline lifts, the support follows, the answers
/// lift (each wrapped in [EntranceItem.answer] by the step), the key lifts last. Text sits on the
/// screen gutter, under the card edges (SPACING.md 1.2, E0).
class StepLayout extends StatelessWidget {
  const StepLayout({
    super.key,
    required this.title,
    required this.body,
    this.support,
    this.bottom,
    this.scroll = true,
    this.titleKey,
  });

  final String title;
  final String? support;
  final Widget body;

  /// Pinned under the body: the primary action, and anything that belongs with it.
  final Widget? bottom;
  final bool scroll;

  /// On the question, for tests that measure it.
  final Key? titleKey;

  /// The fade above the pinned key (SPACING.md 4.5).
  static const double fade = MmSpace.s24;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // Short phones (360 by 640) give the answers the room: the head tightens by 8 dp.
    final short = MediaQuery.sizeOf(context).height < 720;
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3);
    final head = Padding(
      padding: EdgeInsets.only(top: short ? MmSpace.s16 : MmSpace.s24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // A question that takes two lines is set in the title cut (22/27), so it never stacks
          // a heavy 28 sp block onto its support line (SPACING-AUDIT O5); one-liners keep the
          // headline cut.
          LayoutBuilder(
            builder: (context, box) {
              final style = _fitsOneLine(title, type.headline, scaler, box.maxWidth) ? type.headline : type.title;
              return EntranceItem(
                at: Entrance.headline,
                child: Semantics(header: true, child: Text(title, key: titleKey, style: style, textScaler: scaler)),
              );
            },
          ),
          if (support != null) ...[
            const SizedBox(height: MmSpace.s8),
            EntranceItem(
              at: Entrance.support,
              rise: 8,
              child: Text(support!, style: type.body.copyWith(color: colors.ink2)),
            ),
          ],
          SizedBox(height: short ? MmSpace.s12 : MmSpace.s20),
        ],
      ),
    );

    final content = scroll
        ? SingleChildScrollView(
            // Clear of the fade above the pinned key, so the last choice can scroll fully clear.
            padding: const EdgeInsets.only(bottom: fade + MmSpace.s8),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [head, body]),
          )
        : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [head, Expanded(child: body)]);

    return StepEntrance(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: bottom == null ? content : _FadeWhenMore(child: content)),
          if (bottom != null)
            Padding(
              padding: EdgeInsets.only(top: MmSpace.s8, bottom: MediaQuery.paddingOf(context).bottom + MmSpace.s12),
              child: EntranceItem(at: Entrance.key, child: bottom!),
            ),
        ],
      ),
    );
  }

  static bool _fitsOneLine(String text, TextStyle style, TextScaler scaler, double width) {
    if (!width.isFinite) return true;
    final p = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)
      ..layout(maxWidth: width);
    final fits = !p.didExceedMaxLines;
    p.dispose();
    return fits;
  }
}

/// A 24 dp fade into the ground above the pinned key, shown only while there is more below, so
/// nothing at rest sits half-dimmed under it and a long list reads as scrolling, not cut off.
class _FadeWhenMore extends StatefulWidget {
  const _FadeWhenMore({required this.child});

  final Widget child;

  @override
  State<_FadeWhenMore> createState() => _FadeWhenMoreState();
}

class _FadeWhenMoreState extends State<_FadeWhenMore> {
  final ValueNotifier<bool> _more = ValueNotifier<bool>(false);

  bool _onMetrics(ScrollMetrics m) {
    final more = m.extentAfter > 1;
    if (more != _more.value) _more.value = more;
    return false;
  }

  @override
  void dispose() {
    _more.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return NotificationListener<ScrollMetricsNotification>(
      onNotification: (n) => n.depth == 0 && _onMetrics(n.metrics),
      child: NotificationListener<ScrollNotification>(
        onNotification: (n) => n.depth == 0 && _onMetrics(n.metrics),
        child: Stack(
          children: [
            Positioned.fill(child: widget.child),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: StepLayout.fade,
              child: IgnorePointer(
                child: ValueListenableBuilder<bool>(
                  valueListenable: _more,
                  builder: (context, more, child) => AnimatedOpacity(
                    opacity: more ? 1 : 0,
                    duration: Motion.of(context, const Duration(milliseconds: 160)),
                    child: child,
                  ),
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
            ),
          ],
        ),
      ),
    );
  }
}
