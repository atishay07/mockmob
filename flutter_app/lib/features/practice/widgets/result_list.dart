import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../copy.dart';
import '../model/practice_result_model.dart';
import '../../../core/widgets/widgets.dart';
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
          padding: const EdgeInsets.only(left: MmSpace.s4, bottom: MmSpace.s8),
          child: Semantics(header: true, child: Text(title, style: context.mmType.title.copyWith(fontSize: 20))),
        ),
        ResultPanel(children: [for (final q in items) _row(q)]),
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
            ResultPanel(
              children: [
                _CorrectHeader(
                  count: correct.length,
                  open: controller.correctGroupOpen,
                  onTap: controller.toggleCorrectGroup,
                  type: type,
                  colors: colors,
                ),
                if (controller.correctGroupOpen)
                  for (final q in correct) _row(q),
              ],
            ),
        ],
      ),
    );
  }
}

/// A solid panel of result rows divided by hairlines (the work layer: calm, no art).
class ResultPanel extends StatelessWidget {
  const ResultPanel({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: RoundedSuperellipseBorder(borderRadius: MmRadius.panelAll, side: BorderSide(color: colors.line)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0) Divider(height: 1, thickness: 1, color: colors.line),
              children[i],
            ],
          ],
        ),
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
    return MmPressable(
      onTap: onTap,
      semanticsLabel: PracticeCopy.sectionCorrect(count),
      focusRadius: MmRadius.keyAll,
      pressedScale: 0.985,
      builder: (_, _, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4, vertical: MmSpace.s12),
          child: Row(
            children: [
              Expanded(child: Text(PracticeCopy.sectionCorrect(count), style: type.cardTitle.copyWith(fontSize: 16))),
              ExcludeSemantics(child: Icon(open ? LucideIcons.chevronUp : LucideIcons.chevronDown, size: 20, color: colors.ink3)),
            ],
          ),
        ),
      ),
    );
  }
}
