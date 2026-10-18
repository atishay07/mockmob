// "Suggested for you" (D51, TODAY-SWIPE-1018; refined by SWIPE-V2-1018 for D90): the lead card's
// other moves as a small deck on the ground under the card (never a card inside the card). One
// card on top and two behind at 0.95 and 0.90, peeking 12 and 22 dp. Every card of the pass is one
// height, the tallest card's, so nothing under the deck moves on a pass, a pick or "Go through
// them again". Cards already passed on in this pass leave the deck.
//
// Taken from Tinder, without its meaning: the controls are not on the card. One fixed row under the
// deck holds Not now, Undo and Do this next (the button names the outcome; the result is "Up next"). While a card is dragged, the button on that side grows
// with the drag and lights at the threshold, and a stamp with the same words lands on the card.
// Right is "Up next": the card flies up into the lead card, which swaps to it exactly as the old
// choices did (the old move comes down into the deck marked Suggested), and a glass bar says so
// with Undo. Left is "Not now": the card slides out and tucks in behind the deck. A tap on the card
// is Up next. Below the threshold it springs home. The threshold ticks a selection haptic both ways.
//
// The first run teaches itself ([DeckCoach]): a one-line intro says what the cards are; once the
// deck has been on screen and still, the top card performs right then left by itself (about 2.2 s,
// once in the phone's life, spent only when both halves played or a touch stopped it, never while
// Today is off screen; a touch only stops it, never also taps the card); a coach line names each
// direction as it is shown and as the student drags. The first Up next says nothing starts; the first Not now says where the
// card went and that kinds passed on often sit lower next time ([DeckMemory], which is true).
//
// Safeguards: nothing here starts a session or spends a credit. Right only makes a card the lead;
// the lead card's lime key starts it. The row's buttons are the accessible path and do exactly
// what the swipes do; the card also carries Up next and Not now as screen reader actions. A sideways
// drag locks after 12 dp and a slope of 0.5, so a vertical drag is always the page's scroll.
// Reduced motion: no demo (the coach line shows both meanings at once), the card still follows the
// finger, and commits swap at once.
import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/art.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy_glance.dart';
import '../copy_suggested.dart';
import '../logic/glance_model.dart';
import '../logic/suggested_deck.dart';
import 'glance_rows.dart' show GlanceLink;
import 'hero_stage.dart' show HeroArtView;
import 'today_type.dart';

/// A commit: past this share of the deck's width.
const double deckCommitShare = 0.30;

/// The sideways lock, in dp of finger travel.
const double deckLock = 12;

/// The steepest a drag may be and still be a swipe: dy over dx.
const double deckSlope = 0.5;

/// How much the card leans: one degree per this many dp, at most [deckLeanMax].
const double deckLeanPer = 20;
const double deckLeanMax = 12;

/// The peek of the cards behind, in dp, at depth 1 and 2.
const double deckPeek1 = 12;
const double deckPeek2 = 22;

/// How far the demo carries the card each way, and the returning visits' one nudge.
const double deckDemoTravel = 72;
const double deckNudgeTravel = 24;

/// How long the Up next bar holds (paused while touched or focused).
const Duration deckBarHold = Duration(seconds: 5);

/// The controls row's height: every button is a full 48 dp target.
const double deckRowHeight = 48;

class SuggestedStack extends StatefulWidget {
  const SuggestedStack({super.key, required this.cards, required this.onChoose, this.onUndoChoose, this.onMore, this.leadKey, this.closeBar});

  /// The deck, in order: [buildSuggestedDeck]. The stack sinks kinds passed on often ([DeckMemory]).
  final List<SuggestedCard> cards;

  /// Up next (a right swipe, a tap on the card, the button): the screen swaps the lead card to it.
  final ValueChanged<MoveChoice> onChoose;

  /// Undo of an Up next: the screen puts the lead card back as it was. Null: a pick has no undo.
  final VoidCallback? onUndoChoose;

  /// "See every way to practise": the alternatives sheet. Null hides the words.
  final VoidCallback? onMore;

  /// The lead card, which a chosen card flies into.
  final GlobalKey? leadKey;

  /// Pinged when the student acts on the lead card (its Start, the bar's capsule): the Up next bar
  /// leaves at once, so it never floats over the session that just began (round 1, item 2), and the
  /// pick's Undo goes with it: what the student started is no longer swapped away (round 2, item 5).
  final Listenable? closeBar;

  /// On the card on top of the deck.
  static const Key topKey = ValueKey('suggested-top');

  /// The row's buttons and the coach line (tests find them by these).
  static const Key notNowKey = ValueKey('suggested-not-now');
  static const Key undoKey = ValueKey('suggested-undo');
  static const Key upNextKey = ValueKey('suggested-up-next');
  static const Key againKey = ValueKey('suggested-again');
  static const Key coachKey = ValueKey('suggested-coach');
  static const Key barKey = ValueKey('suggested-bar');
  static const Key barUndoKey = ValueKey('suggested-bar-undo');

  /// Goldens: the demo held at its peak on this side (the card at 72 dp, its stamp, the button lit,
  /// the coach line naming the direction).
  static MmDragSide? debugDemoPeak;

  /// Goldens run with animations off; true draws the coach as it is with motion on (the idle line)
  /// instead of the reduced-motion form (both meanings at once).
  static bool debugCoachMotion = false;

  /// Resets the debug pins (tests).
  static void debugReset() {
    debugDemoPeak = null;
    debugCoachMotion = false;
    _SuggestedStackState._nudgedThisRun = false;
  }

  @override
  State<SuggestedStack> createState() => _SuggestedStackState();
}

/// A chosen card on its way up into the lead card.
class _Flight {
  _Flight({required this.card, required this.from, required this.lean, required this.to});

  final SuggestedCard card;
  final Offset from;
  final double lean;
  final Offset to;
}

/// A passed-on card tucking in behind the deck, from where it left the screen's edge.
class _Tuck {
  _Tuck({required this.card, required this.fromX, required this.alone});

  final SuggestedCard card;
  final double fromX;

  /// No card waits at the back slot, so the tucked card fades out as it lands.
  final bool alone;
}

/// What Undo takes back: the last commit only.
sealed class _Undo {
  _Undo(this.card, this.kind, this.memory);

  final SuggestedCard card;
  final String kind;

  /// The kind's pass days before the commit.
  final List<int> memory;
}

class _UndoNotNow extends _Undo {
  _UndoNotNow(super.card, super.kind, super.memory);
}

class _UndoUpNext extends _Undo {
  _UndoUpNext(super.card, super.kind, super.memory, {required this.pass, required this.cards, required this.rawKeys});

  /// The pass, the deck and the screen's deck as they were before the pick.
  final DeckPass pass;
  final List<SuggestedCard> cards;
  final List<String> rawKeys;
}

class _SuggestedStackState extends State<SuggestedStack> with TickerProviderStateMixin {
  /// The deck in the order it shows (kinds passed on often at the end), fixed for the deck.
  late List<SuggestedCard> _cards = _ordered(widget.cards);
  late List<String> _rawKeys = _keys(widget.cards);
  late DeckPass _pass = DeckPass(_keys(_cards));

  /// Whether the memory has ordered this deck (it may load after the first frame).
  bool _sorted = DeckMemoryStore.loaded != null;

  /// The top card's sideways offset in dp (the finger, the demo and the commits drive it).
  late final AnimationController _x;

  /// A chosen card flying into the lead card (0 to 1).
  late final AnimationController _fly;

  /// The new top card arriving after a pick: the old lead coming down into the deck.
  late final AnimationController _arrive;

  /// A passed-on card tucking in behind (0 to 1).
  late final AnimationController _tuck;

  /// The undo of a pick: the card flying back down from the lead card (1 at rest).
  late final AnimationController _back;

  /// Reduced motion's short fade on a commit (1 at rest).
  late final AnimationController _fade;

  final GlobalKey _deckKey = GlobalKey(debugLabel: 'suggested-deck');
  final GlobalKey _areaKey = GlobalKey(debugLabel: 'suggested-area');
  _Flight? _flight;
  _Tuck? _tucking;
  bool _tuckBehind = false;
  Offset _backFrom = Offset.zero;
  double _width = 360;
  double _raw = 0;
  bool _past = false;
  bool _dragging = false;
  bool _leaving = false;

  /// The cards' one height as the pass ended, which the end card takes, so the page does not jump.
  double? _endHeight;

  // The first run.
  DeckCoachRun? _coach = DeckCoach.loaded;

  /// The side the demo is showing (the button lit, the coach line naming it), or null.
  MmDragSide? _demoSide;
  bool _demoRunning = false;
  bool _nudging = false;
  static bool _nudgedThisRun = false;

  /// A touch that stopped the demo (or the nudge): its lift is not a tap on the card, so the stop
  /// never commits Up next (round 1, item 1). Cleared by the card's next tap or the next touch.
  bool _swallowTap = false;

  /// Today is the surface on screen: its branch is the shown tab (TickerMode) and no route sits
  /// over it. Off screen the bar leaves and the demo neither runs nor counts.
  bool _onScreen = true;
  Timer? _stillTimer;
  Timer? _waitTimer;
  Completer<void>? _waiting;

  /// A line the coach keeps until the next drag: the first Not now's "At the back now".
  String? _said;

  /// What Undo takes back, or null.
  _Undo? _undo;

  /// An Up next being undone: the deck it returns to restores the pass as it was.
  _UndoUpNext? _restoring;

  // The confirmation bar.
  ScaffoldFeatureController<SnackBar, SnackBarClosedReason>? _bar;
  ScaffoldMessengerState? _messenger;
  ScrollPosition? _position;

  static List<String> _keys(List<SuggestedCard> cards) => [for (final c in cards) c.key];

  static List<SuggestedCard> _ordered(List<SuggestedCard> cards) {
    final memory = DeckMemoryStore.loaded;
    return memory == null ? List.of(cards) : memory.order(cards, DeckMemoryStore.today);
  }

  double get _threshold => _width * deckCommitShare;

  bool get _coaching => _coach?.coaching ?? false;

  SuggestedCard? _card(String? key) => key == null ? null : _cards.where((c) => c.key == key).firstOrNull;

  bool get _reduced => Motion.reduced(context);

