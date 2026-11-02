// What the Learn home tests and goldens share: the fixture server with a part choice the home's own save reads back, a Key
// cards API whose save can wait or fail, the shared practice subject held by a fake, and a plain scrollable page to put
// LearnHome in (it is embedded content: Practice owns the title, the pull and the scroll).
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/keycards/data/keycards_api.dart';
import 'package:mockmob/features/keycards/data/keycards_providers.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/data/learn_prefs.dart';
import 'package:mockmob/features/learn2/data/learn_providers.dart';
import 'package:mockmob/features/learn2/home/learn_home.dart' show LearnHome;
import 'package:mockmob/features/practice/data/practice_catalog.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;

import '../support/fixture_learn_api.dart';

/// The shared practice subject, held at one value (select writes it, as Practice's does, without the account).
class HomeSubjectFake extends PracticeSubject {
  HomeSubjectFake([this.initial = 'accountancy']);

  final String initial;

  @override
  String build() => initial;

  @override
  void select(String id) => state = id;
}

/// The fixture server, plus what the home's save changes: the part choice (`chosen`, by part id) shows in the next read of
/// the subject, and `thin` turns the subject into one with no Key cards (English-like: chapters with questions only).
class HomeLearnApi extends FixtureLearnApi {
  HomeLearnApi({super.pro, super.newStudent, super.freeUsed, super.offline, super.error, super.slow, super.failOn, this.thin = false, this.subjectsOnly, this.edit});

  final Map<String, String> chosen = {};
  bool thin;

  /// The student's subjects as the server lists them (`subjects` of the body), cut to these ids; one id is a student with one subject.
  List<String>? subjectsOnly;

  /// A change to the recorded body before it is read (the roadmap's rows, a chapter), for a case no recording holds.
  void Function(Map<String, dynamic> body)? edit;

  /// Reads of Learn home (a refresh is one more): the home is ONE read, the subject body and the shelves together.
  int subjectReads = 0;

  @override
  Future<LearnSubjectData> home(String subject) async {
    final data = await super.home(subject);
    subjectReads++;
    if (chosen.isEmpty && !thin && subjectsOnly == null && edit == null) return data;
    final j = jsonDecode(jsonEncode(data.raw)) as Map<String, dynamic>;
    final only = subjectsOnly;
    if (only != null) j['subjects'] = [for (final s in (j['subjects'] as List).cast<Map<String, dynamic>>()) if (only.contains(s['id'])) s];
    edit?.call(j);
    for (final p in (j['parts'] as List).cast<Map<String, dynamic>>()) {
      final option = p['option'];
      if (option is Map && chosen[p['id']] != null) option['chosen'] = chosen[p['id']];
      if (!thin) continue;
      for (final u in (p['units'] as List).cast<Map<String, dynamic>>()) {
        for (final c in (u['chapters'] as List).cast<Map<String, dynamic>>()) {
          c['cards'] = 0;
          c['meta'] = null;
        }
      }
    }
    if (thin) (j['subject'] as Map)['cards'] = 0;
    return LearnSubjectData.parse(j);
  }
}

/// A server that never answers (the loading state, held for a golden: no timer is left pending).
class HoldLearnApi extends HomeLearnApi {
  HoldLearnApi() : _hold = Completer<void>();

  final Completer<void> _hold;

  @override
  Future<LearnSubjectData> home(String subject) async {
    await _hold.future;
    return super.home(subject);
  }
}

/// Key cards' save of the part choice, which can wait on [gate] or fail. A save that goes through tells the fixture server.
class HomeKeyCards extends OffKeyCardsApi {
  HomeKeyCards(this.api, {this.fail = false, this.gate});

  final HomeLearnApi api;
  bool fail;
  Completer<void>? gate;
  final List<String> saved = [];

  @override
  Future<({String subject, String option})> setOption({required String subject, required String option}) async {
    saved.add(option);
    await gate?.future;
    if (fail) throw StateError('the save failed');
    api.chosen['p2'] = option;
    return (subject: subject, option: option);
  }
}

const List<String> homeSubjects = ['accountancy', 'economics', 'business_studies', 'english'];

