// What the Cards view and Find tests and goldens share: the fixture server, a plain page that holds Find in the gutter of a
// scrolling column (as Learn home does), a router with a landing page for every place a key can take the student, and
// small readers of the render tree.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/learn2/cards/find_view.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;

import '../support/fixture_learn_api.dart';

/// The chapter the Cards view recordings hold (Admission of a Partner).
const String cardsChapter = l2Aop;

/// The overrides a Cards view or Find test needs: the fixture server, the shared subject, and whether Pro nudges exist
/// (See Pro appears only where they do).
List<Override> cardsOverrides(FixtureLearnApi api, {bool nudges = false, String subject = 'accountancy'}) => [
  ...learnFixtureOverrides(api, subject: subject),
  proNudgesOnProvider.overrideWithValue(nudges),
];

/// A server that never answers the reads the Cards view makes (the loading state, held with nothing left pending).
class HoldCardsApi extends FixtureLearnApi {
  HoldCardsApi({super.pro}) : gate = Completer<void>();

  final Completer<void> gate;

  @override
  Future<LearnChapterCards> chapterCards(String chapter, {String filter = 'all'}) async {
    await gate.future;
    return super.chapterCards(chapter, filter: filter);
  }

  @override
  Future<LearnSearch> search(String subject, String query) async {
    await gate.future;
    return super.search(subject, query);
  }
}

/// Every location a key took the student to, in order.
final List<Uri> cardsVisited = [];

/// The page a pushed location lands on in a test (the real screens belong to other packets).
class CardsLanding extends StatelessWidget {
  CardsLanding({super.key, required this.what, required Uri uri}) {
    cardsVisited.add(uri);
  }

  final String what;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('landed on $what'),
          TextButton(onPressed: () => context.pop(), child: const Text('back from landing')),
        ],
      ),
    ),
  );
}

/// Find in the gutter of a column that scrolls, where Learn home puts it. [query] is the field's text.
class FindPage extends StatelessWidget {
  const FindPage({super.key, required this.query, this.subject = 'accountancy', this.controller, this.bottom = MmSpace.s32});

  final ValueNotifier<String> query;
  final String subject;
  final ScrollController? controller;
  final double bottom;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: context.mmColors.ground,
    body: SafeArea(
      child: SingleChildScrollView(
        controller: controller,
        padding: EdgeInsets.only(top: MmSpace.s8, bottom: bottom),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: ValueListenableBuilder<String>(
            valueListenable: query,
            builder: (context, q, _) => FindPanel(subject: subject, query: q),
          ),
        ),
      ),
    ),
  );
}

GoRouter cardsRouter(Widget home) => GoRouter(
  routes: [
    GoRoute(path: '/', builder: (context, state) => home),
    GoRoute(path: '/learn/session', builder: (context, state) => CardsLanding(what: 'a run', uri: state.uri)),
    GoRoute(path: '/learn/c/:chapterKey', builder: (context, state) => CardsLanding(what: 'a chapter', uri: state.uri)),
    GoRoute(path: '/learn/c/:chapterKey/cards', builder: (context, state) => CardsLanding(what: 'the cards', uri: state.uri)),
    GoRoute(path: '/learn/:unitId', builder: (context, state) => CardsLanding(what: 'a lesson', uri: state.uri)),
  ],
);

/// [home] on the phone's width (360 dp), through a router, in [brightness].
Future<GoRouter> pumpCards(
  WidgetTester tester,
  Widget home, {
  required List<Override> overrides,
  Brightness brightness = Brightness.dark,
  Size size = const Size(360, 800),
  double textScale = 1,
  bool disableAnimations = true,
}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  cardsVisited.clear();
  final router = cardsRouter(home);
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
Future<void> settleCards(WidgetTester tester) async {
  await tester.pump();
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

/// Types [text] into Find's field stand-in and waits out the typing rest (240 ms) and the read.
Future<void> typeQuery(WidgetTester tester, ValueNotifier<String> query, String text) async {
  query.value = text;
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 260));
  await settleCards(tester);
}

/// Scrolls [f] to the middle of its scroll view (never under a pinned bar or the pick bar), taps it and lets the page settle.
Future<void> tapAt(WidgetTester tester, Finder f) async {
  await Scrollable.ensureVisible(tester.element(f.first), alignment: 0.5);
  await tester.pump();
  await tester.tap(f.first);
  await settleCards(tester);
}

/// [tapAt] for a row that is built but lies below the view (a list builds a little past its edge): found by key even then.
Future<void> tapKey(WidgetTester tester, Key key) async {
  await Scrollable.ensureVisible(tester.element(find.byKey(key, skipOffstage: false).first), alignment: 0.5);
  await tester.pump();
  await tester.tap(find.byKey(key).first);
  await settleCards(tester);
}

/// The last place a key took the student to.
Uri lastVisit() => cardsVisited.last;

/// The cards the run location names.
List<String> cardsOf(Uri uri) => (uri.queryParameters['cards'] ?? '').split(',').where((s) => s.isNotEmpty).toList();

/// Primary (volt) keys in the tree.
int voltKeys(WidgetTester tester) => tester.widgetList<KeyButton>(find.byType(KeyButton)).where((k) => k.variant == KeyVariant.primary).length;

/// The text of a `Text.rich` as plain words.
String plain(Text t) => t.textSpan?.toPlainText(includeSemanticsLabels: false) ?? t.data ?? '';

/// The words of the first rich text under [of] that begin with [start], with the underlined ones named.
List<String> underlined(WidgetTester tester, Finder of) {
  final out = <String>[];
  for (final t in tester.widgetList<Text>(find.descendant(of: of, matching: find.byType(Text)))) {
    final span = t.textSpan;
    if (span is! TextSpan) continue;
    void walk(InlineSpan s) {
      if (s is TextSpan) {
        if ((s.style?.decoration ?? TextDecoration.none) == TextDecoration.underline && s.text != null && s.text!.trim().isNotEmpty) out.add(s.text!);
        s.children?.forEach(walk);
      }
    }
    walk(span);
  }
  return out;
}