  @override
  void initState() {
    super.initState();
    _x = AnimationController.unbounded(vsync: this)..addListener(_moved);
    _fly = AnimationController(vsync: this, duration: const Duration(milliseconds: 340));
    _arrive = AnimationController(vsync: this, duration: const Duration(milliseconds: 360), value: 1);
    _tuck = AnimationController(vsync: this, duration: const Duration(milliseconds: 200))..addListener(_tucked);
    _back = AnimationController(vsync: this, duration: const Duration(milliseconds: 300), value: 1);
    _fade = AnimationController(vsync: this, duration: Motion.reducedFade, value: 1);
    widget.closeBar?.addListener(_leadUsed);
    final pin = SuggestedStack.debugDemoPeak;
    if (pin != null) {
      _demoSide = pin;
      _x.value = pin == MmDragSide.right ? deckDemoTravel : -deckDemoTravel;
    }
    if (_coach == null) {
      DeckCoach.load().then((run) {
        if (mounted) setState(() => _coach = run);
        _armDemo();
      });
    }
    if (!_sorted) {
      DeckMemoryStore.load().then((_) {
        if (!mounted) return;
        // Only a deck nobody has touched yet takes the order late, so nothing moves under a finger.
        if (_pass.skips == 0 && _undo == null && !_dragging && _x.value == 0) {
          setState(() {
            _cards = _ordered(widget.cards);
            _pass = DeckPass(_keys(_cards));
          });
        }
        _sorted = true;
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final position = Scrollable.maybeOf(context)?.position;
    if (position != _position) {
      _position?.removeListener(_scrolled);
      _position = position?..addListener(_scrolled);
    }
    final onScreen = TickerMode.valuesOf(context).enabled && (ModalRoute.of(context)?.isCurrent ?? true);
    if (onScreen != _onScreen) {
      _onScreen = onScreen;
      if (!onScreen) {
        // Another tab, or a route over Today (the session the student just started): the bar's
        // words are no longer true there, and its Undo would change a lead nobody can see. The
        // messenger is an ancestor, so it is told after this build.
        final bar = _bar;
        _bar = null;
        if (bar != null) scheduleMicrotask(bar.close);
        _stopDemo(jump: true);
      }
    }
    _armDemo();
  }

  @override
  void didUpdateWidget(SuggestedStack old) {
    super.didUpdateWidget(old);
    if (old.closeBar != widget.closeBar) {
      old.closeBar?.removeListener(_leadUsed);
      widget.closeBar?.addListener(_leadUsed);
    }
    final raw = _keys(widget.cards);
    if (_sameKeys(raw, _rawKeys)) return;
    final restoring = _restoring;
    _restoring = null;
    _x.value = 0;
    _leaving = false;
    _endHeight = null;
    if (restoring != null && _sameKeys(raw, restoring.rawKeys)) {
      // The undo of a pick: the deck and the pass as they were, the card back on top.
      _rawKeys = raw;
      _cards = restoring.cards;
      _pass = restoring.pass.copy();
      if (!_reduced) {
        _backFrom = _leadOffset();
        _back.forward(from: 0);
      }
      return;
    }
    // A pick (or new data) changed the deck: a fresh pass, the old lead arriving on top. The undo of
    // the pick that did it survives; an undo of a pass on the old deck does not.
    _rawKeys = raw;
    _cards = _ordered(widget.cards);
    _pass = DeckPass(_keys(_cards));
    if (_undo is! _UndoUpNext) _undo = null;
    if (_flight != null && !_reduced) _arrive.forward(from: 0);
  }

  static bool _sameKeys(List<String> a, List<String> b) => a.length == b.length && Iterable<int>.generate(a.length).every((k) => a[k] == b[k]);

  @override
  void dispose() {
    _stillTimer?.cancel();
    _waitTimer?.cancel();
    _position?.removeListener(_scrolled);
    widget.closeBar?.removeListener(_leadUsed);
    // The bar leaves with the deck, after this frame (the messenger cannot rebuild mid-teardown).
    final bar = _bar;
    final messenger = _messenger;
    if (bar != null && messenger != null) {
      scheduleMicrotask(() {
        if (messenger.mounted) bar.close();
      });
    }
    _x.dispose();
    _fly.dispose();
    _arrive.dispose();
    _tuck.dispose();
    _back.dispose();
    _fade.dispose();
    super.dispose();
  }

  void _moved() {
    final x = _x.value;
    final top = _card(_pass.top);
    final past = _dragging && x.abs() >= _threshold && (x < 0 || (top?.swipeable ?? false));
    if (past != _past) {
      setState(() => _past = past);
      if (_dragging) hapticsOf(context)?.selection();
    }
  }

  void _tucked() {
    final behind = _tuck.value >= 0.5;
    if (behind != _tuckBehind) setState(() => _tuckBehind = behind);
  }

  // The first run: the demo, and the returning visits' nudge.

  /// The page moved: the bar leaves on the student's scroll, and the demo waits for stillness.
  void _scrolled() {
    final position = _position;
    if (position != null && position.userScrollDirection != ScrollDirection.idle) {
      _hideBar();
      _stopDemo();
    }
    _armDemo();
  }

  /// Once the deck is at least 60% on screen and the page has been still for 300 ms, the visit
  /// counts; 600 ms later the demo (or the nudge) runs. Only while Today is the surface on screen:
  /// an offstage tab is still laid out, so the deck's geometry alone would count it as seen.
  void _armDemo() {
    _stillTimer?.cancel();
    final coach = _coach;
    if (coach == null || !coach.coaching || !mounted || !_onScreen || SuggestedStack.debugDemoPeak != null) return;
    _stillTimer = Timer(const Duration(milliseconds: 300), () {
      if (!mounted || !_onScreen || _visibleShare() < 0.6) return;
      unawaited(DeckCoach.countVisit(coach));
      if (_reduced || _demoRunning || _dragging || _leaving || _pass.top == null) return;
      // Any use of the deck taught the gesture: a commit made before the demo began (the page then
      // scrolls the lead into view, which re-arms this) never brings the demo on after it (round 2).
      final demo = !coach.demoShown && coach.neverSwiped && _undo == null && _flight == null;
      final nudge = !demo && coach.neverSwiped && !_nudgedThisRun;
      if (!demo && !nudge) return;
      _stillTimer = Timer(const Duration(milliseconds: 600), () {
        if (!mounted || !_onScreen || _visibleShare() < 0.6 || _demoRunning || _dragging || _leaving || _x.value != 0) return;
        if (demo) {
          unawaited(_runDemo(coach));
        } else {
          unawaited(_runNudge());
        }
      });
    });
  }

  /// How much of the deck is on screen, 0 to 1.
  double _visibleShare() {
    final box = _areaKey.currentContext?.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize || box.size.height <= 0) return 0;
    final top = box.localToGlobal(Offset.zero).dy;
    final screen = MediaQuery.sizeOf(context).height;
    final shown = math.min(top + box.size.height, screen) - math.max(top, 0);
    return (shown / box.size.height).clamp(0.0, 1.0);
  }

  /// Waits [d] unless the demo is stopped first.
  Future<void> _wait(Duration d) {
    final done = Completer<void>();
    _waiting = done;
    _waitTimer = Timer(d, () {
      if (!done.isCompleted) done.complete();
    });
    return done.future;
  }

  /// The card performs each direction by itself: out 72 dp, a hold with its stamp, the button lit
  /// and the coach line naming it, then home; right first, then left. No haptics: the student did
  /// not act. It counts as shown (never again on this phone) only once both halves played, or
  /// when the student's own touch stopped it ([_stopDemo]); a scroll or leaving Today mid-way
  /// leaves it to replay at the next still moment.
  Future<void> _runDemo(DeckCoachRun coach) async {
    _demoRunning = true;
    for (final side in MmDragSide.values.reversed) {
      if (!_demoRunning || !mounted) return;
      setState(() => _demoSide = side);
      try {
        await _x.animateTo(side == MmDragSide.right ? deckDemoTravel : -deckDemoTravel, duration: const Duration(milliseconds: 380), curve: Motion.out).orCancel;
      } on TickerCanceled {
        return;
      }
      await _wait(const Duration(milliseconds: 360));
      if (!_demoRunning || !mounted) return;
      setState(() => _demoSide = null);
      try {
        await _x.animateWith(Motion.spring(Springs.smooth, _x.value, 0)).orCancel;
      } on TickerCanceled {
        return;
      }
      if (side == MmDragSide.right) await _wait(const Duration(milliseconds: 160));
    }
    if (!_demoRunning) return;
    unawaited(DeckCoach.demoDone(coach));
    if (mounted) setState(() => _demoRunning = false);
  }

  /// Visits 2 and 3, while the student has never moved a card: one 24 dp nudge right, no words.
  Future<void> _runNudge() async {
    _nudgedThisRun = true;
    _demoRunning = true;
    setState(() => _nudging = true);
    try {
      await _x.animateTo(deckNudgeTravel, duration: const Duration(milliseconds: 240), curve: Motion.out).orCancel;
      if (_demoRunning) await _x.animateWith(Motion.spring(Springs.smooth, _x.value, 0)).orCancel;
    } on TickerCanceled {
      return;
    }
    if (mounted) {
      setState(() {
        _nudging = false;
        _demoRunning = false;
      });
    }
  }

  /// Any touch stops the demo at once; the card springs home. A [touch] (the student's own) spends
  /// the demo for good; a scroll or Today leaving the screen does not. [jump] puts the card home
  /// without motion (offstage, where its ticker is muted).
  void _stopDemo({bool touch = false, bool jump = false}) {
    _stillTimer?.cancel();
    if (!_demoRunning) return;
    final coach = _coach;
    if (touch && !_nudging && coach != null && !coach.demoShown) unawaited(DeckCoach.demoDone(coach));
    _demoRunning = false;
    _waitTimer?.cancel();
    final waiting = _waiting;
    if (waiting != null && !waiting.isCompleted) waiting.complete();
    setState(() {
      _demoSide = null;
      _nudging = false;
    });
    if (_dragging) return;
    if (jump) {
      _x.value = 0;
    } else {
      _home(0);
    }
  }

  /// The student used the deck (a drag, a button, a commit): they know the gesture, so the demo
  /// is spent for good, even when it never began (round 2, item 1).
  void _taught() {
    final coach = _coach;
    if (coach != null && !coach.demoShown) unawaited(DeckCoach.demoDone(coach));
  }

  // The finger.

  void _start() {
    if (_leaving || _flight != null && _fly.isAnimating && _fly.value < 0.2) return;
    _stopDemo(touch: true);
    _taught();
    _x.stop();
    _raw = _x.value;
    _dragging = true;
    hapticsOf(context)?.gestureStart();
    if (_said != null) setState(() => _said = null);
  }

  void _update(double dx) {
    if (!_dragging) return;
    _raw += dx;
    final right = _card(_pass.top)?.swipeable ?? false;
    // A side that cannot commit gives only a little (the card is held, not thrown).
    _x.value = _raw > 0 && !right ? _raw * MmDragPolicy.resist : _raw;
  }

  void _cancel() {
    if (!_dragging) return;
    _dragging = false;
    if (_past) setState(() => _past = false);
    _home(0);
  }

  void _end(double velocity) {
    if (!_dragging) return;
    _dragging = false;
    final top = _card(_pass.top);
    final side = top == null ? null : MmDragPolicy.commits(_x.value, velocity, distance: _threshold, left: true, right: top.swipeable);
    if (_past) setState(() => _past = false);
    switch (side) {
      case MmDragSide.right:
        _upNext(top!, swipe: true);
      case MmDragSide.left:
        unawaited(_notNow(swipe: true, velocity: velocity));
      case null:
        _home(velocity);
    }
  }

  void _home(double velocity) {
    if (_reduced) {
      _x.value = 0;
    } else {
      _x.animateWith(Motion.spring(Springs.smooth, _x.value, 0, velocity: velocity));
    }
  }

  void _announce(String message) {
    final view = View.maybeOf(context);
    if (view != null) unawaited(SemanticsService.sendAnnouncement(view, message, Directionality.of(context)));
  }

  // The two outcomes and the way back.

  /// Not now: the top card slides out to the left and tucks in behind the deck. Nothing is
  /// removed; "Go through them again" brings every card back.
  Future<void> _notNow({bool swipe = false, double velocity = 0}) async {
    final top = _card(_pass.top);
    if (_leaving || top == null) return;
    _stopDemo();
    _taught();
    _hideBar();
    if (swipe) hapticsOf(context)?.gestureEnd();
    final coach = _coach;
    final firstLeft = _coaching && coach != null && !coach.leftDone;
    if (coach != null) unawaited(DeckCoach.used(coach, right: false));
    final kind = DeckMemory.kindOf(top);
    final memory = DeckMemoryStore.loaded;
    final before = memory?.passesOf(kind) ?? const <int>[];
    if (memory != null && !top.suggested) {
      memory.passed(kind, DeckMemoryStore.today);
      unawaited(DeckMemoryStore.save());
    }
    _undo = _UndoNotNow(top, kind, before);
    final said = firstLeft ? SuggestedCopy.learnedLeft : null;
    if (_reduced) {
      _noteEnd();
      setState(() {
        _pass.skip();
        _said = said;
      });
      _x.value = 0;
      _fade.forward(from: 0);
      _announce(SuggestedCopy.saidNotNow(_pass.countLine));
      return;
    }
    _leaving = true;
    final out = -_width * 0.62;
    try {
      if (_x.value > out) await _x.animateTo(out, duration: const Duration(milliseconds: 240), curve: Motion.out).orCancel;
    } on TickerCanceled {
      return;
    }
    if (!mounted) return;
    _noteEnd();
    final fromX = _x.value;
    setState(() {
      // Cards still to come once this one leaves: when fewer than two remain, nothing waits at the
      // back slot it tucks into.
      final alone = _pass.length - _pass.skips - 1 < 3;
      _pass.skip();
      _leaving = false;
      _said = said;
      _tucking = _Tuck(card: top, fromX: fromX, alone: alone);
      _tuckBehind = false;
    });
    _x.value = 0;
    _announce(SuggestedCopy.saidNotNow(_pass.countLine));
    _tuck.forward(from: 0).whenCompleteOrCancel(() {
      if (mounted) setState(() => _tucking = null);
    });
  }

  /// Before the last pass: the cards' height, for the end card that takes their place.
  void _noteEnd() {
    if (_pass.moreAfter > 0) return;
    final deck = _deckKey.currentContext?.findRenderObject();
    if (deck is RenderBox && deck.hasSize) _endHeight = deck.size.height;
  }

  /// Up next: the card flies up into the lead card and the lead swaps to it. It never starts
  /// anything; the lead card's key does. A card whose choice opens something runs it.
  void _upNext(SuggestedCard card, {bool swipe = false}) {
    if (_leaving) return;
    _stopDemo();
    _taught();
    _hideBar();
    final hero = card.choice.hero;
    if (hero == null) {
      _x.value = 0;
      widget.onChoose(card.choice);
      return;
    }
    if (swipe) hapticsOf(context)?.light();
    final coach = _coach;
    final first = coach == null || !coach.rightDone;
    if (coach != null) unawaited(DeckCoach.used(coach, right: true));
    final kind = DeckMemory.kindOf(card);
    final memory = DeckMemoryStore.loaded;
    final before = memory?.passesOf(kind) ?? const <int>[];
    if (memory != null && !card.suggested) {
      memory.picked(kind);
      unawaited(DeckMemoryStore.save());
    }
    _undo = widget.onUndoChoose == null ? null : _UndoUpNext(card, kind, before, pass: _pass.copy(), cards: List.of(_cards), rawKeys: List.of(_rawKeys));
    if (_said != null) setState(() => _said = null);
    if (_reduced) {
      _x.value = 0;
      widget.onChoose(card.choice);
      _revealLead();
    } else {
      final x = _x.value;
      _flight = _Flight(card: card, from: Offset(x, _liftY(x)), lean: _lean(x), to: _leadOffset());
      _fly.forward(from: 0).whenCompleteOrCancel(() {
        if (mounted) setState(() => _flight = null);
      });
      _x.value = 0;
      widget.onChoose(card.choice);
      _revealLead();
    }
    // The bar is a snack bar, a live region of its own: it speaks the result once. Only without a
    // bar is it announced here (round 2, item 4).
    if (!_showBar(card, first: first)) _announce(SuggestedCopy.saidUpNext(card.title));
  }

  /// A tap on the card is Up next, unless the touch it lifts from stopped the demo.
  void _tapCard(SuggestedCard card) {
    if (_swallowTap) {
      _swallowTap = false;
      return;
    }
    _upNext(card);
  }

  /// Undo: the last commit, reversed. A Not now brings the card back on top; an Up next puts the
  /// old lead back and returns the card to the top of the deck.
  void _undoLast() {
    final undo = _undo;
    if (!mounted || undo == null || _leaving) return;
    _stopDemo();
    _taught();
    _hideBar();
    _undo = null;
    DeckMemoryStore.loaded?.restore(undo.kind, undo.memory);
    unawaited(DeckMemoryStore.save());
    switch (undo) {
      case _UndoNotNow():
        _tuck.stop();
        setState(() {
          _tucking = null;
          _endHeight = null;
          _said = null;
          _pass.unskip();
        });
        if (_reduced) {
          _x.value = 0;
          _fade.forward(from: 0);
        } else {
          _x.value = -_width * 0.62;
          _x.animateTo(0, duration: const Duration(milliseconds: 300), curve: Motion.out);
        }
      case _UndoUpNext():
        _restoring = undo;
        widget.onUndoChoose?.call();
    }
  }

  /// A card chosen while the lead card's top is scrolled away: the page brings the lead card back
  /// into view, so the swap is never made out of sight. The deck scrolls with it, so a flight
  /// still lands on it.
  void _revealLead({bool again = true}) {
    final scrollable = Scrollable.maybeOf(context);
    if (widget.leadKey == null || scrollable == null || scrollable.position.axis != Axis.vertical) return;
    final viewport = scrollable.context.findRenderObject();
    if (viewport is! RenderBox || !viewport.attached) return;
    final position = scrollable.position;
    final lead = widget.leadKey?.currentContext?.findRenderObject();
    final double target;
    if (lead is RenderBox && lead.attached) {
      final inset = MediaQuery.paddingOf(context).top + MmSpace.s16;
      final top = lead.localToGlobal(Offset.zero, ancestor: viewport).dy;
      if (top >= inset) return;
      target = (position.pixels + top - inset).clamp(position.minScrollExtent, position.maxScrollExtent);
    } else {
      // Scrolled so far that a lazy list let the lead card go: it sits near the top of the page.
      // Once there and built, a second look settles it exactly.
      if (!again) return;
      target = position.minScrollExtent;
      if (_reduced) {
        position.jumpTo(target);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _revealLead(again: false);
        });
      } else {
        unawaited(position.animateTo(target, duration: const Duration(milliseconds: 420), curve: Motion.inOut).then((_) {
          if (mounted) _revealLead(again: false);
        }));
      }
      return;
    }
    if (_reduced) {
      position.jumpTo(target);
    } else {
      unawaited(position.animateTo(target, duration: const Duration(milliseconds: 420), curve: Motion.inOut));
    }
  }

