// Find, in place inside Learn home (the website's FindView.jsx, results, phone band). Learn home owns the field, its Cancel and
// the shelf tiles; from two typed characters this draws what the field asks for under them:
//
//   Head      "Results for “goodwill”" and, beside it, "50 cards in 4 chapters" (", 1 lesson" after it)
//   Tools     the "Show answers" switch, "Chapters" (a sheet that jumps to a chapter), "Pick"
//   Key       "Study these 50": the panel's one volt key, a cards run of exactly the cards it names (at most 100)
//   Links     chapters and lessons the search found that are not a card group below: three rows, then "Show all 7 chapters"
//   Groups    the cards by chapter in the order they came (the bar opens the chapter); each row shows the kind line, the front with
//             the matched words underlined from the server's spans, and "Show" for the NCERT line; a card that matched only in
//             NCERT's words shows that line without a tap
//   Free      the locked matches as one line where the groups end, never a wall of locks
//   Pick      a bar at the foot of the screen: "8 picked", Clear, "Study these 8"
//
// Under two characters nothing is drawn (Learn home keeps its shelves); one character gets the one hint line. Data: GET
// /api/learn/search (learnSearchProvider), read 240 ms after the typing settles, the last results kept (dimmed) until the
// next arrive.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../keycards/data/keycards_models.dart' show KeyCard;
import '../../keycards/widgets/key_card_parts.dart' show showKcReportSheet;
import '../data/learn_models.dart';
import '../data/learn_providers.dart';
import '../learn2_links.dart';
import 'card_model.dart';
import 'card_parts.dart';
import 'card_row.dart';
import 'cards_copy.dart';
import 'cards_selection.dart';
import 'cards_shared.dart';

/// The results of a search in [subject]: what Learn home puts under its field while the student types [query].
class FindPanel extends ConsumerStatefulWidget {
  const FindPanel({super.key, required this.subject, required this.query});

  /// The subject id the search runs in.
  final String subject;

  /// What the student typed in Learn home's search field.
  final String query;

  /// The least a search takes.
  static const int minChars = 2;

  /// How long the typing must rest before the search is asked.
  static const Duration debounce = Duration(milliseconds: 240);

  /// The chapter and lesson rows shown before "Show all".
  static const int linksShown = 3;

  @override
  ConsumerState<FindPanel> createState() => _FindPanelState();
}

class _FindPanelState extends ConsumerState<FindPanel> {
  final CardsSelection _sel = CardsSelection();
  final Map<String, GlobalKey> _groupKeys = {};
  Timer? _timer;
  /// What the last read was asked with: the typing, once it has rested (set at once under two characters).
  String _query = '';

  /// The last results, kept on screen (dimmed) while the next are read.
  LearnSearch? _last;
  String? _lastSubject;
  bool _allChapters = false;
  bool _allLessons = false;

  @override
  void initState() {
    super.initState();
    _query = widget.query.trim();
    _sel.addListener(_changed);
  }

