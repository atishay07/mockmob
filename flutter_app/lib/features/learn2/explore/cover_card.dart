// One chapter cover of Explore (the web's ExploreCovers.jsx `Cover` and covers.css, the phone band): one tappable
// unit. Its media is the first Key card the chapter's feed opens with, set in display type on the lit card
// surface, under the small ref line ("Part 1, Ch 2"); under a hairline come the title, the student's one true line,
// the mix for the picked length and the key ("Play 10 minutes"). No subject object, no big numeral. Only the For you
// cover's key is volt, and it does not move with scrolling; the others are line keys.
//
// The words are CoverModel's. This file lays them out: CoverView holds a cover's words for the picked length,
// CoverStyles the type, CoverLayout the sizes and CoverMetrics the height that holds every cover of a row at any text
// size (every cover of a row is as tall as the tallest: at the usual size that is the web's 338 dp).
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/materials/edge_light.dart';
import '../../../core/widgets/materials/grain.dart';
import '../../../core/widgets/materials/shape.dart';
import '../../../core/widgets/pressable.dart';
import '../../../core/widgets/skeleton.dart';
import '../data/learn_models.dart';
import '../learn2_balance.dart';
import 'cover_model.dart';
import 'explore_copy.dart';

/// A cover's words for the picked length and the page's flags, as the web's `Cover` reads them.
@immutable
class CoverView {
  const CoverView({
    required this.cover,
    required this.title,
    required this.refLine,
    required this.media,
    required this.lead,
    required this.line,
    required this.mix,
    required this.keyLabel,
    required this.isLead,
    required this.opensQuestions,
    required this.picksUp,
  });

  factory CoverView.of(LearnCover c, {required int minutes, required bool history, required bool free, required bool freeDone}) {
    final lead = c.forYou;
    final toQuestions = CoverModel.opensQuestions(c, freeDone: freeDone);
    final resume = c.resume;
    return CoverView(
      cover: c,
      title: c.title,
      refLine: CoverModel.refLineOf(c),
      media: CoverModel.mediaOf(c, minutes),
      lead: lead ? CoverModel.leadLine(c, history: history) : null,
      line: lead ? null : CoverModel.studentLineOf(c, history: history),
      mix: toQuestions ? '' : CoverModel.mixLineOf(c, minutes, free: free, history: history),
      keyLabel: CoverModel.keyLabelOf(c, minutes, freeDone: freeDone),
      isLead: lead,
      opensQuestions: toQuestions,
      picksUp: resume != null && resume.of > 0,
    );
  }

  final LearnCover cover;
  final String title;
  final String? refLine;
  final CoverMedia media;

  /// The For you cover's line: "For you:" and the reason, or "Start here:" and book order.
  final CoverLine? lead;

  /// Another cover's one line.
  final String? line;

  /// The mix for the picked length; empty where the key opens the chapter's questions.
  final String mix;
  final String keyLabel;

  /// The For you cover: the only one whose key is volt.
  final bool isLead;

  /// Free at the day's limit with no feed to pick up: the key opens the chapter's questions on its own page.
  final bool opensQuestions;

  /// A feed to pick up.
  final bool picksUp;

  /// A long title is set a size down so it keeps its lines (the web's `data-long`).
  bool get longTitle => title.length > 48;

  /// The words the line says, for a screen reader.
  String get lineText => lead != null ? '${lead!.prefix} ${lead!.text}' : (line ?? '');

  /// What the media says, for a screen reader (the web describes the cover by its hook too).
  String get mediaText => switch (media) {
    CoverMediaCard(:final text) => text,
    CoverMediaLocked(:final label) => '$label. ${ExploreCopy.proCard}',
    CoverMediaCards(:final text, :final note) => '$text. $note',
    CoverMediaQuestions(:final text, :final note) => '$text. $note',
  };

  /// The name a screen reader gives the cover: its title and its key.
  String get spoken => '$title, $keyLabel';

  /// What a screen reader adds: the line, the mix and the hook.
  String get described => [lineText, mix, mediaText].where((s) => s.isNotEmpty).join('. ');
}

