import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show OverflowBoxFit;
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
    this.titleLines,
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

  /// Title lines a lead always reserves, so a title that changes with the subject ("10 Economics
  /// questions" to "10 Business Studies questions") never moves what is below.
  final int? titleLines;
}

/// How a row of the deck is laid out. Hierarchy comes from shape and size, not colour: the lead is
/// a hero with its own light, pairs are borderless tonal tiles, a wide row is a ruled list row, a
/// quiet row is a plain list row.
sealed class ChoiceRow {
  const ChoiceRow();

  /// The recommended choice: a hero, full width, lit, a large object and a go disc. One per screen at most.
  const factory ChoiceRow.lead(ChoiceOption option) = LeadRow;

  /// Two borderless tonal tiles side by side, equal height. With [weighted] the first leads (a wider,
  /// lit tile) and the second steps back to a hairline: one primary and one secondary, never two
  /// of the same weight.
  ///
  /// With [matched] the two are twins: one surface (the tonal fill, the subject's [light] pooled in
  /// it, the film grain), one object size, no lit object and no volt wash, so a pair of equals
  /// never looks like a finished tile beside an unfinished one (the Practice tab).
  const factory ChoiceRow.pair(ChoiceOption first, ChoiceOption second, {bool weighted, bool matched, SubjectLight? light}) = PairRow;

  /// A list row: no card, the object at the left, a rule under it.
  const factory ChoiceRow.wide(ChoiceOption option) = WideRow;

  /// A tertiary choice: hairline only, no fill.
  const factory ChoiceRow.quiet(ChoiceOption option) = QuietRow;

  /// A titled band of rows on a full-bleed sunken ground ("Exam conditions"), so a group reads as
  /// a group without a card around cards.
  /// [foot] is a quiet caption under the rows, inside the band (it cross-fades when it changes).
  const factory ChoiceRow.band({required String title, required List<ChoiceRow> rows, String? note, String? foot}) = BandRow;

  List<ChoiceOption> get options;
}

class LeadRow extends ChoiceRow {
  const LeadRow(this.option);
  final ChoiceOption option;
  @override
  List<ChoiceOption> get options => [option];
}

class PairRow extends ChoiceRow {
  const PairRow(this.first, this.second, {this.weighted = false, this.matched = false, this.light});
  final ChoiceOption first;
  final ChoiceOption second;

  /// Two twins on one surface (see [ChoiceRow.pair]).
  final bool matched;

  /// The light the matched tiles pool in (the picked subject's), or the room's lamp when null.
  final SubjectLight? light;

  /// The first tile leads and the second steps back (see [ChoiceRow.pair]).
  final bool weighted;
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
  const BandRow({required this.title, required this.rows, this.note, this.foot});
  final String title;
  final String? note;
  final String? foot;
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

/// The chooser: rows of distinct shapes that rise in one after another (40 ms apart, 300 ms
/// glide) and whose drawn objects play their gesture on press. The lead's object plays once as it
/// lands. Still under reduced motion.
class ChoiceDeck extends StatelessWidget {
  const ChoiceDeck({
    super.key,
    required this.rows,
    this.gap = MmSpace.s8,
    this.animateIn = true,
    this.bleed = 0,
    this.onSheet = false,
    this.leadKey,
    this.startDelay = Duration.zero,
    this.goMarks = false,
  });

  final List<ChoiceRow> rows;

  /// Every session row and tile says it starts: an outlined go disc at its edge (Start sheet,
  /// owner 17 Oct F5). The Practice tab keeps its own look.
  final bool goMarks;

  /// Waits this long before the first row rises: a page that stages its own entrance (the
  /// Practice tab) lets the blocks above arrive first.
  final Duration startDelay;

  /// Set on the lead's box, so a caller can aim at it (Mobi points at the recommended choice).
  final GlobalKey? leadKey;
  final double gap;
  final bool animateIn;

  /// How far a band runs past the deck's own width on each side: the page's gutter, so the band's
  /// ground reaches the screen edges while its tiles stay on the gutter.
  final double bleed;

