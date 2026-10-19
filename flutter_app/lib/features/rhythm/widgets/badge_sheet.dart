// A badge opened in a sheet (BADGES-REFINE-1018 2, over app-you-1016 Screen C): the coin large, the name,
// when it was earned (the day and the 12-hour time) or "Not yet", what lands it said exactly, and then what
// leads somewhere: the paper it came from ("Open that paper") when the phone holds that record, the exact count
// so far with its denominator for a badge not earned, the next badge on the same path with the count left, and
// one key that goes where it is earned. Nothing here is a guess: a badge not earned shows no date, a count shows
// only where it is exact, a badge that could not be read says so in one line, and there is no padlock and no
// plan anywhere near it. The words come from `badge_shelf.dart`, so the website says the same.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/badge_record.dart';
import '../logic/badge_shelf.dart';
import '../logic/milestone_tracks.dart';
import 'medal.dart';
import 'milestone_track_card.dart' show engravingOf;

/// Opens [id] from the board [tracks] in a sheet. [onGo] is told where a key goes (it defaults to pushing the
/// location); the sheet closes first.
Future<void> showBadgeSheet(
  BuildContext context, {
  required List<TrackView> tracks,
  required String id,
  Map<String, int> progress = const {},
  Map<String, BadgeRecord> records = const {},
  String zone = 'Asia/Kolkata',
  ValueChanged<String>? onGo,
}) {
  final detail = detailOf(tracks, id, progress: progress, records: records, zone: zone);
  if (detail == null) return Future.value();
  return showMmSheet<void>(
    context: context,
    // No title row: the coin leads and the name sits centred under it, so the sheet reads from the object down.
    builder: (sheet) => BadgeSheetBody(
      detail: detail,
      onGo: (location) {
        Navigator.of(sheet).pop();
        if (onGo != null) {
          onGo(location);
        } else if (AppRoutes.tabRoots.contains(location)) {
          // A tab or a door of Practice (Your papers, D126) is gone to, never pushed: a push would stack a second one.
          GoRouter.maybeOf(context)?.go(location);
        } else {
          GoRouter.maybeOf(context)?.push(location);
        }
      },
      onClose: () => Navigator.of(sheet).pop(),
    ),
  );
}

class BadgeSheetBody extends StatelessWidget {
  const BadgeSheetBody({super.key, required this.detail, required this.onGo, required this.onClose});

  final BadgeDetail detail;

  /// A key was pressed: where it goes.
  final ValueChanged<String> onGo;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final badge = detail.badge;
    final step = badge.step;
    final face = engravingOf(step.id);
    final earned = detail.earned;
    final count = detail.count;
    final paper = detail.paper;
    final next = detail.next;
    final action = detail.action;
    final status = switch (badge.status) {
      StepStatus.earned => MedalStatus.landed,
      StepStatus.next => MedalStatus.next,
      StepStatus.later || StepStatus.unknown => MedalStatus.later,
    };
    final stateLine = earned
        ? detail.earnedLine!
        : detail.unknown
            ? RhythmCopy.badgeUnknownLine
            : RhythmCopy.badgeNotYet;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Center(
          child: Medal(status: status, icon: face.icon, text: face.text, size: 96, arc: count?.fraction),
        ),
        const SizedBox(height: MmSpace.s16),
        Semantics(
          header: true,
          child: Text(step.name, textAlign: TextAlign.center, style: type.headline),
        ),
        const SizedBox(height: MmSpace.s8),
        // The state, said in words as well as drawn: when it landed, or "Not yet".
        Semantics(
          liveRegion: true,
          child: Text(stateLine, textAlign: TextAlign.center, style: type.subhead.copyWith(color: earned ? colors.ink : colors.ink2)),
        ),
        const SizedBox(height: MmSpace.s8),
        Text(step.condition, textAlign: TextAlign.center, style: type.body),
        if (earned && paper != null) ...[
          const SizedBox(height: MmSpace.s12),
          Text(paper.from, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
          if (paper.marks.isNotEmpty) Text(paper.marks, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
        ],
        if (count != null) ...[
          const SizedBox(height: MmSpace.s16),
          _CountBar(fraction: count.fraction),
          const SizedBox(height: MmSpace.s8),
          Text(RhythmCopy.badgeSoFarOf(count.so), textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
        ],
        if (detail.after != null) ...[
          const SizedBox(height: MmSpace.s8),
          Text(RhythmCopy.stepAfter(detail.after!), textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
        ],
        if (earned && next != null) ...[
          const SizedBox(height: MmSpace.s16),
          Semantics(
            container: true,
            child: Column(
              children: [
                Text(
                  next.also ? RhythmCopy.badgeOnPathAlso(next.badge.step.name) : RhythmCopy.badgeOnPathNext(next.badge.step.name),
                  textAlign: TextAlign.center,
                  style: type.labelLarge.copyWith(color: colors.ink),
                ),
                if (detail.nextCount != null)
                  Text(RhythmCopy.badgeLeft(detail.nextCount!.more), textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2))
                else
                  Text(next.badge.step.condition, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
              ],
            ),
          ),
        ] else if (earned && detail.pathDone) ...[
          const SizedBox(height: MmSpace.s16),
          Text(RhythmCopy.badgePathDone, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
        ],
        if (detail.pathLine != null) ...[
          const SizedBox(height: MmSpace.s12),
          Text(detail.pathLine!, textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink3)),
        ],
        const SizedBox(height: MmSpace.s24),
        if (action != null) KeyButton(label: action.label, onPressed: () => onGo(action.location)),
        if (earned && paper != null)
          Align(child: KeyButton.quiet(label: RhythmCopy.openThatPaper, onPressed: () => onGo(AppRoutes.result(paper.attemptId)))),
        if (action == null) Align(child: KeyButton.quiet(label: RhythmCopy.badgeDone, onPressed: onClose)),
      ],
    );
  }
}

/// The 4 dp bar of a counted badge: the volt fill over the hairline.
class _CountBar extends StatelessWidget {
  const _CountBar({required this.fraction});

  final double fraction;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(2),
        child: SizedBox(
          height: 4,
          child: Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(color: colors.line),
              FractionallySizedBox(alignment: Alignment.centerLeft, widthFactor: fraction, child: ColoredBox(color: colors.volt)),
            ],
          ),
        ),
      ),
    );
  }
}
