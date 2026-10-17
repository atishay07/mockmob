import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/models.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/action_router.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/subject_names.dart' show publicSubjectId;

/// The in-app link of one plan row: a `/dashboard` href built from [SwotPractice] (the website's
/// own form, so `ActionRouter` stays the one place that decides what opens). A chapter set goes
/// to chapter practice, anything else to Quick. It opens the setup screen with its credit quote:
/// nothing starts, and nothing is charged, before the second tap there.
///
/// The attempt's subject id is turned into the public id the practice routes read (`gat` is
/// `general_test` outside attempts), as every other link out of a result does.
String swotPracticeHref(SwotPractice p) => Uri(
      path: '/dashboard',
      queryParameters: {
        'subject': publicSubjectId(p.subject),
        'mode': p.chapter == null ? 'quick' : 'chapter',
        'count': '${p.count}',
        if (p.chapter != null) 'chapter': p.chapter!,
      },
    ).toString();

/// "After this mock" on the full result (post-mock SWOT): the next sets to practise, then a read
/// of the paper in four groups. Every string comes from the server, built from stored records
/// with its denominator, so this only lays it out. It draws nothing for a null, unknown or
/// unavailable read, and for `checks_pending` and `too_few` only the server's one message line.
///
/// One authored moment, the first time an attempt's section is built in this app run: the plan
/// rows, then the four groups, rise in 60 ms apart. A later visit, and reduced motion, show it at
/// rest.
class SwotSection extends StatefulWidget {
  const SwotSection({super.key, required this.attemptId, required this.swot, required this.onOpenQuestion, this.bare = false, this.readTitle});

  /// Drawn without its own title, under a heading the page already gives it (the open analysis' "Strengths and
  /// weaknesses", v15 spec 3.1). The default keeps "After this mock".
  final bool bare;

  /// The heading over the read of the paper; null keeps "SWOT for this mock", the open analysis says "What this paper
  /// showed".
  final String? readTitle;

  final String attemptId;
  final Swot? swot;

  /// A "Q12" button: open that answer (the screen's `_openFromMap`).
  final ValueChanged<int> onOpenQuestion;

  /// Forgets which attempts have played their entrance (tests only).
  @visibleForTesting
  static void debugResetSeen() => _SwotSectionState._seen.clear();

  @override
  State<SwotSection> createState() => _SwotSectionState();
}

class _SwotSectionState extends State<SwotSection> with SingleTickerProviderStateMixin {
  /// Attempts whose entrance has played, for the life of the app run.
  static final Set<String> _seen = {};

  static const Duration _step = Duration(milliseconds: 60);
  static const Duration _each = Duration(milliseconds: 220);

  AnimationController? _timeline;
  bool _playing = false;
  int _turns = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _maybePlay();
  }

  @override
  void didUpdateWidget(SwotSection old) {
    super.didUpdateWidget(old);
    _maybePlay();
  }

  /// Plays once per attempt, when its read first shows items (a message-only read has none).
  void _maybePlay() {
    final swot = widget.swot;
    if (_timeline != null || swot == null || !swot.isReady) return;
    if (!_seen.add(widget.attemptId)) return;
    if (Motion.reduced(context)) return;
    final turns = swot.plan.length + swot.quadrants.where((q) => q.isVisible).length;
    if (turns == 0) return;
    _turns = turns;
    _playing = true;
    final total = _step * (turns - 1) + _each;
    _timeline = AnimationController(vsync: this, duration: total)..forward();
  }

  @override
  void dispose() {
    _timeline?.dispose();
    super.dispose();
  }

  void _setUp(SwotPlanItem item) {
    final target = ActionRouter.resolve(swotPracticeHref(item.practice));
    if (target is NativeTarget) unawaited(context.push(target.location));
  }

  @override
  Widget build(BuildContext context) {
    final swot = widget.swot;
    if (swot == null || !swot.isVisible) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;

    if (swot.isMessageOnly) {
      // Only the server's line: the answer checks have not loaded, or the paper is too short.
      return Text(swot.message!, style: type.small.copyWith(color: colors.ink2));
    }

    var turn = 0;
    Widget arrive(Widget child) => _Arrive(timeline: _timeline, index: turn++, count: _turns, step: _step, each: _each, child: child);

    final basis = swot.basis;
    final groups = [for (final q in swot.quadrants) if (q.isVisible) q];
    final content = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (swot.plan.isNotEmpty) ...[
            _Heading(ResultCopy.swotPlanTitle),
            for (var i = 0; i < swot.plan.length; i++) ...[
              if (i > 0) Divider(height: 1, thickness: 1, color: colors.line),
              arrive(
                _PlanRow(
                  item: swot.plan[i],
                  first: i == 0,
                  playTick: _playing,
                  tickDelay: _step * i + const Duration(milliseconds: 140),
                  onSetUp: () => _setUp(swot.plan[i]),
                ),
              ),
            ],
            const SizedBox(height: MmRhythm.group),
          ],
          _Heading(widget.readTitle ?? ResultCopy.swotReadTitle),
          if (basis != null && basis.line.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s4),
            Text(basis.line, style: type.small.copyWith(color: colors.ink2)),
            if (basis.heldLine != null) ...[
              const SizedBox(height: MmSpace.s4),
              Text(basis.heldLine!, style: type.small.copyWith(color: colors.ink2)),
            ],
          ],
          for (final g in groups) ...[
            const SizedBox(height: MmRhythm.group),
            arrive(_QuadrantBlock(quadrant: g, onOpenQuestion: widget.onOpenQuestion)),
          ],
        ],
      );
    return widget.bare ? content : MmSection(title: ResultCopy.swotTitle, child: content);
  }
}

