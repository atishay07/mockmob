import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/gestures.dart' show DragStartBehavior;
import 'package:flutter/physics.dart' show SpringSimulation, Tolerance;
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart' show CustomSemanticsAction, OrdinalSortKey;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../haptics/haptics.dart';
import '../../motion/motion.dart';
import '../../motion/motion_tokens.g.dart';
import '../../theme/theme.dart';
import '../materials/touch_light.dart';
import 'bar_badges.dart';
import 'bar_glass.dart';
import 'bar_icons.dart';
import 'bar_lens.dart';
import 'bar_tabs.dart';
import 'start_key.dart';

export 'bar_badges.dart' show BarBadges;

/// The bar's measures on one screen width (NAV-1017 section 6.1). One 64 dp row: the capsule of
/// five equal slots (Today, Practice, Review, Colleges, You) from the row's left edge, then the
/// key gap, then the 64 dp Start key. Every x here is in dp from the row's left edge, which is
/// also the capsule's left edge; every y in dp from the expanded row's top.
class BarGeometry {
  BarGeometry(this.screenWidth)
    : width = MmBar.widthFor(screenWidth),
      keyGap = MmBar.keyGapFor(screenWidth),
      pad = MmBar.padFor(screenWidth),
      capsuleWidth = MmBar.capsuleWidthFor(screenWidth),
      slot = MmBar.slotFor(screenWidth);

  final double screenWidth;

  /// The row: the screen less 16 dp each side (8 below 360 dp), at most 440.
  final double width;

  /// The key's gap from the capsule (8, or 6 below 360 dp).
  final double keyGap;

  /// The capsule's inner padding, left and right of the slots (4, or 3 below 360 dp).
  final double pad;

  /// The capsule's width: the row less the key and its gap.
  final double capsuleWidth;

  /// Every tab slot's width: (capsule - 2 x pad) / 5.
  final double slot;

  /// The capsule's 64 dp box (expanded), and the band it paints at [collapse] (bottom anchored:
  /// y 0 to 64 expanded, 12 to 64 compact), fully round.
  Rect get capsuleRect => Rect.fromLTWH(0, 0, capsuleWidth, MmBar.height);

  RRect capsuleShape(double collapse) {
    final h = MmBar.height - (MmBar.height - MmBar.compactHeight) * collapse;
    return RRect.fromRectAndRadius(Rect.fromLTWH(0, MmBar.height - h, capsuleWidth, h), Radius.circular(h / 2));
  }

  /// The key's 64 dp box, and its circle at [collapse] (64 across expanded, 52 compact, bottom
  /// anchored like the capsule, so both centres are y 32 expanded and y 38 compact).
  Rect get keyBox => Rect.fromLTWH(capsuleWidth + keyGap, 0, MmBar.keySize, MmBar.height);

  Rect keyCircle({double collapse = 0}) => StartKeyFace.keyRect(keyBox.size, collapse).shift(keyBox.topLeft);

  double slotLeft(int index) => pad + slot * index;

  double slotCenter(int index) => pad + slot * (index + 0.5);

  /// The lens's width at rest: a slot less [MmBar.lensInset] each side.
  double get lensWidth => slot - 2 * MmBar.lensInset;

  /// The label box's width: the lens less [MmBar.labelInset] each side.
  double get labelBoxWidth => lensWidth - 2 * MmBar.labelInset;

  /// The lens's edges on slot [index].
  (double, double) lensEdges(int index) {
    final c = slotCenter(index);
    return (c - lensWidth / 2, c + lensWidth / 2);
  }

  /// The lens at rest on slot [index] at [collapse]: y 4 to 60 expanded, 16 to 60 compact.
  Rect lensRect(int index, {double collapse = 0}) {
    final (l, r) = lensEdges(index);
    final h = MmBar.lensHeight - (MmBar.lensHeight - MmBar.compactLensHeight) * collapse;
    final bottom = MmBar.height - (MmBar.height - MmBar.lensHeight) / 2;
    return Rect.fromLTRB(l, bottom - h, r, bottom);
  }

  /// The icon box (24 by 24) on slot [index] at [collapse]: y 11 to 35 expanded, 15 dp lower
  /// compact (centred on the compact row's centre, y 38).
  Rect iconRect(int index, {double collapse = 0}) => Rect.fromCenter(
    center: Offset(slotCenter(index), MmBar.iconTop + MmBar.icon / 2 + MmBar.compactShift * collapse),
    width: MmBar.icon,
    height: MmBar.icon,
  );

  /// The label's line box on slot [index] (y 39 to 53).
  Rect labelRect(int index) =>
      Rect.fromCenter(center: Offset(slotCenter(index), MmBar.labelTop + MmBar.labelHeight / 2), width: labelBoxWidth, height: MmBar.labelHeight);

  /// The key's glyph box and its word box: the tabs' icon and label lines.
  Rect keyIconRect({double collapse = 0}) => Rect.fromCenter(
    center: Offset(keyBox.center.dx, MmBar.iconTop + MmBar.icon / 2 + MmBar.compactShift * collapse),
    width: MmBar.icon,
    height: MmBar.icon,
  );

  Rect get keyLabelRect =>
      Rect.fromCenter(center: Offset(keyBox.center.dx, MmBar.labelTop + MmBar.labelHeight / 2), width: StartKeyFace.labelWidth, height: MmBar.labelHeight);

  /// The slot under [x] (dp from the capsule's left edge), clamped to the capsule.
  int slotAt(double x) => ((x - pad) / slot).floor().clamp(0, kBarSlots - 1);

  /// The slot whose centre is nearest [x].
  int nearestSlot(double x) => ((x - pad) / slot - 0.5).round().clamp(0, kBarSlots - 1);
}

/// A spring for a 0-to-1 value of the bar (the lift, a settle, the gel, the stretch) that stops
/// once it is within a five-hundredth of rest: the default tolerance (a thousandth, at a
/// thousandth per second) kept the bar ticking for half a second of motion nobody can see.
SpringSimulation _spring(SpringDescription spring, double from, double to, {double velocity = 0}) =>
    SpringSimulation(spring, from, to, velocity, tolerance: const Tolerance(distance: 0.002, velocity: 0.05), snapToEnd: true);

/// The same for a lens edge, in dp: it stops within 0.05 dp (a seventh of a pixel) of its slot.
SpringSimulation _edgeSpring(SpringDescription spring, double from, double to, {double velocity = 0}) =>
    SpringSimulation(spring, from, to, velocity, tolerance: const Tolerance(distance: 0.05, velocity: 2), snapToEnd: true);

/// Starts, follows and settles a drag up from Start that opens the Start sheet out of the key.
abstract interface class StartDragTarget {
  /// The drag has begun from the key's [origin] (global coordinates).
  void begin(Rect origin);

  /// The sheet is [progress] of the way open (0 to 1).
  void update(double progress);

  /// The finger lifted: open the sheet, or settle back into the key.
  void end({required bool open});
}