/// The sizes of a cover (the web's phone band, in dp).
abstract final class CoverLayout {
  static const double radius = 24;

  /// The gutter the row's first cover starts on, and the air between covers.
  static const double gutter = 16;
  static const double gap = 12;

  /// A cover is as wide as the row less 88 dp (so the next cover shows 60 dp of itself), at most 320.
  static const double maxWidth = 320;
  static const double widthMargin = 88;

  /// The usual size of a cover (the web's phone band, R4 owner-eye#10): 118 dp of media (its hairline included) and 174 of body,
  /// 292 in all; a cover is as tall as its fullest neighbour, with this as its floor.
  static const double baseMedia = 118;
  static const double baseBody = 174;
  static const double baseHeight = baseMedia + baseBody;

  static const EdgeInsets mediaPadding = EdgeInsets.fromLTRB(16, 14, 16, 10);
  static const EdgeInsets bodyPadding = EdgeInsets.fromLTRB(16, 12, 16, 14);
  static const double mediaGap = 8;
  static const double noteGap = 6;
  static const double lineGap = 6;
  static const double footGap = 8;
  static const double keyHeight = 46;
  static const double keyRadius = 14;
  static const double keyLip = 3;
  static const double playSize = 16;

  /// The cover's width in a row [rowWidth] wide.
  static double coverWidth(double rowWidth) => math.max(160, math.min(maxWidth, rowWidth - widthMargin));
}

/// The type of a cover (the web's covers.css, phone band), from the app's own roles.
class CoverStyles {
  const CoverStyles._(this.type, this.colors);

  factory CoverStyles.of(BuildContext context) => CoverStyles._(context.mmType, context.mmColors);

  final MmType type;
  final MmColors colors;

  /// "Chapter 5": 12.5, tabular, the quiet ink.
  TextStyle get ref => type.caption.copyWith(fontSize: 12.5, height: 16 / 12.5, fontWeight: FontWeight.w600, color: colors.ink3);

  /// The hook in display type, sized by its tier (24, 21, 18, 15.5, 14).
  TextStyle hook(String tier) {
    final (size, lineHeight, tracking) = switch (tier) {
      's' => (24.0, 1.1, -0.02),
      'm' => (21.0, 1.15, -0.02),
      'l' => (18.0, 1.2, -0.02),
      'xl' => (15.5, 1.25, -0.01),
      _ => (14.0, 1.2, -0.01),
    };
    return type.title.copyWith(fontSize: size, height: lineHeight, letterSpacing: size * tracking, color: colors.ink);
  }

  /// How many lines a hook may take: four, and five at its smallest size.
  static int hookLines(String tier) => tier == 'xxl' ? 5 : 4;

  /// The locked face's kind ("Definition") and the questions face's number ("8 questions").
  TextStyle get noteKind => type.title.copyWith(fontSize: 20, height: 1.15, letterSpacing: 20 * -0.02, color: colors.ink);
  TextStyle get noteBig => type.title.copyWith(fontSize: 22, height: 1.15, letterSpacing: 22 * -0.02, color: colors.ink);
  TextStyle get note => type.small.copyWith(fontSize: 13, height: 1.35, fontWeight: FontWeight.w500, color: colors.ink3);

  /// The title: 17, and 15.5 for a long one.
  TextStyle title({required bool long}) {
    final size = long ? 15.5 : 17.0;
    return type.title.copyWith(fontSize: size, height: long ? 1.2 : 1.18, letterSpacing: size * -0.015, color: colors.ink);
  }

  /// The student's line (13, two lines at most).
  TextStyle get line => type.small.copyWith(fontSize: 13, height: 1.35, fontWeight: FontWeight.w600, color: colors.ink2);

  /// "For you:" in the accent text.
  TextStyle get lineFor => TextStyle(fontWeight: FontWeight.w700, color: colors.accentText);

  /// The mix line (12.5, tabular, one line).
  TextStyle get mix => type.small.copyWith(fontSize: 12.5, height: 1.35, fontWeight: FontWeight.w500, color: colors.ink3);

