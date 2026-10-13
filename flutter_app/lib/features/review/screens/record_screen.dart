import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/review_providers.dart';
import '../widgets/page_header.dart';
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
      body = StateView(
        kind: StateViewKind.empty,
        pose: MobiPose.read,
        title: ReviewCopy.recordEmptyTitle,
        message: ReviewCopy.recordPreviewEmpty,
        primary: StateAction(ReviewCopy.recordEmptyAction, () => context.go(AppRoutes.review)),
      );
    } else {
      body = ListView(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, pad.bottom + MmSpace.s32),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Icon(LucideIcons.smartphone, size: 16, color: colors.ink2),
              ),
              const SizedBox(width: MmSpace.s8),
              Expanded(
                child: Text(ReviewCopy.onThisPhone, style: type.small.copyWith(color: colors.ink2)),
              ),
            ],
          ),
          const SizedBox(height: MmSpace.s8),
          Text(ReviewCopy.checksGate, style: type.small.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s24),
          for (var i = 0; i < entries.length; i++)
            RecordEntry(item: entries[i], clock: clock, first: i == 0, last: i == entries.length - 1),
        ],
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
