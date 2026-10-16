import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/repair.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/retry.dart';
import '../data/review_providers.dart';
import 'review_bits.dart' show FlushKey;

/// A labelled block of the worked explanation. The body never moves once shown.
class ExplanationBlock extends StatelessWidget {
  const ExplanationBlock({super.key, required this.label, required this.paragraphs, this.labelFocus, this.lead = false});

  final String label;
  final List<String> paragraphs;

  /// The one idea of the repair, set a step larger as a pull quote (17 sp, medium) so the eye
  /// lands on it before the supporting blocks.
  final bool lead;

  /// Makes the heading something focus can be sent to (the revealed "Another way to see it").
  final FocusNode? labelFocus;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shown = [
      for (final p in paragraphs)
        if (p.trim().isNotEmpty) p.trim(),
    ];
    if (shown.isEmpty) return const SizedBox.shrink();
    Widget heading = Semantics(
      header: true,
      // 14 sp: a label a student has to read is never below 13.
      child: Text(label, style: type.small.copyWith(fontWeight: FontWeight.w600, color: colors.ink2)),
    );
    // Focus can be sent here, but Tab never stops on a heading by itself.
    if (labelFocus != null) heading = Focus(focusNode: labelFocus, skipTraversal: true, child: heading);
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          heading,
          const SizedBox(height: MmSpace.s8),
          for (var i = 0; i < shown.length; i++) ...[
            if (i > 0) const SizedBox(height: MmSpace.s8),
            Text(shown[i], style: lead ? type.question : type.body),
          ],
        ],
      ),
    );
  }
}

/// The heart of a repair, in one raised surface: where the answer breaks first, then why it looked
/// right. Both stay on the page (nothing is hidden); the break leads because it is what the student
/// has to take away. It is the page's own raised step, never a second card inside a card.
class BreakCard extends StatelessWidget {
  const BreakCard({super.key, this.breaks, this.lookedRight, this.lookedRightLabel});

  /// Where it breaks, or null.
  final String? breaks;

  /// Why the picked option looked right, or null.
  final String? lookedRight;

