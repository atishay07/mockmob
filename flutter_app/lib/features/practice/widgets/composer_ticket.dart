import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart' show SpringSimulation;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/art.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/practice_catalog.dart';
import 'exam_sheet_start.dart';
import 'spring_pick.dart';
import 'subject_accent.dart';

/// Where the ticket's stub is in the Start sequence. [lifted]: the start request is out and the
/// stub's corner has come up a little (tension). [torn]: the server confirmed, the stub tears off
/// and goes. Back to [rest] when the start failed: the stub drops back with a spring.
enum TicketTear { rest, lifted, torn }

/// The head of the confirm step, a ticket: a card with a half-round notch cut into its top and
/// bottom edge where the stub tears off, a dashed perforation between the notches, the subject's
/// object at hero scale in its own light on the left, the mode and the subject beside it, and the
/// length as a big number on the stub. A new subject slides its object in; a new length rolls the
/// number. So the paper about to start is seen, not only read (owner feedback 1110: "starting
/// from Business Studies ... redirecting me to Accountancy").
class ComposerTicket extends StatelessWidget {
  const ComposerTicket({
    super.key,
    required this.subjectId,
    required this.eyebrow,
    required this.subject,
    required this.count,
    required this.semanticsLabel,
    this.heroTag,
    this.tear = TicketTear.rest,
    this.clock = false,
    this.examSheet = false,
  });

  /// The Start sequence (see [TicketTear]).
  final TicketTear tear;

  /// A timed paper (a Full mock): under the stub waits the stopwatch, and when the server says
  /// yes and the stub tears away it is there, running one full turn round to 12 as the paper
  /// starts (owner, APK v8: "the full mock can have some animation of its own, like the clock
  /// doing a 360"). It plays inside the hold the ticket already has, so the paper's clock is
  /// never held back by it.
  final bool clock;

  /// NTA mode: under the stub waits the exam window's sheet, and on the server's yes it slides
  /// up into place and the NTA mark settles on it ([ExamSheetStart]), the exam-serious start of
  /// the exam-day screen. Same hold as [clock]; the two never show together ([clock] wins).
  final bool examSheet;

  final String subjectId;
  final String eyebrow;
  final String subject;
  final int count;
  final String semanticsLabel;

  /// Set on the full-page tickets (the setup page and the start screen) so the paper flies from
  /// one page into the next instead of being drawn again (MOTION.md C5). Never on the sheet.
  final Object? heroTag;

  /// The tag both full-page tickets share.
  static const String pageHeroTag = 'practice-ticket';

  /// The subject object's box, and its smaller size from large text up (the name needs the room).
  static const double object = 96;
  static const double objectLarge = 72;

  /// The stub's width, measured from the right edge to the perforation.
  static const double stubWidth = 84;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    final glide = reduced ? Duration.zero : Motion.glideDuration;
    final light = SubjectLight.forSubject(subjectId) ?? SubjectLight.language;
    final size = MediaQuery.textScalerOf(context).scale(1) >= 1.2 ? objectLarge : object;
    final shape = TicketBorder(
      stub: stubWidth,
      side: BorderSide(color: colors.line),
    );

    Widget slideIn(Widget child, Animation<double> a, {Offset from = const Offset(0.18, 0)}) => FadeTransition(
      opacity: a,
      child: SlideTransition(
        position: Tween(begin: from, end: Offset.zero).chain(CurveTween(curve: Motion.glide)).animate(a),
        child: child,
      ),
    );

