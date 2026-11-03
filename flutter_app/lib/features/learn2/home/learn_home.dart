import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/action_router.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../keycards/data/keycards_providers.dart' show keyCardsApiProvider, keyCardsHomeProvider;
import '../../practice/data/practice_catalog.dart' show practiceSubjectProvider, subjectNameFor;
import '../../pro_nudge/pro_nudge.dart' show ProReason, proNudgesOnProvider, showUpgradeSheetIfOn;
import '../cards/find_view.dart';
import '../data/learn_models.dart';
import '../data/learn_providers.dart';
import '../learn2_links.dart';
import 'chapter_map.dart';
import 'find_home.dart';
import 'home_copy.dart';
import 'home_entrance.dart';
import 'home_model.dart';
import 'roadmap_offer.dart';
import 'search_field.dart';
import 'shelf_set.dart';
import 'subject_row.dart';

/// Learn home, embedded in Practice's Learn door (the web's LearnHome.jsx, phone band, rounds 2 to 4): blocks in a column, no
/// scaffold and no scroll of its own (Practice owns the title, the pull and the scroll).
///
///   Subject     one picker row that opens a sheet (ruling R1); choosing writes the shared practice subject
///   The offer   one start, from the server's roadmap: "Start learning Accountancy" / "Start chapter 1 · 10 min", the pick-up,
///               "Today's 10 minutes", or Free's "That was today's free session."; at most two quiet Or rows (LK27)
///   Search      "Find a topic, like goodwill": focusing it opens Find in place (the student's sets as rows, or a word to try),
///               typing opens the results, Cancel returns
///   Roadmap     "Your roadmap": the chapters in book order with their coverage, the part switch and the sort menu
///
/// Every number and line comes from ONE read, `GET /api/learn/home` (the subject body plus the shelves); nothing is made up here.
/// [subject] (a link's own) wins over the remembered one and is written to the shared practice subject. [find] opens with the field
/// ready to type in, and [query] opens the results of that search.
class LearnHome extends ConsumerStatefulWidget {
  const LearnHome({super.key, this.subject, this.find = false, this.query});

  final String? subject;
  final bool find;
  final String? query;

  @override
  ConsumerState<LearnHome> createState() => _LearnHomeState();
}

class _LearnHomeState extends ConsumerState<LearnHome> {
  final TextEditingController _text = TextEditingController();
  final FocusNode _focus = FocusNode();
  final GlobalKey _fieldKey = GlobalKey(debugLabel: 'learn-home-field');

  /// The open shelf set (due | missed | revise | must), or null.
  String? _shelf;

  /// The page's scroll before the field docked, restored on Cancel.
  double? _before;

  /// The entrance has played (once per visit); the skeleton was drawn first (so the offer only rises).
  bool _played = false;
  bool _sawSkeleton = false;

