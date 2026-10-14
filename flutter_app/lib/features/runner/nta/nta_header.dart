import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import 'nta_copy.dart';
import 'nta_skin.dart';

/// The exam's blue bar: the subject with "NTA mode" under it on the left, then whatever the
/// screen needs on the right (the clock, the palette key). Runs under the status bar. Chrome:
/// text grows to 1.3x at most.
class NtaBar extends StatelessWidget {
  const NtaBar({super.key, required this.subject, this.leading, this.trailing = const [], this.bottom});

  final String subject;
  final Widget? leading;
  final List<Widget> trailing;
  final Widget? bottom;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final skin = NtaSkin.of(context);
    final bar = NtaBarColors.of(context);
    final top = MediaQuery.viewPaddingOf(context).top;
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.3,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: bar.fill,
          border: Border(bottom: BorderSide(color: bar.edge)),
        ),
        child: Padding(
          padding: EdgeInsets.fromLTRB(leading == null ? MmSpace.gutter : MmSpace.s4, top + MmSpace.s8, MmSpace.s8, MmSpace.s8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 48,
                child: Row(
                  children: [
                    ?leading,
                    Expanded(
                      child: Semantics(
                        header: true,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              NtaCopy.modeLine,
                              style: type.caption.copyWith(
                                color: bar.on2,
                                height: 1.2,
                                fontWeight: FontWeight.w600,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              subject,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: skin.type.barTitle.copyWith(color: bar.on),
                            ),
                          ],
                        ),
                      ),
                    ),
                    for (final t in trailing) ...[const SizedBox(width: MmSpace.s8), t],
                  ],
                ),
              ),
              if (bottom != null)
                Padding(
                  padding: const EdgeInsets.only(right: MmSpace.s8),
                  child: bottom,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "Question 12 of 50" and "11 answered" over a thin volt progress line.
class NtaProgressRow extends StatelessWidget {
  const NtaProgressRow({super.key, required this.current, required this.total, required this.answered});

  final int current;
  final int total;
  final int answered;

  @override
  Widget build(BuildContext context) {
    final bar = NtaBarColors.of(context);
    final style = context.mmType.caption.copyWith(color: bar.on2);
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(NtaCopy.questionOf(current, total), style: style.copyWith(color: bar.on)),
              ),
              Text(NtaCopy.answeredCount(answered), style: style),
            ],
          ),
          const SizedBox(height: MmSpace.s6),
          ExcludeSemantics(
            child: ClipRRect(
              borderRadius: MmRadius.pillAll,
              child: SizedBox(
                height: 3,
                child: LayoutBuilder(
                  builder: (context, c) => Stack(
                    children: [
                      Positioned.fill(child: ColoredBox(color: bar.track)),
                      SizedBox(
                        width: total == 0 ? 0 : c.maxWidth * current / total,
                        child: ColoredBox(color: bar.progress),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The exam clock: clock icon and "47:12", white on the bar, tinted red under a minute. One Text
/// in its own boundary, so the second hand repaints nothing else.
class NtaTimerChip extends StatelessWidget {
  const NtaTimerChip({super.key, required this.remaining});

  final ValueListenable<Duration> remaining;

  @override
  Widget build(BuildContext context) {
    final clock = NtaSkin.of(context).type.clock;
    final bar = NtaBarColors.of(context);
    return RepaintBoundary(
      child: ValueListenableBuilder<Duration>(
        valueListenable: remaining,
        builder: (context, left, _) {
          final low = left.inSeconds < 60;
          return Semantics(
            label: NtaCopy.timerSemantics(left),
            excludeSemantics: true,
            child: Container(
              constraints: const BoxConstraints(minWidth: 92, minHeight: 40),
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
              decoration: BoxDecoration(
                color: low ? NtaSkin.lowFill : bar.chip,
                borderRadius: NtaSkin.keyRadius,
                border: Border.all(color: low ? NtaSkin.lowEdge : bar.chipEdge),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.clock, size: 15, color: bar.on),
                  const SizedBox(width: MmSpace.s6),
                  Text(
                    NtaCopy.clock(left),
                    textScaler: TextScaler.noScaling,
                    style: clock.copyWith(color: bar.on),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

/// A white-on-blue key of the bar (the palette, back). 48 dp target.
class NtaBarKey extends StatelessWidget {
  const NtaBarKey({super.key, required this.icon, required this.semanticsLabel, required this.onTap, this.label});

  final IconData icon;
  final String? label;
  final String semanticsLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final bar = NtaBarColors.of(context);
    return Semantics(
      button: true,
      label: semanticsLabel,
      excludeSemantics: true,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onTap,
          borderRadius: NtaSkin.keyRadius,
          splashColor: bar.splash,
          highlightColor: bar.highlight,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: label == null ? 0 : MmSpace.s8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 20, color: bar.on),
                  if (label != null) ...[
                    const SizedBox(width: MmSpace.s6),
                    Text(label!, style: type.label.copyWith(color: bar.on)),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
