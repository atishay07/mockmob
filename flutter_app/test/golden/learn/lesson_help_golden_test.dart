import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/insights/data/ai_reply_report.dart' show insightsPrefsStoreProvider;
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/learn/lesson_help/lesson_help_controller.dart';
import 'package:mockmob/features/learn/lesson_help/lesson_help_copy.dart';
import 'package:mockmob/features/learn/lesson_help/lesson_help_sheet.dart';

import '../insights/insights_golden_support.dart';

/// Lesson help at 390 wide, Night and Day: the line under a step, the sheet before sending, while
/// the reply is written, after it, with no credits, and after a failed call.
const _size = Size(390, 844);
const _key = LessonHelpKey(runId: 'run-7', itemId: 'u1-read-2', revision: 4);

AiCredits _wallet(int total, {String? state}) => AiCredits.fromJson({
      'state': state ?? (total > 0 ? 'available' : 'empty'),
      'wallet': {
        'state': state ?? (total > 0 ? 'available' : 'empty'),
        'known': true,
        'spendable': total > 0,
        'total': total,
        'includedRemaining': total,
        'includedMonthlyCredits': 10,
        'resetAt': '2026-10-31T18:30:00.000Z',
      },
    });

class _Fixed extends LessonHelpController {
  _Fixed(super.key, this.fixed);

  final LessonHelpState fixed;

  @override
  LessonHelpState build() => fixed;
}

List<Override> _overrides(AiCredits credits, [LessonHelpState state = const LessonHelpState()]) => [
      ...insightsOverrides(credits: credits),
      insightsPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      lessonHelpProvider.overrideWith((key) => _Fixed(key, state)),
    ];

/// A reading step, as far as the golden needs one, with the line under it.
class _Step extends StatelessWidget {
  const _Step();

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return ColoredBox(
      color: colors.ground,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Goodwill', style: type.screenTitle),
              const SizedBox(height: MmSpace.s12),
              Text(
                'Goodwill is the extra a buyer pays for a firm above the value of its net assets, because the firm earns more than usual.',
                style: type.body,
              ),
              const SizedBox(height: MmSpace.s24),
              const LessonHelpEntry(helpKey: _key),
            ],
          ),
        ),
      ),
    );
  }
}

/// The sheet over a dimmed step.
class _Open extends StatelessWidget {
  const _Open();

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        const Positioned.fill(child: _Step()),
        Positioned.fill(child: ColoredBox(color: context.mmColors.sheetScrim)),
        Align(
          alignment: Alignment.bottomCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
            child: const MmSheetGlass(
              child: MmSheetScaffold(title: LessonHelpCopy.sheetTitle, child: LessonHelpSheet(helpKey: _key)),
            ),
          ),
        ),
      ],
    );
  }
}

void main() {
  insightsGolden('lesson_help_entry', () => const _Step(), size: _size, overrides: () => _overrides(_wallet(9)));

  insightsGolden('lesson_help_entry_empty', () => const _Step(), size: _size, overrides: () => _overrides(_wallet(0)));

  insightsGolden('lesson_help_ask', () => const _Open(), size: _size, overrides: () => _overrides(_wallet(9)));

  insightsGolden(
    'lesson_help_writing',
    () => const _Open(),
    size: _size,
    overrides: () => _overrides(_wallet(9), const LessonHelpState(phase: HelpPhase.sending, question: LessonHelpCopy.defaultQuestion)),
  );

  insightsGolden(
    'lesson_help_answered',
    () => const _Open(),
    size: _size,
    overrides: () => [
      ..._overrides(
        _wallet(8),
        const LessonHelpState(
          phase: HelpPhase.answered,
          question: LessonHelpCopy.defaultQuestion,
          reply:
              'Think of goodwill as the price of a reputation. Two shops hold the same stock and fittings, '
              'but one has queues every evening. A buyer pays more for that one. The extra is goodwill: '
              'the amount paid above the value of the net assets, because the firm earns more than usual. '
              'In your lesson it is shown as the difference between the purchase price and the net assets taken over.',
          charged: 1,
          left: 8,
        ),
      ),
    ],
  );

  insightsGolden('lesson_help_no_credits', () => const _Open(), size: _size, overrides: () => _overrides(_wallet(0)));

  insightsGolden(
    'lesson_help_failed',
    () => const _Open(),
    size: _size,
    overrides: () => [
      ..._overrides(
        _wallet(9),
        const LessonHelpState(phase: HelpPhase.failed, question: LessonHelpCopy.defaultQuestion, failure: HelpFailure.unavailable),
      ),
    ],
  );
}