/// The bottom bar (NAV-1017 section 6, Option A1; GLASS-1017 sections 5.4 to 5.6): a frosted
/// glass capsule of five tabs, Today, Practice, Review, Colleges and You, and beside it, 8 dp
/// away on the same 64 dp row, the round volt Start key. The capsule and the key are one row:
/// their tops, bottoms and centres are shared, and the key's glyph and word sit on the tabs' icon
/// and label lines, so every icon and every word in the bar are aligned by construction (L31).
///
/// * **Touch:** a finger landing anywhere on the capsule lifts the lens out of the glass (it grows
///   8%, clears, its rim light brightens, a hairline fringe shows its edge bending light) and a
///   bloom of light rises under the finger; icons near the lens magnify up to 1.10. On release the
///   light spreads and leaves.
/// * **Tap a tab:** a `selectionClick`; the lens travels on two critically damped springs (its
///   leading edge quick, its trailing edge slow, so it stretches toward the new tab and gathers
///   itself, with no overshoot), sinking back into the glass as its trailing edge lands; the old
///   icon empties to its outline and the new one fills as the lens arrives.
/// * **Press an inactive tab:** the lens's near edge leans 0.18 of a slot toward it first.
/// * **Scrub:** a horizontal drag on the capsule (never inside the system's back-gesture strips)
///   carries the lens 1:1 under the finger, keeping where it was grabbed, stretched up to 12% with
///   speed, with a click at each slot boundary; past Today or You it resists like a rubber band. On
///   release the finger's velocity is projected ([MmBar.projectionDecay]) and the lens lands on
///   the nearest slot to that point on springs that carry the velocity and bounce a little.
/// * **Start:** a tap opens the quick start sheet; a drag up pulls it open out of the key. The key
///   flexes like gel under the finger and never changes its look with the page (NAV 6.8).
/// * **Compact** ([compact]): one controller shrinks the capsule (64 to 52 dp) and the key (64 to
///   52 dp) together, both bottom anchored, so they never disagree; labels fade over 120 ms.
/// * **Reduced motion:** no lift, magnification, stretch, rubber band or overshoot; the lens
///   cross-fades to the new tab over 120 ms; the key's press is a colour change only.
///
/// Every moving part is a transform, an opacity or a painter in its own repaint boundary; the
/// bar does not rebuild on lens frames.
class MmBottomBar extends ConsumerStatefulWidget {
  const MmBottomBar({
    super.key,
    required this.currentBranch,
    required this.onTab,
    required this.onStart,
    this.startDrag,
    this.badges = BarBadges.none,
    this.compact,
    this.collapse,
    this.startPressed = false,
    this.entrance = false,
    this.startResumeLabel,
    this.onStartResume,
    this.startResumeId,
    this.startHoldsResume = false,
    this.quality,
    this.startStyle = MmBar.startKeyStyle,
  });

  /// The open branch: 0 Today, 1 Practice, 2 Review, 3 Colleges, 4 You ([BarBranch]).
  final int currentBranch;

  /// Called with a branch for every tab tap, including a re-tap of the open tab.
  final ValueChanged<int> onTab;

  /// Called with the Start key's global rect, for the morph into the sheet.
  final ValueChanged<Rect> onStart;

  /// Receives a drag up from Start, or null to ignore it.
  final StartDragTarget? startDrag;
  final BarBadges badges;

  /// True while the page has been scrolled down (the bar is compact).
  final ValueListenable<bool>? compact;

  /// The shell's compaction (0 expanded to 1 compact), driven from [compact]; when given, the
  /// capsule, the key and the live capsule above them all move on this one controller.
  final Animation<double>? collapse;

  /// Draws Start pressed (goldens).
  final bool startPressed;

  /// Plays the first appearance (once per cold start).
  final bool entrance;

  /// Start's TalkBack shortcut ("Resume Accountancy mock"), with [onStartResume].
  final String? startResumeLabel;
  final VoidCallback? onStartResume;

  /// The open session's id. The first time one shows (once per session in this app run), Start's
  /// label slides to Resume and back. Null: it never does.
  final String? startResumeId;

  /// The key's word holds Resume (NAV-1017 6.3 and 6.4): a paper is open and the live capsule is
  /// not saying so, because it has tucked away or Today's hero shows it. The live capsule tucks
  /// into the key, so the open paper is always one glance away without anything floating over
  /// the page. The look of the key never changes; only its word does, in the same label box.
  final bool startHoldsResume;

  /// Sessions whose Resume slide has played in this app run.
  static final Set<String> _resumeSlid = <String>{};

  /// Forgets which sessions have slid (tests).
  static void resetResumeSlide() => _resumeSlid.clear();

  /// Overrides the inherited glass tier (goldens).
  final GlassQuality? quality;

  /// The Start key's look (the owner's A1 by default; goldens draw both).
  final StartKeyStyle startStyle;

  static const String startSemanticsLabel = 'Start. Opens quick start.';
  static const String resumeSemanticsLabel = 'Resume. Opens quick start with your open paper first.';

  /// How long the key's word takes to slide between Start and Resume when it holds (NAV 6.3).
  static const Duration holdShift = Duration(milliseconds: 240);

  /// A tap's travel: the token edge springs, critically damped (no overshoot on a tap; NAV 6.5).
  static final SpringDescription tapLead = SpringDescription.withDurationAndBounce(duration: MotionSprings.edgeLeadDuration);
  static final SpringDescription tapTrail = SpringDescription.withDurationAndBounce(duration: MotionSprings.edgeTrailDuration);

  /// An arriving icon fills over [iconIn]; a departing one empties to its outline over [iconOut].
  static const Duration iconIn = Duration(milliseconds: 200);
  static const Duration iconOut = Duration(milliseconds: 160);

  /// An icon settling as it arrives: 420 ms, bounce 0.12.
  static final SpringDescription iconSettle = SpringDescription.withDurationAndBounce(duration: const Duration(milliseconds: 420), bounce: 0.12);

  /// A pressed tab's scale, and how long it takes to spring back (a small overshoot).
  static const double tabPressScale = 0.96;
  static const Duration tabRelease = Duration(milliseconds: 260);

  /// How long the first appearance takes in all (the bar, then each item 30 ms apart).
  static const Duration entranceDuration = Duration(milliseconds: 420);

  /// The lifted lens's scale and the most an icon under it magnifies.
  static const double liftScale = 1.08;
  static const double magnify = 0.10;

  /// The rubber band past either end: `o x dim x 0.55 / (dim + 0.55 x |o|)`, dim 1.2 slots.
  static double rubberBand(double overshoot, double slot) {
    final dim = 1.2 * slot;
    return overshoot.sign * overshoot.abs() * dim * 0.55 / (dim + 0.55 * overshoot.abs());
  }

  /// Where a lens let go at [center] with [velocity] (dp/s) would come to rest.
  static double project(double center, double velocity) =>
      center + velocity / 1000 * MmBar.projectionDecay / (1 - MmBar.projectionDecay);

