import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/question.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import 'answer_option.dart';
import 'question_enter.dart';
import 'runner_controls.dart';
import 'runner_motion.dart';

/// The question region (spec 5.5, runner.md 3.4 and 3.5): the passage in its own scrolling well,
/// the question and the mark key in the middle of the space the header leaves, then the options as
/// soft cards at the foot. Solid surfaces only. The pieces arrive together when the question does
/// (see [QuestionEnter]) and then nothing moves except the chosen option's ink. "Clear my answer"
/// is not in here: it is pinned under the region ([ClearBand]).
class QuestionView extends StatelessWidget {
  const QuestionView({
    super.key,
    required this.question,
    required this.selected,
    required this.marked,
    required this.canAnswer,
    required this.onSelect,
    required this.onMark,
    this.passageRange,
    this.leading,
    this.note,
    this.onLock,
    this.isStruck,
    this.onStrike,
    this.passageRead,
  });

  final SessionQuestion question;

  /// The chosen option index, or null.
  final int? selected;
  final bool marked;
  final bool canAnswer;

  /// Null clears the answer.
  final ValueChanged<int?> onSelect;
  final ValueChanged<bool> onMark;

  /// "Questions 3 to 6 use this passage."
  final (int, int)? passageRange;

  /// Banners that belong above the question (return after a gap, the practice note).
  final List<Widget>? leading;

  /// One quiet line beside the mark toggle (the practice skin's note).
  final Widget? note;

  /// The global centre of the bubble an answer is about to be chosen on (the lock-in flight).
  final ValueChanged<Offset>? onLock;

  /// Whether option i is crossed out (in memory only; see `StrikeBook`).
  final bool Function(int option)? isStruck;

  /// A long press on option i: crosses it out or brings it back.
  final ValueChanged<int>? onStrike;

  /// Where the reader is in this question's passage, kept by the runner per passage group so
  /// question 12 to 13 on one passage keeps the place (null: a fresh read each time).
  final PassageRead? passageRead;