  @override
  void didUpdateWidget(FindPanel old) {
    super.didUpdateWidget(old);
    if (old.subject != widget.subject) {
      _last = null;
      _lastSubject = null;
    }
    final next = widget.query.trim();
    if (next == _query) {
      _timer?.cancel();
      return;
    }
    _timer?.cancel();
    if (next.length < FindPanel.minChars) {
      // Under two characters there is nothing to wait for.
      _query = next;
    } else {
      _timer = Timer(FindPanel.debounce, () {
        if (!mounted) return;
        setState(() {
          _query = widget.query.trim();
          _allChapters = false;
          _allLessons = false;
        });
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _sel
      ..removeListener(_changed)
      ..dispose();
    super.dispose();
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  GlobalKey _groupKey(String id) => _groupKeys.putIfAbsent(id, GlobalKey.new);

  void _goTo(CardGroup g) {
    final ctx = _groupKey(g.id).currentContext;
    if (ctx == null) return;
    final duration = Motion.of(context, const Duration(milliseconds: 320));
    unawaited(Scrollable.ensureVisible(ctx, alignment: 0.04, duration: duration, curve: Motion.out));
  }

  Future<void> _push(String location) async {
    await context.push<void>(location);
    // A run moves the counts on every Learn page: they are read again.
    if (mounted) invalidateLearnReads(ref.invalidate);
  }

  void _study(List<String> ids, Map<String, String> chapterOf) {
    if (ids.isEmpty) return;
    final run = RunLaunch(
      chapterKey: chapterOf[ids.first],
      minutes: 10,
      kind: LearnKinds.cards,
      cardIds: ids.take(CardsShared.runCardsMax).toList(),
    );
    unawaited(_push(Learn2Links.run(run)));
  }

  @override
  Widget build(BuildContext context) {
    final live = widget.query.trim();
    // Under two characters Learn home keeps its shelves and its chapters; nothing is drawn here but, for one, the way in.
    if (live.isEmpty) return const SizedBox.shrink();
    if (live.length < FindPanel.minChars) return const _Hint();

    final searching = _query.length >= FindPanel.minChars;
    final args = (subject: widget.subject, query: _query);
    final read = searching ? ref.watch(learnSearchProvider(args)) : null;
    final fresh = read?.value;
    if (fresh != null) {
      _last = fresh;
      _lastSubject = widget.subject;
    }
    final LearnSearch? data = fresh ?? (_lastSubject == widget.subject ? _last : null);
    final failed = read != null && read.hasError && !read.isLoading && fresh == null;
    final stale = !searching || (read?.isLoading ?? true) || live != _query;

    final groups = data == null ? const <CardGroup>[] : CardsModel.resultGroups(data.cards);
    final ids = CardsModel.ids(groups);
    final chapterOf = {for (final g in groups) for (final c in g.cards) c.id: c.chapterKey};
    final locked = data == null ? 0 : CardsModel.lockedMatches(data.cards);
    final chapterLinks = data == null ? const <FindLink>[] : CardsModel.chapterLinks(data, groups);
    final lessonLinks = data == null ? const <FindLink>[] : CardsModel.lessonLinks(data);
    final pickedIds = _sel.pickedIn(ids);
    final showPickBar = _sel.picking && pickedIds.isNotEmpty;
    final countLine = data == null
        ? ''
        : CardsModel.findCountLine(cards: ids.length, groups: groups.length, chapterLinks: chapterLinks.length, lessons: lessonLinks.length);

    final String phase;
    final Widget body;
    if (failed) {
      phase = 'error';
      body = CardsError(
        title: CardsCopy.findFailedTitle,
        line: CardsCopy.findFailedLine,
        onRetry: () => ref.invalidate(learnSearchProvider(args)),
        padding: const EdgeInsets.only(top: 12),
      );
    } else if (data == null) {
      phase = 'loading';
      body = Semantics(
        container: true,
        label: CardsCopy.findLoading,
        explicitChildNodes: false,
        child: const SkeletonGroup(label: CardsCopy.findLoading, child: CardsSkeletonRows(groups: 1, rows: 6, bar: false)),
      );
    } else if (ids.isEmpty && chapterLinks.isEmpty && lessonLinks.isEmpty && locked == 0) {
      phase = 'empty';
      body = CardsEmpty(title: CardsCopy.noMatchTitle(_query.isEmpty ? live : _query), line: CardsCopy.noMatchLine);
    } else {
      phase = 'results';
      body = _results(
        data: data,
        groups: groups,
        ids: ids,
        chapterOf: chapterOf,
        locked: locked,
        chapterLinks: chapterLinks,
        lessonLinks: lessonLinks,
        pickedIds: pickedIds,
        showPickBar: showPickBar,
        stale: stale,
      );
    }

    return CardsPickBar(
      show: showPickBar,
      count: pickedIds.length,
      onClear: _sel.clearPicks,
      onStudy: () => _study(pickedIds, chapterOf),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          _Head(query: _query.isEmpty ? live : _query, line: countLine),
          const SizedBox(height: 14),
          MmOverlapSwitcher.fade(
            alignment: Alignment.topCenter,
            fit: StackFit.passthrough,
            child: KeyedSubtree(key: ValueKey('find-$phase'), child: body),
          ),
        ],
      ),
    );
  }

  Widget _results({
    required LearnSearch data,
    required List<CardGroup> groups,
    required List<String> ids,
    required Map<String, String> chapterOf,
    required int locked,
    required List<FindLink> chapterLinks,
    required List<FindLink> lessonLinks,
    required List<String> pickedIds,
    required bool showPickBar,
    required bool stale,
  }) {
    final colors = context.mmColors;
    final type = context.mmType;
    final blocks = <Widget>[];
    if (ids.isNotEmpty) {
      blocks.add(
        CardsToolsRow(
          showAnswers: _sel.showAnswers,
          onShowAnswers: _sel.setShowAnswers,
          pickMode: _sel.picking,
          onPick: () => _sel.picking ? _sel.stopPicking() : _sel.startPicking(),
          jump: CardsJumpKey(label: CardsCopy.chapters, sheetTitle: CardsCopy.jumpChapter, groups: groups, onGo: _goTo),
        ),
      );
      blocks.add(
        ids.length <= CardsShared.runCardsMax
            ? CardsStudyKey(label: CardsCopy.studyThese(ids.length), volt: !showPickBar, onPressed: () => _study(ids, chapterOf))
            : Text(CardsCopy.over(ids.length, CardsShared.runCardsMax), style: type.small.copyWith(fontSize: 13, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink3)),
      );
    }
    if (chapterLinks.isNotEmpty) {
      blocks.add(
        _LinkRows(
          label: CardsCopy.chaptersGroup,
          rows: chapterLinks,
          all: _allChapters,
          noun: 'chapters',
          onAll: () => setState(() => _allChapters = true),
          onOpen: (l) => unawaited(_push(Learn2Links.chapter(l.id))),
        ),
      );
    }
    if (lessonLinks.isNotEmpty) {
      blocks.add(
        _LinkRows(
          label: CardsCopy.lessonsGroup,
          rows: lessonLinks,
          all: _allLessons,
          noun: 'lessons',
          onAll: () => setState(() => _allLessons = true),
          onOpen: (l) => unawaited(_push(AppRoutes.learnUnit(l.id))),
        ),
      );
    }
    if (groups.isNotEmpty) {
      blocks.add(
        AnimatedOpacity(
          opacity: stale ? 0.55 : 1,
          duration: Motion.of(context, const Duration(milliseconds: 150)),
          curve: Motion.out,
          child: _Groups(
            groups: groups,
            sel: _sel,
            query: _query,
            lockedLine: locked > 0 ? CardsCopy.lockedMatches(locked) : null,
            keyOf: _groupKey,
            onOpenChapter: (g) => unawaited(_push(Learn2Links.chapter(g.chapterKey ?? ''))),
            onStudy: (KeyCard card) => unawaited(_push(Learn2Links.run(RunLaunch(chapterKey: card.chapterKey, minutes: 10, kind: LearnKinds.cards, cardIds: [card.id])))),
            onReport: (KeyCard card) => unawaited(showKcReportSheet(context, card: card)),
          ),
        ),
      );
    } else if (locked > 0) {
      // Every match is a card Free cannot open: the one line says so.
      blocks.add(CardsLockedLine(text: CardsCopy.lockedMatches(locked)));
    }
    if (data.more > 0) {
      blocks.add(Text(CardsCopy.more(data.more), style: type.small.copyWith(fontSize: 13, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink3)));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [for (final (i, b) in blocks.indexed) ...[if (i > 0) const SizedBox(height: 14), b]],
    );
  }
}

/// "Results for “goodwill”" and what was found, on one line when they fit.
class _Head extends StatelessWidget {
  const _Head({required this.query, required this.line});

  final String query;
  final String line;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Wrap(
      spacing: 14,
      runSpacing: 2,
      crossAxisAlignment: WrapCrossAlignment.end,
      children: [
        Semantics(
          header: true,
          child: Text(CardsCopy.resultsFor(query), style: type.title.copyWith(fontSize: 18, height: 1.3, letterSpacing: -0.27, color: colors.ink)),
        ),
        Semantics(
          liveRegion: true,
          child: Text(line, style: type.label.copyWith(fontSize: 14, height: 1.4, fontWeight: FontWeight.w600, color: colors.ink3)),
        ),
      ],
    );
  }
}

/// One typed character: the way in, in a line.
class _Hint extends StatelessWidget {
  const _Hint();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Semantics(
          liveRegion: true,
          container: true,
          child: Text(CardsCopy.findHint, style: context.mmType.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2)),
        ),
      ),
    );
  }
}

