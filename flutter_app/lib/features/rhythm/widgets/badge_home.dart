// The badge home on You (BADGES-REFINE-1018 1, the owner's answer of 18 Oct: keep the badges, refine the
// UI and function around them). Badges are visible without opening anything: the head says how many ("Badges,
// 6 of 16"), the shelf holds the earned brass coins newest first, each standing on the ledge with its name and
// the day it landed, and under it the next coin as a ghost (the dashed coin, never a padlock) with a thin ring
// for an exact count and one line ("Repairs: 7 of 10. 3 more repairs."). "All badges" opens the four paths.
// Every coin, and the ghost, is a 44 dp-plus target that opens the badge's sheet.
//
// Truth: a coin stands here only with a real date; counts carry their denominator and appear only where they
// are exact; a read that failed says so in one line with Try again (no count in the head then); a badge whose
// record could not be read is never "not yet" and is never the next one. No ranks, no flames, no padlocks. The
// coins do not play a landing here: a badge earned by a paper is revealed once, on that paper's result.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/copy/formatters.dart' show formatDayMonthShort;
import '../../../core/repositories/rhythm_repository.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/widgets/you_page.dart' show SectionTitle;
import '../copy.dart';
import '../data/badges.dart';
import '../data/rhythm_providers.dart';
import '../logic/badge_record.dart';
import '../logic/badge_shelf.dart';
import '../logic/dates.dart';
import '../logic/milestone_tracks.dart';
import '../logic/tokens.dart';
import 'badge_sheet.dart';
import 'locked_coin.dart';
import 'medal.dart';
import 'milestone_track_card.dart' show engravingOf;
import 'rhythm_layout.dart' show SectionBreak;

/// The Badges section of You: its rule, its head with "All badges", and the home itself.
class BadgeHomeSection extends ConsumerWidget {
  const BadgeHomeSection({super.key, this.rule = true});

  /// False under a block that already ends on a hairline.
  final bool rule;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final snapshot = ref.watch(rhythmSnapshotProvider);
    final tracks = ref.watch(badgeTracksProvider);
    final failed = !snapshot.hasData && !snapshot.isInitialLoading;
    final loading = snapshot.isInitialLoading;
    final ready = tracks != null && !failed && !loading;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: SectionBreak(rule: rule)),
        SectionTitle(
          ready ? badgesHead(tracks) : RhythmCopy.badgesTitle,
          trailing: ready ? KeyButton.quiet(label: RhythmCopy.badgesAll, onPressed: () => context.push(AppRoutes.youMilestones)) : null,
          padding: EdgeInsets.fromLTRB(MmSpace.gutter, 0, ready ? 0 : MmSpace.gutter, MmSpace.s12),
        ),
        if (failed)
          // One quiet way out: a failed You reads as one problem with one way out, not two stacked alarms.
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: Row(
              children: [
                Expanded(child: Text(RhythmCopy.badgesReadFailed, style: context.mmType.small.copyWith(color: context.mmColors.ink2))),
                const SizedBox(width: MmSpace.s8),
                KeyButton.quiet(label: RhythmCopy.tryAgain, onPressed: () => ref.read(rhythmRepositoryProvider.notifier).refresh(force: true)),
              ],
            ),
          )
        else if (!ready)
          const BadgeHomeSkeleton()
        else
          BadgeHome(
            tracks: tracks,
            progress: ref.watch(badgeProgressProvider),
            records: ref.watch(badgeRecordsProvider),
            zone: snapshot.timezone,
            now: ref.watch(nowProvider)(),
            onStart: () => context.push(AppRoutes.practiceStart),
          ),
      ],
    );
  }
}

/// The shelf, the next coin and the notes under them, from a board that has been read.
class BadgeHome extends StatelessWidget {
  const BadgeHome({
    super.key,
    required this.tracks,
    required this.zone,
    required this.now,
    this.progress = const {},
    this.records = const {},
    this.onStart,
    this.onOpen,
  });

  final List<TrackView> tracks;
  final Map<String, int> progress;

  /// The paper behind each badge the phone worked out (the sheet's record line).
  final Map<String, BadgeRecord> records;
  final String zone;
  final DateTime now;

  /// The one key of a student with nothing earned yet ("Start a quick practice").
  final VoidCallback? onStart;

  /// Opens a badge; defaults to its sheet.
  final ValueChanged<String>? onOpen;

  void _open(BuildContext context, String id) {
    if (onOpen != null) {
      onOpen!(id);
    } else {
      showBadgeSheet(context, tracks: tracks, id: id, progress: progress, records: records, zone: zone);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shelf = earnedShelf(tracks);
    final next = pickNext(tracks, progress);
    final unknown = boardOf(tracks).any((b) => b.status == StepStatus.unknown);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (shelf.isNotEmpty)
          Semantics(
            container: true,
            label: RhythmCopy.badgesShelfLabel,
            child: _Shelf(
              coins: [
                for (final b in shelf)
                  _ShelfCoin(
                    badge: b,
                    day: _shortDay(b.earnedAt!, zone, now),
                    label: RhythmCopy.badgeCoinEarned(b.step.name, formatAchievedDate(b.earnedAt!, zone, now)),
                    onTap: () => _open(context, b.id),
                  ),
              ],
            ),
          ),
        if (next != null) ...[
          if (shelf.isNotEmpty) const SizedBox(height: MmSpace.s8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: _NextCoin(badge: next, line: ghostLine(next, progress), count: countLeft(next.id, progress), onTap: () => _open(context, next.id)),
          ),
        ] else if (!unknown && shelf.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
            child: Text(RhythmCopy.badgesAllEarned, style: type.body.copyWith(color: colors.ink2)),
          ),
        if (unknown)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
            child: Text(RhythmCopy.badgesPartlyUnknown, style: type.small.copyWith(color: colors.ink2)),
          ),
        // Before the first badge, the one thing to do is a scored set.
        if (shelf.isEmpty && onStart != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
            child: Align(alignment: Alignment.centerLeft, child: KeyButton.quiet(label: RhythmCopy.startQuick, onPressed: onStart)),
          ),
      ],
    );
  }
}