  TextStyle keyLabel({required bool volt}) =>
      type.button.copyWith(fontSize: 15, height: 1.2, fontWeight: FontWeight.w600, color: volt ? colors.voltInk : colors.ink);

  static const int lineLines = 2;
  static const int keyLines = 2;
}

/// The height of a row's covers: the media (its hairline included) and the body under it.
@immutable
class CoverSize {
  const CoverSize({required this.media, required this.body});

  final double media;
  final double body;

  double get height => media + body;

  @override
  bool operator ==(Object other) => other is CoverSize && other.media == media && other.body == body;

  @override
  int get hashCode => Object.hash(media, body);
}

/// Measures what a row of covers needs, with the same type and widths the covers draw with. At the usual text size
/// nothing needs more than the web's 338 dp; a larger text size, a long title or a wrapped key makes every cover of the
/// row taller together, never clipped.
abstract final class CoverMetrics {
  /// Room that absorbs a fraction of a dp of rounding between the measure and the layout.
  static const double slack = 1;

  static CoverSize measure({required List<CoverView> views, required double coverWidth, required TextScaler scaler, required CoverStyles styles}) {
    final inner = coverWidth - CoverLayout.mediaPadding.horizontal;
    var hook = 0.0;
    var body = 0.0;
    for (final v in views) {
      hook = math.max(hook, _media(v, inner, scaler, styles));
      body = math.max(body, _body(v, inner, scaler, styles));
    }
    // A cover with no label draws no label row (the web's `data-noref`).
    final hasRef = views.any((v) => v.refLine != null);
    final ref = hasRef ? _height(TextSpan(text: ' ', style: styles.ref), inner, scaler, maxLines: 1) + CoverLayout.mediaGap : 0.0;
    final media = CoverLayout.mediaPadding.vertical + ref + hook + 1;
    return CoverSize(media: math.max(CoverLayout.baseMedia, media + slack), body: math.max(CoverLayout.baseBody, body + slack));
  }

  static double _media(CoverView v, double inner, TextScaler scaler, CoverStyles styles) => switch (v.media) {
    CoverMediaCard(:final text) => () {
      final tier = CoverModel.hookTier(text);
      return _height(TextSpan(text: text, style: styles.hook(tier)), inner, scaler, maxLines: CoverStyles.hookLines(tier));
    }(),
    CoverMediaLocked(:final label) =>
      _height(TextSpan(text: label, style: styles.noteKind), inner, scaler) +
          CoverLayout.noteGap +
          _height(TextSpan(text: ExploreCopy.proCard, style: styles.note), inner, scaler),
    CoverMediaCards(:final text, :final note) ||
    CoverMediaQuestions(:final text, :final note) =>
      _height(TextSpan(text: text, style: styles.noteBig), inner, scaler) + CoverLayout.noteGap + _height(TextSpan(text: note, style: styles.note), inner, scaler),
  };

  static double _body(CoverView v, double inner, TextScaler scaler, CoverStyles styles) {
    var h = CoverLayout.bodyPadding.vertical;
    h += _height(TextSpan(text: v.title, style: styles.title(long: v.longTitle)), inner, scaler);
    final line = lineSpan(v, styles);
    if (line != null) h += CoverLayout.lineGap + _height(line, inner, scaler, maxLines: CoverStyles.lineLines);
    h += CoverLayout.lineGap;
    if (v.mix.isNotEmpty) h += _height(TextSpan(text: v.mix, style: styles.mix), inner, scaler, maxLines: 1) + CoverLayout.footGap;
    h += keyHeight(v, inner, scaler, styles);
    return h;
  }

  /// The student's or the lead's line as text, or null when the cover has none.
  static InlineSpan? lineSpan(CoverView v, CoverStyles styles) {
    final lead = v.lead;
    if (lead != null) {
      return TextSpan(style: styles.line, children: [TextSpan(text: lead.prefix, style: styles.lineFor), TextSpan(text: ' ${lead.text}')]);
    }
    final line = v.line;
    return line == null ? null : TextSpan(text: line, style: styles.line);
  }