  /// The question itself is the hero of the screen: 19/28 at weight 600 for a long stem, and
  /// larger when the stem is short, so a one-line question fills the space it has instead of
  /// leaving a gap above the options.
  static TextStyle questionStyle(BuildContext context, {int length = 200}) {
    final style = context.mmType.question;
    // At large system text the question already grows with it, and the options need the room:
    // the short-stem boost is for the normal size only.
    final large = MediaQuery.textScalerOf(context).scale(1) >= 1.15;
    final size = large
        ? 19.0
        : length <= 60
        ? 30.0
        : length <= 100
        ? 27.0
        : length <= 140
        ? 24.0
        : length <= 200
        ? 21.0
        : 19.0;
    return style.copyWith(fontSize: size, height: size <= 19 ? 28 / 19 : 1.28, fontWeight: FontWeight.w600, color: context.mmColors.ink);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final passage = question.passageText;
    final body = question.body;

    // On a tall screen the cards grow (56 dp up to 72 dp), so the gap between a short question
    // and its options is spent on bigger keys, not left as air. 640 dp and shorter keeps 56.
    final screen = MediaQuery.sizeOf(context).height;
    final optionHeight = (AnswerOption.cardHeight + (screen - 700) * 0.1).clamp(AnswerOption.cardHeight, 72.0);

    // Three groups: the banners and the question block above, the cards at the foot, next to the
    // thumb and the bottom bar. Whatever height the screen has left over is split into equal
    // halves above and below the question, so it sits in the middle of the space between the
    // header and the cards instead of hanging from the header with a hole under it. The layout
    // gives this column at least the height of the region (see RunnerLayout); a long question
    // fills it and the gaps are zero.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [...?leading],
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (passage != null && passage.isNotEmpty) ...[
              EnterItem(
                order: 0,
                child: _PassageWell(text: passage, range: passageRange, read: passageRead),
              ),
              const SizedBox(height: MmSpace.s16),
            ],
            EnterItem(
              order: 0,
              child: Semantics(
                header: true,
                child: Text(
                  question.question,
                  // A passage question keeps the standard size: the passage is the long read.
                  style: questionStyle(context, length: passage != null && passage.isNotEmpty ? 200 : question.question.length),
                ),
              ),
            ),
            if (body != null && body.isNotEmpty) ...[
              const SizedBox(height: MmSpace.s12),
              EnterItem(
                order: 1,
                child: Text(body, style: type.body.copyWith(color: colors.ink)),
              ),
            ],
            // The mark key (and the practice's one line) sit 16 dp under the question, not up beside
            // the top bar: the things the student reaches for are close to the words they are about.
            const SizedBox(height: MmSpace.s16),
            EnterItem(
              order: 1,
              // From 1.15x text the note would wrap beside the toggle: it takes a line above it.
              child: note != null && MediaQuery.textScalerOf(context).scale(1) >= 1.15
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        note!,
                        Align(
                          alignment: Alignment.centerRight,
                          child: MarkToggle(marked: marked, onChanged: onMark),
                        ),
                      ],
                    )
                  : Row(
                      children: [
                        Expanded(child: note ?? const SizedBox.shrink()),
                        const SizedBox(width: MmSpace.s8),
                        MarkToggle(marked: marked, onChanged: onMark),
                      ],
                    ),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(top: MmSpace.s16),
          // Soft 56 dp cards of the answer sheet, 8 dp apart: no rules, no boxes inside boxes.
          child: _WashGlide(
            selected: selected,
            count: question.options.length,
            builder: (rows, gliding) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < question.options.length; i++)
                  EnterItem(
                    order: 2 + i,
                    child: Padding(
                      padding: EdgeInsets.only(top: i == 0 ? 0 : AnswerOption.cardGap),
                      child: AnswerOption(
                        key: rows[i],
                        glide: gliding,
                        letter: question.options[i].key,
                        text: question.options[i].text,
                        selected: selected == i,
                        onSelect: canAnswer ? () => onSelect(i) : null,
                        onLock: onLock,
                        minHeight: optionHeight,
                        // The chosen option is never crossed out; picking a crossed-out one brings it back.
                        struck: selected != i && (isStruck?.call(i) ?? false),
                        onStrike: canAnswer && selected != i && onStrike != null ? () => onStrike!(i) : null,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Changing the answer from one option to another: the volt wash slides from the old card to the
/// new one over 240 ms (under the cards' text, never over it), and the new row takes it in full
/// as it lands. A first answer, a clear, and reduced motion keep each row's own wash.
class _WashGlide extends StatefulWidget {
  const _WashGlide({required this.selected, required this.count, required this.builder});

  final int? selected;
  final int count;

  /// Builds the rows with their keys; [gliding] is true while the wash slides.
  final Widget Function(List<GlobalKey> rows, bool gliding) builder;

  @override
  State<_WashGlide> createState() => _WashGlideState();
}

class _WashGlideState extends State<_WashGlide> with SingleTickerProviderStateMixin {
  late List<GlobalKey> _rows = List.generate(widget.count, (_) => GlobalKey());
  final GlobalKey _box = GlobalKey();
  late final AnimationController _t = AnimationController(vsync: this, duration: RunnerMotion.washGlide)
    ..addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) setState(_end);
    });
  Rect? _from;
  Rect? _to;

  @override
  void initState() {
    super.initState();
    // Made here, not lazily: a list that never glided must still dispose it safely.
    _t.value = 0;
  }

  void _end() {
    _from = null;
    _to = null;
  }

  Rect? _rectOf(int i) {
    if (i < 0 || i >= _rows.length) return null;
    final row = _rows[i].currentContext?.findRenderObject();
    final box = _box.currentContext?.findRenderObject();
    if (row is! RenderBox || box is! RenderBox || !row.hasSize || !row.attached || !box.attached) return null;
    return row.localToGlobal(Offset.zero, ancestor: box) & row.size;
  }

  @override
  void didUpdateWidget(_WashGlide old) {
    super.didUpdateWidget(old);
    if (widget.count != old.count) _rows = List.generate(widget.count, (_) => GlobalKey());
    final a = old.selected;
    final b = widget.selected;
    if (a == b) return;
    final from = a == null ? null : _rectOf(a);
    final to = b == null ? null : _rectOf(b);
    if (from != null && to != null && !RunnerMotion.reduced(context)) {
      _from = from;
      _to = to;
      _t.forward(from: 0);
    } else {
      _t.stop();
      _end();
    }
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final from = _from;
    final to = _to;
    return Stack(
      key: _box,
      children: [
        if (from != null && to != null)
          Positioned.fill(
            child: IgnorePointer(
              child: CustomPaint(
                painter: _GlidePainter(
                  progress: _t,
                  from: from,
                  to: to,
                  // The same strength as a row's own wash.
                  color: colors.volt.withValues(alpha: colors.isNight ? 0.09 : 0.16),
                ),
              ),
            ),
          ),
        widget.builder(_rows, from != null),
      ],
    );
  }
}

class _GlidePainter extends CustomPainter {
  _GlidePainter({required this.progress, required this.from, required this.to, required this.color}) : super(repaint: progress);

  final Animation<double> progress;
  final Rect from;
  final Rect to;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.lerp(from, to, Motion.glide.transform(progress.value.clamp(0.0, 1.0)))!;
    canvas.drawRRect(AnswerOption.cardRadius.toRRect(rect), Paint()..color = color);
  }

