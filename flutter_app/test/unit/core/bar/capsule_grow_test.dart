// Tonight's capsule grows from the hero key's rect to its slot (280 ms, rect and radius tween) and
// shrinks back toward the key when cleared; under reduced motion it only cross-fades.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../../helpers/golden_harness.dart';

RRect _glass(WidgetTester tester) {
  final clip = tester.widget<ClipRRect>(find.descendant(of: find.byType(LiveCapsule), matching: find.byType(ClipRRect)).first);
  final box = tester.renderObject<RenderBox>(find.descendant(of: find.byType(LiveCapsule), matching: find.byType(ClipRRect)).first);
  final local = clip.clipper!.getClip(box.size);
  return local.shift(box.localToGlobal(Offset.zero));
}

Future<ValueNotifier<BarLive?>> _pump(WidgetTester tester, {bool reduced = false}) async {
  final live = ValueNotifier<BarLive?>(null);
  addTearDown(live.dispose);
  await pumpMockmob(
    tester,
    Align(
      alignment: Alignment.bottomCenter,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 100),
        child: ValueListenableBuilder<BarLive?>(
          valueListenable: live,
          builder: (context, l, _) => LiveCapsule(live: l, width: 296, collapse: kAlwaysDismissedAnimation),
        ),
      ),
    ),
    size: const Size(360, 780),
    disableAnimations: reduced,
  );
  return live;
}

BarMove _move(Rect? origin) => BarMove(title: 'Accountancy repair', detail: '15 min', onStart: () {}, originRect: origin);

void main() {
  const origin = Rect.fromLTWH(24, 300, 312, 56);

  testWidgets('a move with an origin grows from that rect to its slot', (tester) async {
    final live = await _pump(tester);
    live.value = _move(origin);
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 16));
    final early = _glass(tester);
    expect(early.top, lessThan(480), reason: 'it starts at the key, far above its slot (about 634)');
    expect(early.height, greaterThan(44), reason: 'the key is taller than the capsule');
    await tester.pump(const Duration(milliseconds: 100));
    final mid = _glass(tester);
    expect(mid.top, greaterThan(early.top));
    await tester.pump(const Duration(milliseconds: 400));
    final end = _glass(tester);
    expect(end.height, closeTo(44, 0.1));
    expect(end.width, closeTo(296, 0.1));
    expect(end.top, greaterThan(mid.top));
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('it shrinks back toward the key when cleared, then leaves', (tester) async {
    final live = await _pump(tester);
    live.value = _move(origin);
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    final rest = _glass(tester);
    live.value = null;
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    final mid = _glass(tester);
    expect(mid.top, lessThan(rest.top), reason: 'on its way back up to the key');
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byType(ClipRRect), findsNothing);
  });

  testWidgets('a move without an origin rises as before (no grow)', (tester) async {
    final live = await _pump(tester);
    live.value = _move(null);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 16));
    final early = _glass(tester);
    expect(early.height, closeTo(44, 0.1));
    expect(early.width, closeTo(296, 0.1));
    await tester.pumpAndSettle();
  });

  testWidgets('under reduced motion the capsule only fades: same place, same size', (tester) async {
    final live = await _pump(tester, reduced: true);
    live.value = _move(origin);
    await tester.pump();
    final at = _glass(tester);
    await tester.pump(const Duration(milliseconds: 60));
    expect(_glass(tester), at);
    expect(at.height, closeTo(44, 0.1));
    await tester.pumpAndSettle();
    live.value = null;
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));
    expect(_glass(tester).top, at.top, reason: 'it fades where it is');
    await tester.pumpAndSettle();
  });

  test('originNow wins over the published rect', () {
    final m = BarMove(title: 't', onStart: () {}, originRect: origin, originNow: () => const Rect.fromLTWH(0, 0, 10, 10));
    expect(m.resolveOrigin(), const Rect.fromLTWH(0, 0, 10, 10));
    expect(_move(origin).resolveOrigin(), origin);
    expect(_move(null).resolveOrigin(), isNull);
  });
}
