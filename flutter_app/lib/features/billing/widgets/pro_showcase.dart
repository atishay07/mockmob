import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../billing_copy.dart';

/// The Pro page's showcase (owner, 20 Oct 1:45 am: "fewer, bigger, outcome-led moments" instead of
/// five equal rows). Three moments, each a picture of what Pro does and two lines of what it means:
/// a new paper every time, a Smart set leaning toward the chapters you miss, the exam-day screen.
/// Every picture is an illustration of something Pro does today; nothing in it is the student's data.

/// One moment: its picture on a stage, a small label, a headline and one line.
class ProMoment extends StatelessWidget {
  const ProMoment({super.key, required this.eyebrow, required this.title, required this.line, required this.stage, this.caption});

  final String eyebrow;
  final String title;
  final String line;
  final Widget stage;

  /// A small line under the picture ("An example set").
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmSurface.plain(
      padding: const EdgeInsets.all(MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ExcludeSemantics(child: stage),
          if (caption != null) ...[
            const SizedBox(height: MmSpace.s8),
            ExcludeSemantics(child: Text(caption!, textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink3))),
          ],
          const SizedBox(height: MmSpace.s16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(eyebrow, style: type.label.copyWith(color: colors.isNight ? colors.volt : colors.accentText)),
                const SizedBox(height: MmSpace.s4),
                Semantics(header: true, child: Text(title, style: type.title)),
                const SizedBox(height: MmSpace.s8),
                Text(line, style: type.body.copyWith(color: colors.ink2)),
                const SizedBox(height: MmSpace.s4),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The sunken stage a moment's picture stands on.
class _Stage extends StatelessWidget {
  const _Stage({required this.child, this.height = 176, this.padding = const EdgeInsets.all(MmSpace.s16)});

  final Widget child;
  final double height;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Container(
      height: height,
      padding: padding,
      decoration: BoxDecoration(
        borderRadius: const BorderRadius.all(Radius.circular(16)),
        color: colors.isNight ? colors.sunken : colors.raised2,
        gradient: colors.isNight
            ? RadialGradient(
                center: const Alignment(0.6, -1.1),
                radius: 1.3,
                colors: [colors.lamp.withValues(alpha: 0.12), colors.sunken],
              )
            : null,
      ),
      child: child,
    );
  }
}

// ---------------------------------------------------------------------------------------------
// 1. A new paper every time.

/// A fan of answer sheets, each inked in its own pattern: every paper is new.
class ProPaperFan extends StatelessWidget {
  const ProPaperFan({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return _Stage(
      height: 200,
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s12, 0),
            child: Align(alignment: Alignment.topLeft, child: _Badge(text: BillingCopy.moment1Badge)),
          ),
          // The fan stands on the stage's floor and is cut by it, like papers on a desk.
          Expanded(
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
              child: CustomPaint(size: Size.infinite, painter: _FanPainter(colors: colors)),
            ),
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(color: colors.volt, borderRadius: MmRadius.pillAll, border: Border.all(color: colors.voltEdge)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s4),
        child: Text(text, style: context.mmType.label.copyWith(color: colors.voltInk)),
      ),
    );
  }
}

class _FanPainter extends CustomPainter {
  const _FanPainter({required this.colors});

  final MmColors colors;

  static const List<double> _angles = [-0.28, -0.10, 0.10, 0.28];
  static const List<double> _dx = [-0.16, -0.055, 0.055, 0.16];