  /// The deck sits on a sheet (raised ground): its tiles step down to the sunken tone, so they
  /// still read on Daylight where a raised tile would vanish into the sheet.
  final bool onSheet;

  static const Duration stagger = Duration(milliseconds: 40);

  /// Taps on the same choice closer than this are one tap (a double tap while a sheet opens or
  /// leaves).
  static const Duration tapGuard = Duration(milliseconds: 600);

  @override
  Widget build(BuildContext context) {
    final children = <Widget>[];
    var slot = 0;
    for (var i = 0; i < rows.length; i++) {
      if (i > 0) children.add(SizedBox(height: rows[i] is BandRow || rows[i - 1] is BandRow ? MmSpace.s24 : gap));
      // Keyed by what the row holds, so a row that arrives later (Smart practice once its quote
      // answers) never makes the rows after it rebuild and rise again.
      children.add(KeyedSubtree(key: ValueKey('row-${_rowId(rows[i])}'), child: _row(rows[i], slot)));
      slot += rows[i] is BandRow ? (rows[i] as BandRow).rows.length + 1 : 1;
    }
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
  }

  static String _rowId(ChoiceRow row) => switch (row) {
    LeadRow(:final option) || WideRow(:final option) || QuietRow(:final option) => option.id ?? option.title,
    PairRow(:final first) => first.id ?? first.title,
    BandRow(:final title) => 'band:$title',
  };

  Widget _rise(int slot, Widget child) => animateIn ? _Rise(delay: startDelay + stagger * slot, child: child) : child;

  Widget _row(ChoiceRow row, int slot) {
    switch (row) {
      case LeadRow(:final option):
        final lead = LeadChoice(option: option, key: ValueKey('choice-${option.id ?? option.title}'));
        return _rise(slot, leadKey == null ? lead : KeyedSubtree(key: leadKey, child: lead));
      case PairRow(:final first, :final second, :final weighted, :final matched, :final light):
        final firstWeight = matched ? TileWeight.matched : (weighted ? TileWeight.primary : TileWeight.even);
        final secondWeight = matched ? TileWeight.matched : (weighted ? TileWeight.secondary : TileWeight.even);
        return _rise(
          slot,
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  flex: weighted && !matched ? 11 : 10,
                  child: TileChoice(
                    option: first,
                    onSheet: onSheet,
                    goMark: goMarks,
                    weight: firstWeight,
                    light: light,
                    key: ValueKey('choice-${first.id ?? first.title}'),
                  ),
                ),
                SizedBox(width: gap),
                Expanded(
                  flex: weighted && !matched ? 9 : 10,
                  child: TileChoice(
                    option: second,
                    onSheet: onSheet,
                    goMark: goMarks,
                    weight: secondWeight,
                    light: light,
                    key: ValueKey('choice-${second.id ?? second.title}'),
                  ),
                ),
              ],
            ),
          ),
        );
      case WideRow(:final option):
        return _rise(slot, WideChoice(option: option, goMark: goMarks, key: ValueKey('choice-${option.id ?? option.title}')));
      case QuietRow(:final option):
        return _rise(slot, QuietChoice(option: option, key: ValueKey('choice-${option.id ?? option.title}')));
      case BandRow(:final title, :final note, :final foot, :final rows):
        return _Band(
          title: title,
          note: note,
          foot: foot,
          bleed: bleed,
          child: ChoiceDeck(rows: rows, gap: gap, animateIn: animateIn, onSheet: onSheet, startDelay: startDelay, goMarks: goMarks),
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

/// Shared press behaviour for every choice: the spring sink from [MmPressable], the object's
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

  /// When this choice last committed. A second tap inside [ChoiceDeck.tapGuard] is the same
  /// intent (ROBUSTNESS today-01): it must not open a second sheet or page, or pop again.
  DateTime? _committedAt;

  /// True when this tap should start the choice: its route is still the top one (a sheet that is
  /// already leaving, or a page with a sheet opening over it, ignores taps) and it has not just
  /// committed.
  bool _accepts() {
    final route = ModalRoute.of(context);
    if (route != null && !route.isCurrent) return false;
    final now = DateTime.now();
    final last = _committedAt;
    if (last != null && now.difference(last) < ChoiceDeck.tapGuard) return false;
    _committedAt = now;
    return true;
  }

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
      // The page a choice opens can grow out of the tile (MmTransition.container).
      captureLaunch: true,
      onTap: () {
        if (!_accepts()) return;
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

/// A tonal step above the ground the deck sits on: no hairline, the glass edge light along the top
/// does the edging.
Color _tonalFill(MmColors colors, {required bool pressed, required bool onSheet}) {
  final base = colors.isNight || onSheet ? colors.raised2 : colors.raised;
  return pressed ? Color.alphaBlend(colors.ink.withValues(alpha: 0.07), base) : base;
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
        padding: EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: quiet ? MmSpace.s4 : MmSpace.s2),
        child: Text(
          text,
          style: context.mmType.caption.copyWith(fontSize: quiet ? 12 : 11, color: colors.ink2),
        ),
      ),
    );
  }
}

