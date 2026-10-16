import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/key_button_motion.dart';
import '../copy.dart';
import '../model/practice_selection.dart';
import 'chapter_picker.dart';
import 'composer_parts.dart';

/// The words Fine-tune opens with for [mode]: what this mode lets you set (owner, 17 Oct, F9).
String fineTuneSentence(PracticeMode mode) => switch (mode.fineTune) {
  FineTuneScope.chaptersAndLevel => PracticeCopy.fineTuneQuick,
  FineTuneScope.levelOnly => PracticeCopy.fineTuneFull,
  FineTuneScope.none => mode == PracticeMode.smart ? PracticeCopy.fineTuneSmart : PracticeCopy.fineTuneNta,
};

/// Fine-tune, one open block above Start (F8), scoped by the mode (F9):
///
/// - Quick practice: the chapters (grouped by unit, searchable, in the picker) and the difficulty.
/// - Full mock: the difficulty alone; it covers every chapter, like the exam.
/// - Smart practice and NTA mode: no controls, one calm line that we choose for you.
///
/// It is never a collapsed disclosure: people skip what they cannot see. It holds its place and
/// its words, so the controls above and below it never jump when the mode or the quote changes.
class FineTune extends StatelessWidget {
  const FineTune({
    super.key,
    required this.mode,
    required this.chapters,
    required this.difficulty,
    required this.isPro,
    required this.showLevel,
    required this.onPickChapters,
    required this.onRemoveChapter,
    required this.onDifficulty,
  });

  final PracticeMode mode;
  final List<String> chapters;
  final PracticeDifficulty difficulty;
  final bool isPro;

  /// The level steps aside while the quote says the plan is short of credits (it is not a choice
  /// that matters then). The chapters stay.
  final bool showLevel;
  final VoidCallback onPickChapters;
  final ValueChanged<String> onRemoveChapter;
  final ValueChanged<PracticeDifficulty> onDifficulty;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final scope = mode.fineTune;
    final level = DifficultyPicker(value: difficulty, isPro: isPro, onChanged: onDifficulty);
    return Semantics(
      container: true,
      label: '${PracticeCopy.fineTuneLabel}. ${fineTuneSentence(mode)}',
      child: Column(
        key: ValueKey('fine-tune-${scope.name}'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          ExcludeSemantics(child: Text(PracticeCopy.fineTuneLabel, style: type.labelLarge)),
          const SizedBox(height: MmSpace.s4),
          ExcludeSemantics(child: Text(fineTuneSentence(mode), style: type.small.copyWith(color: colors.ink2))),
          if (scope == FineTuneScope.chaptersAndLevel) ...[
            const SizedBox(height: MmSpace.s16),
            ChapterField(chapters: chapters, onTap: onPickChapters, onRemove: onRemoveChapter),
          ],
          if (scope != FineTuneScope.none)
            KeyReveal(
              show: showLevel,
              child: Padding(padding: const EdgeInsets.only(top: MmSpace.s16), child: level),
            ),
        ],
      ),
    );
  }
}
