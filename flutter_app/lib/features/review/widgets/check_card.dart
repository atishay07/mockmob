import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/repair_check.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/data/mobi_models.dart' show CheckMark;
import '../data/repair_check_logic.dart' show CheckCopy;
import 'outcome_views.dart' show ExplanationBlock;
import 'question_panel.dart' show MarkedOption, OptionMark;

/// One new CUET-style question that tests a doubt or a fix (a doubt's 2 questions, a fix's 2 checks): the stem, four options
/// as the app's radio rows, one "Check my answer" key, then the server's mark in words (the key and the pick tagged,
/// never by colour alone) and the bank's own explanation. The first answer counts; nothing here costs a credit.
class CheckCard extends StatefulWidget {
  const CheckCard({
    super.key,
    required this.number,
    required this.of,
    required this.question,
    required this.onAnswer,
    this.passage,
    this.mark,
    this.marking = false,
    this.pending,
    this.error,
  });

  /// 1 or 2, of [of].
  final int number;
  final int of;
  final CheckQuestion question;
  final String? passage;

  /// The server's mark once answered.
  final CheckMark? mark;
  final bool marking;

  /// The option being marked (kept selected while the mark is on its way).
  final int? pending;

  /// A plain line when the mark could not be had (nothing was charged).
  final String? error;
  final ValueChanged<int> onAnswer;

  @override
  State<CheckCard> createState() => _CheckCardState();
}

class _CheckCardState extends State<CheckCard> {
  int? _pick;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final q = widget.question;
    final mark = widget.mark;
    final pick = widget.pending ?? _pick;
    final where = q.chapter ?? q.topic;
    return Semantics(
      container: true,
      explicitChildNodes: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(
              where == null ? CheckCardCopy.heading(widget.number, widget.of) : CheckCardCopy.headingFrom(widget.number, widget.of, where),
              style: type.label.copyWith(color: colors.ink2),
            ),
          ),
          const SizedBox(height: MmSpace.s8),
          if (widget.passage != null) ...[
            DecoratedBox(
              decoration: ShapeDecoration(color: colors.sunken, shape: const RoundedRectangleBorder(borderRadius: MmRadius.keyAll)),
              child: Padding(
                padding: const EdgeInsets.all(MmSpace.s12),
                child: Text(widget.passage!, style: type.small.copyWith(color: colors.ink, height: 1.5)),
              ),
            ),
            const SizedBox(height: MmSpace.s12),
          ],
          Text(q.question, style: type.question),
          const SizedBox(height: MmSpace.s12),
          if (mark != null)
            for (var i = 0; i < q.options.length; i++) ...[
              if (i > 0) const SizedBox(height: MmSpace.s8),
              _answered(q.options[i], mark),
            ]
          else ...[
            for (var i = 0; i < q.options.length; i++) ...[
              if (i > 0) const SizedBox(height: MmSpace.s8),
              MmSelectRow(
                title: q.options[i].text,
                letter: q.options[i].letter,
                selected: pick == q.options[i].index,
                onTap: widget.marking ? null : () => setState(() => _pick = q.options[i].index),
              ),
            ],
            const SizedBox(height: MmSpace.s12),
            KeyButton.secondary(
              label: widget.marking ? CheckCopy.marking : CheckCopy.submit,
              loading: widget.marking,
              minHeight: MmTarget.min,
              onPressed: pick == null || widget.marking ? null : () => widget.onAnswer(pick),
            ),
            const SizedBox(height: MmSpace.s8),
            Text(pick == null ? '${CheckCopy.pickOne} ${CheckCopy.firstCounts}' : CheckCopy.firstCounts, style: type.caption.copyWith(color: colors.ink3)),
            if (widget.error != null) ...[
              const SizedBox(height: MmSpace.s8),
              Semantics(liveRegion: true, child: Text(widget.error!, style: type.small.copyWith(color: colors.badText, fontWeight: FontWeight.w600))),
            ],
          ],
          if (mark != null) ...[
            const SizedBox(height: MmSpace.s16),
            Semantics(
              liveRegion: true,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ExcludeSemantics(
                    child: DecoratedBox(
                      decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: mark.right ? colors.goodText : colors.ink3, width: 1.5)),
                      child: SizedBox.square(
                        dimension: 24,
                        child: Icon(mark.right ? LucideIcons.check : LucideIcons.rotateCcw, size: 14, color: mark.right ? colors.goodText : colors.ink2),
                      ),
                    ),
                  ),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(child: Text(mark.line, style: type.body.copyWith(fontWeight: FontWeight.w600))),
                ],
              ),
            ),
            if (mark.explanation != null) ExplanationBlock(label: CheckCopy.explanation, paragraphs: [mark.explanation!]),
          ],
        ],
      ),
    );
  }

  Widget _answered(CheckOption o, CheckMark mark) {
    final isKey = o.index == mark.keyIndex;
    final isPick = o.index == mark.pick;
    return MarkedOption(
      letter: o.letter,
      text: o.text,
      mark: isKey ? OptionMark.correct : (isPick ? OptionMark.yours : OptionMark.none),
      word: CheckCopy.tag(isKey: isKey, isPick: isPick),
    );
  }
}

abstract final class CheckCardCopy {
  static String heading(int n, int of) => 'Question $n of $of';
  static String headingFrom(int n, int of, String chapter) => 'Question $n of $of, from $chapter';
}
