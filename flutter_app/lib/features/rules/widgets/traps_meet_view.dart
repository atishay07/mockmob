import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/mistake_lab_traps.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/traps_data.dart';

/// "Traps you meet" (Mistake Lab v4 slice 4, spec 4.11): a disclosure in the Rule book. Opened, it
/// reads `GET /api/me/traps` once and lists, per named trap, "A look-alike term: caught 4 of 6
/// times. Before 1 Oct: 3 of 3. Since: 1 of 3." with the small label "Falling" or "Still catching
/// you" only where the server's gate passed. Every sentence is the server's; the basis line says
/// what a chance is. Each row has a thin bar of the same two numbers (caught of chances).
///
/// Colour never carries the label: the words and an icon do. The bars grow once when the
/// disclosure opens; reduced motion shows them at once. The head is a 56 dp target.
class TrapsMeetView extends StatefulWidget {
  const TrapsMeetView({super.key, this.label = RulesCopy.trapsOpen, this.initiallyOpen = false});

  /// The head's words (the website's "Your traps across mocks").
  final String label;
  final bool initiallyOpen;

  @override
  State<TrapsMeetView> createState() => _TrapsMeetViewState();
}

class _TrapsMeetViewState extends State<TrapsMeetView> {
  late bool _open = widget.initiallyOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MmPressable(
          onTap: () => setState(() => _open = !_open),
          semanticsLabel: RulesCopy.trapsHeadSpoken(widget.label, open: _open),
          selected: _open,
          pressedScale: 0.99,
          focusRadius: MmRadius.smallAll,
          haptic: MmPressHaptic.selection,
          highlight: true,
          builder: (context, pressed, _) => ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Row(
              children: [
                Icon(LucideIcons.route, size: 22, color: colors.accentText),
                const SizedBox(width: MmSpace.s12),
                Expanded(child: Text(widget.label, style: type.cardTitle.copyWith(fontSize: 16, height: 22 / 16))),
                AnimatedRotation(
                  turns: _open ? 0.5 : 0,
                  duration: Motion.of(context, Motion.ui),
                  curve: Motion.out,
                  child: Icon(LucideIcons.chevronDown, size: 18, color: colors.ink3),
                ),
              ],
            ),
          ),
        ),
        MmSizeEase(
          duration: Motion.of(context, Motion.card),
          curve: Motion.out,
          alignment: Alignment.topCenter,
          child: _open ? const _TrapsBody() : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}

/// The opened disclosure. Reads the traps when it is first built, so a closed one costs nothing.
class _TrapsBody extends ConsumerWidget {
  const _TrapsBody();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final read = ref.watch(trapsMeetProvider);
    final data = read.value;
    final Widget content;
    if (data != null) {
      content = TrapsMeetBody(traps: data);
    } else if (read.hasError) {
      content = Semantics(
        liveRegion: true,
        container: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(RulesCopy.trapsUnavailable, style: type.body),
            const SizedBox(height: MmSpace.s8),
            KeyButton.secondary(label: RulesCopy.tryAgain, expanded: false, onPressed: () => ref.invalidate(trapsMeetProvider)),
          ],
        ),
      );
    } else {
      content = SkeletonGroup(
        label: RulesCopy.trapsLoading,
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [Skeleton.line(width: 220, height: 16), SizedBox(height: MmSpace.s12), Skeleton.line(width: 160, height: 14)],
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s4, bottom: MmSpace.s8),
      child: DecoratedBox(
        decoration: BoxDecoration(border: Border(left: BorderSide(color: colors.line, width: 1))),
        child: Padding(padding: const EdgeInsets.only(left: MmSpace.s16), child: content),
      ),
    );
  }
}

/// The traps, laid out (the screen, the goldens and the tests drive it).
class TrapsMeetBody extends StatelessWidget {
  const TrapsMeetBody({super.key, required this.traps});

  final TrapsMeet traps;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (traps.isReady)
          for (final (i, row) in traps.rows.indexed) ...[
            if (i > 0) Divider(height: MmSpace.s24, thickness: 1, color: colors.line),
            TrapRowView(row: row),
          ]
        else if (traps.message != null)
          Text(traps.message!, style: type.body.copyWith(color: colors.ink2)),
        if (traps.basis != null) ...[
          const SizedBox(height: MmSpace.s16),
          Text(traps.basis!, style: type.small.copyWith(color: colors.ink3)),
        ],
        if (traps.fine != null) ...[
          const SizedBox(height: MmSpace.s8),
          Text(traps.fine!, style: type.small.copyWith(color: colors.ink3)),
        ],
      ],
    );
  }
}

/// One trap: the server's sentence, its label (words and an icon), the bar and the split.
class TrapRowView extends StatelessWidget {
  const TrapRowView({super.key, required this.row});

  final TrapRow row;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final falling = row.status == TrapRow.falling;
    final spoken = [row.text, ?row.statusLabel, ?row.periods?.text].join(' ');
    return Semantics(
      container: true,
      label: spoken,
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(row.text, style: type.cardTitle.copyWith(fontSize: 15, height: 22 / 15, fontFeatures: const [FontFeature.tabularFigures()])),
            if (row.statusLabel != null) ...[
              const SizedBox(height: MmSpace.s6),
              _StatusPill(label: row.statusLabel!, falling: falling),
            ],
            const SizedBox(height: MmSpace.s8),
            _TrapBar(share: row.share, tone: colors.warnText, track: colors.line),
            if (row.periods != null) ...[
              const SizedBox(height: MmSpace.s8),
              Text(row.periods!.text, style: type.small.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
            ],
          ],
        ),
      ),
    );
  }
}

/// "Falling" or "Still catching you": an outlined pill with an icon, so colour is never the only cue.
class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.falling});

  final String label;
  final bool falling;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final tone = falling ? colors.goodText : colors.warnText;
    return DecoratedBox(
      decoration: ShapeDecoration(shape: RoundedSuperellipseBorder(borderRadius: MmRadius.pillAll, side: BorderSide(color: tone.withValues(alpha: 0.6)))),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(falling ? LucideIcons.trendingDown : LucideIcons.circleAlert, size: 14, color: tone),
            const SizedBox(width: MmSpace.s6),
            Text(label, style: context.mmType.label.copyWith(color: tone)),
          ],
        ),
      ),
    );
  }
}

/// A 4 dp bar of caught of chances, from the text's left edge, growing once when it appears.
class _TrapBar extends StatelessWidget {
  const _TrapBar({required this.share, required this.tone, required this.track});

  final double share;
  final Color tone;
  final Color track;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 320),
      child: SizedBox(
        height: 4,
        // A painter with no child is as wide as it is told to be: the bar takes the row's width, up to 320.
        width: double.infinity,
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: share),
          duration: Motion.of(context, Motion.card),
          curve: Motion.out,
          builder: (context, v, _) => CustomPaint(painter: _BarPainter(share: v, tone: tone, track: track)),
        ),
      ),
    );
  }
}

class _BarPainter extends CustomPainter {
  const _BarPainter({required this.share, required this.tone, required this.track});

  final double share;
  final Color tone;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    const r = Radius.circular(2);
    canvas.drawRRect(RRect.fromRectAndRadius(Offset.zero & size, r), Paint()..color = track);
    final w = size.width * share.clamp(0.0, 1.0);
    if (w <= 0) return;
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w, size.height), r), Paint()..color = tone);
  }

  @override
  bool shouldRepaint(_BarPainter old) => old.share != share || old.tone != tone || old.track != track;
}