  /// The key: 46 dp, or taller where its words wrap.
  static double keyHeight(CoverView v, double inner, TextScaler scaler, CoverStyles styles) {
    final room = inner - CoverKeyFace.padding.horizontal - (v.opensQuestions ? 0 : CoverLayout.playSize + CoverKeyFace.glyphGap);
    final words = _height(TextSpan(text: v.keyLabel, style: styles.keyLabel(volt: v.isLead)), room, scaler, maxLines: CoverStyles.keyLines);
    return math.max(CoverLayout.keyHeight, CoverKeyFace.padding.vertical + words);
  }

  static double _height(InlineSpan span, double width, TextScaler scaler, {int? maxLines}) {
    final painter = TextPainter(text: span, textDirection: TextDirection.ltr, textScaler: scaler, maxLines: maxLines, ellipsis: maxLines == null ? null : '…')
      ..layout(maxWidth: math.max(width, 1));
    final h = painter.height;
    painter.dispose();
    return h;
  }
}

/// One cover. The whole cover is the target: a press sinks it a little and its key with it, a tap gives the selection
/// tick and calls [onTap].
class CoverCard extends StatelessWidget {
  const CoverCard({super.key, required this.view, required this.size, required this.position, required this.total, required this.onTap});

  final CoverView view;
  final CoverSize size;

  /// Where the cover stands in its row, from 0, and how many there are (spoken as "3 of 14").
  final int position;
  final int total;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    const radius = BorderRadius.all(Radius.circular(CoverLayout.radius));
    return Semantics(
      container: true,
      button: true,
      enabled: true,
      label: view.spoken,
      value: ExploreCopy.pager(position + 1, total),
      hint: view.described,
      onTap: onTap,
      excludeSemantics: true,
      child: MmPressable(
        onTap: onTap,
        haptic: MmPressHaptic.selection,
        pressedScale: 0.985,
        focusRadius: radius,
        excludeSemantics: false,
        builder: (context, pressed, _) => _Surface(pressed: pressed, child: _Face(view: view, size: size, pressed: pressed)),
      ),
    );
  }
}

/// The cover's surface: the Key cards' lit card (raised, a 1 dp strong line, the edge light along the top, the card
/// shadow), its content clipped to its shape.
class _Surface extends StatelessWidget {
  const _Surface({required this.child, this.pressed = false, this.skeleton = false});

  final Widget child;
  final bool pressed;

  /// A placeholder: its hairline border and no shadow.
  final bool skeleton;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    const r = BorderRadius.all(Radius.circular(CoverLayout.radius));
    return DecoratedBox(
      decoration: ShapeDecoration(color: colors.raised, shape: mmShapeBorder(r), shadows: skeleton ? null : colors.cardShadow),
      child: CustomPaint(
        foregroundPainter: skeleton
            ? null
            : EdgeLightPainter(borderRadius: r, top: colors.edgeTop, bottom: colors.edgeBottom.withValues(alpha: 0), sheen: false, boost: pressed ? 1.6 : 1),
        child: DecoratedBox(
          position: DecorationPosition.foreground,
          decoration: ShapeDecoration(shape: mmShapeBorder(r, side: BorderSide(color: skeleton ? colors.line : colors.lineStrong))),
          child: MmClip(borderRadius: r, child: child),
        ),
      ),
    );
  }
}

class _Face extends StatelessWidget {
  const _Face({required this.view, required this.size, required this.pressed});

  final CoverView view;
  final CoverSize size;
  final bool pressed;

