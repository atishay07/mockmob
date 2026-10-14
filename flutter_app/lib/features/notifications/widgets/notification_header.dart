import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/next_reminder.dart';

/// The top of the notification settings: a 64 dp Mobi and the one live line about what happens
/// next. He rests when every reminder is off or muted and says hello when any is on; the screen
/// cheers him once, when a switch has just turned on and the save receipt confirmed it.
///
/// The line is the real scheduler's own output ([NextReminder]), never a guess. It stays out
/// until the first planning pass has run.
class NotificationsHeader extends ConsumerStatefulWidget {
  const NotificationsHeader({
    super.key,
    required this.mobi,
    required this.resting,
    required this.next,
    required this.now,
    this.onNextTap,
  });

  /// Driven by the screen (the cheer after a confirmed save).
  final MobiController mobi;

  /// Every reminder is off, or a mute is running: he sits down.
  final bool resting;

  /// What the scheduler left after its last plan, or null before the first one.
  final NextReminder? next;
  final DateTime now;

  /// Opens the time sheet for the study window's start. Null makes the line plain text (no
  /// study window to change).
  final VoidCallback? onNextTap;

  @override
  ConsumerState<NotificationsHeader> createState() => _NotificationsHeaderState();
}

class _NotificationsHeaderState extends ConsumerState<NotificationsHeader> {
  late final MobiAct _entrance = widget.resting ? MobiAct.rest : MobiRation.greeting('notifications', otherwise: MobiAct.idle);

  @override
  void didUpdateWidget(NotificationsHeader old) {
    super.didUpdateWidget(old);
    if (old.resting == widget.resting) return;
    // Sitting down answers a switch going off or a mute. Standing up again is quiet: the cheer
    // waits for the save receipt, so nothing celebrates before the server has said yes.
    widget.mobi.play(widget.resting ? MobiAct.rest : MobiAct.idle);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final next = widget.next;
    return Padding(
      padding: const EdgeInsets.only(bottom: MmSpace.s16),
      child: Row(
        children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {
              unawaited(ref.read(hapticsProvider).tick().catchError((Object _) {}));
              widget.mobi.play(widget.resting ? MobiAct.rest : MobiAct.correct);
            },
            child: Mobi(pose: MobiPose.idle, size: 64, controller: widget.mobi, entrance: _entrance),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: AnimatedSwitcher(
              duration: Motion.of(context, Motion.crossFade),
              layoutBuilder: (current, previous) => Stack(alignment: AlignmentDirectional.centerStart, children: [...previous, ?current]),
              child: next == null
                  ? const SizedBox(key: ValueKey('unknown'), width: double.infinity)
                  : _line(context, next, colors, type),
            ),
          ),
        ],
      ),
    );
  }

  Widget _line(BuildContext context, NextReminder next, MmColors colors, MmType type) {
    final headline = next.headline(widget.now);
    final why = next.why;
    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(headline, style: type.labelLarge.copyWith(fontSize: 15, color: next.isScheduled ? colors.ink : colors.ink2)),
        if (why != null) ...[
          const SizedBox(height: 2),
          Text(why, style: type.caption.copyWith(color: colors.ink2)),
        ],
      ],
    );
    final tap = widget.onNextTap;
    final key = ValueKey('${next.at?.millisecondsSinceEpoch}-${next.reason}-${next.kind}-${next.mistakes}');
    if (tap == null) {
      return Semantics(key: key, container: true, liveRegion: true, label: next.sentence(widget.now), excludeSemantics: true, child: body);
    }
    return Semantics(
      key: key,
      button: true,
      label: next.sentence(widget.now),
      hint: NotificationsCopy.nextOpensTime,
      onTap: tap,
      excludeSemantics: true,
      child: MmPressable(
        onTap: tap,
        haptic: MmPressHaptic.selection,
        pressedScale: 0.985,
        focusRadius: MmRadius.smallAll,
        builder: (context, pressed, _) => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: Align(alignment: AlignmentDirectional.centerStart, child: body),
        ),
      ),
    );
  }
}
