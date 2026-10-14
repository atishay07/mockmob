import 'dart:async';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mobi_details.dart';
import 'package:mockmob/core/mascot/mobi_painter.dart';
import 'package:mockmob/core/mascot/mobi_palette.dart';
import 'package:mockmob/core/router/quick_start.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../core_data/support/fixtures.dart';

/// A bare themed app (no image settling), for tests that time their own frames.
Widget _app(Widget child, {bool reduced = false, double textScale = 1, List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.dark),
      builder: (context, app) => MediaQuery(
        data: MediaQuery.of(context).copyWith(disableAnimations: reduced, textScaler: TextScaler.linear(textScale)),
        child: app!,
      ),
      home: Scaffold(body: child),
    ),
  );
}

/// The on-screen scale of [finder]: its painted width over its laid-out width.
double _scaleOf(WidgetTester tester, Finder finder) => tester.getRect(finder).width / tester.getSize(finder).width;

Future<void> _pumpFor(WidgetTester tester, Duration total) async {
  const step = Duration(milliseconds: 16);
  for (var t = Duration.zero; t < total; t += step) {
    await tester.pump(step);
  }
}

void main() {
  group('Start sheet resume slot (navigation-04)', () {
    testWidgets('the Resume row and its lit edge are there before the count resolves', (tester) async {
      final draft = draftOf(endsAtWallMs: DateTime(2026, 10, 13, 22, 40).millisecondsSinceEpoch, count: 10);
      final count = Completer<ResumeOffer?>();
      await tester.pumpWidget(_app(
        const SingleChildScrollView(child: QuickStartSheet()),
        overrides: [
          resumeDraftProvider.overrideWith((ref) => draft),
          resumeOfferProvider.overrideWith((ref) => count.future),
        ],
      ));

      // First frame: the row is in place and lit, without a guessed count.
      expect(find.text('Resume Accountancy mock'), findsOneWidget);
      expect(find.ancestor(of: find.text('Resume Accountancy mock'), matching: find.byType(LitEdge)), findsOneWidget);
      expect(find.ancestor(of: find.text('Quick 10'), matching: find.byType(LitEdge)), findsNothing);
      final quickTop = tester.getTopLeft(find.text('Quick 10')).dy;

      count.complete(ResumeOffer(draft: draft, answered: 4));
      await tester.pump();
      await _pumpFor(tester, const Duration(milliseconds: 500));
      expect(find.text('Resume Accountancy mock'), findsOneWidget, reason: 'the title does not reflow when the count lands');
      expect(find.textContaining('4 of 10 answered'), findsOneWidget);
      expect(tester.getTopLeft(find.text('Quick 10')).dy, quickTop, reason: 'the rows below never jump');
      expect(find.ancestor(of: find.text('Quick 10'), matching: find.byType(LitEdge)), findsNothing);
    });

    testWidgets('a 50-question mock at 360 dp: the count lands on the note line and nothing moves', (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final draft = draftOf(endsAtWallMs: DateTime(2026, 10, 13, 22, 40).millisecondsSinceEpoch, count: 50);
      final count = Completer<ResumeOffer?>();
      await tester.pumpWidget(_app(
        const SingleChildScrollView(child: QuickStartSheet()),
        overrides: [
          resumeDraftProvider.overrideWith((ref) => draft),
          resumeOfferProvider.overrideWith((ref) => count.future),
        ],
      ));
      final titleTop = tester.getTopLeft(find.text('Resume Accountancy mock')).dy;
      final titleHeight = tester.getSize(find.text('Resume Accountancy mock')).height;
      final quickTop = tester.getTopLeft(find.text('Quick 10')).dy;

      count.complete(ResumeOffer(draft: draft, answered: 12));
      await tester.pump();
      await _pumpFor(tester, const Duration(milliseconds: 500));
      expect(tester.getTopLeft(find.text('Resume Accountancy mock')).dy, titleTop);
      expect(tester.getSize(find.text('Resume Accountancy mock')).height, titleHeight);
      expect(find.textContaining('12 of 50 answered'), findsOneWidget);
      expect(tester.getTopLeft(find.text('Quick 10')).dy, quickTop);
    });

    testWidgets('no draft: Quick 10 is lit and Ask Mobi about your marks is offered', (tester) async {
      await tester.pumpWidget(_app(
        const SingleChildScrollView(child: QuickStartSheet()),
        overrides: [
          resumeDraftProvider.overrideWith((ref) => null),
          resumeOfferProvider.overrideWith((ref) async => null),
        ],
      ));
      await _pumpFor(tester, const Duration(milliseconds: 500));
      expect(find.textContaining('Resume'), findsNothing);
      expect(find.ancestor(of: find.text('Quick 10'), matching: find.byType(LitEdge)), findsOneWidget);
      expect(find.text('Ask Mobi about your marks'), findsOneWidget);
      expect(find.text('Ask Mobi'), findsNothing);
      expect(find.byType(MobiCharacter), findsOneWidget, reason: 'Mobi sits in the sheet header (navigation-08)');
    });

    testWidgets('Mobi in the header is still under reduced motion', (tester) async {
      await tester.pumpWidget(_app(
        const SingleChildScrollView(child: QuickStartSheet()),
        reduced: true,
        overrides: [
          resumeDraftProvider.overrideWith((ref) => null),
          resumeOfferProvider.overrideWith((ref) async => null),
        ],
      ));
      await tester.pump();
      expect(find.byType(MobiCharacter), findsOneWidget);
      expect(tester.hasRunningAnimations, isFalse);
    });
  });

  group('morph sheet follows the finger (navigation-06)', () {
    Future<void> open(WidgetTester tester) async {
      await tester.pumpWidget(_app(Builder(
        builder: (context) => Center(
          child: TextButton(
            onPressed: () => Navigator.of(context).push(MorphSheetRoute<void>(
              origin: const Rect.fromLTWH(300, 700, 60, 60),
              scrim: Colors.black54,
              reduced: false,
              semanticsLabel: 'Quick start',
              builder: (context) => const SizedBox(height: 400, child: Center(child: Text('Sheet body'))),
            )),
            child: const Text('Open'),
          ),
        ),
      )));
      await tester.tap(find.text('Open'));
      await _pumpFor(tester, const Duration(milliseconds: 600));
      expect(find.text('Sheet body'), findsOneWidget);
    }

    testWidgets('a slow short drag follows, then springs back', (tester) async {
      await open(tester);
      final start = tester.getTopLeft(find.text('Sheet body')).dy;
      final gesture = await tester.startGesture(tester.getCenter(find.text('Sheet body')));
      for (var i = 0; i < 6; i++) {
        await gesture.moveBy(const Offset(0, 10));
        await tester.pump(const Duration(milliseconds: 100));
      }
      final followed = tester.getTopLeft(find.text('Sheet body')).dy - start;
      expect(followed, greaterThan(30), reason: 'the sheet moves with the finger');
      await gesture.up();
      await _pumpFor(tester, const Duration(milliseconds: 700));
      expect(find.text('Sheet body'), findsOneWidget);
      expect(tester.getTopLeft(find.text('Sheet body')).dy, closeTo(start, 0.5));
    });

    testWidgets('a slow drag past 30% of the height closes', (tester) async {
      await open(tester);
      await tester.timedDrag(find.text('Sheet body'), const Offset(0, 180), const Duration(seconds: 2));
      await _pumpFor(tester, const Duration(milliseconds: 600));
      expect(find.text('Sheet body'), findsNothing);
    });

    testWidgets('a quick flick closes', (tester) async {
      await open(tester);
      await tester.fling(find.text('Sheet body'), const Offset(0, 100), 1500);
      await _pumpFor(tester, const Duration(milliseconds: 600));
      expect(find.text('Sheet body'), findsNothing);
    });

    testWidgets('TalkBack has a Close action', (tester) async {
      final handle = tester.ensureSemantics();
      await open(tester);
      final node = tester.getSemantics(find.bySemanticsLabel('Quick start'));
      final data = node.getSemanticsData();
      expect(data.hasAction(SemanticsAction.dismiss), isTrue);
      expect(data.customSemanticsActionIds, isNotEmpty);
      final close = CustomSemanticsAction.getAction(data.customSemanticsActionIds!.first);
      expect(close?.label, 'Close');
      node.owner!.performAction(node.id, SemanticsAction.dismiss);
      await _pumpFor(tester, const Duration(milliseconds: 600));
      expect(find.text('Sheet body'), findsNothing);
      handle.dispose();
    });
  });

  group('one press physics (design-system-04)', () {
    testWidgets('a primary key reaches 0.96 and returns to 1', (tester) async {
      await tester.pumpWidget(_app(Center(child: KeyButton(label: 'Start repair', onPressed: () {}))));
      final label = find.text('Start repair');
      final gesture = await tester.startGesture(tester.getCenter(label));
      await _pumpFor(tester, const Duration(milliseconds: 400));
      expect(_scaleOf(tester, label), closeTo(0.96, 0.002));
      await gesture.up();
      await _pumpFor(tester, const Duration(milliseconds: 400));
      expect(_scaleOf(tester, label), closeTo(1, 0.002));
    });

    testWidgets('Start reaches 0.96 (not 0.90) and returns to 1', (tester) async {
      await tester.pumpWidget(_app(Center(child: StartButton(onPressed: () {}))));
      final face = find.byType(StartFace);
      final gesture = await tester.startGesture(tester.getCenter(face));
      await _pumpFor(tester, const Duration(milliseconds: 400));
      expect(_scaleOf(tester, face), closeTo(0.96, 0.002));
      await gesture.up();
      await _pumpFor(tester, const Duration(milliseconds: 400));
      expect(_scaleOf(tester, face), closeTo(1, 0.002));
    });

    testWidgets('under reduced motion the press is instant', (tester) async {
      await tester.pumpWidget(_app(Center(child: KeyButton(label: 'Go', onPressed: () {})), reduced: true));
      final gesture = await tester.startGesture(tester.getCenter(find.text('Go')));
      await tester.pump();
      expect(_scaleOf(tester, find.text('Go')), closeTo(0.96, 0.002));
      await gesture.up();
      await tester.pump();
      expect(_scaleOf(tester, find.text('Go')), closeTo(1, 0.002));
    });
  });

  group('split dock compact state (design-system-01)', () {
    Widget dock(ValueNotifier<bool> compact) => Align(
          alignment: Alignment.bottomCenter,
          child: SplitDock(currentIndex: 0, onTab: (_) {}, onStart: (_) {}, compact: compact),
        );

    testWidgets('mounted while compact, under reduced motion: 8 dp lower at 0.94', (tester) async {
      final compact = ValueNotifier(true);
      addTearDown(compact.dispose);
      await tester.pumpWidget(_app(dock(ValueNotifier(false)), reduced: true));
      final restBottom = tester.getRect(find.byType(DockPill)).bottom;
      final restSize = tester.getSize(find.byType(DockPill));

      await tester.pumpWidget(_app(dock(compact), reduced: true));
      await tester.pump();
      final rect = tester.getRect(find.byType(DockPill));
      expect(rect.height / restSize.height, closeTo(0.94, 0.001));
      expect(rect.bottom - restBottom, closeTo(8, 0.01));

      compact.value = false;
      await tester.pump();
      expect(_scaleOf(tester, find.byType(DockPill)), closeTo(1, 0.001), reason: 'reduced motion jumps back');
    });

    testWidgets('mounted while compact with motion: compact from the first frame', (tester) async {
      final compact = ValueNotifier(true);
      addTearDown(compact.dispose);
      await tester.pumpWidget(_app(dock(compact)));
      expect(_scaleOf(tester, find.byType(DockPill)), closeTo(0.94, 0.001));
    });
  });

  group('dock answer-bubble ink (navigation-03)', () {
    bool isInk(Widget w) =>
        w is DecoratedBox && w.decoration is BoxDecoration && (w.decoration as BoxDecoration).shape == BoxShape.circle;

    testWidgets('the landing tab inks, then the ink clears', (tester) async {
      Widget pill(int i) => Center(child: DockPill(currentIndex: i, onTap: (_) {}));
      await tester.pumpWidget(_app(pill(0)));
      await _pumpFor(tester, const Duration(milliseconds: 500));
      expect(find.byWidgetPredicate(isInk), findsNothing);

      await tester.pumpWidget(_app(pill(2)));
      await tester.pump(const Duration(milliseconds: 60));
      expect(find.byWidgetPredicate(isInk), findsOneWidget);
      await _pumpFor(tester, const Duration(milliseconds: 500));
      expect(find.byWidgetPredicate(isInk), findsNothing);
    });

    testWidgets('no ink under reduced motion', (tester) async {
      Widget pill(int i) => Center(child: DockPill(currentIndex: i, onTap: (_) {}));
      await tester.pumpWidget(_app(pill(0), reduced: true));
      await tester.pumpWidget(_app(pill(1), reduced: true));
      await tester.pump(const Duration(milliseconds: 60));
      expect(find.byWidgetPredicate(isInk), findsNothing);
    });
  });

  group('MobiLoader (design-system-06)', () {
    testWidgets('nothing for 300 ms, then Mobi loading, then the status line after a second', (tester) async {
      await tester.pumpWidget(_app(const MobiLoader(status: 'Opening your record')));
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.byType(MobiCharacter), findsNothing);
      expect(find.text('Opening your record'), findsNothing);

      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(MobiCharacter), findsOneWidget);
      // MOBI-04: a wait plays the loading scan; think is kept for the error state.
      expect(tester.widget<MobiCharacter>(find.byType(MobiCharacter)).entrance, MobiAct.loading);
      final early = tester.widget<AnimatedOpacity>(find.byType(AnimatedOpacity));
      expect(early.opacity, 0, reason: 'the line waits for a slow load');

      await tester.pump(const Duration(milliseconds: 700));
      expect(tester.widget<AnimatedOpacity>(find.byType(AnimatedOpacity)).opacity, 1);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('Mobi is centred from the first frame and does not move when the line appears', (tester) async {
      await tester.pumpWidget(_app(const SizedBox(width: 360, child: MobiLoader(status: 'Opening your record'))));
      await tester.pump(const Duration(milliseconds: 350));
      final screenCentre = tester.getCenter(find.byType(MobiLoader)).dx;
      final before = tester.getCenter(find.byType(MobiCharacter));
      expect(before.dx, closeTo(screenCentre, 0.5));

      await tester.pump(const Duration(milliseconds: 800));
      expect(tester.getCenter(find.byType(MobiCharacter)), before);
      expect(find.text('Opening your record'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('a fast load never shows it', (tester) async {
      await tester.pumpWidget(_app(const MobiLoader()));
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pumpWidget(_app(const Text('Loaded')));
      await tester.pump(const Duration(seconds: 2));
      expect(find.byType(MobiCharacter), findsNothing);
    });

    testWidgets('Skeleton is flat and takes a shape', (tester) async {
      await tester.pumpWidget(_app(const Column(children: [Skeleton.circle(size: 40), Skeleton.line(width: 80)])));
      final boxes = tester.widgetList<DecoratedBox>(find.descendant(of: find.byType(Skeleton), matching: find.byType(DecoratedBox)));
      for (final b in boxes) {
        final d = b.decoration as ShapeDecoration;
        expect(d.gradient, isNull);
      }
      expect((boxes.first.decoration as ShapeDecoration).shape, isA<CircleBorder>());
    });
  });

  group('labels follow text size (design-system-05)', () {
    Future<double> gridHeight(WidgetTester tester, double scale) async {
      await tester.pumpWidget(_app(
        Center(child: BubbleGrid(states: List.filled(20, BubbleState.hollow))),
        textScale: scale,
      ));
      return tester.getSize(find.descendant(of: find.byType(BubbleGrid), matching: find.byType(CustomPaint)).first).height;
    }

    testWidgets('the grid grows its number rows up to 1.3x, then hides the numbers', (tester) async {
      final base = await gridHeight(tester, 1);
      final bigger = await gridHeight(tester, 1.3);
      final hidden = await gridHeight(tester, 2);
      expect(bigger, greaterThan(base));
      expect(hidden, lessThan(base), reason: 'no number rows at 2x');
      final handle = tester.ensureSemantics();
      expect(find.bySemanticsLabel(RegExp('0 right, 0 wrong, 20 left blank')), findsOneWidget);
      handle.dispose();
    });

    testWidgets('the week row grows with the initials', (tester) async {
      Future<double> height(double scale) async {
        await tester.pumpWidget(_app(
          Center(child: WeekBubbles(days: List.filled(7, const WeekBubbleDay()))),
          textScale: scale,
        ));
        return tester.getSize(find.descendant(of: find.byType(WeekBubbles), matching: find.byType(CustomPaint)).first).height;
      }

      final base = await height(1);
      expect(await height(2), base + 11);
    });

    testWidgets('a monumental number shrinks to fit a 360 dp phone at 2x', (tester) async {
      tester.view.physicalSize = const Size(720, 1400);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(_app(
        const Padding(padding: EdgeInsets.all(16), child: Align(alignment: Alignment.topLeft, child: MonumentalNumber(value: '183', unit: 'of 250'))),
        textScale: 2,
      ));
      await _pumpFor(tester, const Duration(milliseconds: 700));
      expect(tester.takeException(), isNull);
      expect(tester.getRect(find.byType(MonumentalNumber)).right, lessThanOrEqualTo(344.5));
    });
  });

  test('the lit tile pane lives in MmColors with the values the dock always used', () {
    expect(MmColors.dark.litTile.toARGB32(), 0x1FFFF6E4);
    expect(MmColors.light.litTile.toARGB32(), MmColors.light.ink.withValues(alpha: 0.07).toARGB32());
  });

  group('Mobi points at a target under reduced motion', () {
    Future<MobiRig> pointRig(WidgetTester tester, Offset target, {required bool reduced}) async {
      final controller = MobiController();
      await tester.pumpWidget(_app(
        Center(child: MobiCharacter(controller: controller, size: 160, entrance: MobiAct.point)),
        reduced: reduced,
      ));
      await tester.pump();
      controller.pointAt(target);
      await tester.pump(const Duration(milliseconds: 50));
      final painter = tester.widgetList<CustomPaint>(find.byType(CustomPaint)).map((c) => c.painter).whereType<MobiPainter>().first;
      return painter.rig.value;
    }

    testWidgets('the still pose aims the arm at the target instead of the default angle', (tester) async {
      final centre = tester.view.physicalSize.center(Offset.zero) / tester.view.devicePixelRatio;
      // Straight below Mobi: the arm hangs well below the 1.5 rad default (almost level).
      final rig = await pointRig(tester, centre + const Offset(30, 300), reduced: true);
      final arm = rig.armR.point > 0.5 ? rig.armR : rig.armL;
      expect(arm.point, 1);
      expect(arm.angle, lessThan(0.9), reason: 'down at the target, not the default 1.5');
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('a target to the left points with the left arm', (tester) async {
      final centre = tester.view.physicalSize.center(Offset.zero) / tester.view.devicePixelRatio;
      final rig = await pointRig(tester, centre + const Offset(-200, 40), reduced: true);
      expect(rig.armL.point, 1);
      expect(rig.armR.point, isNot(1));
      await tester.pumpWidget(const SizedBox());
    });
  });

  group('Mobi semantics (mascot-06)', () {
    testWidgets('a labelled interactive Mobi is a button TalkBack can press', (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(_app(const Center(child: MobiCharacter(semanticLabel: 'Mobi', interactive: true, size: 80))));
      final data = tester.getSemantics(find.bySemanticsLabel('Mobi')).getSemanticsData();
      expect(data.flagsCollection.isButton, isTrue);
      expect(data.hasAction(SemanticsAction.tap), isTrue);
      await tester.pumpWidget(const SizedBox());
      handle.dispose();
    });

    testWidgets('a decorative Mobi stays out of TalkBack', (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(_app(const Center(child: MobiCharacter(interactive: true, size: 80))));
      expect(find.bySemanticsLabel('Mobi'), findsNothing);
      final node = tester.getSemantics(find.byType(MobiCharacter));
      expect(node.getSemanticsData().hasAction(SemanticsAction.tap), isFalse);
      await tester.pumpWidget(const SizedBox());
      handle.dispose();
    });
  });

  group('Mobi painter cache (mascot-05)', () {
    Future<Uint8List> render(MobiRig rig, MobiPalette palette) async {
      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder);
      canvas.scale(2);
      paintRig(canvas, rig, palette);
      final picture = recorder.endRecording();
      final image = await picture.toImage(280, 336);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
      image.dispose();
      picture.dispose();
      return bytes!.buffer.asUint8List();
    }

    List<MobiRig> rigs() {
      final sim = MobiSim(seed: 11);
      final frames = <MobiRig>[for (final act in MobiAct.values) MobiMoves.keyPose(act)];
      sim.play(MobiAct.cheer);
      for (var i = 0; i < 40; i++) {
        final rig = sim.step(1 / 30);
        if (i % 5 == 0) frames.add(rig);
      }
      return frames;
    }

    testWidgets('cached painting matches fresh painting', (tester) async {
      await tester.runAsync(() async {
        final frames = rigs();
        for (final night in [true, false]) {
          final palette = MobiPalette.of(night: night);
          MobiPaintCache.enabled = false;
          MobiDetails.cacheShaders = false;
          final fresh = [for (final f in frames) await render(f, palette)];
          MobiPaintCache.enabled = true;
          MobiDetails.cacheShaders = true;
          MobiPaintCache.clear();
          // Twice, in opposite orders, so a stale cache entry would show.
          for (final order in [frames, frames.reversed.toList()]) {
            for (final f in order) {
              final cached = await render(f, palette);
              final expected = fresh[frames.indexOf(f)];
              var worst = 0;
              for (var i = 0; i < cached.length; i++) {
                final d = (cached[i] - expected[i]).abs();
                if (d > worst) worst = d;
              }
              expect(worst, lessThanOrEqualTo(2), reason: 'night: $night, frame ${frames.indexOf(f)}');
            }
          }
        }
      });
      MobiPaintCache.enabled = true;
      MobiDetails.cacheShaders = true;
    });

    test('limb paints are reused', () {
      expect(identical(MobiPaintCache.limb(const Color(0xFF000000), 6), MobiPaintCache.limb(const Color(0xFF000000), 6)), isTrue);
    });
  });
}
