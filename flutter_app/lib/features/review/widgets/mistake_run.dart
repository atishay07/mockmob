import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// A set of mistakes written as the bubbles of the sheet, each with its question number,
/// wrapping onto a second line when there are many. With [inkIn] the bubbles start as empty
/// rings and ink one after another (90 ms apart, from 240 ms in): the sheet taking on the
/// mistakes it is about to repair. Under reduced motion they are inked at once.
class MistakeRun extends StatefulWidget {
  const MistakeRun({super.key, required this.numbers, this.state = BubbleState.wrong, this.inkIn = false});

  final List<int> numbers;

  /// What each bubble shows once inked: wrong for open mistakes, filled for repaired ones.
  final BubbleState state;
  final bool inkIn;

  @override
  State<MistakeRun> createState() => _MistakeRunState();
}

class _MistakeRunState extends State<MistakeRun> {
  int _inked = 0;
  final List<Timer> _timers = [];
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!widget.inkIn || Motion.reduced(context)) {
      _inked = widget.numbers.length;
      return;
    }
    for (var i = 0; i < widget.numbers.length; i++) {
      _timers.add(
        Timer(Duration(milliseconds: 240 + 90 * i), () {
          if (mounted) setState(() => _inked = i + 1);
        }),
      );
    }
  }

  @override
  void dispose() {
    for (final t in _timers) {
      t.cancel();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final numbers = widget.numbers;
    return Semantics(
      label: widget.state == BubbleState.wrong ? ReviewCopy.wrongQuestionsSpoken(numbers) : 'Questions ${numbers.join(', ')}',
      excludeSemantics: true,
      child: Wrap(
        spacing: MmSpace.s16,
        runSpacing: MmSpace.s8,
        children: [
          for (var i = 0; i < numbers.length; i++)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Bubble(state: i < _inked ? widget.state : BubbleState.hollow, size: 20, animate: widget.inkIn),
                const SizedBox(width: MmSpace.s4),
                Text('Q${numbers[i]}', style: context.mmType.label.copyWith(color: colors.ink)),
              ],
            ),
        ],
      ),
    );
  }
}
