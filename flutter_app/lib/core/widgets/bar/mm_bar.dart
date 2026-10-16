import 'dart:math' as math;

import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/gestures.dart' show DragStartBehavior;
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart' show CustomSemanticsAction, OrdinalSortKey;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../haptics/haptics.dart';
import '../../motion/motion.dart';
import '../../theme/theme.dart';
import 'bar_badges.dart';
import 'bar_glass.dart';
import 'bar_icons.dart';
import 'bar_lens.dart';
import 'bar_tabs.dart';
import 'start_key.dart';

export 'bar_badges.dart' show BarBadges;

/// The bar's measures on one screen width (app-ia-1016.md section 4.1, which replaces DOCK.md
/// 3.1). Six equal slots run left to right: Today, Practice, Start, Review, Colleges, You.
class BarGeometry {
  BarGeometry(double screenWidth) : width = MmBar.widthFor(screenWidth), slot = MmBar.slotFor(screenWidth);

  /// The bar's width: the screen less 16 dp each side (8 below 360 dp), at most 440.
  final double width;

  /// Every slot's width, Start's included: (W - 12) / 6.
  final double slot;

  /// A tab slot's width (the same as every slot).
  double get tabSlot => slot;

  /// The Start slot's width (the same as every slot).
  double get startSlot => slot;

  double slotWidth(int index) => slot;

  double slotLeft(int index) => MmBar.pad + slot * index;

  double slotCenter(int index) => MmBar.pad + slot * (index + 0.5);

  /// The lens's width at rest, and the Start pill's: a slot less 2 dp each side.
  double get lensWidth => slot - 2 * MmBar.pillInset;

  /// The lens's edges on a tab [index].
  (double, double) lensEdges(int index) {
    final c = slotCenter(index);
    return (c - lensWidth / 2, c + lensWidth / 2);
  }

  /// The pill's rect (the lens at rest, or the Start pill) on slot [index], in the bar's 64 dp
  /// box, at [collapse] (0 expanded, 1 compact).
  Rect pillRect(int index, {double collapse = 0}) {
    final barHeight = MmBar.height - (MmBar.height - MmBar.compactHeight) * collapse;
    final (l, r) = lensEdges(index);
    return Rect.fromLTRB(l, MmBar.height - barHeight + MmBar.pad, r, MmBar.height - MmBar.pad);
  }

  /// The icon box (24 by 24) on slot [index], at [collapse]: y 11 to 35 expanded, 15 dp lower
  /// compact.
  Rect iconRect(int index, {double collapse = 0}) => Rect.fromCenter(
    center: Offset(slotCenter(index), MmBar.iconTop + MmBar.icon / 2 + MmBar.compactShift * collapse),
    width: MmBar.icon,
    height: MmBar.icon,
  );

  /// The label's line box on slot [index] (the slot less 2 dp each side, y 39 to 53).
  Rect labelRect(int index) => Rect.fromLTWH(slotLeft(index) + MmBar.pillInset, MmBar.labelTop, lensWidth, MmBar.labelHeight);

  /// The visual slot under [x] (px from the bar's left edge), clamped to the bar.
  int slotAt(double x) => ((x - MmBar.pad) / slot).floor().clamp(0, kBarSlots - 1);

  /// The tab slot nearest [x]; never the Start slot.
  int nearestTabSlot(double x) {
    var best = 0;
    var distance = double.infinity;
    for (var index = 0; index < kBarSlots; index++) {
      if (index == kStartSlot) continue;
      final d = (slotCenter(index) - x).abs();
      if (d < distance) {
        distance = d;
        best = index;
      }
    }
    return best;
  }
}

/// Starts, follows and settles a drag up from Start that opens the Start sheet out of the key.
abstract interface class StartDragTarget {
  /// The drag has begun from the key's [origin] (global coordinates).
  void begin(Rect origin);

  /// The sheet is [progress] of the way open (0 to 1).
  void update(double progress);

  /// The finger lifted: open the sheet, or settle back into the key.
  void end({required bool open});
}

