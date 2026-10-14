import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/sync/session/session_engine.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/runner_session.dart';
import '../logic/sheet_cells.dart';
import 'nta_action_bar.dart';
import 'nta_chip.dart';
import 'nta_copy.dart';
import 'nta_header.dart';
import 'nta_palette.dart';
import 'nta_paper.dart';
import 'nta_skin.dart' show NtaExamLook;
import 'nta_status_strip.dart';

/// What the NTA layout calls back into the screen.
class NtaActions {
  const NtaActions({
    required this.onPalette,
    required this.onSelect,
    required this.onMark,
    required this.onMarkAndNext,
    required this.onClear,
    required this.onPrevious,
    required this.onSaveAndNext,
    required this.onJump,
    required this.onSubmit,
    required this.onQuestionPaper,
    required this.onTextStep,
    this.onRetrySave,
  });

  final VoidCallback onPalette;
  final void Function(String qid, int option) onSelect;
  final void Function(String qid, bool marked) onMark;
  final VoidCallback onMarkAndNext;
  final VoidCallback onClear;
  final VoidCallback onPrevious;
  final VoidCallback onSaveAndNext;
  final ValueChanged<int> onJump;
  final VoidCallback onSubmit;
  final VoidCallback onQuestionPaper;
  final void Function(int delta) onTextStep;

  /// A tap on "Not saved yet. Tap to retry": asks the server again.
  final VoidCallback? onRetrySave;
}

/// The exam screen (NTA-MODE-SPEC section 9.2): the blue bar with the clock and the progress, the
/// section strip, the paper, and the two rows of exam keys. At 840 dp and wider the palette
/// stands as a 320 dp column on the right, as on the website's desktop console.
class NtaLayout extends StatelessWidget {
  const NtaLayout({
    super.key,
    required this.session,
    required this.actions,
    required this.canAnswer,
    this.modalUp = false,
    required this.strikes,
    required this.textScale,
    required this.candidate,
    this.warning,
  });

  static const double wideBreakpoint = 840;
  static const double panelWidth = 320;

  final RunnerSession session;
  final NtaActions actions;

  /// The session allows answers and no warning card is up.
  final bool canAnswer;

  /// The warning card is over the paper: nothing under it is reachable by TalkBack or a keyboard.
  final bool modalUp;
  final int strikes;
  final double textScale;
  final String? candidate;
  final String? warning;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final s = session;
    final index = s.currentIndex;
    final q = s.questions[index];
    final cells = sheetCellsOf(s);
    final subject = NtaCopy.subject(s.subject);
    final selected = s.answerFor(q.id);
    final marked = s.marked.contains(q.id);
    final wide = MediaQuery.sizeOf(context).width >= wideBreakpoint;

    final main = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        NtaBar(
          subject: subject,
          trailing: [
            NtaTimerChip(remaining: s.remaining),
            if (!wide) NtaBarKey(icon: LucideIcons.layoutGrid, semanticsLabel: NtaCopy.paletteTitle, onTap: actions.onPalette),
          ],
          bottom: NtaProgressRow(current: index + 1, total: s.questions.length, answered: s.answeredCount),
        ),
        NtaStatusStrip(
          subject: subject,
          strikes: strikes,
          save: s.saveState,
          showSave: s.answeredCount > 0,
          warning: warning,
          onRetrySave: actions.onRetrySave,
        ),
        Expanded(
          child: ColoredBox(
            color: colors.ground,
            child: SingleChildScrollView(
              key: ValueKey('nta-question-$index'),
              // The exam look is a card on its own page margin (12); the MockMob look lies open on
              // the page, on the same 16 dp gutter as the practice and mock runner.
              padding: NtaExamLook.of(context)
                  ? const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s12, MmSpace.s16)
                  : const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 930),
                  child: NtaPaper(
                    question: q,
                    number: index + 1,
                    state: NtaChipState.of(cells[index]),
                    selected: selected,
                    marked: marked,
                    canAnswer: canAnswer,
                    onSelect: (option) => actions.onSelect(q.id, option),
                    onMark: (value) => actions.onMark(q.id, value),
                    textScale: textScale,
                    onTextStep: actions.onTextStep,
                    passageRange: passageRangeOf(s, index),
                    leading: [_AwayBanner(session: s)],
                  ),
                ),
              ),
            ),
          ),
        ),
        NtaActionBar(
          isFirst: index == 0,
          isLast: index == s.questions.length - 1,
          canClear: canAnswer && selected != null,
          canMark: canAnswer,
          onMarkAndNext: actions.onMarkAndNext,
          onClear: actions.onClear,
          onPrevious: actions.onPrevious,
          onSaveAndNext: actions.onSaveAndNext,
        ),
      ],
    );

    if (!wide) {
      return ExcludeSemantics(
        excluding: modalUp,
        child: ColoredBox(color: colors.ground, child: main),
      );
    }
    return ExcludeSemantics(
      excluding: modalUp,
      child: ColoredBox(
        color: colors.ground,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: main),
            DecoratedBox(
              decoration: BoxDecoration(
                border: Border(left: BorderSide(color: colors.line)),
              ),
              child: SizedBox(
                width: panelWidth,
                child: Padding(
                  padding: EdgeInsets.only(top: MediaQuery.viewPaddingOf(context).top, bottom: MediaQuery.viewPaddingOf(context).bottom),
                  child: NtaPalettePanel(
                    cells: cells,
                    subject: subject,
                    candidate: candidate,
                    onJump: actions.onJump,
                    onSubmit: actions.onSubmit,
                    onQuestionPaper: actions.onQuestionPaper,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// "You were away for 2 minutes 10 seconds. The timer kept running." with the save fact that is
/// true right now, inside the paper until dismissed.
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
