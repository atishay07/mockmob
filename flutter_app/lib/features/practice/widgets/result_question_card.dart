import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/question.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/ask_mobi.dart' show AskMobiLink, askMobiAboutLabel;
import '../copy.dart';
import '../result_copy.dart';
import '../model/practice_result_model.dart';
import 'surface_roles.dart';

/// How a not-attempted question is being shown: hidden answer, a private try, or the answer.
enum BlankMode { question, trying, answer }

/// One row of the practice result: a collapsed header (number, verdict in words, chapter) that
/// opens to the question, the options with the student's choice and, where the key rule of spec
/// 5.7 allows it, the correct option and the explanation. Rows are separated by hairlines, not
/// wrapped in cards.
class ResultQuestionRow extends StatelessWidget {
  const ResultQuestionRow({
    super.key,
    required this.item,
    required this.keyView,
    required this.expanded,
    required this.onToggle,
    this.blankMode = BlankMode.question,
    this.tried,
    this.onTry,
    this.onShowAnswer,
    this.onTryPick,
    this.save,
    this.report,
    this.time,
    this.changed = false,
    this.summary,
    this.summarySemantics,
    this.repair,
    this.onAsk,
  });

  final ResultQuestion item;

  /// "Ask Mobi about Q4": the one quiet line under a wrong answer's action (the full result's rows carry the same
  /// line). Null for right and blank answers, and while the question is not on the phone.
  final VoidCallback? onAsk;

  /// The closed face of the row when the result draws it as a mistake (`MistakeSummary`); null keeps the plain face.
  final Widget? summary;
  final String? summarySemantics;

  /// The repair entry under an opened mistake, after its options and explanation.
  final Widget? repair;

  /// "Report a problem" under an open question, or null.
  final Widget? report;

  /// Time on this question ("42s"), only when the session's timing is trustworthy.
  final String? time;

  /// The student changed this answer during the session (self-reported telemetry only).
  final bool changed;
  final KeyView keyView;
  final bool expanded;
  final VoidCallback onToggle;

  /// The Save key under an open question, or null where saving is not offered.
  final Widget? save;

  /// Not-attempted rows only.
  final BlankMode blankMode;
  final int? tried;
  final VoidCallback? onTry;
  final VoidCallback? onShowAnswer;
  final ValueChanged<int>? onTryPick;