/// An item's turn on the section's one timeline: opacity and an 8 dp rise, ease-out. One widget
/// shape at rest and in motion, so a button's state is never lost when the entrance ends.
class _Arrive extends StatelessWidget {
  const _Arrive({
    required this.timeline,
    required this.index,
    required this.count,
    required this.step,
    required this.each,
    required this.child,
  });

  final Animation<double>? timeline;
  final int index;
  final int count;
  final Duration step;
  final Duration each;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final timeline = this.timeline;
    final interval = timeline == null || count == 0
        ? null
        : () {
            final total = (step * (count - 1) + each).inMicroseconds;
            final begin = (step * index).inMicroseconds / total;
            final end = (step * index + each).inMicroseconds / total;
            return Interval(begin.clamp(0.0, 1.0), end.clamp(0.0, 1.0), curve: Motion.out);
          }();
    return AnimatedBuilder(
      animation: timeline ?? kAlwaysCompleteAnimation,
      child: child,
      builder: (context, child) {
        final t = interval == null ? 1.0 : interval.transform(timeline!.value);
        return Opacity(opacity: t, child: Transform.translate(offset: Offset(0, 8 * (1 - t)), child: child));
      },
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Semantics(header: true, child: Text(text, style: context.mmType.cardTitle));
}

/// One "Do these next" row: the label, why it is on the list, what a later set showed, and the
/// outlined "Set up" button. The first row's outline is the accent; the hero's repair key stays
/// the page's only filled key.
class _PlanRow extends StatelessWidget {
  const _PlanRow({required this.item, required this.first, required this.playTick, required this.tickDelay, required this.onSetUp});

  final SwotPlanItem item;
  final bool first;
  final bool playTick;
  final Duration tickDelay;
  final VoidCallback onSetUp;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final later = item.later;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.label, style: type.body.copyWith(fontWeight: FontWeight.w600)),
                if (item.reason.isNotEmpty) ...[
                  const SizedBox(height: MmSpace.s2),
                  Text(item.reason, style: type.small.copyWith(color: colors.ink2)),
                ],
                if (later != null) ...[
                  const SizedBox(height: MmSpace.s8),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // A tick for a thing that happened: the server's line says what, and it never
                      // claims the plan was followed.
                      ExcludeSemantics(
                        child: Padding(
                          padding: const EdgeInsets.only(top: 1),
                          child: MmStrokeDraw(
                            path: MmPaths.checkFor,
                            color: colors.ink2,
                            size: const Size(16, 16),
                            strokeWidth: 2,
                            duration: const Duration(milliseconds: 180),
                            curve: Motion.out,
                            delay: tickDelay,
                            animateFirst: playTick,
                          ),
                        ),
                      ),
                      const SizedBox(width: MmSpace.s8),
                      Expanded(child: Text(later.line, style: type.caption.copyWith(color: colors.ink2))),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: MmSpace.s12),
          _SetUpButton(label: item.label, accent: first, onTap: onSetUp),
        ],
      ),
    );
  }
}

