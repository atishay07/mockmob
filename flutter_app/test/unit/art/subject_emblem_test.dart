import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';
import 'package:mockmob/core/art/emblem_painter.dart';
import 'package:mockmob/core/art/emblem_palette.dart';
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


/// Paints one emblem to RGBA pixels at [px] by [px] (4 pixels per design unit at 24 dp, so the
/// pixel counts are comparable across sizes).
Future<Uint8List> _pixels(
  WidgetTester tester,
  String subject, {
  required double dp,
  required double t,
  Brightness brightness = Brightness.dark,
  bool framed = true,
  bool selectable = false,
  double ink = 1,
}) async {
  final identity = SubjectIdentity.of(subject)!;
  final painter = EmblemPainter(
    subject: identity,
    art: EmblemArt.forKind(identity.kind) ?? EmblemArt.monogram,
    palette: EmblemPalette.of(identity, brightness),
    brightness: brightness,
    detail: EmblemDetail.forSize(dp),
    framed: framed,
    idle: ValueNotifier<double>(t),
    ink: ValueNotifier<double>(ink),
    inking: () => false,
    phase: 0,
    selectable: selectable,
  );
  final px = (dp * 4).round();
  final bytes = await tester.runAsync(() async {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.scale(4);
    painter.paint(canvas, Size.square(dp));
    final image = await recorder.endRecording().toImage(px, px);
    final data = await image.toByteData();
    image.dispose();
    return data!.buffer.asUint8List();
  });
  return bytes!;
}

/// The share of pixels that differ visibly between two renders.
double _changed(Uint8List a, Uint8List b) {
  var n = 0;
  for (var i = 0; i < a.length; i += 4) {
    final d = (a[i] - b[i]).abs() + (a[i + 1] - b[i + 1]).abs() + (a[i + 2] - b[i + 2]).abs() + (a[i + 3] - b[i + 3]).abs();
    if (d > 40) n++;
  }
  return n / (a.length / 4);
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

  group('idle motion reads as character', () {
    // Each of these has one signature motion; across the cycle a real share of the emblem moves.
    for (final id in ['physics', 'chemistry', 'computer_science', 'sociology']) {
      for (final dp in [24.0, 56.0, 112.0]) {
        testWidgets('$id at ${dp.toInt()} dp moves visibly across its cycle', (tester) async {
          final base = await _pixels(tester, id, dp: dp, t: 1e-6);
          var most = 0.0;
          for (final t in [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) {
            final c = _changed(base, await _pixels(tester, id, dp: dp, t: t));
            if (c > most) most = c;
          }
          // At least one moment differs from the start in 2.5% of the emblem's pixels.
          expect(most, greaterThan(0.025), reason: '$id at $dp dp');
        });
      }
    }

    for (final id in ['physics', 'chemistry', 'computer_science', 'sociology', 'geography', 'psychology']) {
      testWidgets('$id: the end of the cycle is the start (no jump on the loop)', (tester) async {
        for (final dp in [24.0, 56.0]) {
          final start = await _pixels(tester, id, dp: dp, t: 1e-6);
          final end = await _pixels(tester, id, dp: dp, t: 1 - 1e-6);
          expect(_changed(start, end), lessThan(0.005), reason: '$id at $dp dp');
        }
      });
    }
  });

  group('contrast and plates', () {
    test('the 24 dp silhouettes of Sociology and Psychology hold 3:1 on their Daylight plate', () {
      for (final id in ['sociology', 'psychology']) {
        final identity = SubjectIdentity.of(id)!;
        final p = EmblemPalette.of(identity, Brightness.light);
        final art = EmblemArt.forKind(identity.kind)!;
        final inks = art.glyphInks(p);
        expect(inks, isNotEmpty, reason: id);
        for (final ink in inks) {
          expect(contrastRatio(ink, p.glyphField), greaterThanOrEqualTo(3.0), reason: id);
        }
      }
    });

    test('Night plates sit clearly above the Night Sheet and are not all one brown', () {
      const ground = Color(0xFF12100C);
      final hues = <String, double>{};
      for (final s in SubjectIdentity.subjects) {
        final p = EmblemPalette.of(s, Brightness.dark);
        expect(contrastRatio(p.field, ground), greaterThan(1.45), reason: s.id);
        hues[s.id] = HSLColor.fromColor(p.field).hue;
      }
      // The warm four are told apart by hue, not only by a few points of value.
      final warm = [hues['accountancy']!, hues['history']!, hues['political_science']!, hues['sociology']!]..sort();
      for (var i = 1; i < warm.length; i++) {
        expect(warm[i] - warm[i - 1], greaterThan(4), reason: 'warm hues $warm');
      }
    });

    test('every pool has the same strength', () {
      for (final b in Brightness.values) {
        final l = [for (final s in SubjectIdentity.subjects) HSLColor.fromColor(EmblemPalette.of(s, b).pool).lightness];
        final lo = l.reduce((a, c) => a < c ? a : c), hi = l.reduce((a, c) => a > c ? a : c);
        expect(hi - lo, lessThan(0.02), reason: b.name);
      }
    });
  });

  group('the picked state', () {
    for (final b in Brightness.values) {
      testWidgets('marked is clearly different from unmarked (${b.name})', (tester) async {
        final off = await _pixels(tester, 'business_studies', dp: 56, t: 0, brightness: b, selectable: true, ink: 0);
        final on = await _pixels(tester, 'business_studies', dp: 56, t: 0, brightness: b, selectable: true, ink: 1);
        // Ring, tick, lift and the dimming: a large share of the pixels change.
        expect(_changed(off, on), greaterThan(0.12));
        var volt = 0;
        for (var i = 0; i < on.length; i += 4) {
          if (on[i] > 180 && on[i + 1] > 210 && on[i + 2] < 60 && on[i + 3] > 200) volt++;
        }
        expect(volt, greaterThan(60), reason: 'a volt ring and tick show on the plate');
      });
    }

    testWidgets('an emblem that is not a choice never dims or rings', (tester) async {
      final plain = await _pixels(tester, 'general_test', dp: 56, t: 0, ink: 0);
      final again = await _pixels(tester, 'general_test', dp: 56, t: 0, ink: 0);
      expect(_changed(plain, again), 0);
      final marked = await _pixels(tester, 'general_test', dp: 56, t: 0, ink: 1);
      // Only the one volt mark changes.
      expect(_changed(plain, marked), lessThan(0.05));
    });
  });

  testWidgets('a subject without an object shows its initials on a printed card, with a volt tick', (tester) async {
    await _pump(tester, const SubjectEmblem(subject: 'fine_arts', size: 72, marked: true));
    expect(find.text('FA'), findsOneWidget);
    final art = EmblemArt.monogram;
    expect(art.overlaysText, isTrue);
    expect(art.mark(0).style, MarkStyle.pill);
  });

  testWidgets('an emblem takes exactly its size', (tester) async {
    await _pump(tester, const SubjectEmblem(subject: 'geography', size: 44));
    expect(tester.getSize(find.byType(SubjectEmblem)), const Size(44, 44));
  });
}