  String get _status => switch (item.verdict) {
    Verdict.correct => PracticeCopy.statusCorrect,
    Verdict.wrong => PracticeCopy.statusWrong,
    Verdict.blank => PracticeCopy.statusBlank,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final header = Semantics(
      expanded: expanded,
      child: MmPressable(
        onTap: onToggle,
        semanticsLabel: summarySemantics ?? [
          '${PracticeCopy.questionNumber(item.number)}, $_status',
          ?item.chapter,
          if (time != null) ResultCopy.timeSemantics(time!),
          if (changed) ResultCopy.answerChanged,
        ].join(', '),
        focusRadius: MmRadius.keyAll,
        pressedScale: 0.985,
        haptic: MmPressHaptic.selection,
        highlight: true,
        builder: (context, pressed, _) => summary ?? ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 60),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4, vertical: MmSpace.s12),
            child: Row(
              children: [
                QuestionStrip(cells: [item.cell], columns: 1, cellSize: 22, gap: 0),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${PracticeCopy.questionNumber(item.number)}, $_status', style: type.cardTitle.copyWith(fontSize: 16)),
                      if (item.chapter != null) Text(item.chapter!, style: type.small.copyWith(color: colors.ink2)),
                      if (time != null || changed)
                        Text(
                          [
                            if (time != null) ResultCopy.timeOn(time!),
                            if (changed) (time == null ? ResultCopy.answerChanged : ResultCopy.answerChanged.toLowerCase()),
                          ].join(', '),
                          style: type.caption.copyWith(color: colors.ink2),
                        ),
                    ],
                  ),
                ),
                ExcludeSemantics(child: Icon(expanded ? LucideIcons.chevronUp : LucideIcons.chevronDown, size: 20, color: colors.ink3)),
              ],
            ),
          ),
        ),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        header,
        if (expanded)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s4, MmSpace.s4, MmSpace.s20),
            child: _Body(
              item: item,
              keyView: keyView,
              blankMode: blankMode,
              tried: tried,
              onTry: onTry,
              onShowAnswer: onShowAnswer,
              onTryPick: onTryPick,
            ),
          ),
        // The mistake's one action, then (once) the quiet Ask Mobi line under it. Nothing else here asks.
        if (expanded && (repair != null || onAsk != null))
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s4, 0, MmSpace.s4, MmSpace.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ?repair,
                if (repair != null && onAsk != null) const SizedBox(height: MmSpace.s4),
                if (onAsk != null) AskMobiLink(label: askMobiAboutLabel(item.number), onTap: onAsk!),
              ],
            ),
          ),
        if (expanded && item.question != null && (save != null || report != null))
          Padding(
            padding: const EdgeInsets.only(bottom: MmSpace.s12),
            child: Wrap(spacing: MmSpace.s8, children: [?save, ?report]),
          ),
      ],
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({
    required this.item,
    required this.keyView,
    required this.blankMode,
    this.tried,
    this.onTry,
    this.onShowAnswer,
    this.onTryPick,
  });

  final ResultQuestion item;
  final KeyView keyView;
  final BlankMode blankMode;
  final int? tried;
  final VoidCallback? onTry;
  final VoidCallback? onShowAnswer;
  final ValueChanged<int>? onTryPick;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final q = item.question;
    if (q == null) return Text(PracticeCopy.keysUnavailable, style: type.body.copyWith(color: colors.ink2));

    final isBlank = item.verdict == Verdict.blank;
    final showKey =
        keyView.state == KeyState.ready &&
        keyView.keyIndex != null &&
        (!isBlank || blankMode != BlankMode.question) &&
        (blankMode != BlankMode.trying || tried != null);
    final trying = isBlank && blankMode == BlankMode.trying;
    final given = isBlank ? tried : item.givenIndex;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (q.passageText != null && q.passageText!.isNotEmpty) ...[
          Text(q.passageText!, style: type.small.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s12),
        ],
        Text(q.question, style: type.question),
        if (distinctBody(q.question, q.body) case final body?) ...[const SizedBox(height: MmSpace.s8), Text(body, style: type.body)],
        const SizedBox(height: MmSpace.s16),
        if (isBlank && blankMode == BlankMode.question)
          Padding(
            padding: const EdgeInsets.only(bottom: MmSpace.s12),
            child: Text(PracticeCopy.notAnswered, style: type.body.copyWith(color: colors.ink2)),
          ),
        for (var j = 0; j < q.options.length; j++)
          Padding(
            padding: const EdgeInsets.only(bottom: MmSpace.s8),
            child: trying && tried == null
                ? KeyButton.option(
                    label: q.options[j].text,
                    selected: false,
                    leading: _Letter(q.options[j].key),
                    onPressed: () => onTryPick?.call(j),
                  )
                : OptionLine(
                    option: q.options[j],
                    isGiven: given == j,
                    isKey: showKey && keyView.keyIndex == j,
                    givenWrong: given == j && showKey && keyView.keyIndex != j,
                    givenLabel: trying ? PracticeCopy.yourTry : PracticeCopy.yourAnswer,
                  ),
          ),
        _Footer(item: item, keyView: keyView, showKey: showKey, trying: trying, tried: tried, onTry: onTry, onShowAnswer: onShowAnswer),
      ],
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({
    required this.item,
    required this.keyView,
    required this.showKey,
    required this.trying,
    this.tried,
    this.onTry,
    this.onShowAnswer,
  });

  final ResultQuestion item;
  final KeyView keyView;
  final bool showKey;
  final bool trying;
  final int? tried;
  final VoidCallback? onTry;
  final VoidCallback? onShowAnswer;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final isBlank = item.verdict == Verdict.blank;
    final children = <Widget>[];

    if (keyView.state == KeyState.loading) {
      children.add(const SkeletonGroup(label: PracticeCopy.loadingAnswers, child: Skeleton.line(width: 200)));
    } else if (keyView.state == KeyState.held) {
      children.add(Text(PracticeCopy.keyHeld, style: type.body.copyWith(color: colors.ink2)));
    } else if (keyView.state == KeyState.unavailable) {
      children.add(Text(PracticeCopy.keysUnavailable, style: type.body.copyWith(color: colors.ink2)));
    } else if (isBlank && !showKey && !trying) {
      children.add(
        Wrap(
          spacing: MmSpace.s8,
          runSpacing: MmSpace.s8,
          children: [
            KeyButton.secondary(label: PracticeCopy.tryAgain, expanded: false, minHeight: 48, onPressed: onTry),
            KeyButton.quiet(label: PracticeCopy.seeAnswer, onPressed: onShowAnswer),
          ],
        ),
      );
    }

    if (trying && tried != null) {
      final right = keyView.keyIndex == tried;
      children.add(
        Semantics(
          liveRegion: true,
          child: Text(
            keyView.keyIndex == null ? PracticeCopy.tryNoKey : (right ? PracticeCopy.tryRight : PracticeCopy.tryWrong),
            style: type.subhead.copyWith(fontSize: 16),
          ),
        ),
      );
    }
    if (trying) {
      children.add(
        Padding(
          padding: const EdgeInsets.only(top: MmSpace.s4),
          child: Text(PracticeCopy.tryNote, style: type.small.copyWith(color: colors.ink3)),
        ),
      );
    }

    final explanation = showKey ? keyView.explanation : null;
    if (explanation != null && explanation.isNotEmpty) {
      children
        ..add(const SizedBox(height: MmSpace.s16))
        ..add(
          Semantics(
            header: true,
            child: Text(PracticeCopy.explanation, style: type.label.copyWith(color: colors.ink2)),
          ),
        )
        ..add(const SizedBox(height: MmSpace.s4))
        ..add(Text(explanation, style: type.body));
    }
    if (children.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: children);
  }
}

