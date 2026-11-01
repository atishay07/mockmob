// A chapter's Cards view (the website's CardsView.jsx and CardList.jsx, phone band): the new home of Read, a root page over
// the shell.
//
//   Head      Back to the chapter (named by it), "Key cards", the chapter's reference and card count
//   Filters   All, Must-know, In Revise, Missed lately with real counts, one row with one sliding ink indicator
//   Tools     "Show answers" (folded by default), "Sections" (a sheet that jumps to a section), Pick
//   Key       the one volt key: "Study these 46", or under a filter "Study these 12" (a cards run of exactly those cards, at most
//             100); while cards are picked it is an outline and the pick bar holds the volt one
//   List      by the book's sections in book order, one pinned bar for the section in view; a row opens in place
//   Free      the open cards whole and one locked line where the first locked card sits, with the server's own words
//   States    loading (the page at its final shape), an empty filter, an error with Try again
//
// Data: GET /api/learn/cards?chapter=&filter= (learnChapterCardsProvider). Opening a row, its actions, picking and the jump
// are the list's own; nothing here writes to the server.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
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

/// `/learn/c/:chapterKey/cards[?f=]`: the chapter's Key cards, opened on [filter] (`must`, `revise` or `missed`) when given.
class CardsViewScreen extends ConsumerStatefulWidget {
  const CardsViewScreen({super.key, required this.chapterKey, this.filter});

  final String chapterKey;
  final String? filter;

  @override
  ConsumerState<CardsViewScreen> createState() => _CardsViewScreenState();
}

class _CardsViewScreenState extends ConsumerState<CardsViewScreen> {
  final CardsSelection _sel = CardsSelection();
  final ScrollController _scroll = ScrollController();
  final Map<String, GlobalKey> _barKeys = {};
  late String _filter = CardsModel.filterOf(widget.filter);

  /// The last answer, kept on screen (dimmed) while the next filter is read.
  LearnChapterCards? _last;

  @override
  void initState() {
    super.initState();
    _sel.addListener(_changed);
  }