Widget _facts(List<String> facts) =>
    Wrap(spacing: MmSpace.s8, runSpacing: MmSpace.s8, children: [for (final f in facts) _Tag(f, quiet: true)]);

/// The note text, reserving [lines] lines when asked so a later, longer note never moves the
/// rows below.
///
/// A note that changes (a new subject's facts, a gate that lifts) cross-fades in place over 200 ms
/// and the card's height eases: same modes, new facts, nothing rises again (brief 2.8).
Widget _note(BuildContext context, String note, TextStyle style, int? lines) {
  final text = Text(note, style: style, key: ValueKey(note));
  final duration = Motion.of(context, Motion.ui);
  final swapped = MmSizeEase(
    duration: duration,
    curve: Motion.out,
    alignment: Alignment.topLeft,
    // The overlap switcher keeps the two notes' summed strength up, so the swap never dips.
    child: MmOverlapSwitcher(duration: duration, alignment: Alignment.topLeft, child: text),
  );
  if (lines == null || lines <= 1) return swapped;
  final line = MediaQuery.textScalerOf(context).scale(style.fontSize! * style.height!);
  return ConstrainedBox(
    constraints: BoxConstraints(minHeight: line * lines),
    child: swapped,
  );
}

/// The recommended choice, a hero: full width, the lit edge and its glow, its own pool of lamp
/// light behind a large lit object, a headline title and a volt go disc. The object plays once as
/// the deck lands.
class LeadChoice extends StatelessWidget {
  const LeadChoice({super.key, required this.option});

  final ChoiceOption option;

