// The Mob welcome (owner, 20 Oct 11:20 pm: "another welcome animation on top of that for the first time"; V16-PLAN
// A3): a full screen pushed over the Mob tab (`/mob/welcome`) the first time its root shows, once per account on this
// phone (logic/mob_welcome.dart has the rules). The lamp comes on in the empty den, Riya, Kabir and Zoya hop in, the
// fourth seat stands open, the pennant drops, then "This is the Mob." and two keys:
// - "See how it works" (volt): the explainer takes the welcome's place (as Start in no Mob, as a replay for a member);
// - "Not now" (quiet): back to the tab.
// Both mark the welcome seen, as do the quiet Skip (top right from 600 ms: it lands the end state in 200 ms) and
// leaving any other way. Any tap on the room finishes the motion in 200 ms. Haptics: light on each landing.
// Reduced motion: the lamp fades in 120 ms, the Folds cross-fade in their seats, the words fade; no hops.
//
// MobWelcomeHook is the one trigger, on both Mob tab roots (DenStartScreen and the den).

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/haptics/haptics.dart';
import '../../../../core/motion/motion.dart' show Motion;
import '../../../../core/motion/motion_tokens.g.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart' show FoldPose;
import '../logic/mob_welcome.dart';
import '../widgets/den_stage.dart' show denRoomArt;
import '../widgets/fold_manifest.dart';
import '../widgets/welcome_stage.dart';
import 'mob_explainer_screen.dart';
import 'results_run.dart';

/// Opens the welcome over the tab and keeps the run's memory: never twice in a run, and on screen until the welcome
/// (or the explainer it hands to) closes.
abstract final class MobWelcomeGate {
  static Future<void> open(BuildContext context, {required bool inMob}) async {
    final container = ProviderScope.containerOf(context, listen: false);
    final run = container.read(mobWelcomeRunProvider);
    if (run.opened) return;
    run.opened = true;
    run.onScreen.value = true;
    try {
      final next = await Navigator.of(context, rootNavigator: true).push<Object?>(MobWelcomeScreen.route(inMob: inMob));
      // "See how it works" hands back the explainer's own route: the flow ends when it does.
      if (next is Future) await next;
    } finally {
      run.onScreen.value = false;
    }
  }
}

class MobWelcomeScreen extends ConsumerStatefulWidget {
  const MobWelcomeScreen({super.key, required this.inMob, this.autoplay = true});

  /// The student is in a Mob (the den): "See how it works" replays the explainer, ending with one key back.
  final bool inMob;

  /// False holds the first frame (frame goldens seek by hand).
  final bool autoplay;

  static const String routeName = '/mob/welcome';

  /// A 240 ms fade over the tab: the room starts dark, so it reads as the lights going down.
  static Route<Object?> route({required bool inMob}) => PageRouteBuilder<Object?>(
    settings: const RouteSettings(name: routeName),
    transitionDuration: const Duration(milliseconds: 240),
    reverseTransitionDuration: MotionDurations.ui,
    pageBuilder: (_, _, _) => MobWelcomeScreen(inMob: inMob),
    transitionsBuilder: (_, a, _, child) => FadeTransition(
      opacity: CurvedAnimation(parent: a, curve: MotionCurves.glide),
      child: child,
    ),
  );

  @override
  ConsumerState<MobWelcomeScreen> createState() => MobWelcomeScreenState();
}

