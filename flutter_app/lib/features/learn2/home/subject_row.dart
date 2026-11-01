import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/art/art.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/widgets/edge_fade.dart';
import '../data/learn_models.dart';
import 'home_copy.dart';
import 'home_model.dart';

/// The student's subjects as a sideways row of objects, as the web's Learn home draws Practice's loop: each subject's
/// object, its name, the Key cards due today in it ("9 due"), and a volt rule under the chosen one. The rest step back.
/// A cut subject at the right edge is the cue that the row scrolls. The chosen subject is brought to the middle: before
/// the first frame on arrival (nothing jumps), smoothly after a pick. Choosing writes the shared practice subject (the
/// caller does it in [onPick]).
class LearnSubjectRow extends StatefulWidget {
  const LearnSubjectRow({
    super.key,
    required this.subjects,
    required this.current,
    required this.onPick,
    this.busy = false,
    this.dues,
    this.gutter = MmSpace.gutter,
  });

  final List<LearnSubjectRef> subjects;
  final String current;
  final ValueChanged<String> onPick;

  /// The body under the row is still loading.
  final bool busy;

  /// Each subject's Key cards due today, by subject id.
  final Map<String, int>? dues;
  final double gutter;

  /// An item is this wide where the row scrolls; the next one shows by about this much less.
  static const double itemWidth = 96;
  static const double itemGap = 5;
  static const double objectSize = 72;

  /// "Business Studies" for "Business Studies"; "Economics" for "Economics / Business Economics": the loop has room for one
  /// short name (the whole name stays the item's spoken label).
  static String shortName(String name) => HomeModel.displayTitle(name.split(' / ').first);

  /// The scroll offset that puts item [index] in the middle of a [viewport] wide row, kept inside the row.
  @visibleForTesting
  static double centerOffset({required int index, required double itemWidth, required double viewport, required double content, double gutter = MmSpace.gutter}) {
    final middle = gutter + index * (itemWidth + itemGap) + itemWidth / 2;
    return (middle - viewport / 2).clamp(0.0, math.max(content - viewport, 0.0));
  }

  @override
  State<LearnSubjectRow> createState() => _LearnSubjectRowState();
}

class _LearnSubjectRowState extends State<LearnSubjectRow> {
  ScrollController? _controller;
  double _viewport = 0;
  double _width = LearnSubjectRow.itemWidth;

  int get _index => widget.subjects.indexWhere((s) => s.id == widget.current);

  double get _content {
    final n = widget.subjects.length;
    return widget.gutter * 2 + n * _width + math.max(n - 1, 0) * LearnSubjectRow.itemGap;
  }

  double _target() => _index < 0
      ? 0
      : LearnSubjectRow.centerOffset(index: _index, itemWidth: _width, viewport: _viewport, content: _content, gutter: widget.gutter);