/// "17 Oct", with the year when it is not this one.
String _shortDay(DateTime instant, String zone, DateTime now) {
  final day = studentDate(instant, zone);
  final thisYear = studentDate(now, zone).year;
  return day.year == thisYear ? formatDayMonthShort(day) : '${formatDayMonthShort(day)} ${day.year}';
}

/// The earned coins in a row that scrolls sideways, newest first, on a hairline ledge that runs the full
/// width. The next coin past the edge peeks in when there are more than fit.
class _Shelf extends StatelessWidget {
  const _Shelf({required this.coins});

  final List<Widget> coins;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return LayoutBuilder(
      builder: (context, box) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        // The first coin's edge sits on the 16 dp gutter: the slot is wider than the coin by `air` each side.
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter - _ShelfCoin.air),
        child: ConstrainedBox(
          constraints: BoxConstraints(minWidth: math.max(0, box.maxWidth - (MmSpace.gutter - _ShelfCoin.air) * 2)),
          child: Stack(
            children: [
              // The ledge the coins stand on: under the coins, above their names.
              Positioned(
                left: _ShelfCoin.air,
                right: _ShelfCoin.air,
                top: _ShelfCoin.ledgeTop,
                height: 1.5,
                child: ColoredBox(color: colors.line),
              ),
              Row(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: coins),
            ],
          ),
        ),
      ),
    );
  }
}

class _ShelfCoin extends StatelessWidget {
  const _ShelfCoin({required this.badge, required this.day, required this.label, required this.onTap});

  final BoardBadge badge;
  final String day;
  final String label;
  final VoidCallback onTap;

  static const double coin = 56;
  static const double width = 84;

  /// The air each side of the coin inside its slot, and the padding of the name under it.
  static const double air = (width - coin) / 2;
  static const double inset = 4;

  /// The ledge sits 6 dp under the coin.
  static const double ledgeTop = 4 + coin + 6;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final face = engravingOf(badge.id);
    return MmPressable(
      onTap: onTap,
      haptic: MmPressHaptic.selection,
      pressedScale: 0.96,
      focusRadius: MmRadius.smallAll,
      semanticsLabel: label,
      builder: (context, pressed, focused) => SizedBox(
        width: width,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: inset),
          child: Column(
            children: [
              const SizedBox(height: 4),
              Medal(status: MedalStatus.landed, icon: face.icon, text: face.text, size: coin),
              const SizedBox(height: 14),
              Text(
                badge.step.name,
                textAlign: TextAlign.center,
                textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.15),
                style: type.caption.copyWith(fontSize: 12, height: 15 / 12, color: colors.ink, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 2),
              Text(
                day,
                textAlign: TextAlign.center,
                textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.15),
                style: type.caption.copyWith(fontSize: 12, height: 15 / 12, color: colors.ink3),
              ),
              const SizedBox(height: MmSpace.s8),
            ],
          ),
        ),
      ),
    );
  }
}

/// The next coin: the ghost (dashed, its path's glyph, a thin ring for an exact count) and its one line.
class _NextCoin extends StatelessWidget {
  const _NextCoin({required this.badge, required this.line, required this.count, required this.onTap});

  final BoardBadge badge;
  final String line;
  final CountLeft? count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final token = MilestoneToken.values.firstWhere((t) => t.track == badge.track.track);
    return MmPressable(
      onTap: onTap,
      haptic: MmPressHaptic.selection,
      pressedScale: 0.99,
      focusRadius: MmRadius.smallAll,
      semanticsLabel: RhythmCopy.badgeGhostLabel(badge.step.name, line),
      builder: (context, pressed, focused) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              LockedCoin(token, size: 56, arc: count?.fraction),
              const SizedBox(width: MmSpace.s16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(RhythmCopy.badgeNextLead, style: type.caption.copyWith(color: colors.ink3)),
                    const SizedBox(height: MmSpace.s2),
                    Text(line, style: type.body),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Ghost coins with the final height, so nothing jumps when the board lands.
class BadgeHomeSkeleton extends StatelessWidget {
  const BadgeHomeSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonGroup(
      label: RhythmCopy.badgesTitle,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                for (var i = 0; i < 4; i++) ...[
                  if (i > 0) const SizedBox(width: MmSpace.s24),
                  const Skeleton.circle(size: 56),
                ],
              ],
            ),
            const SizedBox(height: MmSpace.s16),
            const Skeleton.line(width: 240, height: 14),
          ],
        ),
      ),
    );
  }
}