  /// Where the lead card's middle is, from the top card's middle; straight up when it cannot be
  /// measured.
  Offset _leadOffset() {
    final lead = widget.leadKey?.currentContext?.findRenderObject();
    final deck = _deckKey.currentContext?.findRenderObject();
    if (lead is RenderBox && deck is RenderBox && lead.attached && deck.attached && lead.hasSize && deck.hasSize) {
      final a = lead.localToGlobal(lead.size.center(Offset.zero));
      final b = deck.localToGlobal(deck.size.center(Offset.zero));
      return a - b;
    }
    return const Offset(0, -260);
  }

  void _again() => setState(() {
    _pass.again();
    _endHeight = null;
    _undo = null;
    _said = null;
  });

  // The bar after Up next: glass chrome above the dock, the moved card's object and title, what
  // happened, and Undo. It holds 5 s (paused while touched) and leaves on the next action or scroll.

  /// Whether a bar was shown (false: no messenger above Today).
  bool _showBar(SuggestedCard card, {required bool first}) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return false;
    _messenger = messenger;
    final media = MediaQuery.of(context);
    final dock = MmBarInsets.maybeOf(context)?.showing ?? false;
    final bottom = media.viewPadding.bottom + (dock ? MmBarInsets.barTop : 0) + MmSpace.s12;
    messenger.hideCurrentSnackBar();
    final bar = messenger.showSnackBar(
      SnackBar(
        key: SuggestedStack.barKey,
        content: _UpNextBar(
          card: card,
          line: first ? SuggestedCopy.barLineFirst : SuggestedCopy.barLine,
          onUndo: _undo is _UndoUpNext ? _undoLast : null,
          onTimeout: _hideBar,
        ),
        behavior: SnackBarBehavior.floating,
        backgroundColor: Colors.transparent,
        elevation: 0,
        padding: EdgeInsets.zero,
        margin: EdgeInsets.fromLTRB(MmSpace.s12, 0, MmSpace.s12, bottom),
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(20))),
        clipBehavior: Clip.none,
        // The bar keeps its own clock (5 s, paused while touched).
        duration: const Duration(days: 1),
        dismissDirection: DismissDirection.down,
      ),
      snackBarAnimationStyle: AnimationStyle(duration: Motion.card, reverseDuration: Motion.leaveDuration),
    );
    _bar = bar;
    bar.closed.then((_) {
      if (identical(_bar, bar)) _bar = null;
    });
    return true;
  }

  /// The student acted on the lead card (its Start): the bar leaves, and the pick it began can no
  /// longer be undone from the deck. The row's Undo would otherwise swap away a lead the student
  /// already started, long after (round 2, item 5).
  void _leadUsed() {
    _hideBar();
    if (_undo is _UndoUpNext && mounted) setState(() => _undo = null);
  }

  void _hideBar() {
    final bar = _bar;
    _bar = null;
    bar?.close();
  }

  // Drawing.

  /// The top card rises a little as it leaves, so it reads as lifted off the deck.
  static double _liftY(double x) => -x.abs() * 0.04;

  /// The lean in degrees: x/20, at most 12.
  static double _lean(double x) => (x / deckLeanPer).clamp(-deckLeanMax, deckLeanMax);

  /// A card at [depth] (0 on top, fractional while the top one moves).
  static double _peek(double depth) => depth <= 0
      ? 0
      : depth <= 1
      ? deckPeek1 * depth
      : depth <= 2
      ? deckPeek1 + (deckPeek2 - deckPeek1) * (depth - 1)
      : deckPeek2;
  static double _scale(double depth) => 1 - 0.05 * depth.clamp(0.0, 2.0);
  static double _opacity(double depth) => depth <= 1
      ? 1 - 0.25 * depth
      : depth <= 2
      ? 0.75 - 0.30 * (depth - 1)
      : math.max(0, 0.45 * (3 - depth));

  /// How far along a drag (or the demo) is: 0 at rest, 1 at the threshold (or the demo's peak).
  double _progress(double x) {
    if (_nudging) return 0;
    final reach = _demoSide != null || _demoRunning ? deckDemoTravel : _threshold;
    return (x.abs() / reach).clamp(0.0, 1.0);
  }

  /// The count over the deck: "4 cards" on a first-run visit before anything moved.
  String get _countLine {
    if (_coaching && _pass.skips == 0 && !_pass.ended && _pass.length > 1 && _undo == null) return SuggestedCopy.countFirst(_pass.length);
    return _pass.countLine;
  }

  /// Whether the lead card is the student's own pick (the recommended move is back in the deck).
  bool get _leadIsPick => _cards.any((c) => c.suggested);

  /// What the coach line says now.
  _CoachSay _coachSay() {
    if (_past && _dragging) {
      if (_x.value > 0) return const _CoachSay(SuggestedCopy.letGoRight);
      return _pass.next == null ? const _CoachSay(SuggestedCopy.letGoLast) : const _CoachSay(SuggestedCopy.letGoLeft);
    }
    switch (_demoSide) {
      case MmDragSide.right:
        return const _CoachSay(SuggestedCopy.coachRight, chip: MmDragSide.right);
      case MmDragSide.left:
        return const _CoachSay(SuggestedCopy.coachLeft, chip: MmDragSide.left);
      case null:
        break;
    }
    final said = _said;
    if (said != null) return _CoachSay(said);
    if (_reduced && !SuggestedStack.debugCoachMotion) return const _CoachSay.both();
    return const _CoachSay(SuggestedCopy.coachIdle);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (widget.cards.isEmpty) {
      final more = widget.onMore;
      return more == null
          ? const SizedBox.shrink()
          : Center(
              child: GlanceLink(label: GlanceCopy.moreWays, onTap: more),
            );
    }
    final ended = _pass.ended;
    final top = _card(_pass.top);
    final countLine = _countLine;
    // The heading keeps one line: when the count cannot sit beside it (large text on a small
    // phone), the count drops under it.
    final head = Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.end,
      spacing: MmSpace.s12,
      runSpacing: MmSpace.s2,
      children: [
        Semantics(header: true, child: Text(SuggestedCopy.title, style: type.title.copyWith(fontSize: 19))),
        Padding(
          padding: const EdgeInsets.only(bottom: 2),
          child: MmOverlapSwitcher.fade(
            alignment: Alignment.centerRight,
            child: Text(
              countLine,
              key: ValueKey(countLine),
              textAlign: TextAlign.right,
              style: type.caption.copyWith(fontSize: 14, color: colors.ink3),
            ),
          ),
        ),
      ],
    );
    final coachStyle = SuggestedStackSkeleton.coachStyle(context);
    return Listener(
      // Any touch on the deck, its row or its words stops the demo at once. A touch that stops it
      // is only that: its lift is not also a tap on the card (Tinder's coach: the first touch only
      // dismisses).
      onPointerDown: (_) {
        _swallowTap = _demoRunning;
        _stopDemo(touch: true);
      },
      behavior: HitTestBehavior.translucent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          head,
          if (_coaching) ...[
            const SizedBox(height: MmSpace.s4),
            Text(SuggestedCopy.intro, style: SuggestedStackSkeleton.introStyle(context)),
          ],
          const SizedBox(height: MmSpace.s12),
          KeyedSubtree(
            key: _areaKey,
            child: MmSizeEase(
              duration: Motion.ui,
              curve: Motion.out,
              alignment: Alignment.topCenter,
              clipBehavior: Clip.none,
              child: Padding(
                padding: EdgeInsets.only(bottom: _peekRoom),
                child: ended
                    ? _EndCard(count: _pass.length, yourPick: _leadIsPick, height: _endHeight, onMore: widget.onMore)
                    : LayoutBuilder(
                        builder: (context, box) {
                          _width = box.maxWidth;
                          return _deck(context);
                        },
                      ),
              ),
            ),
          ),
          MmSizeEase(
            duration: Motion.ui,
            curve: Motion.out,
            alignment: Alignment.topCenter,
            clipBehavior: Clip.none,
            child: _coaching && !ended
                ? Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: AnimatedBuilder(
                      animation: _x,
                      builder: (context, _) {
                        final say = _coachSay();
                        return MmOverlapSwitcher.fade(
                          child: _CoachLine(key: ValueKey(say), say: say, style: coachStyle),
                        );
                      },
                    ),
                  )
                : const SizedBox(width: double.infinity),
          ),
          const SizedBox(height: MmSpace.s12),
          AnimatedBuilder(
            animation: _x,
            builder: (context, _) {
              final x = _x.value;
              final p = _progress(x);
              final right = top != null && top.swipeable;
              final undo = _undo;
              return _DeckControls(
                ended: ended,
                notNow: p > 0 && x < 0 ? p : 0,
                upNext: p > 0 && x > 0 && right ? p : 0,
                notNowLit: _demoSide == MmDragSide.left || (_past && x < 0),
                upNextLit: _demoSide == MmDragSide.right || (_past && x > 0),
                title: top?.title,
                undoTitle: undo?.card.title,
                onNotNow: top == null || _leaving ? null : () => unawaited(_notNow()),
                onUpNext: top == null || _leaving ? null : () => _upNext(top),
                onUndo: undo == null || _leaving ? null : _undoLast,
                onAgain: _again,
              );
            },
          ),
        ],
      ),
    );
  }

  /// The room under the cards for the peeks, held for the whole pass (the deck's size, not the
  /// cards still to come), so a pass never moves what is under the deck.
  double get _peekRoom => switch (widget.cards.length) {
    <= 1 => 0,
    2 => deckPeek1,
    _ => deckPeek2,
  };

  Widget _deck(BuildContext context) {
    final colors = context.mmColors;
    final accent = colors.isNight ? colors.volt : colors.accentText;
    final order = _pass.order;
    final n = order.length;
    // The cards still to come in this pass: those passed on have left the deck.
    final left = math.max(1, n - _pass.skips);
    // Every card of the pass, unseen and without its art, for the one height they all take: the
    // tallest card's.
    final children = <Widget>[
      for (final c in _cards)
        _DeckSlot(
          depth: _measureDepth,
          child: _DeckCard(card: c, at: 0, of: n, measure: true),
        ),
    ];
    final tucking = _tucking;
    Widget? tuckCard;
    if (tucking != null) {
      tuckCard = _DeckSlot(
        depth: -2,
        child: IgnorePointer(
          child: AnimatedBuilder(
            animation: _tuck,
            builder: (context, child) {
              final t = Motion.out.transform(_tuck.value);
              final x = ui.lerpDouble(tucking.fromX, 0, t)!;
              final y = ui.lerpDouble(_liftY(tucking.fromX), deckPeek2, t)!;
              final s = ui.lerpDouble(1, _scale(2), t)!;
              final fade = ui.lerpDouble(1, 0.45, t)! * (tucking.alone ? 1 - const Interval(0.5, 1).transform(_tuck.value) : 1);
              return Opacity(
                opacity: fade.clamp(0.0, 1.0),
                child: Transform(
                  alignment: Alignment.bottomCenter,
                  transform: Matrix4.translationValues(x, y, 0)
                    ..rotateZ(_lean(tucking.fromX) * (1 - t) * math.pi / 180)
                    ..scaleByDouble(s, s, 1, 1),
                  child: child,
                ),
              );
            },
            child: _DeckCard(card: tucking.card, at: 0, of: n, contentOpacity: 0.4),
          ),
        ),
      );
    }
    // Past its midpoint the tucked card is behind the deck.
    if (tuckCard != null && _tuckBehind) children.add(tuckCard);
    // Back to front: the two behind show, and a third waits unseen to rise into the gap while the
    // top card leaves.
    for (var d = math.min(left - 1, 3); d >= 1; d--) {
      final card = _card(order[d])!;
      children.add(
        _DeckSlot(
          depth: d,
          child: AnimatedBuilder(
            animation: _x,
            builder: (context, child) {
              final lift = _nudging ? 0.0 : (_x.value.abs() / _threshold).clamp(0.0, 1.0);
              final depth = d - lift;
              return Opacity(
                opacity: _opacity(depth).clamp(0.0, 1.0),
                child: Transform(
                  alignment: Alignment.bottomCenter,
                  transform: Matrix4.translationValues(0, _peek(depth), 0)..scaleByDouble(_scale(depth), _scale(depth), 1, 1),
                  // A card behind shows its words only once it is nearly on top.
                  child: _DeckCard(card: card, at: _pass.skips + d + 1, of: n, contentOpacity: depth < 0.6 ? (1 - depth / 0.6).clamp(0.0, 1.0) : 0),
                ),
              );
            },
          ),
        ),
      );
    }
    final top = _card(order.first)!;
    children.add(
      _DeckSlot(
        depth: 0,
        child: AnimatedBuilder(
          animation: Listenable.merge([_x, _arrive, _back, _fade]),
          builder: (context, child) {
            final x = _x.value;
            final a = const Cubic(0.23, 1, 0.32, 1).transform(const Interval(0.25, 1).transform(_arrive.value));
            final b = Motion.inOut.transform(_back.value);
            final back = Offset.lerp(_backFrom, Offset.zero, b)!;
            final backScale = ui.lerpDouble(0.62, 1, b)!;
            final stamp = _nudging ? 0.0 : (x.abs() / _threshold).clamp(0.0, 1.0);
            final yes = x > 0 && top.swipeable ? stamp : 0.0;
            final no = x < 0 ? stamp : 0.0;
            final past = _past || (_demoSide == null && !_nudging && x.abs() >= _threshold && (x < 0 || top.swipeable));
            final opacity = a * const Interval(0, 0.4).transform(_back.value) * Motion.out.transform(_fade.value);
            final scale = (0.97 + 0.03 * a) * backScale;
            return Opacity(
              opacity: opacity.clamp(0.0, 1.0),
              child: Transform(
                alignment: Alignment.bottomCenter,
                transform: Matrix4.translationValues(x + back.dx, _liftY(x) - 18 * (1 - a) + back.dy, 0)
                  ..rotateZ(_lean(x) * math.pi / 180)
                  ..scaleByDouble(scale, scale, 1, 1),
                child: _Stamped(
                  key: SuggestedStack.topKey,
                  yes: yes,
                  no: no,
                  child: _DeckCard(
                    card: top,
                    at: _pass.skips + 1,
                    of: n,
                    interactive: true,
                    // The words dim as the stamp lands (1 to 0.4 at the threshold), so the decision reads first.
                    wordsOpacity: 1 - 0.6 * math.max(yes, no),
                    edge: past ? (x > 0 ? accent : colors.ink3) : null,
                    onUpNext: _leaving || !top.swipeable ? null : () => _upNext(top),
                    onNotNow: _leaving ? null : () => unawaited(_notNow()),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
    if (tuckCard != null && !_tuckBehind) children.add(tuckCard);
    final flight = _flight;
    if (flight != null) {
      children.add(
        _DeckSlot(
          depth: -1,
          child: IgnorePointer(
            child: AnimatedBuilder(
              animation: _fly,
              builder: (context, child) {
                final t = Motion.inOut.transform(_fly.value);
                final at = Offset.lerp(flight.from, flight.to, t)!;
                final scale = 1 - 0.38 * t;
                final fade = 1 - const Interval(0.4, 1, curve: Motion.exit).transform(_fly.value);
                return Opacity(
                  opacity: fade,
                  child: Transform(
                    alignment: Alignment.center,
                    transform: Matrix4.translationValues(at.dx, at.dy, 0)
                      ..rotateZ(flight.lean * (1 - t) * math.pi / 180)
                      ..scaleByDouble(scale, scale, 1, 1),
                    child: child,
                  ),
                );
              },
              child: _Stamped(
                yes: 1,
                no: 0,
                child: _DeckCard(card: flight.card, at: 0, of: n, wordsOpacity: 0.4),
              ),
            ),
          ),
        ),
      );
    }
    return KeyedSubtree(
      key: _deckKey,
      child: RawGestureDetector(
        behavior: HitTestBehavior.translucent,
        gestures: {
          _DeckDragRecognizer: GestureRecognizerFactoryWithHandlers<_DeckDragRecognizer>(
            () => _DeckDragRecognizer(debugOwner: this),
            (r) => r
              ..onStart = _start
              ..onUpdate = _update
              ..onEnd = _end
              ..onCancel = _cancel,
          ),
        },
        child: GestureDetector(
          // A tap on the card is Up next; the row is the accessible path.
          excludeFromSemantics: true,
          behavior: HitTestBehavior.opaque,
          onTap: _leaving || !top.swipeable ? null : () => _tapCard(top),
          child: _DeckLayout(children: children),
        ),
      ),
    );
  }
}

/// What the coach line says: one line (with the chip of the side it names), or both meanings at
/// once (reduced motion's first run).
@immutable
class _CoachSay {
  const _CoachSay(this.text, {this.chip}) : both = false;
  const _CoachSay.both()
      : text = '',
        chip = null,
        both = true;

  final String text;
  final MmDragSide? chip;
  final bool both;

  @override
  bool operator ==(Object other) => other is _CoachSay && other.text == text && other.chip == chip && other.both == both;

  @override
  int get hashCode => Object.hash(text, chip, both);
}

/// The coach line under the deck, first run only: centred, a chip for the side it names.
///
/// It holds the height of the tallest line a demo or a drag can show at this width, so the row
/// under it never bobs while the card performs or follows the finger (a two-line "Right: do this
/// next. It moves into the card above." on a 360 dp phone, a one-line idle line). A line of two
/// sentences that cannot keep one line breaks between them, never with one word left alone on
/// the second line (round 2, item 3).
class _CoachLine extends StatelessWidget {
  const _CoachLine({super.key, required this.say, required this.style});

  final _CoachSay say;
  final TextStyle style;

  /// The lines a demo or a drag shows, whose tallest the coach line holds.
  static const List<_CoachSay> _held = [
    _CoachSay(SuggestedCopy.coachIdle),
    _CoachSay(SuggestedCopy.coachRight, chip: MmDragSide.right),
    _CoachSay(SuggestedCopy.coachLeft, chip: MmDragSide.left),
    _CoachSay(SuggestedCopy.letGoRight),
    _CoachSay(SuggestedCopy.letGoLeft),
    _CoachSay(SuggestedCopy.letGoLast),
  ];

  /// The chip and its gap.
  static const double _chipRoom = 22 + MmSpace.s8;

  @override
  Widget build(BuildContext context) {
    final scaler = MediaQuery.textScalerOf(context);
    return LayoutBuilder(
      builder: (context, box) {
        final width = box.maxWidth;
        // Two sentences that do not fit one line take one line each.
        String fit(String text, bool chip) {
          final at = text.indexOf('. ');
          if (at < 0 || text.contains('\n')) return text;
          final tp = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: scaler)..layout(maxWidth: math.max(0, width - (chip ? _chipRoom : 0)));
          final lines = tp.computeLineMetrics().length;
          tp.dispose();
          return lines > 1 ? '${text.substring(0, at + 1)}\n${text.substring(at + 2)}' : text;
        }

        Widget line(String text, MmDragSide? chip) => Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (chip != null) ...[
              _Chip(side: chip),
              const SizedBox(width: MmSpace.s8),
            ],
            Flexible(
              child: Text(fit(text, chip != null), textAlign: TextAlign.center, style: style),
            ),
          ],
        );
        final Widget shown = say.both
            ? Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  line(SuggestedCopy.coachRight, MmDragSide.right),
                  const SizedBox(height: MmSpace.s6),
                  line(SuggestedCopy.coachLeft, MmDragSide.left),
                ],
              )
            : line(say.text, say.chip);
        return SizedBox(
          key: SuggestedStack.coachKey,
          width: double.infinity,
          child: say.both
              ? shown
              : Stack(
                  alignment: Alignment.center,
                  children: [
                    for (final h in _held)
                      if (h != say) ExcludeSemantics(child: Visibility(visible: false, maintainSize: true, maintainAnimation: true, maintainState: true, child: line(h.text, h.chip))),
                    shown,
                  ],
                ),
        );
      },
    );
  }
}

/// A small square naming a direction beside the coach line.
class _Chip extends StatelessWidget {
  const _Chip({required this.side});

  final MmDragSide side;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final accent = colors.isNight ? colors.volt : colors.accentText;
    final right = side == MmDragSide.right;
    return ExcludeSemantics(
      child: Container(
        width: 22,
        height: 22,
        decoration: BoxDecoration(
          borderRadius: const BorderRadius.all(Radius.circular(7)),
          border: Border.all(color: right ? accent : colors.lineStrong),
        ),
        child: Icon(right ? LucideIcons.arrowRight : LucideIcons.arrowLeft, size: 14, color: right ? accent : colors.ink),
      ),
    );
  }
}

/// The deck's place while Today loads (L03): the heading (and the intro on a first-run visit), the
/// top card with the two peek bands under it, the coach line's place, and the row, at their landed
/// heights, so the week under it does not move when Today lands. Today's skeleton already says it
/// is loading.
class SuggestedStackSkeleton extends StatefulWidget {
  const SuggestedStackSkeleton({super.key, this.delay = const Duration(milliseconds: 400)});

  /// Like Today's own skeleton, the bars show only after [delay]: a fast load never flashes them,
  /// but the place is held from the first frame.
  final Duration delay;

  /// A card's height at [scaler]: its padding, and its words (a cost line and a two-line title
  /// over two lines of evidence, the usual tallest card of a deck), the evidence under the art.
  static double cardHeight(TextScaler scaler) =>
      _cardTop + math.max(scaler.scale(_bodyWords) + MmSpace.s2 + _footGap, _footMinTop) + scaler.scale(_footWords) + _cardBottom;
  static const double _bodyWords = 20 + 48;
  static const double _footWords = 40;

  /// The intro line's style, shared with the stack.
  static TextStyle introStyle(BuildContext context) => context.mmType.small.copyWith(fontSize: 14, height: 20 / 14, color: context.mmColors.ink2);

  /// The coach line's style, shared with the stack.
  static TextStyle coachStyle(BuildContext context) => context.mmType.small.copyWith(fontSize: 14, height: 20 / 14, fontWeight: FontWeight.w500, color: context.mmColors.ink2);

  @override
  State<SuggestedStackSkeleton> createState() => _SuggestedStackSkeletonState();
}

class _SuggestedStackSkeletonState extends State<SuggestedStackSkeleton> {
  Timer? _timer;
  late bool _visible = widget.delay == Duration.zero;

  /// The run's coaching (the stack asks the same question and gets the same answer), so the
  /// intro's and the coach line's places are held too.
  DeckCoachRun? _coach = DeckCoach.loaded;

  @override
  void initState() {
    super.initState();
    if (!_visible) _timer = Timer(widget.delay, () => mounted ? setState(() => _visible = true) : null);
    unawaited(DeckMemoryStore.load());
    if (_coach == null) {
      DeckCoach.load().then((run) {
        if (mounted) setState(() => _coach = run);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final scaler = MediaQuery.textScalerOf(context);
    final card = SuggestedStackSkeleton.cardHeight(scaler);
    final coaching = _coach?.coaching ?? false;
    final reduced = Motion.reduced(context) && !SuggestedStack.debugCoachMotion;
    // The words whose places are held, laid out as the stack lays them out but never seen.
    Widget held(Widget child) => ExcludeSemantics(child: Visibility(visible: false, maintainSize: true, maintainAnimation: true, maintainState: true, child: child));
    final title = TextPainter(text: TextSpan(text: SuggestedCopy.title, style: type.title.copyWith(fontSize: 19)), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)..layout();
    final head = math.max(22.0, title.height);
    title.dispose();
    final intro = coaching ? [const SizedBox(height: MmSpace.s4), held(Text(SuggestedCopy.intro, style: SuggestedStackSkeleton.introStyle(context)))] : const <Widget>[];
    final coach = coaching
        ? [
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: held(_CoachLine(say: reduced ? const _CoachSay.both() : const _CoachSay(SuggestedCopy.coachIdle), style: SuggestedStackSkeleton.coachStyle(context))),
            ),
          ]
        : const <Widget>[];
    return ExcludeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            height: head,
            child: _visible ? const Align(alignment: Alignment.bottomLeft, child: Skeleton.line(width: 168, height: 22)) : null,
          ),
          ...intro,
          const SizedBox(height: MmSpace.s12),
          SizedBox(
            height: card + deckPeek2,
            child: !_visible
                ? null
                : LayoutBuilder(
                    builder: (context, box) {
                      final w = box.maxWidth;
                      // A band: the foot of a card behind, at its scale, showing under the one above.
                      Widget band(double scale, double top, double height, double opacity) => Positioned(
                        left: w * (1 - scale) / 2,
                        right: w * (1 - scale) / 2,
                        top: top,
                        height: height,
                        child: Opacity(
                          opacity: opacity,
                          child: ClipRect(
                            child: OverflowBox(
                              alignment: Alignment.bottomCenter,
                              minHeight: 56,
                              maxHeight: 56,
                              child: const Skeleton(height: 56, radius: MmRadius.panel),
                            ),
                          ),
                        ),
                      );
                      return Stack(
                        children: [
                          band(0.90, card + deckPeek1, deckPeek2 - deckPeek1, 0.45),
                          band(0.95, card, deckPeek1, 0.75),
                          Positioned(left: 0, right: 0, top: 0, height: card, child: const Skeleton(radius: MmRadius.panel)),
                        ],
                      );
                    },
                  ),
          ),
          ...coach,
          const SizedBox(height: MmSpace.s12),
          SizedBox(
            height: deckRowHeight,
            child: !_visible
                ? null
                : const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Skeleton(width: 118, height: deckRowHeight, radius: 999),
                      Skeleton(width: 112, height: deckRowHeight, radius: 999),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

/// The card's object: the corner it keeps the words clear of, and its inset from the card's top
/// right corner (the mock's 104 x 88 at 12, 10). What shows of the object is sized on its own ([_Art]).
const double _artWidth = 104;
const double _artHeight = 88;
const double _artTop = 12;
const double _artRight = 10;

/// The card's padding, top and bottom.
const double _cardTop = 18;
const double _cardBottom = 18;

/// What the cost and title keep clear of the object (the mock's 236 dp line at 358).
const double _titleRoom = 82;

/// The least gap between the title and the evidence line, and how far down the evidence line
/// starts at least, so it runs the card's full width under the object.
const double _footGap = MmSpace.s8;
const double _footMinTop = _artTop + _artHeight - _cardTop;

/// One card: what it costs, its title, its art, and its evidence pinned to the foot.
class _DeckCard extends StatelessWidget {
  const _DeckCard({
    required this.card,
    required this.at,
    required this.of,
    this.interactive = false,
    this.measure = false,
    this.contentOpacity = 1,
    this.wordsOpacity = 1,
    this.edge,
    this.onUpNext,
    this.onNotNow,
  });

  final SuggestedCard card;
  final int at;
  final int of;
  final bool interactive;

  /// Laid out only for its height (never painted): no art, which takes no height of its own.
  final bool measure;

  /// Words and art together (a card behind, nearly hidden).
  final double contentOpacity;

  /// The words alone (the top card while its stamp lands).
  final double wordsOpacity;

  /// The card's edge at the threshold (1.5 dp), or null for its usual hairline.
  final Color? edge;
  final VoidCallback? onUpNext;
  final VoidCallback? onNotNow;

  static const _upNextAction = CustomSemanticsAction(label: SuggestedCopy.upNext);
  static const _notNowAction = CustomSemanticsAction(label: SuggestedCopy.notNow);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final accent = colors.isNight ? colors.volt : colors.accentText;
    final body = Padding(
      padding: const EdgeInsets.only(right: _titleRoom),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (card.suggested) ...[
            Text(
              SuggestedCopy.suggestedTag,
              style: type.micro.copyWith(color: accent, fontWeight: FontWeight.w700, letterSpacing: 0.2),
            ),
            const SizedBox(height: MmSpace.s2),
          ],
          if (card.cost != null)
            Text(
              card.cost!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: type.caption.copyWith(fontSize: 14, height: 20 / 14, color: colors.ink3),
            ),
          const SizedBox(height: MmSpace.s2),
          Text(
            card.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: type.title.copyWith(fontSize: 19, height: 24 / 19, letterSpacing: -0.2, color: colors.ink),
          ),
        ],
      ),
    );
    final foot = Text(
      card.line,
      maxLines: 3,
      overflow: TextOverflow.ellipsis,
      style: type.small.copyWith(fontSize: 14, height: 20 / 14, color: colors.ink2),
    );
    final words = Opacity(
      opacity: (contentOpacity * wordsOpacity).clamp(0.0, 1.0),
      child: _PinFoot(gap: _footGap, footMinTop: _footMinTop, body: body, foot: foot),
    );
    Widget out = DecoratedBox(
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: MmRadius.panelAll,
        border: Border.all(color: edge ?? colors.line, width: edge == null ? 1 : 1.5),
        boxShadow: colors.cardShadow,
      ),
      child: Stack(
        // The deck's height reaches the card (one height for the pass); measured alone, the card
        // is as tall as its words.
        fit: StackFit.passthrough,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, _cardTop, MmSpace.cardPadding, _cardBottom),
            child: interactive
                ? Semantics(
                    container: true,
                    label: SuggestedCopy.cardSemantics(at, of, card.cost, card.title, card.line, suggested: card.suggested),
                    customSemanticsActions: {
                      _upNextAction: ?onUpNext,
                      _notNowAction: ?onNotNow,
                    },
                    child: ExcludeSemantics(child: words),
                  )
                : words,
          ),
          if (!measure)
            Positioned(
              top: _artTop,
              right: _artRight,
              child: ExcludeSemantics(
                child: Opacity(
                  // The object recedes a little less than the words, so the stamp leads but the card
                  // stays itself.
                  opacity: (contentOpacity * (1 - (1 - wordsOpacity) * 0.8)).clamp(0.0, 1.0),
                  child: SizedBox(width: _artWidth, height: _artHeight, child: _Art(card: card)),
                ),
              ),
            ),
        ],
      ),
    );
    if (!interactive) out = IgnorePointer(child: ExcludeSemantics(child: out));
    return out;
  }
}

