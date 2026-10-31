import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../learn/widgets/learn_library.dart' show LearnLinkRow;
import '../data/keycards_providers.dart';
import '../keycards_copy.dart';

/// The Key cards row in Learn (Practice's Learn door): "Key cards", with today's due cards when there are
/// any. Draws nothing (no space at all) while Key cards are off, loading or unreadable.
class KeyCardsLearnEntry extends ConsumerWidget {
  const KeyCardsLearnEntry({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final home = ref.watch(keyCardsHomeProvider).value?.value;
    if (home == null || !home.enabled) return const SizedBox.shrink();
    final today = home.today;
    final anyAdded = home.subjects.any((s) => s.units.any((u) => u.chapters.any((c) => c.added > 0)));
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: LearnLinkRow(
        title: KeyCardsCopy.title,
        // A first visit (nothing due, nothing added) says what Key cards are.
        note: today.due > 0
            ? KeyCardsCopy.learnRowDue(today.due, today.minutes)
            : anyAdded
            ? KeyCardsCopy.nothingDue
            : KeyCardsCopy.learnRowNote,
        onTap: () => unawaited(context.push<void>(AppRoutes.keyCards)),
      ),
    );
  }
}

/// "Key cards for (the chapter)" under a chapter in Review, when that chapter has cards. Nothing (no space)
/// otherwise.
class KeyCardsChapterLink extends ConsumerWidget {
  const KeyCardsChapterLink({super.key, required this.subject, required this.chapter});

  final String? subject;

  /// The chapter as questions store it.
  final String chapter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final home = ref.watch(keyCardsHomeProvider).value?.value;
    if (home == null || !home.enabled) return const SizedBox.shrink();
    final match = home.chapterFor(subject, chapter);
    if (match == null || match.cards == 0) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    final label = KeyCardsCopy.chapterLink(match.title);
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: MmPressable(
        onTap: () => unawaited(context.push<void>(AppRoutes.keyCardsChapter(match.key))),
        pressedScale: 0.985,
        focusRadius: MmRadius.keyAll,
        haptic: MmPressHaptic.selection,
        highlight: true,
        semanticsLabel: label,
        builder: (context, pressed, _) => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44),
          // The same quiet underlined line as the lesson link above it.
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              label,
              style: type.labelLarge.copyWith(fontSize: 14.5, decoration: TextDecoration.underline, decorationColor: colors.lineStrong, color: colors.ink),
            ),
          ),
        ),
      ),
    );
  }
}
