import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../api/api_providers.dart';
import '../copy/formatters.dart';
import '../domain/session_rules.dart';
import '../models/session_draft.dart';
import '../repositories/session_draft_repository.dart';
import '../theme/theme.dart';
import '../widgets/pressable.dart';
import 'routes.dart';

/// The open session Start offers to resume, with its answer count, or null.
class ResumeOffer {
  const ResumeOffer({required this.draft, required this.answered});

  final SessionDraft draft;
  final int answered;

  int get total => draft.view.questions.length;
}

final resumeOfferProvider = FutureProvider.autoDispose<ResumeOffer?>((ref) async {
  final draft = ref.watch(latestSessionDraftProvider).value;
  final now = ref.watch(nowProvider)();
  if (draft == null || !resumableDraft(draft, sessionId: draft.sessionId, nowMs: now.millisecondsSinceEpoch)) return null;
  final summary = await ref.watch(sessionDraftRepositoryProvider).summaryOf(draft);
  return ResumeOffer(draft: draft, answered: summary.answered);
});

/// Display names of the launch subjects (the catalogue lives in Practice; Start only needs the
/// four Commerce subjects and General Test).
String subjectDisplayName(String id) => switch (id) {
      'accountancy' => 'Accountancy',
      'business_studies' => 'Business Studies',
      'economics' => 'Economics',
      'english' => 'English',
      'general_test' => 'General Test',
      _ => id.isEmpty ? 'your' : id[0].toUpperCase() + id.substring(1).replaceAll('_', ' '),
    };

/// The quick-start sheet that Start morphs into: resume the open session when there is one,
/// then Quick 10, Full mock and Repair the next mistake. Costs are not here; they live on the
/// confirm sheet each choice opens.
class QuickStartSheet extends ConsumerWidget {
  const QuickStartSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final offer = ref.watch(resumeOfferProvider).value;

    void go(String location) {
      final router = GoRouter.of(context);
      Navigator.of(context).pop();
      router.go(location);
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s20, MmSpace.s16, MmSpace.s12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
            child: Semantics(header: true, child: Text('Start something', style: type.screenTitle.copyWith(fontSize: 24))),
          ),
          const SizedBox(height: MmSpace.s16),
          if (offer != null) ...[
            QuickStartRow(
              icon: LucideIcons.play,
              title: 'Resume ${subjectDisplayName(offer.draft.subject)} ${offer.draft.isMock ? 'mock' : 'practice'}, '
                  '${offer.answered} of ${offer.total}',
              note: offer.draft.isMock
                  ? 'Ends at ${formatTime12(DateTime.fromMillisecondsSinceEpoch(offer.draft.endsAtWallMs))}.'
                  : 'Pick up where you left off.',
              lit: true,
              onTap: () => go(AppRoutes.run(offer.draft.sessionId)),
            ),
            const SizedBox(height: MmSpace.s8),
          ],
          QuickStartRow(
            icon: LucideIcons.zap,
            title: 'Quick 10',
            note: '10 questions, about 10 minutes.',
            lit: offer == null,
            onTap: () => go(Uri(path: AppRoutes.practiceSetup('quick'), queryParameters: {'count': '10'}).toString()),
          ),
          const SizedBox(height: MmSpace.s8),
          QuickStartRow(
            icon: LucideIcons.fileText,
            title: 'Full mock',
            note: '50 questions, 60 minutes, timed like the exam.',
            onTap: () => go(AppRoutes.practiceSetup('full')),
          ),
          const SizedBox(height: MmSpace.s8),
          QuickStartRow(
            icon: LucideIcons.wrench,
            title: 'Repair the next mistake',
            note: 'A worked explanation, then a fresh check.',
            onTap: () => go(AppRoutes.reviewMistakes),
          ),
        ],
      ),
    );
  }
}

/// One choice of the quick-start sheet: a glyph in a small well, the title and a note, and a
/// chevron. The first choice carries the volt glyph well (the one light in the sheet).
class QuickStartRow extends StatelessWidget {
  const QuickStartRow({super.key, required this.icon, required this.title, required this.note, required this.onTap, this.lit = false});

  final IconData icon;
  final String title;
  final String note;
  final VoidCallback onTap;
  final bool lit;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: '$title. $note',
      focusRadius: MmRadius.keyAll,
      onTap: onTap,
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: pressed ? colors.ink.withValues(alpha: 0.08) : colors.ink.withValues(alpha: colors.isNight ? 0.04 : 0.03),
          shape: RoundedSuperellipseBorder(borderRadius: MmRadius.keyAll, side: BorderSide(color: colors.ink.withValues(alpha: 0.08))),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 68),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s12),
            child: Row(
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: lit ? colors.volt : colors.ink.withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                  child: SizedBox.square(
                    dimension: 40,
                    child: Icon(icon, size: 20, color: lit ? colors.voltInk : colors.ink),
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(title, style: type.labelLarge),
                      const SizedBox(height: 2),
                      Text(note, style: type.caption.copyWith(color: colors.ink2)),
                    ],
                  ),
                ),
                Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
