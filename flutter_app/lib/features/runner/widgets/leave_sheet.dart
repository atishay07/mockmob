import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The leave guard (spec 5.5, 4.4): the clock keeps running and nothing is discarded. Pops
/// true when the student chooses to leave.
///
/// With [showMobi] (off under Celebrations Off) a 72 dp Mobi stands beside the words in a
/// practice: a hello, a nod when the student keeps going and a wave when they leave; the sheet
/// closes a beat after, so the act is seen. A timed mock never shows him (pass 1016e AP3-07, A20;
/// MockMob overlay: protect the timer, avoid distraction): the clock is running, so the sheet is
/// only its words, the real end time and the two keys.
class LeaveSheet extends StatefulWidget {
  const LeaveSheet({super.key, required this.isMock, required this.until, this.showMobi = false});

  final bool isMock;
  final DateTime until;
  final bool showMobi;

  /// Mobi's height.
  static const double mobiSize = 72;

  /// How long the sheet stays after the choice, so Mobi's nod or wave lands before it closes.
  static const Duration actBeat = Duration(milliseconds: 220);

  @override
  State<LeaveSheet> createState() => _LeaveSheetState();
}

class _LeaveSheetState extends State<LeaveSheet> {
  final MobiController _mobi = MobiController();
  Timer? _close;

  @override
  void dispose() {
    _close?.cancel();
    _mobi.dispose();
    super.dispose();
  }

  /// Mobi only in a practice: a timed mock's sheet is plain.
  bool get _mobiShown => widget.showMobi && !widget.isMock;

  void _choose(bool leave) {
    if (_close != null) return;
    if (!_mobiShown || Motion.reduced(context)) {
      Navigator.of(context).pop(leave);
      return;
    }
    _mobi.react(leave ? MobiMoments.act(MobiEvent.goodbye) : MobiAct.nod, key: leave ? 'leave:wave' : 'leave:stay');
    _close = Timer(LeaveSheet.actBeat, () {
      if (mounted) Navigator.of(context).pop(leave);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final body = Text(
      RunnerCopy.leaveBody(isMock: widget.isMock, until: widget.until),
      style: type.body.copyWith(color: colors.ink2),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (_mobiShown)
          Row(
            children: [
              SizedBox.square(
                dimension: LeaveSheet.mobiSize,
                child: MobiCharacter(
                  controller: _mobi,
                  size: LeaveSheet.mobiSize,
                  entrance: MobiAct.hello,
                  seed: 17,
                ),
              ),
              const SizedBox(width: MmSpace.s16),
              Expanded(child: body),
            ],
          )
        else
          body,
        const SizedBox(height: MmSpace.s24),
        KeyButton(label: RunnerCopy.keepGoing, onPressed: () => _choose(false), hapticOnCommit: false, autofocus: true),
        const SizedBox(height: MmSpace.s12),
        KeyButton.secondary(label: RunnerCopy.leaveKey(widget.isMock), onPressed: () => _choose(true), hapticOnCommit: false),
      ],
    );
  }
}
