// The Mob explainer (owner D166, K9; docs/design-decisions/pass-1020/mob-explainer). Seven slides with
// motion, the first time a student starts or joins a Mob, before the setup; and again from "How the
// Mob works" (D0 and Mob settings).
//
// - Skip is always visible on slides 1 to 6, top right; it goes where the student was heading.
// - The track slides 420 ms on emphasized. A swipe follows the finger (a third of the pull at either
//   end) and goes on past 70 dp or a flick over 0.45 dp/ms, else snaps back in 300 ms on out. A tap on
//   the right two thirds goes on, the left third goes back; the arrow keys too.
// - Each slide has one clock (its own timeline, seekable); the incoming slide starts as the track
//   starts moving, the outgoing one lands its end state at once (interruptible).
// - Reduced motion: no track slide (a 120 ms fade), and every slide in its reduced form.
// - Haptics: selection on each slide change; light on the end keys (KeyButton's own). Nothing else.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/haptics/haptics.dart';
import '../../../../core/motion/motion.dart';
import '../../../../core/motion/motion_tokens.g.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../core/api/api_providers.dart' show nowProvider;
import '../../../billing/billing.dart' show playBillingEnabledProvider;
import '../../data/mob_repository.dart' show mobRepositoryProvider;
import '../copy_v3.dart';
import '../data/mob_v3_api.dart';
import '../logic/explainer_flow.dart';
import '../logic/mob_welcome.dart' show mobWelcomeSeenProvider;
import '../widgets/explainer/ex_kit.dart';
import '../widgets/explainer/ex_slides.dart';
import '../widgets/mob_fx.dart';
import '../widgets/moment_kit.dart' show SkipPill;
import 'join_v3_screen.dart';
import 'mob_setup_screen.dart';

/// Whether games need Pro to start, as the server says it (`starts.billingOn` in the den view); with
/// no Mob yet the server sends no `starts`, so the app's own Play Billing switch stands in (both are
/// on together in the release).
final explainerBillingOnProvider = Provider<bool>((ref) {
  final v3 = ref.watch(mobRepositoryProvider.select((s) => s.value?.v3));
  if (v3 != null && ref.watch(mobRepositoryProvider.select((s) => s.value?.mob)) != null) return v3.starts.billingOn;
  return ref.watch(playBillingEnabledProvider) || (v3?.starts.billingOn ?? false);
});

class MobExplainerScreen extends ConsumerStatefulWidget {
  const MobExplainerScreen({super.key, required this.via, this.code = '', this.mobName, this.onExit, this.initialSlide = 0, this.autoplay = true});

  final ExplainerVia via;

  /// The invite's code (via invite), handed to the code screen.
  final String code;

  /// The Mob the invite names, when the caller already knows it.
  final String? mobName;

  /// Where to go instead of the default navigation (the invite gate swaps its own child).
  final ValueChanged<ExplainerExit>? onExit;
  final int initialSlide;

  /// False holds every slide at its first frame (frame-strip tests drive the clock by hand).
  final bool autoplay;

  @override
  ConsumerState<MobExplainerScreen> createState() => MobExplainerScreenState();
}

class MobExplainerScreenState extends ConsumerState<MobExplainerScreen> with TickerProviderStateMixin {
  static const int _last = ExplainerFlow.last;

  late final List<AnimationController> clocks = [
    for (var i = 0; i < ExplainerFlow.slides; i++)
      AnimationController(
        vsync: this,
        duration: Duration(milliseconds: ExSlides.lengthMs[i].round()),
      ),
  ];
  late final AnimationController _track = AnimationController.unbounded(vsync: this, value: widget.initialSlide.toDouble());
  late final AnimationController _fade = AnimationController(vsync: this, duration: MotionDurations.reducedFade, value: 1);
  late final AnimationController _final = AnimationController(vsync: this, duration: const Duration(milliseconds: 440), value: widget.initialSlide >= _last ? 1 : 0);
  final FocusNode _focus = FocusNode(debugLabel: 'mob-explainer');

  late int index = widget.initialSlide.clamp(0, _last);
  int? _incoming;
  double _dragDx = 0;
  bool _dragging = false;
  bool _started = false;
  bool _left = false;
  String? _mobName;

  bool get _reduced => MobFx.reduced(context);

  @override
  void initState() {
    super.initState();
    _mobName = widget.mobName;
    if (widget.via == ExplainerVia.invite && _mobName == null && widget.code.isNotEmpty) _lookupName();
  }