  @override
  void paint(Canvas canvas, Size size) {
    final night = colors.isNight;
    final sheetH = size.height * 0.86;
    final sheetW = sheetH * 0.66;
    final pivot = Offset(size.width / 2, size.height + sheetH * 0.30);
    final paper = night ? const Color(0xFF2B2924) : const Color(0xFFFFFDF8);
    final edge = night ? colors.lineStrong : colors.line;
    final empty = night ? const Color(0xFF4A453B) : const Color(0xFFCFC7B6);
    for (var i = 0; i < 4; i++) {
      canvas.save();
      canvas.translate(pivot.dx + _dx[i] * size.width, pivot.dy);
      canvas.rotate(_angles[i]);
      final rect = Rect.fromLTWH(-sheetW / 2, -sheetH - sheetH * 0.12, sheetW, sheetH);
      final rr = RRect.fromRectAndRadius(rect, const Radius.circular(8));
      canvas.drawRRect(rr.shift(const Offset(0, 6)), Paint()..color = const Color(0x33000000)..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8));
      canvas.drawRRect(rr, Paint()..color = paper);
      canvas.drawRRect(rr, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = edge);
      // The sheet's heading rule.
      final pad = sheetW * 0.14;
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(rect.left + pad, rect.top + pad, sheetW * 0.46, 4), const Radius.circular(2)),
        Paint()..color = i == 3 ? colors.volt : empty,
      );
      // Its bubbles: 4 by 6, each sheet inked in its own pattern.
      final rng = math.Random(7 + i * 13);
      final gx = (sheetW - pad * 2) / 4;
      final top = rect.top + pad + 14;
      final gy = (rect.bottom - pad - top) / 6;
      final r = math.min(gx, gy) * 0.3;
      for (var row = 0; row < 6; row++) {
        final pick = rng.nextInt(4);
        for (var col = 0; col < 4; col++) {
          final c = Offset(rect.left + pad + gx * (col + 0.5), top + gy * (row + 0.5));
          if (col == pick) {
            canvas.drawCircle(c, r, Paint()..color = i == 3 ? colors.volt : (night ? const Color(0xFF6A645A) : const Color(0xFFA9A08E)));
          } else {
            canvas.drawCircle(c, r, Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1
              ..color = empty);
          }
        }
      }
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_FanPainter old) => old.colors != colors;
}

// ---------------------------------------------------------------------------------------------
// 2. Smart practice leans toward the chapters you miss.

/// A plain set beside a Smart set: the same four chapters, and how much of each set they get. The
/// chapters the student misses are marked; the Smart set gives them most of its questions.
class ProSmartChart extends StatelessWidget {
  const ProSmartChart({super.key});

