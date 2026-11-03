import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../copy.dart';
import '../model/practice_result_model.dart';
import 'mode_row.dart' show RowDivider;
import 'pressable.dart';
import 'result_question_card.dart';

/// Which rows are open, which not-attempted questions are being tried, and the keys used to
/// scroll to a row. Plain state shared by the screen and the list.
class ResultListController extends ChangeNotifier {
  final Set<String> open = {};
  bool correctGroupOpen = false;
  final Map<String, BlankMode> blank = {};
  final Map<String, int> tried = {};
  final Map<String, GlobalKey> _keys = {};

  GlobalKey keyFor(String qid) => _keys.putIfAbsent(qid, GlobalKey.new);

  void toggle(String qid) {
    open.contains(qid) ? open.remove(qid) : open.add(qid);
    notifyListeners();
  }

  /// Opens the row (and the "Correct" group when it lives there). Scrolling is the caller's job.
  void reveal(ResultQuestion q) {
    open.add(q.qid);
    if (q.verdict == Verdict.correct) correctGroupOpen = true;
    notifyListeners();
  }

  void toggleCorrectGroup() {
    correctGroupOpen = !correctGroupOpen;
    notifyListeners();
  }

  void setBlank(String qid, BlankMode mode) {
    blank[qid] = mode;
    if (mode == BlankMode.question) tried.remove(qid);
    notifyListeners();
  }

  void pick(String qid, int option) {
    tried[qid] = option;
    notifyListeners();
  }
}

/// The per-question rows in three groups: wrong answers, not attempted, and correct. The two
/// groups that need attention are always open; the correct group is one tap away.
class ResultList extends StatelessWidget {
  const ResultList({super.key, required this.model, required this.controller, required this.keyFor});

  final PracticeResultModel model;
  final ResultListController controller;

  /// The key view of one question (loading, ready, held, unavailable).
  final KeyView Function(String qid) keyFor;

  Widget _row(ResultQuestion q) {
    final isBlank = q.verdict == Verdict.blank;
    return KeyedSubtree(
      key: controller.keyFor(q.qid),
      child: ResultQuestionRow(
        item: q,
        keyView: keyFor(q.qid),
        expanded: controller.open.contains(q.qid),
        onToggle: () => controller.toggle(q.qid),
        blankMode: isBlank ? (controller.blank[q.qid] ?? BlankMode.question) : BlankMode.question,
        tried: controller.tried[q.qid],
        onTry: isBlank ? () => controller.setBlank(q.qid, BlankMode.trying) : null,
        onShowAnswer: isBlank ? () => controller.setBlank(q.qid, BlankMode.answer) : null,
        onTryPick: isBlank ? (j) => controller.pick(q.qid, j) : null,
      ),
    );
  }

  Widget _group(BuildContext context, String title, List<ResultQuestion> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s4),
          child: Semantics(header: true, child: Text(title, style: context.mmType.subhead)),
        ),
        const RowDivider(),
        for (final q in items) ...[_row(q), const RowDivider()],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final wrong = model.wrong;
    final blank = model.blank;
    final correct = model.correct;
    final type = context.mmType;
    final colors = context.mmColors;
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (wrong.isNotEmpty) ...[_group(context, PracticeCopy.sectionWrong(wrong.length), wrong), const SizedBox(height: MmSpace.group)],
          if (blank.isNotEmpty) ...[_group(context, PracticeCopy.sectionBlank(blank.length), blank), const SizedBox(height: MmSpace.group)],
          if (correct.isNotEmpty)
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _CorrectHeader(
                  count: correct.length,
                  open: controller.correctGroupOpen,
                  onTap: controller.toggleCorrectGroup,
                  type: type,
                  colors: colors,
                ),
                const RowDivider(),
                if (controller.correctGroupOpen)
                  for (final q in correct) ...[_row(q), const RowDivider()],
              ],
            ),
        ],
      ),
    );
  }
}

class _CorrectHeader extends StatelessWidget {
  const _CorrectHeader({required this.count, required this.open, required this.onTap, required this.type, required this.colors});

  final int count;
  final bool open;
  final VoidCallback onTap;
  final MmType type;
  final MmColors colors;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: onTap,
      expanded: open,
      semanticsLabel: PracticeCopy.sectionCorrect(count),
      minHeight: 52,
      builder: (_, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
        child: Row(
          children: [
            Expanded(child: Text(PracticeCopy.sectionCorrect(count), style: type.subhead)),
            ExcludeSemantics(child: Icon(open ? LucideIcons.chevronUp : LucideIcons.chevronDown, size: 20, color: colors.ink3)),
          ],
        ),
      ),
    );
  }
}
