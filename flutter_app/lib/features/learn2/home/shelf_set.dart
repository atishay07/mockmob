import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/learn_models.dart';
import '../data/learn_providers.dart';
import '../learn2_links.dart';
import 'home_copy.dart';
import 'home_model.dart';

/// A shelf set opened in place (the web's FindView set panel, phone band): what a shelf tile opens. The whole subject's
/// cards of that set in one read ([learnSubjectCardsProvider]), grouped by chapter in book order. A Back key returns to the
/// chapters, four chips switch the set, one volt key plays exactly the cards the set names ("Revise these 9": a cards run
/// of the ids, at most [runMax]), and each chapter row opens that chapter's page. The card list itself (answers folded,
/// Pick) is the chapter's Cards view.
class HomeShelfSet extends ConsumerWidget {
  const HomeShelfSet({
    super.key,
    required this.subject,
    required this.shelf,
    required this.shelves,
    required this.onShelf,
    required this.onBack,
    required this.onOpenChapter,
    required this.onRun,
    this.gutter = MmSpace.gutter,
  });

  final String subject;

  /// due | missed | revise | must.
  final String shelf;

  /// The counts of the chips (null while they are unknown).
  final LearnShelves? shelves;
  final ValueChanged<String> onShelf;
  final VoidCallback onBack;
  final ValueChanged<String> onOpenChapter;
  final ValueChanged<RunLaunch> onRun;
  final double gutter;

  /// One run takes at most this many cards (the server's cap).
  static const int runMax = 100;

  static const List<String> _order = ['due', 'missed', 'revise', 'must'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final args = (subject: subject, filter: shelf);
    final read = ref.watch(learnSubjectCardsProvider(args));
    final data = read.value;

    // The chapters that hold cards of this set, in the book's order; a locked stub is never played.
    final sections = [
      if (data != null)
        for (final c in data.chapters)
          if ([for (final r in c.cards) if (!r.locked && r.card != null) r].isNotEmpty) c,
    ];
    final ids = [
      for (final c in sections)
        for (final r in c.cards)
          if (!r.locked && r.card != null) r.id,
    ];
    final total = ids.length;
    final head = HomeModel.setHead(shelf, count: total, chapters: sections.length, shelves: shelves);
    final counts = <String, int>{
      'due': shelves?.due.count ?? 0,
      'missed': shelves?.missed.count ?? 0,
      'revise': shelves?.revise.count ?? 0,
      'must': shelves?.must.count ?? 0,
    };
    final names = {'due': HomeCopy.setDue, 'missed': HomeCopy.setMissed, 'revise': HomeCopy.setRevise, 'must': HomeCopy.setMust};
    final loading = data == null && !read.hasError;

    final Widget body;
    if (loading) {
      body = const _SetSkeleton();
    } else if (data == null) {
      body = _SetError(onRetry: () => ref.invalidate(learnSubjectCardsProvider(args)));
    } else if (total == 0) {
      final empty = HomeCopy.setEmpty[shelf] ?? HomeCopy.setEmpty['revise']!;
      body = Padding(
        padding: EdgeInsets.fromLTRB(gutter, MmSpace.s16, gutter, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(empty.title, style: type.title.copyWith(fontSize: 18, height: 1.25, color: colors.ink)),
            const SizedBox(height: 8),
            Text(empty.line, style: type.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2)),
          ],
        ),
      );
    } else {
      final due = shelf == 'due';
      final first = [for (final c in sections) for (final r in c.cards) if (!r.locked && r.card != null) c.key].first;
      body = Padding(
        padding: EdgeInsets.symmetric(horizontal: gutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: MmSpace.s12),
            if (total <= runMax)
              KeyButton(
                key: const ValueKey('lh-set-key'),
                label: due ? HomeCopy.setKeyDue(total) : HomeCopy.setKeyStudy(total),
                minHeight: 52,
                onPressed: () => onRun(RunLaunch(chapterKey: first, minutes: 10, kind: LearnKinds.cards, cardIds: ids.take(runMax).toList())),
              )
            else
              Text(HomeCopy.setOver(total, runMax), style: type.small.copyWith(color: colors.ink3, height: 1.5)),
            const SizedBox(height: MmSpace.s16),
            DecoratedBox(
              decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final c in sections)
                    DecoratedBox(
                      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: colors.line))),
                      child: _SetRow(
                        key: ValueKey('lh-set-row-${c.key}'),
                        chapter: c,
                        cards: [for (final r in c.cards) if (!r.locked && r.card != null) r].length,
                        onTap: () => onOpenChapter(c.key),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: EdgeInsets.symmetric(horizontal: gutter),
          child: Align(alignment: Alignment.centerLeft, child: _BackKey(onTap: onBack)),
        ),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: gutter),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(header: true, child: Text(head.title, style: type.title.copyWith(fontSize: 20, height: 1.2, color: colors.ink))),
              const SizedBox(height: 2),
              Semantics(
                liveRegion: true,
                child: Text(loading ? '\u00a0' : head.line, style: type.small.copyWith(color: colors.ink3, height: 1.4)),
              ),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        ChipRail.labelled(
          key: const ValueKey('lh-set-chips'),
          labels: [for (final id in _order) '${names[id]} ${counts[id]}'],
          selected: _order.indexOf(shelf),
          onSelected: (i) => onShelf(_order[i]),
          bubbles: false,
          padding: EdgeInsets.symmetric(horizontal: gutter),
          semanticLabel: HomeCopy.setChips,
        ),
        MmOverlapSwitcher.fade(
          duration: Motion.ui,
          alignment: Alignment.topCenter,
          child: KeyedSubtree(key: ValueKey('lh-set-$shelf-${loading ? 'loading' : (data == null ? 'error' : 'ready')}'), child: body),
        ),
      ],
    );
  }
}

