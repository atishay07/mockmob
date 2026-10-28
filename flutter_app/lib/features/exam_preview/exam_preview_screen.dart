import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../runner/nta/nta_action_bar.dart';
import '../runner/nta/nta_chip.dart' show NtaChipState;
import '../runner/nta/nta_copy.dart';
import '../runner/nta/nta_header.dart';
import '../runner/nta/nta_overlays.dart';
import '../runner/nta/nta_palette.dart';
import '../runner/nta/nta_paper.dart';
import '../runner/nta/nta_paper_theme.dart' show NtaPaperTheme;
import '../runner/nta/nta_question_paper.dart';
import '../runner/nta/nta_skin.dart' show NtaExamLook;
import '../runner/nta/nta_text_size.dart';
import '../runner/widgets/solid_sheet.dart';
import 'exam_preview_controller.dart';
import 'exam_preview_copy.dart';
import 'exam_preview_parts.dart';

/// The free exam-screen preview: the real NTA exam screen (its bar, clock, section tabs, paper,
/// palette and keys) with sample questions, so a student sees what they are paying for before
/// spending a credit. Static and non-scoring: no session, no network, no storage.
class ExamPreviewScreen extends StatefulWidget {
  const ExamPreviewScreen({super.key, this.controller});

  /// Tests pass their own, with a clock they step by hand.
  final ExamPreviewController? controller;

  @override
  State<ExamPreviewScreen> createState() => _ExamPreviewScreenState();
}

class _ExamPreviewScreenState extends State<ExamPreviewScreen> {
  late final ExamPreviewController _c = widget.controller ?? ExamPreviewController();
  int _textStep = 1;

  @override
  void dispose() {
    if (widget.controller == null) _c.dispose();
    super.dispose();
  }

