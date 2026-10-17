import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../insights/widgets/entry_points.dart' show EntryRow;
import '../data/review_providers.dart';
import '../revise/revise_data.dart';
import 'review_again_copy.dart';

/// How many repaired mistakes Review again could ask, from the index alone (cheap enough for the
/// tab; the screen itself checks each question is on the phone).
final reviewAgainCountProvider = Provider<int>((ref) {
  final index = ref.watch(reviewIndexProvider);
  return index?.repairedCount ?? 0;
});

/// Review's one way into re-practising what was repaired. It replaces Revise's row on the tab:
/// when Revise is live and has cards DUE today the row is called Revise, names them and opens Revise
/// (server-marked); otherwise, with something repaired, it is Review again and opens the key-hidden
/// run, which works from the phone. Cards that exist but are not due never route to a Revise page
/// that says nothing is due. It is shown only when there is
/// something to ask, so it never points at nothing, and it opens into place (the tab does not jump).
class ReviewAgainRow extends ConsumerWidget {
  const ReviewAgainRow({super.key, this.divider = true});

  /// A hairline under the row when it shows (the tab's rows are ruled), so the row going away
  /// leaves no stray line.
  final bool divider;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repaired = ref.watch(reviewAgainCountProvider);
    final revise = ref.watch(reviseEntryProvider).value;
    final reviseDue = revise != null && !revise.isUnavailable && !revise.isEmpty && revise.due > 0;
    final show = reviseDue || repaired > 0;
    return MmSizeEase(
      duration: Motion.of(context, Motion.card),
      curve: Motion.out,
      alignment: Alignment.topCenter,
      child: !show
          ? const SizedBox(width: double.infinity)
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                EntryRow(
                  icon: LucideIcons.rotateCcw,
                  title: reviseDue ? ReviewAgainCopy.reviseTitle : ReviewAgainCopy.title,
                  note: reviseDue ? (revise.head ?? ReviewAgainCopy.rowNoteDue(revise.due, revise.cards)) : ReviewAgainCopy.rowNote(repaired),
                  onTap: () => context.push(reviseDue ? AppRoutes.reviewRevise : AppRoutes.reviewAgain),
                ),
                if (divider) Divider(height: 1, color: context.mmColors.line),
              ],
            ),
    );
  }
}

/// Whether Review again has anything to ask (for the all-clear key and Practice's More list).
bool reviewAgainAvailable(WidgetRef ref) => ref.watch(reviewAgainCountProvider) > 0;
