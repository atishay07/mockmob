import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/paper_reel/paper_reel.dart';

import '../../helpers/fonts.dart';
import '../../unit/paper_reel/reel_fixture.dart';

/// The paper reel (D29) at 412 dp, Night and Day: the sheet lighting mid-play, the hold on
/// "Q7: you changed a right answer to wrong.", the costliest chapter landing, and the end state
/// with its one next move. Plus the Today card and the result's "Play it back".
const _key = ValueKey('reel-golden');

Future<void> _host(WidgetTester tester, Widget child, {required Brightness b, Size size = const Size(412, 860), bool reduced = false, bool scroll = false}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      themeMode: b == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
      builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: app!),
      home: Builder(
        builder: (context) => Scaffold(
          backgroundColor: context.mmColors.ground,
          body: RepaintBoundary(
            key: _key,
            child: ColoredBox(
              color: context.mmColors.ground,
              child: scroll ? Padding(padding: const EdgeInsets.all(MmSpace.gutter), child: Column(children: [child])) : child,
            ),
          ),
        ),
      ),
    ),
  ));
}

Future<void> _shot(WidgetTester tester, String name) async {
  await expectLater(find.byKey(_key), matchesGoldenFile('goldens/$name.png'));
  final dir = Platform.environment['MM_PREVIEW_DIR'];
  if (dir == null || dir.isEmpty) return;
  final boundary = tester.renderObject<RenderRepaintBoundary>(find.byKey(_key));
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    await File('$dir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
  });
}

void main() {
  setUpAll(loadAppFonts);

  PaperReelModel model() => PaperReelModel.tryFrom(reelDetail(), subjectLabel: 'Accountancy')!;

  for (final b in Brightness.values) {
    final tag = b == Brightness.dark ? 'night' : 'day';

    Future<void> frame(WidgetTester tester, String name, int Function(PaperReelModel m) at) async {
      final m = model();
      await _host(tester, PaperReel(model: m, onNextMove: (_) {}, onClose: () {}, autoplay: false), b: b);
      tester.state<PaperReelState>(find.byType(PaperReel)).seekMs(at(m));
      await tester.pumpAndSettle();
      await _shot(tester, name);
    }

    testWidgets('reel mid sheet ($tag)', (tester) async {
      await frame(tester, 'reel_sheet_$tag', (m) => m.segments.firstWhere((s) => s.index == 3 && s.phase == ReelPhase.sheet).startMs + 200);
    });

    testWidgets('reel holds on a real moment ($tag)', (tester) async {
      await frame(tester, 'reel_moment_$tag', (m) => m.segments.firstWhere((s) => s.phase == ReelPhase.pause).startMs + 600);
    });

    testWidgets('reel lands on the costliest chapter ($tag)', (tester) async {
      await frame(tester, 'reel_chapter_$tag', (m) => m.segments.firstWhere((s) => s.phase == ReelPhase.chapter).endMs - 10);
    });

    testWidgets('reel end state ($tag)', (tester) async {
      await frame(tester, 'reel_end_$tag', (m) => m.totalMs);
    });

    testWidgets('entry cards ($tag)', (tester) async {
      await _host(
        tester,
        Column(
          children: [
            PaperReelTodayCard(subject: 'Accountancy', seconds: model().seconds, onPlay: () {}, onDismiss: () {}),
            const SizedBox(height: MmSpace.s24),
            PaperReelResultEntry(seconds: model().seconds, onPlay: () {}),
          ],
        ),
        b: b,
        size: const Size(412, 420),
        scroll: true,
      );
      await tester.pumpAndSettle();
      await _shot(tester, 'reel_entries_$tag');
    });
  }

  group('behaviour', () {
    testWidgets('skip is one tap to the end, then Done closes', (tester) async {
      var closed = 0;
      await _host(tester, PaperReel(model: model(), onNextMove: (_) {}, onClose: () => closed++), b: Brightness.dark);
      await tester.pump(const Duration(seconds: 2));
      expect(find.text('Skip'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('reel-skip')));
      await tester.pumpAndSettle();
      expect(find.text('Done'), findsOneWidget);
      expect(find.text('${model().finalMarks}'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('reel-skip')));
      await tester.pumpAndSettle();
      expect(closed, 1);
    });

    testWidgets('reduced motion shows the end state at once', (tester) async {
      ReelNextMove? got;
      await _host(tester, PaperReel(model: model(), onNextMove: (m) => got = m, onClose: () {}), b: Brightness.dark, reduced: true);
      await tester.pump();
      expect(find.text('Done'), findsOneWidget);
      expect(find.text('Accounting for share capital'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('reel-next-move')));
      await tester.pumpAndSettle();
      expect(got?.kind, ReelMoveKind.repairChapter);
    });

    testWidgets('plays through in about 20 s on its own', (tester) async {
      await _host(tester, PaperReel(model: model(), onNextMove: (_) {}, onClose: () {}), b: Brightness.light);
      await tester.pump(const Duration(seconds: 21));
      await tester.pumpAndSettle();
      expect(find.text('Done'), findsOneWidget);
    });
  });
}
