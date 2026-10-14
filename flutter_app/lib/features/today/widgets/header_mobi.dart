// Mobi in Today's header, every day (owner feedback 13 Oct: "animated everywhere, like Duo"). A
// 56 dp living Mobi beside the greeting: he breathes and blinks, cheers only when today's opened
// result improved or held, waves for any other submission, yawns after 11 PM, points at the move
// card when one is ready (aimed at the card itself, again after layout and scroll) and says his
// short line about it the first time the move is ready in an app run, when the student has
// neither touched nor scrolled for 4 s (never under reduced motion; never while the opening still
// covers the app), and says one short line when tapped. After that line, or at once when he has
// already said it, he nudges toward the card once (two short jabs), once a day at most
// (MOTION.md 1.3: sooner reads as nagging). While his line is up the greeting beside him steps
// back (see [HeaderMobi.speaking]), so a bubble never sits on top of text. When the hero already has Mobi (day one, coming back, late night) the
// header leaves him out, so there is never a second Mobi on the screen.
import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/widgets/widgets.dart';
import '../logic/today_model.dart';

class HeaderMobi extends StatefulWidget {
  const HeaderMobi({super.key, required this.cue, this.aim, this.speaking});

  final HeaderMobiCue cue;

  /// True while his line is on screen. The header dims the greeting and date line then: the
  /// line floats where they are, and must never cover readable text.
  final ValueNotifier<bool>? speaking;

  /// The move card's key: where Mobi points when the cue is [HeaderMobiKind.point].
  final GlobalKey? aim;

  static const double size = 56;

  /// Whether he has already said his line about a ready move in this app run.
  static bool _greeted = false;

  /// How long he waits after first pointing, with no touch and no scroll, before he nudges.
  static const Duration nudgeAfter = MobiRation.nudgeAfter;

  /// The screen's name for Mobi's once-a-day gates.
  static const String screen = 'today';

  /// Called each time he nudges (tests only: the act itself is drawn, not read back).
  @visibleForTesting
  static VoidCallback? debugOnNudge;

  /// Lets a test see the first-open line again.
  @visibleForTesting
  static void resetGreeting() => _greeted = false;

  @override
  State<HeaderMobi> createState() => _HeaderMobiState();
}

class _HeaderMobiState extends State<HeaderMobi> with WidgetsBindingObserver {
  final MobiController _mobi = MobiController();
  Timer? _hush;

  /// The one nudge on this screen: armed when he first points, cancelled by any touch.
  Timer? _nudge;
  bool _nudgeArmed = false;
  bool _listening = false;

  /// He is talking: a nudge due now waits for the line to finish.
  Timer? _talking;
  bool _nudgeAfterTalk = false;
  int _tap = 0;
  ScrollPosition? _position;
  Offset? _aimedVector;
  bool _aimQueued = false;

  /// The app is on screen (the brand opening has lifted, the tab is current): his clock for the
  /// line and the nudge only runs from here, so neither plays out of sight.
  bool _onScreen = false;