  Future<void> _lookupName() async {
    try {
      final p = await ref.read(mobV3ApiProvider).joinPreview(widget.code);
      if (mounted && p.valid && p.name.trim().isNotEmpty) setState(() => _mobName = p.name);
    } on Object {
      // The key says "Join this Mob".
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (widget.autoplay) clocks[index].forward(from: 0);
    if (index >= _last) ref.read(explainerSeenProvider).mark();
  }

  @override
  void dispose() {
    for (final c in clocks) {
      c.dispose();
    }
    _track.dispose();
    _fade.dispose();
    _final.dispose();
    _focus.dispose();
    super.dispose();
  }

  // ---- moving between slides ----

  /// Goes to slide [i]: the outgoing slide lands its end state, the incoming one plays from its start.
  void goTo(int i) {
    i = i.clamp(0, _last);
    if (i == index) {
      _snapBack();
      return;
    }
    final prev = index;
    clocks[prev]
      ..stop()
      ..value = 1;
    setState(() => index = i);
    hapticsOf(context)?.selection();
    if (_reduced) {
      _track.value = i.toDouble();
      _fade.forward(from: 0);
    } else {
      _track.animateTo(i.toDouble(), duration: MotionDurations.emphasized, curve: MotionCurves.emphasized);
    }
    if (_incoming == i && clocks[i].isAnimating) {
      // It started as the drag began; let it run on.
    } else if (widget.autoplay) {
      clocks[i].forward(from: 0);
    }
    _incoming = null;
    if (ExplainerFlow.marksSeenOn(i)) {
      ref.read(explainerSeenProvider).mark();
      _final.forward();
    } else {
      _final.reverse();
    }
  }

  void next() => index < _last ? goTo(index + 1) : null;
  void back() => index > 0 ? goTo(index - 1) : null;

  void _snapBack() {
    if (_reduced) {
      _track.value = index.toDouble();
      return;
    }
    _track.animateTo(index.toDouble(), duration: MotionDurations.card + const Duration(milliseconds: 60), curve: MotionCurves.out);
  }

  void _onDragStart(DragStartDetails d) {
    _track.stop();
    _dragDx = 0;
    _dragging = true;
  }

  void _onDragUpdate(DragUpdateDetails d, double width) {
    _dragDx += d.delta.dx;
    if (_reduced) return;
    var o = _dragDx;
    if ((index == 0 && o > 0) || (index == _last && o < 0)) o /= 3;
    _track.value = index - o / width;
    final toward = o < 0 ? index + 1 : index - 1;
    if (toward >= 0 && toward <= _last && _incoming != toward && o.abs() > 8) {
      // The incoming slide builds as the track starts moving.
      _incoming = toward;
      if (widget.autoplay) clocks[toward].forward(from: 0);
    }
  }

  void _onDragEnd(DragEndDetails d) {
    _dragging = false;
    final v = d.velocity.pixelsPerSecond.dx / 1000; // dp per ms
    final dx = _dragDx;
    if ((dx < -70 || (dx < -20 && -v > 0.45)) && index < _last) {
      goTo(index + 1);
    } else if ((dx > 70 || (dx > 20 && v > 0.45)) && index > 0) {
      goTo(index - 1);
    } else {
      _snapBack();
    }
  }

  void _onTapUp(TapUpDetails d, double width) {
    if (_dragging) return;
    if (d.localPosition.dx < width / 3) {
      back();
    } else {
      next();
    }
  }

  KeyEventResult _onKey(FocusNode node, KeyEvent e) {
    if (e is! KeyDownEvent) return KeyEventResult.ignored;
    if (e.logicalKey == LogicalKeyboardKey.arrowRight) {
      next();
      return KeyEventResult.handled;
    }
    if (e.logicalKey == LogicalKeyboardKey.arrowLeft) {
      back();
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  // ---- leaving ----

  Future<void> _skip() async {
    await ref.read(explainerSeenProvider).mark();
    _leave(ExplainerFlow.skipTo(widget.via));
  }

  void _leave(ExplainerExit exit) {
    if (_left || !mounted) return;
    _left = true;
    ref.read(explainerSeenProvider).mark();
    final cb = widget.onExit;
    if (cb != null) {
      cb(exit);
      return;
    }
    final nav = Navigator.of(context);
    switch (exit) {
      case ExplainerExit.setup:
        nav.pushReplacement(
          MaterialPageRoute<void>(
            builder: (_) => const MobSetupScreen(),
            settings: const RouteSettings(name: '/mob/start'),
          ),
        );
      case ExplainerExit.join:
        nav.pushReplacement(
          MaterialPageRoute<void>(
            builder: (_) => JoinV3Screen(code: widget.code),
            settings: const RouteSettings(name: '/join'),
          ),
        );
      case ExplainerExit.den:
        nav.maybePop();
    }
  }

  // ---- layout ----

  static const double _top = 56;
  static const double _bottom = 100;
  static const double _bottomFinal = 172;
  static const double _gap = 14;

  double _textNeed(BuildContext context, int i, double width, bool billingOn) {
    final type = context.mmType;
    final scaler = MediaQuery.textScalerOf(context);
    double h(String text, TextStyle style, double w) {
      final p = TextPainter(
        text: TextSpan(text: text, style: style),
        textDirection: TextDirection.ltr,
        textScaler: scaler,
      )..layout(maxWidth: w);
      final out = p.height;
      p.dispose();
      return out;
    }

    final w = width - 40;
    var need = h(MobExplainerCopy.titles[i], type.headline, w) + 10 + h(MobExplainerCopy.body(i, billingOn: billingOn), type.body, w);
    if (i == 2) need += 14 + 20 + h('${MobExplainerCopy.everyWeekLead}${MobExplainerCopy.everyWeek}', type.caption.copyWith(fontSize: 13.5), w - 26);
    return need + 18;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final billingOn = ref.watch(explainerBillingOnProvider);
    final keys = ExplainerFlow.endKeys(widget.via, mobName: _mobName);
    return Scaffold(
      backgroundColor: c.ground,
      body: MobIdleScope(
        child: Focus(
          focusNode: _focus,
          autofocus: true,
          onKeyEvent: _onKey,
          child: SafeArea(
            child: LayoutBuilder(
              builder: (context, box) {
                final width = math.min(box.maxWidth, 520.0);
                final height = box.maxHeight;
                final natural = width * ExStage.h / ExStage.w;
                // Each slide's stage takes the room its own words leave (full width when they fit), so a
                // long slide never shrinks the others.
                final stageH = [
                  for (var i = 0; i < ExplainerFlow.slides; i++)
                    (height - _top - (i == _last ? _bottomFinal : _bottom) - _gap - _textNeed(context, i, width, billingOn)).clamp(math.min(150.0, natural), natural).toDouble(),
                ];
                return Center(
                  child: SizedBox(
                    width: width,
                    height: height,
                    child: Semantics(
                      container: true,
                      label: MobExplainerCopy.regionLabel,
                      explicitChildNodes: true,
                      child: Stack(
                        children: [
                          Positioned(left: 0, right: 0, top: _top, bottom: 0, child: _trackView(context, width, stageH, billingOn)),
                          Positioned(left: 0, right: 0, top: 0, height: _top, child: _topBar(context)),
                          Positioned(left: 0, right: 0, bottom: 0, height: _bottomFinal, child: _bottomBar(context, keys)),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  Widget _topBar(BuildContext context) {
    return Padding(
      // The pill keeps the same 20 dp gutter as the wordmark and the slides (v16 walk I-06b: it sat 8 dp from the edge).
      padding: const EdgeInsets.only(left: MmSpace.s20, right: MmSpace.s20),
      child: Row(
        children: [
          const ExcludeSemantics(child: Wordmark(height: 22)),
          const Spacer(),
          // Skip on slides 1 to 6; slide 7 has its keys.
          Visibility(
            visible: ExplainerFlow.skipVisible(index),
            maintainSize: true,
            maintainAnimation: true,
            maintainState: true,
            child: SkipPill(key: const ValueKey('ex-skip'), onTap: _skip),
          ),
        ],
      ),
    );
  }

  Widget _trackView(BuildContext context, double width, List<double> stageH, bool billingOn) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onHorizontalDragStart: _onDragStart,
      onHorizontalDragUpdate: (d) => _onDragUpdate(d, width),
      onHorizontalDragEnd: _onDragEnd,
      onTapUp: (d) => _onTapUp(d, width),
      child: ClipRect(
        child: AnimatedBuilder(
          animation: Listenable.merge([_track, _fade]),
          builder: (context, _) {
            final pos = _track.value;
            final lo = pos.floor().clamp(0, _last);
            final hi = pos.ceil().clamp(0, _last);
            return Stack(
              children: [
                for (final i in {lo, hi, index})
                  if ((i - pos).abs() < 1.0001)
                    Positioned(
                      left: (i - pos) * width,
                      top: 0,
                      bottom: 0,
                      width: width,
                      child: Opacity(opacity: i == index ? _fade.value : 1, child: _slide(context, i, width, stageH[i], billingOn)),
                    ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _slide(BuildContext context, int i, double width, double stageH, bool billingOn) {
    final type = context.mmType;
    final c = context.mmColors;
    final reduced = _reduced;
    final current = i == index;
    return ExcludeSemantics(
      excluding: !current,
      child: AnimatedBuilder(
        animation: clocks[i],
        builder: (context, _) {
          final t = ExTime(clocks[i].value * ExSlides.lengthMs[i], reduced: reduced);
          final (to, tdy) = t.rise(140);
          final (bo, bdy) = t.rise(220);
          final (co, cdy) = t.rise(320);
          final title = MobExplainerCopy.titles[i];
          final body = MobExplainerCopy.body(i, billingOn: billingOn);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: stageH,
                child: ExcludeSemantics(
                  child: FittedBox(
                    fit: BoxFit.contain,
                    child: SizedBox(
                      width: ExStage.w,
                      height: ExStage.h,
                      child: MediaQuery.withNoTextScaling(
                        child: ExSlides.stage(context, i, t, ExFx.of(context, billingOn: billingOn, now: ref.read(nowProvider)())),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: _gap),
              // The words always fit: on a small phone with large text the stage gives way first, and
              // past its smallest size the words scroll above the keys.
              Expanded(
                child: SingleChildScrollView(
                  physics: const ClampingScrollPhysics(),
                  padding: EdgeInsets.fromLTRB(MmSpace.s20, 0, MmSpace.s20, i == _last ? _bottomFinal : _bottom),
                  child: Semantics(
                  liveRegion: current,
                  label: current ? MobExplainerCopy.slideLive(i, title, body) : MobExplainerCopy.slideLabel(i, title),
                  excludeSemantics: true,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Opacity(
                        opacity: to,
                        child: Transform.translate(
                          offset: Offset(0, tdy),
                          child: Text(
                            title,
                            key: ValueKey('ex-title-$i'),
                            style: type.headline.copyWith(color: c.ink),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Opacity(
                        opacity: bo,
                        child: Transform.translate(
                          offset: Offset(0, bdy),
                          child: Text(
                            body,
                            key: ValueKey('ex-body-$i'),
                            style: type.body.copyWith(color: c.ink2),
                          ),
                        ),
                      ),
                      if (i == 2)
                        Opacity(
                          opacity: co,
                          child: Transform.translate(
                            offset: Offset(0, cdy),
                            child: const Padding(padding: EdgeInsets.only(top: 14), child: _EveryWeek()),
                          ),
                        ),
                    ],
                  ),
                ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _bottomBar(BuildContext context, List<ExplainerKey> keys) {
    final c = context.mmColors;
    return AnimatedBuilder(
      animation: _final,
      builder: (context, _) {
        final f = _reduced ? (_final.value >= 0.5 ? 1.0 : 0.0) : _final.value;
        final keysT = MotionCurves.emphasized.transform(((f - 0.18) / 0.82).clamp(0.0, 1.0));
        final dotsCentre = MotionCurves.emphasized.transform(f);
        return Stack(
          children: [
            // The dots: position only, never progress (T002). They move up and to the centre on slide 7.
            Positioned(
              left: 0,
              right: 0,
              bottom: lerpDouble(44, 152, dotsCentre),
              height: 6,
              child: Align(
                alignment: Alignment.lerp(const Alignment(-1, 0), Alignment.center, dotsCentre)!,
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: lerpDouble(24, 0, dotsCentre)),
                  child: ExcludeSemantics(
                    child: _Dots(index: index, colour: c.ink, quiet: c.ink4),
                  ),
                ),
              ),
            ),
            // Next, slides 1 to 6.
            if (f < 1)
              Positioned(
                right: MmSpace.s20,
                bottom: 24,
                child: IgnorePointer(
                  ignoring: f > 0.5,
                  child: Opacity(
                    opacity: (1 - f * 2).clamp(0.0, 1.0),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minWidth: 116),
                      child: KeyButton.secondary(key: const ValueKey('ex-next'), label: MobExplainerCopy.next, hapticOnCommit: false, expanded: false, onPressed: f > 0.5 ? null : next),
                    ),
                  ),
                ),
              ),
            // Slide 7: the end keys rise 12 dp (360, 80 delay). Built only when they show (no hidden keys
            // for a screen reader).
            if (f > 0)
              Positioned(
                left: MmSpace.s20,
                right: MmSpace.s20,
                bottom: 28,
                child: IgnorePointer(
                  ignoring: f < 0.5,
                  child: Opacity(
                    opacity: keysT,
                    child: Transform.translate(
                      offset: Offset(0, (1 - keysT) * 12),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (var k = 0; k < keys.length; k++) ...[
                            if (k > 0) const SizedBox(height: MmSpace.s8),
                            keys[k].primary
                                ? KeyButton(key: ValueKey('ex-end-$k'), label: keys[k].label, onPressed: f < 0.5 ? null : () => _leave(keys[k].exit))
                                : KeyButton.secondary(key: ValueKey('ex-end-$k'), label: keys[k].label, onPressed: f < 0.5 ? null : () => _leave(keys[k].exit)),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

double lerpDouble(double a, double b, double t) => a + (b - a) * t;

class _Dots extends StatelessWidget {
  const _Dots({required this.index, required this.colour, required this.quiet});
  final int index;
  final Color colour;
  final Color quiet;

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < ExplainerFlow.slides; i++) ...[
          if (i > 0) const SizedBox(width: 6),
          AnimatedContainer(
            duration: reduced ? Duration.zero : MotionDurations.card,
            curve: MotionCurves.emphasized,
            width: i == index ? 20 : 6,
            height: 6,
            decoration: BoxDecoration(color: i == index ? colour : quiet, borderRadius: BorderRadius.circular(3)),
          ),
        ],
      ],
    );
  }
}

/// "Every week. The Mob paper ... and Mob hours ..." in a dashed paper box (K9: every way to play, nothing that
/// is not in the build).
class _EveryWeek extends StatelessWidget {
  const _EveryWeek();

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return CustomPaint(
      painter: _DashedBox(colour: c.ink4),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        child: Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: MobExplainerCopy.everyWeekLead,
                style: TextStyle(color: c.ink, fontWeight: FontWeight.w600),
              ),
              const TextSpan(text: MobExplainerCopy.everyWeek),
            ],
          ),
          key: const ValueKey('ex-every-week'),
          style: type.caption.copyWith(fontSize: 13.5, color: c.ink2),
        ),
      ),
    );
  }
}

class _DashedBox extends CustomPainter {
  _DashedBox({required this.colour});
  final Color colour;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()..addRRect(RRect.fromRectAndRadius((Offset.zero & size).deflate(0.5), const Radius.circular(12)));
    final p = Paint()
      ..color = colour
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (final m in path.computeMetrics()) {
      for (var d = 0.0; d < m.length; d += 7) {
        canvas.drawPath(m.extractPath(d, math.min(d + 4, m.length)), p);
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBox old) => old.colour != colour;
}

/// `/join/<code>`, a friend's invite link: the explainer first for a student who is in no Mob yet and
/// has not seen it on this phone (slide 7 leads with joining this Mob), then the code screen with the
/// code filled. Everyone else goes straight to the code screen.
class MobJoinGate extends ConsumerStatefulWidget {
  const MobJoinGate({super.key, required this.code});
  final String code;

  @override
  ConsumerState<MobJoinGate> createState() => _MobJoinGateState();
}

enum _GatePhase { checking, explainer, join, setup }

class _MobJoinGateState extends ConsumerState<MobJoinGate> {
  _GatePhase _phase = _GatePhase.checking;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    final seen = await ref.read(explainerSeenProvider).read();
    final inMob = ref.read(mobRepositoryProvider).value?.mob != null;
    final explainer = !seen && !inMob;
    // An invite that opens the explainer stands in for the Mob welcome too (V16 A3): it never plays after it.
    if (explainer) await ref.read(mobWelcomeSeenProvider).mark();
    if (mounted) setState(() => _phase = explainer ? _GatePhase.explainer : _GatePhase.join);
  }

  @override
  Widget build(BuildContext context) => switch (_phase) {
    _GatePhase.checking => Scaffold(backgroundColor: context.mmColors.ground),
    _GatePhase.explainer => MobExplainerScreen(via: ExplainerVia.invite, code: widget.code, onExit: (e) => setState(() => _phase = e == ExplainerExit.setup ? _GatePhase.setup : _GatePhase.join)),
    _GatePhase.join => JoinV3Screen(code: widget.code),
    _GatePhase.setup => const MobSetupScreen(),
  };
}
