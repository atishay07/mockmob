import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/subjects.dart';
import 'choice_tile.dart';

/// Shaky, Okay, Strong as one question on an answer sheet: three labelled bubbles, the chosen
/// one inked from the touch point. Each is a 48 dp target in a radio group; TalkBack reads
/// "How solid is Accountancy, Shaky, selected".
class ConfidenceBubbles extends ConsumerStatefulWidget {
  const ConfidenceBubbles({super.key, required this.subject, required this.value, required this.onChanged, this.pulse});

  final String subject;
  final Confidence value;
  final ValueChanged<Confidence> onChanged;

  /// The answer that pulses once (1.0 to 1.08 to 1.0 over 420 ms) when this turns on: the cue
  /// that the rating is the step's question. Still under reduced motion.
  final Confidence? pulse;

  /// The pulse's length.
  static const Duration pulseFor = Duration(milliseconds: 420);

  @override
  ConsumerState<ConfidenceBubbles> createState() => _ConfidenceBubblesState();
}

class _ConfidenceBubblesState extends ConsumerState<ConfidenceBubbles> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: ConfidenceBubbles.pulseFor);

  @override
  void initState() {
    super.initState();
    if (widget.pulse != null) WidgetsBinding.instance.addPostFrameCallback((_) => _play());
  }

  @override
  void didUpdateWidget(ConfidenceBubbles old) {
    super.didUpdateWidget(old);
    if (widget.pulse != null && old.pulse == null) _play();
  }

  void _play() {
    if (!mounted || Motion.reduced(context)) return;
    _pulse.forward(from: 0);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  /// 1.0 up to 1.08 by the middle, back to 1.0 at the end, eased both ways.
  double get _scale {
    final t = _pulse.value;
    final up = t < 0.5 ? Motion.glide.transform(t * 2) : 1 - Motion.inOut.transform((t - 0.5) * 2);
    return 1 + 0.08 * (_pulse.isAnimating ? up : 0);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final subject = widget.subject;
    final value = widget.value;
    final onChanged = widget.onChanged;
    return Semantics(
      container: true,
      label: 'How solid is $subject',
      child: Row(
        children: [
          for (final c in Confidence.values)
            Expanded(
              child: Builder(
                builder: (context) => MmPressable(
                  semanticsLabel: c.label,
                  selected: c == value,
                  inMutuallyExclusiveGroup: true,
                  pressedScale: 0.94,
                  focusRadius: MmRadius.keyAll,
                  onTap: () {
                    if (c == value) return;
                    ref.read(hapticsProvider).selection();
                    GuideGlance.at(context);
                    onChanged(c);
                  },
                  builder: (context, pressed, _) => AnimatedBuilder(
                    animation: _pulse,
                    builder: (context, child) => c == widget.pulse ? Transform.scale(scale: _scale, child: child) : child!,
                    child: SizedBox(
                      height: 48,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Bubble(state: c == value ? BubbleState.filled : BubbleState.hollow, size: 22, inkOrigin: const Offset(-0.5, 0.2)),
                          const SizedBox(width: MmSpace.s8),
                          Flexible(
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                c.label,
                                maxLines: 1,
                                style: type.labelLarge.copyWith(
                                  fontSize: 14,
                                  color: c == value ? colors.ink : colors.ink2,
                                  fontWeight: c == value ? FontWeight.w700 : FontWeight.w500,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
