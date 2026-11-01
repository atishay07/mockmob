// What the chapter page's tests share: a Learn server that answers from the recordings (D's FixtureLearnApi) with the
// chapter page's own variants of them, a router that notes where a tap goes, and a phone that notes its haptics.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/learn2/chapter/chapter_page.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;

import '../support/fixture_learn_api.dart';

export '../support/fixture_learn_api.dart' show FixtureLearnApi, LearnFixtures, l2Aop, l2Cpsr, l2Missing, l2Pf;

/// The fixture server with the chapter page's variants of the recordings: [pick] names the recording an ask is answered
/// with and [edit] may change the body (a copy of the recording, as the server sent it).
class ChapterApi extends FixtureLearnApi {
  ChapterApi({super.pro, super.newStudent, super.freeUsed, super.offline, super.error, super.notFound, super.slow, this.pick, this.edit});

  String Function(LearnPreviewKey key)? pick;
  void Function(LearnPreviewKey key, Json body)? edit;

  @override
  Future<LearnPreview> preview({required String chapterKey, required int minutes, List<String> leaveOut = const [], bool addNext = false}) async {
    // The fixture server's own switches (offline, error, 404, slow) always apply; it answers its default recording.
    final base = await super.preview(chapterKey: chapterKey, minutes: minutes, leaveOut: leaveOut, addNext: addNext);
    final picked = pick;
    final editor = edit;
    if (picked == null && editor == null) return base;
    final key = LearnPreviewKey(chapterKey: chapterKey, minutes: minutes, leaveOut: leaveOut, addNext: addNext);
    final body = picked == null ? asJson(jsonDecode(jsonEncode(base.raw))) : LearnFixtures.json(picked(key));
    editor?.call(key, body);
    return LearnPreview.parse(body);
  }
}

/// A phone that notes every haptic.
class RecordingPhone implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> selectionClick() async => calls.add('selection');

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');
}

class ChapterHarness {
  ChapterHarness({required this.api, required this.visited, required this.store, required this.phone, required this.router});

  final ChapterApi api;

  /// Every location a tap went to, in order.
  final List<String> visited;
  final MemoryPrefsStore store;
  final RecordingPhone phone;
  final GoRouter router;
}

/// Lets the page's debounce run out and the answer land, then its fades finish.
Future<void> settleChapter(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 130));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(milliseconds: 400));
}

/// The chapter page at [size], in the app's theme, with a router that notes where it is sent.
Future<ChapterHarness> pumpChapter(
  WidgetTester tester, {
  ChapterApi? api,
  String chapter = l2Pf,
  int? minutes,
  Size size = const Size(360, 800),
  double textScale = 1,
  Brightness brightness = Brightness.dark,
  MemoryPrefsStore? store,
  bool nudges = false,
  bool disableAnimations = true,
  bool settle = true,
}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  // A fresh tree (and so a fresh provider scope) each time, when a test draws the page more than once.
  await tester.pumpWidget(const SizedBox.shrink());
  final theApi = api ?? ChapterApi();
  final theStore = store ?? MemoryPrefsStore();
  final phone = RecordingPhone();
  final visited = <String>[];
  Widget stop(String name, GoRouterState state) {
    visited.add(state.uri.toString());
    return Scaffold(body: Text('$name ${state.uri}'));
  }

  final router = GoRouter(
    initialLocation: '/chapter',
    routes: [
      GoRoute(path: '/', builder: (context, state) => const Scaffold(body: Text('where the student came from'))),
      GoRoute(path: '/chapter', builder: (context, state) => ChapterPage(chapterKey: chapter, minutes: minutes)),
      GoRoute(path: '/learn/session', builder: (context, state) => stop('run', state)),
      GoRoute(path: '/explore/feed', builder: (context, state) => stop('feed', state)),
      GoRoute(path: '/learn/c/:key/cards', builder: (context, state) => stop('cards', state)),
      GoRoute(path: '/learn/:unit', builder: (context, state) => stop('lesson', state)),
      GoRoute(path: '/practice', builder: (context, state) => stop('practice', state)),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ...learnFixtureOverrides(theApi, store: theStore),
        proNudgesOnProvider.overrideWithValue(nudges),
        hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: phone)),
      ],
      child: MaterialApp.router(
        debugShowCheckedModeBanner: false,
        theme: buildTheme(Brightness.light),
        darkTheme: buildTheme(Brightness.dark),
        themeMode: brightness == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
        routerConfig: router,
        builder: (context, app) => MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale), disableAnimations: disableAnimations),
          child: app!,
        ),
      ),
    ),
  );
  if (settle) await settleChapter(tester);
  return ChapterHarness(api: theApi, visited: visited, store: theStore, phone: phone, router: router);
}

/// The key of a pile on the page.
Finder pileFinder(String id) => find.byKey(ValueKey('pile-$id'));

/// The words of a Start key (a KeyButton's label).
Finder textOf(String text) => find.text(text);

/// A phone that has been used: the store starts with [values].
MemoryPrefsStore storeWith(Map<String, Object> values) => MemoryPrefsStore()..values.addAll(values);
