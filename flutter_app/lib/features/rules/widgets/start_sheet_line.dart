import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/lab_loop.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../data/rules_data.dart';

/// The rule for this mock on MockMob's own sheet, before the clock starts (Mistake Lab v4 slice 3,
/// spec 4.12): "Your rule for this mock: ..." and, when the record can say, how the last mock went
/// on it. The server writes both lines. Nothing shows without a rule in force, and nothing here is
/// ever drawn inside a timed paper: the hosts are the confirm sheet and NTA mode's instructions
/// page, both read before any session exists.
///
/// The line opens into its place when the read lands (the sheet does not jump), and it is
/// read as one sentence pair by a screen reader.
class StartSheetLine extends ConsumerWidget {
  const StartSheetLine({super.key, required this.subject, this.padding = EdgeInsets.zero});

  /// The attempt-side subject id of the paper about to start (`accountancy`, `gat`).
  final String subject;

  /// Space around the line when it shows; none when it does not.
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lines = ref.watch(startSheetProvider(subject)).value;
    return MmSizeEase(
      duration: Motion.of(context, Motion.card),
      curve: Motion.out,
      alignment: Alignment.topCenter,
      child: lines == null ? const SizedBox(width: double.infinity) : Padding(padding: padding, child: StartSheetLineView(lines: lines)),
    );
  }
}

/// The two lines as drawn: a short rule in the accent's ink at the left, the rule in a firmer
/// weight, then the last mock in quieter ink.
class StartSheetLineView extends StatelessWidget {
  const StartSheetLineView({super.key, required this.lines});

  final StartSheetLines lines;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: [lines.rule, ?lines.last].join(' '),
      child: ExcludeSemantics(
        child: _Arrive(
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 3,
                  decoration: BoxDecoration(color: colors.accentText, borderRadius: const BorderRadius.all(Radius.circular(2))),
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(lines.rule, style: type.body.copyWith(fontWeight: FontWeight.w600)),
                      if (lines.last != null) ...[
                        const SizedBox(height: MmSpace.s4),
                        Text(lines.last!, style: type.small.copyWith(color: colors.ink2)),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A short fade and rise when the line first appears.
class _Arrive extends StatelessWidget {
  const _Arrive({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Motion.glideDuration,
      curve: Motion.glide,
      child: child,
      builder: (context, t, child) => Opacity(opacity: t, child: Transform.translate(offset: Offset(0, 6 * (1 - t)), child: child)),
    );
  }
}
