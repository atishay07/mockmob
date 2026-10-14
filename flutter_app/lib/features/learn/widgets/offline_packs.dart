import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../data/lesson_loader.dart';
import '../models/learn_catalog.dart';

/// "Keep for offline", one switch per subject, with the size of what is kept. Lessons are only
/// fetched when the student opens them (the server records that as an exposure), so the switch
/// keeps opened lessons on the phone and says plainly when nothing is kept yet.
class OfflinePacks extends StatelessWidget {
  const OfflinePacks({super.key, required this.subjects, required this.state, required this.onChanged});

  final List<LearnSubject> subjects;
  final OfflineLearnState state;
  final void Function(String subject, bool keep) onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s8, left: MmSpace.s4),
          child: Semantics(header: true, child: Text(LearnCopy.offlineHeading, style: type.subhead)),
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            color: colors.raised,
            borderRadius: MmRadius.panelAll,
            border: Border.all(color: colors.line),
          ),
          child: Column(
            children: [
              for (var i = 0; i < subjects.length; i++) ...[
                if (i > 0) Divider(height: 1, thickness: 1, color: colors.line),
                _PackRow(
                  subject: subjects[i],
                  kept: state.kept.contains(subjects[i].id),
                  bytes: state.sizeOf(subjects[i].id),
                  onChanged: (keep) => onChanged(subjects[i].id, keep),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _PackRow extends StatelessWidget {
  const _PackRow({required this.subject, required this.kept, required this.bytes, required this.onChanged});

  final LearnSubject subject;
  final bool kept;
  final int bytes;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final detail = kept ? (bytes > 0 ? LearnCopy.keepSize(LearnCopy.bytes(bytes)) : LearnCopy.keepNothingYet) : null;
    return MergeSemantics(
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s8),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(subject.title, style: type.body.copyWith(fontWeight: FontWeight.w500)),
                    Text(LearnCopy.keepForOffline, style: type.small.copyWith(color: colors.ink2)),
                    if (detail != null) Text(detail, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Semantics(
                label: '${LearnCopy.keepForOffline}, ${subject.title}',
                child: Switch(value: kept, onChanged: onChanged),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
