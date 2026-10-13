import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// A subject's syllabus chapters that have no lesson yet, folded under one line ("4 chapters
/// without a lesson yet"). Open, each chapter has only a Practise key: practice is ready for it,
/// the lesson comes later.
class UntaughtChapters extends StatefulWidget {
  const UntaughtChapters({super.key, required this.chapters, required this.onPractise, this.initiallyOpen = false});

  final List<String> chapters;
  final ValueChanged<String> onPractise;
  final bool initiallyOpen;

  @override
  State<UntaughtChapters> createState() => _UntaughtChaptersState();
}

class _UntaughtChaptersState extends State<UntaughtChapters> {
  late bool _open = widget.initiallyOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (widget.chapters.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MmPressable(
          semanticsLabel: '${LearnCopy.untaughtHeading}. ${LearnCopy.untaughtCount(widget.chapters.length)}. '
              '${_open ? LearnCopy.hideChapters : LearnCopy.showChapters}',
          focusRadius: MmRadius.panelAll,
          onTap: () => setState(() => _open = !_open),
          builder: (context, pressed, _) => ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4, vertical: MmSpace.s8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(LearnCopy.untaughtHeading, style: type.body.copyWith(fontWeight: FontWeight.w500)),
                        Text(LearnCopy.untaughtCount(widget.chapters.length), style: type.small.copyWith(color: colors.ink2)),
                      ],
                    ),
                  ),
                  AnimatedRotation(
                    turns: _open ? 0.5 : 0,
                    duration: Motion.of(context, Motion.ui),
                    curve: Motion.out,
                    child: Icon(LucideIcons.chevronDown, size: 18, color: colors.ink3),
                  ),
                ],
              ),
            ),
          ),
        ),
        AnimatedSize(
          duration: Motion.of(context, Motion.card),
          curve: Motion.out,
          alignment: Alignment.topCenter,
          child: !_open
              ? const SizedBox(width: double.infinity)
              : Padding(
                  padding: const EdgeInsets.only(left: MmSpace.s4, bottom: MmSpace.s8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(LearnCopy.untaughtNote, style: type.small.copyWith(color: colors.ink2)),
                      const SizedBox(height: MmSpace.s4),
                      for (final c in widget.chapters)
                        Row(
                          children: [
                            Expanded(child: Text(c, style: type.body)),
                            KeyButton.quiet(
                              label: LearnCopy.practiseKey,
                              semanticsLabel: '${LearnCopy.practiseKey} $c',
                              onPressed: () => widget.onPractise(c),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
        ),
      ],
    );
  }
}
