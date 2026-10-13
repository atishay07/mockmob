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
    final top = MediaQuery.viewPaddingOf(context).top;
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.3,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          color: NtaSkin.bar,
          border: Border(bottom: BorderSide(color: NtaSkin.barEdge)),
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
                              NtaCopy.modeLine.toUpperCase(),
                              style: type.caption.copyWith(color: NtaSkin.onBar2, height: 1.2, fontWeight: FontWeight.w600, letterSpacing: 0.8, fontSize: 11),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              subject,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: type.cardTitle.copyWith(color: NtaSkin.onBar, height: 1.15),
                            ),
                          ],
                        ),
                      ),
                    ),
                    for (final t in trailing) ...[const SizedBox(width: MmSpace.s8), t],
                  ],
                ),
              ),
              if (bottom != null) Padding(padding: const EdgeInsets.only(right: MmSpace.s8), child: bottom),
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
    final style = context.mmType.caption.copyWith(color: NtaSkin.onBar2);
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(NtaCopy.questionOf(current, total), style: style.copyWith(color: NtaSkin.onBar))),
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
                      const Positioned.fill(child: ColoredBox(color: NtaSkin.barTrack)),
                      SizedBox(
                        width: total == 0 ? 0 : c.maxWidth * current / total,
                        child: const ColoredBox(color: NtaSkin.volt),
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
    final type = context.mmType;
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
                color: low ? NtaSkin.lowFill : const Color(0x1FFFFFFF),
                borderRadius: NtaSkin.keyRadius,
                border: Border.all(color: low ? NtaSkin.lowEdge : const Color(0x4DFFFFFF)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(LucideIcons.clock, size: 15, color: NtaSkin.onBar),
                  const SizedBox(width: MmSpace.s6),
                  Text(
                    NtaCopy.clock(left),
                    textScaler: TextScaler.noScaling,
                    style: type.timer.copyWith(color: NtaSkin.onBar, fontSize: 19, height: 1),
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
    return Semantics(
      button: true,
      label: semanticsLabel,
      excludeSemantics: true,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onTap,
          borderRadius: NtaSkin.keyRadius,
          splashColor: const Color(0x22FFFFFF),
          highlightColor: const Color(0x14FFFFFF),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: label == null ? 0 : MmSpace.s8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 20, color: NtaSkin.onBar),
                  if (label != null) ...[
                    const SizedBox(width: MmSpace.s6),
                    Text(label!, style: type.label.copyWith(color: NtaSkin.onBar)),
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
