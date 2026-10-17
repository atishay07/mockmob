import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/models.dart' show LabLabels, LabOthers, TrapTag;
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/ask_mobi.dart' show AskMobiLink, askMobiAboutLabel;
import '../../insights/widgets/motion_bits.dart' show WhenInView;
import '../copy.dart';
import '../model/answer_items.dart';
import '../model/time_decisions.dart' show TimeCopy;
import '../widgets/trap_tag.dart';
import 'keep_numbers.dart';

/// One answer of the full result: a collapsed header (bubble, number, verdict in words, chapter)
/// that opens to the question, the options with the student's choice and, only where the key rule
/// allows, the correct option and the explanation. Solid and calm: the work layer.
class AnswerRow extends StatefulWidget {
  const AnswerRow({
    super.key,
    required this.item,
    required this.expanded,
    required this.onToggle,
    required this.keysOff,
    this.onRepair,
    this.onOpened,
    this.others,
    this.othersTitle,
    this.trap,
    this.summary,
    this.summarySemantics,
    this.repair,
    this.onAsk,
  });

  final AnswerItem item;

  /// The closed face of the row when the result draws it as a mistake (`MistakeSummary`); null keeps the plain face.
  final Widget? summary;
  final String? summarySemantics;

  /// The repair entry of an opened mistake, in place of the plain repair key (what a repair gives, its cost, or the
  /// saved repair).
  final Widget? repair;

  /// "Ask Mobi about Q7": a quiet second line under the repair of an opened mistake, never a second
  /// key on the closed row (ASK-MOBI-1018 3). Null shows nothing.
  final VoidCallback? onAsk;
  final bool expanded;
  final VoidCallback onToggle;

  /// `answerReviewState == 'unavailable'`, or the detail could not be read.
  final bool keysOff;
  final VoidCallback? onRepair;

  /// The row went from folded to open after the page was up (a tap on its header or on its
  /// bubble in the answer map), never for a row that arrived open. Called after the frame.
  final VoidCallback? onOpened;

  /// How other students answered this question (Mistake Lab, spec 4.3): the server's line and the
  /// picks per option in this paper's order. Null shows nothing.
  final LabOthers? others;

  /// The small label above it ("How others answered"), the server's word.
  final String? othersTitle;

  /// The trap the server named on the student's wrong option (Mistake Lab slice 4, spec 4.7), shown
  /// as one more row under that option. Null shows nothing.
  final TrapTag? trap;

  @override
  State<AnswerRow> createState() => _AnswerRowState();
}

class _AnswerRowState extends State<AnswerRow> {
  /// True once the student has opened this row by a tap. A row that is open when the page
  /// arrives (the first wrong answer, a linked question) rides the page's own entrance instead.
  bool _tapped = false;

  AnswerItem get item => widget.item;

