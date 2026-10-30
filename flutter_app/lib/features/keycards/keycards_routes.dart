// Route builders for Key cards (KEYCARDS-BUILD-SPEC 4). lib/core/router/screens.dart re-exports them and
// router.dart binds them under `/cards`.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'screens/keycards_deck_screen.dart';
import 'screens/keycards_home_screen.dart';

/// `/cards[?subject=]`: Key cards home.
Widget keyCardsScreen(BuildContext context, GoRouterState state) => KeyCardsHomeScreen(initialSubject: state.uri.queryParameters['subject']);

/// `/cards/:chapter[?mode=read|study|last-look]`: a chapter's deck.
Widget keyCardsChapterScreen(BuildContext context, GoRouterState state) {
  final chapter = state.pathParameters['chapter'] ?? '';
  return KeyCardsDeckScreen(key: ValueKey('kc-deck-$chapter'), chapterKey: chapter, initialMode: KcMode.parse(state.uri.queryParameters['mode']));
}
