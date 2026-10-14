import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'choice_glyphs.dart';

/// One way to start, said as what you get. No cost here: costs live on the confirm sheet.
class ChoiceOption {
  const ChoiceOption({
    required this.glyph,
    required this.title,
    required this.note,
    required this.onTap,
    this.tag,
    this.facts = const [],
    this.id,
    this.noteLines,
  });

  final ChoiceGlyphKind glyph;
  final String title;
  final String note;
  final VoidCallback onTap;

  /// A quiet outlined tag after the title ("Pro").
  final String? tag;

  /// What the choice has, as quiet chips ("50 questions", "Question palette").
  final List<String> facts;

  /// A stable key for tests and for keeping a tile's state when the list changes.
  final String? id;

  /// Note lines the tile always reserves, so a note that grows later (a count that arrives)
  /// never moves what is below.
  final int? noteLines;
}

/// How a row of the deck is laid out. Hierarchy comes from shape and size, not colour.
sealed class ChoiceRow {
  const ChoiceRow();

  /// The recommended choice: full width, lit, a go disc. One per screen at most.
  const factory ChoiceRow.lead(ChoiceOption option) = LeadRow;

  /// Two tiles side by side, equal height.
  const factory ChoiceRow.pair(ChoiceOption first, ChoiceOption second) = PairRow;

  /// One tile across, glyph at the left.
  const factory ChoiceRow.wide(ChoiceOption option) = WideRow;

  /// A tertiary choice: hairline only, no fill.
  const factory ChoiceRow.quiet(ChoiceOption option) = QuietRow;

  /// A titled band of rows on a sunken ground ("Exam conditions"), so a group reads as a group
  /// without a card around cards.
  const factory ChoiceRow.band({required String title, required List<ChoiceRow> rows, String? note}) = BandRow;

  List<ChoiceOption> get options;
}

class LeadRow extends ChoiceRow {
  const LeadRow(this.option);
  final ChoiceOption option;
  @override
  List<ChoiceOption> get options => [option];
}

class PairRow extends ChoiceRow {
  const PairRow(this.first, this.second);
  final ChoiceOption first;
  final ChoiceOption second;
  @override
  List<ChoiceOption> get options => [first, second];
}

class WideRow extends ChoiceRow {
  const WideRow(this.option);
  final ChoiceOption option;
  @override
  List<ChoiceOption> get options => [option];
}

class QuietRow extends ChoiceRow {
  const QuietRow(this.option);
  final ChoiceOption option;
  @override
  List<ChoiceOption> get options => [option];
}

class BandRow extends ChoiceRow {
  const BandRow({required this.title, required this.rows, this.note});
  final String title;
  final String? note;
  final List<ChoiceRow> rows;
  @override
  List<ChoiceOption> get options => [for (final r in rows) ...r.options];
}

/// Lays [options] out the way the quick-start sheet and similar choosers want them: the first
/// as the lead when [leadFirst], then pairs, and a last odd one as a wide tile. Options flagged
/// [quiet] (by title) go last as quiet rows.
List<ChoiceRow> arrangeChoices(List<ChoiceOption> options, {bool leadFirst = true, Set<String> quiet = const {}}) {
  final rows = <ChoiceRow>[];
  final loud = [
    for (final o in options)
      if (!quiet.contains(o.id ?? o.title)) o,
  ];
  final soft = [
    for (final o in options)
      if (quiet.contains(o.id ?? o.title)) o,
  ];
  var i = 0;
  if (leadFirst && loud.isNotEmpty) rows.add(ChoiceRow.lead(loud[i++]));
  while (i < loud.length) {
    if (i + 1 < loud.length) {
      rows.add(ChoiceRow.pair(loud[i], loud[i + 1]));
      i += 2;
    } else {
      rows.add(ChoiceRow.wide(loud[i++]));
    }
  }
  for (final o in soft) {
    rows.add(ChoiceRow.quiet(o));
  }
  return rows;
}

