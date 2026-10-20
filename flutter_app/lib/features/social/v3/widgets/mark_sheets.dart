// Full mock together (D167): everyone's mark sheet side by side, under the podium in the one results scroll.
//
// What a first-time student sees: "Mark sheets side by side", "Marks out of 250, by CUET marking. Nobody sees
// anyone's answers.", then one row per member in marks order (the server's order): their Fold's head, their name,
// the marks of 250 on a paper bar in their colour, and right, wrong, skipped, accuracy and time. Then "By unit":
// each syllabus unit with everyone's marks on it, so the Mob sees where each of them is strong. A member who keeps
// their marks private is counted with "Private" and no numbers. Every number is the server's.
//
// Motion: the bars fill from the left once, 90 ms apart, on `out` over 720 ms (countUp), with the marks counting
// up beside them; reduced motion shows them filled. Nothing moves after that.

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../../widgets/mob_ring.dart' show MobColours;
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'sheet_parts.dart' show MemberHead;

class MobMarkSheets extends StatefulWidget {
  const MobMarkSheets({super.key, required this.sheets, this.animate = true});

  final List<MobSheet> sheets;

  /// False shows every bar filled (a returning visit, or a test of the end state).
  final bool animate;

  /// The bars' fill: 720 ms each, 90 ms apart.
  static const Duration fill = Duration(milliseconds: 720);
  static const int stagger = 90;

  @override
  State<MobMarkSheets> createState() => _MobMarkSheetsState();
}

class _MobMarkSheetsState extends State<MobMarkSheets> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: _total);

  Duration get _total => Duration(milliseconds: MobMarkSheets.fill.inMilliseconds + MobMarkSheets.stagger * math.max(0, widget.sheets.length - 1));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!widget.animate || MediaQuery.disableAnimationsOf(context)) {
      _c.value = 1;
    } else if (!_c.isAnimating && _c.value == 0) {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  /// 0 to 1 for row [i] at the controller's time.
  double _t(int i) {
    final ms = _c.value * _total.inMilliseconds - i * MobMarkSheets.stagger;
    return Motion.out.transform((ms / MobMarkSheets.fill.inMilliseconds).clamp(0.0, 1.0));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final sheets = widget.sheets;
    final units = <String, ({String label, int of})>{};
    for (final s in sheets) {
      for (final u in s.sections) {
        // The unit's full marks: 5 for each of its questions.
        units.putIfAbsent(u.key, () => (label: u.label, of: u.fullMarks));
      }
    }
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) => Column(
        key: const ValueKey('mark-sheets'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: Text(MobV3Copy.sheetsTitle, style: type.cardTitle.copyWith(color: colors.ink))),
          const SizedBox(height: MmSpace.s4),
          Text(MobV3Copy.sheetsLine, style: type.small.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s8),
          for (var i = 0; i < sheets.length; i++) ...[
            if (i > 0) Divider(height: 1, thickness: 1, color: colors.line),
            _SheetRow(sheet: sheets[i], t: _t(i)),
          ],
          if (units.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s16),
            Text(MobV3Copy.byUnit, style: type.labelLarge.copyWith(color: colors.ink, fontWeight: FontWeight.w700)),
            for (final e in units.entries) _UnitBlock(label: e.value.label, of: e.value.of, unitKey: e.key, sheets: sheets, t: _t(sheets.length - 1)),
          ],
        ],
      ),
    );
  }
}

class _SheetRow extends StatelessWidget {
  const _SheetRow({required this.sheet, required this.t});

