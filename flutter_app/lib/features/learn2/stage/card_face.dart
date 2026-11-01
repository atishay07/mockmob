/// A Key card on the study stage (the web's `CardFace`, BUILD-1101 B1/B7, A1 3.4, A8 3.2): it fits its words.
///
///   size     both faces are laid out and the card takes the taller one's height, at least
///            clamp(300, 0.46 x screen height, 380) dp and at most the item area minus 28 dp (the stamp line) minus 4% of
///            the screen height; a face taller than that scrolls inside, with a 44 dp fade at its foot while more is
///            below (the pager's edge rule applies to that scroll too)
///   front    the kind line (13 semibold ink-3, and an extra kind such as "Back from earlier"), the prompt in Bricolage
///            sized by its length (s 34/1.12, m 28/1.16, l 22/1.3; 32/26/21 under 380 dp wide), blanks drawn as gaps,
///            centred between the kind line and the source foot (a book glyph and "Accountancy Part 1, Ch 2, p. 64").
///            The whole front is a tap target ("Turn over: " and the front); its words stay readable to a screen reader.
///   back     the kind line, the prompt small (two lines), NCERT's line at the web's back size, its source, and a
///            "Turn back" text key; a tap on the back turns it back
///   turn     rotateY 0 to 180 in 340 ms on `Motion.drawer` with perspective (1200), the faces swapping at 90 degrees,
///            a light haptic; under reduced motion a 120 ms cross-fade
///   stamp    the line under the card (20 dp, 8 dp below): a filled bookmark and "In Revise", or the bad colour for
///            "Not kept. Try again."; it fades in over 200 ms
///   No Must-know tag: every card in a feed or a run is Must-know (LK13); the tag stays in the Cards view.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/materials/edge_light.dart';
import '../../../core/widgets/materials/shape.dart';
import '../../keycards/data/keycards_lines.dart' show cardFace, sourceLine;
import '../../keycards/data/keycards_models.dart';
import '../../keycards/data/keycards_rules.dart' show BlankedLine;
import 'stage_balance.dart';
import 'stage_keys.dart';
import 'stage_motion.dart';
import 'stage_ncert.dart';
import 'stage_pager.dart';
import 'stage_sizes.dart';
import 'stage_text.dart';

/// The line under a card: "In Revise", "In Revise, back Wed", "This card is on Pro.", or [bad] for "Not kept. Try
/// again." (no bookmark then, and it is announced).
@immutable
class StageStamp {
  const StageStamp(this.text, {this.bad = false});

  final String text;
  final bool bad;

  @override
  bool operator ==(Object other) => other is StageStamp && other.text == text && other.bad == bad;

  @override
  int get hashCode => Object.hash(text, bad);
}

class CardFace extends StatefulWidget {
  const CardFace({
    super.key,
    required this.kindLabel,
    required this.front,
    required this.back,
    this.extraKind,
    this.source,
    this.turned = false,
    this.onTurn,
    this.stamp,
    this.cardKey,
    this.area,
  });

  /// The card as the stage shows it: its kind label and front by the Key cards' rules (`cardFace`), its book line
  /// (`sourceLine`).
  factory CardFace.of(
    KeyCard card, {
    Key? key,
    String? extraKind,
    bool turned = false,
    VoidCallback? onTurn,
    StageStamp? stamp,
    GlobalKey? cardKey,
    double? area,
  }) {
    final face = cardFace(card);
    return CardFace(
      key: key,
      kindLabel: face.label,
      front: face.front,
      back: card,
      extraKind: extraKind,
      source: sourceLine(card.source),
      turned: turned,
      onTurn: onTurn,
      stamp: stamp,
      cardKey: cardKey,
      area: area,
    );
  }

  /// "Definition", "Key line", "Journal entry".
  final String kindLabel;

  /// Beside the kind: "Back from earlier", "The line you needed".
  final String? extraKind;

  /// The prompt, with `____` for a blank.
  final String front;

  /// The card whose back (NCERT's line) and reference the back face shows.
  final KeyCard back;

  /// The front's foot: "Accountancy Part 1, Ch 2, p. 64".
  final String? source;
  final bool turned;
  final VoidCallback? onTurn;
  final StageStamp? stamp;

  /// On the card: where the Keep flight starts.
  final GlobalKey? cardKey;