class _Letter extends StatelessWidget {
  const _Letter(this.letter, {this.state = BubbleState.hollow});

  final String letter;
  final BubbleState state;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final inked = state == BubbleState.filled;
    final wrong = state == BubbleState.wrong;
    return Container(
      width: 28,
      height: 28,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: inked ? colors.volt : (wrong ? colors.wrongBorder : Colors.transparent),
        border: Border.all(color: inked ? colors.volt : (wrong ? colors.wrongBorder : colors.lineStrong), width: 1.5),
      ),
      child: Text(
        letter,
        style: context.mmType.label.copyWith(
          color: inked ? colors.voltInk : (wrong ? (colors.isNight ? colors.wrongText : colors.wrongSurface) : colors.ink2),
        ),
      ),
    );
  }
}

/// One option as a read-only line. The student's answer and the correct answer are marked with
/// a glyph and words, never colour alone: a wrong choice gets the wrong trio plus a cross, the
/// correct option an ink border plus a check.
class OptionLine extends StatelessWidget {
  const OptionLine({
    super.key,
    required this.option,
    required this.isGiven,
    required this.isKey,
    required this.givenWrong,
    required this.givenLabel,
  });

  final QuestionOption option;
  final bool isGiven;
  final bool isKey;
  final bool givenWrong;
  final String givenLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final marked = isGiven || isKey;
    // The answer is the selected surface with a 2 dp ink ring and the volt letter, the same weight
    // on Night and Day (SPACING.md 8.1); a wrong pick keeps the wrong roles; the rest stay flat on
    // the page.
    final Color fill = givenWrong ? colors.wrongSurface : (marked ? selectedSurface(colors) : colors.ground);
    final Color border = givenWrong ? colors.wrongBorder : (marked ? colors.ink : colors.line);
    final tag = switch ((isGiven, isKey)) {
      (true, true) => '$givenLabel, the correct answer',
      (true, false) => givenLabel,
      (false, true) => PracticeCopy.correctAnswer,
      _ => null,
    };
    final glyph = givenWrong ? LucideIcons.x : (isKey ? LucideIcons.check : null);
    final textColor = givenWrong ? colors.wrongText : colors.ink;
    return Semantics(
      container: true,
      label: '${option.key}. ${option.text}${tag == null ? '' : '. $tag'}',
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: fill,
          shape: RoundedSuperellipseBorder(
            borderRadius: MmRadius.keyAll,
            side: BorderSide(color: border, width: marked ? 2 : 1),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Letter(option.key, state: givenWrong ? BubbleState.wrong : (isKey ? BubbleState.filled : BubbleState.hollow)),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(option.text, style: type.body.copyWith(color: textColor)),
                    if (tag != null) ...[const SizedBox(height: MmSpace.s4), Text(tag, style: type.label.copyWith(color: textColor))],
                  ],
                ),
              ),
              if (glyph != null) ...[const SizedBox(width: MmSpace.s8), Icon(glyph, size: 20, color: textColor)],
            ],
          ),
        ),
      ),
    );
  }
}
