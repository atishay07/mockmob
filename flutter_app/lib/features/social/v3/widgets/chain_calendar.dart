// The month calendar of the chain (spec C1) and the day picker of the exam pause (P5). Monday first.
//
// A practised day is a dark disc with its number in bold; a rested day is a dashed disc with a moon; a
// made-up day is a disc with a paper notch cut from its corner; a day set aside for exams carries a lamp
// dot under its number; every other day is its number in plain ink, quiet. Today wears a ring (ink, never
// volt: the strip above holds the screen's one volt). Nothing is red and a missed day looks like a day not
// yet played, because it is not for the screen to shame.
//
// With [onToggle] set the calendar picks days (P5): days after today are choosable and a chosen day is a
// paper disc with dark ink; days up to today stay as they were and cannot be chosen.

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/theme.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'chain_paper.dart';

class ChainCalendar extends StatelessWidget {
  const ChainCalendar({super.key, required this.year, required this.month, required this.states, required this.today, this.selected = const {}, this.onToggle});

  final int year;

  /// 1 to 12.
  final int month;

  /// `YYYY-MM-DD` to its state. A day with no entry is plain.
  final Map<String, ChainDayState> states;

  /// The IST day key of today.
  final String today;

  /// Chosen days (P5), as keys.
  final Set<String> selected;

  /// Set to make future days choosable.
  final ValueChanged<String>? onToggle;

  static String keyOf(int y, int m, int d) => '$y-${m.toString().padLeft(2, '0')}-${d.toString().padLeft(2, '0')}';

  static int daysIn(int year, int month) => DateTime.utc(year, month + 1, 0).day;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final first = DateTime.utc(year, month, 1);
    final lead = first.weekday - 1;
    final count = daysIn(year, month);
    final rows = ((lead + count) / 7).ceil();
    final picking = onToggle != null;
    final cell = picking ? 48.0 : 44.0;
    return Column(
      children: [
        Row(
          children: [
            for (final d in MobV3Copy.dayInitials)
              Expanded(child: Center(child: Text(d, style: type.label.copyWith(color: colors.ink3)))),
          ],
        ),
        const SizedBox(height: MmSpace.s4),
        for (var r = 0; r < rows; r++)
          Row(
            children: [
              for (var c = 0; c < 7; c++)
                Expanded(
                  child: () {
                    final day = r * 7 + c - lead + 1;
                    if (day < 1 || day > count) return SizedBox(height: cell);
                    final key = keyOf(year, month, day);
                    final past = key.compareTo(today) <= 0;
                    return _Day(
                      day: day,
                      keyText: key,
                      height: cell,
                      state: states[key] ?? ChainDayState.none,
                      isToday: key == today,
                      future: !past,
                      chosen: selected.contains(key),
                      onTap: picking && !past ? () => onToggle!(key) : null,
                    );
                  }(),
                ),
            ],
          ),
      ],
    );
  }
}

class _Day extends StatelessWidget {
  const _Day({required this.day, required this.keyText, required this.height, required this.state, required this.isToday, required this.future, required this.chosen, required this.onTap});

  final int day;
  final String keyText;
  final double height;
  final ChainDayState state;
  final bool isToday;
  final bool future;
  final bool chosen;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final practised = state == ChainDayState.practised || state == ChainDayState.madeUp;
    final rested = state == ChainDayState.rested;
    final paused = state == ChainDayState.paused;
    final numberColor = chosen
        ? ChainPaper.ink
        : practised
            ? colors.ink
            : (future && onTap == null ? colors.ink3 : (state == ChainDayState.none || state == ChainDayState.missed || state == ChainDayState.open ? colors.ink3 : colors.ink));
    final disc = SizedBox(
      width: 38,
      height: 38,
      child: CustomPaint(
        painter: _DiscPainter(
          fill: chosen ? ChainPaper.fill(context) : (practised ? colors.raised2 : null),
          edge: chosen ? ChainPaper.edge(context) : null,
          dashes: rested ? colors.ink3 : null,
          ring: isToday ? colors.ink2 : null,
          notch: state == ChainDayState.madeUp ? colors.ground : null,
          lamp: paused ? colors.lamp : null,
        ),
        child: Center(
          child: rested
              ? Icon(LucideIcons.moon, size: 16, color: colors.ink2)
              : Padding(
                  padding: EdgeInsets.only(bottom: paused ? 5 : 0),
                  child: Text('$day', style: type.label.copyWith(color: numberColor, fontWeight: practised || chosen || isToday ? FontWeight.w800 : FontWeight.w600, fontSize: 14, height: 1.1)),
                ),
        ),
      ),
    );
    final child = SizedBox(height: height, child: Center(child: disc));
    final label = '${MobTime.weekdayOfKey(keyText)} $day, ${chosen ? MobV3Copy.dayChosen : MobV3Copy.dayStateWord(state)}';
    if (onTap == null) return Semantics(label: label, excludeSemantics: true, child: child);
    return Semantics(
      label: label,
      button: true,
      selected: chosen,
      excludeSemantics: true,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: child),
    );
  }
}

class _DiscPainter extends CustomPainter {
  _DiscPainter({this.fill, this.edge, this.dashes, this.ring, this.notch, this.lamp});

  final Color? fill;
  final Color? edge;
  final Color? dashes;
  final Color? ring;
  final Color? notch;
  final Color? lamp;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2;
    if (fill != null) canvas.drawCircle(c, r, Paint()..color = fill!);
    if (edge != null) {
      canvas.drawCircle(
        c,
        r - 0.5,
        Paint()
          ..color = edge!
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1,
      );
    }
    if (dashes != null) {
      final p = Path()..addOval(Rect.fromCircle(center: c, radius: r - 1));
      canvas.drawPath(
        dashedPath(p, dash: 3.5, gap: 3),
        Paint()
          ..color = dashes!
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5,
      );
    }
    if (notch != null) {
      // A paper notch: a small triangle cut from the lower right of the disc.
      final p = Path()
        ..moveTo(size.width - 2, size.height - 13)
        ..lineTo(size.width - 13, size.height - 2)
        ..lineTo(size.width - 2, size.height - 2)
        ..close();
      canvas.drawPath(p, Paint()..color = notch!);
    }
    if (lamp != null) canvas.drawCircle(Offset(c.dx, size.height - 7), 2.6, Paint()..color = lamp!);
    if (ring != null) {
      canvas.drawCircle(
        c,
        r + 1,
        Paint()
          ..color = ring!
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
    }
  }

  @override
  bool shouldRepaint(_DiscPainter old) => old.fill != fill || old.edge != edge || old.dashes != dashes || old.ring != ring || old.notch != notch || old.lamp != lamp;
}