/// A card's words from the top and its evidence at the foot: as tall as both (with [gap], and the
/// foot never above [footMinTop]) when nothing sets its height; given a height, the foot sits on
/// its foot.
class _PinFoot extends MultiChildRenderObjectWidget {
  _PinFoot({required this.gap, required this.footMinTop, required Widget body, required Widget foot}) : super(children: [body, foot]);

  final double gap;
  final double footMinTop;

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderPinFoot(gap, footMinTop);

  @override
  void updateRenderObject(BuildContext context, _RenderPinFoot renderObject) => renderObject
    ..gap = gap
    ..footMinTop = footMinTop;
}

class _PinData extends ContainerBoxParentData<RenderBox> {}

class _RenderPinFoot extends RenderBox with ContainerRenderObjectMixin<RenderBox, _PinData>, RenderBoxContainerDefaultsMixin<RenderBox, _PinData> {
  _RenderPinFoot(this._gap, this._footMinTop);

  double _gap;
  set gap(double value) {
    if (value == _gap) return;
    _gap = value;
    markNeedsLayout();
  }

  double _footMinTop;
  set footMinTop(double value) {
    if (value == _footMinTop) return;
    _footMinTop = value;
    markNeedsLayout();
  }

  @override
  void setupParentData(RenderBox child) {
    if (child.parentData is! _PinData) child.parentData = _PinData();
  }