  void _leave() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.practice);
    }
  }

  Future<void> _openPalette() async {
    _c.paletteOpened();
    final pick = await showNtaDrawer<int>(
      context: context,
      builder: (drawerContext) => ListenableBuilder(
        listenable: _c,
        builder: (context, _) => NtaPalettePanel(
          cells: _c.cells,
          subject: _c.section.name,
          candidate: null,
          onJump: (i) => Navigator.of(drawerContext).pop(i),
          onSubmit: () => Navigator.of(drawerContext).pop(-1),
          onQuestionPaper: () => Navigator.of(drawerContext).pop(-2),
          onClose: () => Navigator.of(drawerContext).pop(),
        ),
      ),
    );
    if (!mounted || pick == null) return;
    switch (pick) {
      case -1:
        await _openEnd();
      case -2:
        await _openQuestionPaper();
      default:
        _c.jump(pick);
    }
  }

  Future<void> _openQuestionPaper() async {
    final pick = await showNtaQuestionPaper(context, subject: _c.section.name, questions: _c.questions, cells: _c.cells);
    if (mounted && pick != null) _c.jump(pick);
  }

  Future<void> _openEnd() async {
    final leave = await showRunnerSheet<bool>(
      context: context,
      title: ExamPreviewCopy.endTitle,
      builder: (sheetContext) => _EndBody(
        text: ExamPreviewCopy.endBody(answered: _c.answeredTotal, total: _c.totalQuestions, marked: _c.markedTotal),
      ),
    );
    if (!mounted) return;
    if (leave == true) {
      _leave();
    } else if (leave == false) {
      _c.reset();
    }
  }

  void _step(int delta) => setState(() => _textStep = (_textStep + delta).clamp(0, NtaTextStep.scales.length - 1));

  @override
  Widget build(BuildContext context) {
    return NtaPaperTheme(
      child: Builder(
        builder: (context) => Material(
          color: context.mmColors.ground,
          child: Semantics(
            label: ExamPreviewCopy.screenSemantics,
            container: true,
            child: ListenableBuilder(listenable: _c, builder: (context, _) => _body(context)),
          ),
        ),
      ),
    );
  }

  Widget _body(BuildContext context) {
    final colors = context.mmColors;
    final wide = MediaQuery.sizeOf(context).width >= 840;
    final q = _c.currentQuestion;
    final cells = _c.cells;
    final cell = cells[_c.index];
    final main = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        NtaBar(
          subject: _c.section.name,
          leading: NtaBarKey(icon: LucideIcons.arrowLeft, semanticsLabel: ExamPreviewCopy.back, onTap: _leave),
          trailing: [
            _TappableClock(controller: _c),
            if (!wide) NtaBarKey(icon: LucideIcons.layoutGrid, semanticsLabel: NtaCopy.paletteTitle, onTap: () => _openPalette()),
          ],
          bottom: NtaProgressRow(current: _c.index + 1, total: _c.questions.length, answered: _c.answeredIn(_c.sectionIndex)),
        ),
        PreviewSectionStrip(sections: _c.sections, selected: _c.sectionIndex, onSelect: _c.switchSection),
        PreviewTryBand(controller: _c),
        Expanded(
          child: ColoredBox(
            color: colors.ground,
            child: SingleChildScrollView(
              key: ValueKey('preview-question-${_c.sectionIndex}-${_c.index}'),
              padding: NtaExamLook.of(context)
                  ? const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s12, MmSpace.s16)
                  : const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 930),
                  child: NtaPaper(
                    question: q,
                    number: _c.index + 1,
                    state: NtaChipState.of(cell),
                    selected: _c.selected,
                    marked: _c.isMarked,
                    canAnswer: true,
                    onSelect: _c.select,
                    onMark: _c.setMarked,
                    textScale: NtaTextStep.scales[_textStep],
                    onTextStep: _step,
                  ),
                ),
              ),
            ),
          ),
        ),
        NtaActionBar(
          isFirst: _c.isFirst,
          isLast: _c.isLast,
          canClear: _c.selected != null,
          canMark: true,
          onMarkAndNext: _c.markAndNext,
          onClear: _c.clear,
          onPrevious: _c.previous,
          onSaveAndNext: () => _c.isLast ? _openEnd() : _c.saveAndNext(),
        ),
      ],
    );
    if (!wide) return main;
    final inset = MediaQuery.viewPaddingOf(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(child: main),
        DecoratedBox(
          decoration: BoxDecoration(border: Border(left: BorderSide(color: colors.line))),
          child: SizedBox(
            width: 320,
            child: Padding(
              padding: EdgeInsets.only(top: inset.top, bottom: inset.bottom),
              child: NtaPalettePanel(
                cells: cells,
                subject: _c.section.name,
                candidate: null,
                onJump: _c.jump,
                onSubmit: _openEnd,
                onQuestionPaper: _openQuestionPaper,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// The real exam clock, made a button: one tap shows its last minute (it turns red), the next
/// resets it to a full hour. 48 dp tall so it is an easy target.
class _TappableClock extends StatelessWidget {
  const _TappableClock({required this.controller});

  final ExamPreviewController controller;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: ExamPreviewCopy.clockTip,
      onTap: controller.toggleLastMinute,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: controller.toggleLastMinute,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Center(child: NtaTimerChip(remaining: controller.remaining)),
        ),
      ),
    );
  }
}

/// The end sheet: pops true to leave for Practice, false to walk through again.
class _EndBody extends StatelessWidget {
  const _EndBody({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(text, style: context.mmType.body.copyWith(color: context.mmColors.ink2)),
        const SizedBox(height: MmSpace.s24),
        KeyButton(label: ExamPreviewCopy.back, onPressed: () => Navigator.of(context).pop(true), hapticOnCommit: false, autofocus: true),
        const SizedBox(height: MmSpace.s12),
        KeyButton.secondary(label: ExamPreviewCopy.again, onPressed: () => Navigator.of(context).pop(false), hapticOnCommit: false),
      ],
    );
  }
}