/// The card groups: a bar for each chapter and its rows, and the locked line where the last group ends.
class _Groups extends StatelessWidget {
  const _Groups({
    required this.groups,
    required this.sel,
    required this.query,
    required this.lockedLine,
    required this.keyOf,
    required this.onOpenChapter,
    required this.onStudy,
    required this.onReport,
  });

  final List<CardGroup> groups;
  final CardsSelection sel;
  final String query;
  final String? lockedLine;
  final GlobalKey Function(String id) keyOf;
  final ValueChanged<CardGroup> onOpenChapter;
  final ValueChanged<KeyCard> onStudy;
  final ValueChanged<KeyCard> onReport;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final (gi, g) in groups.indexed) ...[
          KeyedSubtree(key: keyOf(g.id), child: CardsSectionBar(group: g, onTap: () => onOpenChapter(g))),
          for (final (i, e) in g.cards.indexed)
            CardRow(
              key: ValueKey('card-row-${e.id}'),
              entry: e,
              query: query,
              open: sel.isOpen(e.id),
              shown: sel.shown.contains(e.id),
              showAnswers: sel.showAnswers,
              pickMode: sel.picking,
              picked: sel.picked.contains(e.id),
              last: i == g.cards.length - 1,
              onOpen: () => sel.toggleOpen(e.id),
              onShown: () => sel.toggleShown(e.id),
              onPick: () => sel.togglePick(e.id),
              onStudy: onStudy,
              onReport: onReport,
            ),
          if (gi == groups.length - 1 && lockedLine != null) CardsLockedLine(text: lockedLine!),
        ],
      ],
    );
  }
}