  double _footTop(double body) => math.max(body + _gap, _footMinTop);

  @override
  double computeMinIntrinsicHeight(double width) => _footTop(firstChild!.getMinIntrinsicHeight(width)) + lastChild!.getMinIntrinsicHeight(width);

  @override
  double computeMaxIntrinsicHeight(double width) => _footTop(firstChild!.getMaxIntrinsicHeight(width)) + lastChild!.getMaxIntrinsicHeight(width);

  @override
  double computeMinIntrinsicWidth(double height) => math.max(firstChild!.getMinIntrinsicWidth(double.infinity), lastChild!.getMinIntrinsicWidth(double.infinity));

  @override
  double computeMaxIntrinsicWidth(double height) => math.max(firstChild!.getMaxIntrinsicWidth(double.infinity), lastChild!.getMaxIntrinsicWidth(double.infinity));

  @override
  void performLayout() {
    final body = firstChild!;
    final foot = lastChild!;
    final width = constraints.maxWidth;
    final loose = BoxConstraints(maxWidth: width);
    body.layout(loose, parentUsesSize: true);
    foot.layout(loose, parentUsesSize: true);
    final natural = _footTop(body.size.height) + foot.size.height;
    size = constraints.constrain(Size(width, natural));
    (body.parentData! as _PinData).offset = Offset.zero;
    (foot.parentData! as _PinData).offset = Offset(0, math.max(_footTop(body.size.height), size.height - foot.size.height));
  }