  /// The item area's height; null reads it from the pager (or estimates it from the screen outside one).
  final double? area;

  static const double radius = StageSizes.cardRadius;

  /// The card's least height on a screen [screenHeight] tall: clamp(300, 46%, 380).
  static double minHeightFor(double screenHeight) => StageSizes.cardMin(screenHeight);

  /// The card's greatest height in an item area [area] tall: the area less the stamp line (28) and 4% of the screen
  /// (never under the least height).
  static double maxHeightFor(double area, double screenHeight) => StageSizes.cardMax(area, screenHeight);

  /// The prompt's size, line height and tracking by its size step and the screen's width (A1 3.4).
  static ({double size, double height, double tracking}) promptStyle(String step, double screenWidth) => StageSizes.prompt(step, screenWidth);

  @override
  State<CardFace> createState() => _CardFaceState();
}

class _CardFaceState extends State<CardFace> with SingleTickerProviderStateMixin {
  late final AnimationController _turn = AnimationController(vsync: this, duration: const Duration(milliseconds: 340), value: widget.turned ? 1 : 0);

  @override
  void didUpdateWidget(CardFace old) {
    super.didUpdateWidget(old);
    if (widget.turned == old.turned) return;
    hapticsOf(context)?.light();
    if (Motion.reduced(context)) {
      _turn.duration = Motion.reducedFade;
      if (widget.turned) {
        _turn.forward();
      } else {
        _turn.reverse();
      }
      return;
    }
    _turn.duration = const Duration(milliseconds: 340);
    if (widget.turned) {
      _turn.animateTo(1, curve: Motion.drawer);
    } else {
      _turn.animateBack(0, curve: Motion.drawer);
    }
  }

  @override
  void dispose() {
    _turn.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.sizeOf(context);
    final area = widget.area ?? StagePager.areaOf(context) ?? (media.height - 166);
    final minH = CardFace.minHeightFor(media.height);
    final maxH = CardFace.maxHeightFor(area, media.height);
    final reduced = Motion.reduced(context);
    final front = _Face(
      key: const ValueKey('front'),
      child: _FrontBody(kindLabel: widget.kindLabel, extraKind: widget.extraKind, front: widget.front, source: widget.source, width: media.width),
    );
    final back = _Face(
      key: const ValueKey('back'),
      scrollable: true,
      onTap: widget.onTurn,
      child: _BackBody(kindLabel: widget.kindLabel, extraKind: widget.extraKind, front: widget.front, card: widget.back, onTurn: widget.onTurn),
    );
    final speak = 'Turn over: ${StageText.speakable(widget.front)}';
    final pair = AnimatedBuilder(
      animation: _turn,
      builder: (context, _) {
        final v = _turn.value;
        final showBack = reduced ? v >= 0.5 : v >= 0.5;
        Widget side(Widget face, {required bool isBack}) {
          final active = isBack == showBack;
          Widget out;
          if (reduced) {
            out = Opacity(opacity: isBack ? v : 1 - v, child: face);
          } else {
            final angle = math.pi * v - (isBack ? math.pi : 0);
            out = Visibility(
              visible: active,
              maintainSize: true,
              maintainAnimation: true,
              maintainState: true,
              child: Transform(
                alignment: Alignment.center,
                transform: Matrix4.identity()
                  ..setEntry(3, 2, 1 / 1200)
                  ..rotateY(angle),
                child: face,
              ),
            );
          }
          return IgnorePointer(ignoring: !active, child: ExcludeSemantics(excluding: !active, child: out));
        }

        return _FacePair(
          minHeight: minH,
          maxHeight: maxH,
          children: [
            side(
              Stack(
                children: [
                  front,
                  // The front's tap target: a button over the face, so its words stay readable on their own.
                  Positioned.fill(
                    child: Semantics(
                      button: true,
                      label: speak,
                      onTap: widget.onTurn,
                      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: widget.onTurn),
                    ),
                  ),
                ],
              ),
              isBack: false,
            ),
            side(Semantics(container: true, label: "NCERT's line", child: back), isBack: true),
          ],
        );
      },
    );
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KeyedSubtree(key: widget.cardKey, child: pair),
        const SizedBox(height: MmSpace.s8),
        SizedBox(height: 20, child: _Stamp(stamp: widget.stamp)),
      ],
    );
  }
}

