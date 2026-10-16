import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/models/question.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'review_layout.dart';

/// The question as it was answered, on solid ground (the work layer never has art behind
/// reading): an optional passage, the question, and the options with the student's answer and
/// the correct one marked by bubble, word and surface, never colour alone.
class QuestionPanel extends StatelessWidget {
  const QuestionPanel({super.key, required this.question, this.chosen, this.keyIndex, this.showKey = true, this.reveal, this.earlier, this.words});

  final SnapshotQuestion question;
  final int? chosen;

  /// The pick made in the paper, when [chosen] is a newer pick (the repair's "try it once more"):
  /// marked quietly as the earlier one.
  final int? earlier;

  /// The tag's words per option index, in place of "Your answer" / "Correct answer".
  final Map<int, String>? words;

  /// The correct option, or null when no key may be shown (spec 5.7 key rule).
  final int? keyIndex;
  final bool showKey;

  /// The key reveal's clock ([KeyReveal]), or null to paint the final state.
  final Animation<double>? reveal;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final passage = question.passageText?.trim();
    final body = question.body?.trim();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (passage != null && passage.isNotEmpty) ...[PassageBlock(text: passage), const SizedBox(height: MmSpace.s16)],
        Text(question.question, style: type.question),
        if (body != null && body.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s8),
          Text(body, style: type.body.copyWith(color: context.mmColors.ink2)),
        ],
        const SizedBox(height: MmSpace.s16),
        for (var i = 0; i < question.options.length; i++) ...[
          if (i > 0) const SizedBox(height: MmSpace.s8),
          MarkedOption(letter: question.options[i].key, text: question.options[i].text, mark: _markFor(i), reveal: reveal, word: words?[i]),
        ],
      ],
    );
  }

  OptionMark _markFor(int i) {
    final isKey = showKey && keyIndex == i;
    if (isKey) return OptionMark.correct;
    if (chosen == i || earlier == i) return OptionMark.yours;
    return OptionMark.none;
  }
}

enum OptionMark { none, yours, correct }

/// The key reveal, on one 1100 ms clock (the website's FoldLine beat): your pick settles 4 dp into
/// place and "Your answer" fades in; 120 ms after it lands the correct option's outline strokes
/// round, then its bubble fills and "Correct answer" fades in, with one light haptic as the fill
/// lands. As the outline closes the option's surface and its words warm into the key's over
/// [landEnd] (no snap), and the border becomes the same 2 px line the stroke drew. Each part
/// reads its own window of the clock.
abstract final class KeyRevealTiming {
  static const Duration total = Duration(milliseconds: 1100);
  static const double settleEnd = 300 / 1100;
  static const double yourWordStart = 140 / 1100;
  static const double yourWordEnd = 380 / 1100;
  static const double strokeStart = 420 / 1100;
  static const double strokeEnd = 800 / 1100;
  static const double keyWordStart = 860 / 1100;

  /// The key option's surface and words finish warming into place here.
  static const double landEnd = 980 / 1100;

  /// How far the pick drops as it settles.
  static const double settle = 4;

  static double window(double t, double a, double b) => ((t - a) / (b - a)).clamp(0.0, 1.0);
}

/// Owns the key reveal for the question it shows: plays once when the key first appears on a
/// mistake (an answer review, the folded line of a fresh repair), and paints the final state at
/// once for a stored repair, under reduced motion, or when [animate] is false.
class KeyReveal extends ConsumerStatefulWidget {
  const KeyReveal({super.key, required this.keyShown, required this.builder, this.animate = true, this.haptic = true});

  /// The key is on screen now: the reveal starts the first time this is true.
  final bool keyShown;
  final bool animate;

  /// One light haptic as the fill lands. Off where the server's acknowledgement already gave one.
  final bool haptic;
  final Widget Function(BuildContext context, Animation<double>? reveal) builder;

  @override
  ConsumerState<KeyReveal> createState() => _KeyRevealState();
}

class _KeyRevealState extends ConsumerState<KeyReveal> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: KeyRevealTiming.total);
  bool _played = false;
  bool _ticked = false;

  /// The pick was already on screen before the key came (a failed call, then the key): only the
  /// key's part plays, so the pick never blinks.
  bool _pickShownFirst = false;

  @override
  void initState() {
    super.initState();
    _pickShownFirst = !widget.keyShown;
    _t.addListener(_tick);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _maybeStart();
  }

  @override
  void didUpdateWidget(KeyReveal old) {
    super.didUpdateWidget(old);
    _maybeStart();
  }

  void _maybeStart() {
    if (_played || !widget.keyShown) return;
    _played = true;
    if (!widget.animate || Motion.reduced(context)) {
      _t.value = 1;
      _ticked = true;
    } else {
      _t.forward(from: _pickShownFirst ? KeyRevealTiming.yourWordEnd : 0);
    }
  }

  void _tick() {
    if (_ticked || _t.value < KeyRevealTiming.strokeEnd) return;
    _ticked = true;
    if (widget.haptic) ref.read(hapticsProvider).tick();
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, _played ? _t : null);
}

/// The outline of an option drawing round, on the option's own shape.
class _OutlineDraw extends CustomPainter {
  _OutlineDraw({required this.progress, required this.color}) : super(repaint: progress);

  final Animation<double> progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final t = KeyRevealTiming.window(progress.value, KeyRevealTiming.strokeStart, KeyRevealTiming.strokeEnd);
    // Once drawn, the option's own 2 px border takes over (the same line, so nothing jumps).
    if (t <= 0 || progress.value >= KeyRevealTiming.strokeEnd) return;
    final path = mmShapeBorder(MmRadius.keyAll).getOuterPath((Offset.zero & size).deflate(1));
    canvas.drawPath(
      mmPathPrefix(path, Motion.inOut.transform(t)),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(_OutlineDraw old) => old.progress != progress || old.color != color;
}

/// One option row with its mark.
class MarkedOption extends StatelessWidget {
  const MarkedOption({super.key, required this.letter, required this.text, this.mark = OptionMark.none, this.reveal, this.word});

