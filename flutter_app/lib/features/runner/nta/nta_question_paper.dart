import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/question.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../logic/sheet_cells.dart';
import 'nta_chip.dart';
import 'nta_copy.dart';
import 'nta_header.dart';
import 'nta_paper_theme.dart';

/// Opens the whole paper as one list (the exam's "Question Paper" view): every question with its
/// state, read-only. Tapping one closes the list on that question.
Future<int?> showNtaQuestionPaper(
  BuildContext context, {
  required String subject,
  required List<SessionQuestion> questions,
  required List<SheetCell> cells,
}) {
  return Navigator.of(context).push<int>(
    PageRouteBuilder<int>(
      transitionDuration: Motion.reduced(context) ? Motion.reducedFade : Motion.card,
      reverseTransitionDuration: Motion.reducedFade,
      pageBuilder: (context, _, _) => NtaStyleTheme(
        child: NtaQuestionPaper(subject: subject, questions: questions, cells: cells),
      ),
      transitionsBuilder: (context, animation, _, child) => FadeTransition(opacity: animation, child: child),
    ),
  );
}

class NtaQuestionPaper extends StatelessWidget {
  const NtaQuestionPaper({super.key, required this.subject, required this.questions, required this.cells});

  final String subject;
  final List<SessionQuestion> questions;
  final List<SheetCell> cells;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final bottom = MediaQuery.viewPaddingOf(context).bottom;
    return Material(
      color: colors.ground,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          NtaBar(
            subject: NtaCopy.questionPaper,
            leading: NtaBarKey(icon: LucideIcons.arrowLeft, semanticsLabel: NtaCopy.close, onTap: () => Navigator.of(context).pop()),
          ),
          Expanded(
            child: ListView.separated(
              padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.s24 + bottom),
              itemCount: questions.length,
              separatorBuilder: (_, _) => Divider(height: 1, thickness: 1, color: colors.line),
              itemBuilder: (context, i) {
                final q = questions[i];
                final cell = cells[i];
                final state = NtaChipState.of(cell);
                return Semantics(
                  button: true,
                  label: '${NtaCopy.questionTitle(i + 1)}, ${state.label.toLowerCase()}. ${q.question}',
                  excludeSemantics: true,
                  child: InkWell(
                    onTap: () => Navigator.of(context).pop(i),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          NtaChip(state: state, label: '${i + 1}', current: cell.current, size: const Size(36, 32), fontSize: 13),
                          const SizedBox(width: MmSpace.s12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  q.question,
                                  maxLines: 3,
                                  overflow: TextOverflow.ellipsis,
                                  style: type.small.copyWith(color: colors.ink),
                                ),
                                const SizedBox(height: MmSpace.s4),
                                Text(
                                  [state.label, if (q.passageGroupId != null && q.passageGroupId!.isNotEmpty) NtaCopy.passage].join(', '),
                                  style: type.caption.copyWith(color: colors.ink3),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
