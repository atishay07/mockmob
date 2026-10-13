import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/api_providers.dart';
import '../copy/formatters.dart';
import '../domain/session_rules.dart';
import '../models/session_draft.dart';
import '../repositories/session_draft_repository.dart';
import '../theme/theme.dart';
import '../widgets/bubbles/sheet_glyph.dart';
import '../widgets/materials/lit_edge.dart';
import '../widgets/pressable.dart';
import 'routes.dart';

export '../widgets/bubbles/sheet_glyph.dart' show SheetGlyph;

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

/// Where Start's "Repair the next mistake" goes: tonight's first mistake (the pick Today and
/// Review make). Null hides the row. `main.dart` wires it to Review's index.
class QuickRepair {
  const QuickRepair({required this.location, required this.chapter});

  final String location;
  final String chapter;
}

final quickStartRepairProvider = Provider<QuickRepair?>((ref) => null);

/// Start's "NTA mode" row: the exam-day screen in the student's practice subject, when the
/// server offers that mode. Null hides the row. `main.dart` wires it to Practice's quote.
class QuickNta {
  const QuickNta({required this.location, required this.subject, required this.proOnly});

  final String location;
  final String subject;

  /// The quote says this needs Pro: the row carries a quiet Pro tag and still opens the
  /// instructions page, which explains (there is no purchase path in the app).
  final bool proOnly;
}

final quickStartNtaProvider = Provider<QuickNta?>((ref) => null);

/// The quick-start sheet that Start morphs into: resume the open session when there is one,
/// then Quick 10, Full mock, NTA mode (when offered), Repair the next mistake (only when there
/// is one) and Ask Mobi, never more than five rows. Costs are not
/// here; they live on the confirm sheet each choice opens.
class QuickStartSheet extends ConsumerWidget {
  const QuickStartSheet({super.key});

  static String titleFor(DateTime now) => isEvening(now) ? "What's it going to be tonight?" : "Pick today's work";

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final offer = ref.watch(resumeOfferProvider).value;
    final repair = ref.watch(quickStartRepairProvider);
    final nta = ref.watch(quickStartNtaProvider);
    final now = ref.watch(nowProvider)();

    void go(String location) {
      final router = GoRouter.of(context);
      Navigator.of(context).pop();
      router.go(location);
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, MmSpace.s12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // The same grab handle as every other sheet: it drags down to close.
          Center(
            child: SizedBox(
              width: 36,
              height: 4,
              child: DecoratedBox(decoration: BoxDecoration(color: context.mmColors.ink4, borderRadius: MmRadius.pillAll)),
            ),
          ),
          const SizedBox(height: MmSpace.s16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
            child: Semantics(header: true, child: Text(titleFor(now), style: type.screenTitle.copyWith(fontSize: 24))),
          ),
          const SizedBox(height: MmSpace.s16),
          if (offer != null) ...[
            QuickStartRow(
              glyph: SheetGlyph.resume,
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
            glyph: SheetGlyph.quick,
            title: 'Quick 10',
            note: '10 questions, about 10 minutes.',
            lit: offer == null,
            onTap: () => go(Uri(path: AppRoutes.practiceSetup('quick'), queryParameters: {'count': '10'}).toString()),
          ),
          const SizedBox(height: MmSpace.s8),
          QuickStartRow(
            glyph: SheetGlyph.mock,
            title: 'Full mock',
            note: '50 questions, 60 minutes, timed like the exam.',
            onTap: () => go(AppRoutes.practiceSetup('full')),
          ),
          if (nta != null) ...[
            const SizedBox(height: MmSpace.s8),
            QuickStartRow(
              glyph: SheetGlyph.exam,
              title: nta.proOnly ? 'NTA mode, with Pro' : 'NTA mode',
              note: 'The exam-day screen in ${subjectDisplayName(nta.subject)}: palette, Mark for Review.',
              onTap: () => go(nta.location),
            ),
          ],
          if (repair != null) ...[
            const SizedBox(height: MmSpace.s8),
            QuickStartRow(
              glyph: SheetGlyph.repair,
              title: 'Repair the next mistake',
              note: 'A worked explanation for your next mistake, in ${repair.chapter}.',
              onTap: () => go(repair.location),
            ),
          ],
          // Never more than five rows: Ask gives way to a resume.
          if (offer == null || nta == null || repair == null) ...[
            const SizedBox(height: MmSpace.s8),
            QuickStartRow(
              glyph: SheetGlyph.ask,
              title: 'Ask Mobi',
              note: 'Questions about your marks and chapters, answered from your record.',
              onTap: () => go(AppRoutes.ask),
            ),
          ],
        ],
      ),
    );
  }
}

/// One choice of the quick-start sheet: a bubble glyph in a 40 dp tile, the title and a note.
/// The first choice carries the lit edge (the one light in the sheet).
class QuickStartRow extends StatelessWidget {
  const QuickStartRow({super.key, required this.glyph, required this.title, required this.note, required this.onTap, this.lit = false});

  final SheetGlyph glyph;
  final String title;
  final String note;
  final VoidCallback onTap;
  final bool lit;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    Widget row(bool pressed) => DecoratedBox(
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
                  SheetGlyphTile(glyph),
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
                ],
              ),
            ),
          ),
        );
    return MmPressable(
      semanticsLabel: '$title. $note',
      focusRadius: MmRadius.keyAll,
      onTap: onTap,
      builder: (context, pressed, _) => lit ? LitEdge(borderRadius: MmRadius.keyAll, child: row(pressed)) : row(pressed),
    );
  }
}
