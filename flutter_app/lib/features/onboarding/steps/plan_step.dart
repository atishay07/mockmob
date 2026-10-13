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
import '../copy.dart';
import '../model/answers.dart';
import '../model/deck.dart';
import '../model/plan.dart';
import '../state/answers_controller.dart';
import '../widgets/answer_sheet_card.dart';
import '../widgets/hold_to_seal.dart';
import '../widgets/plan_sheet.dart';

/// Step 9, the climax: the sheet flips over (600 ms, a light tap at the halfway point) and its
/// back is the plan, engraved line by line, including what the student did not tell us (the
/// first chapter in MockMob's order, and the board-season taper for Class 12). Holding seals it
/// (1.2 s, a firm tap when it lands); "Seal it" beside the hold seals at once, and so does
/// TalkBack's double tap on the hold.
class PlanStep extends ConsumerStatefulWidget {
  const PlanStep({super.key, required this.answers, required this.onNext, required this.onChange, this.flipped = false});

  final OnboardingAnswers answers;
  final VoidCallback onNext;

  /// Opens a step to change ("Change something").
  final ValueChanged<String> onChange;

  /// Starts on the plan side (a return to this step, goldens).
  final bool flipped;

  @override
  ConsumerState<PlanStep> createState() => _PlanStepState();
}

class _PlanStepState extends ConsumerState<PlanStep> with TickerProviderStateMixin {
  late final AnimationController _flip = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
  late final AnimationController _hold = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));
  bool _ticked = false;
  bool _halfTicked = false;

  /// More of the sheet lies below the scroll area's foot (drives the fade above the key).
  final ValueNotifier<bool> _moreBelow = ValueNotifier<bool>(true);

  /// Under this much room the sheet tightens (small phones).
  static const double _compactBelow = 640;

  @override
  void initState() {
    super.initState();
    _flip.addListener(_flipHaptic);
    _hold.addStatusListener((s) {
      if (s == AnimationStatus.completed) _seal();
    });
    _hold.addListener(() {
      if (!_halfTicked && _hold.value >= 0.5) {
        _halfTicked = true;
        ref.read(hapticsProvider).selection();
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_flip.value > 0 || _flip.isAnimating) return;
    if (widget.flipped || widget.answers.sealed) {
      _flip.value = 1;
    } else {
      _flip.duration = Motion.reduced(context) ? Motion.crossFade : const Duration(milliseconds: 600);
      _flip.forward();
    }
  }

  void _flipHaptic() {
    if (!_ticked && _flip.value >= 0.5) {
      _ticked = true;
      ref.read(hapticsProvider).light();
    }
  }

  void _seal() {
    if (widget.answers.sealed) return;
    ref.read(hapticsProvider).medium();
    ref.read(onboardingAnswersProvider.notifier).seal();
    _hold.value = 1;
  }

  @override
  void dispose() {
    _flip.dispose();
    _hold.dispose();
    _moreBelow.dispose();
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

    Widget card(bool compact) => AnimatedBuilder(
      animation: _flip,
      builder: (context, _) {
        final t = Motion.emphasized.transform(_flip.value);
        final back = t >= 0.5;
        if (reduced) {
          return back
              ? PlanSheet(plan: plan, seal: _hold, sealed: sealed, from: from, lead: lead, revealed: _flip.isCompleted, compact: compact)
              : AnswerSheetCard(answers: widget.answers, now: now, compact: true, animate: false);
        }
        final angle = t * math.pi;
        return Transform(
          alignment: Alignment.center,
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.0012)
            ..rotateY(back ? angle - math.pi : angle),
          child: back
              ? PlanSheet(plan: plan, seal: _hold, sealed: sealed, from: from, lead: lead, revealed: _flip.isCompleted, compact: compact)
              : AnswerSheetCard(answers: widget.answers, now: now, compact: true, animate: false),
        );
      },
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          // A short window (a small phone, or the hold row taking its room) tightens the sheet so
          // it fits; if it still runs long, it scrolls, and a fade at the foot says so.
          child: LayoutBuilder(
            builder: (context, box) {
              final compact = box.maxHeight < _compactBelow;
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
                          padding: EdgeInsets.only(top: compact ? MmSpace.s12 : MmSpace.s32, bottom: MmSpace.s16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [card(compact)],
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
                    // Two ways in one row: hold the pill (the ceremony), or tap Seal it for
                    // anyone who cannot hold steadily. TalkBack's double tap on the pill seals too.
                    Row(
                      children: [
                        Expanded(
                          child: HoldToSeal(
                            progress: _hold,
                            onHoldStart: () => _hold.forward(),
                            onHoldEnd: () {
                              if (!_hold.isCompleted) _hold.animateBack(0, duration: const Duration(milliseconds: 220));
                              _halfTicked = false;
                            },
                            onSeal: _seal,
                          ),
                        ),
                        const SizedBox(width: MmSpace.s8),
                        Expanded(
                          child: KeyButton.secondary(
                            label: OnboardingCopy.sealIt,
                            onPressed: _seal,
                            minHeight: MmTarget.primaryKey,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: MmSpace.s4),
                    Center(child: KeyButton.quiet(label: OnboardingCopy.changeSomething, onPressed: _change)),
                  ],
                ),
        ),
      ],
    );
  }
}