  @override
  bool shouldRepaint(_GlidePainter old) => old.from != from || old.to != to || old.color != color;
}

/// Where the reader is in a passage: folded to its one-line caption or open, and how far down it
/// is scrolled. The runner keeps one per passage group, in memory only.
class PassageRead {
  bool collapsed = false;
  double offset = 0;
}

/// A long passage scrolls inside its own well, at most 40% of the screen, so the question and
/// options stay within reach. Its caption row is a key: it folds the well to that one line over
/// 260 ms (and opens it again), and a soft fade at the foot says there is more text below.
class _PassageWell extends StatefulWidget {
  const _PassageWell({required this.text, this.range, this.read});

  final String text;
  final (int, int)? range;
  final PassageRead? read;

  /// The fold.
  static const Duration fold = Duration(milliseconds: 260);

  @override
  State<_PassageWell> createState() => _PassageWellState();
}

class _PassageWellState extends State<_PassageWell> with SingleTickerProviderStateMixin {
  late final PassageRead _read = widget.read ?? PassageRead();
  late final ScrollController _scroll = ScrollController(initialScrollOffset: _read.offset)..addListener(_remember);
  late final AnimationController _open = AnimationController(vsync: this, duration: _PassageWell.fold, value: _read.collapsed ? 0 : 1);
  late final Animation<double> _size = CurvedAnimation(parent: _open, curve: Motion.glide);
  bool _more = false;

  void _remember() {
    if (_scroll.hasClients) _read.offset = _scroll.offset;
  }

  bool _metrics(ScrollMetrics m) {
    final more = m.extentAfter > 1;
    if (more != _more) setState(() => _more = more);
    // The well's own scroll is not the question region's: the region's foot fade never hears it.
    return true;
  }

  void _toggle() {
    setState(() => _read.collapsed = !_read.collapsed);
    if (RunnerMotion.reduced(context)) {
      _open.value = _read.collapsed ? 0 : 1;
    } else if (_read.collapsed) {
      _open.reverse();
    } else {
      _open.forward();
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    _open.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final maxHeight = MediaQuery.sizeOf(context).height * 0.4;
    final range = widget.range;
    final caption = range == null ? RunnerCopy.passage : '${RunnerCopy.passage}. ${RunnerCopy.passageRange(range.$1, range.$2)}';
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.sunken,
        shape: RoundedSuperellipseBorder(
          borderRadius: MmRadius.keyAll,
          side: BorderSide(color: colors.line),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // The caption row is the fold key (48 dp tall); folded, it is all that shows.
          Semantics(
            button: true,
            expanded: !_read.collapsed,
            label: '$caption ${_read.collapsed ? RunnerCopy.passageShow : RunnerCopy.passageHide}',
            excludeSemantics: true,
            onTap: _toggle,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _toggle,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: MmTarget.min),
                child: Padding(
                  padding: const EdgeInsets.only(left: MmSpace.s16),
                  child: Row(
                    children: [
                      Icon(LucideIcons.bookOpen, size: 14, color: colors.ink3),
                      const SizedBox(width: MmSpace.s8),
                      Expanded(
                        child: Text(
                          caption,
                          style: type.caption.copyWith(color: colors.ink3),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      SizedBox.square(
                        dimension: MmTarget.min,
                        child: Center(
                          child: RotationTransition(
                            turns: _size.drive(Tween<double>(begin: -0.5, end: 0)),
                            child: Icon(LucideIcons.chevronUp, size: 18, color: colors.ink2),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          SizeTransition(
            sizeFactor: _size,
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxHeight: math.max(0, maxHeight - MmTarget.min)),
              child: Stack(
                children: [
                  NotificationListener<ScrollMetricsNotification>(
                    onNotification: (n) => _metrics(n.metrics),
                    child: NotificationListener<ScrollNotification>(
                      onNotification: (n) => _metrics(n.metrics),
                      child: Scrollbar(
                        controller: _scroll,
                        child: SingleChildScrollView(
                          controller: _scroll,
                          primary: false,
                          padding: const EdgeInsets.fromLTRB(MmSpace.s16, 0, MmSpace.s16, MmSpace.s16),
                          child: Text(widget.text, style: type.body.copyWith(color: colors.ink)),
                        ),
                      ),
                    ),
                  ),
                  // More text below: the foot of the well fades into its own ground.
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 24,
                    child: IgnorePointer(
                      child: AnimatedOpacity(
                        opacity: _more ? 1 : 0,
                        duration: Motion.of(context, Motion.glideDuration),
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [colors.sunken.withValues(alpha: 0), colors.sunken],
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
        ],
      ),
    );
  }
}