/// The chooser: rows of distinct tiles that rise in one after another (40 ms apart, 300 ms
/// glide) and whose drawn glyphs play their gesture on press. The lead's glyph plays once as it
/// lands. Still under reduced motion.
class ChoiceDeck extends StatelessWidget {
  const ChoiceDeck({super.key, required this.rows, this.gap = MmSpace.s8, this.animateIn = true, this.solid = false});

  final List<ChoiceRow> rows;
  final double gap;
  final bool animateIn;

  /// Tiles drawn opaque over the sheet's own colour (the quick-start sheet lets a faint wash of
  /// the page through, and a tinted tile would let the page's text show).
  final bool solid;

  static const Duration stagger = Duration(milliseconds: 40);

  @override
  Widget build(BuildContext context) {
    final children = <Widget>[];
    var slot = 0;
    for (var i = 0; i < rows.length; i++) {
      if (i > 0) children.add(SizedBox(height: rows[i] is BandRow || rows[i - 1] is BandRow ? MmSpace.s16 : gap));
      children.add(_row(rows[i], slot));
      slot += rows[i] is BandRow ? (rows[i] as BandRow).rows.length + 1 : 1;
    }
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
  }

  Widget _rise(int slot, Widget child) => animateIn ? _Rise(delay: stagger * slot, child: child) : child;

  Widget _row(ChoiceRow row, int slot) {
    switch (row) {
      case LeadRow(:final option):
        return _rise(slot, LeadChoice(option: option, solid: solid, key: ValueKey('choice-${option.id ?? option.title}')));
      case PairRow(:final first, :final second):
        return _rise(
          slot,
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: TileChoice(option: first, solid: solid, key: ValueKey('choice-${first.id ?? first.title}')),
                ),
                SizedBox(width: gap),
                Expanded(
                  child: TileChoice(option: second, solid: solid, key: ValueKey('choice-${second.id ?? second.title}')),
                ),
              ],
            ),
          ),
        );
      case WideRow(:final option):
        return _rise(slot, WideChoice(option: option, solid: solid, key: ValueKey('choice-${option.id ?? option.title}')));
      case QuietRow(:final option):
        return _rise(slot, QuietChoice(option: option, key: ValueKey('choice-${option.id ?? option.title}')));
      case BandRow(:final title, :final note, :final rows):
        return _Band(
          title: title,
          note: note,
          child: ChoiceDeck(rows: rows, gap: gap, animateIn: animateIn, solid: solid),
          rise: (child) => _rise(slot, child),
        );
    }
  }
}

/// Rises 12 dp and fades in after [delay], on the glide curve. Shown at once under reduced
/// motion.
class _Rise extends StatefulWidget {
  const _Rise({required this.delay, required this.child});

  final Duration delay;
  final Widget child;

  @override
  State<_Rise> createState() => _RiseState();
}

