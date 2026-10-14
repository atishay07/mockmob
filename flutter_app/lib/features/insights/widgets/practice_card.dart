import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/practice_question.dart';
import '../data/subject_names.dart';

String difficultyWord(String? d) => switch (d) {
      'easy' => InsightsCopy.easy,
      'medium' => InsightsCopy.medium,
      'hard' => InsightsCopy.hard,
      _ => '',
    };

/// "Accountancy, Partnership, Medium".
String questionMeta(PracticeQuestion q) =>
    [subjectDisplayName(q.subject), if (q.chapter.isNotEmpty) q.chapter, if (difficultyWord(q.difficulty).isNotEmpty) difficultyWord(q.difficulty)].join(', ');

/// An untimed practice question: solid ground, no art, the options fill like a bubble when
/// chosen and the answer shows at once (these surfaces are practice, never a mock).
class PracticeCard extends ConsumerWidget {
  const PracticeCard({super.key, required this.question, required this.picked, required this.onPick});

  final PracticeQuestion question;

  /// The option chosen, or null before an answer.
  final String? picked;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final q = question;
    final revealed = picked != null;
    final passage = q.passageText?.trim();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(questionMeta(q), style: type.caption.copyWith(color: colors.ink3)),
        const SizedBox(height: MmSpace.s8),
        if (passage != null && passage.isNotEmpty) ...[_Passage(text: passage), const SizedBox(height: MmSpace.s16)],
        Text(q.body, style: type.question),
        const SizedBox(height: MmSpace.s16),
        if (!q.hasUsableKey) ...[
          InlineBanner(message: InsightsCopy.noKey, tone: BannerTone.warning),
          const SizedBox(height: MmSpace.s12),
        ],
        for (var i = 0; i < q.options.length; i++) ...[
          if (i > 0) const SizedBox(height: MmSpace.s8),
          // With no usable key nothing here can be picked: dim the options so they do not read as live.
          Opacity(
            opacity: q.hasUsableKey ? 1 : 0.55,
            child: _OptionTile(
            option: q.options[i],
            mark: _markFor(q.options[i].key),
            onTap: revealed || !q.hasUsableKey
                ? null
                : () {
                    ref.read(hapticsProvider).tick();
                    onPick(q.options[i].key);
                  },
            ),
          ),
        ],
        if (revealed) ...[const SizedBox(height: MmSpace.s20), _Reveal(question: q, picked: picked!)],
      ],
    );
  }

  _Mark _markFor(String key) {
    if (picked == null) return _Mark.open;
    if (key == question.correctKey) return key == picked ? _Mark.right : _Mark.key;
    if (key == picked) return _Mark.wrong;
    return _Mark.dim;
  }
}

enum _Mark { open, right, wrong, key, dim }

class _OptionTile extends StatelessWidget {
  const _OptionTile({required this.option, required this.mark, required this.onTap});