  @override
  void didUpdateWidget(AnswerRow old) {
    super.didUpdateWidget(old);
    if (!old.expanded && widget.expanded) {
      _tapped = true;
      // After this frame: the callback drives other widgets (Mobi), which cannot be touched
      // while the tree is still building.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onOpened?.call();
      });
    }
  }

  String get _status => switch (item.verdict) {
    Verdict.correct => ResultCopy.statusCorrect,
    Verdict.wrong => ResultCopy.statusWrong,
    Verdict.blank => ResultCopy.statusBlank,
    Verdict.held => ResultCopy.statusHeld,
  };

  Widget _body() => _Body(
    item: item,
    keysOff: widget.keysOff,
    onRepair: widget.onRepair,
    repair: widget.repair,
    onAsk: widget.onAsk,
    // The counts say which option is right, so they follow the key rule: none while keys are off
    // or while the question's key is being checked.
    others: widget.keysOff || item.verdict == Verdict.held ? null : widget.others,
    othersTitle: widget.othersTitle,
    // A trap names the student's own wrong option: never on a right, blank or held answer, and never
    // while keys are off (the tag is a statement about the key).
    trap: widget.keysOff || item.verdict != Verdict.wrong ? null : widget.trap,
  );

  BubbleState get _bubble => switch (item.verdict) {
    Verdict.correct => BubbleState.filled,
    Verdict.wrong => BubbleState.wrong,
    Verdict.blank => BubbleState.blank,
    Verdict.held => BubbleState.marked,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chapter = item.question.chapter;
    final expanded = widget.expanded;
    final header = MmPressable(
      onTap: widget.onToggle,
      pressedScale: 0.985,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      semanticsLabel: widget.summarySemantics ?? '${ResultCopy.question(item.number)}, $_status${chapter == null ? '' : ', $chapter'}',
      selected: expanded,
      builder: (context, pressed, _) => widget.summary ?? ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 60),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
          child: Row(
            children: [
              Bubble(state: _bubble, size: 22, animate: false),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // The group header above already says wrong, not attempted, correct or being checked,
                    // and the bubble shows it, so the row names only its question. TalkBack still hears
                    // the verdict (semantics label above).
                    Text(ResultCopy.question(item.number), style: type.subhead.copyWith(fontSize: 16)),
                    if (chapter != null) Text(chapter, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              AnimatedRotation(
                turns: expanded ? 0.5 : 0,
                duration: Motion.of(context, Motion.ui),
                curve: Motion.out,
                child: Icon(LucideIcons.chevronDown, size: 20, color: colors.ink3),
              ),
            ],
          ),
        ),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        header,
        // The answer opens in place (no animated height in the scrolling list); after a tap its
        // body fades and rises into the space once, under its header.
        if (expanded)
          Padding(
            padding: const EdgeInsets.only(bottom: MmSpace.s20),
            child: _tapped ? MmEntrance(rise: 8, child: _body()) : _body(),
          ),
      ],
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.item, required this.keysOff, this.onRepair, this.repair, this.onAsk, this.others, this.othersTitle, this.trap});

  final AnswerItem item;
  final bool keysOff;
  final VoidCallback? onRepair;
  final Widget? repair;
  final VoidCallback? onAsk;
  final LabOthers? others;
  final String? othersTitle;
  final TrapTag? trap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final q = item.question;
    final note = item.verdict == Verdict.held
        ? ResultCopy.keyHeld
        : keysOff
        ? ResultCopy.keysOff
        : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (q.passageText != null && q.passageText!.trim().isNotEmpty) ...[
          // Nested in the answer: a sunken well, never a third border.
          MmSurface.inset(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(ResultCopy.passage, style: type.label.copyWith(color: colors.ink3)),
                const SizedBox(height: MmSpace.s4),
                Text(q.passageText!, style: type.body.copyWith(color: colors.ink2)),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s12),
        ],
        Text(q.question, style: type.question),
        if (q.body != null && q.body!.trim().isNotEmpty) ...[
          const SizedBox(height: MmSpace.s8),
          Text(q.body!, style: type.body.copyWith(color: colors.ink2)),
        ],
        if (others != null) ...[
          const SizedBox(height: MmSpace.s16),
          Text(othersTitle ?? const LabLabels().othersTitle, style: type.label.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s4),
          Text(others!.line, style: type.body.copyWith(fontSize: 15, height: 22 / 15, fontFeatures: const [FontFeature.tabularFigures()])),
          // Slice 5: time, changes and strike-outs, each only when the server sent it, in the second ink so the picks line stays first.
          for (final line in others!.lines) ...[
            const SizedBox(height: MmSpace.s4),
            Text(keepNumbersWithWords(line), style: type.body.copyWith(fontSize: 15, height: 22 / 15, color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
          ],
        ],
        const SizedBox(height: MmSpace.s12),
        _Options(item: item, keysOff: keysOff, others: others, trap: trap),
        if (item.verdict == Verdict.blank) ...[
          const SizedBox(height: MmSpace.s12),
          Text(ResultCopy.didNotAnswer, style: type.small.copyWith(color: colors.ink2)),
        ],
        // This question's own time and picks (the same words as the website). Without a record, the
        // plain "answer changed" line stays.
        if (item.timeLines.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s12),
          MmSurface.inset(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(TimeCopy.rowLabel, style: type.label.copyWith(color: colors.ink3)),
                for (final line in item.timeLines) ...[
                  const SizedBox(height: MmSpace.s4),
                  Text(line, style: type.small.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
                ],
              ],
            ),
          ),
        ] else if (item.changed) ...[
          const SizedBox(height: MmSpace.s8),
          Text(ResultCopy.changedAnswer, style: type.small.copyWith(color: colors.ink2)),
        ],
        if (note != null) ...[const SizedBox(height: MmSpace.s12), Text(note, style: type.small.copyWith(color: colors.ink2))],
        if (!keysOff && item.explanation != null && item.explanation!.trim().isNotEmpty) ...[
          const SizedBox(height: MmSpace.s16),
          Text(ResultCopy.explanation, style: type.label.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s4),
          Text(item.explanation!, style: type.body),
        ],
        if (repair != null) ...[
          const SizedBox(height: MmSpace.s16),
          repair!,
        ] else if (item.repaired) ...[
          const SizedBox(height: MmSpace.s12),
          ReceiptLine(text: ResultCopy.repaired),
        ] else if (onRepair != null) ...[
          const SizedBox(height: MmSpace.s16),
          KeyButton.secondary(label: ResultCopy.repairThis, onPressed: onRepair, expanded: false),
        ],
        if (onAsk != null) ...[
          const SizedBox(height: MmSpace.s4),
          AskMobiLink(label: askMobiAboutLabel(item.number), onTap: onAsk!),
        ],
      ],
    );
  }
}