/// The overrides Learn home needs under test.
List<Override> homeOverrides(
  HomeLearnApi api, {
  HomeKeyCards? keyCards,
  String subject = 'accountancy',
  List<String> subjects = homeSubjects,
  bool nudges = false,
  PrefsStore? store,
}) => [
  learnApiProvider.overrideWithValue(api),
  learn2PrefsStoreProvider.overrideWithValue(store ?? MemoryPrefsStore()),
  practiceSubjectProvider.overrideWith(() => HomeSubjectFake(subject)),
  authSnapshotProvider.overrideWithBuild((ref, n) => AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', isPro: api.pro, subjects: subjects)),
  proNudgesOnProvider.overrideWithValue(nudges),
  keyCardsApiProvider.overrideWithValue(keyCards ?? const OffKeyCardsApi()),
];

/// LearnHome in a plain page that scrolls, as Practice's list holds it.
class HomePage extends StatelessWidget {
  const HomePage({super.key, this.subject, this.find = false, this.query, this.controller, this.bottom = MmSpace.s32, this.header = 0});

  final String? subject;
  final bool find;
  final String? query;
  final ScrollController? controller;

  /// Room under the page (Practice's list has a lot under the Learn door's blocks).
  final double bottom;

  /// What stands above Learn home in Practice's list (the title and the Learn door's switch), as empty room.
  final double header;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: context.mmColors.ground,
    body: SafeArea(
      child: SingleChildScrollView(
        controller: controller,
        padding: EdgeInsets.only(top: MmSpace.s8, bottom: bottom),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (header > 0) SizedBox(height: header),
            LearnHome(subject: subject, find: find, query: query),
          ],
        ),
      ),
    ),
  );
}

/// Every location a key took the student to in the test, in order.
final List<Uri> homeVisited = [];

/// The page a pushed location lands on in a test (the real screens belong to other packets).
class HomeLanding extends StatelessWidget {
  HomeLanding({super.key, required this.what, required Uri uri}) {
    homeVisited.add(uri);
  }

  final String what;

  @override
  Widget build(BuildContext context) => Scaffold(body: Center(child: Text('landed on $what')));
}

/// A router with Learn home at `/` and a landing page for every place a key can go.
GoRouter homeRouter({String? subject, bool find = false, String? query, ScrollController? controller, double bottom = MmSpace.s32, double header = 0}) => GoRouter(
  routes: [
    GoRoute(path: '/', builder: (context, state) => HomePage(subject: subject, find: find, query: query, controller: controller, bottom: bottom, header: header)),
    GoRoute(path: '/learn/session', builder: (context, state) => HomeLanding(what: 'a run', uri: state.uri)),
    GoRoute(path: '/explore/feed', builder: (context, state) => HomeLanding(what: 'a feed', uri: state.uri)),
    GoRoute(path: '/explore', builder: (context, state) => HomeLanding(what: 'Explore', uri: state.uri)),
    GoRoute(path: '/learn/c/:chapterKey', builder: (context, state) => HomeLanding(what: 'a chapter', uri: state.uri)),
    GoRoute(path: '/learn/c/:chapterKey/cards', builder: (context, state) => HomeLanding(what: 'the cards', uri: state.uri)),
    GoRoute(path: '/review/revise', builder: (context, state) => HomeLanding(what: 'Revise', uri: state.uri)),
  ],
);

/// Learn home on the phone's width (360 dp), through a router, in [brightness].
Future<GoRouter> pumpHome(
  WidgetTester tester, {
  required List<Override> overrides,
  Brightness brightness = Brightness.dark,
  Size size = const Size(360, 800),
  double textScale = 1,
  bool disableAnimations = true,
  String? subject,
  bool find = false,
  String? query,
  ScrollController? controller,
  double bottom = MmSpace.s32,
  double header = 0,
}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  homeVisited.clear();
  final router = homeRouter(subject: subject, find: find, query: query, controller: controller, bottom: bottom, header: header);
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
  return router;
}

/// Lets the reads land and the content settle.
Future<void> settleHome(WidgetTester tester) async {
  await tester.pump();
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

/// The last place a key took the student to.
Uri locationOf(GoRouter router) => homeVisited.last;