  final String letter;
  final String text;
  final OptionMark mark;

  /// The tag's words in place of "Your answer" / "Correct answer" (the repair's check says "Key",
  /// "Your pick" and "Your pick and the key"). Null keeps the review's own words.
  final String? word;

  /// The key reveal's clock, or null for the final state.
  final Animation<double>? reveal;

  @override
  Widget build(BuildContext context) {
    final r = reveal;
    if (r == null || mark == OptionMark.none) return _paint(context, 1);
    return AnimatedBuilder(animation: r, builder: (context, _) => _paint(context, r.value));
  }

  Widget _paint(BuildContext context, double t) {
    final colors = context.mmColors;
    final type = context.mmType;
    // One loud row: the correct answer, in a strong 2 px ink outline on the selected surface (lifted
    // on Night; Day keeps its white, since its raised2 is darker than the page). Your wrong
    // answer is quiet: the same hairline as the others, with its cross and its words doing the
    // work, so the two never shout at once.
    // Mid-reveal the key reads as a plain option until its outline has drawn round.
    final keyLanded = t >= KeyRevealTiming.strokeEnd;
    final (fill, border, bubble, markWord) = switch (mark) {
      OptionMark.yours => (colors.raised, colors.line, BubbleState.wrong, ReviewCopy.yourAnswer),
      OptionMark.correct when !keyLanded => (colors.raised, colors.line, BubbleState.hollow, ReviewCopy.correctAnswer),
      OptionMark.correct => (selectedSurfaceOf(colors), colors.ink, BubbleState.filled, ReviewCopy.correctAnswer),
      OptionMark.none => (colors.raised, colors.line, BubbleState.hollow, null),
    };
    final word = this.word ?? markWord;
    final wordOpacity = switch (mark) {
      OptionMark.yours => KeyRevealTiming.window(t, KeyRevealTiming.yourWordStart, KeyRevealTiming.yourWordEnd),
      OptionMark.correct => KeyRevealTiming.window(t, KeyRevealTiming.keyWordStart, 1),
      OptionMark.none => 1.0,
    };
    final drop = mark == OptionMark.yours
        ? KeyRevealTiming.settle * (1 - Motion.out.transform(KeyRevealTiming.window(t, 0, KeyRevealTiming.settleEnd)))
        : 0.0;
    final strong = mark == OptionMark.correct && keyLanded;
    // The key's surface and words warm in over the landing window rather than in one frame.
    final land = strong ? Motion.out.transform(KeyRevealTiming.window(t, KeyRevealTiming.strokeEnd, KeyRevealTiming.landEnd)) : 0.0;
    final surface = strong ? Color.lerp(colors.raised, fill, land)! : fill;
    final textColor = strong ? Color.lerp(colors.ink2, colors.ink, land)! : colors.ink2;
    final drawing = mark == OptionMark.correct && reveal != null && !keyLanded;
    final box = DecoratedBox(
        decoration: ShapeDecoration(
          color: surface,
          shape: mmShapeBorder(
            MmRadius.keyAll,
            side: BorderSide(color: border, width: strong ? 2 : 1),
          ),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.option),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: MmSpace.s2),
                  child: SizedBox.square(
                    dimension: 22,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Bubble(state: bubble, size: 22, animate: reveal != null && mark == OptionMark.correct),
                        if (bubble == BubbleState.hollow)
                          Text(letter, style: type.label.copyWith(fontSize: 11, height: 1, color: colors.ink2)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(text, style: type.body.copyWith(color: textColor, fontWeight: strong ? FontWeight.w600 : null)),
                      if (word != null) ...[
                        const SizedBox(height: MmSpace.s4),
                        // The word's line is always laid out, so the row never grows mid-reveal.
                        Opacity(
                          opacity: wordOpacity,
                          child: Text(word, style: type.label.copyWith(color: mark == OptionMark.yours ? colors.badText : colors.ink)),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    return Semantics(
      container: true,
      label: 'Option $letter, $text${word == null ? '' : ', $word'}',
      excludeSemantics: true,
      child: Transform.translate(
        offset: Offset(0, -drop),
        child: drawing ? CustomPaint(foregroundPainter: _OutlineDraw(progress: reveal!, color: colors.ink), child: box) : box,
      ),
    );
  }
}

/// A reading passage, folded to a few lines until opened.
class PassageBlock extends StatefulWidget {
  const PassageBlock({super.key, required this.text});

  final String text;

  @override
  State<PassageBlock> createState() => _PassageBlockState();
}

class _PassageBlockState extends State<PassageBlock> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.sunken,
        shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: colors.line)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s8, MmSpace.s12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(ReviewCopy.passage, style: type.label.copyWith(color: colors.ink2)),
                ),
                IconButton(
                  onPressed: () => setState(() => _open = !_open),
                  tooltip: _open ? 'Fold the passage' : 'Open the passage',
                  icon: AnimatedRotation(
                    turns: _open ? 0.5 : 0,
                    duration: Motion.of(context, Motion.ui),
                    child: Icon(LucideIcons.chevronDown, size: 20, color: colors.ink2),
                  ),
                ),
              ],
            ),
            // The size snaps (no layout animation inside a scrolling list).
            Padding(
                padding: const EdgeInsets.only(right: MmSpace.s8),
                child: Text(
                  widget.text,
                  style: type.body.copyWith(color: colors.ink),
                  maxLines: _open ? null : 4,
                  overflow: _open ? TextOverflow.visible : TextOverflow.fade,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