class _SetUpButton extends StatelessWidget {
  const _SetUpButton({required this.label, required this.accent, required this.onTap});

  final String label;
  final bool accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmHitSlop.toTarget(
      visual: 40,
      child: MmPressable(
        onTap: onTap,
        haptic: MmPressHaptic.selection,
        highlight: true,
        semanticsLabel: ResultCopy.swotSetUpFor(label),
        builder: (context, pressed, _) => DecoratedBox(
          decoration: ShapeDecoration(
            shape: StadiumBorder(side: BorderSide(color: accent ? colors.accentText : colors.lineStrong, width: accent ? 1.5 : 1)),
          ),
          child: SizedBox(
            height: 40,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s20),
              child: Center(widthFactor: 1, child: Text(ResultCopy.swotSetUp, style: type.labelLarge)),
            ),
          ),
        ),
      ),
    );
  }
}

/// One group: a 6 dp dot in its meaning colour and the word, then its items, or its one quiet
/// line when it has none. The word is always written, so colour never carries the group alone.
class _QuadrantBlock extends StatelessWidget {
  const _QuadrantBlock({required this.quadrant, required this.onOpenQuestion});

  final SwotQuadrant quadrant;
  final ValueChanged<int> onOpenQuestion;

  Color _dot(MmColors c) => switch (quadrant.id) {
        SwotQuadrant.strength => c.goodText,
        SwotQuadrant.weakness => c.badText,
        SwotQuadrant.opportunity => c.accentText,
        SwotQuadrant.threat => c.warnText,
        _ => c.ink3,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Row(
            children: [
              ExcludeSemantics(
                child: DecoratedBox(
                  decoration: BoxDecoration(color: _dot(colors), shape: BoxShape.circle),
                  child: const SizedBox.square(dimension: 6),
                ),
              ),
              const SizedBox(width: MmSpace.s8),
              Text(quadrant.label.isNotEmpty ? quadrant.label : ResultCopy.swotGroupWord(quadrant.id), style: type.label),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        if (quadrant.items.isEmpty)
          Text(quadrant.empty ?? '', style: type.small.copyWith(color: colors.ink2))
        else
          for (var i = 0; i < quadrant.items.length; i++) ...[
            if (i > 0) const SizedBox(height: MmSpace.s16),
            _ItemBlock(item: quadrant.items[i], onOpenQuestion: onOpenQuestion),
          ],
      ],
    );
  }
}

class _ItemBlock extends StatelessWidget {
  const _ItemBlock({required this.item, required this.onOpenQuestion});

  final SwotItem item;
  final ValueChanged<int> onOpenQuestion;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(item.title, style: type.body.copyWith(fontWeight: FontWeight.w600)),
        if (item.detail.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s2),
          Text(item.detail, style: type.small.copyWith(color: colors.ink2)),
        ],
        if (item.questions.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s8),
          // Each button is 36 dp drawn inside a 48 dp target; the 12 dp between wrapped lines is
          // what the two bands share, so the targets tile without overlapping.
          Wrap(
            spacing: MmSpace.s8,
            runSpacing: MmSpace.s12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              SizedBox(height: 36, child: Center(widthFactor: 1, child: Text(ResultCopy.swotSee, style: type.caption.copyWith(color: colors.ink2)))),
              for (final n in item.questions) _QuestionButton(number: n, onTap: () => onOpenQuestion(n)),
            ],
          ),
        ],
      ],
    );
  }
}

class _QuestionButton extends StatelessWidget {
  const _QuestionButton({required this.number, required this.onTap});

  final int number;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmHitSlop.toTarget(
      visual: 36,
      child: MmPressable(
        onTap: onTap,
        haptic: MmPressHaptic.selection,
        highlight: true,
        semanticsLabel: ResultCopy.swotGoToQuestion(number),
        builder: (context, pressed, _) => DecoratedBox(
          decoration: ShapeDecoration(shape: StadiumBorder(side: BorderSide(color: colors.lineStrong))),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 48, minHeight: 36),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
              child: Center(widthFactor: 1, child: Text(ResultCopy.swotQuestionChip(number), style: type.label.copyWith(fontSize: 14))),
            ),
          ),
        ),
      ),
    );
  }
}
