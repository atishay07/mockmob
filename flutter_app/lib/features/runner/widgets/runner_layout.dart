import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/sync/session/session_engine.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/runner_session.dart';
import '../logic/sheet_cells.dart';
import 'question_view.dart';
import 'runner_bottom_bar.dart';
import 'runner_meta_row.dart';
import 'runner_top_bar.dart';
import 'timing_track.dart';

/// The answering layout (spec 5.5): top bar, the meta line, the timing track, the question
/// region and the bottom bar. Solid ground, no art, no Mobi; it rebuilds from the session and
/// never animates its layout.
class RunnerLayout extends StatelessWidget {
  const RunnerLayout({
    super.key,
    required this.session,
    required this.warning,
    required this.onLeave,
    required this.onQuestions,
    required this.onSelect,
    required this.onPrevious,
    required this.onNext,
  });

  final RunnerSession session;
  final String? warning;
  final VoidCallback onLeave;
  final VoidCallback onQuestions;
  final void Function(String qid, int? option) onSelect;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final s = session;
    final index = s.currentIndex;
    final q = s.questions[index];
    final top = MediaQuery.viewPaddingOf(context).top;
    final cells = sheetCellsOf(s);

    return ColoredBox(
      color: colors.ground,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(MmSpace.gutter, top + MmSpace.s4, MmSpace.gutter, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                RunnerTopBar(
                  current: index + 1,
                  total: s.questions.length,
                  isMock: s.isMock,
                  remaining: s.isMock ? s.remaining : null,
                  onLeave: onLeave,
                  onQuestions: onQuestions,
                ),
                RunnerMetaRow(
                  subjectLine: RunnerCopy.subjectLine(s.subject, q.chapter ?? s.chapter),
                  openUntil: s.isMock ? null : RunnerCopy.openUntil(s.endsAt.toLocal()),
                  save: s.saveState,
                  showSave: s.answeredCount > 0,
                  warning: warning,
                ),
                const SizedBox(height: MmSpace.s4),
                TimingTrack(cells: cells),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              key: ValueKey('question-$index'),
              padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.s16),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                  child: QuestionView(
                    question: q,
                    selected: s.answerFor(q.id),
                    marked: s.marked.contains(q.id),
                    canAnswer: s.canAnswer,
                    onSelect: (option) => onSelect(q.id, option),
                    onMark: (value) => s.setMarked(q.id, value),
                    passageRange: passageRangeOf(s, index),
                    leading: [_AwayBanner(session: s)],
                    note: !s.isMock && index == 0 && s.answeredCount == 0 ? _PracticeNote(openUntil: s.endsAt.toLocal()) : null,
                  ),
                ),
              ),
            ),
          ),
          RunnerBottomBar(isFirst: index == 0, isLast: index == s.questions.length - 1, onPrevious: onPrevious, onNext: onNext),
        ],
      ),
    );
  }
}

/// "You were away for 2 minutes 10 seconds. The timer kept running." with the save fact that
/// is true right now. It sits in the flow, never over the question, until dismissed.
class _AwayBanner extends StatelessWidget {
  const _AwayBanner({required this.session});

  final RunnerSession session;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<AwayInfo?>(
      valueListenable: session.away,
      builder: (context, info, _) {
        if (info == null) return const SizedBox.shrink();
        final fact = info.allSaved ? RunnerCopy.awaySaved : RunnerCopy.awayOnPhone;
        return Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s12),
          child: InlineBanner(
            message: '${RunnerCopy.awayFor(info.duration)} $fact',
            actionLabel: RunnerCopy.awayDismiss,
            onAction: session.dismissAway,
          ),
        );
      },
    );
  }
}

/// The practice skin's one line at the start: no feedback while answering.
class _PracticeNote extends StatelessWidget {
  const _PracticeNote({required this.openUntil});

  final DateTime openUntil;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      children: [
        Icon(LucideIcons.messageCircle, size: 15, color: colors.ink3),
        const SizedBox(width: MmSpace.s8),
        Expanded(
          child: Text(RunnerCopy.practiceNote(openUntil), style: type.small.copyWith(color: colors.ink2)),
        ),
      ],
    );
  }
}
