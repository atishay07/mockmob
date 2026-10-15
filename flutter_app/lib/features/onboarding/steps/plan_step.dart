import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/copy/formatters.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/data/rhythm_prefs.dart' show CelebrationMode, celebrationModeProvider;
import '../copy.dart';
import '../model/answers.dart';
import '../model/deck.dart';
import '../model/plan.dart';
import '../state/answers_controller.dart';
import '../widgets/answer_sheet_card.dart';
import '../widgets/hold_to_seal.dart';
import '../widgets/plan_seal_moment.dart';
import '../widgets/plan_sheet.dart';

/// Step 9, the climax: the sheet flips over (640 ms, a light tap at the halfway point) and its
/// back is the plan, engraved line by line, including what the student did not tell us (the
/// first chapter in MockMob's order, and the board-season taper for Class 12). Holding seals it
/// (1.2 s, a firm tap when it lands); the hint line under the hold ("or tap here to seal") seals at
/// once, and so does TalkBack's double tap on the hold.
///
/// The seal is the onboarding's one T3 moment (MOTION.md 1.2) and reads the Celebrations
/// setting: Full stamps the seal with one ring wave and a firm tap, and Mobi celebrates after it
/// lands; Quiet stamps it with no wave and a selection tick; Off just shows the seal and says so.
class PlanStep extends ConsumerStatefulWidget {
  const PlanStep({super.key, required this.answers, required this.onNext, required this.onChange, this.flipped = false, this.moment, this.mobi});

  final OnboardingAnswers answers;
  final VoidCallback onNext;

  /// Opens a step to change ("Change something").
  final ValueChanged<String> onChange;

  /// Starts on the plan side (a return to this step, goldens).
  final bool flipped;

  /// The full-screen seal moment the flow draws behind the deck. Given, holding brings the
  /// painted answer sheet up behind the card and presses the volt seal into its impression;
  /// without it (a plan step on its own) the seal stamps on the card's corner as before.
  final PlanSealMoment? moment;

  /// On the hint line under the hold, whose tap seals at once.
  static const Key tapToSealKey = ValueKey('plan-tap-to-seal');

  /// The guide Mobi of the flow's top bar. Given, he follows the hold: he looks at the seal when
  /// it starts, braces as it charges (at each third), breathes out with "Still yours to seal."
  /// when it is let go early, and nods when it strikes under Quiet. The full celebration at the
  /// stamp is the flow's own. Never an obstacle: the hold works the same without him.
  final MobiController? mobi;

  @override
  ConsumerState<PlanStep> createState() => _PlanStepState();
}