  /// The label over [lookedRight] ("Why A looked right").
  final String? lookedRightLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final b = breaks?.trim();
    final l = lookedRight?.trim();
    final hasBreak = b != null && b.isNotEmpty;
    final hasLooked = l != null && l.isNotEmpty;
    if (!hasBreak && !hasLooked) return const SizedBox.shrink();
    Widget label(String text) => Semantics(
      header: true,
      child: Text(text, style: type.small.copyWith(fontWeight: FontWeight.w600, color: colors.ink2)),
    );
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s24),
      child: DecoratedBox(
        decoration: ShapeDecoration(color: colors.raised, shape: mmShapeBorder(MmRadius.panelAll)),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (hasBreak) ...[
                label(ReviewCopy.whereItBreaks),
                const SizedBox(height: MmSpace.s4),
                Text(b, style: type.body),
              ],
              if (hasBreak && hasLooked) const SizedBox(height: MmSpace.s16),
              if (hasLooked) ...[
                label(lookedRightLabel ?? ReviewCopy.whyLookedRight(null)),
                const SizedBox(height: MmSpace.s4),
                Text(l, style: type.body.copyWith(color: colors.ink2)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The worked explanation of an `explained` or `stored` repair. Observed patterns about the
/// option, never a statement about the student.
///
/// A v3 repair reads: the trap's name with "Explained from the answer key (D).", "Why B looked
/// right", "Where it breaks", "Why D is right" with the worked contrast pulled out under it, "The
/// other options" (closed), the rule to keep with its memory hook, "Explain it another way" (the
/// second explanation came in the same response, so the tap is free and makes no call), and
/// "From your record". A v2 repair keeps its own layout (the trap, why it tempted, where it
/// breaks, another way with its contrast, the rule, the next step) and a v1 repair its three
/// blocks; both end with "From your record" when there is something to say.
///
/// A fresh repair arrives block by block: each rises 8 dp and fades in on the shared stagger, then
/// the rule card settles once. A saved repair opened again, and any repair under reduced motion,
/// is simply there. The text never moves once shown.
class WorkedExplanation extends StatefulWidget {
  const WorkedExplanation({
    super.key,
    required this.explanation,
    this.chosenLetter,
    this.keyLetter,
    this.letterOf,
    this.recordLines = const [],
    this.animate = true,
    this.arrivalKey,
    this.follow,
  });

  final RepairExplanation explanation;

  /// The letter of the option the student picked ("B"), for "Why B looked right".
  final String? chosenLetter;

  /// The letter of the answer key's option ("D"), for "Why D is right" and the chip.
  final String? keyLetter;

  /// The letter of the option at a served index, or null when the index is not one of the
  /// question's options. Null itself when the question is not on hand: letters then count from A.
  final String? Function(int index)? letterOf;

  /// The finished sentences of "From your record", in order. The app lays them out as given.
  final List<String> recordLines;

  /// Whether the blocks arrive one after another. Only a fresh repair the server just
  /// acknowledged does; a saved one is shown at once.
  final bool animate;

  /// Names this repair for the run of the app: it arrives once. Going back to it along the run
  /// track, or a rebuilt screen, shows it at rest instead of staggering it in again. Null: no
  /// memory, it arrives whenever it is built.
  final String? arrivalKey;

  /// What follows the explanation and its rule, before "From your record": Ask Mobi about this
  /// mistake and "Check it held". Null draws neither (an older server, a held repair).
  final Widget? follow;

  /// The beat between blocks of a v1 or v2 repair (their layouts are as they were).
  static const step = Duration(milliseconds: 60);

  /// The beat between blocks of a v3 repair: the app's own stagger step.
  static const arrive = Motion.staggerStep;

  /// How far a block of a v3 repair rises as it arrives.
  static const rise = 8.0;

  /// The rule card's one settle, from 0.98 to full size.
  static const settle = Duration(milliseconds: 300);

  /// The reveal of "Another way to see it" and the swap of its button.
  static const reveal = Duration(milliseconds: 200);

  /// The disclosure of the other options.
  static const disclose = Duration(milliseconds: 180);

  @override
  State<WorkedExplanation> createState() => _WorkedExplanationState();
}

/// The repairs that have already arrived on screen in this run of the app.
final Set<String> _arrivedRepairs = {};

/// Forgets which repairs have arrived (tests only).
@visibleForTesting
void resetRepairArrivals() => _arrivedRepairs.clear();

class _WorkedExplanationState extends State<WorkedExplanation> with AutomaticKeepAliveClientMixin {
  final FocusNode _anotherFocus = FocusNode(debugLabel: 'another way heading');
  bool _anotherShown = false;

  /// Whether this build arrives block by block: a fresh repair, and only the first time it is shown.
  late final bool _animate;

  @override
  void initState() {
    super.initState();
    final key = widget.arrivalKey;
    _animate = widget.animate && (key == null || _arrivedRepairs.add(key));
  }

  // A repair on screen keeps what the student opened (the other options, the second explanation)
  // and its place in the arrival while the list scrolls it out of reach and back.
  @override
  bool get wantKeepAlive => true;

  @override
  void dispose() {
    _anotherFocus.dispose();
    super.dispose();
  }

  void _showAnotherWay() {
    setState(() => _anotherShown = true);
    // The button that was pressed is going away: send focus to the heading that takes its place.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _anotherFocus.requestFocus();
    });
  }

  /// The rows of "The other options": each with its letter, none the pick or the key, in the
  /// order the options were served.
  List<(String, String)> _otherRows() {
    final e = widget.explanation;
    final letterOf = widget.letterOf;
    final rows = <(String, String)>[];
    for (final o in e.others) {
      final letter = letterOf == null ? (o.index < 26 ? String.fromCharCode(65 + o.index) : null) : letterOf(o.index);
      if (letter == null || letter == widget.chosenLetter || letter == widget.keyLetter) continue;
      rows.add((letter, o.why));
    }
    return rows;
  }

  Widget _enter(int i, Widget child) => _animate ? MmEntrance(delay: WorkedExplanation.step * i, child: child) : child;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final e = widget.explanation;
    final record = widget.recordLines;
    if (e.isV3) return _v3(context, e, record);
    final colors = context.mmColors;
    final type = context.mmType;
    if (!e.isV2) {
      final blocks = <Widget>[
        BreakCard(breaks: e.whyWrong, lookedRight: e.whyTempting, lookedRightLabel: ReviewCopy.whyLookedRight(widget.chosenLetter)),
        ExplanationBlock(label: ReviewCopy.theIdea, paragraphs: [e.keyIdea], lead: true),
        ExplanationBlock(label: ReviewCopy.nextTime, paragraphs: [e.nextStep ?? '']),
        ?widget.follow,
        if (record.isNotEmpty) RecordLinesBlock(lines: record),
      ];
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [for (var i = 0; i < blocks.length; i++) _enter(i, blocks[i])],
      );
    }
    const step = WorkedExplanation.step;
    final blocks = <Widget>[
      Padding(
        padding: const EdgeInsets.only(top: MmSpace.s24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(header: true, child: Text(e.trapHeading!, style: type.cardTitle)),
            const SizedBox(height: MmSpace.s8),
            AnswerKeyChip(label: ReviewCopy.explainedFromKey(widget.keyLetter)),
          ],
        ),
      ),
      if (e.whyTempting != null || e.whyWrong != null)
        BreakCard(breaks: e.whyWrong, lookedRight: e.whyTempting, lookedRightLabel: ReviewCopy.whyLookedRight(widget.chosenLetter)),
      if (e.anotherWay != null || e.contrast != null)
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ExplanationBlock(label: ReviewCopy.anotherWay, paragraphs: [e.anotherWay ?? '']),
            if (e.contrast != null) _ContrastPull(text: e.contrast!, colors: colors, type: type),
          ],
        ),
    ];
    final ruleDelay = step * (blocks.length + 1);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < blocks.length; i++) _enter(i, blocks[i]),
        _enter(
          blocks.length,
          RuleCard(rule: e.rule!, railDelay: ruleDelay + Motion.enterDuration ~/ 2, animate: _animate),
        ),
        if (e.nextStep != null) _enter(blocks.length + 1, ExplanationBlock(label: ReviewCopy.nextTime, paragraphs: [e.nextStep!])),
        if (widget.follow != null) _enter(blocks.length + 2, widget.follow!),
        if (record.isNotEmpty) _enter(blocks.length + 3, RecordLinesBlock(lines: record)),
      ],
    );
  }

  Widget _v3(BuildContext context, RepairExplanation e, List<String> record) {
    final colors = context.mmColors;
    final type = context.mmType;
    final rows = _otherRows();
    final blocks = <Widget>[];
    blocks.add(
      Padding(
        padding: const EdgeInsets.only(top: MmSpace.s24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(header: true, child: Text(e.trapHeading!, style: type.cardTitle)),
            const SizedBox(height: MmSpace.s8),
            AnswerKeyChip(label: ReviewCopy.explainedFromKey(widget.keyLetter)),
          ],
        ),
      ),
    );
    if (e.whyTempting != null || e.whyWrong != null) {
      blocks.add(BreakCard(breaks: e.whyWrong, lookedRight: e.whyTempting, lookedRightLabel: ReviewCopy.whyLookedRight(widget.chosenLetter)));
    }
    blocks.add(
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ExplanationBlock(label: ReviewCopy.whyRight(widget.keyLetter), paragraphs: [e.whyRight!], lead: true),
          if (e.contrast != null) _ContrastPull(text: e.contrast!, colors: colors, type: type, rail: true),
        ],
      ),
    );
    if (rows.isNotEmpty) blocks.add(_OtherOptions(rows: rows));
    final ruleIndex = blocks.length;
    // The card settles after its block has landed; its rail draws while it does.
    final landed = WorkedExplanation.arrive * ruleIndex + Motion.enterDuration;
    blocks.add(
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          RuleCard(rule: e.rule!, railDelay: landed - Motion.enterDuration ~/ 2, settleDelay: landed, animate: _animate),
          if (e.memoryHook != null)
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s12),
              child: Text(ReviewCopy.toRememberIt(e.memoryHook!), style: type.small.copyWith(color: colors.ink2)),
            ),
        ],
      ),
    );
    if (e.anotherWay != null) {
      blocks.add(
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // The second explanation is already here: the button hands it over in place, free, and
            // goes away as it does.
            _Reveal(
              open: !_anotherShown,
              duration: WorkedExplanation.reveal,
              child: Padding(
                padding: const EdgeInsets.only(top: MmSpace.s8),
                child: FlushKey(label: ReviewCopy.explainAnotherWay, onPressed: _showAnotherWay),
              ),
            ),
            _Reveal(
              open: _anotherShown,
              duration: WorkedExplanation.reveal,
              child: ExplanationBlock(label: ReviewCopy.anotherWay, paragraphs: [e.anotherWay!], labelFocus: _anotherFocus),
            ),
          ],
        ),
      );
    }
    if (widget.follow != null) blocks.add(widget.follow!);
    if (record.isNotEmpty) blocks.add(RecordLinesBlock(lines: record));
    return MmStagger(
      enabled: _animate,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < blocks.length; i++) MmStaggerItem(index: i, rise: WorkedExplanation.rise, scale: 1, child: blocks[i]),
        ],
      ),
    );
  }
}

