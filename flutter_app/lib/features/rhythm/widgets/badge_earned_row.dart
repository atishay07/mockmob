// The earned moment on the result (BADGES-REFINE-1018 3): when a scored paper has just earned a badge, one
// compact row near the top of the analysis says so, "Badge earned" with the coin and its name (or "2 badges
// earned"), and "See your badges" opens the badge home. Never a modal, never a toast, never a second row.
//
// The coin reveals once: it scales from 0.85 to 1 on the app's own `Motion.out` while one light band crosses it,
// 600 ms in all, and one light haptic tick lands with it. Under reduced motion it is a 150 ms fade, and the
// Celebrations setting rules the rest: Full is the reveal and the tick, Quiet is the same words with no movement
// and no tick, Off shows nothing at all (and spends nothing, so the row waits until it is back on).
//
// Shown once per badge: the key `badge-seen:<id>:<earnedAt>` is written in the phone's `rhythm_seen` record when
// the row is on screen, beside the plain milestone id so no other place (Today's line) announces the same badge a
// second time. A badge dated again by the server (a different earnedAt) is a new moment. A record that cannot be
// read shows nothing rather than risk showing it twice. A badge counts for a paper by its record, or by its date
// being within two minutes of the paper's own (papers, weeks, best work); repairs only by a record; and a result
// older than three days announces nothing (`earnedByAttempt`).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/repositories/rhythm_seen_repository.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/badges.dart';
import '../data/rhythm_prefs.dart';
import '../data/rhythm_providers.dart' show rhythmSeenProvider;
import '../logic/badge_shelf.dart';
import 'medal.dart';
import 'milestone_track_card.dart' show engravingOf;

/// The reveal's whole length (scale and light), and its length under reduced motion.
const Duration kBadgeReveal = Duration(milliseconds: 600);
const Duration kBadgeRevealReduced = Duration(milliseconds: 150);

class BadgeEarnedRow extends ConsumerStatefulWidget {
  const BadgeEarnedRow({super.key, required this.attemptId, required this.completedAt, this.onSeeBadges});

  /// The paper this result is of, and when it was scored.
  final String attemptId;
  final DateTime completedAt;

  /// "See your badges": defaults to opening the badge page.
  final VoidCallback? onSeeBadges;

  @override
  ConsumerState<BadgeEarnedRow> createState() => _BadgeEarnedRowState();
}

class _BadgeEarnedRowState extends ConsumerState<BadgeEarnedRow> {
  /// The badges this visit announces, decided once. Never emptied again, so the row stays while the page is up.
  List<BoardBadge> _shown = const [];

  /// The candidate set last looked at, so one set is looked at once.
  String _asked = '';

  Future<void> _consider(List<BoardBadge> candidates) async {
    if (_shown.isNotEmpty || candidates.isEmpty) return;
    final key = [for (final b in candidates) badgeSeenKey(b.id, b.earnedAt!)].join('|');
    if (key == _asked) return;
    _asked = key;
    final repo = ref.read(rhythmSeenRepositoryProvider);
    final RhythmSeenState seen;
    try {
      seen = await repo.read();
    } on Object {
      return; // Unreadable memory: say nothing rather than risk saying it twice.
    }
    if (!mounted) return;
    final fresh = [for (final b in candidates) if (!seen.celebratedIds.contains(badgeSeenKey(b.id, b.earnedAt!))) b];
    if (fresh.isEmpty) return;
    try {
      for (final b in fresh) {
        await repo.markCelebrated(badgeSeenKey(b.id, b.earnedAt!));
        await repo.markCelebrated(b.id);
      }
      ref.invalidate(rhythmSeenProvider);
    } on Object {
      // Shown again next time at worst; the moment itself is not lost.
    }
    if (!mounted) return;
    setState(() => _shown = fresh);
    // One light tick with the reveal, in Full only (Quiet is plain text; reduced motion changes the motion, not the tick).
    if (ref.read(celebrationModeProvider) == CelebrationMode.full) unawaited(ref.read(hapticsProvider).tick());
  }

