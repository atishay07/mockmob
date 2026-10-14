import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/art/art.dart';
import '../../core/auth/auth_state.dart';
import '../../core/connectivity/connectivity.dart';
import '../../core/models/practice_quote.dart';
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
import 'widgets/choice_deck.dart';
import 'widgets/choice_glyphs.dart';
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

  // The last quote each row's facts came from. A new subject starts a new, slow quote; until
  // it answers the rows stay as they were, so nothing under the thumb jumps. A row leaves only
  // when a quote says the mode is not offered.
  PracticeQuote? _lastFull;
  PracticeQuote? _lastSmart;
  PracticeQuote? _lastNta;

  // The page stages one entrance when it first opens (MmStagger). The modes deck waits for the
  // blocks above it that once; a deck that rises again for a new subject does not wait at all.
  bool _entered = false;
  static const int _deckSlot = 5;

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

  /// Full mock and NTA mode side by side; a Full mock alone across the band when the exam-day
  /// layout is not offered.
  ChoiceRow _examRow({required ChoiceOption full, ChoiceOption? nta}) => nta == null ? ChoiceRow.wide(full) : ChoiceRow.pair(full, nta);

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
    final full = _lastFull =
        ref.watch(practiceQuoteProvider(PracticeSelection(mode: PracticeMode.full, subjectId: subject).quoteQuery)).value ?? _lastFull;
    final nta = _lastNta =
        ref.watch(practiceQuoteProvider(QuoteQuery(subject: subject, apiMode: 'nta', count: mockQuestionCount))).value ?? _lastNta;
    final showNta = nta != null && quoteOffersMode(nta);
    final ntaGated = nta != null && costLineFor(nta).kind == CostKind.proGated;
    final smartQuery = PracticeSelection(mode: PracticeMode.smart, subjectId: subject).quoteQuery;
    final smart = _lastSmart = ref.watch(practiceQuoteProvider(smartQuery)).value ?? _lastSmart;
    final showSmart = smart != null && quoteOffersMode(smart);
    final smartGated = smart != null && costLineFor(smart).kind == CostKind.proGated;
    final stale = ref.watch(staleSubjectsProvider);
    final counts = ref.watch(questionCountsProvider).value;
    final fullMinutes = full?.durationSec == null ? null : (full!.durationSec! / 60).round();

    final bottom = MediaQuery.paddingOf(context).bottom;
    const gutter = EdgeInsets.symmetric(horizontal: MmSpace.gutter);
    final deckDelay = _entered ? Duration.zero : Motion.staggerStep * _deckSlot;
    _entered = true;

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
                // One authored entrance, in reading order: the header, the suggestion, the subjects,
                // the subject line, then the modes deck (its own rows) and the shelves.
                child: MmStagger(
                  child: ListView(
                    controller: _scroll,
                    padding: EdgeInsets.only(top: MmRhythm.screenTop, bottom: bottom + MmSpace.s32),
                    children: [
                      const MmStaggerItem(
                        index: 0,
                        child: Padding(
                          padding: gutter,
                          child: TabRootHeader(title: PracticeCopy.tabTitle),
                        ),
                      ),
                      const SizedBox(height: MmSpace.s16),
                      if (offline) ...[
                        const Padding(
                          padding: gutter,
                          child: InlineBanner(message: PracticeCopy.offlineStart, tone: BannerTone.offline),
                        ),
                        const SizedBox(height: MmSpace.s16),
                      ],
                      if (stale.isNotEmpty) ...[
                        Padding(
                          padding: gutter,
                          child: StaleSubjectsBanner(entries: stale),
                        ),
                        const SizedBox(height: MmSpace.s16),
                      ],
                      const MmStaggerItem(
                        index: 1,
                        child: Padding(padding: gutter, child: SuggestionHero()),
                      ),
                      const SizedBox(height: MmRhythm.section),
                      MmStaggerItem(
                        index: 2,
                        child: Padding(
                          padding: gutter,
                          child: SectionHeading(
                            title: PracticeCopy.chooseOwn,
                            action: PracticeCopy.editSubjects,
                            onAction: () => openEditSubjects(context),
                          ),
                        ),
                      ),
                      const SizedBox(height: MmRhythm.item),
                      MmStaggerItem(
                        index: 3,
                        child: SubjectTiles(
                          choices: choices,
                          selectedId: subject,
                          countFor: (id) => counts?[internalSubjectFor(id, catalog)],
                          onSelected: (id) => ref.read(practiceSubjectProvider.notifier).select(id),
                          onMore: others.isEmpty ? null : () => _pickOther(others),
                        ),
                      ),
                      const SizedBox(height: MmSpace.s16),
                      // One list entry for the subject line and the modes, so the modes are built
                      // with the subject line even when the page is long (large text, short phone).
                      Padding(
                        padding: gutter,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            MmStaggerItem(
                              index: 4,
                              child: _SubjectLine(
                                subjectId: subject,
                                name: subjectNameFor(subject, catalog),
                                questions: counts?[internalSubjectFor(subject, catalog)],
                              ),
                            ),
                            const SizedBox(height: MmRhythm.item),
                            ChoiceDeck(
                              startDelay: deckDelay,
                              // Keyed by subject, so a new subject's deck rises in again: the modes
                              // below visibly belong to the subject just picked.
                              key: ValueKey('modes-$subject'),
                              bleed: MmSpace.gutter,
                              rows: [
                                ChoiceRow.pair(
                                  ChoiceOption(
                                    id: 'quick',
                                    glyph: ChoiceGlyphKind.quick,
                                    title: PracticeCopy.quickTitle,
                                    note: PracticeCopy.quickLine,
                                    onTap: () => _confirm(PracticeSelection(mode: PracticeMode.quick, subjectId: subject)),
                                  ),
                                  ChoiceOption(
                                    id: 'chapter',
                                    glyph: ChoiceGlyphKind.chapter,
                                    title: PracticeCopy.chapterTitle,
                                    note: PracticeCopy.chapterLine,
                                    onTap: () => _chapter(subject),
                                  ),
                                ),
                                if (showSmart)
                                  ChoiceRow.wide(
                                    ChoiceOption(
                                      id: 'smart',
                                      glyph: ChoiceGlyphKind.smart,
                                      title: PracticeCopy.smartTitle,
                                      tag: smartGated ? PracticeCopy.proTag : null,
                                      note: smartGated ? PracticeCopy.smartGatedLine : PracticeCopy.smartLine,
                                      onTap: () => _confirm(PracticeSelection(mode: PracticeMode.smart, subjectId: subject)),
                                    ),
                                  ),
                                ChoiceRow.band(
                                  title: PracticeCopy.examBandTitle,

                                  rows: [
                                    _examRow(
                                      full: ChoiceOption(
                                        id: 'full',
                                        glyph: ChoiceGlyphKind.mock,
                                        title: PracticeCopy.fullMockTitle,
                                        note: PracticeCopy.fullMockLine(questions: mockQuestionCount, minutes: fullMinutes),
                                        onTap: () => _confirm(PracticeSelection(mode: PracticeMode.full, subjectId: subject)),
                                      ),
                                      nta: showNta
                                          ? ChoiceOption(
                                              id: 'nta',
                                              glyph: ChoiceGlyphKind.nta,
                                              title: PracticeCopy.ntaTitle,
                                              tag: ntaGated ? PracticeCopy.proTag : null,
                                              note: ntaGated ? PracticeCopy.ntaGatedLine : PracticeCopy.ntaLine,
                                              // The exam's own instructions page: the clock starts only after it.
                                              onTap: () => context.push(NtaRoutes.location(subject)),
                                            )
                                          : null,
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: MmSpace.group),
                      MmStaggerItem(
                        index: 6,
                        child: Padding(
                          padding: gutter,
                          child: PracticeMoreRows(subject: subject),
                        ),
                      ),
                      const ConceptsShelf(),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The line over the modes that says which subject they start in: the subject's glyph on its
/// own light, "In Business Studies", and how many questions it has when that is known. It
/// cross-fades when the subject changes, so the choice is seen where the modes are.
class _SubjectLine extends StatelessWidget {
  const _SubjectLine({required this.subjectId, required this.name, this.questions});

  final String subjectId;
  final String name;
  final int? questions;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return AnimatedSwitcher(
      duration: Motion.of(context, Motion.ui),
      switchInCurve: Motion.glide,
      switchOutCurve: Motion.exit,
      layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
      child: Semantics(
        key: ValueKey(subjectId),
        container: true,
        label: PracticeCopy.subjectLineSemantics(name, questions),
        excludeSemantics: true,
        child: Row(
          children: [
            SubjectEmblem(subject: subjectId, size: 32, framed: false),
            const SizedBox(width: MmSpace.s8),
            Flexible(child: Text(PracticeCopy.subjectLine(name), style: type.labelLarge)),
            if (questions != null) ...[
              const SizedBox(width: MmSpace.s8),
              Text(PracticeCopy.questionsAvailable(questions!), style: type.caption.copyWith(color: colors.ink3)),
            ],
          ],
        ),
      ),
    );
  }
}
