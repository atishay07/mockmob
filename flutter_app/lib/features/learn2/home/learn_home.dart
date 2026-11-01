import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

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
import 'home_copy.dart';
import 'home_entrance.dart';
import 'home_model.dart';
import 'search_field.dart';
import 'shelf_keys.dart';
import 'shelf_set.dart';
import 'subject_row.dart';
import 'suggestions.dart';

/// Learn home, embedded in Practice's Learn door (the web's LearnHome.jsx, phone band): blocks in a column, no scaffold and
/// no scroll of its own (Practice owns the title, the pull and the scroll).
///
///   Subjects    the student's own subjects as objects with "9 due"; choosing writes the shared practice subject
///   Search      "Search 868 Key cards": focusing or typing opens Find in place under it, with a Cancel key
///   Shelves     "9 due today", "6 missed lately", "26 in Revise": a tile opens that set in place
///   Where to start  the server's three suggestions (the first leads, with the page's one volt key)
///   Chapters    the book in order, with the part switch and the sort menu
///
/// Every number and line comes from `GET /api/learn/subject` and `/shelves`; nothing is made up here. [subject] (a link's
/// own) wins over the remembered one and is written to the shared practice subject. [find] opens with the field ready to
/// type in, and [query] opens the results of that search.
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

  /// The entrance has played (once per visit); the skeleton was drawn first (so the rows only rise).
  bool _played = false;
  bool _sawSkeleton = false;

  /// The last due counts the shelves read gave, kept while another subject's read is on its way.
  Map<String, int>? _dues;

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
      _text.text = _clip(widget.query);
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

  void _pick(String id) {
    if (id == ref.read(learnSubjectIdProvider)) return;
    ref.read(practiceSubjectProvider.notifier).select(id);
  }

  /// Every read of this subject again: after a run (a start, an answer or an end moves the counts) and for Try again.
  void _reread() {
    final id = ref.read(learnSubjectIdProvider);
    ref.invalidate(learnSubjectProvider(id));
    ref.invalidate(learnShelvesProvider(id));
  }

  Future<void> _go(String location) async {
    await context.push<void>(location);
    // A run moves every count on this page (due, missed, in Revise, a chapter's state): read them all again.
    if (mounted) invalidateLearnReads(ref.invalidate);
  }

  void _openChapter(String key) => unawaited(_go(Learn2Links.chapter(key)));

  void _openRun(RunLaunch launch) => unawaited(_go(Learn2Links.run(launch)));

  /// A suggestion's key starts at once: a run goes to the run, a feed to the feed, an href as the server wrote it.
  void _openSuggestion(LearnSuggestion s) {
    switch (HomeModel.suggestionTarget(s)) {
      case HomeRunTarget(:final run):
        if (run.kind == LearnKinds.feed) {
          unawaited(_go(Learn2Links.feed(FeedLaunch(chapterKey: run.chapterKey, minutes: run.minutes ?? 10, runId: run.resume))));
        } else {
          unawaited(
            _go(
              Learn2Links.run(
                RunLaunch(
                  chapterKey: run.chapterKey,
                  minutes: run.minutes ?? 10,
                  kind: run.kind,
                  leaveOut: run.leaveOut,
                  cardIds: run.cardIds,
                  // A run left unfinished carries its id, so the key picks it up where it stopped.
                  runId: run.resume,
                  fresh: run.fresh,
                ),
              ),
            ),
          );
        }
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
    // The same subjects keep the order already drawn, so the row never swaps places under the finger when the read lands.
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
    final shelvesRead = ref.watch(learnShelvesProvider(subjectId));
    final data = read.value;
    final shelves = shelvesRead.value;
    if (shelves != null && shelves.due.bySubject.isNotEmpty) _dues = shelves.due.bySubject;

    final failed = read.hasError && data == null;
    final shelvesSettled = shelvesRead.hasValue || shelvesRead.hasError;
    final ready = data != null && shelvesSettled;
    final subjects = _subjects(data, subjectId);
    final subjectName = HomeModel.displayTitle(data?.subject.name ?? subjects.firstWhere((s) => s.id == subjectId).name);
    final hasCards = !(ready && data.subject.cards == 0);
    final text = _text.text;
    final typing = text.trim().isNotEmpty;
    final mode = typing ? _Mode.find : (_shelf != null ? _Mode.set : (_focus.hasFocus ? _Mode.find : _Mode.chapters));
    final showCancel = _focus.hasFocus || text.isNotEmpty || _shelf != null;

    // The tiles, the keys and Free's line arrive in one frame: the page waits for the shelves too (a failed read does not
    // hold it), so nothing drawn moves when the second read lands.
    Widget keys = const SizedBox.shrink();
    if (hasCards && !failed) {
      if (shelves != null) {
        keys = HomeShelfKeys(keys: HomeModel.shelfKeys(shelves, subjectName), selected: _shelf, onSelect: (id) => id == null ? setState(() => _shelf = null) : _openShelf(id));
      } else if (shelvesRead.hasError) {
        keys = HomeShelfLine(text: HomeCopy.shelvesFailed, action: HomeCopy.tryAgain, onAction: _reread);
      } else {
        keys = const HomeShelfKeysSkeleton();
      }
    }

    final Widget panel;
    final String panelKey;
    switch (mode) {
      case _Mode.find:
        panelKey = 'find';
        panel = Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          // Find reads its own results: this page gives it the field's text.
          child: FindPanel(subject: subjectId, query: text),
        );
      case _Mode.set:
        panelKey = 'set';
        panel = HomeShelfSet(
          subject: subjectId,
          shelf: _shelf!,
          shelves: shelves,
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
          final list = HomeModel.homeSuggestions(data.suggestions);
          final entrance = !_played;
          if (entrance) WidgetsBinding.instance.addPostFrameCallback((_) => _played = true);
          panel = Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: HomeEntrance(
              play: entrance,
              fade: !_sawSkeleton,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (list.isNotEmpty) ...[
                    HomeSuggestions(suggestions: data.suggestions, onOpen: _openSuggestion),
                    const SizedBox(height: 28),
                  ],
                  ChapterMap(parts: data.parts, firstIndex: list.length, onOpen: _openChapter, onSaveOption: _saveOption),
                ],
              ),
            ),
          );
        } else {
          panelKey = 'skeleton';
          _sawSkeleton = true;
          panel = const Padding(
            padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: SkeletonGroup(
              label: HomeCopy.loading,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [HomeSuggestionsSkeleton(), SizedBox(height: 28), ChapterMapSkeleton()],
              ),
            ),
          );
        }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LearnSubjectRow(subjects: subjects, current: subjectId, onPick: _pick, busy: !ready && !failed, dues: _dues),
        // The region's name for a screen reader: the chosen subject.
        Semantics(header: true, container: true, label: subjectName),
        const SizedBox(height: 14),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: KeyedSubtree(
            key: _fieldKey,
            child: HomeSearchField(
              controller: _text,
              focusNode: _focus,
              placeholder: HomeModel.searchPlaceholder(data?.subject.cards),
              showCancel: showCancel,
              onChanged: _typed,
              onCancel: _cancel,
            ),
          ),
        ),
        const SizedBox(height: 10),
        Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: keys),
        SizedBox(height: hasCards ? 20 : 10),
        if (ready && data.free != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, 16),
            child: HomeFreeLine(text: data.free!.text),
          ),
        if (ready && data.subject.note != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, 20),
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