  /// At most two badges or dots show at once (HIG: badges for what matters); Review's count wins,
  /// then Colleges' dot, then You's.
  static ({bool review, bool colleges, bool you}) visibleBadges(BarBadges badges) {
    final review = badges.reviewText != null || badges.showReviewDot;
    final colleges = badges.collegesDot;
    final you = badges.youDot && !(review && colleges);
    return (review: review, colleges: colleges, you: you);
  }

  @override
  ConsumerState<MmBottomBar> createState() => MmBottomBarState();
}

class MmBottomBarState extends ConsumerState<MmBottomBar> with TickerProviderStateMixin {
  late BarGeometry _geo = BarGeometry(360);
  late final AnimationController _left = AnimationController.unbounded(vsync: this);
  late final AnimationController _right = AnimationController.unbounded(vsync: this);

  /// The one compaction: the capsule, the lens and the key all read it. The shell passes its own
  /// ([MmBottomBar.collapse]), which also sinks the live capsule, so nothing in the row can
  /// disagree; alone, the bar drives [_ownCollapse] from [MmBottomBar.compact].
  late final AnimationController _ownCollapse = AnimationController(vsync: this, value: widget.compact?.value == true ? 1 : 0);
  Animation<double> get _collapse => widget.collapse ?? _ownCollapse;
  late final AnimationController _labelsOut = AnimationController(vsync: this, value: widget.compact?.value == true ? 1 : 0);

  /// The lens lifted out of the glass (0 rest, 1 lifted), and the reduced-motion cross-fade.
  late final AnimationController _lift = AnimationController.unbounded(vsync: this);
  late final AnimationController _xfade = AnimationController(vsync: this, duration: Motion.reducedFade, value: 1);
  (double, double)? _ghost;

  late final AnimationController _press = AnimationController(vsync: this, duration: Motion.press, reverseDuration: Motion.release);
  late final AnimationController _gel = AnimationController.unbounded(vsync: this);
  late final AnimationController _ripple = AnimationController(vsync: this, duration: const Duration(milliseconds: 380), value: 1);
  late final AnimationController _enter = AnimationController(vsync: this, duration: MmBottomBar.entranceDuration, value: 1);
  late final AnimationController _pop = AnimationController(vsync: this, duration: const Duration(milliseconds: 360), value: 1);

  /// The drag's stretch (0 to 1, springs back through a little squash), and the Start-to-Resume
  /// label slide (0 Start, 1 Resume).
  late final AnimationController _stretch = AnimationController.unbounded(vsync: this);
  late final AnimationController _label = AnimationController(vsync: this, duration: const Duration(milliseconds: 2200));

  /// The held Resume word (0 Start, 1 Resume), while [MmBottomBar.startHoldsResume].
  late final AnimationController _hold = AnimationController(vsync: this, duration: MmBottomBar.holdShift, value: widget.startHoldsResume ? 1 : 0);

  /// The touch light in the capsule and in the key.
  late final TouchLightController _capsuleLight = TouchLightController(vsync: this);
  late final TouchLightController _keyLight = TouchLightController(vsync: this);

  /// Each tab's icon, 0 outlined to 1 filled (and its label, ink 2 to ink).
  late final List<AnimationController> _on = [for (var i = 0; i < kBarTabs.length; i++) AnimationController(vsync: this, duration: MmBottomBar.iconIn, reverseDuration: MmBottomBar.iconOut)];
  late final List<AnimationController> _settle = [for (var i = 0; i < kBarTabs.length; i++) AnimationController.unbounded(vsync: this, value: 1)];

  late final Listenable _edges = Listenable.merge([_left, _right]);

  final GlobalKey _startKey = GlobalKey(debugLabel: 'bar-start');

  /// The branch drawn active (it leads the shell while scrubbing).
  int _shown = 0;
  bool _placed = false;
  bool _scrubbing = false;
  int? _focusedSlot;
  bool _keyFocused = false;

  /// The widest tab label as it will be drawn, for the lens's corners.
  double _labelWidth = 40;

  /// The tab under a finger: it sinks to 0.96 in 100 ms and springs back on release.
  int? _pressedTab;

  void _pressTab(int? branch) {
    if (_pressedTab != branch) setState(() => _pressedTab = branch);
  }

  // The arrival waiting for the lens's leading edge to pass 70% of its travel, and the drop
  // waiting for its trailing edge to pass 85%.
  int? _arriving;
  AnimationController? _arrivalEdge;
  double _arrivalFrom = 0;
  double _arrivalTo = 0;
  AnimationController? _trailEdge;
  double _trailFrom = 0;
  double _trailTo = 0;
  bool _dropPending = false;
  bool _fingerDown = false;

  // A scrub: where the lens was grabbed, and the finger's smoothed speed.
  double _grab = 0;
  double _scrubSpeed = 0;
  Duration? _lastScrubAt;
  double _scrubCenter = 0;

  // A drag up from Start.
  bool _dragging = false;
  bool _pastOpen = false;
  double _drag = 0;

  bool get _reduced => Motion.reduced(context);

  @override
  void initState() {
    super.initState();
    _shown = widget.currentBranch;
    for (var i = 0; i < kBarTabs.length; i++) {
      _on[i].value = i == _shown ? 1 : 0;
    }
    _edges.addListener(_watchEdges);
    widget.compact?.addListener(_compactChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeSlideResume());
  }

  /// Once per open session in this app run: "Start" slides up to "Resume", holds, and slides back.
  void _maybeSlideResume() {
    final id = widget.startResumeId;
    if (!mounted || id == null || _reduced || MmBottomBar._resumeSlid.contains(id)) return;
    // Not while a finger is on the key; and not while the bar is still arriving: it slides once
    // the bar has landed (otherwise the entrance would use up the one slide this session gets).
    if (_dragging) return;
    if (_enter.isAnimating) {
      if (!_slideWaiting) {
        _slideWaiting = true;
        _enter.addStatusListener(_slideWhenLanded);
      }
      return;
    }
    MmBottomBar._resumeSlid.add(id);
    _label.forward(from: 0);
  }

  bool _slideWaiting = false;

  void _slideWhenLanded(AnimationStatus status) {
    if (status != AnimationStatus.completed && status != AnimationStatus.dismissed) return;
    _enter.removeStatusListener(_slideWhenLanded);
    _slideWaiting = false;
    _maybeSlideResume();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final geo = BarGeometry(MediaQuery.sizeOf(context).width);
    final moved = geo.width != _geo.width || geo.slot != _geo.slot;
    _geo = geo;
    _labelWidth = _measureLabels();
    if (!_placed || moved) {
      // First layout, or the screen width changed: the lens sits on the open tab at once.
      final (l, r) = _geo.lensEdges(branchToSlot(_shown));
      _left.value = l;
      _right.value = r;
    }
    if (!_placed) {
      _placed = true;
      if (widget.entrance && !_reduced) {
        // Start's pop begins at 300 ms, as its own fade lands, so it never lands on top of
        // Today's hero number (MOTION.md 5.3).
        void popAt300() {
          if (_enter.value * MmBottomBar.entranceDuration.inMilliseconds < 300) return;
          _enter.removeListener(popAt300);
          if (mounted) _pop.forward(from: 0);
        }

        _pop.value = 0;
        _enter.addListener(popAt300);
        _enter.forward(from: 0);
      }
    }
  }

