// Route builders for Learn v2 (APP-1101 section 6). lib/core/router/screens.dart re-exports them and router.dart
// binds them under /learn/c/, /learn/session and /explore. Every location is built by Learn2Links.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'cards/cards_view.dart';
import 'chapter/chapter_page.dart';
import 'explore/explore_screen.dart';
import 'feed/feed_screen.dart';
import 'learn2_links.dart';
import 'run/run_screen.dart';

/// `/learn/c/:chapterKey[?min=]`: the chapter page.
Widget learn2ChapterScreen(BuildContext context, GoRouterState state) {
  final key = state.pathParameters['chapterKey'] ?? '';
  return ChapterPage(key: ValueKey('l2-chapter-$key'), chapterKey: key, minutes: int.tryParse(state.uri.queryParameters['min'] ?? ''));
}

/// `/learn/c/:chapterKey/cards[?f=must|revise|missed]`: the chapter's Cards view.
Widget learn2CardsScreen(BuildContext context, GoRouterState state) {
  final key = state.pathParameters['chapterKey'] ?? '';
  return CardsViewScreen(key: ValueKey('l2-cards-$key'), chapterKey: key, filter: state.uri.queryParameters['f']);
}

/// `/learn/session?chapter=&min=&kind=&out=&cards=&run=&end=&next=&fresh=`: a run.
Widget learn2SessionScreen(BuildContext context, GoRouterState state) =>
    LearnRunScreen(key: ValueKey('l2-run-${state.uri.query}'), launch: RunLaunch.fromQuery(state.uri.queryParameters));

/// `/explore[?subject=]`: the chapter feed covers.
Widget learn2ExploreScreen(BuildContext context, GoRouterState state) => ExploreScreen(subject: state.uri.queryParameters['subject']);

/// `/explore/feed?chapter=&min=&run=&end=&src=&fy=&pos=`: a feed.
Widget learn2FeedScreen(BuildContext context, GoRouterState state) =>
    FeedScreen(key: ValueKey('l2-feed-${state.uri.query}'), launch: FeedLaunch.fromQuery(state.uri.queryParameters));