  @override
  void dispose() {
    _sel
      ..removeListener(_changed)
      ..dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  GlobalKey _barKey(String id) => _barKeys.putIfAbsent(id, GlobalKey.new);

  void _back() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(Learn2Links.chapter(widget.chapterKey));
    }
  }

  void _setFilter(String value) {
    if (value == _filter) return;
    _sel.stopPicking();
    setState(() => _filter = value);
  }

  Future<void> _push(String location) async {
    await context.push<void>(location);
    // A run moves the counts and the In Revise words: they are read again.
    if (mounted) invalidateLearnReads(ref.invalidate);
  }

  void _study(List<String> ids) {
    if (ids.isEmpty) return;
    final run = RunLaunch(chapterKey: widget.chapterKey, minutes: 10, kind: LearnKinds.cards, cardIds: ids.take(CardsShared.runCardsMax).toList());
    unawaited(_push(Learn2Links.run(run)));
  }

  /// Puts a section's bar at the top. Rows below the view are measured by estimate until they are built, so a second look,
  /// once a frame has drawn what the first move built, settles the bar exactly.
  Future<void> _goTo(CardGroup g) async {
    final long = Motion.of(context, const Duration(milliseconds: 320));
    final short = Motion.of(context, const Duration(milliseconds: 160));
    for (var pass = 0; pass < 2; pass++) {
      final ctx = _barKey(g.id).currentContext;
      if (ctx == null || !ctx.mounted) return;
      await Scrollable.ensureVisible(ctx, alignment: 0, duration: pass == 0 ? long : short, curve: pass == 0 ? Motion.drawer : Motion.out);
      if (!mounted) return;
      await WidgetsBinding.instance.endOfFrame;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final args = (chapterKey: widget.chapterKey, filter: _filter);
    final read = ref.watch(learnChapterCardsProvider(args));
    final fresh = read.value;
    if (fresh != null) _last = fresh;
    final data = fresh ?? _last;
    final failed = read.hasError && !read.isLoading && fresh == null;
    final loading = !failed && data == null;
    final dim = read.isLoading && data != null && fresh == null;

    final groups = data == null ? const <CardGroup>[] : CardsModel.visibleSections(data.sections, data.lockedLine);
    final ids = CardsModel.ids(groups);
    final pickedIds = _sel.pickedIn(ids);
    final showPickBar = _sel.picking && pickedIds.isNotEmpty;

    final String phase;
    final Widget body;
    if (failed) {
      phase = 'error';
      body = _Page(
        back: _BackRow(label: data?.chapter.title ?? CardsCopy.backFallback, onBack: _back),
        head: const _Title(line: null),
        children: [
          CardsError(title: CardsCopy.loadFailedTitle, line: CardsCopy.loadFailedLine, onRetry: () => ref.invalidate(learnChapterCardsProvider(args)), padding: const EdgeInsets.only(top: 18)),
        ],
      );
    } else if (loading) {
      phase = 'loading';
      body = _Page(back: _BackRow(label: CardsCopy.backFallback, onBack: _back), head: const _Title(line: null, skeleton: true), children: const [_LoadingBody()]);
    } else {
      phase = 'content';
      body = _content(data!, groups, ids, pickedIds, showPickBar, dim);
    }

    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        bottom: false,
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
            child: CardsPickBar(
              show: showPickBar,
              count: pickedIds.length,
              onClear: _sel.clearPicks,
              onStudy: () => _study(pickedIds),
              child: MmOverlapSwitcher.fade(
                alignment: Alignment.topCenter,
                fit: StackFit.expand,
                child: KeyedSubtree(key: ValueKey('cards-$phase'), child: body),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _content(LearnChapterCards data, List<CardGroup> groups, List<String> ids, List<String> pickedIds, bool showPickBar, bool dim) {
    final colors = context.mmColors;
    final counts = data.counts;
    final options = [
      CardsFilterOption(value: 'all', label: CardsCopy.filterAll, count: counts.all),
      CardsFilterOption(value: 'must', label: CardsCopy.filterMust, count: counts.must),
      CardsFilterOption(value: 'revise', label: CardsCopy.filterRevise, count: counts.revise),
      CardsFilterOption(value: 'missed', label: CardsCopy.filterMissed, count: counts.missed),
    ];
    final n = ids.length;
    final runIds = ids.take(CardsShared.runCardsMax).toList();
    final compact = _filter != 'all';
    final empty = CardsCopy.empty[_filter] ?? CardsCopy.empty['all']!;
    final bottom = MediaQuery.paddingOf(context).bottom;

    final top = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        _BackRow(label: data.chapter.title, onBack: _back),
        Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: _Title(line: CardsModel.headLine(widget.chapterKey, data))),
        const SizedBox(height: 14),
        CardsFilterRow(value: _filter, options: options, onChanged: _setFilter),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: CardsToolsRow(
            showAnswers: _sel.showAnswers,
            onShowAnswers: _sel.setShowAnswers,
            pickMode: _sel.picking,
            onPick: () => _sel.picking ? _sel.stopPicking() : _sel.startPicking(),
            jump: CardsJumpKey(label: CardsCopy.sections, sheetTitle: CardsCopy.jumpSection, groups: groups, onGo: (g) => unawaited(_goTo(g))),
          ),
        ),
        if (n > 0) ...[
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: CardsStudyKey(
              label: n > CardsShared.runCardsMax ? CardsCopy.studyFirst(CardsShared.runCardsMax) : CardsCopy.studyThese(runIds.length),
              volt: !showPickBar,
              onPressed: () => _study(runIds),
            ),
          ),
        ],
        const SizedBox(height: 4),
      ],
    );

    final slivers = <Widget>[
      SliverToBoxAdapter(child: top),
      if (n == 0)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 14, MmSpace.gutter, 0),
            child: CardsEmpty(key: ValueKey('cards-empty-$_filter'), title: empty.title, line: empty.line),
          ),
        )
      else
        for (final g in groups)
          SliverMainAxisGroup(
            key: ValueKey('cards-group-$_filter-${g.id}'),
            slivers: [
              PinnedHeaderSliver(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
                  child: KeyedSubtree(key: _barKey(g.id), child: CardsSectionBar(group: g, compact: compact, opaque: true)),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
                sliver: SliverList.builder(
                  itemCount: g.cards.length + (g.lockedLine != null ? 1 : 0),
                  itemBuilder: (context, i) {
                    if (i >= g.cards.length) return CardsLockedLine(text: g.lockedLine!);
                    final e = g.cards[i];
                    return CardRow(
                      key: ValueKey('card-row-${e.id}'),
                      entry: e,
                      hideTags: _filter == 'all' ? const {} : {_filter},
                      open: _sel.isOpen(e.id),
                      shown: _sel.shown.contains(e.id),
                      showAnswers: _sel.showAnswers,
                      pickMode: _sel.picking,
                      picked: _sel.picked.contains(e.id),
                      last: i == g.cards.length - 1,
                      onOpen: () => _sel.toggleOpen(e.id),
                      onShown: () => _sel.toggleShown(e.id),
                      onPick: () => _sel.togglePick(e.id),
                      onStudy: (KeyCard card) => _study([card.id]),
                      onReport: (KeyCard card) => unawaited(showKcReportSheet(context, card: card)),
                    );
                  },
                ),
              ),
            ],
          ),
      // The pick bar rides over the last rows: room for it, and for the gesture bar.
      SliverToBoxAdapter(child: SizedBox(height: 120 + bottom)),
    ];

    return ColoredBox(
      color: colors.ground,
      child: CustomScrollView(controller: _scroll, slivers: slivers),
    );
  }
}