/// Chapters or lessons a search found that are not a card group: up to three rows, then one text key for the rest.
class _LinkRows extends StatelessWidget {
  const _LinkRows({required this.label, required this.rows, required this.all, required this.noun, required this.onAll, required this.onOpen});

  final String label;
  final List<FindLink> rows;
  final bool all;
  final String noun;
  final VoidCallback onAll;
  final ValueChanged<FindLink> onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final shown = all ? rows : rows.take(FindPanel.linksShown).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          container: true,
          label: label,
          explicitChildNodes: true,
          child: DecoratedBox(
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: colors.line))),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [for (final r in shown) _LinkRow(row: r, onTap: () => onOpen(r))],
            ),
          ),
        ),
        if (!all && rows.length > FindPanel.linksShown)
          Align(
            alignment: Alignment.centerLeft,
            child: CardsTextKey(key: ValueKey('find-all-$noun'), label: CardsCopy.showAll(rows.length, noun), onTap: onAll),
          ),
      ],
    );
  }
}

class _LinkRow extends StatelessWidget {
  const _LinkRow({required this.row, required this.onTap});

  final FindLink row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
      child: MmPressable(
        key: ValueKey('find-link-${row.id}'),
        semanticsLabel: '${row.title}, ${row.meta}',
        focusRadius: const BorderRadius.all(Radius.circular(6)),
        pressedScale: 0.995,
        lift: false,
        highlight: true,
        haptic: MmPressHaptic.selection,
        onTap: onTap,
        builder: (context, pressed, focused) => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(child: Text(row.title, style: type.body.copyWith(fontSize: 16, height: 1.35, fontWeight: FontWeight.w600, color: colors.ink))),
                const SizedBox(width: 12),
                Text(row.meta, style: type.small.copyWith(fontSize: 13.5, height: 1.3, fontWeight: FontWeight.w500, color: colors.ink3)),
                const SizedBox(width: 12),
                Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
