/// A Key card on the study stage (the web's `CardFace`, BUILD-1101 B1/B7, A1 3.4, A8 3.2, R3 L1): a flashcard.
///
///   size     the card fills its page: all the height it is given less the 28 dp stamp line (8 dp gap, 20 dp line). A face
///            taller than that scrolls inside, top-aligned, with a 44 dp fade at its foot while more is below (the pager's
///            edge rule applies to that scroll too). Given no height (outside a pager) it takes the taller face's height,
///            at least clamp(300, 0.46 x screen height, 380) dp
///   paper    an index card from a deck (R8, the web's commit 20762eb34, `stage_paper.dart`): Day cream stock, Night neutral
///            charcoal, the film grain, one quiet hairline and a soft shadow, no light rim. The kind is a header band across
///            the card's top (48 dp) in its family's wash (`kindFamily`), the kind word on the left (15 semibold, AA on the
///            wash), an extra kind ("Back from earlier", the run's "Due today") on its right in ink-2
///   front    the band, the source foot pinned to the bottom under a hairline (a book glyph and "Accountancy Part 1, Ch 2,
///            p. 64"), the prompt between them a little above the middle in Bricolage by its length (34 / 28 / 22 up to 60 /
///            140 / longer characters; 32 / 26 / 21 under 380 dp wide; line height 1.15), blanks drawn as gaps with the
///            punctuation that touches them on the gap's own line (`blankRuns`). The whole front is a tap target ("Turn
///            over: " and the front); its words stay readable
///   back     the band, then from the top on faint ruled lines at the back's line height: the prompt small (two lines),
///            NCERT's line at the web's back size and its source; "Turn back" at the foot; a tap on the back turns it back.
///            A journal entry keeps plain paper
///   turn     rotateY 0 to 180 in 340 ms on `Motion.drawer` with perspective (1200), the faces swapping at 90 degrees,
///            a light haptic; under reduced motion a 120 ms cross-fade
///   stamp    the line under the card (20 dp, 8 dp below): a check and "In Revise" (once the server has it), or the bad
///            colour for "Not added. Try again."; it fades in over 200 ms
///   sci      a chemistry card draws its front, back and quote with real subscripts and superscripts (`stage_sci.dart`)
///   No Must-know tag: every card in a feed or a run is Must-know (LK13); the tag stays in the Cards view.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/materials/grain.dart';
import '../../../core/widgets/materials/shape.dart';
import '../../keycards/data/keycards_lines.dart' show KcEntryBack, KcFamily, backShape, blankRuns, cardFace, kindFamily, sourceLine;
import '../../keycards/data/keycards_models.dart';
import '../../keycards/data/keycards_rules.dart' show BlankedLine;
import 'stage_balance.dart';
import 'stage_keys.dart';
import 'stage_motion.dart';
import 'stage_ncert.dart';
import 'stage_pager.dart';
import 'stage_paper.dart';
import 'stage_sci.dart';
import 'stage_sizes.dart';
import 'stage_text.dart';