/// The card's surface (the Key cards' lit card: raised, a 1 dp strong line, the edge light along the top, the card
/// shadow), its content clipped to the card's shape.
class _Face extends StatefulWidget {
  const _Face({super.key, required this.child, this.scrollable = false, this.onTap});

  final Widget child;
  final bool scrollable;
  final VoidCallback? onTap;

  @override
  State<_Face> createState() => _FaceState();
}

class _FaceState extends State<_Face> {
  bool _more = false;

  bool _read(ScrollMetrics m) {
    final more = m.extentAfter > 4;
    if (more != _more) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _more = more);
      });
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final r = BorderRadius.circular(CardFace.radius);
    final physics = StagePager.physicsOf(context);
    Widget content = LayoutBuilder(
      builder: (context, c) => ScrollConfiguration(
        behavior: ScrollConfiguration.of(context).copyWith(scrollbars: false, overscroll: false),
        child: SingleChildScrollView(
          physics: physics,
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: c.minHeight),
            child: Padding(padding: const EdgeInsets.fromLTRB(20, 20, 20, 18), child: widget.child),
          ),
        ),
      ),
    );
    content = NotificationListener<ScrollMetricsNotification>(
      onNotification: (n) => n.depth == 0 && _read(n.metrics),
      child: NotificationListener<ScrollNotification>(onNotification: (n) => n.depth == 0 && _read(n.metrics), child: content),
    );
    if (widget.onTap != null) {
      content = GestureDetector(behavior: HitTestBehavior.translucent, onTap: widget.onTap, child: content);
    }
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: mmShapeBorder(r, side: BorderSide(color: colors.lineStrong)),
        shadows: colors.cardShadow,
      ),
      child: CustomPaint(
        foregroundPainter: EdgeLightPainter(borderRadius: r, top: colors.edgeTop, bottom: colors.edgeBottom.withValues(alpha: 0), sheen: false),
        child: MmClip(
          borderRadius: r,
          child: Stack(
            children: [
              content,
              // The foot fades while more of the face waits below.
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                height: 44,
                child: IgnorePointer(
                  child: AnimatedOpacity(
                    opacity: _more ? 1 : 0,
                    duration: Motion.of(context, const Duration(milliseconds: 150)),
                    curve: Motion.out,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [colors.raised.withValues(alpha: 0), colors.raised],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The kind line: 13 semibold ink-3, the extra kind 12 dp after it (wrapping under it when it does not fit).
class _KindLine extends StatelessWidget {
  const _KindLine({required this.kindLabel, this.extraKind});

  final String kindLabel;
  final String? extraKind;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final style = context.mmType.label.copyWith(fontSize: 13, height: 1.3, color: colors.ink3);
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 18),
      child: Wrap(
        spacing: MmSpace.s12,
        runSpacing: MmSpace.s2,
        children: [
          Text(kindLabel, style: style),
          if (extraKind != null && extraKind!.isNotEmpty) Text(extraKind!, style: style),
        ],
      ),
    );
  }
}

/// The front: the kind line at the top, the source at the foot, the prompt centred between them.
class _FrontBody extends StatelessWidget {
  const _FrontBody({required this.kindLabel, required this.front, required this.width, this.extraKind, this.source});

  final String kindLabel;
  final String? extraKind;
  final String front;
  final String? source;
  final double width;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final p = CardFace.promptStyle(StageText.frontSize(front), width);
    final style = type.headline.copyWith(fontSize: p.size, height: p.height, letterSpacing: p.size * p.tracking, wordSpacing: 0, color: colors.ink);
    final line = BlankedLine.front(front);
    final span = TextSpan(
      style: style,
      children: [
        for (final part in line.parts)
          if (!part.blank)
            TextSpan(text: part.text)
          else
            TextSpan(
              text: ' ' * 10,
              semanticsLabel: 'blank',
              style: TextStyle(decoration: TextDecoration.underline, decorationColor: colors.ink3, decorationThickness: 1.5),
            ),
      ],
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        _KindLine(kindLabel: kindLabel, extraKind: extraKind),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Semantics(header: true, child: StageBalancedText(span)),
        ),
        if (source != null)
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 18),
            child: Row(
              children: [
                Icon(LucideIcons.bookOpen, size: 14, color: colors.ink3),
                const SizedBox(width: MmSpace.s6),
                Flexible(
                  child: Text(source!, style: type.caption.copyWith(fontSize: 12.5, height: 1.4, color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()])),
                ),
              ],
            ),
          )
        else
          const SizedBox(height: 18),
      ],
    );
  }
}

