import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';
import 'package:mockmob/core/art/emblem_painter.dart';
import 'package:mockmob/core/art/emblem_subjects.dart';
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

  // The app turns the idle drift on in main(); tests keep it off so screens settle (TEST-01).
  void idleOn() {
    SubjectEmblem.idleEnabled = true;
    addTearDown(() => SubjectEmblem.idleEnabled = false);
  }

  testWidgets('tests keep the idle drift off, so pumpAndSettle settles', (tester) async {
    expect(SubjectEmblem.idleEnabled, isFalse);
    await _pump(tester, const SubjectEmblem(subject: 'physics', size: 96, animate: true));
    await tester.pumpAndSettle();
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('offstage (TickerMode off) the drift pauses and resumes when shown', (tester) async {
    idleOn();
    Widget at(bool on) => TickerMode(enabled: on, child: const SubjectEmblem(subject: 'physics', size: 96, animate: true));
    await _pump(tester, at(true));
    await tester.pump(const Duration(seconds: 1));
    expect(tester.hasRunningAnimations, isTrue);
    await _pump(tester, at(false));
    await tester.pumpAndSettle();
    expect(tester.hasRunningAnimations, isFalse);
    await _pump(tester, at(true));
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.hasRunningAnimations, isTrue);
  });

  testWidgets('idle motion runs only when asked for', (tester) async {
    idleOn();
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
    idleOn();
    await _pump(tester, const SubjectEmblem(subject: 'chemistry', size: 96, animate: true), disableAnimations: true);
    await tester.pump(const Duration(seconds: 1));
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('reduced motion (in-app setting) stops the idle drift', (tester) async {
    idleOn();
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

  testWidgets('a subject that is not a choice never shows a pick', (tester) async {
    expect(const SubjectEmblem(subject: 'history').marked, isFalse);
    expect(const SubjectEmblem(subject: 'history').selectable, isFalse);
  });

  testWidgets('a picker emblem reports selected to assistive tech, and a plain one does not', (tester) async {
    final handle = tester.ensureSemantics();
    await _pump(tester, const SubjectEmblem(subject: 'history', size: 56, semanticLabel: 'History', selectable: true, marked: true));
    expect(tester.getSemantics(find.bySemanticsLabel('History')), matchesSemantics(label: 'History', isImage: true, hasSelectedState: true, isSelected: true));
    await _pump(tester, const SubjectEmblem(subject: 'history', size: 56, semanticLabel: 'History', selectable: true, marked: false));
    expect(tester.getSemantics(find.bySemanticsLabel('History')), matchesSemantics(label: 'History', isImage: true, hasSelectedState: true));
    await _pump(tester, const SubjectEmblem(subject: 'history', size: 56, semanticLabel: 'History', marked: true));
    expect(tester.getSemantics(find.bySemanticsLabel('History')), matchesSemantics(label: 'History', isImage: true));
    handle.dispose();
  });

  testWidgets('pictures are keyed by subject id, so language papers share and nothing leaks across ids', (tester) async {
    EmblemPictures.clear();
    await _pump(tester, const Column(children: [
      SubjectEmblem(subject: 'hindi', size: 56),
      SubjectEmblem(subject: 'tamil', size: 56),
    ]));
    // One identity, so one tile, one object and one shadow.
    expect(EmblemPictures.length, 3);
    await _pump(tester, const SubjectEmblem(subject: 'hindi', size: 56, framed: false));
    // An unframed emblem adds its pool, nothing else.
    expect(EmblemPictures.length, 4);
  });

  test('the drift is larger at 24 dp so it still reads', () {
    final art = EmblemArt.forKind(SubjectIdentity.of('geography')!.kind)!;
    double travel(EmblemDetail d) {
      final ys = [for (var i = 0; i < 40; i++) art.markAt(i / 40 * 0.25, d).center.dy];
      return ys.reduce((a, b) => a > b ? a : b) - ys.reduce((a, b) => a < b ? a : b);
    }

    expect(travel(EmblemDetail.glyph), greaterThan(travel(EmblemDetail.tile) * 1.5));
  });

  test('the marks are not all the same dot', () {
    final styles = {
      for (final s in SubjectIdentity.subjects) EmblemArt.forKind(s.kind)!.mark(0).style,
    };
    expect(styles.length, greaterThanOrEqualTo(7));
    expect(styles, containsAll([MarkStyle.key, MarkStyle.drop, MarkStyle.wedge, MarkStyle.halo, MarkStyle.reticle]));
  });

  testWidgets('an emblem takes exactly its size', (tester) async {
    await _pump(tester, const SubjectEmblem(subject: 'geography', size: 44));
    expect(tester.getSize(find.byType(SubjectEmblem)), const Size(44, 44));
  });
}