/// The bottom bar (DOCK.md, with the geometry of app-ia-1016.md section 4): one centred glass
/// bar of six equal slots, Today, Practice, the volt Start key, Review, Colleges and You. Start is
/// laid out like a tab, so every icon, every label and the Start pill share their centre lines.
///
/// * Tap a tab: a `selectionClick`, the lens travels on two springs (its leading edge quick, its
///   trailing edge slow, so it stretches toward the new tab and gathers itself), the old icon
///   goes back to its outline and the new one fills as the lens arrives.
/// * Press an inactive tab: the lens's near edge leans toward it before the travel.
/// * Scrub: a horizontal drag that starts on a tab (never on Start, never inside the system's
///   back-gesture strips) moves the lens 1:1, with a click at each tab boundary; the lens slides
///   under Start, which dips to 0.97. On release it lands on the nearest tab, projected by the
///   finger's velocity over 80 ms.
/// * Start: a tap opens the sheet; a drag up pulls it open out of the key.
/// * Collapse ([compact]): the bar's painted height goes from 64 to 52, bottom anchored, by clip
///   and transform only; labels fade; the lens and Start shrink with it.
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
    this.startPressed = false,
    this.entrance = false,
    this.startResumeLabel,
    this.onStartResume,
    this.startResumeId,
    this.quality,
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

  /// Sessions whose Resume slide has played in this app run.
  static final Set<String> _resumeSlid = <String>{};

  /// Forgets which sessions have slid (tests).
  static void resetResumeSlide() => _resumeSlid.clear();

  /// Overrides the inherited glass tier (goldens).
  final GlassQuality? quality;

  static const String startSemanticsLabel = 'Start. Opens quick start.';

  /// The lens's leading edge (quick) and trailing edge (slow).
  static final SpringDescription edgeLead = SpringDescription.withDurationAndBounce(duration: const Duration(milliseconds: 240), bounce: 0.14);
  static final SpringDescription edgeTrail = SpringDescription.withDurationAndBounce(duration: const Duration(milliseconds: 420), bounce: 0.04);

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

  @override
  ConsumerState<MmBottomBar> createState() => MmBottomBarState();
}

class MmBottomBarState extends ConsumerState<MmBottomBar> with TickerProviderStateMixin {
  late BarGeometry _geo = BarGeometry(360);
  late final AnimationController _left = AnimationController.unbounded(vsync: this);
  late final AnimationController _right = AnimationController.unbounded(vsync: this);
  late final AnimationController _collapse = AnimationController(vsync: this, value: widget.compact?.value == true ? 1 : 0);
  late final AnimationController _labelsOut = AnimationController(vsync: this, value: widget.compact?.value == true ? 1 : 0);
  late final AnimationController _dip = AnimationController(vsync: this, duration: const Duration(milliseconds: 120));
  late final AnimationController _press = AnimationController(vsync: this, duration: Motion.press, reverseDuration: Motion.release);
  late final AnimationController _ripple = AnimationController(vsync: this, duration: const Duration(milliseconds: 380), value: 1);
  late final AnimationController _enter = AnimationController(vsync: this, duration: MmBottomBar.entranceDuration, value: 1);
  late final AnimationController _pop = AnimationController(vsync: this, duration: const Duration(milliseconds: 360), value: 1);

  /// The release overshoot (0 to 1, then rests at 1), and the drag's stretch (0 to 1, springs back
  /// through a little squash), and the Start-to-Resume label slide (0 Start, 1 Resume).
  late final AnimationController _overshoot = AnimationController(vsync: this, duration: const Duration(milliseconds: 280), value: 1);
  late final AnimationController _stretch = AnimationController.unbounded(vsync: this);
  late final AnimationController _label = AnimationController(vsync: this, duration: const Duration(milliseconds: 2200));

  /// Each tab's icon, 0 outlined to 1 filled (and its label, ink 2 to ink).
  late final List<AnimationController> _on = [for (var i = 0; i < kBarTabs.length; i++) AnimationController(vsync: this, duration: MmBottomBar.iconIn, reverseDuration: MmBottomBar.iconOut)];
  late final List<AnimationController> _settle = [for (var i = 0; i < kBarTabs.length; i++) AnimationController.unbounded(vsync: this, value: 1)];

  late final Listenable _edges = Listenable.merge([_left, _right]);

  final GlobalKey _startKey = GlobalKey(debugLabel: 'bar-start');

  /// The branch drawn active (it leads the shell while scrubbing).
  int _shown = 0;
  bool _placed = false;
  bool _scrubbing = false;
  bool _underStart = false;
  int? _focusedSlot;

  /// The tab under a finger: it sinks to 0.96 in 100 ms and springs back on release.
  int? _pressedTab;

