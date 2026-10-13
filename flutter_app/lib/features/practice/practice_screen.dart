import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_state.dart';
import '../../core/connectivity/connectivity.dart';
import '../../core/motion/motion.dart';
import '../../core/router/app_shell.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../runner/runner_routes.dart' show NtaRoutes;
import 'copy.dart';
import 'data/practice_catalog.dart';
import 'data/practice_quote.dart';
import 'model/cost_line.dart';
import 'model/practice_selection.dart';
import 'widgets/chapter_picker.dart';
import 'widgets/concepts_shelf.dart';
import 'widgets/confirm_sheet.dart';
import 'widgets/mode_list.dart';
import 'widgets/more_rows.dart';
import 'widgets/other_subjects_sheet.dart';
import 'widgets/stale_subjects_banner.dart';
import 'widgets/subject_tiles.dart';
import 'widgets/suggestion_hero.dart';

/// The Practice tab (brief 12): one suggested session at the top, lit, with the reason from the
/// student's own record; then "Choose your own" (subject, mode, and the length on the confirm
/// sheet); then the Concepts shelf when study content is on. No cost appears on this screen.
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

  void _confirm(PracticeSelection selection) => showPracticeConfirm(context, selection: selection);

  Future<void> _chapter(String subject) async {
    final names = await showChapterPicker(context, subjectId: subject);
    if (names != null && names.isNotEmpty && mounted) {
      _confirm(PracticeSelection(mode: PracticeMode.chapter, subjectId: subject, chapters: names));
    }
  }

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
    final subject = ref.watch(practiceSubjectProvider);
    final auth = ref.watch(authSnapshotProvider);
    final catalog = ref.watch(practiceSubjectsProvider).value;
    final choices = subjectChoices(chosen: auth.subjects, selected: subject, catalog: catalog);
    final others = otherSubjects(shown: choices, catalog: catalog);
    final offline = ref.watch(networkStatusProvider) == NetworkStatus.offline;

    // Only what the rows need: the mock's length, and whether the exam-day layout is offered.
    final full = ref.watch(practiceQuoteProvider(PracticeSelection(mode: PracticeMode.full, subjectId: subject).quoteQuery)).value;
    final nta = ref.watch(practiceQuoteProvider(QuoteQuery(subject: subject, apiMode: 'nta', count: mockQuestionCount))).value;
    final showNta = nta != null && quoteOffersMode(nta);
    final ntaGated = nta != null && costLineFor(nta).kind == CostKind.proGated;
    final smartQuery = PracticeSelection(mode: PracticeMode.smart, subjectId: subject).quoteQuery;
    final smart = ref.watch(practiceQuoteProvider(smartQuery)).value;
    final showSmart = smart != null && quoteOffersMode(smart);
    final smartGated = smart != null && costLineFor(smart).kind == CostKind.proGated;
    final stale = ref.watch(staleSubjectsProvider);
    final counts = ref.watch(questionCountsProvider).value;
    final fullMinutes = full?.durationSec == null ? null : (full!.durationSec! / 60).round();

    final bottom = MediaQuery.paddingOf(context).bottom;
    const gutter = EdgeInsets.symmetric(horizontal: MmSpace.gutter);

    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          // The room's lamp, pooling from the upper left behind the header and the suggestion.
          Positioned(top: 0, left: 0, right: 0, height: 420, child: IgnorePointer(child: LightField.lamp(context, strength: 0.8))),
          SafeArea(
            bottom: false,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                child: ListView(
                  controller: _scroll,
                  padding: EdgeInsets.only(top: MmSpace.s8, bottom: bottom + MmSpace.s32),
                  children: [
                    const Padding(padding: gutter, child: TabRootHeader(title: PracticeCopy.tabTitle)),
                    const SizedBox(height: MmSpace.s16),
                    if (offline) ...[
                      const Padding(padding: gutter, child: InlineBanner(message: PracticeCopy.offlineStart, tone: BannerTone.offline)),
                      const SizedBox(height: MmSpace.s16),
                    ],
                    if (stale.isNotEmpty) ...[
                      Padding(padding: gutter, child: StaleSubjectsBanner(entries: stale)),
                      const SizedBox(height: MmSpace.s16),
                    ],
                    const Padding(padding: gutter, child: SuggestionHero()),
                    const SizedBox(height: MmSpace.group + MmSpace.s8),
                    Padding(
                      padding: gutter,
                      child: SectionHeading(
                        title: PracticeCopy.chooseOwn,
                        action: PracticeCopy.editSubjects,
                        onAction: () => openEditSubjects(context),
                      ),
                    ),
                    const SizedBox(height: MmSpace.s12),
                    SubjectTiles(
                      choices: choices,
                      selectedId: subject,
                      countFor: (id) => counts?[internalSubjectFor(id, catalog)],
                      onSelected: (id) => ref.read(practiceSubjectProvider.notifier).select(id),
                      onMore: others.isEmpty ? null : () => _pickOther(others),
                    ),
                    const SizedBox(height: MmSpace.s16),
                    Padding(
                      padding: gutter,
                      child: ModeList(
                        choices: [
                          ModeChoice(
                            icon: ModeIcons.quick,
                            title: PracticeCopy.quickTitle,
                            line: PracticeCopy.quickLine,
                            onTap: () => _confirm(PracticeSelection(mode: PracticeMode.quick, subjectId: subject)),
                          ),
                          ModeChoice(
                            icon: ModeIcons.chapter,
                            title: PracticeCopy.chapterTitle,
                            line: PracticeCopy.chapterLine,
                            onTap: () => _chapter(subject),
                          ),
                          if (showSmart)
                            ModeChoice(
                              icon: ModeIcons.smart,
                              title: PracticeCopy.smartTitle,
                              tag: smartGated ? PracticeCopy.proTag : null,
                              line: smartGated ? PracticeCopy.smartGatedLine : PracticeCopy.smartLine,
                              onTap: () => _confirm(PracticeSelection(mode: PracticeMode.smart, subjectId: subject)),
                            ),
                          ModeChoice(
                            icon: ModeIcons.full,
                            title: PracticeCopy.fullMockTitle,
                            line: PracticeCopy.fullMockLine(questions: mockQuestionCount, minutes: fullMinutes),
                            onTap: () => _confirm(PracticeSelection(mode: PracticeMode.full, subjectId: subject)),
                          ),
                          if (showNta)
                            ModeChoice(
                              icon: ModeIcons.nta,
                              title: PracticeCopy.ntaTitle,
                              tag: ntaGated ? PracticeCopy.proTag : null,
                              line: ntaGated ? PracticeCopy.ntaGatedLine : PracticeCopy.ntaLine(questions: mockQuestionCount),
                              chips: PracticeCopy.ntaChips,
                              // The exam's own instructions page: the clock starts only after it.
                              onTap: () => context.push(NtaRoutes.location(subject)),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: MmSpace.group),
                    Padding(padding: gutter, child: PracticeMoreRows(subject: subject)),
                    const ConceptsShelf(),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
