/// The study stage's pager rules, a port of the website's `src/components/learn2/stage/pagerModel.mjs` (BUILD-1101
/// B1, A1 3.7): pure, no widgets, no clock, so unit tests hold them. `stage_pager.dart` applies them to real drags.
///
///   release   a drag moves one item past 18% of the item area or at 0.35 px/ms (350 dp/s) in that direction;
///             never more than one
///   rubber    0.35 resistance past the first and the last page
///   touch     under 8 dp of movement a touch is a tap; a sideways gesture is not the pager's
///   scroll    a page's content that can still move in the drag's direction owns the gesture (the edge rule)
///
/// The web's wheel and key rules are not needed on a phone and are not ported.
library;

/// One finger sample: [t] in milliseconds, [y] in logical pixels.
typedef PagerSample = ({double t, double y});

/// What a touch is once it has moved (`touchLock`).
enum PagerTouch { tap, vertical, side }

abstract final class PagerModel {
  /// Share of the item area a drag must pass.
  static const double distance = 0.18;

  /// Release velocity a flick must pass, in logical pixels per millisecond (0.35 px/ms = 350 dp/s).
  static const double velocity = 0.35;

  /// Milliseconds of samples the release velocity reads.
  static const double window = 80;

  /// Resistance past the first and the last page.
  static const double resistance = 0.35;

  /// Movement before a direction is chosen; under it a touch is a tap.
  static const double slop = 8;

  /// The move's length (on `Motion.drawer`, cubic-bezier(0.32, 0.72, 0, 1)).
  static const Duration duration = Duration(milliseconds: 320);

  /// `rubber`: the drag offset drawn on screen, 1:1, with resistance past the first and the last page. [dy]
  /// positive is the finger moving down (toward the previous item).
  static double rubber(double dy, int index, int count) {
    final atStart = index <= 0 && dy > 0;
    final atEnd = index >= count - 1 && dy < 0;
    return atStart || atEnd ? dy * resistance : dy;
  }

  /// `releaseVelocity`: px per ms (positive is the finger moving down) over the last [window] ms of [samples].
  static double releaseVelocity(List<PagerSample> samples) {
    final list = [
      for (final p in samples)
        if (p.t.isFinite && p.y.isFinite) p,
    ];
    if (list.length < 2) return 0;
    final last = list.last;
    final from = list.firstWhere((p) => last.t - p.t <= window, orElse: () => list.first);
    final dt = last.t - from.t;
    return dt > 0 ? (last.y - from.y) / dt : 0;
  }

  /// `releaseTarget`: where a released drag goes. [dy] is the finger's travel (positive down, toward the
  /// previous item), [v] the release velocity, [height] the item area. A quick flick decides by its own direction;
  /// otherwise the distance does. Never more than one item, never past either end.
  static int releaseTarget({double dy = 0, double v = 0, double height = 1, int index = 0, int count = 1}) {
    var dir = 0;
    if (v.abs() > velocity) {
      dir = v < 0 ? 1 : -1;
    } else if (dy.abs() > distance * (height < 1 ? 1 : height)) {
      dir = dy < 0 ? 1 : -1;
    }
    final target = index + dir;
    final last = count - 1;
    return target > last ? (last < 0 ? 0 : last) : (target < 0 ? 0 : target);
  }

  /// `touchLock`: a touch's role once it moved: a tap under the slop, sideways when it moved more across than
  /// down, else vertical.
  static PagerTouch touchLock(double dx, double dy) {
    if (dx.abs() < slop && dy.abs() < slop) return PagerTouch.tap;
    return dy.abs() >= dx.abs() ? PagerTouch.vertical : PagerTouch.side;
  }

  /// `canScroll`: can a box scrolled to [pixels] of [min]..[max] still move in [dir] (1 is toward its end, the
  /// finger moving up; -1 toward its start)? A box that does not overflow by more than 1 px cannot.
  static bool canScroll({required double pixels, required double min, required double max, required int dir}) {
    if (max - min <= 1) return false;
    if (dir > 0) return pixels < max - 1;
    if (dir < 0) return pixels > min + 1;
    return false;
  }
}
