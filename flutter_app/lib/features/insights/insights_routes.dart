// Route builders for the insights feature. The integrator binds them in
// lib/core/router/router.dart and adds the paths to AppRoutes.templates:
//
//   Review branch, under tabRoot('/review'):
//     page('insights', reviewInsightsScreen),
//     page('saved', reviewSavedScreen),
//   Practice branch, under tabRoot('/practice'):
//     page('stream', practiceStreamScreen, root: true),
//   Top level:
//     page(InsightsPaths.ask, askScreen, root: true),
//
//   templates: '/review/insights', '/review/saved', '/practice/stream', '/ask'
//
//   ActionRouter (web hrefs the API returns): '/explore' -> InsightsPaths.stream,
//   '/saved' -> InsightsPaths.saved, '/analytics' and '/mentor' -> InsightsPaths.insights,
//   '/mentor?tab=ask' -> InsightsPaths.ask. InsightsPaths.locationFor already does this for
//   hrefs shown inside this feature.
//
// Entry widgets to place: InsightsCard (Today, under the hero), ReviewInsightsRows (Review,
// above the record), StreamEntry (Practice, beside Concepts).

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'screens/ask_screen.dart';
import 'screens/insights_screen.dart';
import 'screens/saved_screen.dart';
import 'screens/stream_screen.dart';

export 'insights_paths.dart';
export 'widgets/entry_points.dart' show InsightsCard, ReviewInsightsRows, InsightsEntry, SavedEntry, StreamEntry, EntryRow;

/// `/review/insights`.
Widget reviewInsightsScreen(BuildContext context, GoRouterState state) => const InsightsScreen();

/// `/review/saved`.
Widget reviewSavedScreen(BuildContext context, GoRouterState state) => const SavedScreen();

/// `/practice/stream?subject=&chapter=&difficulty=` or `?source=saved&start=<questionId>`.
Widget practiceStreamScreen(BuildContext context, GoRouterState state) {
  final q = state.uri.queryParameters;
  String? clean(String? v) {
    final t = v?.trim();
    return t == null || t.isEmpty || t.length > 120 ? null : t;
  }

  if (q['source'] == 'saved') return StreamScreen(key: const ValueKey('saved'), saved: true, startAt: clean(q['start']));
  return StreamScreen(
    key: ValueKey(state.uri.toString()),
    subject: clean(q['subject']),
    chapter: clean(q['chapter']),
    difficulty: clean(q['difficulty']),
  );
}

/// `/ask`. A String `extra` starts the composer with that text (never sends it). `?q=attemptId:questionId`
/// hands over the repaired mistake "Ask Mobi about Q3" is about.
Widget askScreen(BuildContext context, GoRouterState state) => AskScreen(
      key: ValueKey(state.uri.toString()),
      seed: state.extra is String ? state.extra! as String : null,
      questionRef: state.uri.queryParameters['q'],
    );