/// The options of an opened answer. With [others] whose counts match the options, each option
/// also shows how many other students chose it and a 2 dp bar of that share, which grow from zero
/// when the answer comes into view (240 ms on the ease-out curve; the student's own option settles
/// 80 ms after the rest). Under reduced motion they are drawn at once.
class _Options extends StatefulWidget {
  const _Options({required this.item, required this.keysOff, this.others, this.trap});

  final AnswerItem item;
  final bool keysOff;
  final LabOthers? others;
  final TrapTag? trap;

  static const Duration grow = Motion.card;
  static const Duration mineLag = Duration(milliseconds: 80);

  @override
  State<_Options> createState() => _OptionsState();
}

class _OptionsState extends State<_Options> with SingleTickerProviderStateMixin {
  late final AnimationController _grow;
  bool _decided = false;

  @override
  void initState() {
    super.initState();
    _grow = AnimationController(vsync: this, duration: _Options.grow + _Options.mineLag, value: 1);
  }

  /// [_Options.others] when its counts line up with this question's options, else null.
  LabOthers? get _counted {
    final o = widget.others;
    return o != null && o.counts.length == widget.item.question.options.length ? o : null;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_decided) return;
    _decided = true;
    if (_counted != null && !Motion.reduced(context)) _grow.value = 0;
  }

  @override
  void dispose() {
    _grow.dispose();
    super.dispose();
  }

  void _onVisible() {
    if (!mounted || _grow.value >= 1) return;
    if (Motion.reduced(context)) {
      _grow.value = 1;
    } else {
      unawaited(_grow.forward());
    }
  }

  /// The eased growth of a bar: the rest over the first 240 ms, the student's own 80 ms later.
  Animation<double> _phase(bool mine) {
    final total = (_Options.grow + _Options.mineLag).inMicroseconds;
    final lag = _Options.mineLag.inMicroseconds / total;
    // `drive` listens to the controller only while a painter listens to it, so nothing is left
    // registered on the controller from one build to the next.
    return _grow.drive(CurveTween(curve: mine ? Interval(lag, 1, curve: Motion.out) : Interval(0, 1 - lag, curve: Motion.out)));
  }

  /// The trap shows on option [i] only when it is the student's own wrong pick and the tag's own
  /// index (and letter, when it names one) say the same option.
  TrapTag? _trapFor(int i) {
    final t = widget.trap;
    final item = widget.item;
    if (t == null || item.given != i || t.index != i) return null;
    if (t.letter.isNotEmpty && item.question.options[i].key != t.letter) return null;
    return t;
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final q = item.question;
    final others = _counted;
    final list = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < q.options.length; i++) ...[
          if (i > 0) const SizedBox(height: MmSpace.s8),
          _Option(
            letter: q.options[i].key,
            text: q.options[i].text,
            mine: item.given == i,
            mineWrong: item.given == i && item.verdict == Verdict.wrong,
            isKey: !widget.keysOff && item.keyIndex == i,
            count: others?.counts[i],
            share: others?.shareOf(i),
            othersLabel: others?.labelFor(i),
            grow: others == null ? null : _phase(item.given == i),
            trap: _trapFor(i),
          ),
        ],
      ],
    );
    return others == null ? list : WhenInView(onVisible: _onVisible, child: list);
  }
}

