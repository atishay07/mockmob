import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/insights_repository.dart';
import '../data/saved_repository.dart';
import '../insights_paths.dart';

/// For Today: the strongest finding from the record, with "Show me" to the evidence. Absent
/// (zero size) until the record is ready and has something to say; never a second plan, and
/// silent when the call fails.
class InsightsCard extends ConsumerWidget {
  const InsightsCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(insightsRepositoryProvider).value;
    if (v == null || !v.isReady || v.findings.isEmpty) return const SizedBox.shrink();
    final f = v.findings.first;
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      child: FakeGlass(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.s16, MmSpace.cardPadding, MmSpace.s4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(InsightsCopy.recordTitle, style: type.label.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s6),
              Text(f.headline, style: type.cardTitle),
              const SizedBox(height: MmSpace.s4),
              Text(f.detail, style: type.small.copyWith(color: colors.ink2), maxLines: 3, overflow: TextOverflow.ellipsis),
              const SizedBox(height: MmSpace.s4),
              Text(InsightsCopy.basedOn(f.n), style: type.caption.copyWith(color: colors.ink3)),
              ShowMePill(
                semanticsLabel: InsightsCopy.findingShowMe,
                onTap: () => context.push(InsightsPaths.insights),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// For Review: "Where your marks go" and "Saved questions", as two plain rows.
class ReviewInsightsRows extends StatelessWidget {
  const ReviewInsightsRows({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const InsightsEntry(),
        Divider(height: 1, color: context.mmColors.line),
        const SavedEntry(),
      ],
    );
  }
}

/// A row to the record with the share answered right, when known.
class InsightsEntry extends ConsumerWidget {
  const InsightsEntry({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(insightsRepositoryProvider).value;
    final note = v == null
        ? null
        : (v.isReady ? InsightsCopy.insightsEntryNote(v.accuracy.known ? v.accuracy.pct : null, v.sessions) : InsightsCopy.insightsEntryEmpty);
    return EntryRow(
      icon: LucideIcons.chartNoAxesColumn,
      title: InsightsCopy.insightsEntryTitle,
      note: note,
      onTap: () => context.push(InsightsPaths.insights),
    );
  }
}

/// A row to the saved questions with the server's count.
class SavedEntry extends ConsumerWidget {
  const SavedEntry({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(savedRepositoryProvider).value;
    final count = ref.watch(saveControllerProvider.select((m) => m.count)) ?? list?.count;
    return EntryRow(
      icon: LucideIcons.bookmark,
      title: InsightsCopy.savedEntryTitle,
      note: count == null ? null : InsightsCopy.savedEntryNote(count),
      onTap: () => context.push(InsightsPaths.saved),
    );
  }
}

/// For Practice: the untimed question stream.
class StreamEntry extends StatelessWidget {
  const StreamEntry({super.key, this.subject});

  final String? subject;

  @override
  Widget build(BuildContext context) => EntryRow(
        icon: LucideIcons.layers,
        title: InsightsCopy.streamEntryTitle,
        note: InsightsCopy.streamEntryNote,
        onTap: () => context.push(InsightsPaths.streamFor(subject: subject)),
      );
}

/// A navigation row: icon, title, a quiet line, and a chevron that says it opens a page.
class EntryRow extends StatelessWidget {
  const EntryRow({super.key, required this.icon, required this.title, required this.onTap, this.note});

  final IconData icon;
  final String title;
  final String? note;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: note == null ? title : '$title, $note',
      pressedScale: 0.98,
      focusRadius: MmRadius.keyAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
          child: Row(
            children: [
              Icon(icon, size: 22, color: colors.ink2),
              const SizedBox(width: MmSpace.s16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(title, style: type.labelLarge),
                    if (note != null) Text(note!, style: type.caption.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
            ],
          ),
        ),
      ),
    );
  }
}
