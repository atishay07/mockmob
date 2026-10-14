import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The leave guard (spec 5.5, 4.4): the clock keeps running and nothing is discarded. Pops
/// true when the student chooses to leave.
///
/// With [showMobi] (off under Celebrations Off) a 72 dp Mobi stands beside the words: a hello in
/// a practice, sitting still in a timed mock. He nods when the student keeps going and waves when
/// they leave; the sheet closes a beat after, so the act is seen.
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

  void _choose(bool leave) {
    if (_close != null) return;
    if (!widget.showMobi || Motion.reduced(context)) {
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
        if (widget.showMobi)
          Row(
            children: [
              SizedBox.square(
                dimension: LeaveSheet.mobiSize,
                child: MobiCharacter(
                  controller: _mobi,
                  size: LeaveSheet.mobiSize,
                  // A timed mock is still running: he sits, and says nothing.
                  entrance: widget.isMock ? MobiAct.rest : MobiAct.hello,
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
