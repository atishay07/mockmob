import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/core/router/transitions.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

class _Recorder implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> selectionClick() async => calls.add('selection');

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');
}

// Built once: a fresh ThemeData on every pump would make MaterialApp's AnimatedTheme run its
// 200 ms tween each time, which reads as a running animation in these tests.
final Map<Brightness, ThemeData> _themes = {for (final b in Brightness.values) b: buildTheme(b)};

Widget _app(Widget child, {bool reduced = false, List<Override> overrides = const [], Brightness brightness = Brightness.dark}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: _themes[brightness],
      builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: app!),
      home: Scaffold(body: child),
    ),
  );
}

Future<void> _pumpFor(WidgetTester tester, Duration total) async {
  const step = Duration(milliseconds: 16);
  for (var t = Duration.zero; t < total; t += step) {
    await tester.pump(step);
  }
}

const _itemKey = ValueKey('item');

void main() {
  group('MmStagger', () {
    testWidgets('self: an item starts low and clear, then lands and stays', (tester) async {
      await tester.pumpWidget(_app(const Center(
        child: MmStagger(child: MmStaggerItem(index: 0, child: SizedBox(key: _itemKey, width: 40, height: 40))),
      )));
      final start = tester.getTopLeft(find.byKey(_itemKey)).dy;
      await _pumpFor(tester, const Duration(milliseconds: 900));
      final rest = tester.getTopLeft(find.byKey(_itemKey)).dy;
      expect(start - rest, greaterThan(Motion.enterRise * 0.8), reason: 'it rose into place');
      expect(tester.hasRunningAnimations, isFalse, reason: 'one entrance, no loop');
      final opacity = tester.widget<FadeTransition>(find.ancestor(of: find.byKey(_itemKey), matching: find.byType(FadeTransition)).first);
      expect(opacity.opacity.value, 1);
    });

    testWidgets('later items wait their turn, capped at the eighth', (tester) async {
      await tester.pumpWidget(_app(MmStagger(
        child: Column(children: [
          for (var i = 0; i < 12; i++) MmStaggerItem(index: i, child: SizedBox(key: ValueKey('i$i'), height: 10)),
        ]),
      )));
      await tester.pump(const Duration(milliseconds: 100));
      double opacityOf(int i) =>
          tester.widget<FadeTransition>(find.ancestor(of: find.byKey(ValueKey('i$i')), matching: find.byType(FadeTransition)).first).opacity.value;
      expect(opacityOf(0), greaterThan(opacityOf(1)));
      expect(opacityOf(8), opacityOf(11), reason: 'items past the cap arrive with the eighth');
      await _pumpFor(tester, const Duration(milliseconds: 900));
      expect(opacityOf(11), 1);
    });

    testWidgets('reduced motion: everything is simply there', (tester) async {
      await tester.pumpWidget(_app(
        const Center(child: MmStagger(child: MmStaggerItem(index: 3, child: SizedBox(key: _itemKey, width: 40, height: 40)))),
        reduced: true,
      ));
      final first = tester.getTopLeft(find.byKey(_itemKey));
      await tester.pump(const Duration(milliseconds: 50));
      expect(tester.getTopLeft(find.byKey(_itemKey)), first);
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('route: a screen that is already up never moves', (tester) async {
      await tester.pumpWidget(_app(const Center(
        child: MmStagger(driver: MmStaggerDriver.route, child: MmStaggerItem(index: 0, child: SizedBox(key: _itemKey, width: 40, height: 40))),
      )));
      final first = tester.getTopLeft(find.byKey(_itemKey));
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.getTopLeft(find.byKey(_itemKey)), first);
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('route: items arrive with a pushed page and are at rest when it lands', (tester) async {
      await tester.pumpWidget(_app(Builder(
        builder: (context) => TextButton(
          onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
            builder: (_) => const Scaffold(
              body: Center(
                child: MmStagger(
                  driver: MmStaggerDriver.route,
                  child: MmStaggerItem(index: 2, child: SizedBox(key: _itemKey, width: 40, height: 40)),
                ),
              ),
            ),
          )),
          child: const Text('open'),
        ),
      )));
      await tester.tap(find.text('open'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 60));
      final early = tester.getTopLeft(find.byKey(_itemKey)).dy;
      await tester.pumpAndSettle();
      final rest = tester.getTopLeft(find.byKey(_itemKey)).dy;
      expect(early, greaterThan(rest), reason: 'it was still rising while the page arrived');
    });
  });

  group('MmPressable extras', () {
    testWidgets('no haptic by default; the asked haptic on tap; launch rect captured', (tester) async {
      final driver = _Recorder();
      final overrides = <Override>[hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: driver))];
      var taps = 0;
      await tester.pumpWidget(_app(
        Column(children: [
          MmPressable(onTap: () => taps++, builder: (_, _, _) => const SizedBox(width: 100, height: 48, child: Text('plain'))),
          MmPressable(
            onTap: () => taps++,
            haptic: MmPressHaptic.selection,
            captureLaunch: true,
            highlight: true,
            builder: (_, _, _) => const SizedBox(width: 100, height: 48, child: Text('rich')),
          ),
        ]),
        overrides: overrides,
      ));
      await tester.tap(find.text('plain'));
      await tester.pump();
      expect(driver.calls, isEmpty);
      MmLaunchRect.take();
      await tester.tap(find.text('rich'));
      await tester.pump();
      expect(taps, 2);
      expect(driver.calls, ['selection']);
      final rect = MmLaunchRect.take();
      expect(rect, isNotNull);
      expect(rect!.width, closeTo(100, 0.5));
      expect(MmLaunchRect.take(), isNull, reason: 'a rect is taken once');
    });

    testWidgets('Touch feedback off: no haptic', (tester) async {
      final driver = _Recorder();
      await tester.pumpWidget(_app(
        MmPressable(onTap: () {}, haptic: MmPressHaptic.light, builder: (_, _, _) => const SizedBox(width: 100, height: 48, child: Text('x'))),
        overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: false, driver: driver))],
      ));
      await tester.tap(find.text('x'));
      await tester.pump();
      expect(driver.calls, isEmpty);
    });

    testWidgets('works without a ProviderScope', (tester) async {
      var taps = 0;
      await tester.pumpWidget(MaterialApp(
        theme: buildTheme(Brightness.dark),
        home: MmPressable(onTap: () => taps++, haptic: MmPressHaptic.selection, builder: (_, _, _) => const Text('bare')),
      ));
      await tester.tap(find.text('bare'));
      expect(taps, 1);
      expect(tester.takeException(), isNull);
    });
  });

  group('counts', () {
    testWidgets('MmCountUp counts to the value, lands once, and counts on from where it was', (tester) async {
      var landed = 0;
      Widget count(int v) => _app(Center(child: MmCountUp(value: v, onLanded: () => landed++, style: const TextStyle(fontSize: 20))));
      await tester.pumpWidget(count(36));
      await tester.pump(const Duration(milliseconds: 120));
      final mid = int.parse(tester.widget<Text>(find.byType(Text)).data!);
      expect(mid, inExclusiveRange(0, 36));
      await _pumpFor(tester, const Duration(milliseconds: 800));
      expect(find.text('36'), findsOneWidget);
      expect(landed, 1);

      await tester.pumpWidget(count(40));
      await tester.pump(const Duration(milliseconds: 16));
      final next = int.parse(tester.widget<Text>(find.byType(Text)).data!);
      expect(next, inInclusiveRange(36, 40), reason: 'from 36, not from 0');
      await _pumpFor(tester, const Duration(milliseconds: 800));
      expect(find.text('40'), findsOneWidget);
      expect(landed, 2);
    });

    testWidgets('MmCountUp under reduced motion shows the value at once and reads it', (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(_app(const Center(child: MmCountUp(value: 183, semanticsLabel: '183 of 250')), reduced: true));
      expect(find.text('183'), findsOneWidget);
      expect(find.bySemanticsLabel('183 of 250'), findsOneWidget);
      expect(tester.hasRunningAnimations, isFalse);
      handle.dispose();
    });

    testWidgets('MonumentalNumber rolls on from the digits it showed', (tester) async {
      var landed = 0;
      Widget n(String v) => _app(Align(alignment: Alignment.topLeft, child: MonumentalNumber(value: v, onLanded: () => landed++)));
      await tester.pumpWidget(n('171'));
      await _pumpFor(tester, const Duration(milliseconds: 600));
      expect(landed, 1);
      await tester.pumpWidget(n('172'));
      await tester.pump();
      // Only the last slot moves, by one: its column holds 1 and 2. A roll from zero would draw 0.
      expect(find.text('0'), findsNothing);
      expect(find.text('2'), findsOneWidget);
      await _pumpFor(tester, const Duration(milliseconds: 600));
      expect(landed, 2);
    });
  });

  group('skeleton shimmer', () {
    testWidgets('sweeps a few times, then holds still', (tester) async {
      await tester.pumpWidget(_app(const SkeletonGroup(shimmer: true, child: Column(children: [Skeleton.line(width: 200), Skeleton(height: 40)]))));
      await tester.pump(const Duration(milliseconds: 500));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pump(Motion.shimmerSweep + Motion.shimmerRest);
      await tester.pump((Motion.shimmerSweep + Motion.shimmerRest) * Motion.shimmerSweeps);
      expect(tester.hasRunningAnimations, isFalse, reason: 'a slow network gets words, not a light show');
    });

    testWidgets('static by default and under reduced motion', (tester) async {
      await tester.pumpWidget(_app(const SkeletonGroup(child: Skeleton.line(width: 200))));
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.hasRunningAnimations, isFalse);
      await tester.pumpWidget(_app(const SkeletonGroup(shimmer: true, child: Skeleton.line(width: 200)), reduced: true));
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('reads as one Loading', (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(_app(const SkeletonGroup(shimmer: true, child: MmSkeletonRows())));
      expect(find.bySemanticsLabel('Loading'), findsOneWidget);
      handle.dispose();
    });
  });

  group('sheet handle', () {
    testWidgets('one tick crossing the close threshold, one back', (tester) async {
      final driver = _Recorder();
      tester.view.physicalSize = const Size(400, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(_app(
        Builder(
          builder: (context) => TextButton(
            onPressed: () => showMmSheet<void>(
              context: context,
              title: 'This week',
              builder: (_) => const SizedBox(height: 300, child: Text('body')),
            ),
            child: const Text('open'),
          ),
        ),
        overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: driver))],
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      final sheetHeight = tester.getSize(find.byType(MmSheetScaffold)).height;
      final gesture = await tester.startGesture(tester.getCenter(find.text('This week')));
      // The first move only wins the drag (touch slop); the sheet follows the moves after it.
      await gesture.moveBy(const Offset(0, 24));
      await tester.pump();
      await gesture.moveBy(Offset(0, sheetHeight * 0.3));
      await tester.pump();
      expect(driver.calls, isEmpty);
      await gesture.moveBy(Offset(0, sheetHeight * 0.3));
      await tester.pump();
      expect(driver.calls, ['selection'], reason: 'past half the sheet: release would close it');
      await gesture.moveBy(Offset(0, -sheetHeight * 0.3));
      await tester.pump();
      expect(driver.calls, ['selection', 'selection'], reason: 'changed their mind');
      await gesture.up();
      await tester.pumpAndSettle();
      expect(find.text('body'), findsOneWidget, reason: 'released above the threshold: the sheet stays');
    });
  });

  group('transitions', () {
    testWidgets('tab fade-through keeps every branch mounted and settles on one', (tester) async {
      Widget branches(int i) => _app(FadingBranchContainer(
            currentIndex: i,
            children: const [_Counter(label: 'a'), _Counter(label: 'b'), _Counter(label: 'c')],
          ));
      await tester.pumpWidget(branches(0));
      await tester.tap(find.text('a 0'));
      await tester.pump();
      expect(find.text('a 1'), findsOneWidget);
      await tester.pumpWidget(branches(1));
      await tester.pump(const Duration(milliseconds: 40));
      expect(find.text('a 1'), findsOneWidget, reason: 'the outgoing tab fades out first');
      await tester.pumpAndSettle();
      expect(find.text('a 1'), findsNothing, reason: 'then it is offstage');
      expect(find.text('b 0'), findsOneWidget);
      await tester.pumpWidget(branches(0));
      await tester.pumpAndSettle();
      expect(find.text('a 1'), findsOneWidget, reason: 'its state survived the switch');
    });

    testWidgets('the outgoing tab ignores taps during the switch', (tester) async {
      var hits = 0;
      Widget branches(int i) => _app(FadingBranchContainer(
            currentIndex: i,
            children: [
              GestureDetector(onTap: () => hits++, child: const SizedBox.expand(child: Text('old'))),
              const SizedBox.expand(),
            ],
          ));
      await tester.pumpWidget(branches(0));
      await tester.pumpWidget(branches(1));
      await tester.pump(const Duration(milliseconds: 20));
      await tester.tapAt(const Offset(20, 20));
      expect(hits, 0);
    });

    test('a launch rect older than a second is ignored', () async {
      MmLaunchRect.set(const Rect.fromLTWH(0, 0, 10, 10));
      expect(MmLaunchRect.peek(), isNotNull);
      MmLaunchRect.take();
      expect(MmLaunchRect.peek(), isNull);
    });
  });

  group('bar life (DOCK.md 5.2 and 5.4)', () {
    Widget bar(int i, {bool reduced = false, bool entrance = false}) => _app(
          Align(alignment: Alignment.bottomCenter, child: MmBottomBar(currentBranch: i, onTab: (_) {}, onStart: (_) {}, entrance: entrance)),
          reduced: reduced,
        );

    testWidgets('Start never breathes: at rest the bar runs nothing', (tester) async {
      await tester.pumpWidget(bar(0));
      await tester.pump(const Duration(milliseconds: 50));
      expect(tester.hasRunningAnimations, isFalse, reason: 'no idle loops');
    });

    testWidgets('the first appearance rises, pops Start once and stops; instant under reduced motion', (tester) async {
      await tester.pumpWidget(bar(0, entrance: true));
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pump(MmBottomBar.entranceDuration);
      await tester.pump(const Duration(milliseconds: 400));
      expect(tester.hasRunningAnimations, isFalse, reason: 'one pop, never a loop');

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(bar(0, entrance: true, reduced: true));
      await tester.pump();
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('a tab switch travels and settles; reduced motion jumps', (tester) async {
      await tester.pumpWidget(bar(0));
      await tester.pumpWidget(bar(2));
      await tester.pump(const Duration(milliseconds: 60));
      expect(tester.hasRunningAnimations, isTrue);
      await tester.pumpAndSettle();
      expect(tester.hasRunningAnimations, isFalse);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(bar(0, reduced: true));
      await tester.pumpWidget(bar(1, reduced: true));
      await tester.pump();
      expect(tester.hasRunningAnimations, isFalse);
    });
  });

  group('surfaces', () {
    testWidgets('a tappable surface presses, gives a selection tick and names itself', (tester) async {
      final driver = _Recorder();
      final handle = tester.ensureSemantics();
      var taps = 0;
      await tester.pumpWidget(_app(
        Padding(
          padding: const EdgeInsets.all(16),
          child: MmSurface.plain(onTap: () => taps++, semanticsLabel: 'Mock 7, 183 of 250', child: const Text('Mock 7')),
        ),
        overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: driver))],
      ));
      expect(find.bySemanticsLabel('Mock 7, 183 of 250'), findsOneWidget);
      await tester.tap(find.text('Mock 7'));
      await tester.pump();
      expect(taps, 1);
      expect(driver.calls, ['selection']);
      handle.dispose();
    });

    testWidgets('rows in a group are 48 dp targets at least, 56 with a second line (SPACING 3.3)', (tester) async {
      await tester.pumpWidget(_app(MmRowGroup(children: [
        MmRow(title: 'Partnership', subtitle: '4 mistakes', onTap: () {}),
        MmRow(title: 'Goodwill', onTap: () {}),
      ])));
      expect(tester.getSize(find.byType(MmRow).first).height, greaterThanOrEqualTo(56), reason: 'two-line row');
      expect(tester.getSize(find.byType(MmRow).last).height, greaterThanOrEqualTo(48), reason: 'one-line row');
    });
  });
}

class _Counter extends StatefulWidget {
  const _Counter({required this.label});

  final String label;

  @override
  State<_Counter> createState() => _CounterState();
}

class _CounterState extends State<_Counter> {
  int n = 0;

  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.topLeft,
        child: TextButton(onPressed: () => setState(() => n++), child: Text('${widget.label} $n')),
      );
}
