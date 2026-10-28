import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api.dart';
import '../../core/connectivity/connectivity.dart';
import '../../core/auth/auth_state.dart';
import '../../core/models/practice_quote.dart';
import '../../core/motion/motion.dart';
import '../../core/repositories/session_draft_repository.dart';
import '../../core/router/app_shell.dart';
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import 'copy.dart';
import 'data/practice_catalog.dart';
import 'data/practice_quote.dart';
import 'model/cost_line.dart';
import 'model/practice_selection.dart';
import 'widgets/mode_row.dart';
import 'widgets/other_subjects_sheet.dart';
import 'widgets/resume_slot.dart';
import 'widgets/subject_chips.dart';

/// The Practice tab (spec 5.4): a subject, then the ways to start, each with the cost the quote
/// states for that subject. Rows open `/practice/setup/:mode`.
class PracticeScreen extends ConsumerStatefulWidget {
  const PracticeScreen({super.key});

  @override
  ConsumerState<PracticeScreen> createState() => _PracticeScreenState();
}

class _PracticeScreenState extends ConsumerState<PracticeScreen> {
  final ScrollController _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  ModeCost _costOf(AsyncValue<PracticeQuote> quote) {
    if (quote.isLoading && !quote.hasValue) return const ModeCost.loading();
    final q = quote.value;
    if (q == null) return const ModeCost.none();
    final line = costLineFor(q);
    return switch (line.kind) {
      CostKind.none => const ModeCost.none(),
      CostKind.proGated => const ModeCost.none(),
      CostKind.blocked => ModeCost.text(line.text!, emphasis: false),
      _ => ModeCost.text(line.text!),
    };
  }

  String _minutesLine(PracticeQuote? q, String Function({int questions, int minutes}) make) {
    final seconds = q?.durationSec;
    return seconds == null ? make() : make(questions: q!.count ?? mockQuestionCount, minutes: (seconds / 60).round());
  }

  void _open(PracticeMode mode, String subject) =>
      context.push(Uri(path: AppRoutes.practiceSetup(mode.name), queryParameters: {'subject': subject}).toString());

  Future<void> _pickOther(List<SubjectChoice> others) async {
    final id = await showOtherSubjects(context, others);
    if (id != null) ref.read(practiceSubjectProvider.notifier).select(id);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(tabReselectProvider, (_, event) {
      if (event?.tabIndex == 1 && _scroll.hasClients) {
        _scroll.animateTo(0, duration: Motion.of(context, Motion.card), curve: Motion.out);
      }
    });

    final colors = context.mmColors;
    final type = context.mmType;
    final subject = ref.watch(practiceSubjectProvider);
    final auth = ref.watch(authSnapshotProvider);
    final catalog = ref.watch(practiceSubjectsProvider).value;
    final choices = subjectChoices(chosen: auth.subjects, selected: subject, catalog: catalog);
    final others = otherSubjects(shown: choices, catalog: catalog);
    final offline = ref.watch(networkStatusProvider) == NetworkStatus.offline;

    final full = ref.watch(
      practiceQuoteProvider(QuoteQuery(subject: subject, apiMode: 'full', count: mockQuestionCount, purpose: 'full_sample')),
    );
    final quick = ref.watch(practiceQuoteProvider(QuoteQuery(subject: subject, apiMode: 'quick', count: defaultPracticeCount)));
    final nta = ref.watch(practiceQuoteProvider(QuoteQuery(subject: subject, apiMode: 'nta', count: mockQuestionCount)));

    final draft = ref.watch(latestSessionDraftProvider).value;
    final now = ref.watch(nowProvider)();
    final showResume = canContinue(draft, now);

    final ntaQuote = nta.value;
    final showNta = ntaQuote != null && quoteOffersMode(ntaQuote);
    final ntaGated = ntaQuote != null && costLineFor(ntaQuote).kind == CostKind.proGated;

    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        bottom: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
            child: ListView(
              controller: _scroll,
              padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, MmSpace.s32),
              children: [
                Semantics(header: true, child: Text(PracticeCopy.tabTitle, style: type.headline)),
                const SizedBox(height: MmSpace.s20),
                if (offline) ...[_OfflineNote(text: PracticeCopy.offlineStart), const SizedBox(height: MmSpace.s20)],
                if (showResume) ...[
                  ResumeSlot(draft: draft!, onContinue: () => context.go(AppRoutes.run(draft.sessionId))),
                  const SizedBox(height: MmSpace.group),
                ],
                SubjectChips(
                  choices: choices,
                  selectedId: subject,
                  onSelected: (id) => ref.read(practiceSubjectProvider.notifier).select(id),
                  onOther: others.isEmpty ? null : () => _pickOther(others),
                ),
                const SizedBox(height: MmSpace.group),
                ModeRow(
                  featured: true,
                  title: PracticeCopy.fullMockTitle,
                  line: _minutesLine(full.value, PracticeCopy.fullMockLine),
                  cost: _costOf(full),
                  glyphCount: mockQuestionCount,
                  onTap: () => _open(PracticeMode.full, subject),
                ),
                const SizedBox(height: MmSpace.s24),
                ModeRow(
                  title: PracticeCopy.quickTitle,
                  line: PracticeCopy.quickLine,
                  cost: _costOf(quick),
                  glyphCount: 10,
                  onTap: () => _open(PracticeMode.quick, subject),
                ),
                const RowDivider(),
                ModeRow(
                  title: PracticeCopy.chapterTitle,
                  line: PracticeCopy.chapterModeLine,
                  // Chapter practice costs exactly what Quick practice costs.
                  cost: _costOf(quick),
                  glyphCount: 5,
                  onTap: () => _open(PracticeMode.chapter, subject),
                ),
                if (showNta) ...[
                  const RowDivider(),
                  ModeRow(
                    title: PracticeCopy.ntaTitle,
                    line: ntaGated ? PracticeCopy.partOfProAlternative : _minutesLine(ntaQuote, PracticeCopy.ntaLine),
                    cost: ntaGated ? const ModeCost.none() : _costOf(nta),
                    glyphCount: mockQuestionCount,
                    locked: ntaGated,
                    onTap: () => _open(PracticeMode.nta, subject),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OfflineNote extends StatelessWidget {
  const _OfflineNote({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: ExcludeSemantics(child: Icon(LucideIcons.wifiOff, size: 18, color: colors.ink2)),
        ),
        const SizedBox(width: MmSpace.s12),
        Expanded(
          child: Text(text, style: context.mmType.body.copyWith(color: colors.ink)),
        ),
      ],
    );
  }
}