  @override
  void paint(PaintingContext context, Offset offset) => defaultPaint(context, offset);

  @override
  bool hitTestChildren(BoxHitTestResult result, {required Offset position}) => defaultHitTestChildren(result, position: position);
}

/// A card with its stamps over it: "Up next" top left as it goes right, "Not now" top right as it
/// goes left, each at its strength (0 to 1 at the threshold).
class _Stamped extends StatelessWidget {
  const _Stamped({super.key, required this.yes, required this.no, required this.child});

  final double yes;
  final double no;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final accent = colors.isNight ? colors.volt : colors.accentText;
    return Stack(
      clipBehavior: Clip.none,
      // The card keeps the deck's height.
      fit: StackFit.passthrough,
      children: [
        child,
        if (yes > 0.01)
          Positioned(
            top: 18,
            left: 18,
            child: _Stamp(label: SuggestedCopy.upNext, color: accent, edge: accent, lean: -8, strength: yes),
          ),
        if (no > 0.01)
          Positioned(
            top: 18,
            right: 18,
            child: _Stamp(label: SuggestedCopy.notNow, color: colors.ink2, edge: colors.ink3, lean: 8, strength: no),
          ),
      ],
    );
  }
}

/// The subject's object, Mobi, or the stopwatch, in the card's corner.
class _Art extends StatelessWidget {
  const _Art({required this.card});

  final SuggestedCard card;

  // Sized by what shows, not by the box: the pictures carry clear margins of their own, so each
  // draws in a larger box centred on the corner's (the mock's 104 x 88 corner).
  static const double _objectSide = 116;
  static const double _mobiSize = 96;

  @override
  Widget build(BuildContext context) => OverflowBox(
    maxWidth: double.infinity,
    maxHeight: double.infinity,
    child: switch (card.art) {
      SuggestedArt.mobi => Mobi(pose: HeroArtView.poseFor(card.pose), size: _mobiSize),
      SuggestedArt.stopwatch => const HybridStopwatch(height: 80),
      // The lead card's object, unframed: an object on the card, not an icon. It stays still (no
      // lean or tap of its own), since the whole card answers the finger.
      SuggestedArt.subject => SubjectEmblem(subject: card.subjectId, size: _objectSide, framed: false, life: false),
    },
  );
}

/// "Up next" or "Not now", pressed onto the card as it nears the threshold: opacity 1.6 times the
/// drag's progress, landing from 1.08 to 1, on an opaque fill so the words under it never smudge it.
class _Stamp extends StatelessWidget {
  const _Stamp({required this.label, required this.color, required this.edge, required this.lean, required this.strength});