/// "Explained from the answer key (D)." under the trap's name: where this explanation comes from,
/// in a quiet outlined chip. It says "explained from", never "checked against": the repair is
/// written knowing the key, so agreeing with it proves nothing.
class AnswerKeyChip extends StatelessWidget {
  const AnswerKeyChip({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Align(
      alignment: Alignment.centerLeft,
      child: DecoratedBox(
        decoration: ShapeDecoration(shape: mmShapeBorder(MmRadius.pillAll, side: BorderSide(color: colors.line))),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s4),
          child: Text(label, style: type.caption.copyWith(color: colors.ink2)),
        ),
      ),
    );
  }
}

/// "From your record": the free lines the server built from the student's own answers, in order,
/// then the repeated-trap line. Plain sentences with their own numbers; nothing here is computed
/// or reworded on the phone.
class RecordLinesBlock extends StatelessWidget {
  const RecordLinesBlock({super.key, required this.lines});

  final List<String> lines;

  @override
  Widget build(BuildContext context) => ExplanationBlock(label: ReviewCopy.fromYourRecord, paragraphs: lines);
}

/// "The other options (2)": why each remaining option is wrong, behind a disclosure that is closed
/// until it is asked for. The header is a 48 dp row; the rows open in 180 ms.
class _OtherOptions extends StatefulWidget {
  const _OtherOptions({required this.rows});