/// The line under a card: "In Revise", "In Revise, back Wed", "This card is on Pro.", or [bad] for "Not added. Try
/// again." (no check then, and it is announced).
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
    this.family,
    this.extraKind,
    this.tagRight = false,
    this.source,
    this.turned = false,
    this.onTurn,
    this.stamp,
    this.cardKey,
    this.area,
    this.sci = false,
    this.stampLine = true,
  });

  /// The card as the stage shows it: its kind label and front by the Key cards' rules (`cardFace`), its book line
  /// (`sourceLine`).
  factory CardFace.of(
    KeyCard card, {
    Key? key,
    String? extraKind,
    bool tagRight = false,
    bool turned = false,
    VoidCallback? onTurn,
    StageStamp? stamp,
    GlobalKey? cardKey,
    double? area,
    bool sci = false,
    bool stampLine = true,
  }) {
    final face = cardFace(card);
    return CardFace(
      key: key,
      kindLabel: face.label,
      front: face.front,
      back: card,
      family: kindFamily(card.kind),
      extraKind: extraKind,
      tagRight: tagRight,
      source: sourceLine(card.source),
      turned: turned,
      onTurn: onTurn,
      stamp: stamp,
      cardKey: cardKey,
      area: area,
      sci: sci,
      stampLine: stampLine,
    );
  }

  /// "Definition", "Key line", "Journal entry".
  final String kindLabel;

  /// The kind's colour family, the header band's wash (`kindFamily`); null is the plain band.
  final KcFamily? family;

  /// On the band's right: "Back from earlier", "The line you needed".
  final String? extraKind;

  /// The extra kind is the run's stage tag ("Due today", 12.5), not the feed's line (13). Either sits on the band's right.
  final bool tagRight;

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

  /// The height to use when the card is given none (outside a pager); null reads the pager's or estimates it from the screen.
  final double? area;

  /// A chemistry card: its words draw with subscripts and superscripts.
  final bool sci;

  /// The 28 dp line under the card (8 dp gap, the stamp): the feed has it; the run puts its stamp under its keys and gives the
  /// height back to the card.
  final bool stampLine;

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
    final reduced = Motion.reduced(context);
    final front = _Face(
      key: const ValueKey('front'),
      child: _FrontBody(kindLabel: widget.kindLabel, family: widget.family, extraKind: widget.extraKind, tagRight: widget.tagRight, front: widget.front, source: widget.source, width: media.width, sci: widget.sci),
    );
    final back = _Face(
      key: const ValueKey('back'),
      scrollable: true,
      onTap: widget.onTurn,
      child: _BackBody(kindLabel: widget.kindLabel, family: widget.family, extraKind: widget.extraKind, tagRight: widget.tagRight, front: widget.front, card: widget.back, onTurn: widget.onTurn, sci: widget.sci),
    );
    final speak = 'Turn over: ${StageText.speakable(widget.front)}';
    Widget pair(double minH, double maxH) => AnimatedBuilder(
      animation: _turn,
      builder: (context, _) {
        final v = _turn.value;
        final showBack = v >= 0.5;
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
                fit: StackFit.passthrough,
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
    final stamp = SizedBox(height: 20, child: _Stamp(stamp: widget.stamp));
    return LayoutBuilder(
      builder: (context, c) {
        if (c.hasBoundedHeight && c.maxHeight.isFinite) {
          // A flashcard: the card fills its page, the stamp line under it.
          final fill = math.max(0.0, c.maxHeight - (widget.stampLine ? _stampLine : 0));
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(height: fill, child: KeyedSubtree(key: widget.cardKey, child: pair(fill, fill))),
              if (widget.stampLine) ...[const SizedBox(height: MmSpace.s8), stamp],
            ],
          );
        }
        // No height given: it fits its words, at least clamp(300, 46%, 380) dp and at most the area less the stamp line.
        final area = widget.area ?? StagePager.areaOf(context) ?? (media.height - 166);
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KeyedSubtree(key: widget.cardKey, child: pair(CardFace.minHeightFor(media.height), CardFace.maxHeightFor(area, media.height))),
            const SizedBox(height: MmSpace.s8),
            stamp,
          ],
        );
      },
    );
  }

  /// The stamp line under the card: 8 dp gap and a 20 dp line.
  static const double _stampLine = 28;
}