  final String label;
  final Color color;
  final Color edge;
  final double lean;
  final double strength;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = 1.08 - 0.08 * strength;
    return Opacity(
      opacity: math.min(1.0, 1.6 * strength).clamp(0.0, 1.0),
      child: Transform(
        alignment: Alignment.center,
        transform: Matrix4.rotationZ(lean * math.pi / 180)..scaleByDouble(s, s, 1, 1),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.raised,
            borderRadius: const BorderRadius.all(Radius.circular(10)),
            border: Border.all(color: edge, width: 2.5),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
            child: Text(
              label,
              maxLines: 1,
              style: type.title.copyWith(fontSize: 20, height: 28 / 20, letterSpacing: -0.2, color: color),
            ),
          ),
        ),
      ),
    );
  }
}

/// The fixed row under the deck: Not now, Undo, Up next (at the end of the pass: Undo and Go
/// through them again). The side the card is dragged toward grows with the drag (1 + 0.06 times
/// its progress) and lights at the threshold. Each button is a 48 dp target; on a narrow phone
/// with large text Undo keeps only its icon, its label kept for screen readers.
class _DeckControls extends StatelessWidget {
  const _DeckControls({
    required this.ended,
    required this.notNow,
    required this.upNext,
    required this.notNowLit,
    required this.upNextLit,
    required this.title,
    required this.undoTitle,
    required this.onNotNow,
    required this.onUpNext,
    required this.onUndo,
    required this.onAgain,
  });

  final bool ended;

  /// How far a drag toward each side has come (0 to 1).
  final double notNow;
  final double upNext;
  final bool notNowLit;
  final bool upNextLit;

  /// The top card's title, for the buttons' words to a screen reader.
  final String? title;

