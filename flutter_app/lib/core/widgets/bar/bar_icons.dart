import 'package:flutter/material.dart' show Icons;
import 'package:flutter/widgets.dart';

import '../../theme/theme.dart';

/// A tab's two glyphs from the Material icon font that ships with Flutter: [active] filled
/// (the Rounded set), [idle] outlined.
@immutable
class BarGlyph {
  const BarGlyph({required this.active, required this.idle});

  final IconData active;
  final IconData idle;

  @override
  bool operator ==(Object other) => other is BarGlyph && other.active == active && other.idle == idle;

  @override
  int get hashCode => Object.hash(active, idle);
}

/// The bar's four icons (DOCK.md section 4, revised 14 Oct 2026 after the owner's review):
/// familiar silhouettes a student reads in a split second, filled when active and outlined at
/// rest. The bar's character comes from its glass, the lens and the motion, not the glyphs.
enum BarIconKind {
  /// Home: the student's day.
  today(BarGlyph(active: Icons.home_rounded, idle: Icons.home_outlined)),

  /// A question sheet: practice questions.
  practice(BarGlyph(active: Icons.quiz_rounded, idle: Icons.quiz_outlined)),

  /// A checked sheet: going back over answers and mistakes.
  review(BarGlyph(active: Icons.fact_check_rounded, idle: Icons.fact_check_outlined)),

  /// The student's initial as an avatar; these glyphs stand in when there is no name.
  you(BarGlyph(active: Icons.person_rounded, idle: Icons.person_outlined));

  const BarIconKind(this.glyph);

  final BarGlyph glyph;
}

/// The colours an icon is drawn with.
@immutable
class BarIconColors {
  const BarIconColors({required this.idle, required this.active, required this.onActive});

  /// The outlined icon at rest (ink 2).
  final Color idle;

  /// The filled icon when active: volt on Night; ink on Daylight, where volt on the white lens
  /// would fail contrast.
  final Color active;

  /// The initial reversed out of You's filled avatar.
  final Color onActive;

  factory BarIconColors.of(MmColors colors) => colors.isNight
      ? BarIconColors(idle: colors.ink2, active: colors.volt, onActive: colors.voltInk)
      : BarIconColors(idle: colors.ink2, active: colors.ink, onActive: const Color(0xFFFFFDF8));

  @override
  bool operator ==(Object other) => other is BarIconColors && other.idle == idle && other.active == active && other.onActive == onActive;

  @override
  int get hashCode => Object.hash(idle, active, onActive);
}

/// Paints one bar icon in its 24 dp box.
///
/// [on] (0 to 1) cross-fades the outlined glyph in ink 2 into the filled glyph in the active
/// colour; the bar drives it (200 ms in as the lens arrives, 160 ms out). With an [initial],
/// You is an avatar instead: a 22 dp ring with the initial at rest, a filled disc with the
/// initial reversed out when active. [on] is a listenable, so a frame of motion repaints this
/// icon alone and never rebuilds the bar.
class BarIconPainter extends CustomPainter {
  BarIconPainter({required this.glyph, required this.colors, required this.on, this.initial, this.initialStyle}) : super(repaint: on);

  final BarGlyph glyph;
  final BarIconColors colors;
  final Animation<double> on;

  /// You's initial, or null to draw [glyph].
  final String? initial;

  /// The initial's type (Hanken w700); its size and colour are set here.
  final TextStyle? initialStyle;

  /// The icon box.
  static const double box = 24;

  /// The avatar's diameter, its ring, and the initial's size.
  static const double avatar = 22;
  static const double ring = 1.75;
  static const double initialSize = 12;

  /// Hanken Grotesk's cap height, in ems: the initial is centred on its capitals.
  static const double _capHeight = 0.697;

  /// How far the outline has gone and the fill has come at [t]: the fill leads, the outline
  /// holds until the fill is half in, so the shape never thins mid-way.
  static double fillAt(double t) => const Interval(0, 0.7).transform(t.clamp(0.0, 1.0));
  static double outlineAt(double t) => 1 - const Interval(0.35, 1).transform(t.clamp(0.0, 1.0));

  // Text laid out once per glyph and colour; laid out again only while a colour cross-fades.
  final List<TextPainter?> _cache = [null, null, null];

  TextPainter _text(int slot, String text, TextStyle style) {
    final cached = _cache[slot];
    if (cached != null && cached.text!.style == style && (cached.text! as TextSpan).text == text) return cached;
    cached?.dispose();
    return _cache[slot] = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.noScaling,
    )..layout();
  }

  void _glyph(Canvas canvas, Size size, int slot, IconData icon, Color color) {
    final text = _text(
      slot,
      String.fromCharCode(icon.codePoint),
      TextStyle(
        inherit: false,
        fontFamily: icon.fontFamily,
        package: icon.fontPackage,
        fontFamilyFallback: icon.fontFamilyFallback,
        fontSize: box,
        height: 1,
        color: color,
      ),
    );
    text.paint(canvas, Offset((size.width - text.width) / 2, (size.height - text.height) / 2));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final t = on.value.clamp(0.0, 1.0);
    final color = Color.lerp(colors.idle, colors.active, t)!;
    final fill = fillAt(t);
    final name = initial;
    if (name != null && name.isNotEmpty) {
      _paintAvatar(canvas, size, name, color, fill);
      return;
    }
    final outline = outlineAt(t);
    if (outline > 0) _glyph(canvas, size, 0, glyph.idle, color.withValues(alpha: color.a * outline));
    if (fill > 0) _glyph(canvas, size, 1, glyph.active, color.withValues(alpha: color.a * fill));
  }

  void _paintAvatar(Canvas canvas, Size size, String name, Color color, double fill) {
    final center = size.center(Offset.zero);
    final r = avatar / 2;
    if (fill < 1) {
      canvas.drawCircle(
        center,
        r - ring / 2,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = ring
          ..color = color,
      );
    }
    if (fill > 0) canvas.drawCircle(center, r, Paint()..color = color.withValues(alpha: color.a * fill));
    final style = (initialStyle ?? const TextStyle(fontWeight: FontWeight.w700)).copyWith(
      inherit: false,
      fontSize: initialSize,
      height: 1,
      color: Color.lerp(color, colors.onActive, fill),
    );
    final text = _text(2, name, style);
    final baseline = text.computeDistanceToActualBaseline(TextBaseline.alphabetic);
    text.paint(canvas, Offset(center.dx - text.width / 2, center.dy + _capHeight * initialSize / 2 - baseline));
  }

  @override
  bool shouldRepaint(BarIconPainter old) =>
      old.glyph != glyph || old.colors != colors || old.on != on || old.initial != initial || old.initialStyle != initialStyle;
}