  @override
  void didUpdateWidget(LearnSubjectRow old) {
    super.didUpdateWidget(old);
    if (old.current == widget.current && old.subjects.length == widget.subjects.length) return;
    // The new choice glides to the middle once the row has laid out with it.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final c = _controller;
      if (!mounted || c == null || !c.hasClients) return;
      final to = _target();
      if ((to - c.offset).abs() < 0.5) return;
      final d = Motion.of(context, Motion.glideDuration);
      if (d == Duration.zero) {
        c.jumpTo(to);
      } else {
        unawaited(c.animateTo(to, duration: d, curve: Motion.glide));
      }
    });
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final subjects = widget.subjects;
    if (subjects.isEmpty) return const SizedBox.shrink();
    final long = subjects.any((s) => LearnSubjectRow.shortName(s.name).length > 12);
    return Semantics(
      container: true,
      label: HomeCopy.subjectGroup,
      child: LayoutBuilder(
        builder: (context, constraints) {
          _viewport = constraints.maxWidth;
          final n = subjects.length;
          const gap = LearnSubjectRow.itemGap;
          // Few subjects share the row; more scroll, and the one past the edge shows by a cut.
          final room = _viewport - widget.gutter * 2 - (n - 1) * gap;
          // Larger text gets a wider item, so a name is never broken inside a word.
          final base = MediaQuery.textScalerOf(context).scale(LearnSubjectRow.itemWidth).clamp(LearnSubjectRow.itemWidth, 132.0);
          _width = n * base <= room ? math.min(room / n, 132) : base;
          _controller ??= ScrollController(initialScrollOffset: _target());
          return EdgeFade(
            extent: MmSpace.s24,
            child: SingleChildScrollView(
              controller: _controller,
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(horizontal: widget.gutter),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var i = 0; i < n; i++) ...[
                    if (i > 0) const SizedBox(width: gap),
                    _SubjectItem(
                      key: ValueKey('lh-subject-${subjects[i].id}'),
                      subject: subjects[i],
                      width: _width,
                      chosen: subjects[i].id == widget.current,
                      long: long,
                      due: widget.dues?[subjects[i].id] ?? 0,
                      onTap: () => widget.onPick(subjects[i].id),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _SubjectItem extends StatefulWidget {
  const _SubjectItem({super.key, required this.subject, required this.width, required this.chosen, required this.long, required this.due, required this.onTap});

  final LearnSubjectRef subject;
  final double width;
  final bool chosen;
  final bool long;
  final int due;
  final VoidCallback onTap;

  @override
  State<_SubjectItem> createState() => _SubjectItemState();
}

class _SubjectItemState extends State<_SubjectItem> {
  /// Bumped by the tap that picks this subject: the object answers it (it gives under the finger and springs back).
  final ValueNotifier<int> _pick = ValueNotifier(0);

  @override
  void dispose() {
    _pick.dispose();
    super.dispose();
  }

  void _tapped() {
    if (widget.chosen) return;
    _pick.value++;
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final scaler = MediaQuery.textScalerOf(context);
    final name = LearnSubjectRow.shortName(widget.subject.name);
    final due = widget.due > 0 ? HomeCopy.subjectDue(widget.due) : '';
    final nameStyle = type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w700, color: widget.chosen ? colors.ink : colors.ink2, height: 1.3);
    final dueStyle = type.caption.copyWith(color: colors.ink2, height: 1.3);
    return MmPressable(
      semanticsLabel: due.isEmpty ? widget.subject.name : '${widget.subject.name}, $due',
      selected: widget.chosen,
      inMutuallyExclusiveGroup: true,
      focusRadius: MmRadius.keyAll,
      pressedScale: 0.97,
      onTap: _tapped,
      builder: (context, pressed, _) => SizedBox(
        width: widget.width,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: MmSpace.s4),
            SizedBox.square(
              dimension: LearnSubjectRow.objectSize,
              child: Opacity(
                opacity: widget.chosen ? 1 : 0.86,
                child: SubjectEmblem(subject: widget.subject.id, size: LearnSubjectRow.objectSize, framed: false, reaction: _pick),
              ),
            ),
            const SizedBox(height: MmSpace.s8),
            // A long name wraps to two lines in a narrow item; the row keeps both lines' height whichever subject is
            // chosen, so nothing below it moves.
            ConstrainedBox(
              constraints: BoxConstraints(minHeight: widget.long ? scaler.scale(14 * 1.3 * 2) : 0),
              child: Text(name, textAlign: TextAlign.center, style: nameStyle),
            ),
            const SizedBox(height: MmSpace.s2),
            // The due line keeps its height before the counts land.
            SizedBox(height: scaler.scale(17), child: Text(due, textAlign: TextAlign.center, maxLines: 1, style: dueStyle)),
            const SizedBox(height: MmSpace.s8),
            _Rule(on: widget.chosen),
            const SizedBox(height: MmSpace.s8),
          ],
        ),
      ),
    );
  }
}

/// The chosen subject's volt rule: grows from the middle as it is chosen, so the choice reads without colour alone.
class _Rule extends StatelessWidget {
  const _Rule({required this.on});

  final bool on;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(end: on ? 1 : 0),
      duration: Motion.of(context, Motion.ui),
      curve: Motion.out,
      builder: (context, t, _) => Opacity(
        opacity: t,
        child: Transform.scale(
          scaleX: 0.5 + 0.5 * t,
          child: SizedBox(
            width: 80,
            height: 3,
            child: DecoratedBox(decoration: ShapeDecoration(color: colors.accentText, shape: const StadiumBorder())),
          ),
        ),
      ),
    );
  }
}