class _Option extends StatelessWidget {
  const _Option({
    required this.letter,
    required this.text,
    required this.mine,
    required this.mineWrong,
    required this.isKey,
    this.count,
    this.share,
    this.othersLabel,
    this.grow,
    this.trap,
  });

  final String letter;
  final String text;
  final bool mine;
  final bool mineWrong;
  final bool isKey;

  /// Other students who chose this option, and their share of all who answered (0 to 1).
  final int? count;
  final double? share;

  /// "Option C: chosen by 8 of 31 other students.", for a screen reader.
  final String? othersLabel;
  final Animation<double>? grow;

  /// The trap named on this option (the student's own wrong pick), one row under its text.
  final TrapTag? trap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final state = isKey ? BubbleState.filled : (mineWrong ? BubbleState.wrong : (mine ? BubbleState.marked : BubbleState.hollow));
    final tags = [if (mine) ResultCopy.yourAnswer, if (isKey) ResultCopy.correctAnswer];
    final border = isKey ? colors.ink2 : (mineWrong ? colors.wrongBorder : colors.line);
    final counted = count != null && share != null;
    final heard = othersLabel == null ? null : (othersLabel!.endsWith('.') ? othersLabel!.substring(0, othersLabel!.length - 1) : othersLabel!);
    final spoken = ['$letter. $text', ...tags, ?heard, if (trap != null) TrapTagView.spokenOf(trap!)].join('. ');
    // The key's bar in the right-answer tone, a wrong pick's in the wrong tone, the rest neutral.
    final barTone = isKey ? colors.goodText : (mineWrong ? colors.badText : colors.ink4);
    return Semantics(
      container: true,
      label: spoken,
      excludeSemantics: true,
      child: Container(
        constraints: const BoxConstraints(minHeight: MmTarget.option),
        padding: EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s12, counted ? 10 : MmSpace.s12),
        decoration: ShapeDecoration(
          color: mineWrong ? colors.wrongSurface : colors.raised,
          shape: RoundedSuperellipseBorder(
            borderRadius: MmRadius.keyAll,
            side: BorderSide(color: border, width: isKey || mineWrong ? 1.5 : 1),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Bubble(state: state, size: 20, animate: false),
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('$letter. $text', style: type.body.copyWith(color: mineWrong ? colors.wrongText : colors.ink)),
                      if (tags.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(tags.join('. '), style: type.label.copyWith(color: mineWrong ? colors.wrongText : colors.ink2)),
                        ),
                      // The trap, one more row under the option's own words: it never covers them.
                      if (trap != null) Padding(padding: const EdgeInsets.only(top: MmSpace.s8), child: TrapTagView(trap: trap!)),
                    ],
                  ),
                ),
                if (counted) ...[
                  const SizedBox(width: MmSpace.s12),
                  Padding(
                    padding: const EdgeInsets.only(top: 1),
                    child: Text(
                      '$count',
                      textAlign: TextAlign.right,
                      style: type.subhead.copyWith(
                        fontSize: 15,
                        color: mineWrong ? colors.wrongText : colors.ink2,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ),
                ],
              ],
            ),
            if (counted) ...[
              const SizedBox(height: MmSpace.s8),
              // Under the text, never behind it: from the text's left edge to the count's right.
              Padding(
                padding: const EdgeInsets.only(left: 20 + MmSpace.s12),
                child: SizedBox(
                  height: 2,
                  child: CustomPaint(
                    painter: _ShareBarPainter(share: share!, tone: barTone, track: colors.line, grow: grow),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// A 2 dp bar of one option's share of the students who answered, on a hairline track.
class _ShareBarPainter extends CustomPainter {
  _ShareBarPainter({required this.share, required this.tone, required this.track, this.grow}) : super(repaint: grow);

  final double share;
  final Color tone;
  final Color track;
  final Animation<double>? grow;

  @override
  void paint(Canvas canvas, Size size) {
    const r = Radius.circular(1);
    canvas.drawRRect(RRect.fromRectAndRadius(Offset.zero & size, r), Paint()..color = track);
    final w = size.width * share.clamp(0.0, 1.0) * (grow?.value ?? 1);
    if (w <= 0) return;
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w, size.height), r), Paint()..color = tone);
  }

  @override
  bool shouldRepaint(_ShareBarPainter old) => old.share != share || old.tone != tone || old.track != track || old.grow != grow;
}
