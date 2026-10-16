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

/// The bar's five icons (DOCK.md section 4, revised 14 Oct 2026 after the owner's review, and
/// app-ia-1016.md 4.4): familiar silhouettes a student reads in a split second, from one family,
/// filled when active and outlined at rest. The bar's character comes from its glass, the lens
/// and the motion, not the glyphs.
enum BarIconKind {
  /// Home: the student's day.
  today(BarGlyph(active: Icons.home_rounded, idle: Icons.home_outlined)),

  /// A question sheet: practice questions.
  practice(BarGlyph(active: Icons.quiz_rounded, idle: Icons.quiz_outlined)),

  /// A checked sheet: going back over answers and mistakes.
  review(BarGlyph(active: Icons.fact_check_rounded, idle: Icons.fact_check_outlined)),

  /// A building with columns: the colleges the marks lead to.
  colleges(BarGlyph(active: Icons.account_balance_rounded, idle: Icons.account_balance_outlined)),

  /// A person: the student's own study. Never their initial: the initial is the header avatar,
  /// which opens the account sheet, and two initials on one screen would point to two places.
  you(BarGlyph(active: Icons.person_rounded, idle: Icons.person_outlined));

  const BarIconKind(this.glyph);

  final BarGlyph glyph;
}

/// Start's glyph: a rounded play triangle (never the retired bolt), in the same 24 dp box as
/// the tab icons.
const IconData kStartGlyph = Icons.play_arrow_rounded;

/// The colours an icon is drawn with.
@immutable
class BarIconColors {
  const BarIconColors({required this.idle, required this.active});

  /// The outlined icon at rest (ink 2).
  final Color idle;

  /// The filled icon when active: volt on Night; ink on Daylight, where volt on the white lens
  /// would fail contrast.
  final Color active;

  factory BarIconColors.of(MmColors colors) => colors.isNight
      ? BarIconColors(idle: colors.ink2, active: colors.volt)
      : BarIconColors(idle: colors.ink2, active: colors.ink);

  @override
  bool operator ==(Object other) => other is BarIconColors && other.idle == idle && other.active == active;

  @override
  int get hashCode => Object.hash(idle, active);
}

/// Paints one bar icon in its 24 dp box.
///
/// [on] (0 to 1) cross-fades the outlined glyph in ink 2 into the filled glyph in the active
/// colour; the bar drives it (200 ms in as the lens arrives, 160 ms out). [on] is a listenable,
/// so a frame of motion repaints this icon alone and never rebuilds the bar.
class BarIconPainter extends CustomPainter {
  BarIconPainter({required this.glyph, required this.colors, required this.on}) : super(repaint: on);

  final BarGlyph glyph;
  final BarIconColors colors;
  final Animation<double> on;

  /// The icon box.
  static const double box = 24;

  /// How far the outline has gone and the fill has come at [t]: the fill leads, the outline
  /// holds until the fill is half in, so the shape never thins mid-way.
  static double fillAt(double t) => const Interval(0, 0.7).transform(t.clamp(0.0, 1.0));
  static double outlineAt(double t) => 1 - const Interval(0.35, 1).transform(t.clamp(0.0, 1.0));

  // Text laid out once per glyph and colour; laid out again only while a colour cross-fades.
  final List<TextPainter?> _cache = [null, null];

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
    final outline = outlineAt(t);
    if (outline > 0) _glyph(canvas, size, 0, glyph.idle, color.withValues(alpha: color.a * outline));
    if (fill > 0) _glyph(canvas, size, 1, glyph.active, color.withValues(alpha: color.a * fill));
  }

  @override
  bool shouldRepaint(BarIconPainter old) => old.glyph != glyph || old.colors != colors || old.on != on;
}
