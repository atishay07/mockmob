// Recent papers on Review's History side (TODAY-1017 section 7, P3): the trend of the newest
// papers of one kind and the newest four papers with where their marks went. They left Today for
// their home here; Today keeps one "Last paper" row that opens the newest result. Built by Today's
// own builders from the papers Review already holds, so the figures on both screens agree.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/attempt.dart';
import '../../../core/repositories/notification_prefs_repository.dart' show studentTimezoneProvider;
import '../../../core/repositories/pending_result_repository.dart' show PendingResult, unopenedResultsProvider;
import '../../today/logic/today_builder.dart' show buildSheet, buildTrend;
import '../../today/logic/today_inputs.dart';
import '../../today/logic/today_model.dart' show GoTo;
import '../../today/widgets/sheet_section.dart';

class ReviewRecentPapers extends ConsumerWidget {
  const ReviewRecentPapers({super.key, required this.attempts});

  /// Newest first, as Review's index holds them.
  final List<Attempt> attempts;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (attempts.isEmpty) return const SizedBox.shrink();
    // Results not opened yet: their rows stay sealed and the trend waits (no spoiled reveal).
    final pending = ref.watch(unopenedResultsProvider).value ?? const <PendingResult>[];
    final inputs = TodayInputs(
      now: DateTime.now(),
      timezone: ref.watch(studentTimezoneProvider),
      attempts: attempts,
      unopened: [for (final p in pending) (attemptId: p.attemptId, receivedAt: p.receivedAt)],
    );
    return SheetSection(
      rows: buildSheet(inputs),
      papers: attempts.length,
      trend: buildTrend(inputs),
      onOpen: (target) {
        if (target is GoTo) unawaited(context.push(target.location));
      },
    );
  }
}