  void _pressTab(int? branch) {
    if (_pressedTab != branch) setState(() => _pressedTab = branch);
  }

  // The arrival waiting for the lens's leading edge to pass 70% of its travel.
  int? _arriving;
  AnimationController? _arrivalEdge;
  double _arrivalFrom = 0;
  double _arrivalTo = 0;

  // A drag up from Start.
  bool _dragging = false;
  bool _pastOpen = false;

  bool get _reduced => Motion.reduced(context);

  @override
  void initState() {
    super.initState();
    // Create every controller now, never lazily in dispose (a deactivated element cannot look
    // up its TickerMode): the entrance ones exist only when touched otherwise.
    for (final c in [_left, _right, _collapse, _labelsOut, _dip, _press, _ripple, _enter, _pop, _overshoot, _stretch, _label, ..._settle]) {
      assert(!c.isAnimating);
    }
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

  @override
  void didUpdateWidget(MmBottomBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.compact != widget.compact) {
      oldWidget.compact?.removeListener(_compactChanged);
      widget.compact?.addListener(_compactChanged);
      _compactChanged();
    }
    if (!_scrubbing && widget.currentBranch != _shown) _select(widget.currentBranch);
    if (oldWidget.startResumeId != widget.startResumeId) {
      if (widget.startResumeId == null) {
        _label.value = 0;
      } else {
        WidgetsBinding.instance.addPostFrameCallback((_) => _maybeSlideResume());
      }
    }
  }

  /// The label's slide as 0 (Start) to 1 (Resume): in over the first 14%, held, out over the last 18%.
  double get _labelShift {
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
    for (final c in [_left, _right, _collapse, _labelsOut, _dip, _press, _ripple, _enter, _pop, _overshoot, _stretch, _label, ..._on, ..._settle]) {
      c.dispose();
    }
    super.dispose();
  }

  // Collapse.

  void _compactChanged() {
    final compact = widget.compact?.value ?? false;
    if (_reduced) {
      // The height changes at once; only the labels cross-fade (120 ms).
      _collapse.value = compact ? 1 : 0;
      _labelsOut.animateTo(compact ? 1 : 0, duration: Motion.reducedFade);
      return;
    }
    if (compact) {
      _collapse.animateTo(1, duration: const Duration(milliseconds: 240), curve: Motion.emphasized);
      _labelsOut.animateTo(1, duration: const Duration(milliseconds: 120), curve: Motion.exit);
    } else {
      _collapse.animateTo(0, duration: Motion.glideDuration, curve: Motion.glide);
      _labelsOut.animateTo(0, duration: Motion.glideDuration, curve: Motion.glide);
    }
  }

  // The lens and the icons.

  void _watchEdges() {
    final center = (_left.value + _right.value) / 2;
    final under = (center - _geo.slotCenter(kStartSlot)).abs() < _geo.startSlot / 2;
    if (under != _underStart) {
      _underStart = under;
      if (_reduced) {
        _dip.value = under ? 1 : 0;
      } else {
        under ? _dip.forward() : _dip.reverse();
      }
    }
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
  }