  /// Letter and reason, in the order the options were served.
  final List<(String, String)> rows;

  @override
  State<_OtherOptions> createState() => _OtherOptionsState();
}

class _OtherOptionsState extends State<_OtherOptions> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final n = widget.rows.length;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Divider(height: 1, color: colors.line),
          MmPressable(
            onTap: () => setState(() => _open = !_open),
            pressedScale: 0.985,
            focusRadius: MmRadius.keyAll,
            haptic: MmPressHaptic.selection,
            highlight: true,
            semanticsLabel: _open ? ReviewCopy.otherOptionsOpen(n) : ReviewCopy.otherOptionsClosed(n),
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: MmTarget.min),
              child: Row(
                children: [
                  Expanded(child: Text(ReviewCopy.otherOptionsCount(n), style: type.labelLarge)),
                  AnimatedRotation(
                    turns: _open ? 0.5 : 0,
                    duration: Motion.of(context, WorkedExplanation.disclose),
                    curve: Motion.out,
                    child: Icon(LucideIcons.chevronDown, size: 20, color: colors.ink3),
                  ),
                ],
              ),
            ),
          ),
          _Reveal(
            open: _open,
            duration: WorkedExplanation.disclose,
            child: Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final (letter, why) in widget.rows)
                    Padding(
                      padding: const EdgeInsets.only(top: MmSpace.s8),
                      child: Semantics(
                        // One node a row, so a screen reader reads "Option C. ..." and moves on.
                        container: true,
                        label: ReviewCopy.otherOptionSpoken(letter, why),
                        excludeSemantics: true,
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ConstrainedBox(
                              constraints: const BoxConstraints(minWidth: 24),
                              child: Text('$letter.', style: type.body.copyWith(color: colors.ink2, fontWeight: FontWeight.w700)),
                            ),
                            const SizedBox(width: MmSpace.s4),
                            Expanded(child: Text(why, style: type.body)),
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
    );
  }
}

/// A section that grows into place: its height and its opacity on [duration], the child laid out
/// once at full size and revealed through a clip. Closed, the child is not built at all. Under
/// reduced motion it simply is or is not there.
class _Reveal extends StatefulWidget {
  const _Reveal({required this.open, required this.duration, required this.child});

  final bool open;
  final Duration duration;
  final Widget child;

  @override
  State<_Reveal> createState() => _RevealState();
}