  @override
  Widget build(BuildContext context) {
    final styles = CoverStyles.of(context);
    final hasLine = view.lead != null || view.line != null;
    final line = CoverMetrics.lineSpan(view, styles);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(height: size.media, child: _Media(view: view, styles: styles)),
        Expanded(
          child: Padding(
            padding: CoverLayout.bodyPadding,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                BalancedText(view.title, style: styles.title(long: view.longTitle)),
                if (hasLine && line != null) ...[
                  const SizedBox(height: CoverLayout.lineGap),
                  Text.rich(line, maxLines: CoverStyles.lineLines, overflow: TextOverflow.ellipsis),
                ],
                const SizedBox(height: CoverLayout.lineGap),
                const Spacer(),
                if (view.mix.isNotEmpty) ...[
                  _Swap(text: view.mix, alignment: Alignment.centerLeft, child: Text(view.mix, maxLines: 1, overflow: TextOverflow.ellipsis, style: styles.mix)),
                  const SizedBox(height: CoverLayout.footGap),
                ],
                CoverKeyFace(label: view.keyLabel, volt: view.isLead, play: !view.opensQuestions, pressed: pressed),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// A line of words that changes (the length was picked): the new words fade in over the old (180 ms), nothing else moves.
class _Swap extends StatelessWidget {
  const _Swap({required this.text, required this.child, this.alignment = Alignment.center});

  final String text;
  final Alignment alignment;
  final Widget child;

  @override
  Widget build(BuildContext context) => MmOverlapSwitcher.fade(
    duration: const Duration(milliseconds: 180),
    alignment: alignment,
    child: KeyedSubtree(key: ValueKey<String>(text), child: child),
  );
}

/// The media of a cover: the ref line over the lit card surface, and under it the hook, or the locked face, or the
/// questions face, centred in what is left; a hairline at its foot.
class _Media extends StatelessWidget {
  const _Media({required this.view, required this.styles});

  final CoverView view;
  final CoverStyles styles;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final Widget face = switch (view.media) {
      CoverMediaCard(:final text) => () {
        final tier = CoverModel.hookTier(text);
        return BalancedText(text, maxLines: CoverStyles.hookLines(tier), overflow: TextOverflow.ellipsis, style: styles.hook(tier));
      }(),
      CoverMediaLocked(:final label) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: styles.noteKind),
          const SizedBox(height: CoverLayout.noteGap),
          Text(ExploreCopy.proCard, style: styles.note),
        ],
      ),
      CoverMediaCards(:final text, :final note) || CoverMediaQuestions(:final text, :final note) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(text, style: styles.noteBig),
          const SizedBox(height: CoverLayout.noteGap),
          Text(note, style: styles.note),
        ],
      ),
    };
    return Stack(
      children: [
        // A flat surface and the film grain, no tinted radial (the web: no gradients or glow, R2 screens 18).
        Positioned.fill(child: ColoredBox(color: colors.raised2)),
        const Positioned.fill(child: IgnorePointer(child: RepaintBoundary(child: Grain()))),
        Padding(
          padding: CoverLayout.mediaPadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (view.refLine != null) ...[
                Text(view.refLine!, maxLines: 1, overflow: TextOverflow.ellipsis, style: styles.ref),
                const SizedBox(height: CoverLayout.mediaGap),
              ],
              Expanded(child: Align(alignment: Alignment.centerLeft, child: face)),
            ],
          ),
        ),
        Positioned(left: 0, right: 0, bottom: 0, height: 1, child: ColoredBox(color: colors.line)),
      ],
    );
  }
}

/// The key of a cover (the web's `.kc-btn` inside the cover link): not a control of its own, the cover's tap is the
/// tap. Volt on the For you cover only, on a 3 dp lip of the darker volt that it sinks into when the cover is pressed;
/// a line key (raised, a strong line) on the others. A play glyph before the words where a feed starts.
class CoverKeyFace extends StatelessWidget {
  const CoverKeyFace({super.key, required this.label, required this.volt, required this.play, required this.pressed});

  final String label;
  final bool volt;
  final bool play;
  final bool pressed;