  void _glideTo(int slot, {double velocity = 0}) {
    final (tl, tr) = _geo.lensEdges(slot);
    final rightward = (tl + tr) / 2 > (_left.value + _right.value) / 2;
    if (_reduced) {
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
    lead.animateWith(Motion.spring(MmBottomBar.edgeLead, lead.value, leadTo, velocity: velocity != 0 ? velocity : lead.velocity));
    trail.animateWith(Motion.spring(MmBottomBar.edgeTrail, trail.value, trailTo, velocity: velocity != 0 ? velocity * 0.6 : trail.velocity));
  }

  /// Makes [branch] the active one: the old icon goes back to its outline, the lens travels, the
  /// new icon fills as the lens arrives.
  void _select(int branch, {double velocity = 0}) {
    final slot = branchToSlot(branch);
    if (branch == _shown) {
      _glideTo(slot, velocity: velocity);
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
    _glideTo(slot, velocity: velocity);
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
  /// edge has passed 70% of its travel, so no volt shows on the target before the lens is there.
  void _arrive(int branch) {
    if (branch != _shown) return;
    if (_reduced) {
      _on[branch].value = 1;
      _settle[branch].value = 1;
      return;
    }
    _on[branch].animateTo(1, curve: Motion.glide);
    _settle[branch].value = 0.9;
    _settle[branch].animateWith(Motion.spring(MmBottomBar.iconSettle, 0.9, 1));
  }

  // Taps.

  void _tabDown(int branch) {
    if (branch == _shown || _scrubbing || _reduced) return;
    // Anticipation: the near edge leans 0.18 of a slot toward the pressed tab.
    final target = _geo.slotCenter(branchToSlot(branch));
    final center = (_left.value + _right.value) / 2;
    final lean = 0.18 * _geo.tabSlot;
    if (target > center) {
      _right.animateTo(_geo.lensEdges(branchToSlot(_shown)).$2 + lean, duration: const Duration(milliseconds: 120), curve: Motion.out);
    } else {
      _left.animateTo(_geo.lensEdges(branchToSlot(_shown)).$1 - lean, duration: const Duration(milliseconds: 120), curve: Motion.out);
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
    _left.animateWith(Motion.spring(Springs.smooth, _left.value, l, velocity: _left.velocity));
    _right.animateWith(Motion.spring(Springs.smooth, _right.value, r, velocity: _right.velocity));
  }

  void _tabTap(int branch) {
    if (branch != _shown) {
      ref.read(hapticsProvider).selection();
      _select(branch);
    }
    widget.onTab(branch);
  }

  // Scrub.

  double _clampLens(double x) => x.clamp(_geo.slotCenter(0), _geo.slotCenter(kBarSlots - 1));

  void _scrubStart(DragStartDetails d) {
    final insets = MediaQuery.systemGestureInsetsOf(context);
    final screen = MediaQuery.sizeOf(context).width;
    final x = d.globalPosition.dx;
    final slot = _geo.slotAt(d.localPosition.dx);
    // Never from Start, never inside Android's back-gesture strips.
    if (slot == kStartSlot || x < insets.left || x > screen - insets.right) return;
    _scrubbing = true;
    _arriving = null;
    _arrivalEdge = null;
    _left.stop();
    _right.stop();
    _moveLens(_clampLens(d.localPosition.dx));
  }

  void _moveLens(double center) {
    final half = _geo.lensWidth / 2;
    _left.value = center - half;
    _right.value = center + half;
  }

  void _scrubUpdate(DragUpdateDetails d) {
    if (!_scrubbing) return;
    final center = _clampLens((_left.value + _right.value) / 2 + d.delta.dx);
    final before = slotToBranch(_geo.nearestTabSlot((_left.value + _right.value) / 2))!;
    _moveLens(center);
    final after = slotToBranch(_geo.nearestTabSlot(center))!;
    if (after != before) ref.read(hapticsProvider).selection();
    if (after != _shown) {
      _depart(_shown);
      _shown = after;
      _arrive(after);
    }
  }

  void _scrubEnd(DragEndDetails d) {
    if (!_scrubbing) return;
    _scrubbing = false;
    final velocity = d.velocity.pixelsPerSecond.dx;
    final center = (_left.value + _right.value) / 2;
    final slot = _reduced ? _geo.nearestTabSlot(center) : _geo.nearestTabSlot(center + velocity * 0.08);
    final branch = slotToBranch(slot)!;
    if (branch != _shown) {
      _select(branch, velocity: velocity);
    } else {
      _glideTo(slot, velocity: velocity);
    }
    if (branch != widget.currentBranch) widget.onTab(branch);
  }

  void _scrubCancel() {
    if (!_scrubbing) return;
    _scrubbing = false;
    _select(widget.currentBranch);
  }

  // Start.

  Rect _startRect() {
    final box = _startKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) {
      final size = MediaQuery.sizeOf(context);
      final pill = _geo.pillRect(kStartSlot, collapse: _collapse.value);
      return pill.shift(Offset((size.width - _geo.width) / 2, size.height - 60 - MmBar.height / 2));
    }
    final local = StartKeyFace.keyRect(box.size, _collapse.value);
    return local.shift(box.localToGlobal(Offset.zero));
  }

  void _startTap() {
    if (!_reduced) _ripple.forward(from: 0);
    widget.onStart(_startRect());
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

  double _drag = 0;

  /// The key lets go of its stretch: it springs back through a little squash.
  void _releaseStretch() {
    if (_reduced || _stretch.value == 0) {
      _stretch.value = 0;
      return;
    }
    _stretch.animateWith(Motion.spring(Springs.smooth, _stretch.value, 0));
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

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final geo = _geo;
    final badges = widget.badges;
    final iconColors = BarIconColors.of(colors);
    final lensStyle = BarLensStyle.of(colors);
    final ring = colors.isNight ? const Color(0xFF1B1A16) : const Color(0xFFFFFDF8);

    final glass = Positioned.fill(
      child: RepaintBoundary(
        child: BarGlass(
          quality: widget.quality,
          repaint: _collapse,
          shape: (size) {
            final h = MmBar.height - (MmBar.height - MmBar.compactHeight) * _collapse.value;
            return RRect.fromRectAndRadius(Rect.fromLTWH(0, size.height - h, size.width, h), Radius.circular(h / 2));
          },
        ),
      ),
    );

    final lens = Positioned.fill(
      child: IgnorePointer(
        child: RepaintBoundary(
          child: CustomPaint(
            painter: BarLensPainter(left: _left, right: _right, collapse: _collapse, restWidth: geo.lensWidth, style: lensStyle),
          ),
        ),
      ),
    );

    Widget item(int slot, Widget child) {
      if (!widget.entrance) return child;
      // Left to right, 30 ms apart; Start comes last.
      final order = const {0: 0, 1: 1, 3: 2, 4: 3, 5: 4, 2: 5}[slot]!;
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

    final slots = <Widget>[];
    for (var slot = 0; slot < kBarSlots; slot++) {
      final branch = slotToBranch(slot);
      final width = geo.slotWidth(slot);
      final Widget child;
      if (branch == null) {
        child = _startSlot(width);
      } else {
        child = _tabSlot(
          branch: branch,
          slot: slot,
          width: width,
          iconColors: iconColors,
          ring: ring,
          badgeText: branch == BarBranch.review ? badges.reviewText : null,
          dot: (branch == BarBranch.review && badges.showReviewDot) ||
              (branch == BarBranch.colleges && badges.collegesDot) ||
              (branch == BarBranch.you && badges.youDot),
          semanticsLabel: barTabSemanticsLabel(
            branch,
            reviewCount: badges.reviewCount,
            reviewDot: badges.showReviewDot,
            collegesDot: badges.collegesDot,
            youDot: badges.youDot,
          ),
        );
      }
      slots.add(Positioned(left: geo.slotLeft(slot), top: 0, bottom: 0, width: width, child: item(slot, child)));
    }

    Widget bar = SizedBox(
      width: geo.width,
      height: MmBar.height,
      child: GestureDetector(
        dragStartBehavior: DragStartBehavior.down,
        onHorizontalDragStart: _scrubStart,
        onHorizontalDragUpdate: _scrubUpdate,
        onHorizontalDragEnd: _scrubEnd,
        onHorizontalDragCancel: _scrubCancel,
        child: Stack(clipBehavior: Clip.none, children: [glass, lens, ...slots]),
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
      child: FocusTraversalGroup(child: bar),
    );
  }

  Widget _tabSlot({
    required int branch,
    required int slot,
    required double width,
    required BarIconColors iconColors,
    required Color ring,
    required String? badgeText,
    required bool dot,
    required String semanticsLabel,
  }) {
    final colors = context.mmColors;
    final type = context.mmType;
    final tab = kBarTabs[branch];
    const collapseShift = MmBar.compactShift;

    final icon = SizedBox.square(
      dimension: MmBar.icon,
      child: ScaleTransition(
        scale: _settle[branch],
        child: CustomPaint(
          painter: BarIconPainter(
            glyph: tab.icon.glyph,
            colors: iconColors,
            on: _on[branch],
          ),
        ),
      ),
    );

    final iconGroup = SizedBox(
      width: MmBar.icon,
      height: MmBar.icon,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(child: RepaintBoundary(child: icon)),
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
        style: type.navLabel.copyWith(
          fontSize: MmBar.labelSize,
          height: MmBar.labelHeight / MmBar.labelSize,
          fontWeight: FontWeight.w600,
          letterSpacing: 0,
          color: Color.lerp(colors.ink2, colors.ink, _on[branch].value),
        ),
      ),
    );

    final content = AnimatedBuilder(
      animation: _collapse,
      builder: (context, child) => Transform.translate(offset: Offset(0, collapseShift * _collapse.value), child: child),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(left: (width - MmBar.icon) / 2, top: MmBar.iconTop, child: iconGroup),
          Positioned(
            left: MmBar.pillInset,
            right: MmBar.pillInset,
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
              foregroundPainter: focused ? _FocusRing(collapse: _collapse, color: colors.ink, startKey: false, lensWidth: _geo.lensWidth) : null,
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
    );
  }

  Widget _startSlot(double width) {
    final colors = context.mmColors;
    final resume = widget.startResumeLabel;
    final onResume = widget.onStartResume;
    final face = AnimatedBuilder(
      animation: Listenable.merge([_press, _ripple, _dip, _pop, _overshoot, _stretch, _label]),
      builder: (context, _) {
        // Pressed deepens to 1; on release it overshoots a little (a negative press) and rests.
        final o = _overshoot.value;
        final bump = o >= 1 || _press.value > 0 ? 0.0 : 0.7 * math.sin(math.pi * o) * (1 - o);
        final pressed = widget.startPressed ? 1.0 : Motion.out.transform(_press.value) - bump;
        // The lens slides under Start; Start dips to 0.97 while it is there.
        final dip = 1 - 0.03 * _dip.value;
        // The first appearance's pop: 1, 1.05, 1.
        final p = _pop.value;
        final pop = p >= 1 ? 1.0 : 1 + 0.05 * (p < 0.4 ? Motion.out.transform(p / 0.4) : 1 - Motion.out.transform((p - 0.4) / 0.6));
        return Transform.scale(
          scale: dip * pop,
          child: StartKeyFace(collapse: _collapse, labelsOut: _labelsOut, pressed: pressed, ripple: _ripple.value, stretch: _stretch.value, labelShift: _labelShift),
        );
      },
    );
    final focused = _focusedSlot == kStartSlot;
    return Semantics(
      container: true,
      button: true,
      label: MmBottomBar.startSemanticsLabel,
      sortKey: OrdinalSortKey(kStartSlot.toDouble() + 1),
      onTap: _startTap,
      customSemanticsActions: resume == null || onResume == null ? null : {CustomSemanticsAction(label: resume): onResume},
      child: ExcludeSemantics(
        child: FocusableActionDetector(
          actions: {ActivateIntent: CallbackAction<ActivateIntent>(onInvoke: (_) => _startTap())},
          onShowFocusHighlight: (on) => setState(() => _focusedSlot = on ? kStartSlot : (_focusedSlot == kStartSlot ? null : _focusedSlot)),
          child: Listener(
            // The press shows the moment a finger lands, before the tap is decided.
            onPointerDown: (_) => _reduced ? _press.value = 1 : _press.forward(),
            onPointerUp: (_) {
              if (_reduced) {
                _press.value = 0;
                return;
              }
              _press.reverse();
              // The key lets go with a small overshoot (not after a drag, which springs back).
              if (!_dragging) _overshoot.forward(from: 0);
            },
            onPointerCancel: (_) => _reduced ? _press.value = 0 : _press.reverse(),
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
                foregroundPainter: focused ? _FocusRing(collapse: _collapse, color: colors.ink, startKey: true, lensWidth: 0) : null,
                child: SizedBox(width: width, height: MmBar.height, child: face),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The keyboard focus ring: 2 dp in ink, 2 dp outside the lens shape (or the Start key).
class _FocusRing extends CustomPainter {
  _FocusRing({required this.collapse, required this.color, required this.startKey, required this.lensWidth}) : super(repaint: collapse);

  final Animation<double> collapse;
  final Color color;
  final bool startKey;
  final double lensWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final Rect rect;
    if (startKey) {
      rect = StartKeyFace.keyRect(size, collapse.value);
    } else {
      final c = size.width / 2;
      rect = BarLensPainter.lensRect(left: c - lensWidth / 2, right: c + lensWidth / 2, collapse: collapse.value, restWidth: lensWidth, size: size).outerRect;
    }
    final ring = rect.inflate(3);
    canvas.drawRRect(
      RRect.fromRectAndRadius(ring, Radius.circular(ring.height / 2)),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(_FocusRing old) => old.collapse != collapse || old.color != color || old.startKey != startKey || old.lensWidth != lensWidth;
}

/// A badge (a count, "9+") or, with no [text], an 8 dp dot. It appears with a scale from 0.6
/// and a 160 ms fade; a changed count rolls over 300 ms. It never pulses or loops.
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
    final fill = colors.isNight ? colors.volt : colors.ink;
    final ink = colors.isNight ? colors.voltInk : const Color(0xFFF4F0E6);
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