  /// The card Undo would bring back.
  final String? undoTitle;
  final VoidCallback? onNotNow;
  final VoidCallback? onUpNext;
  final VoidCallback? onUndo;
  final VoidCallback onAgain;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final scaler = MediaQuery.textScalerOf(context);
    final label = type.labelLarge.copyWith(fontSize: 15, height: 20 / 15, fontWeight: FontWeight.w600);
    final undoLabel = label.copyWith(fontSize: 14);
    double w(String text, TextStyle style) {
      final tp = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)..layout();
      final width = tp.width;
      tp.dispose();
      return width;
    }

    return LayoutBuilder(
      builder: (context, box) {
        // Each button: its icon (18), the gap (8) and its padding, around its words.
        const side = 14 + 18 + 8 + 18;
        const bareSide = 16 + 16;
        final undoFull = 12 + 18 + 8 + w(SuggestedCopy.undo, undoLabel) + 12;
        final noW = w(SuggestedCopy.notNow, label);
        final upW = w(SuggestedCopy.upNext, label);
        // Tight (a 360 dp phone): the two outer buttons drop their icons first, since words in a
        // pill still read as a button, and every label stays whole ("Do this next", never
        // "Do this ..."). Only when even that cannot fit (360 dp at 1.3x text) does Undo keep only
        // its icon: a bare glyph between two pills is the last thing given up (round 2, item 2).
        final bare = !ended && side * 2 + noW + upW + undoFull > box.maxWidth;
        final compact = bare && bareSide * 2 + noW + upW + undoFull > box.maxWidth;
        final pad = bare ? bareSide : side;
        final undo = _UndoButton(
          compact: compact,
          style: undoLabel,
          onTap: onUndo,
          semanticsLabel: undoTitle == null ? SuggestedCopy.undoNone : SuggestedCopy.undoSemantics(undoTitle!),
        );
        if (ended) {
          return SizedBox(
            height: deckRowHeight,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                undo,
                const SizedBox(width: MmSpace.s8),
                Flexible(
                  child: _RowButton(
                    key: SuggestedStack.againKey,
                    icon: LucideIcons.refreshCw,
                    label: SuggestedCopy.again,
                    style: label,
                    filled: true,
                    onTap: onAgain,
                    semanticsLabel: SuggestedCopy.again,
                  ),
                ),
              ],
            ),
          );
        }
        final t = title ?? '';
        return SizedBox(
          height: deckRowHeight,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Each side takes room in proportion to its own width, so the longer words are not
              // cut while the shorter ones have room to spare.
              Flexible(
                flex: (pad + noW).round(),
                child: _RowButton(
                  key: SuggestedStack.notNowKey,
                  icon: bare ? null : LucideIcons.x,
                  label: SuggestedCopy.notNow,
                  style: label,
                  grow: notNow,
                  lit: notNowLit,
                  onTap: onNotNow,
                  semanticsLabel: SuggestedCopy.notNowSemantics(t),
                ),
              ),
              undo,
              Flexible(
                flex: (pad + upW).round(),
                child: _RowButton(
                  key: SuggestedStack.upNextKey,
                  icon: bare ? null : LucideIcons.arrowUpToLine,
                  label: SuggestedCopy.upNext,
                  style: label,
                  filled: true,
                  yes: true,
                  grow: upNext,
                  lit: upNextLit,
                  onTap: onUpNext,
                  semanticsLabel: SuggestedCopy.upNextSemantics(t),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// A button of the row: a 48 dp pill with an icon and its words. [grow] scales it with the drag;
/// [lit] gives it the accent edge (Up next adds a volt wash) at the threshold.
class _RowButton extends StatelessWidget {
  const _RowButton({
    super.key,
    required this.icon,
    required this.label,
    required this.style,
    required this.onTap,
    required this.semanticsLabel,
    this.filled = false,
    this.yes = false,
    this.grow = 0,
    this.lit = false,
  });

  /// Null on a row too tight for icons: the words alone.
  final IconData? icon;
  final String label;
  final TextStyle style;
  final VoidCallback? onTap;
  final String semanticsLabel;

  /// The raised fill (Up next, Go through them again); Not now is an outline.
  final bool filled;

  /// The accent side (Up next).
  final bool yes;
  final double grow;
  final bool lit;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final accent = colors.isNight ? colors.volt : colors.accentText;
    final wash = colors.isNight ? Color.lerp(colors.raised2, colors.volt, 0.14)! : Color.lerp(colors.raised, colors.volt, 0.30)!;
    final scale = 1 + 0.06 * (lit ? 1 : grow.clamp(0.0, 1.0));
    return Transform.scale(
      scale: scale,
      child: MmPressable(
        onTap: onTap,
        semanticsLabel: semanticsLabel,
        focusRadius: MmRadius.pillAll,
        pressedScale: 0.97,
        haptic: MmPressHaptic.selection,
        builder: (context, pressed, _) {
          final Color fill;
          final BorderSide border;
          if (lit && yes) {
            fill = wash;
            border = BorderSide(color: accent, width: 1.5);
          } else if (lit) {
            fill = colors.raised2;
            border = BorderSide(color: colors.ink3);
          } else {
            fill = pressed ? (filled ? colors.raised : colors.raised2) : (filled ? colors.raised2 : Colors.transparent);
            border = BorderSide(color: colors.lineStrong);
          }
          final ink = lit || filled ? colors.ink : colors.ink2;
          return Container(
            height: deckRowHeight,
            padding: icon == null ? const EdgeInsets.symmetric(horizontal: 16) : const EdgeInsets.only(left: 14, right: 18),
            decoration: ShapeDecoration(color: fill, shape: StadiumBorder(side: border)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 18, color: yes ? accent : ink),
                  const SizedBox(width: MmSpace.s8),
                ],
                Flexible(
                  child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: style.copyWith(color: ink)),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Undo in the row: quiet, and at 38% while there is nothing to undo, holding its place so the row
/// never shifts.
class _UndoButton extends StatelessWidget {
  const _UndoButton({required this.compact, required this.style, required this.onTap, required this.semanticsLabel});

  final bool compact;
  final TextStyle style;
  final VoidCallback? onTap;
  final String semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final on = onTap != null;
    return MmPressable(
      key: SuggestedStack.undoKey,
      onTap: onTap,
      semanticsLabel: semanticsLabel,
      focusRadius: MmRadius.pillAll,
      pressedScale: 0.97,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => AnimatedOpacity(
        opacity: on ? 1 : 0.38,
        duration: Motion.ui,
        curve: Motion.out,
        child: Container(
          height: deckRowHeight,
          constraints: const BoxConstraints(minWidth: deckRowHeight),
          padding: EdgeInsets.symmetric(horizontal: compact ? 15 : 12),
          decoration: ShapeDecoration(color: pressed ? colors.raised2 : Colors.transparent, shape: const StadiumBorder()),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(LucideIcons.undo2, size: 18, color: colors.ink2),
              if (!compact) ...[
                const SizedBox(width: MmSpace.s8),
                Text(SuggestedCopy.undo, maxLines: 1, style: style.copyWith(color: colors.ink2)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The bar after Up next: the moved card's object, its title, what happened, and Undo, on glass
/// chrome above the dock. It holds [deckBarHold], paused while touched or while its Undo has focus.
/// With a screen reader on it has no clock at all: it stays until the next action or scroll, so its
/// Undo is never gone before the student reaches it (WCAG 2.2.1; accessibility focus is not
/// keyboard focus, so a pause on focus alone would not hold it). The snack bar it sits in is the
/// live region that speaks it, once.
class _UpNextBar extends StatefulWidget {
  const _UpNextBar({required this.card, required this.line, required this.onUndo, required this.onTimeout});

  final SuggestedCard card;
  final String line;
  final VoidCallback? onUndo;
  final VoidCallback onTimeout;

  @override
  State<_UpNextBar> createState() => _UpNextBarState();
}

class _UpNextBarState extends State<_UpNextBar> {
  Timer? _timer;
  final Stopwatch _held = Stopwatch();
  bool _touched = false;
  bool _focused = false;

  /// A screen reader is on: the bar holds until the next action.
  bool _untimed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _untimed = MediaQuery.maybeAccessibleNavigationOf(context) ?? false;
    _untimed ? _pause() : _resume();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _pause() {
    _timer?.cancel();
    _held.stop();
  }

  void _resume() {
    if (_touched || _focused || _untimed) return;
    _timer?.cancel();
    _held.start();
    final left = deckBarHold - _held.elapsed;
    _timer = Timer(left.isNegative ? Duration.zero : left, widget.onTimeout);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final undo = widget.onUndo;
    final reduced = Motion.reduced(context);
    return TweenAnimationBuilder<double>(
      // It rises 16 dp as it fades in (the snack bar's own fade carries the opacity).
      tween: Tween(begin: reduced ? 0 : 16, end: 0),
      duration: Motion.card,
      curve: Motion.out,
      builder: (context, dy, child) => Transform.translate(offset: Offset(0, dy), child: child),
      child: Listener(
        onPointerDown: (_) {
          _touched = true;
          _pause();
        },
        onPointerUp: (_) {
          _touched = false;
          _resume();
        },
        onPointerCancel: (_) {
          _touched = false;
          _resume();
        },
        child: Focus(
          onFocusChange: (focused) {
            _focused = focused;
            focused ? _pause() : _resume();
          },
          child: Semantics(
            container: true,
            child: ClipRRect(
              borderRadius: const BorderRadius.all(Radius.circular(20)),
              child: BackdropFilter(
                filter: ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: colors.glassTintLite,
                    borderRadius: const BorderRadius.all(Radius.circular(20)),
                    border: Border.all(color: colors.isNight ? colors.edgeTop : colors.lineStrong),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(10, 10, 8, 10),
                    child: Row(
                      children: [
                        ExcludeSemantics(
                          child: SizedBox(
                            width: 44,
                            height: 40,
                            child: FittedBox(
                              child: SizedBox(width: _artWidth, height: _artHeight, child: _Art(card: widget.card)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                widget.card.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: type.labelLarge.copyWith(fontSize: 15, height: 20 / 15, fontWeight: FontWeight.w600, color: colors.ink),
                              ),
                              Text(widget.line, style: type.small.copyWith(fontSize: 14, height: 18 / 14, color: colors.ink2)),
                            ],
                          ),
                        ),
                        if (undo != null) ...[
                          const SizedBox(width: MmSpace.s8),
                          MmPressable(
                            key: SuggestedStack.barUndoKey,
                            onTap: undo,
                            semanticsLabel: SuggestedCopy.undoSemantics(widget.card.title),
                            focusRadius: MmRadius.pillAll,
                            pressedScale: 0.97,
                            haptic: MmPressHaptic.selection,
                            builder: (context, pressed, _) => Container(
                              height: 44,
                              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16),
                              alignment: Alignment.center,
                              decoration: ShapeDecoration(
                                color: pressed ? colors.raised : colors.raised2,
                                shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
                              ),
                              child: Text(SuggestedCopy.undo, style: type.labelLarge.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: colors.ink)),
                            ),
                          ),
                        ],
                      ],
                    ),
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

/// The end of the deck: a dashed card with Mobi thinking, where the student stands, and every way
/// to practise. The row under it offers Undo and Go through them again.
class _EndCard extends StatelessWidget {
  const _EndCard({required this.count, required this.yourPick, this.height, this.onMore});

  final int count;

  /// The lead card is the student's own pick (else it is still the recommended move).
  final bool yourPick;

  /// The deck's height as it ended: the end card takes it, so nothing under it moves.
  final double? height;
  final VoidCallback? onMore;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final more = onMore;
    return CustomPaint(
      painter: _DashedEdge(color: colors.lineStrong),
      child: ConstrainedBox(
        constraints: BoxConstraints(minHeight: height ?? 164, minWidth: double.infinity),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s24, vertical: MmSpace.s8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              // About 60 dp of Mobi showing (st-end): the picture carries its own margin.
              const Mobi(pose: MobiPose.think, size: 76),
              const SizedBox(height: MmSpace.s4),
              Text(
                SuggestedCopy.allSeen(count),
                textAlign: TextAlign.center,
                style: type.labelLarge.copyWith(fontSize: 16, height: 22 / 16, fontWeight: FontWeight.w600, color: colors.ink),
              ),
              const SizedBox(height: MmSpace.s2),
              Text(
                yourPick ? SuggestedCopy.endYourPick : SuggestedCopy.endOurPick,
                textAlign: TextAlign.center,
                style: type.small.copyWith(fontSize: 14, height: 20 / 14, color: colors.ink2),
              ),
              if (more != null) GlanceLink(label: SuggestedCopy.everyWay, onTap: more),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashedEdge extends CustomPainter {
  _DashedEdge({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    final path = Path()..addRRect(MmRadius.panelAll.toRRect(Offset.zero & size).deflate(0.75));
    for (final metric in path.computeMetrics()) {
      var d = 0.0;
      while (d < metric.length) {
        canvas.drawPath(metric.extractPath(d, math.min(d + 6, metric.length)), paint);
        d += 11;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedEdge old) => old.color != color;
}

/// A card's place in the deck: 0 on top, 1 and 2 behind it (3 waits unseen), -1 a chosen card in
/// flight, -2 a passed-on card tucking in, [_measureDepth] a card laid out only for its height.
class _DeckSlot extends ParentDataWidget<_DeckSlotData> {
  const _DeckSlot({required this.depth, required super.child});

  final int depth;

  @override
  void applyParentData(RenderObject renderObject) {
    final data = renderObject.parentData! as _DeckSlotData;
    if (data.depth != depth) {
      data.depth = depth;
      renderObject.parent?.markNeedsLayout();
    }
  }

  @override
  Type get debugTypicalAncestorWidgetClass => _DeckLayout;
}

/// The slot of a card laid out only for its height: never painted, never hit.
const int _measureDepth = 1 << 20;

class _DeckSlotData extends ContainerBoxParentData<RenderBox> {
  int depth = 0;
}

/// The deck's cards, one over another, all one height for the pass: the tallest card's, read
/// from every card of the pass laid out unseen. The top card, the cards behind it (their peeks
/// even bands) and a card in flight all take it, and so does the deck, so nothing under it moves
/// while the finger is down or after it lets go.
class _DeckLayout extends MultiChildRenderObjectWidget {
  const _DeckLayout({required super.children});

  @override
  MultiChildRenderObjectElement createElement() => _DeckElement(this);

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderDeck();
}

/// The cards laid out only for their height are not on stage (finders and inspectors skip them,
/// as they skip an Offstage child).
class _DeckElement extends MultiChildRenderObjectElement {
  _DeckElement(super.widget);

  @override
  void debugVisitOnstageChildren(ElementVisitor visitor) {
    for (final child in children) {
      final slot = child.widget;
      if (slot is _DeckSlot && slot.depth == _measureDepth) continue;
      visitor(child);
    }
  }
}

class _RenderDeck extends RenderBox with ContainerRenderObjectMixin<RenderBox, _DeckSlotData>, RenderBoxContainerDefaultsMixin<RenderBox, _DeckSlotData> {
  @override
  void setupParentData(RenderBox child) {
    if (child.parentData is! _DeckSlotData) child.parentData = _DeckSlotData();
  }

  static bool _measured(RenderBox child) => (child.parentData! as _DeckSlotData).depth == _measureDepth;

  @override
  void performLayout() {
    final width = constraints.maxWidth;
    final own = BoxConstraints(minWidth: width, maxWidth: width);
    var height = 0.0;
    var child = firstChild;
    while (child != null) {
      final data = child.parentData! as _DeckSlotData;
      data.offset = Offset.zero;
      if (data.depth == _measureDepth) {
        child.layout(own, parentUsesSize: true);
        height = math.max(height, child.size.height);
      }
      child = data.nextSibling;
    }
    child = firstChild;
    while (child != null) {
      final data = child.parentData! as _DeckSlotData;
      if (data.depth != _measureDepth) {
        if (height <= 0) {
          // Nothing measured (never in practice): the card is its own height and sets the deck's.
          child.layout(own, parentUsesSize: true);
          height = math.max(height, child.size.height);
        } else {
          child.layout(BoxConstraints.tightFor(width: width, height: height));
        }
      }
      child = data.nextSibling;
    }
    size = constraints.constrain(Size(width, height));
  }

  @override
  void paint(PaintingContext context, Offset offset) {
    var child = firstChild;
    while (child != null) {
      final data = child.parentData! as _DeckSlotData;
      if (data.depth != _measureDepth) context.paintChild(child, data.offset + offset);
      child = data.nextSibling;
    }
  }

  @override
  bool hitTestChildren(BoxHitTestResult result, {required Offset position}) {
    var child = lastChild;
    while (child != null) {
      final data = child.parentData! as _DeckSlotData;
      if (!_measured(child)) {
        final hit = result.addWithPaintOffset(offset: data.offset, position: position, hitTest: (result, transformed) => child!.hitTest(result, position: transformed));
        if (hit) return true;
      }
      child = data.previousSibling;
    }
    return false;
  }

  @override
  void visitChildrenForSemantics(RenderObjectVisitor visitor) {
    visitChildren((child) {
      if (!_measured(child as RenderBox)) visitor(child);
    });
  }
}

/// A sideways drag that locks after [deckLock] dp of mostly sideways travel and gives way at once
/// to a mostly vertical one (the page's scroll).
class _DeckDragRecognizer extends OneSequenceGestureRecognizer {
  _DeckDragRecognizer({super.debugOwner});

  VoidCallback? onStart;
  ValueChanged<double>? onUpdate;
  ValueChanged<double>? onEnd;
  VoidCallback? onCancel;

  VelocityTracker? _tracker;
  Offset _travel = Offset.zero;
  bool _won = false;
  bool _dragging = false;
  int? _pointer;

  /// Sideways means within about 27 degrees of level (dy at most half of dx): a diagonal that
  /// starts on the deck, say 12 across and 11 down, is the page's scroll, not a swipe.
  static bool claims(Offset d) => d.dx.abs() >= deckLock && d.dy.abs() <= d.dx.abs() * deckSlope;
  static bool yields(Offset d) => d.distance >= deckLock && d.dy.abs() > d.dx.abs() * deckSlope;

  @override
  void addAllowedPointer(PointerDownEvent event) {
    if (_pointer != null) return;
    super.addAllowedPointer(event);
    _pointer = event.pointer;
    _travel = Offset.zero;
    _won = false;
    _dragging = false;
    _tracker = VelocityTracker.withKind(event.kind)..addPosition(event.timeStamp, event.localPosition);
  }

  @override
  void handleEvent(PointerEvent event) {
    if (event.pointer != _pointer) return;
    if (event is PointerMoveEvent) {
      _tracker?.addPosition(event.timeStamp, event.localPosition);
      if (_dragging) {
        onUpdate?.call(event.localDelta.dx);
        return;
      }
      _travel += event.localDelta;
      if (claims(_travel)) {
        if (!_won) resolve(GestureDisposition.accepted);
        if (_won) _begin();
      } else if (yields(_travel)) {
        if (!_won) resolve(GestureDisposition.rejected);
        stopTrackingPointer(event.pointer);
      }
    } else if (event is PointerUpEvent || event is PointerCancelEvent) {
      if (_dragging) {
        _dragging = false;
        if (event is PointerUpEvent) {
          onEnd?.call(_tracker?.getVelocity().pixelsPerSecond.dx ?? 0);
        } else {
          onCancel?.call();
        }
      } else if (!_won) {
        resolve(GestureDisposition.rejected);
      }
      stopTrackingPointer(event.pointer);
    }
  }

  void _begin() {
    if (_dragging) return;
    _dragging = true;
    onStart?.call();
    onUpdate?.call(_travel.dx);
  }

  @override
  void acceptGesture(int pointer) {
    _won = true;
    if (claims(_travel)) _begin();
  }

  @override
  void rejectGesture(int pointer) {
    if (_dragging) {
      _dragging = false;
      onCancel?.call();
    }
    _won = false;
    stopTrackingPointer(pointer);
  }

  @override
  void didStopTrackingLastPointer(int pointer) {
    _pointer = null;
    _tracker = null;
  }

  @override
  String get debugDescription => 'suggested deck drag';
}