  @override
  void initState() {
    super.initState();
    _text.text = _clip(widget.query);
    _text.addListener(_changed);
    _focus.addListener(_focusChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _followLink();
      if (widget.find && _text.text.isEmpty) _focus.requestFocus();
    });
  }

  @override
  void didUpdateWidget(LearnHome old) {
    super.didUpdateWidget(old);
    // A new link to this same page replaces what is open; the student's own typing never does.
    if (widget.query != old.query) {
      // This runs while the page builds: the new words need no rebuild of their own.
      _text.removeListener(_changed);
      _text.text = _clip(widget.query);
      _text.addListener(_changed);
      if (_text.text.isNotEmpty) _shelf = null;
    }
    if (widget.subject != old.subject) WidgetsBinding.instance.addPostFrameCallback((_) => mounted ? _followLink() : null);
    if (widget.find && !old.find && _text.text.isEmpty) _focus.requestFocus();
  }

  @override
  void dispose() {
    _text.removeListener(_changed);
    _focus.removeListener(_focusChanged);
    _text.dispose();
    _focus.dispose();
    super.dispose();
  }

  static String _clip(String? q) {
    final s = (q ?? '').trim();
    return s.length > HomeSearchField.maxLength ? s.substring(0, HomeSearchField.maxLength) : s;
  }

  /// The link's own subject always wins over the remembered one.
  void _followLink() {
    final id = widget.subject;
    if (id == null || id.isEmpty) return;
    if (ref.read(learnSubjectIdProvider) == id) return;
    ref.read(practiceSubjectProvider.notifier).select(id);
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  void _focusChanged() {
    if (!mounted) return;
    setState(() {});
    if (_focus.hasFocus) WidgetsBinding.instance.addPostFrameCallback((_) => mounted ? _dock() : null);
  }

  /// On a phone the field docks near the top of the page when it takes focus, so the keyboard does not cover what
  /// follows. Never scrolls up; Cancel puts the page back where it was.
  void _dock() {
    final ctx = _fieldKey.currentContext;
    if (ctx == null || !_focus.hasFocus) return;
    final scrollable = Scrollable.maybeOf(ctx);
    final object = ctx.findRenderObject();
    if (scrollable == null || object == null) return;
    final viewport = RenderAbstractViewport.maybeOf(object);
    if (viewport == null) return;
    final position = scrollable.position;
    final target = viewport.getOffsetToReveal(object, 0).offset - MmSpace.s8;
    if (target <= position.pixels + 1) return;
    _before ??= position.pixels;
    _scrollTo(position, target);
  }

  /// The page's scroll to [offset]: eased over 240 ms, or at once when the student asked for less motion.
  void _scrollTo(ScrollPosition position, double offset) {
    final to = offset.clamp(position.minScrollExtent, position.maxScrollExtent);
    final duration = Motion.of(context, const Duration(milliseconds: 240));
    if (duration == Duration.zero) {
      position.jumpTo(to);
    } else {
      unawaited(position.animateTo(to, duration: duration, curve: Motion.out));
    }
  }

  /// Puts the page back where it was before the field docked, once the home blocks have their height again (the page is
  /// shorter while Find is open, and would clamp the offset).
  void _restoreScroll() {
    final before = _before;
    _before = null;
    if (before == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final ctx = _fieldKey.currentContext;
      final scrollable = ctx == null ? null : Scrollable.maybeOf(ctx);
      if (scrollable != null) _scrollTo(scrollable.position, before);
    });
  }

  void _cancel() {
    _text.clear();
    _focus.unfocus();
    setState(() => _shelf = null);
    _restoreScroll();
  }

  void _typed(String value) {
    if (value.isNotEmpty && _shelf != null) setState(() => _shelf = null);
  }

  void _openShelf(String? id) {
    _text.clear();
    _focus.unfocus();
    setState(() => _shelf = id);
  }

  /// A word to try: the field takes it and Find shows its results, the keyboard stays.
  void _search(String word) {
    _text.value = TextEditingValue(text: word, selection: TextSelection.collapsed(offset: word.length));
    _focus.requestFocus();
  }

  void _pick(String id) {
    if (id == ref.read(learnSubjectIdProvider)) return;
    ref.read(practiceSubjectProvider.notifier).select(id);
  }

  /// The home read again: after a run (a start, an answer or an end moves the counts) and for Try again.
  void _reread() => ref.invalidate(learnSubjectProvider(ref.read(learnSubjectIdProvider)));

  Future<void> _go(String location) async {
    // A door of Practice (Explore) opens in place: this page is already one.
    if (Learn2Links.opensInPlace(location)) {
      context.go(location);
      return;
    }
    await context.push<void>(location);
    // A run moves every count on this page (due, missed, in Revise, a chapter's state): read them all again.
    if (mounted) invalidateLearnReads(ref.invalidate);
  }

  void _openChapter(String key) => unawaited(_go(Learn2Links.chapter(key)));

  void _openRun(RunLaunch launch) => unawaited(_go(Learn2Links.run(launch)));

  /// A run a key names starts at once: a feed goes to the feed, any other kind to the run; a run left unfinished carries its id, so
  /// the key picks it up where it stopped.
  void _openRunSpec(LearnRunSpec run) {
    if (run.kind == LearnKinds.feed) {
      unawaited(_go(Learn2Links.feed(FeedLaunch(chapterKey: run.chapterKey, minutes: run.minutes ?? 10, runId: run.resume))));
      return;
    }
    unawaited(
      _go(
        Learn2Links.run(
          RunLaunch(
            chapterKey: run.chapterKey,
            minutes: run.minutes ?? 10,
            kind: run.kind,
            leaveOut: run.leaveOut,
            cardIds: run.cardIds,
            runId: run.resume,
            fresh: run.fresh,
          ),
        ),
      ),
    );
  }

  /// The offer's key, or one of its Or rows: a run starts at once, Explore and an href open where the server says, "See Pro"
  /// opens the Pro sheet where Pro nudges are on.
  void _openOffer(LearnOption option) {
    switch (HomeModel.target(option)) {
      case HomeRunTarget(:final run):
        _openRunSpec(run);
      case HomeExploreTarget():
        unawaited(_go(Learn2Links.explore(subject: ref.read(learnSubjectIdProvider))));
      case HomeProTarget():
        showUpgradeSheetIfOn(context, reason: ProReason.keycards);
      case HomeHrefTarget(:final href):
        final location = Learn2Links.resolve(href) ??
            switch (ActionRouter.resolve(href)) {
              NativeTarget(:final location) => location,
              _ => null,
            };
        if (location != null) unawaited(_go(location));
      case null:
        break;
    }
  }

  /// Saves the part choice (LK2) and reads the home again; true when the new body says the choice stuck.
  Future<bool> _saveOption(LearnPart part, String optionId) async {
    final id = ref.read(learnSubjectIdProvider);
    try {
      await ref.read(keyCardsApiProvider).setOption(subject: id, option: optionId);
      ref.invalidate(keyCardsHomeProvider);
      ref.invalidate(learnSubjectProvider(id));
      final fresh = await ref.read(learnSubjectProvider(id).future);
      for (final p in fresh.parts) {
        if (p.id == part.id) return p.option?.chosen == optionId;
      }
      return false;
    } on Object {
      return false;
    }
  }

  List<LearnSubjectRef> _subjects(LearnSubjectData? data, String current) {
    // Drawn at once from the profile; the server's own list (the student's subjects, their order) replaces it.
    final profile = [for (final id in ref.watch(authSnapshotProvider.select((a) => a.subjects))) LearnSubjectRef(id: id, name: subjectNameFor(id, null))];
    final server = data?.subjects ?? const <LearnSubjectRef>[];
    // The same subjects keep the order already drawn, so the picker never swaps places under the finger when the read lands.
    final same = profile.isNotEmpty && server.length == profile.length && server.every((s) => profile.any((p) => p.id == s.id));
    final list = same
        ? [for (final p in profile) LearnSubjectRef(id: p.id, name: server.firstWhere((s) => s.id == p.id).name)]
        : (server.isNotEmpty ? server : profile);
    return list.any((s) => s.id == current) ? list : [...list, LearnSubjectRef(id: current, name: subjectNameFor(current, null))];
  }

  @override
  Widget build(BuildContext context) {
    final subjectId = ref.watch(learnSubjectIdProvider);
    final read = ref.watch(learnSubjectProvider(subjectId));
    final data = read.value;
    final nudges = ref.watch(proNudgesOnProvider);

    final failed = read.hasError && data == null;
    final ready = data != null;
    final subjects = _subjects(data, subjectId);
    final subjectName = HomeModel.displayTitle(data?.subject.name ?? subjects.firstWhere((s) => s.id == subjectId).name);
    final text = _text.text;
    final typing = text.trim().isNotEmpty;
    final mode = typing ? _Mode.results : (_shelf != null ? _Mode.set : (_focus.hasFocus ? _Mode.find : _Mode.chapters));
    final showCancel = _focus.hasFocus || text.isNotEmpty || _shelf != null;
    final searching = mode == _Mode.find || mode == _Mode.results;

    // The offer leads the page (LK27); while Find or a set is open it steps aside and the field leads.
    Widget offer = const SizedBox.shrink();
    if (mode == _Mode.chapters) {
      final roadmap = data?.roadmap;
      if (ready && roadmap != null) {
        final entrance = !_played;
        if (entrance) WidgetsBinding.instance.addPostFrameCallback((_) => _played = true);
        offer = Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: HomeEntrance(
            play: entrance,
            fade: !_sawSkeleton,
            child: RoadmapOffer(roadmap: roadmap, onOpen: _openOffer, nudges: nudges),
          ),
        );
      } else if (!ready && !failed) {
        _sawSkeleton = true;
        offer = const Padding(padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: RoadmapOfferSkeleton());
      }
    }

    final Widget panel;
    final String panelKey;
    switch (mode) {
      case _Mode.results:
        panelKey = 'results';
        panel = Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          // Find reads its own results: this page gives it the field's text.
          child: FindPanel(subject: subjectId, query: text),
        );
      case _Mode.find:
        panelKey = 'find';
        panel = failed
            ? Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: HomeLoadError(onRetry: _reread, busy: read.isLoading))
            : !ready
                ? const Padding(
                    padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter),
                    child: SkeletonGroup(label: HomeCopy.loading, child: ChapterMapSkeleton()),
                  )
                : Padding(
                    padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
                    child: FindHome(subject: subjectId, shelves: data.shelves, onShelf: _openShelf, onSearch: _search),
                  );
      case _Mode.set:
        panelKey = 'set';
        panel = HomeShelfSet(
          subject: subjectId,
          shelf: _shelf!,
          shelves: data?.shelves,
          onShelf: (id) => setState(() => _shelf = id),
          onBack: () => setState(() => _shelf = null),
          onOpenChapter: _openChapter,
          onRun: _openRun,
        );
      case _Mode.chapters:
        if (failed) {
          panelKey = 'error';
          panel = Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: HomeLoadError(onRetry: _reread, busy: read.isLoading),
          );
        } else if (ready) {
          panelKey = 'chapters';
          panel = Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: ChapterMap(
              parts: data.parts,
              onOpen: _openChapter,
              onSaveOption: _saveOption,
              isPro: data.isPro,
              position: data.roadmap?.position?.chapterKey,
              isNew: data.roadmap?.isNew ?? data.isNew,
            ),
          );
        } else {
          panelKey = 'skeleton';
          panel = const Padding(
            padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: SkeletonGroup(label: HomeCopy.loading, child: ChapterMapSkeleton()),
          );
        }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!searching)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 4, MmSpace.gutter, 14),
            child: LearnSubjectPicker(subjects: subjects, current: subjectId, onPick: _pick, busy: !ready && !failed),
          ),
        // The region's name for a screen reader: the chosen subject.
        Semantics(header: true, container: true, label: subjectName),
        offer,
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, 10),
          child: KeyedSubtree(
            key: _fieldKey,
            child: HomeSearchField(
              controller: _text,
              focusNode: _focus,
              placeholder: HomeModel.findPlaceholder(data?.subject.id ?? subjectId),
              showCancel: showCancel,
              onChanged: _typed,
              onCancel: _cancel,
            ),
          ),
        ),
        if (ready && data.subject.note != null && mode == _Mode.chapters)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 4, MmSpace.gutter, 20),
            child: Text(data.subject.note!, style: context.mmType.body.copyWith(fontSize: 14, height: 1.5, fontWeight: FontWeight.w500, color: context.mmColors.ink2)),
          ),
        MmOverlapSwitcher.fade(
          alignment: Alignment.topCenter,
          child: KeyedSubtree(key: ValueKey('lh-panel-$panelKey'), child: panel),
        ),
      ],
    );
  }
}

enum _Mode { chapters, find, results, set }
