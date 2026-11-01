// What the Explore tests and goldens share: a Learn API that answers the covers from the recordings of
// test/fixtures/learn2/ (Pro, Free, Free with the day used, a new student, a feed to pick up) or fails, slowly or at
// once, and the provider overrides that put a student, their subjects and their feed length under the screen.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/data/learn_prefs.dart';
import 'package:mockmob/features/learn2/data/learn_providers.dart';
import 'package:mockmob/features/learn2/explore/explore_screen.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;

/// The recordings of `GET /api/learn/covers` (Accountancy, commerce student unless the name says new).
abstract final class CoversFixture {
  static const String pro = 'covers_accountancy_pro';
  static const String proOpen = 'covers_accountancy_pro_open';
  static const String free = 'covers_accountancy_free';
  static const String freeUsed = 'covers_accountancy_free_used';
  static const String newPro = 'covers_accountancy_new_pro';
  static const String newFree = 'covers_accountancy_new_free';

  /// The recording's JSON.
  static Map<String, dynamic> json(String name) => jsonDecode(File('test/fixtures/learn2/$name.json').readAsStringSync()) as Map<String, dynamic>;

  /// The recording, parsed.
  static LearnCovers read(String name) => LearnCovers.parse(json(name));
}

/// A Learn API that only knows the covers. [body] makes the answer (called at each read, so a test can change it);
/// [hold] keeps the answer pending until it completes; [fail] throws it once, then (when [failOnce]) answers.
class CoversApi extends OffLearnApi {
  CoversApi(this.body, {this.hold, this.fail, this.failOnce = false});

  /// An API that answers the recording [name].
  factory CoversApi.of(String name, {Completer<void>? hold, Object? fail, bool failOnce = false}) =>
      CoversApi(() => CoversFixture.json(name), hold: hold, fail: fail, failOnce: failOnce);

  Map<String, dynamic> Function() body;
  Completer<void>? hold;
  Object? fail;
  bool failOnce;

  /// The subjects asked, in order.
  final List<String> asked = [];

  @override
  Future<LearnCovers> covers(String subject) async {
    asked.add(subject);
    await hold?.future;
    final error = fail;
    if (error != null) {
      if (failOnce) fail = null;
      throw error;
    }
    return LearnCovers.parse(body());
  }
}

/// A haptic driver that counts what the phone was asked to do.
class CountingHaptics implements HapticDriver {
  int selection = 0;
  int light = 0;
  int medium = 0;

  @override
  Future<void> selectionClick() async => selection++;

  @override
  Future<void> lightImpact() async => light++;

  @override
  Future<void> mediumImpact() async => medium++;
}

/// The subject Practice and Learn share, fixed.
class FixedSubject extends PracticeSubject {
  FixedSubject(this.id);

  final String id;

  /// What was picked, in order.
  static final List<String> picked = [];

  @override
  String build() => id;

  @override
  void select(String id) {
    picked.add(id);
    state = id;
  }
}

/// Everything the Explore screen reads, with a student under it.
///
/// [subjects] are the student's own subjects (chips show with more than one), [minutes] the feed length kept on this
/// phone, [upgrade] whether the Pro nudges exist (they do with Play Billing on for a Free student).
List<Override> exploreOverrides(
  LearnApi api, {
  String subject = 'accountancy',
  List<String> subjects = const ['accountancy'],
  int? minutes,
  bool upgrade = true,
  HapticDriver? driver,
  MemoryPrefsStore? prefs,
}) {
  final store = prefs ?? MemoryPrefsStore();
  if (minutes != null) store.values[LearnPrefs.feedMinutesKey] = minutes;
  return [
    learnApiProvider.overrideWithValue(api),
    learn2PrefsStoreProvider.overrideWithValue(store),
    practiceSubjectProvider.overrideWith(() => FixedSubject(subject)),
    // The registry never answers: the chips come from the student's own subjects and the app's names.
    practiceSubjectsProvider.overrideWith((ref) => Completer<List<Subject>>().future),
    authSnapshotProvider.overrideWithBuild((ref, n) => AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', name: 'Riya', subjects: subjects)),
    proNudgesOnProvider.overrideWithValue(upgrade),
    if (driver != null) hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: driver)),
  ];
}

/// Settles a screen whose answer is already there: the read, the fade from the skeleton, the cover surfaces.
Future<void> settleExplore(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(milliseconds: 400));
}

/// The text of a `Text` or `Text.rich` widget, for a finder that cannot match a rich one.
String textOf(Widget w) => w is Text ? (w.data ?? w.textSpan?.toPlainText() ?? '') : '';

/// Puts the Explore screen under a router that knows the places it opens (a feed, the untimed questions, Practice), at
/// 360 by 800 dp unless said, and returns the router so a test can read where a tap went.
Future<GoRouter> pumpExplore(
  WidgetTester tester,
  List<Override> overrides, {
  Size size = const Size(360, 800),
  double textScale = 1,
  Brightness brightness = Brightness.dark,
  bool disableAnimations = true,
  String location = '/explore',
}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  opened.clear();
  Widget place(GoRouterState state, String words) {
    opened.add(state.uri.toString());
    return Scaffold(body: Center(child: Text(words)));
  }

  final router = GoRouter(
    initialLocation: location,
    routes: [
      GoRoute(path: '/explore', builder: (context, state) => ExploreScreen(subject: state.uri.queryParameters['subject'])),
      GoRoute(path: '/explore/feed', builder: (context, state) => place(state, 'A feed: ${state.uri.query}')),
      GoRoute(path: '/practice/stream', builder: (context, state) => place(state, 'The questions: ${state.uri.query}')),
      GoRoute(path: '/practice', builder: (context, state) => place(state, 'Practice')),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
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
  await settleExplore(tester);
  return router;
}

/// The places the page opened, in order ("/explore/feed?chapter=...").
final List<String> opened = [];

/// Where the last tap went, or the page itself when nothing was opened.
String whereIs(GoRouter router) => opened.isEmpty ? '/explore' : opened.last;
