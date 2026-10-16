import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_state.dart';
import '../../core/connectivity/connectivity.dart';
import '../../core/repositories/attempts_repository.dart';
import '../../core/models/practice_quote.dart';
import '../../core/motion/motion.dart';
import '../../core/router/app_shell.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../runner/runner_routes.dart' show NtaRoutes;
import 'copy.dart';
import 'data/practice_catalog.dart';
import 'data/practice_quote.dart';
import 'data/suggestion.dart';
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
import 'widgets/plain_notice.dart';
import 'widgets/practice_mobi.dart';
import 'widgets/stale_subjects_banner.dart';
import 'widgets/subject_tiles.dart';
import 'widgets/suggestion_hero.dart';

/// The Practice tab (L08, brief app-practice-review-1016 section 2): the subject first ("Practise
/// in", the tiles), then "Up next in [subject]", the one lit start, about that same subject; then
/// "Ways to practise" shortest to longest (Quick practice and By chapter, Smart practice, the
/// Exam conditions band with Full mock and NTA mode); then "More ways in" and the Concepts shelf.
/// One subject state drives the tiles, the card and the modes. No cost appears on this screen.
class PracticeScreen extends ConsumerStatefulWidget {
  const PracticeScreen({super.key});

  /// How long a pull waits for the server before it calls the refresh failed (a quote can take
  /// many seconds on this server, so the bound is past the ring's own 12 s "still refreshing"). A
  /// read that fails is tried again in the background and a retrying read never completes, so
  /// without a bound the ring would turn on a dead connection; the page keeps what it had and says so.
  static const Duration refreshTimeout = Duration(seconds: 15);

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

  // The page stages one entrance when it first opens (MmStagger), in reading order: header 0,
  // subject strip 1, suggestion 2, "Ways to practise" 3, the deck 4, More 5. The deck waits for
  // the blocks above it that once; it never rises again for a new subject.
  bool _entered = false;
  static const int _deckSlot = 4;

  /// Mobi lives in the header: the screen drives his looks and his thinking, the widget owns his
  /// quiet clock and his tap. The entrance is decided once (a wave the first time today).
  final MobiController _mobi = MobiController();
  late final MobiAct _entrance;
  final GlobalKey _heroKey = GlobalKey(debugLabel: 'practice-hero-start');
  Timer? _lookBack;

  /// Counts that were last read, kept when a refresh cannot read them, so they never vanish.
  Map<String, int>? _lastCounts;

  /// The last pull failed: a plain notice with a Retry shows under the header.
  bool _refreshFailed = false;
  bool _refreshing = false;

  @override
  void initState() {
    super.initState();
    // Asked once, here: asking consumes the day's hello.
    _entrance = MobiRation.greeting('practice');
  }

  @override
  void dispose() {
    _lookBack?.cancel();
    _mobi.dispose();
    _scroll.dispose();
    super.dispose();
  }

  /// Mobi looks at the tile just tapped, then back ahead.
  void _lookAtTile(Offset global) {
    _mobi.lookAt(global);
    _lookBack?.cancel();
    _lookBack = Timer(const Duration(milliseconds: 1600), () {
      if (mounted) _mobi.lookAt(null);
    });
  }