  /// The key's padding, and the air between the glyph and the words.
  static const EdgeInsets padding = EdgeInsets.symmetric(horizontal: 16, vertical: 12);
  static const double glyphGap = 8;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final styles = CoverStyles.of(context);
    const r = BorderRadius.all(Radius.circular(CoverLayout.keyRadius));
    final ink = volt ? colors.voltInk : colors.ink;
    final face = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: CoverLayout.keyHeight, minWidth: double.infinity),
      child: Padding(
        padding: padding,
        child: Center(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (play) ...[CoverPlayGlyph(color: ink), const SizedBox(width: glyphGap)],
              Flexible(
                child: _Swap(
                  text: label,
                  child: Text(label, textAlign: TextAlign.center, maxLines: CoverStyles.keyLines, overflow: TextOverflow.ellipsis, style: styles.keyLabel(volt: volt)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    final duration = Motion.of(context, const Duration(milliseconds: 100));
    return ExcludeSemantics(
      child: TweenAnimationBuilder<double>(
        tween: Tween<double>(end: pressed ? 1 : 0),
        duration: duration,
        curve: Motion.out,
        builder: (context, depth, _) {
          if (volt) {
            final lip = CoverLayout.keyLip * (1 - depth);
            return Transform.translate(
              offset: Offset(0, -1 + 3 * depth),
              child: DecoratedBox(
                decoration: ShapeDecoration(
                  color: colors.volt,
                  shape: mmShapeBorder(r, side: BorderSide(color: Color.lerp(colors.volt, colors.voltEdge, 0.6)!)),
                  shadows: [if (lip > 0) BoxShadow(color: colors.voltEdge, offset: Offset(0, lip))],
                ),
                child: face,
              ),
            );
          }
          return Transform.scale(
            scale: 1 - 0.02 * depth,
            child: DecoratedBox(
              decoration: ShapeDecoration(color: colors.raised, shape: mmShapeBorder(r, side: BorderSide(color: colors.lineStrong))),
              child: face,
            ),
          );
        },
      ),
    );
  }
}

/// Lucide's play (`6 3 20 12 6 21`), filled, 2.4 stroke, round joins: the icon font cannot fill.
class CoverPlayGlyph extends StatelessWidget {
  const CoverPlayGlyph({super.key, required this.color, this.size = CoverLayout.playSize});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) => SizedBox.square(dimension: size, child: CustomPaint(painter: _PlayPainter(color)));
}

class _PlayPainter extends CustomPainter {
  const _PlayPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.shortestSide / 24);
    final path = Path()
      ..moveTo(6, 3)
      ..lineTo(20, 12)
      ..lineTo(6, 21)
      ..close();
    canvas.drawPath(path, Paint()..color = color);
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_PlayPainter old) => old.color != color;
}

/// A cover while the covers load, at the size of a real one: the ref bar, two hook bars, the hairline, two title bars,
/// a line bar, a mix bar and a key block (no shadow, a hairline border).
class CoverSkeleton extends StatelessWidget {
  const CoverSkeleton({super.key, required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    final media = height * CoverLayout.baseMedia / CoverLayout.baseHeight;
    return SizedBox(
      height: height,
      child: _Surface(
        skeleton: true,
        child: LayoutBuilder(
          builder: (context, c) {
            final inner = c.maxWidth - CoverLayout.mediaPadding.horizontal;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: media,
                  child: Padding(
                    padding: CoverLayout.mediaPadding,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Skeleton(width: 72, height: 12, radius: 8),
                        const SizedBox(height: 12),
                        Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Skeleton(width: inner * 0.85, height: 20, radius: 8),
                              const SizedBox(height: 10),
                              Skeleton(width: inner * 0.6, height: 20, radius: 8),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                ColoredBox(color: context.mmColors.line, child: const SizedBox(height: 1)),
                Expanded(
                  child: Padding(
                    padding: CoverLayout.bodyPadding,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Skeleton(width: inner * 0.8, height: 16, radius: 8),
                        const SizedBox(height: 6),
                        Skeleton(width: inner * 0.55, height: 16, radius: 8),
                        const SizedBox(height: 10),
                        Skeleton(width: inner * 0.45, height: 12, radius: 8),
                        const Spacer(),
                        Skeleton(width: inner * 0.38, height: 12, radius: 8),
                        const SizedBox(height: CoverLayout.footGap),
                        const Skeleton(height: CoverLayout.keyHeight, radius: CoverLayout.keyRadius),
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