class _RiseState extends State<_Rise> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: Motion.glideDuration);
  late final Animation<double> _t = CurvedAnimation(parent: _c, curve: Motion.glide);
  Timer? _timer;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _c.value = 1;
    } else if (widget.delay == Duration.zero) {
      _c.forward();
    } else {
      _timer = Timer(widget.delay, () {
        if (mounted) _c.forward();
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _t,
    child: widget.child,
    builder: (context, child) => Opacity(
      opacity: _t.value,
      child: Transform.translate(offset: Offset(0, 12 * (1 - _t.value)), child: child),
    ),
  );
}

/// Shared press behaviour for every tile: the spring sink from [MmPressable], the glyph's
/// gesture the moment a finger lands, a light tick on commit. [entranceDelay] plays the gesture
/// once after mounting (the lead, as the deck lands).
class _ChoicePress extends ConsumerStatefulWidget {
  const _ChoicePress({
    required this.option,
    required this.builder,
    this.radius = MmRadius.panelAll,
    this.pressedScale = 0.97,
    this.entranceDelay,
  });

  final ChoiceOption option;
  final Widget Function(BuildContext context, bool pressed, Animation<double> motion) builder;
  final BorderRadius radius;
  final double pressedScale;
  final Duration? entranceDelay;

  @override
  ConsumerState<_ChoicePress> createState() => _ChoicePressState();
}

class _ChoicePressState extends ConsumerState<_ChoicePress> with SingleTickerProviderStateMixin {
  late final GlyphPlayer _player = GlyphPlayer(this);
  bool _wasPressed = false;
  bool _entered = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final delay = widget.entranceDelay;
    if (_entered || delay == null) return;
    _entered = true;
    _player.playAfter(context, delay);
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.option;
    final label = [o.title, ?o.tag, o.note, ...o.facts].join('. ');
    return MmPressable(
      semanticsLabel: label,
      focusRadius: widget.radius,
      pressedScale: widget.pressedScale,
      onTap: () {
        unawaited(ref.read(hapticsProvider).light());
        o.onTap();
      },
      builder: (context, pressed, _) {
        // The glyph plays the moment a finger lands, not on release.
        if (pressed && !_wasPressed) {
          final ctx = context;
          WidgetsBinding.instance.addPostFrameCallback((_) => _player.play(ctx));
        }
        _wasPressed = pressed;
        return widget.builder(context, pressed, _player.progress);
      },
    );
  }
}

Color _tileFill(MmColors colors, {required bool pressed, required bool solid}) {
  final tint = pressed ? 0.08 : (colors.isNight ? 0.035 : 0.02);
  return Color.alphaBlend(colors.ink.withValues(alpha: tint), colors.raised);
}

/// The surface every filled tile shares: an opaque raised fill, a hairline and the glass edge
/// light along the top.
class _TileSurface extends StatelessWidget {
  const _TileSurface({required this.pressed, required this.solid, required this.child, this.ghost, this.ghostOffset = Offset.zero});

  final bool pressed;
  final bool solid;
  final Widget child;

  /// The tile's large faint glyph, bleeding off the bottom right corner by [ghostOffset].
  final Widget? ghost;
  final Offset ghostOffset;

  static const BorderRadius radius = MmRadius.panelAll;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final g = ghost;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: _tileFill(colors, pressed: pressed, solid: solid),
        shape: RoundedSuperellipseBorder(
          borderRadius: radius,
          side: BorderSide(color: colors.line),
        ),
      ),
      child: CustomPaint(
        foregroundPainter: EdgeLightPainter(
          borderRadius: radius,
          top: colors.edgeTop,
          bottom: colors.edgeBottom.withValues(alpha: 0),
          boost: pressed ? MmElevation.pressedEdgeBoost : 1,
          sheen: false,
        ),
        child: g == null
            ? child
            : MmClip(
                borderRadius: radius,
                child: Stack(
                  children: [
                    Positioned(right: ghostOffset.dx, bottom: ghostOffset.dy, child: g),
                    child,
                  ],
                ),
              ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag(this.text, {this.quiet = false});

  final String text;

  /// A fact chip (sunken, no outline) rather than the outlined "Pro" tag.
  final bool quiet;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: quiet ? colors.sunken : null,
        shape: StadiumBorder(
          side: quiet ? BorderSide(color: colors.line) : BorderSide(color: colors.lineStrong),
        ),
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: quiet ? 3 : 1),
        child: Text(
          text,
          style: context.mmType.caption.copyWith(fontSize: quiet ? 12 : 11, color: colors.ink2),
        ),
      ),
    );
  }
}

Widget _facts(List<String> facts) =>
    Wrap(spacing: MmSpace.s6, runSpacing: MmSpace.s6, children: [for (final f in facts) _Tag(f, quiet: true)]);

