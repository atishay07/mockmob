import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/learn_models.dart';
import 'home_copy.dart';
import 'home_model.dart';

/// Find with nothing typed (the web's FindHome.jsx, screens.md item 14): Find has a face of its own, not the Learn home under a
/// field. The student's own sets as rows, each drawn only when it holds cards (Due today, Missed lately, In Revise), and the
/// Must-know lines of the subject; a student with nothing yet gets one line and four words from the book to start a search with.
/// A row opens that set in place ([onShelf]); a word searches it ([onSearch]).
class FindHome extends StatelessWidget {
  const FindHome({super.key, required this.subject, required this.shelves, required this.onShelf, required this.onSearch});

  final String subject;
  final LearnShelves? shelves;
  final ValueChanged<String> onShelf;
  final ValueChanged<String> onSearch;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final sets = HomeModel.shelfKeys(shelves);
    final rows = HomeModel.findRows(shelves);
    final hints = HomeModel.findHints(subject);
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (sets.isEmpty)
            Padding(
              padding: EdgeInsets.only(bottom: rows.isEmpty ? 0 : 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    HomeModel.findHintLine(subject),
                    key: const ValueKey('lh-findhome-line'),
                    style: type.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2),
                  ),
                  if (hints.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Semantics(
                      container: true,
                      label: HomeCopy.tryAWord,
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 0,
                        children: [for (final w in hints) _Chip(key: ValueKey('lh-chip-$w'), word: w, onTap: () => onSearch(w))],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          if (rows.isNotEmpty)
            Semantics(
              container: true,
              label: HomeCopy.findHeading,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Semantics(header: true, child: Text(HomeCopy.findHeading, style: type.title.copyWith(fontSize: 20, height: 1.2, color: colors.ink))),
                  ),
                  DecoratedBox(
                    decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (final r in rows)
                          DecoratedBox(
                            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: colors.line))),
                            child: _Row(key: ValueKey('lh-find-${r.id}'), title: r.title, line: r.line, onTap: () => onShelf(r.id)),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// A word to try: 40 dp to look at, 48 dp to touch.
class _Chip extends StatelessWidget {
  const _Chip({super.key, required this.word, required this.onTap});

  final String word;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: word,
      focusRadius: BorderRadius.circular(20),
      pressedScale: 0.97,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => SizedBox(
        height: MmTarget.min,
        child: Center(
          // As wide as its word: the words flow in the row from the left, as the web's, never one to a line across the width.
          widthFactor: 1,
          child: DecoratedBox(
            decoration: ShapeDecoration(shape: StadiumBorder(side: BorderSide(color: colors.lineStrong))),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                height: 40,
                child: Center(widthFactor: 1, child: Text(word, style: type.body.copyWith(fontSize: 14.5, height: 1, fontWeight: FontWeight.w600, color: colors.ink))),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// One of the student's sets: 56 dp at least, the name (15 w650) over its line (13.5), a chevron.
class _Row extends StatelessWidget {
  const _Row({super.key, required this.title, required this.line, required this.onTap});

  final String title;
  final String line;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: '$title. $line',
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.99,
      highlight: true,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4, vertical: MmSpace.s8),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(title, style: type.body.copyWith(fontSize: 15, height: 1.3, fontWeight: FontWeight.w700, color: colors.ink)),
                    const SizedBox(height: 2),
                    Text(line, maxLines: 1, overflow: TextOverflow.ellipsis, style: type.body.copyWith(fontSize: 13.5, height: 1.35, fontWeight: FontWeight.w500, color: colors.ink2)),
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
            ],
          ),
        ),
      ),
    );
  }
}