  /// The pull: subjects, counts, the suggestion's papers and the three quote families, read
  /// again. A failure empties the ring (the widget's own) and says so under the header.
  Future<void> _refresh() async {
    setState(() {
      _refreshFailed = false;
      _refreshing = true;
    });
    try {
      await _readAgain().timeout(PracticeScreen.refreshTimeout);
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  Future<void> _readAgain() async {
    final subject = ref.read(practiceSubjectProvider);
    final queries = <QuoteQuery>[
      PracticeSelection(mode: PracticeMode.full, subjectId: subject).quoteQuery,
      QuoteQuery(subject: subject, apiMode: 'nta', count: mockQuestionCount),
      PracticeSelection(mode: PracticeMode.smart, subjectId: subject).quoteQuery,
    ];
    ref.invalidate(practiceSuggestionProvider);
    // Every read starts together and none of them can throw past this point: each answer is
    // judged below, so a late failure never escapes as an unhandled error.
    Future<bool> read(Future<Object?> f) => f.then<bool>((_) => true, onError: (Object _) => false);
    final subjectsRead = read(ref.refresh(practiceSubjectsProvider.future));
    final countsRead = ref.refresh(questionCountsProvider.future).then<Map<String, int>?>((m) => m, onError: (Object _) => null);
    final quotesRead = [for (final q in queries) read(ref.refresh(practiceQuoteProvider(q).future))];
    final attemptsRead = read(ref.read(attemptsRepositoryProvider.notifier).refresh());
    final subjectsOk = await subjectsRead;
    final fresh = await countsRead;
    await attemptsRead;
    final answered = await Future.wait(quotesRead);
    if (!subjectsOk) throw StateError('subjects');
    // The counts read comes back empty when it failed; with counts already on screen, that is a failure.
    if ((fresh == null || fresh.isEmpty) && (_lastCounts?.isNotEmpty ?? false)) throw StateError('counts');
    if (answered.isNotEmpty && !answered.contains(true)) throw StateError('quotes');
  }

  void _onRefreshFailed(Object _) {
    if (mounted) setState(() => _refreshFailed = true);
  }

  void _retryRefresh() => unawaited(_refresh().catchError(_onRefreshFailed));

  static String _suggestionId(PracticeSuggestion s) => switch (s) {
    ResumeSuggestion(:final draft) => 'resume:${draft.sessionId}',
    ChapterSuggestion(:final chapter, :final attempt) => 'chapter:${s.subjectId}:$chapter:${attempt.id}',
    SubjectSuggestion(:final attempt) => 'subject:${s.subjectId}:${attempt.id}',
    StartingSuggestion() => 'start:${s.subjectId}',
  };

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

    // Mobi nods once when the card lands for a new subject or a new paper (brief 2.9), never on
    // the first frame and never for the same suggestion read again.
    ref.listen(practiceSuggestionProvider, (prev, next) {
      if (prev == null || _suggestionId(prev) == _suggestionId(next)) return;
      _mobi.react(MobiAct.nod, key: 'practice:hero');
    });

    final colors = context.mmColors;
    final subject = ref.watch(practiceSubjectProvider);
    final auth = ref.watch(authSnapshotProvider);
    final catalog = ref.watch(practiceSubjectsProvider).value;
    final choices = subjectChoices(chosen: auth.subjects, selected: subject, catalog: catalog);
    final others = otherSubjects(shown: choices, catalog: catalog);
    // Offline shows in the lit card itself (its Start goes quiet and says why); a session that is
    // already on this phone resumes without the server, so only then does a banner say it.
    final offline = ref.watch(networkStatusProvider) == NetworkStatus.offline && ref.watch(practiceSuggestionProvider) is ResumeSuggestion;

    // Only what the rows need: the mock's length, and whether the exam-day layout is offered.
    final fullAsync = ref.watch(practiceQuoteProvider(PracticeSelection(mode: PracticeMode.full, subjectId: subject).quoteQuery));
    final ntaAsync = ref.watch(practiceQuoteProvider(QuoteQuery(subject: subject, apiMode: 'nta', count: mockQuestionCount)));
    final full = _lastFull = fullAsync.value ?? _lastFull;
    final nta = _lastNta = ntaAsync.value ?? _lastNta;
    final showNta = nta != null && quoteOffersMode(nta);
    final ntaGated = nta != null && costLineFor(nta).kind == CostKind.proGated;
    final smartQuery = PracticeSelection(mode: PracticeMode.smart, subjectId: subject).quoteQuery;
    final smartAsync = ref.watch(practiceQuoteProvider(smartQuery));
    final smart = _lastSmart = smartAsync.value ?? _lastSmart;
    // Mobi thinks while the quotes for this subject have not answered (a quote can take seconds).
    final quotesLoading = (fullAsync.isLoading && !fullAsync.hasValue) || (smartAsync.isLoading && !smartAsync.hasValue);
    final showSmart = smart != null && quoteOffersMode(smart);
    final smartGated = smart != null && costLineFor(smart).kind == CostKind.proGated;
    final stale = ref.watch(staleSubjectsProvider);
    final fetchedCounts = ref.watch(questionCountsProvider).value;
    final counts = _lastCounts = (fetchedCounts != null && fetchedCounts.isNotEmpty) ? fetchedCounts : (_lastCounts ?? fetchedCounts);
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
          // It tints toward the picked subject's light over 400 ms, so the room answers the tap.
          Positioned(top: 0, left: 0, right: 0, height: 420, child: IgnorePointer(child: _SubjectLamp(subjectId: subject))),
          SafeArea(
            bottom: false,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                // One authored entrance, in reading order: the header, the suggestion, the subject
                // line and the quick pair, the heading, the subjects, then the longer modes (their
                // own rows) and the shelves.
                child: MmStagger(
                  // The app's own pull (MOTION.md C10): the ring is the only thing that answers it,
                  // so the platform's stretch is off and the figures roll from what they showed.
                  child: MmPullRefresh(
                    onRefresh: _refresh,
                    onError: _onRefreshFailed,
                    child: ScrollConfiguration(
                      behavior: ScrollConfiguration.of(context).copyWith(overscroll: false),
                  child: ListView(
                    // Back from a result or a setup lands where the student left the list.
                    key: const PageStorageKey<String>('practice-tab-list'),
                    controller: _scroll,
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: EdgeInsets.only(top: MmRhythm.screenTop, bottom: bottom + MmSpace.s32),
                    children: [
                      MmStaggerItem(
                        index: 0,
                        child: Padding(
                          padding: gutter,
                          child: TabRootHeader(
                            title: PracticeCopy.tabTitle,
                            // 44 dp Mobi, resident: no bubble on this tab, he reacts.
                            trailing: PracticeMobi(
                              controller: _mobi,
                              entrance: _entrance,
                              loading: quotesLoading || _refreshing,
                              aim: _heroKey,
                            ),
                          ),
                        ),
                      ),
                      // 8 to the "Practise in" row: its 40 dp Edit subjects key holds air of its own above
                      // the words; a notice under the header keeps the full 16.
                      SizedBox(height: _refreshFailed || offline || stale.isNotEmpty ? MmSpace.s16 : MmSpace.s8),
                      if (_refreshFailed) ...[
                        Padding(
                          padding: gutter,
                          child: PlainNotice(
                            message: PracticeCopy.refreshFailed,
                            tone: BannerTone.error,
                            actionLabel: PracticeCopy.retry,
                            onAction: _retryRefresh,
                          ),
                        ),
                        const SizedBox(height: MmSpace.s16),
                      ],
                      if (offline) ...[
                        const Padding(
                          padding: gutter,
                          child: PlainNotice(message: PracticeCopy.offlineStart, tone: BannerTone.offline),
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
                      // C. The subject first (L08): the strip chooses the subject every block under it
                      // is about, so no mode ever sits above the control that chooses its subject.
                      MmStaggerItem(
                        index: 1,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Padding(
                              padding: gutter,
                              child: SectionHeading(
                                title: PracticeCopy.practiseIn,
                                action: PracticeCopy.editSubjects,
                                onAction: () => openEditSubjects(context),
                              ),
                            ),
                            // Straight to the tiles: the heading row's key leaves about 8 under the words and
                            // the strip holds 4 more as room for the chosen tile's lift, so the words sit 12
                            // over the tiles without a spacer.
                            // The tiles' objects lean with the page's own scroll (not the strip's
                            // sideways one), as the objects in the cards below do.
                            MmParallax(
                              factor: 0,
                              lean: true,
                              child: SubjectTiles(
                                choices: choices,
                                selectedId: subject,
                                countFor: (id) => counts?[internalSubjectFor(id, catalog)],
                                onSelected: (id) => ref.read(practiceSubjectProvider.notifier).select(id),
                                onPickedAt: _lookAtTile,
                                onMore: others.isEmpty ? null : () => _pickOther(others),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: MmSpace.s16),
                      // D. Up next in the lit subject: the one volt key on the page.
                      MmStaggerItem(
                        index: 2,
                        child: Padding(padding: gutter, child: SuggestionHero(actionKey: _heroKey, compact: true)),
                      ),
                      const SizedBox(height: MmRhythm.group),
                      // E. Ways to practise, shortest to longest, in one deck: the quick pair, Smart
                      // practice, then the exam band. Not keyed by subject: a new subject keeps the
                      // modes in place and only their notes cross-fade (L08).
                      const MmStaggerItem(
                        index: 3,
                        child: Padding(padding: gutter, child: SectionHeading(title: PracticeCopy.waysHeading)),
                      ),
                      const SizedBox(height: MmRhythm.item),
                      Padding(
                        padding: gutter,
                        child: ChoiceDeck(
                          startDelay: deckDelay,
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
                              // Quick practice leads; By chapter steps back (one primary, one secondary).
                              weighted: true,
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
                              foot: PracticeCopy.bankLine(
                                pro: auth.isPro,
                                subject: subjectNameFor(subject, catalog),
                                questions: counts?[internalSubjectFor(subject, catalog)],
                              ),
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
                      ),
                      // The exam band closes with its own rule, so the next section opens on air alone.
                      const SizedBox(height: MmSpace.s32),
                      // F. More ways in: the question stream and the Admission Compass.
                      MmStaggerItem(
                        index: 5,
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
            ),
          ),
        ],
      ),
    );
  }
}

/// The room's lamp behind the header and the suggestion. It tints toward the picked subject's
/// light over 400 ms (a third of the way, so it stays the room's lamp and never a coloured
/// wash), and never moves: opacity and colour of one painter, in a RepaintBoundary.
class _SubjectLamp extends StatelessWidget {
  const _SubjectLamp({required this.subjectId});

  final String subjectId;

  /// How far the lamp's colour travels toward the subject's light.
  static const double tint = 0.34;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final brightness = Theme.of(context).brightness;
    final light = (SubjectLight.forSubject(subjectId) ?? SubjectLight.language).of(brightness);
    final target = Color.lerp(colors.lamp, light, tint)!;
    final alpha = (colors.isNight ? 0.2 : 0.14) * 0.8;
    return TweenAnimationBuilder<Color?>(
      tween: ColorTween(end: target),
      duration: Motion.of(context, const Duration(milliseconds: 400)),
      curve: Motion.glide,
      builder: (context, color, _) => LightField(
        pools: [LightPool(color: (color ?? target).withValues(alpha: alpha), center: const Alignment(-1, -1.1), radius: 1.05)],
      ),
    );
  }
}