  /// (chapter, missed, share in a plain set, share in a Smart set). An illustration only.
  static const List<(String, bool, double, double)> _rows = [
    ('Ratio analysis', true, 0.25, 0.40),
    ('Cash flow', true, 0.25, 0.32),
    ('Partnership', false, 0.25, 0.16),
    ('Share capital', false, 0.25, 0.12),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final miss = colors.badText;
    final smart = colors.isNight ? colors.volt : colors.accentText;
    const barMax = 0.40;
    return _Stage(
      height: 196,
      padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, MmSpace.s12),
      child: LayoutBuilder(
        builder: (context, box) {
          final barCol = (box.maxWidth - 128) / 2 - MmSpace.s8;
          Widget bar(double share, Color color) => Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  width: math.max(6, barCol * share / barMax),
                  height: 12,
                  decoration: BoxDecoration(color: color, borderRadius: MmRadius.pillAll),
                ),
              );
          return Column(
            children: [
              Row(
                children: [
                  const SizedBox(width: 128),
                  SizedBox(width: barCol, child: Text(BillingCopy.moment2Plain, style: type.caption.copyWith(color: colors.ink3))),
                  const SizedBox(width: MmSpace.s16),
                  SizedBox(width: barCol, child: Text(BillingCopy.moment2Smart, style: type.caption.copyWith(color: smart, fontWeight: FontWeight.w700))),
                ],
              ),
              const SizedBox(height: MmSpace.s8),
              for (final r in _rows)
                Expanded(
                  child: Row(
                    children: [
                      SizedBox(
                        width: 128,
                        child: Row(
                          children: [
                            Container(width: 7, height: 7, decoration: BoxDecoration(shape: BoxShape.circle, color: r.$2 ? miss : colors.ink4.withValues(alpha: 0.5))),
                            const SizedBox(width: MmSpace.s8),
                            Expanded(
                              child: Text(
                                r.$1,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: type.caption.copyWith(color: r.$2 ? colors.ink : colors.ink2, fontWeight: r.$2 ? FontWeight.w700 : FontWeight.w500),
                              ),
                            ),
                          ],
                        ),
                      ),
                      SizedBox(width: barCol, child: bar(r.$3, colors.ink4.withValues(alpha: colors.isNight ? 0.7 : 0.45))),
                      const SizedBox(width: MmSpace.s16),
                      SizedBox(width: barCol, child: bar(r.$4, smart)),
                    ],
                  ),
                ),
              const SizedBox(height: MmSpace.s4),
              Row(
                children: [
                  Container(width: 7, height: 7, decoration: BoxDecoration(shape: BoxShape.circle, color: miss)),
                  const SizedBox(width: MmSpace.s8),
                  Text(BillingCopy.moment2Legend, style: type.caption.copyWith(color: colors.ink3)),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------
// 3. The exam-day screen.

/// A small copy of NTA mode's screen: the navy header and the clock, a question with its options,
/// the palette in the exam's own colours and its keys. Drawn in the exam's colours on both themes,
/// as the runner draws them, because it has to look like the real screen.
class ProNtaMockup extends StatelessWidget {
  const ProNtaMockup({super.key});

  static const Color _navy = Color(0xFF2F4A7D);
  static const Color _paper = Color(0xFFEAF0F4);
  static const Color _blue = Color(0xFF2769BD);
  static const Color _answered = Color(0xFF309816);
  static const Color _notAnswered = Color(0xFFD84500);
  static const Color _marked = Color(0xFF512593);
  static const Color _notVisited = Color(0xFFE4E4E4);
  static const Color _ink = Color(0xFF222222);
  static const Color _line = Color(0xFFC4CFD6);

  static const List<Color> _states = [
    _answered, _answered, _notAnswered, _answered, _marked, //
    _answered, _answered, _answered, _notAnswered, _answered,
    _marked, _answered, _answered, _blue, _notVisited,
    _notVisited, _notVisited, _notVisited, _notVisited, _notVisited,
  ];

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    TextStyle t(double size, {Color color = _ink, FontWeight weight = FontWeight.w500}) =>
        type.caption.copyWith(fontSize: size, height: 1.2, color: color, fontWeight: weight, letterSpacing: 0);
    Widget line(double w) => Container(height: 5, width: w, margin: const EdgeInsets.only(bottom: 5), decoration: BoxDecoration(color: const Color(0xFFB8C4CD), borderRadius: BorderRadius.circular(3)));

    return _Stage(
      height: 214,
      padding: const EdgeInsets.all(MmSpace.s12),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: _paper,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFF9FB0BC)),
          boxShadow: const [BoxShadow(color: Color(0x40000000), blurRadius: 14, offset: Offset(0, 6), spreadRadius: -4)],
        ),
        child: Column(
          children: [
            // The header: the mode and the clock.
            Container(
              color: _navy,
              height: 26,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Row(
                children: [
                  Text(BillingCopy.moment3Mode, style: t(10, color: Colors.white, weight: FontWeight.w700)),
                  const Spacer(),
                  Icon(LucideIcons.clock, size: 11, color: Colors.white.withValues(alpha: 0.85)),
                  const SizedBox(width: 4),
                  Text(BillingCopy.moment3Clock, style: t(10, color: Colors.white, weight: FontWeight.w700).copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // The question and its options.
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(8, 7, 8, 6),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(4), border: Border.all(color: _line)),
                        child: LayoutBuilder(
                          builder: (context, box) => Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(BillingCopy.moment3Question, style: t(9.5, weight: FontWeight.w700)),
                              const SizedBox(height: 6),
                              line(box.maxWidth),
                              line(box.maxWidth * 0.7),
                              const SizedBox(height: 2),
                              for (var o = 0; o < 4; o++)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 5),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 10,
                                        height: 10,
                                        decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: _blue, width: o == 1 ? 3 : 1.2)),
                                      ),
                                      const SizedBox(width: 6),
                                      Container(
                                        height: 5,
                                        width: box.maxWidth * [0.55, 0.68, 0.46, 0.6][o],
                                        decoration: BoxDecoration(color: o == 1 ? const Color(0xFF8FAFD6) : const Color(0xFFD3DCE3), borderRadius: BorderRadius.circular(3)),
                                      ),
                                    ],
                                  ),
                                ),
                              const Spacer(),
                              Row(
                                children: [
                                  Flexible(
                                    child: FittedBox(
                                      fit: BoxFit.scaleDown,
                                      alignment: Alignment.centerLeft,
                                      child: _NtaKey(label: BillingCopy.moment3Mark, color: Colors.white, ink: _ink, border: _line, style: t(8)),
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  _NtaKey(label: BillingCopy.moment3Save, color: _answered, ink: Colors.white, style: t(8, color: Colors.white, weight: FontWeight.w700)),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // The palette.
                    SizedBox(
                      width: 104,
                      child: Container(
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(4), border: Border.all(color: _line)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Container(
                              height: 16,
                              alignment: Alignment.centerLeft,
                              padding: const EdgeInsets.symmetric(horizontal: 5),
                              decoration: const BoxDecoration(color: _navy, borderRadius: BorderRadius.vertical(top: Radius.circular(3))),
                              child: Text(BillingCopy.moment3Palette, style: t(7.5, color: Colors.white, weight: FontWeight.w700)),
                            ),
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.all(5),
                                child: Wrap(
                                  spacing: 3,
                                  runSpacing: 3,
                                  children: [
                                    for (final (i, c) in _states.indexed)
                                      Container(
                                        width: 15.6,
                                        height: 15.6,
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: c,
                                          shape: c == _marked ? BoxShape.circle : BoxShape.rectangle,
                                          borderRadius: c == _marked ? null : BorderRadius.circular(2),
                                          border: c == _notVisited ? Border.all(color: const Color(0xFFA9A9A9), width: 0.6) : null,
                                        ),
                                        child: Text('${i + 1}', style: t(6.5, color: c == _notVisited ? _ink : Colors.white, weight: FontWeight.w700)),
                                      ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NtaKey extends StatelessWidget {
  const _NtaKey({required this.label, required this.color, required this.ink, required this.style, this.border});

  final String label;
  final Color color;
  final Color ink;
  final TextStyle style;
  final Color? border;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3), border: border == null ? null : Border.all(color: border!)),
      child: Text(label, style: style),
    );
  }
}

// ---------------------------------------------------------------------------------------------
// The rest of Pro, small.

/// The smaller parts of Pro, two to a row: art, a name and a short line.
class ProAlsoGrid extends StatelessWidget {
  const ProAlsoGrid({super.key, required this.items});

  /// (name, line, art file).
  final List<(String, String, String)> items;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        const gap = MmSpace.s12;
        final w = (box.maxWidth - gap) / 2;
        // Two to a row, each pair the same height; an odd last one takes the whole row.
        final rows = <Widget>[];
        for (var i = 0; i < items.length; i += 2) {
          if (rows.isNotEmpty) rows.add(const SizedBox(height: gap));
          rows.add(
            i + 1 < items.length
                ? IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SizedBox(width: w, child: _AlsoTile(item: items[i])),
                        const SizedBox(width: gap),
                        SizedBox(width: w, child: _AlsoTile(item: items[i + 1])),
                      ],
                    ),
                  )
                : _AlsoTile(item: items[i], wide: true),
          );
        }
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
      },
    );
  }
}

class _AlsoTile extends StatelessWidget {
  const _AlsoTile({required this.item, this.wide = false});

  final (String, String, String) item;

  /// Alone on its row: art beside the words.
  final bool wide;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final art = Image.asset(
      'assets/art/${item.$3}.webp',
      width: 48,
      height: 48,
      cacheWidth: (48 * dpr).round(),
      excludeFromSemantics: true,
      errorBuilder: (_, _, _) => const SizedBox(width: 48, height: 48),
    );
    final words = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(item.$1, style: type.cardTitle),
        const SizedBox(height: MmSpace.s4),
        Text(item.$2, style: type.small.copyWith(color: colors.ink2)),
      ],
    );
    return MmSurface.plain(
      padding: const EdgeInsets.all(MmSpace.s16),
      semanticsLabel: '${item.$1}. ${item.$2}',
      child: wide
          ? Row(children: [art, const SizedBox(width: MmSpace.s16), Expanded(child: words)])
          : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [art, const SizedBox(height: MmSpace.s12), words]),
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Free and Pro.

/// Free and Pro, side by side: one short line per row, a tick, a dash or a few words in each
/// column, Pro's column lit. Read aloud row by row.
class ProCompareTable extends StatelessWidget {
  const ProCompareTable({super.key, required this.rows});

