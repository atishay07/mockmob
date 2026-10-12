import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/domain/session_rules.dart';
import '../../../core/models/session_draft.dart';
import '../../../core/repositories/session_draft_repository.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/practice_catalog.dart';

/// Answer counts of one stored session, read from its journal.
final draftSummaryProvider = FutureProvider.autoDispose.family<DraftSummary?, String>((ref, sessionId) async {
  final drafts = ref.watch(sessionDraftRepositoryProvider);
  final draft = await drafts.bySessionId(sessionId);
  return draft == null ? null : drafts.summaryOf(draft);
});

/// True when [draft] can still be continued right now.
bool canContinue(SessionDraft? draft, DateTime now) =>
    draft != null && resumableDraft(draft, sessionId: draft.sessionId, nowMs: now.millisecondsSinceEpoch);

/// A session that is still open, offered before a second one is started. A mock shows when it
/// ends (a fixed time, so it never needs a ticking clock here); a practice shows its answers.
class ResumeSlot extends ConsumerWidget {
  const ResumeSlot({super.key, required this.draft, required this.onContinue});

  final SessionDraft draft;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final catalog = ref.watch(practiceSubjectsProvider).value;
    final subject = subjectNameFor(draft.subject, catalog);
    final String text;
    if (draft.isMock) {
      final label = draft.mockNumber == null ? 'Your mock' : 'Mock ${draft.mockNumber}';
      text = PracticeCopy.resumeMock(label, subject, DateTime.fromMillisecondsSinceEpoch(draft.endsAtWallMs));
    } else {
      final summary = ref.watch(draftSummaryProvider(draft.sessionId)).value;
      text = PracticeCopy.resumePractice(subject, summary?.answered ?? 0, draft.view.questions.length);
    }
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.raised2,
        borderRadius: MmRadius.panelAll,
        border: Border.all(color: colors.line),
      ),
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.cardPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(text, style: type.body),
            const SizedBox(height: MmSpace.s16),
            KeyButton.secondary(label: PracticeCopy.resumeKey, onPressed: onContinue),
          ],
        ),
      ),
    );
  }
}