enum _Mode { chapters, find, set }

/// Free: one quiet line under the search, only when today's one Learn session is used. Never a modal, dismissed until
/// tomorrow (India's day, as the service counts it). "See Pro" opens the Upgrade page where Pro nudges are on.
class HomeFreeLine extends ConsumerStatefulWidget {
  const HomeFreeLine({super.key, required this.text});

  final String text;

  /// The days a student dismissed the line on, for this run of the app.
  static final Set<String> _dismissed = {};

  @visibleForTesting
  static void resetForTests() => _dismissed.clear();

  @override
  ConsumerState<HomeFreeLine> createState() => _HomeFreeLineState();
}

class _HomeFreeLineState extends ConsumerState<HomeFreeLine> {
  late final String _day = HomeModel.istDay();

  @override
  Widget build(BuildContext context) {
    if (HomeFreeLine._dismissed.contains(_day)) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    final nudges = ref.watch(proNudgesOnProvider);
    return Semantics(
      container: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: MmSpace.s6),
              child: Text(widget.text, style: type.body.copyWith(fontSize: 14, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2)),
            ),
          ),
          if (nudges) HomeTextKey(label: HomeCopy.seePro, onTap: () => showUpgradeSheetIfOn(context, reason: ProReason.keycards)),
          MmPressable(
            key: const ValueKey('lh-free-dismiss'),
            semanticsLabel: HomeCopy.dismiss,
            focusRadius: MmRadius.smallAll,
            haptic: MmPressHaptic.selection,
            onTap: () => setState(() => HomeFreeLine._dismissed.add(_day)),
            builder: (context, pressed, _) => SizedBox.square(dimension: MmTarget.min, child: Icon(LucideIcons.x, size: 16, color: colors.ink3)),
          ),
        ],
      ),
    );
  }
}
