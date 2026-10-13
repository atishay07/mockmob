import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/domain/domain.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/recap_model.dart';
import '../model/recap_variant.dart';
import '../result_nav.dart';
import 'card_page.dart';

/// Card 3 (spec 5.6.3): one chapter to start with, from the observed chapter breakdown of this
/// mock (never from a forecast). Every claim carries its evidence: the counts, and the question
/// tiles that open those exact answers.
class FirstFixCard extends StatelessWidget {
  const FirstFixCard({super.key, required this.model, required this.onNext, required this.onBack});

  final RecapModel model;
  final VoidCallback onNext;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final m = model;
    final leader = m.chapters.leader;
    final lower = m.variant == RecapVariant.lower;
    final blanksOnly = m.chapters.leaderIsBlanksOnly;

    final String title;
    final List<Widget> evidence;
    final List<(int, BubbleState)> tiles;
    if (leader != null && blanksOnly) {
      title = ResultCopy.startWithBlanks(leader.chapter);
      evidence = [_Line(ResultCopy.blanksEvidence(leader.unattempted, leader.questions))];
      tiles = [for (final n in leader.blankNumbers) (n, BubbleState.blank)];
    } else if (leader != null) {
      title = ResultCopy.startWith(leader.chapter);
      evidence = [_Line(ResultCopy.costMost), const SizedBox(height: MmSpace.s12), _Counts(stat: leader)];
      tiles = [
        ...[for (final n in leader.wrongNumbers) (n, BubbleState.wrong)],
        ...[for (final n in leader.blankNumbers) (n, BubbleState.blank)],
      ]..sort((a, b) => a.$1.compareTo(b.$1));
    } else if (m.chapters.wrongNumbers.isNotEmpty) {
      title = ResultCopy.startWithWrong;
      evidence = [_Line(ResultCopy.wrongByNumber(m.chapters.wrongNumbers.length))];
      tiles = [for (final n in m.chapters.wrongNumbers) (n, BubbleState.wrong)];
    } else {
      title = ResultCopy.nothingToFix;
      evidence = [_Line(ResultCopy.everyAnswerRight)];
      tiles = const [];
    }

    final primary = switch ((leader, blanksOnly)) {
      (final l?, true) => KeyButton(
        label: ResultCopy.practiseChapter,
        onPressed: () => context.go(ResultNav.practiseChapter(m, l.chapter)),
      ),
      _ when tiles.isEmpty => KeyButton(label: ResultCopy.nextWhatsNext, onPressed: onNext),
      _ => KeyButton(label: ResultCopy.nextChoose, onPressed: onNext),
    };

    return RecapCardPage(
      onNext: onNext,
      onBack: onBack,
      topPadding: lower ? MmSpace.s32 : MmSpace.s8,
      // One Mobi per recap, and it lives on card 4.
      footer: primary,
      children: [
        _Header(subjectId: m.subjectId),
        Semantics(header: true, child: Text(title, style: context.mmType.moment)),
        if (tiles.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s4),
          Align(
            alignment: Alignment.centerLeft,
            child: ShowMePill(
              semanticsLabel: ResultCopy.showMeQuestions,
              marks: [for (final (_, s) in tiles.take(3)) s],
              onTap: () => ResultNav.toFullResult(context, m.attemptId, question: tiles.first.$1),
            ),
          ),
          const SizedBox(height: MmSpace.s8),
        ] else
          const SizedBox(height: MmSpace.s16),
        ...evidence,
        if (tiles.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s24),
          Text(
            leader == null ? ResultCopy.yourWrongAnswers : ResultCopy.yourAnswersHere,
            style: context.mmType.label.copyWith(color: context.mmColors.ink2),
          ),
          const SizedBox(height: MmSpace.s8),
          // Six to a row across the full width, so no number is left alone on a row of its own
          // unless the count says so.
          LayoutBuilder(
            builder: (context, constraints) {
              final width = (constraints.maxWidth - 5 * MmSpace.s8) / 6;
              return Wrap(
                spacing: MmSpace.s8,
                runSpacing: MmSpace.s8,
                children: [
                  for (final (n, s) in tiles)
                    _QuestionTile(
                      number: n,
                      state: s,
                      width: width,
                      onTap: () => ResultNav.toFullResult(context, m.attemptId, question: n),
                    ),
                ],
              );
            },
          ),
        ],
        if (leader != null && !blanksOnly) ...[
          const SizedBox(height: MmSpace.s20),
          Align(
            alignment: Alignment.centerRight,
            child: KeyButton.quiet(label: ResultCopy.whyThis, onPressed: () => _why(context, leader)),
          ),
        ],
      ],
    );
  }

  void _why(BuildContext context, ChapterStat stat) {
    showMmSheet<void>(
      context: context,
      title: ResultCopy.whyTitle,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s24),
        child: Text(ResultCopy.whyBody(stat.wrong, stat.unattempted), style: context.mmType.body),
      ),
    );
  }
}

