import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/api_providers.dart';
import '../copy/formatters.dart';
import '../domain/session_rules.dart';
import '../models/session_draft.dart';
import '../repositories/session_draft_repository.dart';
import '../motion/motion.dart';
import '../theme/theme.dart';
import '../widgets/dock/morph_sheet_route.dart' show MorphSheetRoute;
import '../widgets/bubbles/sheet_glyph.dart';
import '../widgets/materials/lit_edge.dart';
import '../widgets/mobi.dart';
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

/// The open session Start can resume, known at once from the live draft, so the sheet draws its
/// Resume row on the first frame. Its answer count follows in [resumeOfferProvider].
final resumeDraftProvider = Provider.autoDispose<SessionDraft?>((ref) {
  final draft = ref.watch(latestSessionDraftProvider).value;
  final now = ref.watch(nowProvider)();
  if (draft == null || !resumableDraft(draft, sessionId: draft.sessionId, nowMs: now.millisecondsSinceEpoch)) return null;
  return draft;
});

final resumeOfferProvider = FutureProvider.autoDispose<ResumeOffer?>((ref) async {
  final draft = ref.watch(resumeDraftProvider);
  if (draft == null) return null;
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
/// is one) and Ask your record, never more than five rows. Costs are not
/// here; they live on the confirm sheet each choice opens.
class QuickStartSheet extends ConsumerWidget {
  const QuickStartSheet({super.key});

  static String titleFor(DateTime now) => isEvening(now) ? "What's it going to be tonight?" : "Pick today's work";

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    // The Resume row is decided from the live draft on the first frame; only its answer count
    // waits for the journal, so the lit edge never jumps from Quick 10 to Resume.
    final offer = ref.watch(resumeOfferProvider).value;
    final draft = offer?.draft ?? ref.watch(resumeDraftProvider);
    final answered = offer != null && draft != null && offer.draft.sessionId == draft.sessionId ? offer.answered : null;
    final repair = ref.watch(quickStartRepairProvider);
    final nta = ref.watch(quickStartNtaProvider);
    final now = ref.watch(nowProvider)();
    final reduced = Motion.reduced(context);

    void go(String location) {
      final router = GoRouter.of(context);
      Navigator.of(context).pop();
      // Screens that sit outside the tab shell are pushed over it, so system Back returns to the
      // tab the student started from instead of closing the app. Screens inside a tab's own
      // stack (Practice setup, a repair under Review) keep `go`, which switches to that tab.
      if (QuickStartSheet.opensOutsideShell(location)) {
        unawaited(router.push<void>(location));
      } else {
        router.go(location);
      }
    }

    // The sheet never grows past the screen: the header stays put and the rows scroll, so no row
    // is clipped on a short phone or at large text.
    final media = MediaQuery.of(context);
    final maxHeight = (media.size.height - media.viewPadding.top - media.viewPadding.bottom - 2 * MorphSheetRoute.margin).clamp(
      0.0,
      double.infinity,
    );

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxHeight),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, MmSpace.s12),
        child: AnimatedSize(
          duration: reduced ? Duration.zero : Motion.ui,
          curve: Motion.glide,
          alignment: Alignment.topCenter,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // The same grab handle as every other sheet: it drags down to close.
              Center(
                child: SizedBox(
                  width: 36,
                  height: 4,
                  child: DecoratedBox(
                    decoration: BoxDecoration(color: context.mmColors.ink4, borderRadius: MmRadius.pillAll),
                  ),
                ),
              ),
              const SizedBox(height: MmSpace.s12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: MmSpace.s4),
                        child: Semantics(header: true, child: Text(titleFor(now), style: type.screenTitle.copyWith(fontSize: 24))),
                      ),
                    ),
                    const SizedBox(width: MmSpace.s8),
                    // Mobi weighs the choice with the student; it never sits in the dock itself.
                    const _SettleIn(child: Mobi(pose: MobiPose.think, size: 52)),
                  ],
                ),
              ),
              const SizedBox(height: MmSpace.s12),
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (draft != null) ...[
                        QuickStartRow(
                          key: const ValueKey('quick-start-resume'),
                          glyph: SheetGlyph.resume,
                          // The title never changes when the answered count resolves; the count lives on the
                          // note line, which already holds a sentence.
                          title: 'Resume ${subjectDisplayName(draft.subject)} ${draft.isMock ? 'mock' : 'practice'}',
                          note: draft.isMock
                              ? 'Ends at ${formatTime12(DateTime.fromMillisecondsSinceEpoch(draft.endsAtWallMs))}.'
                                    '${answered == null ? '' : ' $answered of ${draft.view.questions.length} answered.'}'
                              : answered == null
                              ? 'Pick up where you left off.'
                              : 'Pick up at $answered of ${draft.view.questions.length}.',
                          lit: true,
                          noteLines: 2,
                          onTap: () => go(AppRoutes.run(draft.sessionId)),
                        ),
                        const SizedBox(height: MmSpace.s8),
                      ],
                      QuickStartRow(
                        glyph: SheetGlyph.quick,
                        title: 'Quick 10',
                        note: '10 questions, about 10 minutes.',
                        lit: draft == null,
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
                      if (draft == null || nta == null || repair == null) ...[
                        const SizedBox(height: MmSpace.s8),
                        QuickStartRow(
                          glyph: SheetGlyph.ask,
                          title: 'Ask your record',
                          note: 'Questions about your marks and chapters, answered from what you have done.',
                          onTap: () => go(AppRoutes.ask),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Whether [location] is a top-level screen outside the tab shell (it has no tab beneath it,
  /// so `go` would leave nothing to go back to).
  @visibleForTesting
  static bool opensOutsideShell(String location) {
    final path = Uri.parse(location).path;
    return path == AppRoutes.ask || path == AppRoutes.examNta || path.startsWith('/run/');
  }
}

/// Mobi's 420 ms settle into the sheet header: rises 6 dp and grows from 0.96. Still under
/// reduced motion.
class _SettleIn extends StatelessWidget {
  const _SettleIn({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Mobi.settleDuration,
      curve: Motion.emphasized,
      child: child,
      builder: (context, t, child) => Transform.translate(
        offset: Offset(0, 6 * (1 - t)),
        child: Transform.scale(scale: 0.96 + 0.04 * t, alignment: Alignment.bottomCenter, child: child),
      ),
    );
  }
}

/// One choice of the quick-start sheet: a bubble glyph in a 40 dp tile, the title and a note.
/// The first choice carries the lit edge (the one light in the sheet).
class QuickStartRow extends StatelessWidget {
  const QuickStartRow({
    super.key,
    required this.glyph,
    required this.title,
    required this.note,
    required this.onTap,
    this.lit = false,
    this.noteLines = 1,
  });

  final SheetGlyph glyph;
  final String title;
  final String note;
  final VoidCallback onTap;
  final bool lit;

  /// Note lines the row always reserves. The Resume row reserves two, so its note can grow when
  /// the count lands without moving the rows below.
  final int noteLines;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    Widget row(bool pressed) => DecoratedBox(
      decoration: ShapeDecoration(
        color: pressed ? colors.ink.withValues(alpha: 0.08) : colors.ink.withValues(alpha: colors.isNight ? 0.04 : 0.03),
        shape: RoundedSuperellipseBorder(
          borderRadius: MmRadius.keyAll,
          side: BorderSide(color: colors.ink.withValues(alpha: 0.08)),
        ),
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
                    ConstrainedBox(
                      constraints: BoxConstraints(
                        minHeight: noteLines <= 1
                            ? 0
                            : MediaQuery.textScalerOf(context).scale(type.caption.height! * type.caption.fontSize!) * noteLines,
                      ),
                      child: Text(note, style: type.caption.copyWith(color: colors.ink2)),
                    ),
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
