import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/review_chapters.dart';
import 'chapter_bits.dart';
import 'collapsible.dart';
import 'review_bits.dart' show FlushKey;

/// Saved repairs (REVIEW-RESULT-1018 4.4): every mistake whose repair is stored, slipped first, then those waiting for Check it
/// held, then those that held, newest first inside each. A row has its round badge (the ring is the state's own ink, and the
/// line beside it says the state in words), its chapter, its paper and the 12-hour time it was attempted, one state line and ONE
/// action: Check it held, or See repair. Every one opens free (F17): a repaired mistake never offers a paid repair again.
///
/// Four rows show; "Show all 9" opens the rest in place. "See your record" opens the thread of every repair with its dates.
class SavedRepairs extends StatefulWidget {
  const SavedRepairs({super.key, required this.saved, required this.summary, required this.onOpen, required this.onRecord});

  final List<SavedRepair> saved;

  /// "6 held on a new question, 1 slipped, 2 waiting for Check it held."
  final String summary;

  /// Opens the saved repair of a mistake (free).
  final ValueChanged<SavedRepair> onOpen;
  final VoidCallback onRecord;

  static const shown = 4;

  @override
  State<SavedRepairs> createState() => _SavedRepairsState();
}

class _SavedRepairsState extends State<SavedRepairs> {
  bool _all = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final saved = widget.saved;
    if (saved.isEmpty) return const SizedBox.shrink();
    final first = saved.take(SavedRepairs.shown).toList();
    final rest = saved.skip(SavedRepairs.shown).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Divider(height: 1, thickness: 1, color: colors.line),
        const SizedBox(height: MmSpace.s16),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(child: Semantics(header: true, child: Text(ReviewCopy.savedRepairsHeading, style: type.title))),
            Text(ReviewCopy.savedRepairsCount(saved.length), style: type.caption.copyWith(color: colors.ink2)),
          ],
        ),
        if (widget.summary.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s2),
          Text(widget.summary, style: type.small.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s4),
        for (final s in first) _SavedRow(saved: s, onTap: () => widget.onOpen(s)),
        if (rest.isNotEmpty)
          MmCollapsible(
            expanded: _all,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [for (final s in rest) _SavedRow(saved: s, onTap: () => widget.onOpen(s))]),
          ),
        if (rest.isNotEmpty && !_all)
          MmPressable(
            onTap: () => setState(() => _all = true),
            pressedScale: 0.985,
            focusRadius: MmRadius.keyAll,
            haptic: MmPressHaptic.selection,
            highlight: true,
            semanticsLabel: ReviewCopy.showAllSaved(saved.length),
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 52),
              child: Row(
                children: [
                  Expanded(child: Text(ReviewCopy.showAllSaved(saved.length), style: type.labelLarge.copyWith(color: colors.ink2))),
                  Icon(LucideIcons.chevronDown, size: 18, color: colors.ink3),
                ],
              ),
            ),
          ),
        FlushKey(label: ReviewCopy.seeRecord, onPressed: widget.onRecord),
      ],
    );
  }
}

class _SavedRow extends StatelessWidget {
  const _SavedRow({required this.saved, required this.onTap});

  final SavedRepair saved;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final action = saved.action ?? ActionLabels.see;
    // The state line is in the state's ink, and always in words: slipped and held are never colour alone.
    final ink = switch (saved.kind) {
      'slipped' => colors.warnText,
      'held' => colors.goodText,
      _ => colors.ink2,
    };
    return ChapterItemRow(
      badge: badgeKindOf(saved.kind),
      number: saved.number,
      divider: true,
      title: Text(saved.chapter, style: type.cardTitle.copyWith(fontSize: 15, height: 20 / 15), maxLines: 3, overflow: TextOverflow.ellipsis),
      details: [
        stampText(context, saved.item.stamp),
        Text(ReviewCopy.bindTime(saved.line), style: type.caption.copyWith(fontWeight: FontWeight.w600, color: ink)),
      ],
      action: action,
      semanticsLabel: ReviewCopy.savedRowSpoken(
        action: action,
        number: saved.number,
        chapter: saved.chapter,
        stamp: saved.item.stamp,
        line: saved.line,
      ),
      onTap: onTap,
    );
  }
}