/// The note text, reserving [lines] lines when asked so a later, longer note never moves the
/// rows below.
Widget _note(BuildContext context, String note, TextStyle style, int? lines) {
  final text = Text(note, style: style);
  if (lines == null || lines <= 1) return text;
  final line = MediaQuery.textScalerOf(context).scale(style.fontSize! * style.height!);
  return ConstrainedBox(
    constraints: BoxConstraints(minHeight: line * lines),
    child: text,
  );
}

/// The recommended choice: full width, the lit edge and its glow, a lamp pool behind the glyph,
/// a headline title and a volt go disc. Its glyph plays once as the deck lands.
class LeadChoice extends StatelessWidget {
  const LeadChoice({super.key, required this.option, this.solid = false});

  final ChoiceOption option;
  final bool solid;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final o = option;
    return _ChoicePress(
      option: o,
      entranceDelay: const Duration(milliseconds: 260),
      builder: (context, pressed, motion) => LitEdge(
        glow: true,
        child: MmClip(
          borderRadius: MmRadius.panelAll,
          child: ColoredBox(
            color: _tileFill(colors, pressed: pressed, solid: solid),
            child: Stack(
              children: [
                // The lamp pooled behind the glyph only, never behind the title.
                // The lead's own graphic: its glyph large and faint off the top right corner.
                Positioned(
                  right: -28,
                  top: -34,
                  child: ChoiceGhost(kind: o.glyph, motion: motion, size: 156, angle: 0.18),
                ),
                Positioned(
                  left: -60,
                  top: -60,
                  width: 200,
                  height: 180,
                  child: LightField(
                    pools: [
                      LightPool(
                        color: colors.lamp.withValues(alpha: colors.isNight ? 0.26 : 0.2),
                        center: Alignment.center,
                        radius: 0.5,
                      ),
                    ],
                  ),
                ),
                ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 136),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s16, MmSpace.s16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ChoiceGlyph(kind: o.glyph, size: 56, lit: true, motion: motion),
                            const Spacer(),
                            if (o.tag != null) _Tag(o.tag!),
                          ],
                        ),
                        const SizedBox(height: MmSpace.s12),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(o.title, style: type.headline.copyWith(fontSize: 26, height: 29 / 26)),
                                  const SizedBox(height: MmSpace.s4),
                                  _note(context, o.note, type.small.copyWith(fontSize: 15, color: colors.ink2), o.noteLines),
                                  if (o.facts.isNotEmpty) ...[const SizedBox(height: MmSpace.s8), _facts(o.facts)],
                                ],
                              ),
                            ),
                            const SizedBox(width: MmSpace.s12),
                            _GoDisc(pressed: pressed),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The volt disc that says "this one starts": a play glyph on volt. It sinks a little further
/// than the tile when pressed.
class _GoDisc extends StatelessWidget {
  const _GoDisc({required this.pressed});

  final bool pressed;

  static const double size = 52;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return AnimatedScale(
      scale: pressed ? 0.92 : 1,
      duration: Motion.of(context, Motion.press),
      curve: Motion.out,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.volt,
          shape: CircleBorder(side: BorderSide(color: pressed ? colors.voltEdge : colors.volt, width: 1.5)),
          shadows: [BoxShadow(color: colors.voltGlow, blurRadius: 18, offset: const Offset(0, 6), spreadRadius: -6)],
        ),
        child: SizedBox.square(
          dimension: size,
          child: Icon(LucideIcons.play, size: 22, color: colors.voltInk),
        ),
      ),
    );
  }
}

/// A tile of a pair: glyph top left, the title and a short note at the bottom.
class TileChoice extends StatelessWidget {
  const TileChoice({super.key, required this.option, this.solid = false});

