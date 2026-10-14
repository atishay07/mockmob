import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';
import 'package:mockmob/core/art/emblem_painter.dart';
import 'package:mockmob/core/motion/reduced_motion.dart';
import 'package:mockmob/core/theme/theme.dart';

// One ThemeData per brightness: a fresh (unequal) theme on every pump would start
// MaterialApp's theme animation and hide whether the emblem itself is animating.
final Map<Brightness, ThemeData> _themes = {};

Future<void> _pump(WidgetTester tester, Widget child, {bool disableAnimations = false, Brightness brightness = Brightness.dark}) {
  return tester.pumpWidget(
    MaterialApp(
      theme: _themes.putIfAbsent(brightness, () => buildTheme(brightness)),
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: disableAnimations),
        child: Scaffold(body: Center(child: child)),
      ),
    ),
  );
}

void main() {
  testWidgets('every subject draws at every detail level in both themes', (tester) async {
    for (final b in Brightness.values) {
      await _pump(
        tester,
        Wrap(children: [
          for (final s in [...SubjectIdentity.subjects.map((s) => s.id), 'hindi', 'fine_arts'])
            for (final size in const [24.0, 56.0, 112.0]) ...[
              SubjectEmblem(subject: s, size: size),
              SubjectEmblem(subject: s, size: size, marked: false, framed: false),
            ],
        ]),
        brightness: b,
      );
      expect(tester.takeException(), isNull);
    }
    expect(find.byType(SubjectEmblem), findsNWidgets(17 * 3 * 2));
  });

  testWidgets('static pictures are cached and bounded', (tester) async {
    EmblemPictures.clear();
    Widget all() => Wrap(children: [
          for (final s in SubjectIdentity.subjects)
            for (final size in const [24.0, 56.0, 112.0]) SubjectEmblem(subject: s.id, size: size),
        ]);
    await _pump(tester, all());
    final first = EmblemPictures.length;
    expect(first, 15 * 3 * 3);
    await _pump(tester, KeyedSubtree(key: UniqueKey(), child: all()));
    expect(EmblemPictures.length, first);
  });

  testWidgets('idle motion runs only when asked for', (tester) async {
    await _pump(tester, const SubjectEmblem(subject: 'physics', size: 96));
    await tester.pump(const Duration(seconds: 1));
    expect(tester.hasRunningAnimations, isFalse);

    await _pump(tester, const SubjectEmblem(subject: 'physics', size: 96, animate: true));
    await tester.pump(const Duration(seconds: 1));
    expect(tester.hasRunningAnimations, isTrue);

    await _pump(tester, const SubjectEmblem(subject: 'physics', size: 96));
    await tester.pump();
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('reduced motion (system) stops the idle drift', (tester) async {
    await _pump(tester, const SubjectEmblem(subject: 'chemistry', size: 96, animate: true), disableAnimations: true);
    await tester.pump(const Duration(seconds: 1));
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('reduced motion (in-app setting) stops the idle drift', (tester) async {
    await _pump(
      tester,
      const ReducedMotionSetting(enabled: true, child: SubjectEmblem(subject: 'chemistry', size: 96, animate: true)),
    );
    await tester.pump(const Duration(seconds: 1));
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('marking inks the bubble over 260 ms, and snaps under reduced motion', (tester) async {
    await _pump(tester, const SubjectEmblem(subject: 'english', size: 56, marked: false));
    await _pump(tester, const SubjectEmblem(subject: 'english', size: 56, marked: true));
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.hasRunningAnimations, isTrue);
    await tester.pumpAndSettle();
    expect(tester.hasRunningAnimations, isFalse);

    await _pump(tester, const SubjectEmblem(subject: 'english', size: 56, marked: false), disableAnimations: true);
    await tester.pump();
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('decorative by default; labelled when asked', (tester) async {
    final handle = tester.ensureSemantics();
    await _pump(tester, const SubjectEmblem(subject: 'history', size: 56));
    expect(find.bySemanticsLabel('History'), findsNothing);
    await _pump(tester, const SubjectEmblem(subject: 'history', size: 56, semanticLabel: 'History'));
    expect(find.bySemanticsLabel('History'), findsOneWidget);
    handle.dispose();
  });

  testWidgets('an emblem takes exactly its size', (tester) async {
    await _pump(tester, const SubjectEmblem(subject: 'geography', size: 44));
    expect(tester.getSize(find.byType(SubjectEmblem)), const Size(44, 44));
  });
}