  /// The widest of the five labels as drawn: 11 sp at the clamped text scale, never wider than
  /// the label box (the box scales a longer word down).
  double _measureLabels() {
    final style = _labelStyle(context.mmColors.ink, 1);
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.2);
    var widest = 0.0;
    for (final tab in kBarTabs) {
      final painter = TextPainter(text: TextSpan(text: tab.label, style: style), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)..layout();
      widest = math.max(widest, painter.width);
      painter.dispose();
    }
    return math.min(widest, _geo.labelBoxWidth);
  }

  /// [on] (0 to 1) moves the label from a medium weight to bold (D8: the active tab reads from the
  /// accent icon and a bold label). The widest label is measured at bold, so the slot never
  /// jumps as the weight changes.
  TextStyle _labelStyle(Color color, double on) => context.mmType.navLabel.copyWith(
    fontSize: MmBar.labelSize,
    height: MmBar.labelHeight / MmBar.labelSize,
    fontWeight: FontWeight.lerp(FontWeight.w500, FontWeight.w700, on),
    letterSpacing: 0,
    color: color,
  );

  @override
  void didUpdateWidget(MmBottomBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.compact != widget.compact) {
      oldWidget.compact?.removeListener(_compactChanged);
      widget.compact?.addListener(_compactChanged);
      _compactChanged();
    }
    if (!_scrubbing && widget.currentBranch != _shown) _select(widget.currentBranch);
    if (oldWidget.startHoldsResume != widget.startHoldsResume) {
      final to = widget.startHoldsResume ? 1.0 : 0.0;
      if (_reduced) {
        _hold.value = to;
      } else {
        _hold.animateTo(to, curve: Motion.out);
      }
    }
    if (oldWidget.startResumeId != widget.startResumeId) {
      if (widget.startResumeId == null) {
        _label.value = 0;
      } else {
        WidgetsBinding.instance.addPostFrameCallback((_) => _maybeSlideResume());
      }
    }
  }

  /// The key's word as 0 (Start) to 1 (Resume): the held word, or the once-a-session slide.
  double get _labelShift => math.max(_hold.value, _slideShift);

  /// The slide as 0 (Start) to 1 (Resume): in over the first 14%, held, out over the last 18%.
  double get _slideShift {
    final t = _label.value;
    if (t <= 0 || t >= 1) return 0;
    if (t < 0.14) return Motion.glide.transform(t / 0.14);
    if (t > 0.82) return 1 - Motion.glide.transform((t - 0.82) / 0.18);
    return 1;
  }

  @override
  void dispose() {
    widget.compact?.removeListener(_compactChanged);
    _edges.removeListener(_watchEdges);
    for (final c in [_left, _right, _ownCollapse, _labelsOut, _lift, _xfade, _press, _gel, _ripple, _enter, _pop, _stretch, _label, _hold, ..._on, ..._settle]) {
      c.dispose();
    }
    _capsuleLight.dispose();
    _keyLight.dispose();
    super.dispose();
  }

  // Collapse: one controller for the capsule and the key.

  void _compactChanged() {
    final compact = widget.compact?.value ?? false;
    if (_reduced) {
      // The height changes at once; only the labels cross-fade (120 ms).
      _ownCollapse.value = compact ? 1 : 0;
      _labelsOut.animateTo(compact ? 1 : 0, duration: Motion.reducedFade);
      return;
    }
    if (compact) {
      _ownCollapse.animateTo(1, duration: const Duration(milliseconds: 240), curve: Motion.emphasized);
      _labelsOut.animateTo(1, duration: const Duration(milliseconds: 120), curve: Motion.exit);
    } else {
      _ownCollapse.animateTo(0, duration: Motion.glideDuration, curve: Motion.glide);
      _labelsOut.animateTo(0, duration: Motion.glideDuration, curve: Motion.glide);
    }
  }

  // The lens and the icons.

  double get _lensCenter => (_left.value + _right.value) / 2;

  void _watchEdges() {
    final edge = _arrivalEdge;
    final arriving = _arriving;
    if (edge != null && arriving != null) {
      final span = _arrivalTo - _arrivalFrom;
      final done = span == 0 ? 1.0 : (edge.value - _arrivalFrom) / span;
      if (done >= 0.7) {
        _arriving = null;
        _arrivalEdge = null;
        _arrive(arriving);
      }
    }
    if (_dropPending && !_fingerDown && _trailDone >= 0.85) {
      _dropPending = false;
      _drop();
    }
  }

  /// How far the trailing edge is through its travel (1 when nothing travels).
  double get _trailDone {
    final edge = _trailEdge;
    if (edge == null || !edge.isAnimating) return 1;
    final span = _trailTo - _trailFrom;
    return span == 0 ? 1.0 : ((edge.value - _trailFrom) / span).clamp(0.0, 1.0);
  }

  void _liftLens() {
    if (_reduced) return;
    _dropPending = false;
    _lift.animateWith(_spring(Springs.lensLift, _lift.value, 1, velocity: _lift.velocity));
  }

  /// The lens sinks back into the glass now, or once its trailing edge has nearly landed.
  void _settleLift() {
    if (_lift.value == 0 && !_lift.isAnimating) return;
    if (_trailDone < 0.85) {
      _dropPending = true;
    } else {
      _drop();
    }
  }

  void _drop() {
    if (_reduced) {
      _lift.value = 0;
      return;
    }
    _lift.animateWith(_spring(Springs.lensDrop, _lift.value, 0, velocity: _lift.velocity));
  }

  void _glideTo(int slot, {double velocity = 0, bool flick = false}) {
    final (tl, tr) = _geo.lensEdges(slot);
    final rightward = (tl + tr) / 2 > _lensCenter;
    if (_reduced) {
      if ((_left.value - tl).abs() > 0.5) {
        // A 120 ms cross-fade: the lens leaves where it was and appears on the new tab.
        _ghost = (_left.value, _right.value);
        _xfade.forward(from: 0);
      }
      _left.value = tl;
      _right.value = tr;
      return;
    }
    final lead = rightward ? _right : _left;
    final trail = rightward ? _left : _right;
    final leadTo = rightward ? tr : tl;
    final trailTo = rightward ? tl : tr;
    _arrivalEdge = lead;
    _arrivalFrom = lead.value;
    _arrivalTo = leadTo;
    _trailEdge = trail;
    _trailFrom = trail.value;
    _trailTo = trailTo;
    // A flick lands with a little bounce, carrying the finger's speed; a tap never overshoots.
    final leadSpring = flick ? Springs.edgeLead : MmBottomBar.tapLead;
    final trailSpring = flick ? Springs.edgeTrail : MmBottomBar.tapTrail;
    lead.animateWith(_edgeSpring(leadSpring, lead.value, leadTo, velocity: velocity != 0 ? velocity : lead.velocity));
    trail.animateWith(_edgeSpring(trailSpring, trail.value, trailTo, velocity: velocity != 0 ? velocity * 0.6 : trail.velocity));
  }

  /// Makes [branch] the active one: the old icon goes back to its outline, the lens travels, the
  /// new icon fills as the lens arrives.
  void _select(int branch, {double velocity = 0, bool flick = false}) {
    final slot = branchToSlot(branch);
    if (branch == _shown) {
      _glideTo(slot, velocity: velocity, flick: flick);
      return;
    }
    _depart(_shown);
    _shown = branch;
    if (_reduced) {
      _glideTo(slot);
      _arrive(branch);
      return;
    }
    _arriving = branch;
    _glideTo(slot, velocity: velocity, flick: flick);
    // A lens that is already home (a re-target of a travel that had arrived) arrives now.
    _watchEdges();
  }

  /// The filled icon empties back to its outline (160 ms). Ease-out, not the exit curve: the
  /// tab stays on screen, so it lets go at once instead of lingering half filled.
  void _depart(int branch) {
    if (_arriving == branch) _arriving = null;
    if (_reduced) {
      _on[branch].value = 0;
      return;
    }
    _on[branch].animateBack(0, curve: Motion.out);
  }

  /// The outlined icon fills (200 ms) and settles from 0.9 to 1. Called once the lens's leading
  /// edge has passed 70% of its travel, so the new tab never fills before the lens is there.
  void _arrive(int branch) {
    if (branch != _shown) return;
    if (_reduced) {
      _on[branch].value = 1;
      _settle[branch].value = 1;
      return;
    }
    _on[branch].animateTo(1, curve: Motion.glide);
    _settle[branch].value = 0.9;
    _settle[branch].animateWith(_spring(MmBottomBar.iconSettle, 0.9, 1));
  }

  /// An icon's magnification under a lifted lens: up to 1.10 at the lens's centre, nothing a
  /// slot away.
  double _magnifyOf(int slot) {
    final lift = _lift.value.clamp(0.0, 1.0);
    if (lift <= 0) return 1;
    final near = (1 - (_geo.slotCenter(slot) - _lensCenter).abs() / _geo.slot).clamp(0.0, 1.0);
    return 1 + MmBottomBar.magnify * lift * near;
  }

  // The finger on the capsule: the lift and the light.

  void _capsuleDown(PointerDownEvent e) {
    _fingerDown = true;
    _capsuleLight.down(e.localPosition, reduced: _reduced);
    _liftLens();
  }

  void _capsuleMove(PointerMoveEvent e) => _capsuleLight.move(e.localPosition);

  void _capsuleUp(PointerEvent e) {
    _fingerDown = false;
    _capsuleLight.up();
    // The tap that this finger makes is decided after this event: settle the lift once it has.
    scheduleMicrotask(() {
      if (mounted && !_fingerDown && !_scrubbing) _settleLift();
    });
  }

  /// How much a finger on the capsule brightens the key's rim: up to 1.4 times within 80 dp.
  double get _keyRimBoost {
    final at = _capsuleLight.position;
    if (at == null) return 0;
    final d = (at - _geo.keyCircle().center).distance;
    return 0.4 * _capsuleLight.strength * (1 - d / 80).clamp(0.0, 1.0);
  }

  // Taps.

  void _tabDown(int branch) {
    if (branch == _shown || _scrubbing || _reduced) return;
    // Anticipation: the near edge leans 0.18 of a slot toward the pressed tab.
    final target = _geo.slotCenter(branchToSlot(branch));
    final lean = 0.18 * _geo.slot;
    final (l, r) = _geo.lensEdges(branchToSlot(_shown));
    if (target > _lensCenter) {
      _right.animateTo(r + lean, duration: const Duration(milliseconds: 120), curve: Motion.out);
    } else {
      _left.animateTo(l - lean, duration: const Duration(milliseconds: 120), curve: Motion.out);
    }
  }

  void _tabCancel(int branch) {
    if (branch == _shown || _scrubbing) return;
    _glideBackHome();
  }

  void _glideBackHome() {
    final (l, r) = _geo.lensEdges(branchToSlot(_shown));
    if (_reduced) {
      _left.value = l;
      _right.value = r;
      return;
    }
    _left.animateWith(_edgeSpring(Springs.smooth, _left.value, l, velocity: _left.velocity));
    _right.animateWith(_edgeSpring(Springs.smooth, _right.value, r, velocity: _right.velocity));
  }

  void _tabTap(int branch) {
    if (branch != _shown) {
      ref.read(hapticsProvider).selection();
      _select(branch);
    }
    widget.onTab(branch);
  }

  // Scrub.

  /// The lens's centre for a finger that wants it at [want]: free between Today and You, a
  /// rubber band past them (a hard stop under reduced motion).
  double _bandLens(double want) {
    final lo = _geo.slotCenter(0);
    final hi = _geo.slotCenter(kBarSlots - 1);
    if (want >= lo && want <= hi) return want;
    if (_reduced) return want.clamp(lo, hi);
    return want < lo ? lo + MmBottomBar.rubberBand(want - lo, _geo.slot) : hi + MmBottomBar.rubberBand(want - hi, _geo.slot);
  }

  void _scrubStart(DragStartDetails d) {
    final insets = MediaQuery.systemGestureInsetsOf(context);
    final screen = MediaQuery.sizeOf(context).width;
    final x = d.globalPosition.dx;
    // Never inside Android's back-gesture strips.
    if (x < insets.left || x > screen - insets.right) return;
    _scrubbing = true;
    _arriving = null;
    _arrivalEdge = null;
    _trailEdge = null;
    _left.stop();
    _right.stop();
    final finger = d.localPosition.dx;
    // Grabbed on the lens, it keeps the grab offset; grabbed elsewhere, it comes to the finger.
    final half = _geo.lensWidth / 2;
    _grab = (finger - _lensCenter).abs() <= half ? finger - _lensCenter : 0;
    _scrubSpeed = 0;
    _lastScrubAt = d.sourceTimeStamp;
    _scrubCenter = finger - _grab;
    _moveLens(_bandLens(_scrubCenter));
    _liftLens();
  }

  void _moveLens(double center, {double stretch = 0}) {
    final half = _geo.lensWidth * (1 + stretch) / 2;
    _left.value = center - half;
    _right.value = center + half;
  }

  void _scrubUpdate(DragUpdateDetails d) {
    if (!_scrubbing) return;
    _capsuleLight.move(d.localPosition);
    final at = d.sourceTimeStamp;
    final last = _lastScrubAt;
    if (at != null && last != null && at > last) {
      final v = d.delta.dx / ((at - last).inMicroseconds / 1e6);
      _scrubSpeed = 0.7 * _scrubSpeed + 0.3 * v;
    }
    _lastScrubAt = at;
    final before = _geo.nearestSlot(_lensCenter);
    _scrubCenter += d.delta.dx;
    final center = _bandLens(_scrubCenter);
    final stretch = _reduced ? 0.0 : math.min(0.12, _scrubSpeed.abs() / 4000);
    _moveLens(center, stretch: stretch);
    final after = _geo.nearestSlot(center);
    if (after != before) ref.read(hapticsProvider).selection();
    final branch = slotToBranch(after);
    if (branch != _shown) {
      _depart(_shown);
      _shown = branch;
      _arrive(branch);
    }
  }

  void _scrubEnd(DragEndDetails d) {
    if (!_scrubbing) return;
    _scrubbing = false;
    final velocity = d.velocity.pixelsPerSecond.dx;
    final rest = _reduced ? _lensCenter : MmBottomBar.project(_lensCenter, velocity);
    final branch = slotToBranch(_geo.nearestSlot(rest));
    if (branch != _shown) {
      _select(branch, velocity: velocity, flick: true);
    } else {
      _glideTo(branchToSlot(branch), velocity: velocity, flick: true);
    }
    if (!_fingerDown) _settleLift();
    if (branch != widget.currentBranch) widget.onTab(branch);
  }

  void _scrubCancel() {
    if (!_scrubbing) return;
    _scrubbing = false;
    _select(widget.currentBranch);
    _settleLift();
  }

  // Start.

  Rect _startRect() {
    final box = _startKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) {
      final size = MediaQuery.sizeOf(context);
      final circle = _geo.keyCircle(collapse: _collapse.value);
      return circle.shift(Offset((size.width - _geo.width) / 2, size.height - 60 - MmBar.height));
    }
    final local = StartKeyFace.keyRect(box.size, _collapse.value);
    return local.shift(box.localToGlobal(Offset.zero));
  }

  void _startTap() {
    if (!_reduced) _ripple.forward(from: 0);
    widget.onStart(_startRect());
  }

  void _keyDown(PointerDownEvent e) {
    _keyLight.down(e.localPosition, reduced: _reduced);
    if (_reduced) {
      _press.value = 1;
      return;
    }
    _press.forward();
    // Gel: it squashes under the finger over 100 ms, anchored at its foot.
    _gel.animateTo(1, duration: MotionDurations.gelSquash, curve: Motion.out);
  }

  void _keyUp(PointerEvent e) {
    _keyLight.up();
    if (_reduced) {
      _press.value = 0;
      return;
    }
    _press.reverse();
    // It springs back with one small wobble (not after a drag, which springs back by itself).
    _gel.animateWith(_spring(Springs.dock, _gel.value, 0, velocity: _dragging ? 0 : -6));
  }

  double get _openDistance => (MediaQuery.sizeOf(context).height * 0.5).clamp(280.0, 460.0);

  void _startDragUpdate(DragUpdateDetails d) {
    final target = widget.startDrag;
    if (target == null) return;
    if (!_dragging) {
      if (d.delta.dy >= 0) return;
      _dragging = true;
      _pastOpen = false;
      _drag = 0;
      _label.value = 0;
      _stretch.stop();
      _gel.value = 0;
      ref.read(hapticsProvider).light();
      target.begin(_startRect());
    }
    _drag = (_drag - d.delta.dy).clamp(0.0, _openDistance);
    final progress = _drag / _openDistance;
    final past = progress >= 0.35;
    if (past != _pastOpen) {
      _pastOpen = past;
      if (past) {
        ref.read(hapticsProvider).selection();
        // The ink ring fires as the sheet reaches the point where letting go opens it.
        if (!_reduced) _ripple.forward(from: 0);
      }
    }
    if (!_reduced) _stretch.value = progress.clamp(0.0, 1.0);
    target.update(progress);
  }

  /// The key lets go of its stretch: it springs back through a little squash.
  void _releaseStretch() {
    if (_reduced || _stretch.value == 0) {
      _stretch.value = 0;
      return;
    }
    _stretch.animateWith(_spring(Springs.smooth, _stretch.value, 0));
  }

  void _startDragEnd(DragEndDetails d) {
    final target = widget.startDrag;
    _press.reverse();
    if (!_dragging || target == null) return;
    _dragging = false;
    final velocity = d.velocity.pixelsPerSecond.dy;
    _releaseStretch();
    target.end(open: _drag / _openDistance >= 0.35 || velocity < -700);
  }

  // Build.

  Widget _entering(int order, Widget child) {
    if (!widget.entrance) return child;
    // Left to right, 30 ms apart; Start comes last.
    final total = MmBottomBar.entranceDuration.inMilliseconds;
    final start = order * 30 / total;
    final curve = CurvedAnimation(parent: _enter, curve: Interval(start, (start + 300 / total).clamp(0.0, 1.0), curve: Motion.glide));
    return FadeTransition(
      opacity: curve,
      child: AnimatedBuilder(
        animation: curve,
        builder: (context, child) => Transform.translate(offset: Offset(0, 6 * (1 - curve.value)), child: child),
        child: child,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final geo = _geo;
    final badges = widget.badges;
    final shown = MmBottomBar.visibleBadges(badges);
    final iconColors = BarIconColors.of(colors);
    final lensStyle = BarLensStyle.of(colors);
    final ring = colors.isNight ? const Color(0xFF1B1A16) : const Color(0xFFFFFDF8);
    final reduced = _reduced;

    final glass = Positioned.fill(
      child: RepaintBoundary(
        child: BarGlass(
          quality: widget.quality,
          repaint: _collapse,
          shape: (size) => geo.capsuleShape(_collapse.value),
        ),
      ),
    );

    final light = Positioned.fill(
      child: IgnorePointer(
        child: RepaintBoundary(
          child: CustomPaint(
            painter: TouchLightPainter(
              light: _capsuleLight,
              repaint: _collapse,
              shape: (size) => geo.capsuleShape(_collapse.value),
              color: TouchLightPainter.colorFor(night: colors.isNight),
            ),
          ),
        ),
      ),
    );

    final lens = Positioned.fill(
      child: IgnorePointer(
        child: RepaintBoundary(
          child: CustomPaint(
            painter: BarLensPainter(
              left: _left,
              right: _right,
              collapse: _collapse,
              labelsOut: _labelsOut,
              lift: _lift,
              restWidth: geo.lensWidth,
              labelWidth: _labelWidth,
              capsule: geo.capsuleShape,
              style: lensStyle,
              trailVelocity: () => _trailEdge?.velocity ?? 0,
              ghost: reduced ? () => _ghost : null,
              ghostFade: reduced ? _xfade : null,
              fringe: !MediaQuery.highContrastOf(context),
            ),
          ),
        ),
      ),
    );

    final slots = <Widget>[
      for (var slot = 0; slot < kBarSlots; slot++)
        Positioned(
          left: geo.slotLeft(slot),
          top: 0,
          bottom: 0,
          width: geo.slot,
          child: _entering(
            slot,
            _tabSlot(
              branch: slotToBranch(slot),
              slot: slot,
              iconColors: iconColors,
              ring: ring,
              badgeText: slotToBranch(slot) == BarBranch.review && shown.review ? badges.reviewText : null,
              dot: switch (slotToBranch(slot)) {
                BarBranch.review => shown.review && badges.reviewText == null,
                BarBranch.colleges => shown.colleges,
                BarBranch.you => shown.you,
                _ => false,
              },
              semanticsLabel: barTabSemanticsLabel(
                slotToBranch(slot),
                reviewCount: badges.reviewCount,
                reviewDot: badges.showReviewDot,
                collegesDot: shown.colleges,
                youDot: shown.you,
              ),
            ),
          ),
        ),
    ];

    final capsule = Listener(
      onPointerDown: _capsuleDown,
      onPointerMove: _capsuleMove,
      onPointerUp: _capsuleUp,
      onPointerCancel: _capsuleUp,
      child: GestureDetector(
        dragStartBehavior: DragStartBehavior.down,
        onHorizontalDragStart: _scrubStart,
        onHorizontalDragUpdate: _scrubUpdate,
        onHorizontalDragEnd: _scrubEnd,
        onHorizontalDragCancel: _scrubCancel,
        child: Stack(clipBehavior: Clip.none, children: [glass, light, lens, ...slots]),
      ),
    );

    Widget bar = SizedBox(
      width: geo.width,
      height: MmBar.height,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fromRect(rect: geo.capsuleRect, child: capsule),
          Positioned.fromRect(rect: geo.keyBox, child: _entering(kBarSlots, _key())),
        ],
      ),
    );

    if (widget.entrance) {
      // The bar rises 16 dp and fades in over 300 ms, before its items finish.
      final rise = CurvedAnimation(parent: _enter, curve: const Interval(0, 300 / 420, curve: Motion.glide));
      bar = FadeTransition(
        opacity: rise,
        child: AnimatedBuilder(
          animation: rise,
          builder: (context, child) => Transform.translate(offset: Offset(0, 16 * (1 - rise.value)), child: child),
          child: bar,
        ),
      );
    }

    return Semantics(
      container: true,
      explicitChildNodes: true,
      child: FocusTraversalGroup(policy: OrderedTraversalPolicy(), child: bar),
    );
  }

  Widget _tabSlot({
    required int branch,
    required int slot,
    required BarIconColors iconColors,
    required Color ring,
    required String? badgeText,
    required bool dot,
    required String semanticsLabel,
  }) {
    final colors = context.mmColors;
    final tab = kBarTabs[branch];
    final width = _geo.slot;

    final icon = AnimatedBuilder(
      animation: Listenable.merge([_settle[branch], _edges, _lift]),
      builder: (context, child) => Transform.scale(scale: _settle[branch].value * _magnifyOf(slot), child: child),
      child: RepaintBoundary(
        child: CustomPaint(
          size: const Size.square(MmBar.icon),
          painter: BarIconPainter(glyph: tab.icon.glyph, colors: iconColors, on: _on[branch]),
        ),
      ),
    );

    final iconGroup = SizedBox(
      width: MmBar.icon,
      height: MmBar.icon,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(child: icon),
          if (badgeText != null || dot)
            Positioned(
              left: MmBar.icon + 2,
              top: 1,
              child: FractionalTranslation(
                translation: const Offset(-0.5, -0.5),
                child: _Badge(text: badgeText, ring: ring),
              ),
            ),
        ],
      ),
    );

    final label = AnimatedBuilder(
      animation: _on[branch],
      builder: (context, _) => Text(
        tab.label,
        maxLines: 1,
        softWrap: false,
        style: _labelStyle(Color.lerp(colors.ink2, colors.ink, _on[branch].value)!, _on[branch].value),
      ),
    );

    final labelBox = _geo.labelBoxWidth;
    final content = AnimatedBuilder(
      animation: _collapse,
      builder: (context, child) => Transform.translate(offset: Offset(0, MmBar.compactShift * _collapse.value), child: child),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(left: (width - MmBar.icon) / 2, top: MmBar.iconTop, child: iconGroup),
          Positioned(
            left: (width - labelBox) / 2,
            width: labelBox,
            top: MmBar.labelTop,
            height: MmBar.labelHeight,
            child: FadeTransition(
              opacity: ReverseAnimation(_labelsOut),
              child: RepaintBoundary(
                child: Center(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: MediaQuery.withClampedTextScaling(maxScaleFactor: 1.2, child: label),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );

    final focused = _focusedSlot == slot;
    return Semantics(
      container: true,
      button: true,
      selected: branch == _shown,
      label: semanticsLabel,
      sortKey: OrdinalSortKey(slot.toDouble() + 1),
      onTap: () => _tabTap(branch),
      child: ExcludeSemantics(
        child: FocusTraversalOrder(
          order: NumericFocusOrder(slot.toDouble()),
          child: FocusableActionDetector(
            actions: {ActivateIntent: CallbackAction<ActivateIntent>(onInvoke: (_) => _tabTap(branch))},
            onShowFocusHighlight: (on) => setState(() => _focusedSlot = on ? slot : (_focusedSlot == slot ? null : _focusedSlot)),
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapDown: (_) {
                _pressTab(branch);
                _tabDown(branch);
              },
              onTapUp: (_) => _pressTab(null),
              onTapCancel: () {
                _pressTab(null);
                _tabCancel(branch);
              },
              onTap: () => _tabTap(branch),
              child: CustomPaint(
                foregroundPainter: focused
                    ? _FocusRing(
                        collapse: _collapse,
                        color: colors.focusRing,
                        shape: (size, e) => BarLensPainter.shapeFor(
                          left: (size.width - _geo.lensWidth) / 2,
                          right: (size.width + _geo.lensWidth) / 2,
                          collapse: e,
                          labelsOut: _labelsOut.value,
                          restWidth: _geo.lensWidth,
                          labelWidth: _labelWidth,
                        ).rrect,
                      )
                    : null,
                child: SizedBox(
                  width: width,
                  height: MmBar.height,
                  child: AnimatedScale(
                    scale: _pressedTab == branch ? MmBottomBar.tabPressScale : 1,
                    duration: _reduced ? Duration.zero : (_pressedTab == branch ? Motion.press : MmBottomBar.tabRelease),
                    curve: _pressedTab == branch ? Motion.out : Motion.emphasized,
                    child: content,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _key() {
    final colors = context.mmColors;
    final resume = widget.startResumeLabel;
    final onResume = widget.onStartResume;
    final style = widget.startStyle;
    final face = AnimatedBuilder(
      animation: Listenable.merge([_press, _ripple, _pop, _gel, _stretch, _label, _hold, _capsuleLight.listenable]),
      builder: (context, _) {
        final pressed = widget.startPressed ? 1.0 : Motion.out.transform(_press.value.clamp(0.0, 1.0));
        // The first appearance's pop: 1, 1.05, 1.
        final p = _pop.value;
        final pop = p >= 1 ? 1.0 : 1 + 0.05 * (p < 0.4 ? Motion.out.transform(p / 0.4) : 1 - Motion.out.transform((p - 0.4) / 0.6));
        return Transform.scale(
          scale: pop,
          child: StartKeyFace(
            collapse: _collapse,
            labelsOut: _labelsOut,
            pressed: pressed,
            ripple: _ripple.value,
            stretch: _stretch.value,
            gel: widget.startPressed ? 1 : _gel.value,
            labelShift: _labelShift,
            light: _keyLight,
            rimBoost: _keyRimBoost,
            style: style,
          ),
        );
      },
    );

    // The glass key (A) is the capsule's glass in a circle, in the same backdrop group.
    final keyGlass = style == StartKeyStyle.glass
        ? Positioned.fill(
            child: RepaintBoundary(
              child: BarGlass(
                quality: widget.quality,
                repaint: _collapse,
                shape: (size) {
                  final c = StartKeyFace.keyRect(size, _collapse.value);
                  return RRect.fromRectAndRadius(c, Radius.circular(c.width / 2));
                },
              ),
            ),
          )
        : null;

    return Semantics(
      container: true,
      button: true,
      label: widget.startHoldsResume ? MmBottomBar.resumeSemanticsLabel : MmBottomBar.startSemanticsLabel,
      sortKey: OrdinalSortKey(kBarSlots.toDouble() + 1),
      onTap: _startTap,
      customSemanticsActions: resume == null || onResume == null ? null : {CustomSemanticsAction(label: resume): onResume},
      child: ExcludeSemantics(
        child: FocusTraversalOrder(
          order: NumericFocusOrder(kBarSlots.toDouble()),
          child: FocusableActionDetector(
            actions: {ActivateIntent: CallbackAction<ActivateIntent>(onInvoke: (_) => _startTap())},
            onShowFocusHighlight: (on) => setState(() => _keyFocused = on),
            child: Listener(
              // The press shows the moment a finger lands, before the tap is decided.
              onPointerDown: _keyDown,
              onPointerUp: _keyUp,
              onPointerCancel: _keyUp,
              child: GestureDetector(
                key: _startKey,
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  ref.read(hapticsProvider).light();
                  _startTap();
                },
                onVerticalDragUpdate: widget.startDrag == null ? null : _startDragUpdate,
                onVerticalDragEnd: widget.startDrag == null ? null : _startDragEnd,
                onVerticalDragCancel: widget.startDrag == null ? null : () => _startDragEnd(DragEndDetails(primaryVelocity: 0)),
                child: CustomPaint(
                  foregroundPainter: _keyFocused
                      ? _FocusRing(
                          collapse: _collapse,
                          color: colors.focusRing,
                          shape: (size, e) {
                            final c = StartKeyFace.keyRect(size, e);
                            return RRect.fromRectAndRadius(c, Radius.circular(c.width / 2));
                          },
                        )
                      : null,
                  child: SizedBox(
                    width: MmBar.keySize,
                    height: MmBar.height,
                    child: Stack(clipBehavior: Clip.none, children: [?keyGlass, Positioned.fill(child: face)]),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The keyboard focus ring: 2 dp, 2 dp outside the lens shape on a tab (or the key's circle).
class _FocusRing extends CustomPainter {
  _FocusRing({required this.collapse, required this.color, required this.shape}) : super(repaint: collapse);

  final Animation<double> collapse;
  final Color color;
  final RRect Function(Size size, double collapse) shape;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRRect(
      shape(size, collapse.value).inflate(3),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(_FocusRing old) => old.collapse != collapse || old.color != color || old.shape != shape;
}

/// A badge (a count, "9+") or, with no [text], an 8 dp dot. It arrives from 0.95 and clear over
/// 200 ms on `Motion.out`; a changed count rolls over 300 ms. It never pulses or loops.
class _Badge extends StatefulWidget {
  const _Badge({required this.text, required this.ring});

  final String? text;
  final Color ring;

  @override
  State<_Badge> createState() => _BadgeState();
}

class _BadgeState extends State<_Badge> with SingleTickerProviderStateMixin {
  late final AnimationController _in = AnimationController.unbounded(vsync: this, value: 0);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_in.value == 0 && !_in.isAnimating) {
      if (Motion.reduced(context)) {
        _in.value = 1;
      } else {
        // From 0.95 and clear on Out over 200 ms: a badge arrives, it does not bounce in from
        // 0.6 (AP1-10, standards s8 and s10 item 6 [T-105, A-006]).
        _in.animateTo(1, duration: Motion.ui, curve: Motion.out);
      }
    }
  }

  @override
  void dispose() {
    _in.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // Ink, not volt, in both themes: the lime Start key beside the capsule and the page's own
    // primary action are the only lime fills on a screen (one volt fill per screen).
    final fill = colors.ink;
    final ink = colors.isNight ? const Color(0xFF1B1A16) : const Color(0xFFF4F0E6);
    final text = widget.text;
    final reduced = Motion.reduced(context);

    final Widget body;
    if (text == null) {
      body = _ringed(fill, const SizedBox.square(dimension: 8), circle: true);
    } else {
      final label = AnimatedSwitcher(
        duration: reduced ? Duration.zero : const Duration(milliseconds: 300),
        switchInCurve: Motion.glide,
        switchOutCurve: Motion.exit,
        transitionBuilder: (child, animation) {
          final incoming = child.key == ValueKey(text);
          return ClipRect(
            child: SlideTransition(
              position: Tween<Offset>(begin: Offset(0, incoming ? 0.8 : -0.8), end: Offset.zero).animate(animation),
              child: FadeTransition(opacity: animation, child: child),
            ),
          );
        },
        child: Text(
          text,
          key: ValueKey(text),
          textScaler: TextScaler.noScaling,
          style: type.caption.copyWith(
            fontFamily: MmFonts.hanken,
            fontSize: 11,
            height: 14 / 11,
            fontWeight: FontWeight.w700,
            color: ink,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      );
      body = _ringed(
        fill,
        ConstrainedBox(
          constraints: BoxConstraints(minWidth: text.length > 1 ? 22 : 16, minHeight: 16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Center(widthFactor: 1, child: label),
          ),
        ),
      );
    }
    return AnimatedBuilder(
      animation: _in,
      builder: (context, child) {
        final v = _in.value;
        return Opacity(
          opacity: v.clamp(0.0, 1.0),
          child: Transform.scale(scale: 0.95 + 0.05 * v, child: child),
        );
      },
      child: body,
    );
  }

  Widget _ringed(Color fill, Widget child, {bool circle = false}) => DecoratedBox(
    decoration: ShapeDecoration(
      color: fill,
      shape: circle
          ? CircleBorder(side: BorderSide(color: widget.ring, width: 1.5, strokeAlign: BorderSide.strokeAlignOutside))
          : StadiumBorder(side: BorderSide(color: widget.ring, width: 1.5, strokeAlign: BorderSide.strokeAlignOutside)),
    ),
    child: child,
  );
}