/// The subject's light, pooled softly behind the top of the card: environment only, no object
/// (the book belongs to Today). The headline starts 24 dp under the story bar.
class _Header extends StatelessWidget {
  const _Header({required this.subjectId});

  final String subjectId;

  @override
  Widget build(BuildContext context) {
    final light = SubjectLight.forSubject(subjectId == 'gat' ? 'general_test' : subjectId);
    return SizedBox(
      height: MmSpace.s24,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          if (light != null)
            Positioned(
              right: -60,
              top: -80,
              width: 280,
              height: 240,
              child: IgnorePointer(
                child: LightField(
                  pools: [LightPool(color: light.of(Theme.of(context).brightness), center: Alignment.center, radius: 0.5, strength: 0.8)],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Text(text, style: context.mmType.body.copyWith(color: context.mmColors.ink2));
}

/// Wrong and not attempted always shown apart, each with its own bubble.
class _Counts extends StatelessWidget {
  const _Counts({required this.stat});

  final ChapterStat stat;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    Widget cell(BubbleState? s, int n, String label) => Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (s != null) ...[Bubble(state: s, size: 12, animate: false), const SizedBox(width: 6)],
              Text('$n', style: type.figureCompact.copyWith(fontSize: 34, height: 1)),
            ],
          ),
          const SizedBox(height: 2),
          Text(label, style: type.caption.copyWith(color: colors.ink3)),
        ],
      ),
    );
    return Semantics(
      label: ResultCopy.chapterCounts(stat.questions, stat.correct, stat.wrong, stat.unattempted),
      excludeSemantics: true,
      child: Row(
        children: [
          cell(null, stat.questions, 'questions'),
          cell(BubbleState.filled, stat.correct, 'correct'),
          cell(BubbleState.wrong, stat.wrong, 'wrong'),
          cell(BubbleState.blank, stat.unattempted, 'not attempted'),
        ],
      ),
    );
  }
}

class _QuestionTile extends StatelessWidget {
  const _QuestionTile({required this.number, required this.state, required this.onTap, this.width = 52});

  final int number;
  final BubbleState state;
  final VoidCallback onTap;
  final double width;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final word = state == BubbleState.wrong ? ResultCopy.statusWrong.toLowerCase() : ResultCopy.statusBlank.toLowerCase();
    return MmPressable(
      onTap: onTap,
      focusRadius: MmRadius.smallAll,
      semanticsLabel: ResultCopy.questionTile(number, word),
      builder: (context, pressed, _) => Container(
        width: width,
        height: 60,
        decoration: ShapeDecoration(
          color: pressed ? colors.raised2 : colors.raised,
          shape: RoundedSuperellipseBorder(
            borderRadius: MmRadius.smallAll,
            side: BorderSide(color: colors.line),
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Bubble(state: state, size: 16, animate: false),
            const SizedBox(height: 4),
            Text('$number', style: type.label.copyWith(color: colors.ink2)),
          ],
        ),
      ),
    );
  }
}
