import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/lesson_loader.dart';
import '../models/learn_catalog.dart';

/// "Keep for offline", one switch per subject, with the size of what is kept. Lessons are only
/// fetched when the student opens them (the server records that as an exposure), so the switch
/// keeps opened lessons on the phone and says plainly when nothing is kept yet. There is no bulk
/// download here.
///
/// Under each kept pack a thin bar shows its size against the largest pack (a share of the
/// biggest, not of the phone), and Remove takes its lessons off the phone. Remove waits
/// [undoWindow] with an Undo beside it before anything is deleted, so a slip costs nothing;
/// leaving the screen inside the window keeps the lessons.
class OfflinePacks extends StatefulWidget {
  const OfflinePacks({
    super.key,
    required this.subjects,
    required this.state,
    required this.onChanged,
    this.onRemove,
  });

  final List<LearnSubject> subjects;
  final OfflineLearnState state;
  final void Function(String subject, bool keep) onChanged;

  /// Deletes a subject's kept lessons once the Undo window has passed; null hides Remove.
  final void Function(String subject)? onRemove;

  /// How long Remove waits, with Undo showing, before it deletes.
  static const Duration undoWindow = Duration(seconds: 6);

  @override
  State<OfflinePacks> createState() => _OfflinePacksState();
}

class _OfflinePacksState extends State<OfflinePacks> {
  final Map<String, Timer> _pending = {};

  @override
  void dispose() {
    for (final t in _pending.values) {
      t.cancel();
    }
    super.dispose();
  }

  void _remove(String subject) {
    _pending[subject]?.cancel();
    setState(() {
      _pending[subject] = Timer(OfflinePacks.undoWindow, () {
        if (!mounted) return;
        setState(() => _pending.remove(subject));
        widget.onRemove?.call(subject);
      });
    });
  }

  void _undo(String subject) {
    _pending.remove(subject)?.cancel();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final state = widget.state;
    final biggest = [for (final s in widget.subjects) state.sizeOf(s.id)].fold<int>(0, (a, b) => a > b ? a : b);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s12),
          child: Semantics(
            header: true,
            child: Text(LearnCopy.offlineHeading, style: type.subhead),
          ),
        ),
        // The same grouped list as the lessons, so the card has the same edge in Night and Day.
        MmRowGroup(
          dividerIndent: MmSpace.s16,
          children: [
            for (final subject in widget.subjects)
              _PackRow(
                subject: subject,
                kept: state.kept.contains(subject.id),
                bytes: state.sizeOf(subject.id),
                share: biggest <= 0 ? 0 : state.sizeOf(subject.id) / biggest,
                removing: _pending.containsKey(subject.id),
                onChanged: (keep) => widget.onChanged(subject.id, keep),
                onRemove: widget.onRemove == null ? null : () => _remove(subject.id),
                onUndo: () => _undo(subject.id),
              ),
          ],
        ),
      ],
    );
  }
}

class _PackRow extends StatelessWidget {
  const _PackRow({
    required this.subject,
    required this.kept,
    required this.bytes,
    required this.share,
    required this.removing,
    required this.onChanged,
    required this.onRemove,
    required this.onUndo,
  });

  final LearnSubject subject;
  final bool kept;
  final int bytes;

  /// This pack's size as a share of the biggest pack, 0 to 1.
  final double share;

  /// Remove is waiting out its Undo window.
  final bool removing;
  final ValueChanged<bool> onChanged;
  final VoidCallback? onRemove;
  final VoidCallback onUndo;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final detail = kept
        ? (removing
              ? LearnCopy.packRemoved
              : (bytes > 0
                    ? LearnCopy.keepSize(LearnCopy.bytes(bytes))
                    : LearnCopy.keepNothingYet))
        : null;
    final label = '${LearnCopy.keepForOffline}, ${subject.title}';
    // The whole row is the switch's target and answers a touch at once; the Switch inside is
    // only the picture of the state, so TalkBack hears one control.
    final row = MmPressable(
      semanticsLabel: label,
      checked: kept,
      button: false,
      onTap: () => onChanged(!kept),
      highlight: true,
      pressedScale: 0.985,
      focusRadius: BorderRadius.zero,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: MmSpace.s16,
            vertical: MmSpace.s12,
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(subject.title, style: type.labelLarge),
                    const SizedBox(height: MmSpace.s2),
                    Text(
                      LearnCopy.keepForOffline,
                      style: type.caption.copyWith(color: colors.ink2),
                    ),
                    if (detail != null)
                      Text(
                        detail,
                        style: type.caption.copyWith(color: colors.ink2),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              ExcludeSemantics(
                child: IgnorePointer(
                  child: Switch(value: kept, onChanged: (_) {}),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    final hasPack = kept && (bytes > 0 || removing);
    if (!hasPack) return row;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        row,
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s16, 0, MmSpace.s8, MmSpace.s4),
          child: Row(
            children: [
              Expanded(child: PackSizeBar(share: removing ? 0 : share)),
              const SizedBox(width: MmSpace.s8),
              if (removing)
                KeyButton.quiet(
                  label: LearnCopy.packUndo,
                  semanticsLabel: '${LearnCopy.packUndo}, ${LearnCopy.packRemoveLabel(subject.title)}',
                  onPressed: onUndo,
                )
              else if (onRemove != null)
                KeyButton.quiet(
                  label: LearnCopy.packRemove,
                  semanticsLabel: LearnCopy.packRemoveLabel(subject.title),
                  onPressed: onRemove,
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// A thin bar for one pack's size against the largest pack. It glides to a new size (a pack
/// emptied, or Undo bringing it back) over 200 ms; under reduced motion it jumps. It carries no
/// number of its own: the size is in words beside it.
class PackSizeBar extends StatelessWidget {
  const PackSizeBar({super.key, required this.share});

  /// 0 to 1.
  final double share;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final fill = colors.isNight ? colors.volt : colors.accentText;
    return ExcludeSemantics(
      child: SizedBox(
        height: 4,
        child: TweenAnimationBuilder<double>(
          tween: Tween<double>(end: share.clamp(0.0, 1.0)),
          duration: Motion.of(context, Motion.ui),
          curve: Motion.out,
          builder: (context, value, _) => CustomPaint(
            painter: _BarPainter(value: value, track: colors.lineStrong.withValues(alpha: 0.5), fill: fill),
          ),
        ),
      ),
    );
  }
}

class _BarPainter extends CustomPainter {
  _BarPainter({required this.value, required this.track, required this.fill});

  final double value;
  final Color track;
  final Color fill;

  @override
  void paint(Canvas canvas, Size size) {
    final r = Radius.circular(size.height / 2);
    canvas.drawRRect(RRect.fromRectAndRadius(Offset.zero & size, r), Paint()..color = track);
    final w = size.width * value;
    if (w > 0.5) {
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w < size.height ? size.height : w, size.height), r), Paint()..color = fill);
    }
  }

  @override
  bool shouldRepaint(_BarPainter old) => old.value != value || old.track != track || old.fill != fill;
}