  MobiAct get _entrance => switch (widget.cue.kind) {
        HeaderMobiKind.cheer => MobiAct.cheer,
        HeaderMobiKind.sleepy => MobiAct.sleepy,
        HeaderMobiKind.point => MobiAct.point,
        HeaderMobiKind.idle => MobiAct.hello,
      };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _mobi.speech.addListener(_syncSpeaking);
    _reaim();
  }

  void _syncSpeaking() => widget.speaking?.value = _mobi.speech.value != null;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final onScreen = TickerMode.valuesOf(context).enabled;
    if (onScreen != _onScreen) {
      _onScreen = onScreen;
      // Aimed while covered, armed only once seen: aim again so the nudge's 4 s start now.
      if (onScreen) _aimedVector = null;
      _reaim();
    }
    // The page scrolls under him: keep the aim on the card as it moves.
    final position = Scrollable.maybeOf(context)?.position;
    if (position == _position) return;
    _position?.removeListener(_reaim);
    _position?.removeListener(_onScrolled);
    _position = position?..addListener(_reaim);
    if (_nudge?.isActive ?? false) _position?.addListener(_onScrolled);
  }

  @override
  void didUpdateWidget(HeaderMobi old) {
    super.didUpdateWidget(old);
    if (old.cue.kind != widget.cue.kind) {
      _mobi.play(_entrance);
      _aimedVector = null;
    }
    _reaim();
  }

  /// Text scale, rotation and window changes move the card.
  @override
  void didChangeMetrics() => _reaim();

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _mobi.speech.removeListener(_syncSpeaking);
    _position?.removeListener(_reaim);
    _hush?.cancel();
    _nudge?.cancel();
    _talking?.cancel();
    _stopListening();
    _mobi.dispose();
    super.dispose();
  }

  /// Aims once per frame, after layout, and only when the card moved relative to Mobi.
  void _reaim() {
    if (_aimQueued || widget.cue.kind != HeaderMobiKind.point || widget.aim == null) return;
    _aimQueued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _aimQueued = false;
      if (mounted) _aim();
    });
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  void _aim() {
    final key = widget.aim;
    final card = key?.currentContext?.findRenderObject();
    final me = context.findRenderObject();
    if (key == null || card is! RenderBox || me is! RenderBox || !card.attached || !card.hasSize || !me.hasSize) return;
    final vector = card.localToGlobal(card.size.center(Offset.zero)) - me.localToGlobal(Offset.zero);
    final last = _aimedVector;
    if (last != null && (vector - last).distance < 1.5) return;
    _aimedVector = vector;
    _mobi.pointAtWidget(key);
    _armNudge();
  }

  /// After the first point: if no finger lands on the screen and the page does not scroll within
  /// [HeaderMobi.nudgeAfter], he nudges toward the card once. Any touch or scroll cancels it for
  /// this screen. Once a day at most ([MobiRation.nudgeToday], asked only when he would nudge).
  /// Not under reduced motion, where he holds a still pose.
  void _armNudge() {
    if (_nudgeArmed || !_onScreen || Motion.reduced(context)) return;
    _nudgeArmed = true;
    GestureBinding.instance.pointerRouter.addGlobalRoute(_onPointer);
    _listening = true;
    _nudge = Timer(HeaderMobi.nudgeAfter, _nudgeNow);
    _position?.addListener(_onScrolled);
  }

  /// A scroll (a fling, the tab-reselect glide) counts as attention: no nudge after it.
  void _onScrolled() => _cancelNudge();

  void _cancelNudge() {
    _nudge?.cancel();
    _nudgeAfterTalk = false;
    _stopListening();
  }

  void _onPointer(PointerEvent event) {
    if (event is PointerDownEvent) _cancelNudge();
  }

  void _stopListening() {
    _position?.removeListener(_onScrolled);
    if (!_listening) return;
    _listening = false;
    GestureBinding.instance.pointerRouter.removeGlobalRoute(_onPointer);
  }

  void _nudgeNow() {
    if (!mounted || widget.cue.kind != HeaderMobiKind.point) {
      _stopListening();
      return;
    }
    // Mid-line (the first-open greeting): the nudge follows the line instead of cutting it off.
    if (_talking?.isActive ?? false) {
      _nudgeAfterTalk = true;
      return;
    }
    // The first idle 4 s of an app run: he says his line about the card, and the nudge follows
    // it (a touch in between cancels the nudge, not the line).
    final lines = widget.cue.lines;
    if (!HeaderMobi._greeted && lines.isNotEmpty) {
      HeaderMobi._greeted = true;
      _speak(lines.first);
      _nudgeAfterTalk = true;
      return;
    }
    _stopListening();
    if (!MobiRation.nudgeToday(HeaderMobi.screen)) return;
    _mobi.play(MobiAct.nudge);
    HeaderMobi.debugOnNudge?.call();
  }

  void _onTap() {
    final lines = widget.cue.lines;
    if (lines.isEmpty) return;
    _speak(lines[_tap++ % lines.length]);
  }

  void _speak(String line) {
    _mobi.say(line, live: true);
    _talking?.cancel();
    _talking = Timer(Duration(milliseconds: (MobiTyping.duration(line) * 1000).round() + 250), () {
      if (!_nudgeAfterTalk) return;
      _nudgeAfterTalk = false;
      _nudgeNow();
    });
    _hush?.cancel();
    _hush = Timer(Duration(milliseconds: (MobiTyping.duration(line) * 1000).round() + 3200), () {
      if (mounted) _mobi.hush();
    });
  }

  @override
  Widget build(BuildContext context) {
    final width = MobiFigure.widthFor(HeaderMobi.size);
    return Semantics(
      button: true,
      label: 'Mobi. Tap for a word.',
      onTap: _onTap,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _onTap,
        child: SizedBox(
          width: width + 8,
          height: HeaderMobi.size,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                right: 0,
                bottom: 0,
                child: MobiCharacter(controller: _mobi, size: HeaderMobi.size, entrance: _entrance, seed: 23),
              ),
              // The line floats to the left of Mobi, over the greeting, and goes after a moment.
              Positioned(
                right: width + 4,
                top: -2,
                child: ValueListenableBuilder<MobiSpeech?>(
                  valueListenable: _mobi.speech,
                  builder: (context, speech, _) => speech == null
                      ? const SizedBox.shrink()
                      : MobiBubble(key: ValueKey(speech.id), speech: speech, tail: MobiTail.right, maxWidth: 236),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
