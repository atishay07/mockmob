import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/theme.dart';

/// A tab's glyph: one Lucide outline shape, the same family the rest of the app and the web draw
/// (D8, BADGES-ICONS-1018: one icon family, no filled swap). Active reads from the accent colour,
/// the bold label and the lens, never from the shape changing.
@immutable
class BarGlyph {
  const BarGlyph(this.icon);

  final IconData icon;

  @override
  bool operator ==(Object other) => other is BarGlyph && other.icon == icon;

  @override
  int get hashCode => icon.hashCode;
}

/// The bar's four icons (DOCK.md section 4, revised 18 Oct 2026 for D8 and 19 Oct for D105): the
/// Lucide names the web uses for the same places (Glyph.jsx), outlined at rest and when active. The
/// bar's character comes from its glass, the lens and the motion, not the glyphs.
enum BarIconKind {
  /// CalendarCheck: the student's day.
  today(BarGlyph(LucideIcons.calendarCheck)),

  /// Timer: timed practice (and Your papers inside it).
  practice(BarGlyph(LucideIcons.timer)),

  /// UsersRound: the Mob, the same glyph as the Mob's rows everywhere else in the app.
  mob(BarGlyph(LucideIcons.usersRound)),

  /// UserRound: the student's own study. Never their initial: the initial is the header avatar,
  /// which opens the account sheet, and two initials on one screen would point to two places.
  you(BarGlyph(LucideIcons.userRound));

  const BarIconKind(this.glyph);

  final BarGlyph glyph;
}

/// Start's glyph: the Lucide play triangle (never the retired bolt), in the same 24 dp box as the
/// tab icons. The key draws it filled (`StartGlyph`, D56).
const IconData kStartGlyph = LucideIcons.play;

/// The colours an icon is drawn with.
@immutable
class BarIconColors {
  const BarIconColors({required this.idle, required this.active});

  /// The icon at rest (ink 2).
  final Color idle;

  /// The icon when active: the accent as a stroke (volt on Night, the darker olive on Day, so it
  /// holds on the ground; MmColors.accentText). The bar's one lime fill is still the Start key
  /// (NAV-1017 6.2: one lime fill per viewport); a stroke is not a fill. Selection never reads
  /// from colour alone: the bold label and the lens say it too.
  final Color active;

  factory BarIconColors.of(MmColors colors) => BarIconColors(idle: colors.ink2, active: colors.accentText);

  @override
  bool operator ==(Object other) => other is BarIconColors && other.idle == idle && other.active == active;

  @override
  int get hashCode => Object.hash(idle, active);
}

/// Paints one bar icon in its 24 dp box.
///
/// [on] (0 to 1) moves the colour from ink 2 to the accent; the bar drives it (200 ms in as the
/// lens arrives, 160 ms out). The shape never changes. [on] is a listenable, so a frame of motion
/// repaints this icon alone and never rebuilds the bar.
class BarIconPainter extends CustomPainter {
  BarIconPainter({required this.glyph, required this.colors, required this.on}) : super(repaint: on);

  final BarGlyph glyph;
  final BarIconColors colors;
  final Animation<double> on;

  /// The icon box (the 24 of the 16, 20, 24 icon sizes).
  static const double box = 24;

  // Text laid out once per colour; laid out again only while the colour moves.
  TextPainter? _cache;

  TextPainter _text(String text, TextStyle style) {
    final cached = _cache;
    if (cached != null && cached.text!.style == style && (cached.text! as TextSpan).text == text) return cached;
    cached?.dispose();
    return _cache = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.noScaling,
    )..layout();
  }

  @override
  void paint(Canvas canvas, Size size) {
    final t = on.value.clamp(0.0, 1.0);
    final icon = glyph.icon;
    final text = _text(
      String.fromCharCode(icon.codePoint),
      TextStyle(
        inherit: false,
        fontFamily: icon.fontFamily,
        package: icon.fontPackage,
        fontFamilyFallback: icon.fontFamilyFallback,
        fontSize: box,
        height: 1,
        color: Color.lerp(colors.idle, colors.active, t),
      ),
    );
    text.paint(canvas, Offset((size.width - text.width) / 2, (size.height - text.height) / 2));
  }

  @override
  bool shouldRepaint(BarIconPainter old) => old.glyph != glyph || old.colors != colors || old.on != on;
}