    final tag = heroTag;
    final card = Semantics(
      header: true,
      label: semanticsLabel,
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: ShapeDecoration(color: colors.raised, shape: shape, shadows: colors.cardShadow),
        child: CustomPaint(
          foregroundPainter: _PerforationPainter(color: colors.lineStrong, stub: stubWidth, notch: shape.notch),
          child: ClipPath(
            clipper: ShapeBorderClipper(shape: shape),
            child: Stack(
              children: [
                // The subject's own light washes the ticket from the object's side.
                Positioned.fill(child: LightField.subject(context, light, center: const Alignment(-0.85, 0), strength: 0.85)),
                Padding(
                  padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, 0, MmSpace.s12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            SizedBox.square(
                              dimension: size,
                              child: AnimatedSwitcher(
                                duration: glide,
                                switchInCurve: Curves.linear,
                                switchOutCurve: Motion.exit,
                                transitionBuilder: (child, a) => slideIn(child, a),
                                child: _SubjectObject(key: ValueKey('$subjectId-$size'), subjectId: subjectId, size: size),
                              ),
                            ),
                            const SizedBox(width: MmSpace.s8),
                            Expanded(
                              child: Padding(
                                // Clear of the perforation: a long subject wraps or steps down before it can touch it.
                                padding: const EdgeInsets.only(right: MmSpace.s16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      eyebrow,
                                      style: type.caption.copyWith(fontSize: 13, fontWeight: FontWeight.w500, color: colors.ink2),
                                    ),
                                    const SizedBox(height: 2),
                                    LayoutBuilder(
                                      builder: (context, constraints) {
                                        final name = _fitName(
                                          context,
                                          subject,
                                          type.screenTitle.copyWith(fontSize: 24, height: 1.08),
                                          constraints.maxWidth,
                                        );
                                        return AnimatedSwitcher(
                                          duration: glide,
                                          layoutBuilder: (current, previous) =>
                                              Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
                                          transitionBuilder: (child, a) => slideIn(child, a, from: const Offset(0, 0.35)),
                                          child: Text(
                                            subject,
                                            key: ValueKey(subject),
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: name,
                                          ),
                                        );
                                      },
                                    ),
                                    const SizedBox(height: MmSpace.s8),
                                    DecoratedBox(
                                      decoration: ShapeDecoration(color: context.subjectAccentOf(subjectId), shape: const StadiumBorder()),
                                      child: const SizedBox(width: 32, height: 3),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      SizedBox(
                        width: stubWidth,
                        child: Padding(
                          padding: const EdgeInsets.only(right: MmSpace.s4),
                          child: _CountFigure(count: count),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    final ticket = _TearStage(tear: tear, stub: stubWidth, clock: clock, examSheet: examSheet && !clock, child: card);
    if (tag == null) return ticket;
    return Hero(tag: tag, child: Material(type: MaterialType.transparency, child: ticket));
  }
}

/// Plays the Start sequence on the ticket without ever remounting it: the ticket always sits in
/// the same place in the tree, clipped to the left of the perforation only while the stub is
/// away. The stub is a second, clipped copy of the same ticket that lifts, tears off (slides
/// right and fades, 220 ms) or drops back on a spring. Transform and opacity only.
class _TearStage extends StatefulWidget {
  const _TearStage({required this.tear, required this.stub, required this.child, this.clock = false, this.examSheet = false});

  final TicketTear tear;
  final double stub;
  final Widget child;

  /// The stopwatch waits under the stub and laps once it tears (see [ComposerTicket.clock]).
  final bool clock;

  /// The exam sheet waits under the stub and plays its start once it tears (see
  /// [ComposerTicket.examSheet]).
  final bool examSheet;

  /// The stopwatch's height under the stub, at most; a shorter ticket (large text) takes less.
  static const double clockHeight = 80;

  /// The controller value at which the stub is lifted; 1 is torn off.
  static const double liftedAt = 0.35;

  /// Lift (0..1, may dip below 0 on the spring back) and tear (0..1) progress at [v] (pure).
  static (double lift, double torn) progressAt(double v) => ((v / liftedAt).clamp(-0.4, 1.0), ((v - liftedAt) / (1 - liftedAt)).clamp(0.0, 1.0));

  @override
  State<_TearStage> createState() => _TearStageState();
}

class _TearStageState extends State<_TearStage> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController.unbounded(vsync: this, value: 0);

  @override
  void didUpdateWidget(_TearStage old) {
    super.didUpdateWidget(old);
    if (old.tear == widget.tear) return;
    final reduced = Motion.reduced(context);
    switch (widget.tear) {
      case TicketTear.rest:
        if (reduced || _c.value == 0) {
          _c.value = 0;
        } else {
          // The stub drops back and settles on a spring: a little give, no bounce show.
          _c.animateWith(SpringSimulation(Springs.smooth, _c.value, 0, 0));
        }
      case TicketTear.lifted:
        if (reduced) return;
        _c.animateTo(_TearStage.liftedAt, duration: const Duration(milliseconds: 160), curve: Motion.out);
      case TicketTear.torn:
        if (reduced) {
          _c.value = 1;
        } else {
          _c.animateTo(1, duration: const Duration(milliseconds: 220), curve: Curves.easeIn);
        }
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final stub = widget.stub;
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        final active = _c.value.abs() > 0.003 || _c.isAnimating;
        final (lift, torn) = _TearStage.progressAt(_c.value);
        // Once the stub is away the ticket is cut at the perforation; at rest nothing clips.
        final cut = active && lift > 0.05;
        return Stack(
          children: [
            ClipRect(
              clipBehavior: cut ? Clip.hardEdge : Clip.none,
              clipper: cut ? _SplitClipper(stub: stub, keepStub: false) : null,
              child: child,
            ),
            if (cut)
              Positioned.fill(
                key: const ValueKey('ticket-stub'),
                child: IgnorePointer(
                  child: ExcludeSemantics(
                    child: LayoutBuilder(
                      builder: (context, box) => Opacity(
                        opacity: (1 - Curves.easeIn.transform(torn)).clamp(0.0, 1.0),
                        child: Transform(
                          alignment: Alignment((box.maxWidth - stub) / box.maxWidth * 2 - 1, 1),
                          transform: Matrix4.identity()
                            ..translateByDouble(torn * stub * 0.95, -4 * lift - 8 * torn, 0, 1)
                            ..rotateZ(0.035 * lift + 0.16 * torn),
                          child: ClipRect(clipper: _SplitClipper(stub: stub, keepStub: true), child: child),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            // Mounted from the start (never painted at rest) so its render is decoded before
            // the tear. Over the leaving stub, not under it: it fades in where the stub was as
            // the stub slides off, so the whole turn is seen inside the short hold.
            if (widget.clock || widget.examSheet)
              Positioned(
                // Keyed: the stub's copy comes and goes before it, and the moment must keep its
                // state (and its decoded render) across that.
                key: ValueKey(widget.clock ? 'ticket-clock' : 'ticket-sheet'),
                top: 0,
                bottom: 0,
                right: 0,
                width: stub,
                child: IgnorePointer(
                  // In over the first half of the tear, so most of the turn is seen.
                  child: Opacity(
                    opacity: cut ? Curves.easeOut.transform((torn * 2).clamp(0.0, 1.0)) : 0,
                    child: LayoutBuilder(
                      builder: (context, box) => Center(
                        child: Transform.scale(
                          scale: 0.9 + 0.1 * Curves.easeOut.transform((torn * 2).clamp(0.0, 1.0)),
                          child: widget.clock
                              ? HybridStopwatch(
                                  height: math.min(_TearStage.clockHeight, math.max(0.0, box.maxHeight - MmSpace.s16)),
                                  mode: widget.tear == TicketTear.torn ? StopwatchMode.lap : StopwatchMode.done,
                                )
                              : ExamSheetStart(
                                  height: math.min(
                                    _TearStage.clockHeight,
                                    math.max(0.0, math.min(box.maxHeight - MmSpace.s16, (box.maxWidth - MmSpace.s12) / 0.74)),
                                  ),
                                  play: widget.tear == TicketTear.torn,
                                ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// Keeps one side of the perforation, with room above, below and outward for the shadow.
class _SplitClipper extends CustomClipper<Rect> {
  const _SplitClipper({required this.stub, required this.keepStub});

  final double stub;
  final bool keepStub;

  @override
  Rect getClip(Size size) {
    final x = size.width - stub;
    return keepStub ? Rect.fromLTRB(x, -48, size.width + 48, size.height + 48) : Rect.fromLTRB(-48, -48, x, size.height + 48);
  }

  @override
  bool shouldReclip(_SplitClipper old) => old.stub != stub || old.keepStub != keepStub;
}

/// [style] for a subject name in [width], stepped down (never below 14) until its longest word
/// fits on a line, so a name may wrap between words but is never cut inside one.
TextStyle _fitName(BuildContext context, String name, TextStyle style, double width) {
  final scaler = MediaQuery.textScalerOf(context);
  final words = name.split(' ');
  var size = style.fontSize ?? 24;
  for (; size > 14; size -= 1) {
    var widest = 0.0;
    for (final word in words) {
      final tp = TextPainter(
        text: TextSpan(
          text: word,
          style: style.copyWith(fontSize: size),
        ),
        textDirection: TextDirection.ltr,
        textScaler: scaler,
      )..layout();
      if (tp.width > widest) widest = tp.width;
      tp.dispose();
    }
    if (widest <= width) break;
  }
  return style.copyWith(fontSize: size);
}

/// A rounded card with a half-round notch bitten out of its top and bottom edge, [stub] from the
/// right: the shape of a ticket. Built as one path from the card and two circles (the notches),
/// outlined by [side] along its whole edge, notches included.
class TicketBorder extends ShapeBorder {
  const TicketBorder({this.stub = 84, this.notch = 9, this.radius = 24, this.side = BorderSide.none});

  final double stub;
  final double notch;
  final double radius;
  final BorderSide side;

  Path _path(Rect rect) {
    final x = rect.right - stub;
    return Path.combine(
      PathOperation.difference,
      Path()..addRRect(RRect.fromRectAndRadius(rect, Radius.circular(radius))),
      Path()
        ..addOval(Rect.fromCircle(center: Offset(x, rect.top), radius: notch))
        ..addOval(Rect.fromCircle(center: Offset(x, rect.bottom), radius: notch)),
    );
  }

  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.zero;

  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) => _path(rect);

  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) => _path(rect);

  @override
  void paint(Canvas canvas, Rect rect, {TextDirection? textDirection}) {
    if (side.style == BorderStyle.none) return;
    canvas.drawPath(_path(rect.deflate(side.width / 2)), side.toPaint());
  }

  @override
  ShapeBorder scale(double t) => TicketBorder(stub: stub * t, notch: notch * t, radius: radius * t, side: side.scale(t));
}

/// The dashed tear line between the two notches.
class _PerforationPainter extends CustomPainter {
  const _PerforationPainter({required this.color, required this.stub, required this.notch});

  final Color color;
  final double stub;
  final double notch;

  @override
  void paint(Canvas canvas, Size size) {
    final x = size.width - stub;
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.2
      ..strokeCap = StrokeCap.round;
    for (var y = notch + 6; y < size.height - notch - 6; y += 8) {
      canvas.drawLine(Offset(x, y), Offset(x, math.min(y + 3.5, size.height - notch - 4)), paint);
    }
  }

  @override
  bool shouldRepaint(_PerforationPainter old) => old.color != color || old.stub != stub || old.notch != notch;
}

/// The subject's emblem, framed: the object of the ticket, idling gently on its own sheet.
class _SubjectObject extends StatelessWidget {
  const _SubjectObject({super.key, required this.subjectId, required this.size});

  final String subjectId;
  final double size;

  @override
  Widget build(BuildContext context) => SubjectEmblem(subject: subjectId, size: size, animate: true);
}

/// The length as a condensed figure with "questions" under it. A new length rolls in from
/// below while the old one leaves upward.
class _CountFigure extends StatelessWidget {
  const _CountFigure({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        ClipRect(
          child: AnimatedSwitcher(
            duration: reduced ? Duration.zero : Motion.glideDuration,
            layoutBuilder: (current, previous) => Stack(alignment: Alignment.center, children: [...previous, ?current]),
            transitionBuilder: (child, a) {
              final entering = child.key == ValueKey(count);
              final slide = Tween(begin: Offset(0, entering ? 0.6 : -0.6), end: Offset.zero).chain(CurveTween(curve: Motion.emphasized));
              return FadeTransition(
                opacity: a,
                child: SlideTransition(position: slide.animate(a), child: child),
              );
            },
            child: Text('$count', key: ValueKey(count), style: type.figureCompact.copyWith(fontSize: 56, height: 1)),
          ),
        ),
        Text(PracticeCopy.questionsUnit, style: type.caption.copyWith(color: colors.ink2)),
      ],
    );
  }
}

/// The subjects as tactile chips for the setup page (which can change subject): each the
/// subject's line glyph on its own light, the name, and on the chosen chip the volt bubble and
/// its identity underline. Scrolls sideways; the chosen chip glides into view.
class SubjectChips extends ConsumerStatefulWidget {
  const SubjectChips({super.key, required this.choices, required this.selectedId, required this.onSelected, this.onMore});

  final List<SubjectChoice> choices;
  final String selectedId;
  final ValueChanged<String> onSelected;

  /// Null hides the "More subjects" chip.
  final VoidCallback? onMore;

  static const double height = 52;

  @override
  ConsumerState<SubjectChips> createState() => _SubjectChipsState();
}

class _SubjectChipsState extends ConsumerState<SubjectChips> {
  final ScrollController _scroll = ScrollController();
  final GlobalKey _selectedKey = GlobalKey();

  /// Whether more chips wait past the left or right edge: the strip fades out there, so a chip
  /// cut by the edge reads as "scrolls", not as a clipped label.
  bool _fadeLeft = false;
  bool _fadeRight = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_edges);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _reveal(animate: false);
      _edges();
    });
  }

  void _edges() {
    if (!mounted || !_scroll.hasClients) return;
    final m = _scroll.position;
    final left = m.pixels > 2;
    final right = m.pixels < m.maxScrollExtent - 2;
    if (left != _fadeLeft || right != _fadeRight) {
      setState(() {
        _fadeLeft = left;
        _fadeRight = right;
      });
    }
  }

  @override
  void didUpdateWidget(SubjectChips old) {
    super.didUpdateWidget(old);
    if (old.selectedId != widget.selectedId) WidgetsBinding.instance.addPostFrameCallback((_) => _reveal(animate: true));
  }

  /// Brings the chosen chip into view inside the strip only (the page never scrolls for it).
  void _reveal({required bool animate}) {
    final box = _selectedKey.currentContext?.findRenderObject();
    if (!mounted || box == null || !_scroll.hasClients) return;
    final d = animate ? Motion.of(context, Motion.glideDuration) : Duration.zero;
    unawaited(_scroll.position.ensureVisible(box, alignment: 0.5, duration: d, curve: Motion.glide));
  }

  @override
  void dispose() {
    _scroll
      ..removeListener(_edges)
      ..dispose();
    super.dispose();
  }

  /// The strip, faded to nothing over its last [fade] dp on each side that has more chips. Always
  /// wrapped, so the list keeps its scroll position when a fade comes or goes.
  Widget _faded(Widget strip) {
    const fade = 36.0;
    return ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback: (rect) {
        final f = (fade / rect.width).clamp(0.0, 0.5);
        return LinearGradient(
          colors: [
            _fadeLeft ? const Color(0x00FFFFFF) : const Color(0xFFFFFFFF),
            const Color(0xFFFFFFFF),
            const Color(0xFFFFFFFF),
            _fadeRight ? const Color(0x00FFFFFF) : const Color(0xFFFFFFFF),
          ],
          stops: [0, f, 1 - f, 1],
        ).createShader(rect);
      },
      child: strip,
    );
  }

  @override
  Widget build(BuildContext context) {
    final choices = widget.choices;
    return Semantics(
      container: true,
      label: PracticeCopy.subjectLabel,
      child: SizedBox(
        height: SubjectChips.height,
        child: NotificationListener<ScrollMetricsNotification>(
          onNotification: (_) {
            WidgetsBinding.instance.addPostFrameCallback((_) => _edges());
            return false;
          },
          child: _faded(
            ListView.separated(
              controller: _scroll,
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              itemCount: choices.length + (widget.onMore == null ? 0 : 1),
              separatorBuilder: (_, _) => const SizedBox(width: MmSpace.s8),
              itemBuilder: (context, i) {
                if (i == choices.length) return _MoreChip(onTap: widget.onMore!);
                final c = choices[i];
                final selected = c.id == widget.selectedId;
                return _SubjectChip(
                  key: selected ? _selectedKey : ValueKey(c.id),
                  id: c.id,
                  name: c.name,
                  selected: selected,
                  onTap: () {
                    if (selected) return;
                    unawaited(ref.read(hapticsProvider).selection());
                    widget.onSelected(c.id);
                  },
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _SubjectChip extends StatelessWidget {
  const _SubjectChip({super.key, required this.id, required this.name, required this.selected, required this.onTap});

  final String id;
  final String name;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final accent = context.subjectAccentOf(id);
    const radius = MmRadius.smallAll;
    return MmPressable(
      semanticsLabel: name,
      selected: selected,
      inMutuallyExclusiveGroup: true,
      focusRadius: radius,
      onTap: onTap,
      // The pick lands on the switch's detent spring (240 ms, bounce 0.14): the fill and the rim
      // cross, the identity bar stretches a hair past its length and settles, and the glyph swells
      // at mid-change. Pressed answers at once (the press is the finger's, not the spring's).
      builder: (context, pressed, _) => SpringPick(
        on: selected,
        spring: Springs.toggle,
        builder: (context, t, _) {
          final c = t.clamp(0.0, 1.0);
          final settled = c == 0 || c == 1;
          final rest = MmSelection.side(colors, selected: false);
          final picked = MmSelection.side(colors, selected: true);
          return Container(
            height: SubjectChips.height,
            padding: const EdgeInsets.fromLTRB(MmSpace.s8, MmSpace.s8, MmSpace.s12, MmSpace.s8),
            decoration: ShapeDecoration(
              color: settled
                  ? MmSelection.fill(colors, selected: c == 1, pressed: pressed)
                  : Color.lerp(MmSelection.fill(colors, selected: false, pressed: pressed), MmSelection.fill(colors, selected: true), c),
              shape: RoundedSuperellipseBorder(
                borderRadius: radius,
                side: settled ? (c == 1 ? picked : rest) : BorderSide.lerp(rest, picked, c),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Transform.scale(
                  scale: 1 + 0.08 * SpringPick.popAt(t),
                  child: SubjectEmblem(subject: id, size: EmblemSizes.glyph, framed: false, marked: selected),
                ),
                const SizedBox(width: MmSpace.s8),
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(name, maxLines: 1, style: type.labelLarge.copyWith(fontSize: 14, color: Color.lerp(colors.ink2, colors.ink, c))),
                    const SizedBox(height: MmSpace.s4),
                    DecoratedBox(
                      decoration: ShapeDecoration(
                        color: accent.withValues(alpha: 0.5 + 0.5 * c),
                        shape: const StadiumBorder(),
                      ),
                      // 10 dp at rest, 24 chosen; the spring's crest runs it a hair long.
                      child: SizedBox(width: math.max(10 + 14 * t, 0), height: 3),
                    ),
                  ],
                ),
                if (selected) ...[const SizedBox(width: MmSpace.s8), const SelectBubble(selected: true)],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _MoreChip extends StatelessWidget {
  const _MoreChip({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    const radius = MmRadius.smallAll;
    return MmPressable(
      semanticsLabel: PracticeCopy.moreSubjects,
      focusRadius: radius,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => Container(
        height: SubjectChips.height,
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
        decoration: ShapeDecoration(
          color: pressed ? colors.raised2 : null,
          shape: RoundedSuperellipseBorder(
            borderRadius: radius,
            side: BorderSide(color: colors.line),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.plus, size: 18, color: colors.ink2),
            const SizedBox(width: MmSpace.s4),
            Text(PracticeCopy.moreSubjects, style: type.label.copyWith(color: colors.ink2)),
          ],
        ),
      ),
    );
  }
}