class MobWelcomeScreenState extends ConsumerState<MobWelcomeScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _clock = AnimationController(vsync: this);
  late final MobWelcomeSeen _seen;
  bool _started = false;
  bool _reduced = false;
  bool _left = false;
  int _landed = 0;

  double get _total => WelcomeTimeline.totalFor(reduced: _reduced);

  /// The timeline's time now, in ms.
  double get ms => _clock.value * _total;

  @override
  void initState() {
    super.initState();
    // Kept from the start: leaving marks it seen from dispose, where ref is gone.
    _seen = ref.read(mobWelcomeSeenProvider);
    _clock.addListener(_onTick);
    _clock.addStatusListener((s) {
      if (s == AnimationStatus.completed && mounted) setState(() {});
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _reduced = Motion.reduced(context);
    _clock.duration = Duration(milliseconds: _total.round());
    if (widget.autoplay) unawaited(_ready().then((_) => mounted && !_clock.isAnimating && _clock.value == 0 ? _clock.forward() : null));
  }

  /// The room and the three Folds (idle and wave) decoded, or 450 ms passed: the clock holds the dark room till then.
  Future<void> _ready() async {
    final night = context.mmColors.isNight;
    final ready = Future.wait<void>([
      precacheImage(AssetImage(denRoomArt(night)), context).catchError((Object _) {}),
      precacheFolds(context, WelcomeCast.folds).catchError((Object _) {}),
      precacheFolds(context, WelcomeCast.folds, pose: FoldPose.wave).catchError((Object _) {}),
    ]);
    await Future.any<void>([ready, Future<void>.delayed(const Duration(milliseconds: 450))]);
  }

  void _onTick() {
    if (_reduced) return;
    final t = ms;
    while (_landed < WelcomeCast.slots.length && t >= WelcomeTimeline.landing(_landed)) {
      // One light tick per landing; a finish fast-forward lands them all in 200 ms with no buzz.
      if (t - WelcomeTimeline.landing(_landed) < 120) hapticsOf(context)?.light();
      _landed++;
    }
  }

  @override
  void dispose() {
    // Leaving any way (Back included) counts as seen: the welcome never loops.
    if (!_left) unawaited(_seen.mark());
    _clock.dispose();
    super.dispose();
  }

  /// Puts the timeline at [at] ms (frame goldens).
  @visibleForTesting
  void seek(double at) {
    _clock.stop();
    _landed = WelcomeCast.slots.length;
    _clock.value = (at / _total).clamp(0.0, 1.0);
  }

  /// Any tap: the motion lands its end state in 200 ms.
  void finish() {
    if (_clock.value >= 1 || _finishing) return;
    _finishing = true;
    _clock.animateTo(1, duration: WelcomeTimeline.finish, curve: Curves.linear);
  }

  bool _finishing = false;

  void _skip() {
    unawaited(_seen.mark());
    finish();
  }

  void _seeHow() {
    if (_left) return;
    _left = true;
    unawaited(_seen.mark());
    final route = MaterialPageRoute<void>(
      builder: (_) => MobExplainerScreen(via: MobWelcomeRules.explainerVia(inMob: widget.inMob)),
      settings: const RouteSettings(name: '/mob/how'),
    );
    // The explainer takes the welcome's place; the gate waits on it through the result.
    Navigator.of(context).pushReplacement<void, Object?>(route, result: route.popped);
  }

  void _notNow() {
    if (_left) return;
    _left = true;
    unawaited(_seen.mark());
    Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return Scaffold(
      backgroundColor: c.ground,
      body: LayoutBuilder(
        builder: (context, box) {
          final w = box.maxWidth;
          final pad = MediaQuery.paddingOf(context);
          final scaler = MediaQuery.textScalerOf(context);
          double heightOf(String text, TextStyle style) {
            final p = TextPainter(
              text: TextSpan(text: text, style: style),
              textDirection: TextDirection.ltr,
              textScaler: scaler,
            )..layout(maxWidth: w - 2 * MmSpace.gutter);
            final out = p.height;
            p.dispose();
            return out;
          }

          // The words and keys take what they need; the room takes the rest (at least 300 dp, else the page scrolls).
          final words = heightOf(MobWelcomeCopy.headline, type.moment) + MmSpace.s12 + heightOf(MobWelcomeCopy.lede, type.body);
          final keys = scaler.scale(56) + MmSpace.s8 + scaler.scale(44);
          final need = MmSpace.s8 + words + MmSpace.s24 + keys + MmSpace.s16 + pad.bottom;
          const minRoom = 300.0;
          final roomH = (box.maxHeight - need).clamp(minRoom, 450.0);
          final scrolls = roomH + need > box.maxHeight + 0.5;

          final page = AnimatedBuilder(
            animation: _clock,
            builder: (context, _) {
              final t = ms;
              final (headO, headDy) = WelcomeTimeline.headline(t, reduced: _reduced);
              final (ledeO, ledeDy) = WelcomeTimeline.lede(t, reduced: _reduced);
              final (keysO, keysDy) = WelcomeTimeline.keys(t, reduced: _reduced);
              final live = WelcomeTimeline.keysLive(t, reduced: _reduced);
              final keysBlock = IgnorePointer(
                ignoring: !live,
                child: Opacity(
                  opacity: keysO.clamp(0.0, 1.0),
                  child: Transform.translate(
                    offset: Offset(0, keysDy),
                    child: ExcludeSemantics(
                      excluding: !live,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          KeyButton(key: const ValueKey('welcome-see-how'), label: MobWelcomeCopy.seeHow, onPressed: _seeHow),
                          const SizedBox(height: MmSpace.s8),
                          Center(
                            child: KeyButton.quiet(key: const ValueKey('welcome-not-now'), label: MobWelcomeCopy.notNow, onPressed: _notNow),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
              // Day starts dark under the room too (the words' ground), lifting with the room; Night's ground is dark already.
              final under = WelcomeLightPainter.darknessAt(WelcomeTimeline.room(t, reduced: _reduced), night: c.isNight);
              final column = Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    height: roomH,
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: GestureDetector(
                            key: const ValueKey('welcome-room'),
                            behavior: HitTestBehavior.opaque,
                            onTap: finish,
                            child: Semantics(
                              label: MobWelcomeCopy.roomLabel,
                              image: true,
                              child: ExcludeSemantics(
                                child: RepaintBoundary(
                                  child: WelcomeStage(ms: t, height: roomH, idle: _clock.isCompleted, reduced: _reduced),
                                ),
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          top: pad.top + MmSpace.s4,
                          right: MmSpace.s8,
                          child: _Skip(
                            shown: WelcomeTimeline.skipShown(t, reduced: _reduced) && !_finishing,
                            onTap: _skip,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Opacity(
                          opacity: headO.clamp(0.0, 1.0),
                          child: Transform.translate(
                            offset: Offset(0, headDy),
                            child: Semantics(
                              header: true,
                              child: Text(MobWelcomeCopy.headline, style: type.moment.copyWith(color: c.ink)),
                            ),
                          ),
                        ),
                        const SizedBox(height: MmSpace.s12),
                        Opacity(
                          opacity: ledeO.clamp(0.0, 1.0),
                          child: Transform.translate(
                            offset: Offset(0, ledeDy),
                            child: Text(MobWelcomeCopy.lede, style: type.body.copyWith(color: c.ink2)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // The keys sit at the foot, in the thumb's reach; what the room leaves goes between.
                  if (scrolls) const SizedBox(height: MmSpace.s24) else const Spacer(),
                  Padding(padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s24, MmSpace.gutter, MmSpace.s16 + pad.bottom), child: keysBlock),
                ],
              );
              if (c.isNight || under <= 0.002) return column;
              return Stack(
                children: [
                  column,
                  Positioned(
                    left: 0,
                    right: 0,
                    top: roomH,
                    bottom: 0,
                    child: IgnorePointer(
                      child: ColoredBox(color: WelcomeLightPainter.darkOf(c).withValues(alpha: under)),
                    ),
                  ),
                ],
              );
            },
          );
          if (!scrolls) return page;
          return SingleChildScrollView(child: page);
        },
      ),
    );
  }
}

/// The quiet Skip, top right: a 44 dp target, a small paper pill. It fades in and out rather than popping.
class _Skip extends StatelessWidget {
  const _Skip({required this.shown, required this.onTap});

  final bool shown;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    return IgnorePointer(
      ignoring: !shown,
      child: AnimatedOpacity(
        opacity: shown ? 1 : 0,
        duration: MotionDurations.ui,
        child: Semantics(
          button: true,
          label: MobWelcomeCopy.skipLabel,
          excludeSemantics: true,
          child: GestureDetector(
            key: const ValueKey('welcome-skip'),
            behavior: HitTestBehavior.opaque,
            onTap: onTap,
            child: SizedBox(
              height: 48,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: c.raised.withValues(alpha: c.isNight ? 0.55 : 0.7),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: c.line.withValues(alpha: 0.6)),
                  ),
                  child: Text(MobWelcomeCopy.skip, style: context.mmType.label.copyWith(color: c.ink2)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The one trigger, on both Mob tab roots. After each build it asks the rules once (post-frame); a covered root asks
/// again every 600 ms, a hidden tab when it comes back. [enabled] is false off the tab (a pushed Mob page).
class MobWelcomeHook extends ConsumerStatefulWidget {
  const MobWelcomeHook({super.key, required this.inMob, required this.child, this.enabled = true});

  final bool inMob;
  final bool enabled;
  final Widget child;

  @override
  ConsumerState<MobWelcomeHook> createState() => _MobWelcomeHookState();
}

class _MobWelcomeHookState extends ConsumerState<MobWelcomeHook> {
  bool _asked = false;
  bool _asking = false;
  Timer? _again;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // The tab coming back (its tickers on again) asks again.
    TickerMode.valuesOf(context);
  }

  @override
  void dispose() {
    _again?.cancel();
    super.dispose();
  }

  void _askAfterFrame() {
    if (_asked || !widget.enabled) return;
    _asked = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _asked = false;
      unawaited(_ask());
    });
  }

  Future<void> _ask() async {
    if (!mounted || _asking || !ref.read(mobWelcomeOnProvider)) return;
    final run = ref.read(mobWelcomeRunProvider);
    if (run.opened) return;
    _asking = true;
    final bool seen;
    try {
      seen = await ref.read(mobWelcomeSeenProvider).read();
    } finally {
      _asking = false;
    }
    if (!mounted) return;
    final call = MobWelcomeRules.decide(
      WelcomeMoment(seen: seen, tabShown: TickerMode.valuesOf(context).enabled, rootOnTop: routeOnTopEverywhere(context), resultsRun: ResultsRun.onScreen.value > 0, opening: run.opened),
    );
    if (call == WelcomeCall.play) {
      _again?.cancel();
      unawaited(MobWelcomeGate.open(context, inMob: widget.inMob));
    } else if (MobWelcomeRules.askAgain(call)) {
      _again?.cancel();
      _again = Timer(MobWelcomeRules.askEvery, () {
        _again = null;
        unawaited(_ask());
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    _askAfterFrame();
    return widget.child;
  }
}