  final ChoiceOption option;
  final bool solid;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final o = option;
    return _ChoicePress(
      option: o,
      builder: (context, pressed, motion) => _TileSurface(
        pressed: pressed,
        solid: solid,
        ghost: ChoiceGhost(kind: o.glyph, motion: motion, size: 118),
        ghostOffset: const Offset(-26, -30),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 128),
          child: Padding(
            padding: const EdgeInsets.all(MmSpace.s12 + 2),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ChoiceGlyph(kind: o.glyph, motion: motion),
                    const Spacer(),
                    if (o.tag != null) _Tag(o.tag!),
                  ],
                ),
                const SizedBox(height: MmSpace.s16),
                const Spacer(),
                Text(o.title, style: type.cardTitle.copyWith(fontSize: 16)),
                const SizedBox(height: 2),
                _note(context, o.note, type.caption.copyWith(color: colors.ink2), o.noteLines),
                if (o.facts.isNotEmpty) ...[const SizedBox(height: MmSpace.s8), _facts(o.facts)],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// One tile across: the glyph at the left, the title and note beside it, facts below.
class WideChoice extends StatelessWidget {
  const WideChoice({super.key, required this.option, this.solid = false});

  final ChoiceOption option;
  final bool solid;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final o = option;
    return _ChoicePress(
      option: o,
      pressedScale: 0.98,
      builder: (context, pressed, motion) => _TileSurface(
        pressed: pressed,
        solid: solid,
        ghost: ChoiceGhost(kind: o.glyph, motion: motion, size: 104, angle: 0.12),
        ghostOffset: const Offset(-16, -34),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 84),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s12 + 2, MmSpace.s12 + 2, MmSpace.s16, MmSpace.s12 + 2),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ChoiceGlyph(kind: o.glyph, size: 48, motion: motion),
                const SizedBox(width: MmSpace.s12 + 2),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Flexible(child: Text(o.title, style: type.cardTitle.copyWith(fontSize: 16))),
                          if (o.tag != null) ...[const SizedBox(width: MmSpace.s8), _Tag(o.tag!)],
                        ],
                      ),
                      const SizedBox(height: 2),
                      _note(context, o.note, type.caption.copyWith(color: colors.ink2), o.noteLines),
                      if (o.facts.isNotEmpty) ...[const SizedBox(height: MmSpace.s8), _facts(o.facts)],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A tertiary choice: hairline only, the glyph small, one line.
class QuietChoice extends StatelessWidget {
  const QuietChoice({super.key, required this.option});

  final ChoiceOption option;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final o = option;
    return _ChoicePress(
      option: o,
      radius: MmRadius.keyAll,
      pressedScale: 0.98,
      builder: (context, pressed, motion) => DecoratedBox(
        decoration: ShapeDecoration(
          color: pressed ? colors.ink.withValues(alpha: 0.05) : null,
          shape: RoundedSuperellipseBorder(
            borderRadius: MmRadius.keyAll,
            side: BorderSide(color: colors.line),
          ),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 60),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s8),
            child: Row(
              children: [
                ChoiceGlyph(kind: o.glyph, size: 36, motion: motion),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(o.title, style: type.labelLarge),
                      Text(o.note, style: type.caption.copyWith(color: colors.ink2)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A titled group on a sunken ground: a background change, not a card around cards.
class _Band extends StatelessWidget {
  const _Band({required this.title, required this.child, required this.rise, this.note});

  final String title;
  final String? note;
  final Widget child;
  final Widget Function(Widget child) rise;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.sunken,
        shape: RoundedSuperellipseBorder(
          borderRadius: const BorderRadius.all(Radius.circular(28)),
          side: BorderSide(color: colors.line),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s8, MmSpace.s12, MmSpace.s8, MmSpace.s8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            rise(
              Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.s8, 0, MmSpace.s8, MmSpace.s12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Semantics(
                      header: true,
                      child: Text(title, style: type.label.copyWith(color: colors.ink)),
                    ),
                    if (note != null) ...[
                      const SizedBox(width: MmSpace.s8),
                      Expanded(
                        child: Text(note!, style: type.caption.copyWith(color: colors.ink3)),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            child,
          ],
        ),
      ),
    );
  }
}