  final PqOption option;
  final _Mark mark;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final (fill, border, bubble, word) = switch (mark) {
      _Mark.right => (colors.raised, colors.isNight ? colors.ink2 : colors.ink, BubbleState.filled, 'Your answer, correct'),
      _Mark.wrong => (colors.wrongSurface, colors.wrongBorder, BubbleState.wrong, 'Your answer'),
      _Mark.key => (colors.raised, colors.isNight ? colors.ink2 : colors.ink, BubbleState.filled, 'Correct answer'),
      _Mark.dim || _Mark.open => (colors.raised, colors.line, BubbleState.hollow, null),
    };
    final textColor = switch (mark) {
      _Mark.wrong => colors.wrongText,
      _Mark.dim => colors.ink3,
      _Mark.open => colors.ink,
      _ => colors.ink,
    };
    return MmPressable(
      onTap: onTap,
      focusRadius: MmRadius.keyAll,
      semanticsLabel: 'Option ${option.key}, ${option.text}${word == null ? '' : ', $word'}',
      excludeSemantics: true,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: Motion.of(context, Motion.ui),
        curve: Motion.glide,
        constraints: const BoxConstraints(minHeight: MmTarget.option),
        decoration: ShapeDecoration(
          color: pressed && onTap != null ? colors.raised2 : fill,
          shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: border, width: mark == _Mark.open || mark == _Mark.dim ? 1 : 1.5)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox.square(
              dimension: 24,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Bubble(state: bubble, size: 24),
                  if (bubble == BubbleState.hollow) Text(option.key, style: type.label.copyWith(fontSize: 11, height: 1, color: colors.ink2)),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(option.text, style: type.body.copyWith(color: textColor)),
                  if (word != null) ...[
                    const SizedBox(height: 4),
                    Text(word, style: type.label.copyWith(color: mark == _Mark.wrong ? colors.wrongText : colors.ink)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The verdict and the explanation, rising in once.
class _Reveal extends StatefulWidget {
  const _Reveal({required this.question, required this.picked});

  final PracticeQuestion question;
  final String picked;

  @override
  State<_Reveal> createState() => _RevealState();
}

class _RevealState extends State<_Reveal> with SingleTickerProviderStateMixin {
  late final AnimationController _in = AnimationController(vsync: this, duration: const Duration(milliseconds: 220));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _in.value = 1;
    } else if (_in.status == AnimationStatus.dismissed) {
      _in.forward();
    }
  }

  @override
  void dispose() {
    _in.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final q = widget.question;
    final right = widget.picked == q.correctKey;
    final explanation = q.explanation?.trim();
    final curved = CurvedAnimation(parent: _in, curve: Motion.glide);
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween(begin: const Offset(0, 0.06), end: Offset.zero).animate(curved),
        child: Semantics(
          liveRegion: true,
          child: DecoratedBox(
            decoration: ShapeDecoration(
              color: colors.sunken,
              shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(MmSpace.cardPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Mobi reacts beside the verdict: a nod for a right answer, a lean in with warm
                  // eyes for a wrong one. The stream is untimed, so a reaction never distracts a
                  // mock, and the face does not follow taps.
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Text(
                          right ? InsightsCopy.correct : InsightsCopy.answerIs(q.correctKey ?? '', _keyText(q)),
                          style: type.cardTitle.copyWith(color: right ? colors.ink : colors.wrongText),
                        ),
                      ),
                      const SizedBox(width: MmSpace.s8),
                      MobiFace(
                        size: 44,
                        entrance: MobiMoments.act(right ? MobiEvent.rightAnswer : MobiEvent.wrongAnswer),
                        watchTaps: false,
                        seed: 31 + q.id.hashCode % 7,
                      ),
                    ],
                  ),
                  const SizedBox(height: MmSpace.s12),
                  Text(InsightsCopy.explanation, style: type.label.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s4),
                  Text(
                    explanation == null || explanation.isEmpty ? InsightsCopy.noExplanation : explanation,
                    style: type.body.copyWith(color: explanation == null || explanation.isEmpty ? colors.ink3 : colors.ink),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

String _keyText(PracticeQuestion q) {
  for (final o in q.options) {
    if (o.key == q.correctKey) return o.text.trim().length <= 60 ? o.text.trim() : '';
  }
  return '';
}

class _Passage extends StatefulWidget {
  const _Passage({required this.text});

  final String text;

  @override
  State<_Passage> createState() => _PassageState();
}

class _PassageState extends State<_Passage> {
  bool _open = false;

  static const int _foldedLines = 5;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: () => setState(() => _open = !_open),
      focusRadius: MmRadius.keyAll,
      pressedScale: 1,
      semanticsLabel: _open ? 'Passage, open. Tap to fold' : 'Passage, folded. Tap to read all of it',
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(color: colors.sunken, shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: colors.line))),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s16),
          child: LayoutBuilder(
            builder: (context, box) {
              final probe = TextPainter(
                text: TextSpan(text: widget.text, style: type.body),
                textDirection: Directionality.of(context),
                textScaler: MediaQuery.textScalerOf(context),
                maxLines: _foldedLines,
              )..layout(maxWidth: box.maxWidth);
              final overflows = probe.didExceedMaxLines;
              probe.dispose();
              final body = Text(widget.text, style: type.body, maxLines: _open || !overflows ? null : _foldedLines, overflow: TextOverflow.clip);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(InsightsCopy.passage, style: type.label.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s6),
                  // Folded and long: the last lines fade out so the cut reads as "more below".
                  if (overflows && !_open)
                    ShaderMask(
                      blendMode: BlendMode.dstIn,
                      shaderCallback: (rect) => const LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0xFFFFFFFF), Color(0xFFFFFFFF), Color(0x00FFFFFF)],
                        stops: [0, 0.6, 1],
                      ).createShader(rect),
                      child: body,
                    )
                  else
                    body,
                  if (overflows)
                    ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 32),
                      child: Row(
                        children: [
                          Text(_open ? InsightsCopy.passageFold : InsightsCopy.passageReadAll, style: type.label.copyWith(color: colors.ink)),
                          const SizedBox(width: MmSpace.s4),
                          ExcludeSemantics(child: Icon(_open ? LucideIcons.chevronUp : LucideIcons.chevronDown, size: 16, color: colors.ink)),
                        ],
                      ),
                    ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