/// The page before its data, or with nothing else to show: the back row and the title over [children], one scroll.
class _Page extends StatelessWidget {
  const _Page({required this.back, required this.head, required this.children});

  final Widget back;
  final Widget head;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return SingleChildScrollView(
      padding: EdgeInsets.only(bottom: 120 + bottom),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          back,
          Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: head),
          Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children)),
        ],
      ),
    );
  }
}

/// "Key cards" and the line under it: the subject, the chapter's reference and how many cards.
class _Title extends StatelessWidget {
  const _Title({required this.line, this.skeleton = false});

  final String? line;
  final bool skeleton;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 2),
        Semantics(
          header: true,
          child: Text(CardsCopy.title, style: type.screenTitle.copyWith(fontSize: 28, height: 1.1, letterSpacing: -0.95, color: colors.ink)),
        ),
        const SizedBox(height: 6),
        if (skeleton)
          const SizedBox(height: 21, child: Align(alignment: Alignment.centerLeft, child: Skeleton(width: 184, height: 18, radius: 8)))
        else if (line != null)
          Text(line!, style: type.small.copyWith(fontSize: 14.5, height: 1.45, fontWeight: FontWeight.w500, color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
      ],
    );
  }
}

/// Back to the chapter, named by it (one line, cut with an ellipsis).
class _BackRow extends StatelessWidget {
  const _BackRow({required this.label, required this.onBack});

  final String label;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(left: MmSpace.s8, right: MmSpace.gutter),
        child: MmPressable(
          key: const ValueKey('cards-back'),
          onTap: onBack,
          pressedScale: 0.97,
          lift: false,
          focusRadius: MmRadius.smallAll,
          haptic: MmPressHaptic.selection,
          semanticsLabel: 'Back to $label',
          builder: (context, pressed, focused) => ConstrainedBox(
            constraints: const BoxConstraints(minHeight: MmTarget.min, minWidth: MmTarget.min),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.chevronLeft, size: 18, color: pressed ? colors.ink3 : colors.ink2),
                  const SizedBox(width: MmSpace.s6),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: pressed ? colors.ink3 : colors.ink2),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The chips, the tools, the key and the first rows at the size they will have, so nothing moves when the cards land.
class _LoadingBody extends StatelessWidget {
  const _LoadingBody();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      label: CardsCopy.loading,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(height: 14),
          // The chips are as wide as the real ones; the row clips what runs past the gutter, as the real row scrolls.
          SizedBox(
            height: CardsFilterRow.height,
            child: ClipRect(
              child: OverflowBox(
                alignment: Alignment.centerLeft,
                minWidth: 0,
                maxWidth: double.infinity,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Skeleton(width: 56, height: 44, radius: 22),
                    SizedBox(width: 4),
                    Skeleton(width: 118, height: 44, radius: 22),
                    SizedBox(width: 4),
                    Skeleton(width: 104, height: 44, radius: 22),
                    SizedBox(width: 4),
                    Skeleton(width: 128, height: 44, radius: 22),
                  ],
                ),
              ),
            ),
          ),
          SizedBox(height: 6),
          SizedBox(height: MmTarget.min, child: Align(alignment: Alignment.centerLeft, child: Skeleton(width: 168, height: 24, radius: 12))),
          SizedBox(height: 6),
          Skeleton(height: 52, radius: 26),
          SizedBox(height: 4),
          CardsSkeletonRows(groups: 2, rows: 3),
        ],
      ),
    );
  }
}