  /// (what, Free, Pro): null is a tick, an empty string a dash, anything else its words.
  final List<(String, String?, String?)> rows;

  static const double _col = 80;

  /// The least height of a row. A row grows with its words (K4, 20 Oct: a fixed 48 cut a three-line Free cell, and
  /// every cell must hold at 360 dp with text at 1.3), and its name wraps rather than ending in an ellipsis.
  static const double _row = 48;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final proInk = colors.isNight ? colors.volt : colors.accentText;
    final strip = colors.volt.withValues(alpha: colors.isNight ? 0.09 : 0.18);

    String said(String? v) => v == null ? BillingCopy.compareIncluded : (v.isEmpty ? BillingCopy.compareNotIncluded : v);

    Widget cell(String? v, {required bool pro}) {
      final Widget child;
      if (v == null) {
        child = Icon(LucideIcons.check, size: 20, color: pro ? proInk : colors.ink2);
      } else if (v.isEmpty) {
        child = Container(width: 12, height: 2, color: colors.ink4);
      } else {
        final words = Text(v, textAlign: TextAlign.center, style: type.caption.copyWith(color: pro ? colors.ink : colors.ink2, fontWeight: pro ? FontWeight.w700 : FontWeight.w500));
        // A single word never breaks mid-word ("Unlimite d" at text 1.3): it scales down to fit its column instead.
        child = v.contains(' ') ? words : FittedBox(fit: BoxFit.scaleDown, child: words);
      }
      return SizedBox(width: _col, child: Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.s2), child: Center(child: child)));
    }

    return DecoratedBox(
      decoration: BoxDecoration(color: colors.raised, borderRadius: MmRadius.panelAll, border: Border.all(color: colors.line)),
      child: ClipRRect(
        borderRadius: MmRadius.panelAll,
        child: Stack(
          children: [
            Positioned(top: 0, bottom: 0, right: 0, width: _col, child: ColoredBox(color: strip)),
            Column(
              children: [
                SizedBox(
                  height: 52,
                  child: Row(
                    children: [
                      const Expanded(child: SizedBox()),
                      SizedBox(width: _col, child: Center(child: Text(BillingCopy.compareFree, style: type.labelLarge.copyWith(color: colors.ink2)))),
                      SizedBox(
                        width: _col,
                        child: Center(
                          child: DecoratedBox(
                            decoration: BoxDecoration(color: colors.volt, borderRadius: MmRadius.pillAll, border: Border.all(color: colors.voltEdge)),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: 3),
                              child: Text(BillingCopy.comparePro, style: type.label.copyWith(color: colors.voltInk, fontWeight: FontWeight.w800)),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                for (final r in rows) ...[
                  Container(height: 1, color: colors.line),
                  Semantics(
                    container: true,
                    excludeSemantics: true,
                    label: '${r.$1}. ${BillingCopy.compareFree}: ${said(r.$2)}. ${BillingCopy.comparePro}: ${said(r.$3)}.',
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: _row),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
                        child: Row(
                          children: [
                            const SizedBox(width: MmSpace.s16),
                            Expanded(child: Text(r.$1, style: type.small.copyWith(color: colors.ink, fontWeight: FontWeight.w500))),
                            cell(r.$2, pro: false),
                            cell(r.$3, pro: true),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