  final MobSheet sheet;
  final double t;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = sheet;
    final name = s.you ? MobV3Copy.tabYou : s.name;
    final marks = s.marks;
    final colour = MobColours.of(context, s.colour);
    final share = marks == null || s.of <= 0 ? 0.0 : (marks / s.of).clamp(0.0, 1.0);
    final shown = marks == null ? null : (marks * t).round();
    final stats = <String>[
      if (s.right != null) '${MobV3Copy.sheetRight} ${s.right}',
      if (s.wrong != null) '${MobV3Copy.sheetWrong} ${s.wrong}',
      if (s.skipped != null) '${MobV3Copy.sheetSkipped} ${s.skipped}',
      if (s.accuracy != null) '${MobV3Copy.sheetAccuracy} ${MobV3Copy.accuracy(s.accuracy!)}',
      if (s.timeMs != null) '${MobV3Copy.sheetTime} ${MobV3Copy.sheetTimeText(s.timeMs!)}',
    ];
    return Semantics(
      container: true,
      label: MobV3Copy.sheetSemantics(name, s),
      excludeSemantics: true,
      child: Padding(
        key: ValueKey('mark-sheet-${s.memberId}'),
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MemberHead(name: s.name, fold: s.fold, colour: s.colour, size: 40),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Expanded(child: Text(name, style: type.labelLarge.copyWith(color: colors.ink, fontWeight: FontWeight.w700))),
                      if (s.private || shown == null)
                        Text(MobV3Copy.private, style: type.caption.copyWith(color: colors.ink3))
                      else
                        Text.rich(
                          TextSpan(children: [
                            TextSpan(text: '$shown', style: type.figureCompact.copyWith(fontSize: 22, height: 1.1, color: colors.ink)),
                            TextSpan(text: ' ${MobV3Copy.ofMarks(s.of)}', style: type.caption.copyWith(color: colors.ink3)),
                          ]),
                          key: ValueKey('mark-sheet-marks-${s.memberId}'),
                        ),
                    ],
                  ),
                  const SizedBox(height: MmSpace.s6),
                  _Bar(share: share * t, colour: colour, private: s.private),
                  if (stats.isNotEmpty) ...[
                    const SizedBox(height: MmSpace.s6),
                    Text(stats.join(' · '), style: type.caption.copyWith(color: colors.ink2)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _UnitBlock extends StatelessWidget {
  const _UnitBlock({required this.label, required this.of, required this.unitKey, required this.sheets, required this.t});

  final String label;
  final int of;
  final String unitKey;
  final List<MobSheet> sheets;
  final double t;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(label, style: type.small.copyWith(color: colors.ink, fontWeight: FontWeight.w600))),
              Text(MobV3Copy.unitOf(of), style: type.caption.copyWith(color: colors.ink3)),
            ],
          ),
          const SizedBox(height: MmSpace.s4),
          for (final s in sheets)
            if (!s.private)
              () {
                final u = s.sections.where((x) => x.key == unitKey).firstOrNull;
                final m = u?.marks;
                if (m == null) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 56,
                        child: Text(s.you ? MobV3Copy.tabYou : s.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: type.caption.copyWith(color: colors.ink2)),
                      ),
                      const SizedBox(width: MmSpace.s8),
                      Expanded(child: _Bar(share: of <= 0 ? 0 : (m / of).clamp(0.0, 1.0) * t, colour: MobColours.of(context, s.colour), thin: true)),
                      const SizedBox(width: MmSpace.s8),
                      SizedBox(
                        width: 32,
                        child: Text('${(m * t).round()}', textAlign: TextAlign.end, style: type.caption.copyWith(color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()])),
                      ),
                    ],
                  ),
                );
              }(),
        ],
      ),
    );
  }
}

/// A paper track with the member's colour filled to [share]: the marks drawn, never a rank.
class _Bar extends StatelessWidget {
  const _Bar({required this.share, required this.colour, this.thin = false, this.private = false});

  final double share;
  final Color colour;
  final bool thin;
  final bool private;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final h = thin ? 6.0 : 10.0;
    return SizedBox(
      height: h,
      child: CustomPaint(painter: _BarPainter(share: private ? 0 : share, colour: colour, track: colors.isNight ? colors.raised2 : colors.sunken, edge: colors.line)),
    );
  }
}

class _BarPainter extends CustomPainter {
  _BarPainter({required this.share, required this.colour, required this.track, required this.edge});

  final double share;
  final Color colour;
  final Color track;
  final Color edge;

  @override
  void paint(Canvas canvas, Size size) {
    final r = Radius.circular(size.height / 2);
    final whole = RRect.fromRectAndRadius(Offset.zero & size, r);
    canvas.drawRRect(whole, Paint()..color = track);
    if (share > 0) {
      final w = math.max(size.height, size.width * share);
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w, size.height), r), Paint()..color = colour);
    }
    canvas.drawRRect(whole.deflate(0.25), Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.5
      ..color = edge);
  }

  @override
  bool shouldRepaint(_BarPainter old) => old.share != share || old.colour != colour || old.track != track;
}