/// The card's surface, the paper (`stage_paper.dart`): the stock with the film grain under the words, one quiet hairline and the
/// soft shadow, no light rim; its content clipped to the card's shape. The bodies set their own padding (the band is full bleed).
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
    final paper = context.mmColors.paper;
    final r = BorderRadius.circular(CardFace.radius);
    final physics = StagePager.physicsOf(context);
    Widget content = LayoutBuilder(
      builder: (context, c) => ScrollConfiguration(
        behavior: ScrollConfiguration.of(context).copyWith(scrollbars: false, overscroll: false),
        child: SingleChildScrollView(
          physics: physics,
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: c.minHeight),
            child: widget.child,
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
      decoration: StagePaper.surface(paper, r),
      child: MmClip(
        borderRadius: r,
        child: Stack(
          // The face's own height reaches its content, so the prompt centres and the foot sits at the foot.
          fit: StackFit.passthrough,
          children: [
            // The paper's grain, under the words (the band covers it with its wash).
            const Positioned.fill(child: IgnorePointer(child: RepaintBoundary(child: Grain()))),
            content,
            // The foot fades while more of the face waits below (a scrim in the paper's own colour, so the words stay
            // readable where they meet the foot).
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
                        colors: [paper.paper.withValues(alpha: 0), paper.paper],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The front: the band at the top, the source pinned to the foot under a hairline, the prompt between them a little above the
/// middle (a face that does not fit is top-aligned and scrolls inside the card). Blanks are gaps with the punctuation that
/// touches them on the gap's own run.
class _FrontBody extends StatelessWidget {
  const _FrontBody({required this.kindLabel, required this.front, required this.width, this.family, this.extraKind, this.tagRight = false, this.source, this.sci = false});

  final String kindLabel;
  final KcFamily? family;
  final String? extraKind;
  final bool tagRight;
  final String front;
  final String? source;
  final double width;
  final bool sci;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final p = CardFace.promptStyle(StageText.frontSize(front), width);
    final style = type.title.copyWith(fontSize: p.size, height: p.height, letterSpacing: p.size * p.tracking, wordSpacing: 0, color: colors.ink);
    final span = TextSpan(style: style, children: stageFrontSpans(front, style, colors, sci: sci));
    const side = StagePaper.side;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        StageKindBand(kind: kindLabel, family: family, extra: extraKind, extraSize: tagRight ? 12.5 : 13),
        // 20 dp more room under the prompt than over it: it sits a little above the middle, where the eye expects it.
        Padding(
          padding: const EdgeInsets.fromLTRB(side, StagePaper.gap, side, StagePaper.gap + 20),
          child: Semantics(header: true, child: StageBalancedText(span, semanticsLabel: sci ? StageText.speakable(front) : null)),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(side, 0, side, 18),
          child: source != null
              ? DecoratedBox(
                  decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.paper.line))),
                  child: Padding(
                    padding: const EdgeInsets.only(top: MmSpace.s12),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 18),
                      child: Row(
                        children: [
                          Icon(LucideIcons.bookOpen, size: 14, color: colors.ink3),
                          const SizedBox(width: MmSpace.s6),
                          Flexible(
                            child: Text(
                              source!,
                              style: type.caption.copyWith(fontSize: 12.5, height: 1.4, color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()]),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              : const SizedBox(height: 18),
        ),
      ],
    );
  }
}

/// A front's spans: its words (with the notation drawn when [sci]), and each blank as one unbreakable run: an opening bracket
/// or quote that touches it, the gap (non-breaking spaces, underlined, read as "blank"), then the comma, stop or closing bracket
/// that touches it. A line never starts with ", and" or ends with "(" (the web's `blankRuns`, Key cards' blank rule).
List<InlineSpan> stageFrontSpans(String front, TextStyle style, MmColors colors, {bool sci = false}) {
  return [
    for (final part in blankRuns(front))
      if (!part.blank)
        ...(sci ? StageSci.spans(part.text, style) : [TextSpan(text: part.text)])
      else ...[
        if (part.lead.isNotEmpty) TextSpan(text: part.lead),
        TextSpan(
          text: ' ' * 10,
          semanticsLabel: 'blank',
          style: TextStyle(decoration: TextDecoration.underline, decorationColor: colors.ink3, decorationThickness: 1.5),
        ),
        if (part.tail.isNotEmpty) TextSpan(text: part.tail),
      ],
  ];
}

/// The back: the band, then from the top on the ruled lines the prompt small (two lines), NCERT's line and its source, and
/// "Turn back" at the foot. Each line of words is the ruling's pitch tall, with no space between them, so each sits on a line.
/// A journal entry keeps plain paper and its own rhythm.
class _BackBody extends StatelessWidget {
  const _BackBody({required this.kindLabel, required this.front, required this.card, this.family, this.extraKind, this.tagRight = false, this.onTurn, this.sci = false});

  final String kindLabel;
  final KcFamily? family;
  final String? extraKind;
  final bool tagRight;
  final String front;
  final KeyCard card;
  final VoidCallback? onTurn;
  final bool sci;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final scaler = MediaQuery.textScalerOf(context);
    final step = StageText.backSize(card.back);
    final size = stageBackSize(step);
    final ruled = sci || backShape(card) is! KcEntryBack;
    final pitch = ruled ? StagePaper.pitchOf(step, size.size, scaler) : null;
    var asked = type.label.copyWith(fontSize: 13, height: 1.4, color: colors.ink3);
    if (pitch != null) asked = StagePaper.onPitch(asked, pitch, scaler);
    final askedLine = StageText.speakable(front).isEmpty
        ? null
        : sci
        ? Text.rich(
            TextSpan(style: asked, children: stageFrontSpans(front, asked, colors, sci: true)),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            semanticsLabel: StageText.speakable(front),
          )
        : StageMarkedText(line: BlankedLine.front(front), style: asked, maxLines: 2);
    const side = StagePaper.side;
    return StageRuledBack(
      pitch: pitch,
      rule: colors.paper.ruling,
      band: StageKindBand(kind: kindLabel, family: family, extra: extraKind, extraSize: tagRight ? 12.5 : 13),
      block: Padding(
        padding: const EdgeInsets.symmetric(horizontal: side),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (askedLine != null) ...[askedLine, if (pitch == null) const SizedBox(height: 14)],
            StageNcert(card: card, size: size.size, height: size.height, sci: sci, pitch: pitch),
          ],
        ),
      ),
      // "Turn back" sits 6 dp up into the gap above it, as the web's `margin-top: -6px`.
      foot: Padding(
        padding: const EdgeInsets.fromLTRB(side, 0, side, 18),
        child: Transform.translate(
          offset: const Offset(0, -6),
          child: Align(
            alignment: Alignment.centerRight,
            child: StageTextKey(label: 'Turn back', size: 13.5, quiet: true, onTap: onTurn),
          ),
        ),
      ),
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
            if (!s.bad) ...[Icon(LucideIcons.check, size: 15, color: colors.goodText), const SizedBox(width: MmSpace.s6)],
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

// Two faces in one cell: both are laid out between [minHeight] and [maxHeight], and both take the taller one's
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