  @override
  Widget build(BuildContext context) {
    final visible = ref.watch(rhythmVisibleProvider);
    final mode = ref.watch(celebrationModeProvider);
    final tracks = ref.watch(badgeTracksProvider);
    if (visible && mode != CelebrationMode.off && tracks != null && _shown.isEmpty) {
      final candidates = earnedByAttempt(
        tracks,
        ref.watch(badgeRecordsProvider),
        attemptId: widget.attemptId,
        completedAt: widget.completedAt,
        now: ref.watch(nowProvider)(),
      );
      if (candidates.isNotEmpty) scheduleMicrotask(() => _consider(candidates));
    }
    final show = visible && mode != CelebrationMode.off && _shown.isNotEmpty;
    // The row grows in (the page below glides down) instead of pushing it in one frame.
    return MmSizeEase(
      duration: Motion.of(context, Motion.card),
      curve: Motion.out,
      alignment: Alignment.topCenter,
      child: show
          ? _Row(badges: _shown, animate: mode == CelebrationMode.full, onSee: widget.onSeeBadges ?? () => context.push(AppRoutes.youMilestones))
          : const SizedBox(width: double.infinity),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.badges, required this.animate, required this.onSee});

  final List<BoardBadge> badges;
  final bool animate;
  final VoidCallback onSee;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final words = momentWords(badges)!;
    final one = badges.length == 1;
    final text = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(words.title, style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s2),
        Text(words.detail, style: type.labelLarge.copyWith(color: colors.ink, fontWeight: FontWeight.w700)),
      ],
    );
    final key = KeyButton.quiet(label: RhythmCopy.seeYourBadges, onPressed: onSee);
    // The coins and the words are said once, as one live line; the key keeps its own label.
    Widget said(Widget child) => Semantics(
          container: true,
          liveRegion: true,
          label: RhythmCopy.badgeEarnedRowLabel(words.title, words.detail),
          excludeSemantics: true,
          child: child,
        );
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s16),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: one
            ? Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: said(
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          _CoinReveal(badge: badges.first, size: 48, animate: animate),
                          const SizedBox(width: MmSpace.s12),
                          Expanded(child: text),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: MmSpace.s4),
                  key,
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  said(
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        for (final b in badges.take(3)) ...[
                          _CoinReveal(badge: b, size: 40, animate: animate),
                          const SizedBox(width: MmSpace.s8),
                        ],
                        const SizedBox(width: MmSpace.s4),
                        Expanded(child: text),
                      ],
                    ),
                  ),
                  key,
                ],
              ),
      ),
    );
  }
}

/// One coin that reveals once: 0.85 to 1 on `Motion.out` with one light band across it over [kBadgeReveal]; under
/// reduced motion, a [kBadgeRevealReduced] fade; with [animate] false (Quiet) it is simply there.
class _CoinReveal extends StatefulWidget {
  const _CoinReveal({required this.badge, required this.size, required this.animate});

  final BoardBadge badge;
  final double size;
  final bool animate;

  @override
  State<_CoinReveal> createState() => _CoinRevealState();
}

class _CoinRevealState extends State<_CoinReveal> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: kBadgeReveal);
  bool _started = false;
  bool _reduced = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _reduced = Motion.reduced(context);
    if (!widget.animate) {
      _controller.value = 1;
      return;
    }
    if (_reduced) _controller.duration = kBadgeRevealReduced;
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final face = engravingOf(widget.badge.id);
    final eased = CurvedAnimation(parent: _controller, curve: Motion.out);
    // The band crosses the coin after it has begun to settle, and is gone before it rests.
    final light = CurvedAnimation(parent: _controller, curve: const Interval(0.2, 0.95, curve: Motion.sweepCurve));
    final coin = Medal(status: MedalStatus.landed, icon: face.icon, text: face.text, size: widget.size, sweep: _reduced ? null : light);
    return SizedBox.square(
      dimension: widget.size,
      child: _reduced || !widget.animate
          ? FadeTransition(opacity: eased, child: coin)
          : FadeTransition(
              opacity: CurvedAnimation(parent: _controller, curve: const Interval(0, 0.4, curve: Motion.out)),
              child: ScaleTransition(scale: Tween<double>(begin: 0.85, end: 1).animate(eased), child: coin),
            ),
    );
  }
}