class _RevealState extends State<_Reveal> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, value: widget.open ? 1 : 0)
    ..addStatusListener((_) {
      if (mounted) setState(() {});
    });
  late final CurvedAnimation _curve = CurvedAnimation(parent: _c, curve: Motion.out, reverseCurve: Motion.exit);

  @override
  void didUpdateWidget(_Reveal old) {
    super.didUpdateWidget(old);
    if (widget.open == old.open) return;
    final reduced = Motion.reduced(context);
    _c.duration = reduced ? Duration.zero : widget.duration;
    _c.reverseDuration = reduced ? Duration.zero : widget.duration;
    if (reduced) {
      _c.value = widget.open ? 1 : 0;
    } else if (widget.open) {
      _c.forward();
    } else {
      _c.reverse();
    }
  }

  @override
  void dispose() {
    _curve.dispose();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_c.isDismissed && !widget.open) return const SizedBox(width: double.infinity);
    return AnimatedBuilder(
      animation: _c,
      child: FadeTransition(opacity: _curve, child: widget.child),
      builder: (context, child) => ClipRect(
        child: Align(alignment: Alignment.topCenter, heightFactor: _curve.value.clamp(0.0, 1.0), child: child),
      ),
    );
  }
}

/// The worked contrast, pulled out of the paragraph so "if X then B; here Y, so C" reads as its
/// own small proof. With [rail] (a v3 repair) it sits under a 2 dp ink rail on the leading edge;
/// without it (a v2 repair) on a sunken ground.
class _ContrastPull extends StatelessWidget {
  const _ContrastPull({required this.text, required this.colors, required this.type, this.rail = false});

  final String text;
  final MmColors colors;
  final MmType type;
  final bool rail;

  @override
  Widget build(BuildContext context) {
    if (rail) {
      return Padding(
        padding: const EdgeInsets.only(top: MmSpace.s12),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ExcludeSemantics(child: SizedBox(width: 2, child: ColoredBox(color: colors.ink))),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: Text(text, style: type.body.copyWith(color: colors.ink))),
            ],
          ),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s12),
      child: DecoratedBox(
        decoration: ShapeDecoration(color: colors.sunken, shape: mmShapeBorder(MmRadius.smallAll)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, MmSpace.s12),
          child: Text(text, style: type.body.copyWith(color: colors.ink)),
        ),
      ),
    );
  }
}

/// The rule to keep, given weight: a raised card, "Keep this" over the rule, and Copy. Its leading
/// rail draws in last, after the blocks above have landed, and (for a fresh v3 repair, when
/// [settleDelay] is given) the card settles once from 0.98 to full size. The rule never moves
/// once shown. With [animate] off the card is simply there, rail drawn.
class RuleCard extends StatefulWidget {
  const RuleCard({super.key, required this.rule, this.railDelay = Duration.zero, this.settleDelay, this.animate = true});

  final String rule;
  final Duration railDelay;

  /// When the card's one settle starts, from the start of the arrival. Null: no settle.
  final Duration? settleDelay;
  final bool animate;

  @override
  State<RuleCard> createState() => _RuleCardState();
}

class _RuleCardState extends State<RuleCard> {
  bool _copied = false;

  static Path _rail(Size size) => Path()
    ..moveTo(size.width / 2, 0)
    ..lineTo(size.width / 2, size.height);

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: widget.rule));
    if (!mounted) return;
    setState(() => _copied = true);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final card = DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s16, MmSpace.s4, MmSpace.s8),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                width: 4,
                child: RepaintBoundary(
                  child: MmStrokeDraw(path: _rail, color: colors.volt, strokeWidth: 3, delay: widget.railDelay, animateFirst: widget.animate),
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(header: true, child: Text(ReviewCopy.keepThis, style: type.label.copyWith(color: colors.ink2))),
                    const SizedBox(height: MmSpace.s8),
                    Padding(
                      padding: const EdgeInsets.only(right: MmSpace.s12),
                      child: Text(widget.rule, style: type.cardTitle),
                    ),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: KeyButton.quiet(
                        label: _copied ? ReviewCopy.copiedRule : ReviewCopy.copyRule,
                        semanticsLabel: _copied ? ReviewCopy.copiedRule : ReviewCopy.copyRuleSpoken,
                        onPressed: _copy,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
    final settle = widget.settleDelay;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s24),
      child: settle != null && widget.animate ? _Settle(delay: settle, child: card) : card,
    );
  }
}

/// One settle: the child grows from 0.98 to full size in 300 ms on the ease-out, after [delay].
/// The delay is the lead of one timeline (no timer). Under reduced motion it is simply there.
class _Settle extends StatefulWidget {
  const _Settle({required this.delay, required this.child});

  final Duration delay;
  final Widget child;

  @override
  State<_Settle> createState() => _SettleState();
}