class _BackKey extends StatelessWidget {
  const _BackKey({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      key: const ValueKey('lh-set-back'),
      semanticsLabel: HomeCopy.setBack,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min, minWidth: MmTarget.min),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.chevronLeft, size: 18, color: colors.ink2),
            const SizedBox(width: MmSpace.s4),
            Text(HomeCopy.setBack, style: type.labelLarge.copyWith(fontWeight: FontWeight.w700, color: colors.ink2)),
            const SizedBox(width: MmSpace.s8),
          ],
        ),
      ),
    );
  }
}

class _SetRow extends StatelessWidget {
  const _SetRow({super.key, required this.chapter, required this.cards, required this.onTap});

  final LearnCardsChapter chapter;
  final int cards;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: [HomeModel.displayTitle(chapter.title), HomeCopy.setChapterCount(cards)].join('. '),
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.99,
      highlight: true,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4, vertical: 10),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Expanded(
                          child: Text(HomeModel.displayTitle(chapter.title), style: type.body.copyWith(fontSize: 16, height: 1.35, fontWeight: FontWeight.w600, color: colors.ink)),
                        ),
                        const SizedBox(width: MmSpace.s12),
                        Text(HomeCopy.setChapterCount(cards), style: type.label.copyWith(fontSize: 13.5, height: 1.35, color: colors.ink2)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
            ],
          ),
        ),
      ),
    );
  }
}

/// The set before its cards: the key and six rows at the size they will have, so nothing moves when it lands.
class _SetSkeleton extends StatelessWidget {
  const _SetSkeleton();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: HomeCopy.setLoading,
      container: true,
      child: const Padding(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Skeleton(height: 52, radius: 26),
            SizedBox(height: MmSpace.s16),
            Skeleton(height: 64, radius: 0),
            SizedBox(height: 1),
            Skeleton(height: 64, radius: 0),
            SizedBox(height: 1),
            Skeleton(height: 64, radius: 0),
          ],
        ),
      ),
    );
  }
}

class _SetError extends StatelessWidget {
  const _SetError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 28, MmSpace.gutter, 0),
      child: Semantics(
        liveRegion: true,
        container: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(HomeCopy.setFailedTitle, style: type.title.copyWith(fontSize: 18, height: 1.25, color: colors.ink)),
            const SizedBox(height: 8),
            Text(HomeCopy.setFailedLine, style: type.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2)),
            const SizedBox(height: 16),
            KeyButton.secondary(label: HomeCopy.tryAgain, expanded: false, minHeight: MmTarget.min, onPressed: onRetry),
          ],
        ),
      ),
    );
  }
}
