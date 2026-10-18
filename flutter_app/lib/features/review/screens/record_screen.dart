import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../../core/motion/motion.dart';
import '../copy.dart';
import '../data/mistake_index.dart' show MistakeStage;
import '../data/review_providers.dart';
import '../widgets/life_row.dart';
import '../widgets/review_load_failure.dart' show startQuickTen;
import '../widgets/review_state_view.dart';
import '../widgets/page_header.dart';
import '../widgets/review_layout.dart';
import '../widgets/record_entry.dart';

/// `/review/record`: the repair record as one thread, newest first (spec 5.8, 6.4). No pile, no
/// totals line. Built from the acknowledgements on this phone until a cross-device record
/// endpoint exists, and labelled so.
class RecordScreen extends ConsumerWidget {
  const RecordScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final index = ref.watch(reviewIndexProvider);
    final clock = ref.watch(reviewClockProvider);
    final pad = MediaQuery.paddingOf(context);
    final entries = index == null ? null : recordEntries(index);

    final Widget body;
    if (entries == null) {
      body = Center(
        child: Semantics(label: ReviewCopy.loadingRecord, liveRegion: true, child: MmSpinner(color: context.mmColors.ink2)),
      );
    } else if (entries.isEmpty) {
      body = ReviewStateView(
        kind: StateViewKind.empty,
        pose: MobiPose.read,
        title: ReviewCopy.recordEmptyTitle,
        message: ReviewCopy.recordPreviewEmpty,
        // With mistakes waiting, the key opens them; with none yet, "See your mistakes" would open a page with nothing to
        // repair (19 Oct walk, finding 33), so the key starts the set that finds them.
        primary: (index?.openCount ?? 0) > 0
            ? StateAction(ReviewCopy.recordEmptyAction, () => context.go(AppRoutes.review))
            : StateAction(ReviewCopy.emptyAction, () => startQuickTen(context)),
      );
    } else {
      // The page arrives with its route: the note first, then the thread, in order.
      body = MmStagger(
        driver: MmStaggerDriver.route,
        child: ListView(
          padding: EdgeInsets.fromLTRB(ReviewSpace.gutter, MmSpace.s8, ReviewSpace.gutter, pad.bottom + MmSpace.s32),
          children: [
            MmStaggerItem(
              index: 0,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // The thread every entry below walks, drawn once as the legend.
                  const LifeRow(stage: MistakeStage.repaired, bubbleSize: 16, animate: false),
                  const SizedBox(height: MmSpace.s12),
                  Text(ReviewCopy.lifeCaption, style: type.small.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s12),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Icon(LucideIcons.smartphone, size: 14, color: colors.ink2),
                      ),
                      const SizedBox(width: MmSpace.s8),
                      Expanded(
                        child: Text(ReviewCopy.onThisPhone, style: type.small.copyWith(color: colors.ink2)),
                      ),
                    ],
                  ),
                  const SizedBox(height: ReviewSpace.group),
                ],
              ),
            ),
            for (var i = 0; i < entries.length; i++)
              MmStaggerItem(
                index: i + 1,
                child: RecordEntry(item: entries[i], clock: clock, first: i == 0, last: i == entries.length - 1),
              ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const PageHeader(title: ReviewCopy.recordTitle),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}