  /// The object's box, and the room kept for it above the title.
  static const double objectSize = 104;
  static const double objectRoom = 88;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final o = option;
    return _ChoicePress(
      option: o,
      entranceDelay: const Duration(milliseconds: 260),
      builder: (context, pressed, motion) => LitEdge(
        child: MmClip(
          borderRadius: MmRadius.panelAll,
          child: ColoredBox(
            color: Color.alphaBlend(colors.ink.withValues(alpha: pressed ? 0.08 : (colors.isNight ? 0.035 : 0.02)), colors.raised),
            child: Stack(
              children: [
                // The tile's own light: a lamp pool where the object sits, and a faint volt wash
                // low on the left that the title reads over (never behind the object's detail).
                Positioned(
                  right: -90,
                  top: -90,
                  width: 320,
                  height: 280,
                  child: LightField(
                    pools: [
                      LightPool(
                        color: colors.lamp.withValues(alpha: colors.isNight ? 0.30 : 0.24),
                        center: Alignment.center,
                        radius: 0.5,
                      ),
                    ],
                  ),
                ),
                Positioned(
                  right: MmSpace.s12,
                  top: MmSpace.s8,
                  child: Transform.rotate(
                    angle: 0.08,
                    child: ChoiceGlyph(kind: o.glyph, size: objectSize, lit: true, motion: motion),
                  ),
                ),
                ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 196),
                  child: Padding(
                    padding: const EdgeInsets.all(MmSpace.s16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          height: objectRoom,
                          child: Align(alignment: Alignment.topLeft, child: o.tag == null ? null : _Tag(o.tag!)),
                        ),
                        const SizedBox(height: MmSpace.s8),
                        if ((o.titleLines ?? 1) > 1) ...[
                          // A title that follows the subject runs the card's full width, and the go disc
                          // sits with the note: "10 Business Studies questions" needs the room, and a
                          // longer name then never takes a third line (F6).
                          _leadTitle(context, o, type.headline.copyWith(fontSize: 30, height: 32 / 30)),
                          const SizedBox(height: MmSpace.s4),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    _note(context, o.note, type.small.copyWith(fontSize: 15, color: colors.ink2), o.noteLines),
                                    if (o.facts.isNotEmpty) ...[const SizedBox(height: MmSpace.s8), _facts(o.facts)],
                                  ],
                                ),
                              ),
                              const SizedBox(width: MmSpace.s12),
                              _GoDisc(pressed: pressed),
                            ],
                          ),
                        ] else
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    _leadTitle(context, o, type.headline.copyWith(fontSize: 30, height: 32 / 30)),
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

/// The lead's title. A title that changes (the subject changed under it) cross-fades in place, and
/// [ChoiceOption.titleLines] keeps its room, so the card never changes height.
Widget _leadTitle(BuildContext context, ChoiceOption o, TextStyle style) {
  final lines = o.titleLines;
  if (lines == null || lines <= 1) return Text(o.title, style: style);
  final line = MediaQuery.textScalerOf(context).scale(style.fontSize! * style.height!);
  final duration = Motion.of(context, Motion.ui);
  return ConstrainedBox(
    constraints: BoxConstraints(minHeight: line * lines),
    child: MmSizeEase(
      duration: duration,
      curve: Motion.out,
      alignment: Alignment.topLeft,
      child: MmOverlapSwitcher(duration: duration, alignment: Alignment.topLeft, child: _FitTitle(o.title, key: ValueKey(o.title), style: style, maxLines: lines)),
    ),
  );
}

/// A title that steps down in size, never in lines, until it fits [maxLines] without breaking a
/// word ("10 Business Studies questions" is three lines at 30 and two at 25), so the card keeps one
/// height for every subject and a long name never wraps to a third line.
class _FitTitle extends StatelessWidget {
  const _FitTitle(this.text, {super.key, required this.style, required this.maxLines});

  final String text;
  final TextStyle style;
  final int maxLines;

  static const List<double> _steps = [1, 0.92, 0.84, 0.76];

  @override
  Widget build(BuildContext context) {
    final scaler = MediaQuery.textScalerOf(context);
    final direction = Directionality.of(context);
    return LayoutBuilder(
      builder: (context, box) {
        var fitted = style.copyWith(fontSize: style.fontSize! * _steps.last);
        if (box.maxWidth.isFinite) {
          for (final step in _steps) {
            final candidate = style.copyWith(fontSize: style.fontSize! * step);
            final painter = TextPainter(text: TextSpan(text: text, style: candidate), textDirection: direction, textScaler: scaler, maxLines: maxLines)..layout(maxWidth: box.maxWidth);
            final longest = text.split(' ').fold<double>(0, (w, word) {
              final one = TextPainter(text: TextSpan(text: word, style: candidate), textDirection: direction, textScaler: scaler)..layout();
              final width = one.width;
              one.dispose();
              return width > w ? width : w;
            });
            final fits = !painter.didExceedMaxLines && longest <= box.maxWidth;
            painter.dispose();
            if (fits) {
              fitted = candidate;
              break;
            }
          }
        }
        return Text(text, style: fitted);
      },
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
        ),
        child: SizedBox.square(
          dimension: size,
          child: Icon(LucideIcons.play, size: 22, color: colors.voltInk),
        ),
      ),
    );
  }
}

