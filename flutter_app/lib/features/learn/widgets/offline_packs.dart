import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/lesson_loader.dart';
import '../models/learn_catalog.dart';

/// "Keep for offline", one switch per subject, with the size of what is kept. Lessons are only
/// fetched when the student opens them (the server records that as an exposure), so the switch
/// keeps opened lessons on the phone and says plainly when nothing is kept yet.
class OfflinePacks extends StatelessWidget {
  const OfflinePacks({
    super.key,
    required this.subjects,
    required this.state,
    required this.onChanged,
  });

  final List<LearnSubject> subjects;
  final OfflineLearnState state;
  final void Function(String subject, bool keep) onChanged;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
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
            for (final subject in subjects)
              _PackRow(
                subject: subject,
                kept: state.kept.contains(subject.id),
                bytes: state.sizeOf(subject.id),
                onChanged: (keep) => onChanged(subject.id, keep),
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
    required this.onChanged,
  });

  final LearnSubject subject;
  final bool kept;
  final int bytes;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final detail = kept
        ? (bytes > 0
              ? LearnCopy.keepSize(LearnCopy.bytes(bytes))
              : LearnCopy.keepNothingYet)
        : null;
    final label = '${LearnCopy.keepForOffline}, ${subject.title}';
    // The whole row is the switch's target and answers a touch at once; the Switch inside is
    // only the picture of the state, so TalkBack hears one control.
    return MmPressable(
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
  }
}
