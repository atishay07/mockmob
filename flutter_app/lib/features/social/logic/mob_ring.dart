// The Mob ring as plain data: how many segments, which are filled, which ink in now, and the
// sitters' initials in join order. Nothing here names a member who has not sat (P6).

import '../data/mob_models.dart';

enum RingSegment {
  /// A seat whose sitter has not sat this week. Unlabelled.
  open,

  /// A sitter this student has already seen fill.
  filled,

  /// A sitter who sat since this student last looked: it inks in once, in order.
  fresh,
}

class RingPlan {
  const RingPlan({required this.segments, required this.sitters});

  final List<RingSegment> segments;

  /// The sitters, in join order.
  final List<MobMember> sitters;

  int get size => segments.length;
  int get sat => segments.where((s) => s != RingSegment.open).length;
  int get freshCount => segments.where((s) => s == RingSegment.fresh).length;
  bool get complete => size > 0 && sat == size;
}

/// [seenSat] is how many filled segments this student saw last time this week (0 for a new week).
/// With [reducedMotion] nothing inks: every filled segment is simply there.
RingPlan ringPlan(Mob mob, {int seenSat = 0, bool reducedMotion = false}) {
  final size = mob.week.size.clamp(1, mobMaxSize);
  final sat = mob.week.sat.clamp(0, size);
  final seen = seenSat.clamp(0, sat);
  return RingPlan(
    segments: [
      for (var i = 0; i < size; i++)
        if (i >= sat)
          RingSegment.open
        else if (i < seen || reducedMotion)
          RingSegment.filled
        else
          RingSegment.fresh,
    ],
    sitters: [for (final m in mob.members) if (m.sat) m],
  );
}

/// The ink timing (spec section 8): 220 ms a segment, 60 ms between starts.
const Duration ringSegmentInk = Duration(milliseconds: 220);
const Duration ringSegmentStep = Duration(milliseconds: 60);

/// When the [i]th fresh segment starts and ends, as fractions of [ringInkTotal] for [fresh] segments.
Duration ringInkTotal(int fresh) => fresh <= 0 ? Duration.zero : ringSegmentInk + ringSegmentStep * (fresh - 1);

(double, double) ringInkInterval(int i, int fresh) {
  final total = ringInkTotal(fresh).inMicroseconds;
  if (total == 0) return (0, 1);
  final start = (ringSegmentStep * i).inMicroseconds / total;
  final end = (ringSegmentStep * i + ringSegmentInk).inMicroseconds / total;
  return (start.clamp(0.0, 1.0), end.clamp(0.0, 1.0));
}