/// The go mark of a session row on the Start sheet: an outlined disc (never volt, so the hero's go
/// disc stays the one volt in the sheet) with a play glyph where the row starts a session and a
/// chevron where it opens Practice. It sinks a little further than its row when pressed.
class ChoiceGoMark extends StatelessWidget {
  const ChoiceGoMark({super.key, required this.pressed, this.opens = false, this.size = 36});

  final bool pressed;

  /// A chevron: the row opens Practice instead of starting a session.
  final bool opens;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: AnimatedScale(
        scale: pressed ? 0.92 : 1,
        duration: Motion.of(context, Motion.press),
        curve: Motion.out,
        child: DecoratedBox(
          decoration: ShapeDecoration(
            color: pressed ? colors.ink.withValues(alpha: 0.08) : null,
            shape: CircleBorder(side: BorderSide(color: pressed ? colors.ink3 : colors.lineStrong, width: 1.5)),
          ),
          child: SizedBox.square(
            dimension: size,
            child: Icon(opens ? LucideIcons.chevronRight : LucideIcons.play, size: opens ? 18 : 15, color: colors.ink),
          ),
        ),
      ),
    );
  }
}

/// How much a tile of a pair weighs: [even] is two equals (the quick-start sheet), [primary] leads
/// (a larger, lit object on a lit fill) and [secondary] steps back (the object smaller, no fill,
/// a hairline), so a pair on the Practice tab has one first choice, never two of the same weight.
///
/// [matched] is two twins: the same surface, light and object size on both (see [ChoiceRow.pair]).
enum TileWeight { even, primary, secondary, matched }

/// A tile of a pair: borderless, a tonal step above the ground, its object large at the top left
/// and the title and a short note at the bottom.
class TileChoice extends StatelessWidget {
  const TileChoice({super.key, required this.option, this.onSheet = false, this.weight = TileWeight.even, this.goMark = false, this.light});

  final ChoiceOption option;

  /// The light a [TileWeight.matched] tile pools in its surface (the picked subject's).
  final SubjectLight? light;
  final bool onSheet;
  final TileWeight weight;

  /// The Start sheet's tile: the object at the top left and an outlined go disc at the top right,
  /// then the title and note from a fixed line under the object, so a pair's two titles share one
  /// line however long either note runs (L09). The tag sits after the title.
  final bool goMark;

  static const double objectSize = 72;