class _SettleState extends State<_Settle> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.delay + WorkedExplanation.settle);
  late final Animation<double> _scale;
  bool _begun = false;

  @override
  void initState() {
    super.initState();
    final total = (widget.delay + WorkedExplanation.settle).inMicroseconds;
    final lead = total == 0 ? 0.0 : widget.delay.inMicroseconds / total;
    _scale = Tween<double>(begin: 0.98, end: 1).animate(CurvedAnimation(parent: _c, curve: Interval(lead, 1, curve: Motion.out)));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_begun) return;
    _begun = true;
    if (Motion.reduced(context)) {
      _c.value = 1;
    } else {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ScaleTransition(scale: _scale, child: widget.child);
}

/// The small print under the repair: what it cost and what is left, or that it was free.
class RepairFinePrint extends StatelessWidget {
  const RepairFinePrint({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s16),
      child: Text(text, style: context.mmType.caption.copyWith(color: colors.ink2)),
    );
  }
}

/// A calm notice inside the work layer, as one line of text on the ground: a small glyph and the
/// plain sentence, then up to two quiet text actions. No box, no border, no tint: a notice is a
/// sentence, not a second card under the question.
class NoticePanel extends StatelessWidget {
  const NoticePanel({super.key, required this.message, this.detail, this.primary, this.secondary, this.icon = LucideIcons.info});

  final String message;
  final String? detail;
  final StateAction? primary;
  final StateAction? secondary;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            liveRegion: true,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Icon(icon, size: 16, color: colors.ink2),
                ),
                const SizedBox(width: MmSpace.s8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(message, style: type.small.copyWith(color: colors.ink)),
                      if (detail != null) ...[
                        const SizedBox(height: MmSpace.s2),
                        Text(detail!, style: type.small.copyWith(color: colors.ink2)),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (primary != null) FlushKey(label: primary!.label, onPressed: primary!.onPressed),
          if (secondary != null) FlushKey(label: secondary!.label, onPressed: secondary!.onPressed),
        ],
      ),
    );
  }
}

/// The concept that explains this chapter, through the Learn routes. Hidden while study
/// content is off or no lesson matches.
class ConceptRow extends ConsumerWidget {
  const ConceptRow({super.key, required this.chapter});

  final String chapter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final link = ref.watch(conceptLinkProvider(chapter));
    if (link == null) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Divider(height: 1, color: colors.line),
          MmPressable(
            onTap: () => context.push(AppRoutes.learnUnit(link.unitId)),
            pressedScale: 0.985,
            focusRadius: MmRadius.keyAll,
            haptic: MmPressHaptic.selection,
            highlight: true,
            semanticsLabel: '${ReviewCopy.concept}: ${link.title}',
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 64),
              child: Row(
                children: [
                  Icon(LucideIcons.bookOpen, size: 20, color: colors.ink2),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(ReviewCopy.concept, style: type.caption.copyWith(color: colors.ink2)),
                        Text(link.title, style: type.labelLarge),
                      ],
                    ),
                  ),
                  Icon(LucideIcons.chevronRight, size: 20, color: colors.ink3),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The optional retry: a separate 5-question practice in the chapter, with its own cost.
class RetryCard extends ConsumerWidget {
  const RetryCard({super.key, required this.subjectId, required this.chapter});

  /// Internal subject id.
  final String subjectId;
  final String chapter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offer = ref.watch(retryOfferProvider(subjectId)).value;
    final colors = context.mmColors;
    final type = context.mmType;
    return switch (offer) {
      RetryAvailable(:final subjectId, :final cost, :final free) => Padding(
        padding: const EdgeInsets.only(top: MmSpace.s8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Divider(height: 1, color: colors.line),
            const SizedBox(height: MmSpace.s16),
            Text(ReviewCopy.retryTitle(chapter), style: type.cardTitle),
            const SizedBox(height: MmSpace.s4),
            Text(ReviewCopy.retryLine(cost, free), style: type.small.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s12),
            KeyButton.secondary(label: ReviewCopy.retryKey, onPressed: () => context.push(retryRoute(subjectId, chapter))),
          ],
        ),
      ),
      RetryShortOfCredits() => Padding(
        padding: const EdgeInsets.only(top: MmSpace.s24),
        child: Text(ReviewCopy.retryShort, style: type.small.copyWith(color: colors.ink2)),
      ),
      _ => const SizedBox.shrink(),
    };
  }
}