class _PlanStepState extends ConsumerState<PlanStep> with TickerProviderStateMixin {
  late final AnimationController _flip = AnimationController(vsync: this, duration: _flipTime);
  late final AnimationController _hold = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));

  /// The seal landing: the foil drops in with a ring wave and the sheet rebounds (420 ms).
  late final AnimationController _stamp = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));

  /// The foil flecks thrown once from the seal's rim on a Full strike (760 ms).
  late final AnimationController _burst = AnimationController(vsync: this, duration: const Duration(milliseconds: 760));

  /// The moment plays only for a sheet sealed on this visit; a sealed plan seen again is the card.
  late final bool _momentOn = widget.moment != null && !widget.answers.sealed;

  /// The seal has struck the sheet (the answers are sealed from here).
  bool _landed = false;
  bool _ticked = false;

  /// The thirds of the hold Mobi has braced for, and the quarters already ticked (a selection tick
  /// at each quarter of the hold).
  int _thirds = 0;
  int _quarters = 0;
  Timer? _hush;
  final GlobalKey _holdKey = GlobalKey();

  static const Duration _flipTime = Duration(milliseconds: 640);

  /// More of the sheet lies below the scroll area's foot (drives the fade above the key).
  final ValueNotifier<bool> _moreBelow = ValueNotifier<bool>(true);

  /// Under this much room the sheet tightens (small phones).
  static const double _compactBelow = 640;

  /// Every plan line is shown ("See all 6"), not just the three that lead.
  bool _allLines = false;

  @override
  void initState() {
    super.initState();
    _flip.addListener(_flipHaptic);
    _hold.addStatusListener((s) {
      if (s == AnimationStatus.completed) _seal();
    });
    if (_momentOn) {
      _hold.addListener(_sync);
      _stamp.addListener(_sync);
      _burst.addListener(_sync);
    }
    _hold.addListener(() {
      if (_hold.status != AnimationStatus.forward || _struck) return;
      // A selection tick at each quarter of the hold: the finger counts the seal coming down.
      final quarter = (_hold.value * 4).floor().clamp(0, 3);
      if (quarter > _quarters) {
        _quarters = quarter;
        ref.read(hapticsProvider).selection();
      }
      // Mobi braces as the thirds pass.
      final third = (_hold.value * 3).floor().clamp(0, 2);
      if (third > _thirds) {
        _thirds = third;
        widget.mobi?.react(MobiAct.brace);
      }
    });
    _flip.addStatusListener((s) {
      if (s == AnimationStatus.completed) _printTicks();
    });
  }

  /// Writes the hold, the strike and the flecks into the flow's seal moment.
  void _sync() {
    final h = _hold.value;
    widget.moment?.set(
      // The room comes up over the first 30% of the hold, so a quick touch that lets go only
      // dims the card; once struck it stays.
      reveal: _landed ? 1 : Curves.easeOut.transform((h / 0.3).clamp(0.0, 1.0)),
      press: ((h - 0.12) / 0.88).clamp(0.0, 1.0),
      land: _landed ? math.max(_stamp.value, 0.0001) : 0,
      burst: _burst.value,
    );
  }

  bool _precached = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // The painted sheet is decoded while the student reads the plan, so the hold never waits on
    // it (and nothing decodes while the seal moves).
    if (_momentOn && !_precached && context.mmColors.isNight) {
      _precached = true;
      final screen = MediaQuery.sizeOf(context);
      SceneArt.planSeal.precache(context, SealGeometry.of(screen).image.width);
    }
    if (_flip.value > 0 || _flip.isAnimating) return;
    if (widget.flipped || widget.answers.sealed) {
      _flip.value = 1;
      _stamp.value = 1;
    } else {
      _flip.duration = Motion.reduced(context) ? Motion.crossFade : _flipTime;
      _flip.forward();
    }
  }

  void _flipHaptic() {
    if (!_ticked && _flip.value >= 0.5) {
      _ticked = true;
      ref.read(hapticsProvider).light();
    }
  }

  /// At most this many print ticks, however long the plan (MOTION.md 4.2).
  static const int maxPrintTicks = 6;

  /// A selection tick as each plan row prints (the rows print 160 ms apart after the flip).
  Future<void> _printTicks() async {
    if (Motion.reduced(context)) return;
    final count = PlanSummary.of(widget.answers, ref.read(nowProvider)()).lines.length;
    final rows = math.min(maxPrintTicks, PlanSheet.shownLines(count, all: _allLines).length);
    for (var i = 0; i < rows; i++) {
      if (!mounted) return;
      ref.read(hapticsProvider).selection();
      await Future<void>.delayed(PlanSheet.stagger);
    }
  }

  /// Mobi looks at the seal while it is held: the one on the sheet in the moment, else the pill.
  void _watchSeal() {
    final mobi = widget.mobi;
    if (mobi == null) return;
    if (_momentOn) {
      mobi.lookAt(SealGeometry.of(MediaQuery.sizeOf(context)).centre);
    } else {
      mobi.lookAtWidget(_holdKey);
    }
  }

  /// The hold was let go before the seal struck: he breathes out and says the plan is still
  /// the student's to seal. A touch that barely started says nothing.
  void _released(double held) {
    final mobi = widget.mobi;
    if (mobi == null) return;
    mobi.lookAt(null);
    if (held < 0.08 || held >= 1) return;
    mobi.react(MobiAct.relief);
    mobi.say(OnboardingCopy.mobiStillYours);
    _hush?.cancel();
    _hush = Timer(Duration(milliseconds: (MobiTyping.duration(OnboardingCopy.mobiStillYours) * 1000).round() + 2200), mobi.hush);
  }

  /// The seal has been struck: setting the hold to full below completes it, which asks to seal
  /// again before the sheet's new state has reached this widget.
  bool _struck = false;

  void _seal() {
    if (widget.answers.sealed || _struck) return;
    _struck = true;
    // A tap (or TalkBack's double tap) seals too: in the moment the seal still comes down onto
    // the sheet, quickly (180 ms: a tap is a decided seal), and then strikes.
    if (_momentOn && _hold.value < 1 && !Motion.reduced(context)) {
      _hold.animateTo(1, duration: const Duration(milliseconds: 180), curve: Motion.out).whenCompleteOrCancel(() {
        if (mounted) _strike();
      });
      return;
    }
    _strike();
  }

  /// The seal lands: the one T3 impact of onboarding (MOTION.md 1.2), read against the
  /// Celebrations setting. Full: a firm tap, the strike and the foil flecks; Quiet: a selection
  /// tick and the strike, no flecks; Off: the seal is simply there.
  void _strike() {
    if (_landed) return;
    _landed = true;
    final mode = ref.read(celebrationModeProvider);
    final reduced = Motion.reduced(context);
    switch (mode) {
      case CelebrationMode.full:
        ref.read(hapticsProvider).medium();
      case CelebrationMode.quiet:
        ref.read(hapticsProvider).selection();
      case CelebrationMode.off:
        break;
    }
    ref.read(onboardingAnswersProvider.notifier).seal();
    _hold.value = 1;
    if (reduced || mode == CelebrationMode.off) {
      _stamp.value = 1;
    } else {
      _stamp.forward(from: 0);
    }
    if (_momentOn && mode == CelebrationMode.full && !reduced) {
      _burst.forward(from: 0);
      // The afterglow's ring leaves the rim with the strike; the lamp surge and the sheet settle
      // follow the stamp itself (Quiet gets those two, Off and reduced motion none).
      widget.moment?.set(ring: true);
    }
    // He stops watching the seal. Quiet answers with a nod; the Full celebration is the flow's,
    // timed to this stamp; Off keeps him still.
    widget.mobi?.lookAt(null);
    if (mode == CelebrationMode.quiet) widget.mobi?.react(MobiMoments.act(MobiEvent.saveConfirmed));
    _sync();
  }

  @override
  void dispose() {
    _hush?.cancel();
    _flip.dispose();
    _hold.dispose();
    _stamp.dispose();
    _burst.dispose();
    _moreBelow.dispose();
    // The flow outlives this step: leave its room dark for the next visit (silently: the tree is
    // locked while this step is torn down, and the room fades out with the step anyway).
    widget.moment?.clear();
    super.dispose();
  }

  Future<void> _change() async {
    const choices = [
      (Steps.stage, 'Where you are'),
      (Steps.course, 'Course and colleges'),
      (Steps.subjects, 'Subjects'),
      (Steps.worry, 'Where the marks go'),
      (Steps.rhythm, 'Pace'),
    ];
    final picked = await showMmSheet<String>(
      context: context,
      title: OnboardingCopy.changeTitle,
      builder: (context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final (id, label) in choices) ...[
            MmSelectRow(
              title: label,
              selected: false,
              trailing: Icon(LucideIcons.pencil, size: 16, color: context.mmColors.ink3),
              onTap: () => Navigator.of(context).pop(id),
            ),
            const SizedBox(height: MmSpace.s8),
          ],
        ],
      ),
    );
    if (picked != null) widget.onChange(picked);
  }

  @override
  Widget build(BuildContext context) {
    final now = ref.watch(nowProvider)();
    final plan = PlanSummary.of(widget.answers, now);
    final sealed = widget.answers.sealed;
    final reduced = Motion.reduced(context);
    final from = formatWeekdayDate(widget.answers.sealedAt ?? now);
    final lead = PlanSummary.usesDefaults(widget.answers) ? OnboardingCopy.planLeadDefaults : OnboardingCopy.planLead;

    Widget planSheet(bool compact) => PlanSheet(
          plan: plan,
          seal: _hold,
          sealed: sealed,
          from: from,
          lead: lead,
          revealed: _flip.isCompleted,
          compact: compact,
          stamp: _stamp,
          // In the seal moment the flecks are the one light event; the card is out of sight.
          wave: ref.watch(celebrationModeProvider) == CelebrationMode.full && !_momentOn,
          allLines: _allLines,
          onAllLines: () => setState(() => _allLines = !_allLines),
          onChange: sealed ? null : _change,
        );

    // The sheet sinks a little under the finger while the seal charges, and rebounds as the seal
    // lands (0.97 and back on the stamp), so the hold has weight.
    Widget weighted(Widget child) => AnimatedBuilder(
          animation: Listenable.merge([_hold, _stamp]),
          child: child,
          builder: (context, child) {
            if (reduced) return child!;
            final charging = _stamp.value == 0 ? 0.015 * _hold.value : 0.0;
            final s = _stamp.value;
            final rebound = s > 0 && s < 1 ? 0.03 * math.sin(math.pi * s) * (1 - s) : 0.0;
            final scale = 1 - charging - rebound;
            return scale == 1 ? child! : Transform.scale(scale: scale, child: child);
          },
        );

    Widget card(bool compact) => AnimatedBuilder(
      animation: _flip,
      builder: (context, _) {
        final t = Motion.emphasized.transform(_flip.value);
        final back = t >= 0.5;
        if (reduced) {
          return back ? planSheet(compact) : AnswerSheetCard(answers: widget.answers, now: now, compact: true, animate: false);
        }
        final angle = t * math.pi;
        // A slight lift at the middle of the turn, so the sheet reads as picked up and turned over.
        final lift = 1 + 0.04 * math.sin(t * math.pi);
        return Transform(
          alignment: Alignment.center,
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.0012)
            ..scaleByDouble(lift, lift, 1, 1)
            ..rotateY(back ? angle - math.pi : angle),
          child: back ? weighted(planSheet(compact)) : AnswerSheetCard(answers: widget.answers, now: now, compact: true, animate: false),
        );
      },
    );

    // In the seal moment the card gives way as the hold starts: it fades, lifts 18 dp and steps
    // back 5% while the painted sheet comes up behind it, and comes back if the hold lets go.
    // The tree is the same at every value, so the card keeps its state.
    Widget giveWay(Widget child) {
      final m = widget.moment;
      if (!_momentOn || m == null) return child;
      return ListenableBuilder(
        listenable: m,
        child: child,
        builder: (context, child) {
          final r = m.reveal.clamp(0.0, 1.0);
          final gone = r >= 1;
          return IgnorePointer(
            ignoring: gone,
            child: ExcludeSemantics(
              excluding: gone,
              child: Opacity(
                opacity: 1 - r,
                child: Transform.translate(
                  offset: Offset(0, reduced ? 0 : -18 * r),
                  child: Transform.scale(scale: reduced ? 1 : 1 - 0.05 * r, child: child),
                ),
              ),
            ),
          );
        },
      );
    }

    // Once struck, the words of the moment rise in the quiet ground under the seal as it
    // settles (the second half of the strike).
    final type = context.mmType;
    final momentWords = _momentOn && sealed
        ? AnimatedBuilder(
            animation: _stamp,
            builder: (context, child) {
              final t = Curves.easeOut.transform(((_stamp.value - 0.45) / 0.55).clamp(0.0, 1.0));
              return Opacity(opacity: t, child: Transform.translate(offset: Offset(0, reduced ? 0 : 8 * (1 - t)), child: child));
            },
            child: Semantics(
              container: true,
              liveRegion: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Semantics(
                    header: true,
                    child: Text(
                      OnboardingCopy.planSet,
                      style: type.moment,
                      textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3),
                    ),
                  ),
                  const SizedBox(height: MmSpace.s8),
                  Text(OnboardingCopy.sharpens, style: type.body.copyWith(color: context.mmColors.ink2)),
                ],
              ),
            ),
          )
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          // A short window (a small phone, or the hold row taking its room) tightens the sheet so
          // it fits; if it still runs long, it scrolls, and a fade at the foot says so.
          child: LayoutBuilder(
            builder: (context, box) {
              final compact = box.maxHeight < _compactBelow;
              final top = compact ? MmSpace.s12 : MmSpace.s24;
              return NotificationListener<ScrollMetricsNotification>(
                onNotification: (n) {
                  final more = n.metrics.extentAfter > 1;
                  if (more != _moreBelow.value) _moreBelow.value = more;
                  return false;
                },
                child: NotificationListener<ScrollNotification>(
                  onNotification: (n) {
                    final more = n.metrics.extentAfter > 1;
                    if (more != _moreBelow.value) _moreBelow.value = more;
                    return false;
                  },
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: SingleChildScrollView(
                          padding: EdgeInsets.only(top: top, bottom: MmSpace.s16),
                          // The sheet sits in the middle of the room it has, so a tall phone
                          // gets an even margin above and below it, not a gap under it only.
                          child: ConstrainedBox(
                            constraints: BoxConstraints(minHeight: math.max(0, box.maxHeight - top - MmSpace.s16)),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [giveWay(card(compact))],
                            ),
                          ),
                        ),
                      ),
                      // A short fade into the ground while there is more sheet below, so a card
                      // taller than the screen reads as scrolling, not cut off behind the key.
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: MmSpace.s32,
                        child: IgnorePointer(
                          child: ValueListenableBuilder<bool>(
                            valueListenable: _moreBelow,
                            builder: (context, more, child) => AnimatedOpacity(
                              opacity: more ? 1 : 0,
                              duration: Motion.reduced(context) ? Duration.zero : const Duration(milliseconds: 160),
                              child: child,
                            ),
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [context.mmColors.ground.withValues(alpha: 0), context.mmColors.ground],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      if (momentWords != null) Positioned(left: 0, right: 0, bottom: MmSpace.s24, child: momentWords),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        Padding(
          padding: EdgeInsets.only(top: MmSpace.s8, bottom: MediaQuery.paddingOf(context).bottom + MmSpace.s12),
          child: sealed
              ? KeyButton(label: OnboardingCopy.next, onPressed: widget.onNext)
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // One dominant control: hold the pill (the ceremony). Anyone who cannot hold
                    // steadily taps the link under it; TalkBack's double tap on the pill seals too.
                    HoldToSeal(
                      key: _holdKey,
                      progress: _hold,
                      onHoldStart: () {
                        if (_struck) return;
                        ref.read(hapticsProvider).selection();
                        _hold.forward();
                        _watchSeal();
                      },
                      onHoldEnd: () {
                        if (_struck) return;
                        final held = _hold.value;
                        if (!_hold.isCompleted) _hold.animateBack(0, duration: const Duration(milliseconds: 220));
                        _thirds = 0;
                        _quarters = 0;
                        _released(held);
                      },
                      onSeal: _seal,
                    ),
                    const SizedBox(height: MmSpace.s4),
                    // Not a second key: one hint line on how the hold works, and the whole line
                    // is the tap for anyone who cannot hold (design critic 20).
                    _SealHint(key: PlanStep.tapToSealKey, onTap: _seal),
                  ],
                ),
        ),
      ],
    );
  }
}

/// The line under Hold to seal: "Hold for a second, or tap here to seal." in the caption voice,
/// "tap here to seal" underlined. The whole line is one 48 dp target that seals at once (the way
/// for anyone who cannot hold); TalkBack reads it as the button "Tap to seal instead".
class _SealHint extends StatelessWidget {
  const _SealHint({super.key, required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    const hint = OnboardingCopy.sealHint;
    final cut = hint.indexOf('tap here');
    final base = type.caption.copyWith(color: colors.ink3);
    return MmPressable(
      semanticsLabel: OnboardingCopy.sealIt,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Center(
          child: Text.rich(
            TextSpan(
              style: base,
              children: cut < 0
                  ? [const TextSpan(text: hint)]
                  : [
                      TextSpan(text: hint.substring(0, cut)),
                      TextSpan(
                        text: hint.substring(cut),
                        style: base.copyWith(
                          color: pressed ? colors.ink : colors.ink2,
                          decoration: TextDecoration.underline,
                          decorationColor: colors.ink3,
                        ),
                      ),
                    ],
            ),
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