  /// The object's box for [weight].
  static double objectFor(TileWeight weight) => switch (weight) {
    TileWeight.even => objectSize,
    TileWeight.primary => 64,
    TileWeight.secondary => 52,
    TileWeight.matched => 56,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final o = option;
    const radius = MmRadius.panelAll;
    final primary = weight == TileWeight.primary;
    final secondary = weight == TileWeight.secondary;
    final matched = weight == TileWeight.matched;
    final glyphSize = objectFor(weight);
    return _ChoicePress(
      option: o,
      builder: (context, pressed, motion) {
        // The secondary tile has no fill of its own: a hairline on the ground, and a faint ink
        // wash while it is pressed.
        final fill = secondary
            ? (pressed ? colors.ink.withValues(alpha: 0.06) : null)
            : _tonalFill(colors, pressed: pressed, onSheet: onSheet);
        return DecoratedBox(
          decoration: ShapeDecoration(
            color: fill,
            shape: RoundedSuperellipseBorder(borderRadius: radius, side: secondary ? BorderSide(color: colors.lineStrong) : BorderSide.none),
            shadows: secondary || colors.isNight || onSheet ? null : colors.cardShadow,
          ),
          child: CustomPaint(
            foregroundPainter: secondary
                ? null
                : EdgeLightPainter(
                    borderRadius: radius,
                    top: colors.edgeTop,
                    bottom: primary || matched ? colors.edgeBottom : colors.edgeBottom.withValues(alpha: 0),
                    boost: pressed ? MmElevation.pressedEdgeBoost : 1,
                    sheen: false,
                  ),
            child: MmClip(
              borderRadius: radius,
              child: Stack(
                children: [
                  // The leading tile's own light: a pool of lamp light where its object sits and a
                  // faint volt wash low on the left, as the lead of the quick-start sheet has.
                  if (matched) ...[
                    // Twins: the picked subject's light pooled behind the object (the Practice
                    // card above carries the same light), and the room's lamp from the upper
                    // left. No volt, no glow: the same two pools on both tiles.
                    Positioned.fill(
                      child: light != null
                          ? LightField.subject(context, light!, center: const Alignment(-0.7, -0.8), strength: colors.isNight ? 0.9 : 0.8)
                          : LightField.lamp(context),
                    ),
                    const Positioned.fill(child: IgnorePointer(child: Grain())),
                  ],
                  if (primary) ...[
                    Positioned(
                      left: -40,
                      top: -50,
                      width: 220,
                      height: 200,
                      child: LightField(
                        pools: [
                          LightPool(color: colors.lamp.withValues(alpha: colors.isNight ? 0.26 : 0.2), center: Alignment.center, radius: 0.5),
                        ],
                      ),
                    ),
                  ],
                  ConstrainedBox(
                    constraints: BoxConstraints(minHeight: matched ? 144 : (primary ? 156 : (secondary ? 148 : 156))),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, MmSpace.s16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Transform.translate(
                                offset: const Offset(-4, 0),
                                child: ChoiceGlyph(kind: o.glyph, size: glyphSize, lit: primary, motion: motion),
                              ),
                              if (goMark) ...[
                                // The go disc, and the "Pro" tag under it: the title row stays the same
                                // width in both tiles of a pair, so both titles keep one size (L09). The
                                // pair takes what the object leaves and scales down to fit rather than
                                // run past the tile's edge on a narrow phone at large text.
                                Expanded(
                                  child: Padding(
                                    padding: const EdgeInsets.only(top: MmSpace.s4),
                                    child: Align(
                                      alignment: Alignment.topRight,
                                      child: FittedBox(
                                        fit: BoxFit.scaleDown,
                                        alignment: Alignment.topRight,
                                        child: Column(
                                          mainAxisSize: MainAxisSize.min,
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            ChoiceGoMark(pressed: pressed),
                                            if (o.tag != null) ...[const SizedBox(height: MmSpace.s4), _Tag(o.tag!)],
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ] else if (o.tag != null) ...[
                                // The tag takes what the object leaves: on a 360 dp phone at large text a
                                // "Pro" tag beside the 72 dp object would run past the tile's edge, so it
                                // scales down to fit instead.
                                const SizedBox(width: MmSpace.s4),
                                Expanded(
                                  child: Padding(
                                    padding: const EdgeInsets.only(top: MmSpace.s4),
                                    child: Align(
                                      alignment: Alignment.topRight,
                                      child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.topRight, child: _Tag(o.tag!)),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          // A weighted pair (the Practice tab) keeps 8 under the object, the sheet's even pair 12.
                          SizedBox(height: weight == TileWeight.even ? MmSpace.s12 : MmSpace.s8),
                          if (!goMark) const Spacer(),
                          if (goMark)
                            // One line at every width and text size: it scales down before it wraps (L09).
                            // One row height, tagged or not, so the two titles of a pair share a baseline.
                            ConstrainedBox(
                              constraints: BoxConstraints(minHeight: MediaQuery.textScalerOf(context).scale(28)),
                              child: Row(
                              children: [
                                Flexible(
                                  child: FittedBox(
                                    fit: BoxFit.scaleDown,
                                    alignment: Alignment.centerLeft,
                                    child: Text(o.title, maxLines: 1, softWrap: false, style: type.cardTitle.copyWith(fontSize: 17)),
                                  ),
                                ),
                              ],
                            ),
                            )
                          else
                            Text(o.title, style: type.cardTitle.copyWith(fontSize: primary ? 19 : (secondary ? 16 : 17))),
                          const SizedBox(height: 2),
                          _note(context, o.note, type.caption.copyWith(color: colors.ink2), o.noteLines),
                          if (o.facts.isNotEmpty) ...[const SizedBox(height: MmSpace.s8), _facts(o.facts)],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

/// One row across, read as a list row: no card, the object at the left, the title and note beside
/// it, a chevron at the right and a rule under it.
class WideChoice extends StatelessWidget {
  const WideChoice({super.key, required this.option, this.goMark = false});

  final ChoiceOption option;

  /// The Start sheet's row: an outlined go disc where the chevron was.
  final bool goMark;

  static const double objectSize = 56;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final o = option;
    return _ChoicePress(
      option: o,
      radius: MmRadius.smallAll,
      pressedScale: 0.985,
      builder: (context, pressed, motion) => DecoratedBox(
        decoration: BoxDecoration(
          color: pressed ? colors.ink.withValues(alpha: 0.06) : null,
          border: Border(bottom: BorderSide(color: colors.line)),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 84),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4, vertical: MmSpace.s12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                ChoiceGlyph(kind: o.glyph, size: objectSize, motion: motion),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Flexible(child: Text(o.title, style: type.cardTitle.copyWith(fontSize: 17))),
                          if (o.tag != null) ...[const SizedBox(width: MmSpace.s8), _Tag(o.tag!)],
                        ],
                      ),
                      const SizedBox(height: 2),
                      _note(context, o.note, type.caption.copyWith(color: colors.ink2), o.noteLines),
                      if (o.facts.isNotEmpty) ...[const SizedBox(height: MmSpace.s8), _facts(o.facts)],
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s8),
                if (goMark) ChoiceGoMark(pressed: pressed) else Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A tertiary choice: the same plain list row as [WideChoice] (no card, no outline), the object
/// a little smaller, one line of note, a chevron. It closes the deck without a last rule, so it
/// never reads as a box inside the sheet.
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
      radius: MmRadius.smallAll,
      pressedScale: 0.985,
      builder: (context, pressed, motion) => DecoratedBox(
        decoration: BoxDecoration(color: pressed ? colors.ink.withValues(alpha: 0.06) : null),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 64),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4, vertical: MmSpace.s8),
            child: Row(
              children: [
                ChoiceGlyph(kind: o.glyph, size: 44, motion: motion),
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
                const SizedBox(width: MmSpace.s8),
                Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A titled group on a full-bleed sunken ground, ruled top and bottom: a change of ground, not a
/// card around cards. The tiles inside keep the page's gutter.
class _Band extends StatelessWidget {
  const _Band({required this.title, required this.child, required this.rise, required this.bleed, this.note, this.foot});

  final String title;
  final String? note;
  final String? foot;
  final Widget child;
  final Widget Function(Widget child) rise;
  final double bleed;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final band = DecoratedBox(
      decoration: BoxDecoration(
        color: colors.sunken,
        border: Border.symmetric(horizontal: BorderSide(color: colors.line)),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(bleed, MmSpace.s16, bleed, MmSpace.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            rise(
              Padding(
                padding: const EdgeInsets.only(bottom: MmSpace.s12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    // A group label (15 w600, second ink), the level under the 22 sp section titles.
                    Semantics(
                      header: true,
                      child: Text(title, style: type.labelLarge.copyWith(color: colors.ink2)),
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
            // The foot holds two lines from the first frame, so a count that lands later changes
            // the words in place and nothing under the band moves.
            if (foot != null) ...[
              const SizedBox(height: MmSpace.s12),
              rise(_note(context, foot!, type.caption.copyWith(color: colors.ink2), 2)),
            ],
          ],
        ),
      ),
    );
    if (bleed <= 0) return band;
    return LayoutBuilder(
      builder: (context, constraints) => OverflowBox(
        minWidth: constraints.maxWidth + 2 * bleed,
        maxWidth: constraints.maxWidth + 2 * bleed,
        fit: OverflowBoxFit.deferToChild,
        child: band,
      ),
    );
  }
}
