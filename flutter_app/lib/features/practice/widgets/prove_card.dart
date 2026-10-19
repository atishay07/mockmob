import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/result_actions.dart';
import '../result_copy.dart';

/// The Prove step (WEB-PARITY A8): five questions the student has not seen, from the chapter of
/// this result's mistakes, as a free recovery session. Shown only when the server says such a
/// set exists right now (`GET /api/recovery/replay`); otherwise nothing, and no promise.
class ProveCard extends ConsumerWidget {
  const ProveCard({super.key, required this.attemptId, required this.subjectId, this.chapter, this.ofWrong = true});

  final String attemptId;

  /// Public subject id the fresh set starts in.
  final String subjectId;

  /// The chapter the result's fold named ([provePick]), so the card and its fold say the same chapter. Null reads the
  /// server's first chapter, as before.
  final String? chapter;

  /// False when [chapter] was only left blank: the card offers where the student stands, not a repair's proof.
  final bool ofWrong;

  /// The start link: chapter practice of 5 with `recoveryFrom`, through the auto-start route.
  static String locationFor({required String subjectId, required String chapter, required String attemptId}) => Uri(
    path: AppRoutes.practiceStart,
    queryParameters: {'mode': 'chapter', 'subject': subjectId, 'count': '5', 'chapter': chapter, 'recoveryFrom': attemptId},
  ).toString();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chapter = this.chapter ?? ref.watch(replayInventoryProvider(attemptId)).value?.firstAvailable;
    if (chapter == null) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.group),
      child: MmSurface.plain(
        padding: const EdgeInsets.all(MmSpace.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(header: true, child: Text(ofWrong ? ResultCopy.proveTitle : ResultCopy.proveBlankTitle, style: type.cardTitle)),
            const SizedBox(height: MmSpace.s4),
            Text(ResultCopy.proveLine(chapter), style: type.small.copyWith(color: colors.ink)),
            const SizedBox(height: MmSpace.s4),
            Text(ofWrong ? ResultCopy.proveNote : ResultCopy.proveBlankNote, style: type.small.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s12),
            Align(
              alignment: Alignment.centerLeft,
              child: KeyButton.secondary(
                label: ResultCopy.proveKey,
                expanded: false,
                onPressed: () => context.push(locationFor(subjectId: subjectId, chapter: chapter, attemptId: attemptId)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