/// The back: the kind line, the prompt small, NCERT's line and its source, and "Turn back" at the foot.
class _BackBody extends StatelessWidget {
  const _BackBody({required this.kindLabel, required this.front, required this.card, this.extraKind, this.onTurn});

  final String kindLabel;
  final String? extraKind;
  final String front;
  final KeyCard card;
  final VoidCallback? onTurn;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final size = stageBackSize(StageText.backSize(card.back));
    final asked = type.label.copyWith(fontSize: 13, height: 1.4, color: colors.ink3);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _KindLine(kindLabel: kindLabel, extraKind: extraKind),
            if (StageText.speakable(front).isNotEmpty) ...[
              const SizedBox(height: 14),
              StageMarkedText(line: BlankedLine.front(front), style: asked, maxLines: 2),
            ],
            const SizedBox(height: 14),
            StageNcert(card: card, size: size.size, height: size.height),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Align(
            alignment: Alignment.centerRight,
            child: StageTextKey(label: 'Turn back', size: 13.5, quiet: true, onTap: onTurn),
          ),
        ),
      ],
    );
  }
}

/// The stamp line under the card.
class _Stamp extends StatelessWidget {
  const _Stamp({this.stamp});

  final StageStamp? stamp;

  @override
  Widget build(BuildContext context) {
    final s = stamp;
    if (s == null || s.text.isEmpty) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      liveRegion: s.bad,
      child: StageIn(
        replay: s,
        child: Row(
          children: [
            if (!s.bad) ...[StageBookmark(size: 14, color: stageSelect(colors)), const SizedBox(width: MmSpace.s6)],
            Flexible(
              child: Text(
                s.text,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: type.label.copyWith(fontSize: 13, height: 1.3, color: s.bad ? colors.badText : colors.ink2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Two faces in one cell: both are laid out between [minHeight] and [maxHeight], and both take the taller one's
/// height, so the turn never changes the card's size (the web's grid stacking).
class _FacePair extends MultiChildRenderObjectWidget {
  const _FacePair({required this.minHeight, required this.maxHeight, required super.children});

  final double minHeight;
  final double maxHeight;

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderFacePair(minHeight, maxHeight);

  @override
  void updateRenderObject(BuildContext context, _RenderFacePair renderObject) {
    renderObject
      ..minHeight = minHeight
      ..maxHeight = maxHeight;
  }
}

class _FaceData extends ContainerBoxParentData<RenderBox> {}

class _RenderFacePair extends RenderBox with ContainerRenderObjectMixin<RenderBox, _FaceData>, RenderBoxContainerDefaultsMixin<RenderBox, _FaceData> {
  _RenderFacePair(this._minHeight, this._maxHeight);

  double _minHeight;
  set minHeight(double v) {
    if (v == _minHeight) return;
    _minHeight = v;
    markNeedsLayout();
  }

  double _maxHeight;
  set maxHeight(double v) {
    if (v == _maxHeight) return;
    _maxHeight = v;
    markNeedsLayout();
  }

  @override
  void setupParentData(RenderBox child) {
    if (child.parentData is! _FaceData) child.parentData = _FaceData();
  }

  @override
  void performLayout() {
    final w = constraints.maxWidth;
    final lo = math.min(_minHeight, _maxHeight);
    final hi = math.max(_minHeight, _maxHeight);
    var h = lo;
    var child = firstChild;
    while (child != null) {
      child.layout(BoxConstraints(minWidth: w, maxWidth: w, minHeight: lo, maxHeight: hi), parentUsesSize: true);
      h = math.max(h, child.size.height);
      child = childAfter(child);
    }
    h = math.min(h, hi);
    child = firstChild;
    while (child != null) {
      child.layout(BoxConstraints.tightFor(width: w, height: h));
      (child.parentData! as _FaceData).offset = Offset.zero;
      child = childAfter(child);
    }
    size = constraints.constrain(Size(w, h));
  }

  @override
  void paint(PaintingContext context, Offset offset) => defaultPaint(context, offset);

  @override
  bool hitTestChildren(BoxHitTestResult result, {required Offset position}) => defaultHitTestChildren(result, position: position);
}
