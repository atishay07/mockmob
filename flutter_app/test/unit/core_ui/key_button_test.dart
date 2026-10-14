import 'dart:ui' show Tristate;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/golden_harness.dart';

class _FakeDriver implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> selectionClick() async => calls.add('selection');

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');
}

double _depth(WidgetTester tester) => tester.widget<KeyButtonFace>(find.byType(KeyButtonFace)).depth;

void main() {
  late _FakeDriver driver;

  setUp(() => driver = _FakeDriver());

  List<Override> haptics({bool enabled = true}) => [
        hapticsProvider.overrideWithValue(Haptics(enabled: enabled, driver: driver)),
      ];

  testWidgets('commits on release with the settle haptic', (tester) async {
    var presses = 0;
    await pumpMockmob(
      tester,
      Center(child: KeyButton(label: 'Start repair', onPressed: () => presses++)),
      overrides: haptics(),
    );

    final gesture = await tester.startGesture(tester.getCenter(find.text('Start repair')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(presses, 0, reason: 'nothing commits on pointer down');
    expect(_depth(tester), closeTo(1, 0.01), reason: 'the face is flush while held');

    await gesture.up();
    await tester.pump();
    expect(presses, 1);
    expect(driver.calls, ['light']);

    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump(const Duration(milliseconds: 200));
    expect(_depth(tester), closeTo(0, 0.01), reason: 'the face returns after release');
  });

  testWidgets('does not commit when the pointer leaves', (tester) async {
    var presses = 0;
    await pumpMockmob(
      tester,
      Center(child: KeyButton(label: 'Start repair', onPressed: () => presses++)),
      overrides: haptics(),
    );
    final gesture = await tester.startGesture(tester.getCenter(find.text('Start repair')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(_depth(tester), closeTo(1, 0.01));
    await gesture.moveBy(const Offset(0, 300));
    await gesture.up();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(presses, 0);
    expect(driver.calls, isEmpty);
    expect(_depth(tester), closeTo(0, 0.01));
  });

  testWidgets('skips the haptic when touch feedback is off', (tester) async {
    var presses = 0;
    await pumpMockmob(
      tester,
      Center(child: KeyButton(label: 'Start repair', onPressed: () => presses++)),
      overrides: haptics(enabled: false),
    );
    await tester.tap(find.text('Start repair'));
    await tester.pump();
    expect(presses, 1);
    expect(driver.calls, isEmpty);
  });

  testWidgets('a disabled key ignores taps and shows its reason', (tester) async {
    await pumpMockmob(
      tester,
      const Center(child: KeyButton(label: 'Start repair', onPressed: null, disabledReason: 'Connect to start.')),
      overrides: haptics(),
    );
    expect(find.text('Connect to start.'), findsOneWidget);
    await tester.tap(find.text('Start repair'));
    await tester.pump(const Duration(milliseconds: 200));
    expect(_depth(tester), 0, reason: 'a disabled key is flush by itself, the press depth stays 0');
    expect(driver.calls, isEmpty);
  });

  testWidgets('a loading key keeps its width and ignores taps', (tester) async {
    var presses = 0;
    Widget key({required bool loading}) => Center(
          child: KeyButton(label: 'Send', expanded: false, loading: loading, onPressed: () => presses++),
        );

    await pumpMockmob(tester, key(loading: false), overrides: haptics());
    final idleWidth = tester.getSize(find.byType(KeyButtonFace)).width;

    await tester.pumpWidget(
      ProviderScope(
        overrides: haptics(),
        child: MaterialApp(home: Scaffold(body: key(loading: true))),
      ),
    );
    await tester.pump();
    final loadingWidth = tester.getSize(find.byType(KeyButtonFace)).width;
    expect(loadingWidth, idleWidth);

    await tester.tap(find.byType(KeyButtonFace));
    await tester.pump();
    expect(presses, 0);
  });

  testWidgets('an option exposes selected state and sits in a radio group', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpMockmob(
      tester,
      Center(child: KeyButton.option(label: 'Option B', selected: true, onPressed: () {})),
      overrides: haptics(),
    );
    final data = tester.getSemantics(find.bySemanticsLabel('Option B')).getSemanticsData();
    expect(data.flagsCollection.isSelected, Tristate.isTrue);
    expect(data.flagsCollection.isInMutuallyExclusiveGroup, isTrue);
    handle.dispose();
  });

  testWidgets('keyboard activation commits', (tester) async {
    var presses = 0;
    await pumpMockmob(
      tester,
      Center(child: KeyButton(label: 'Start repair', autofocus: true, onPressed: () => presses++)),
      overrides: haptics(),
    );
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pump();
    expect(presses, 1);
  });
}
