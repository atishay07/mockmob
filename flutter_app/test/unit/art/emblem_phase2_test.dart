import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';
import 'package:mockmob/core/art/emblem_painter.dart';
import 'package:mockmob/core/art/emblem_palette.dart';
import 'package:mockmob/core/motion/reduced_motion.dart';
import 'package:mockmob/core/theme/theme.dart';

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
  group('the four emblem sizes (SPACING 4.1, audit X5)', () {
    test('are 24, 40, 56 and 136, and the default is the tile', () {
      expect(EmblemSizes.all, [24, 40, 56, 136]);
      expect(const SubjectEmblem(subject: 'history').size, EmblemSizes.tile);
    });

    test('each size lands on its own level of detail', () {
      expect(EmblemDetail.forSize(EmblemSizes.glyph), EmblemDetail.glyph);
      expect(EmblemDetail.forSize(EmblemSizes.chip), EmblemDetail.tile);
      expect(EmblemDetail.forSize(EmblemSizes.tile), EmblemDetail.tile);
      expect(EmblemDetail.forSize(EmblemSizes.hero), EmblemDetail.plate);
    });

    test('snap maps the odd sizes the screens used to the nearest one, and ties go up', () {
      expect(EmblemSizes.snap(32), 40);
      expect(EmblemSizes.snap(28), 24);
      expect(EmblemSizes.snap(64), 56);
      expect(EmblemSizes.snap(88), 56); // 32 from 56, 48 from 136
      expect(EmblemSizes.snap(96), 136);
      expect(EmblemSizes.snap(160), 136);
      expect(EmblemSizes.snap(168), 136);
      expect(EmblemSizes.snap(48), 56); // 8 from 40 and 8 from 56: the larger
    });

    test('snap and isOnScale never throw on bad input', () {
      expect(EmblemSizes.snap(double.nan), EmblemSizes.glyph);
      expect(EmblemSizes.snap(double.infinity), EmblemSizes.glyph);
      expect(EmblemSizes.snap(-5), EmblemSizes.glyph);
      expect(EmblemSizes.isOnScale(56), isTrue);
      expect(EmblemSizes.isOnScale(57), isFalse);
    });

    for (final size in EmblemSizes.all) {
      testWidgets('an emblem of $size dp takes the same room in Night and Daylight', (tester) async {
        final sizes = <Brightness, Size>{};
        for (final b in Brightness.values) {
          await _pump(tester, SubjectEmblem(subject: 'accountancy', size: size, framed: false), brightness: b);
          sizes[b] = tester.getSize(find.byType(SubjectEmblem));
        }
        expect(sizes[Brightness.dark], Size.square(size));
        expect(sizes[Brightness.light], sizes[Brightness.dark]);
      });
    }
  });

  group('robustness', () {
    for (final bad in [0.0, -24.0, double.nan, double.infinity, double.negativeInfinity]) {
      testWidgets('a size of $bad takes no room and does not throw', (tester) async {
        await _pump(tester, SubjectEmblem(subject: 'physics', size: bad));
        expect(tester.takeException(), isNull);
        expect(tester.getSize(find.byType(SubjectEmblem)), Size.zero);
      });
    }

    testWidgets('a size that becomes valid, then invalid, then valid again keeps working', (tester) async {
      await _pump(tester, const SubjectEmblem(subject: 'physics', size: 56, marked: true));
      await _pump(tester, const SubjectEmblem(subject: 'physics', size: 0, marked: true));
      expect(tester.takeException(), isNull);
      await _pump(tester, const SubjectEmblem(subject: 'physics', size: 56, marked: true));
      expect(tester.getSize(find.byType(SubjectEmblem)), const Size.square(56));
      expect(tester.takeException(), isNull);
    });

    testWidgets('subjects that only have initials share one set of pictures, however many ids arrive', (tester) async {
      EmblemPictures.clear();
      await _pump(tester, const SubjectEmblem(subject: 'film_arts', size: 56));
      final one = EmblemPictures.length;
      await _pump(
        tester,
        Column(children: [
          for (final id in ['music', 'dance', 'theatre', 'photography', 'journalism', 'pottery', 'tourism', 'a1', 'b2', 'c3'])
            SubjectEmblem(subject: id, size: 24),
        ]),
      );
      // 24 dp is another detail level (one more set), but ten more ids add nothing.
      final two = EmblemPictures.length;
      await _pump(
        tester,
        Column(children: [
          for (final id in ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8'])
            SubjectEmblem(subject: id, size: 24),
        ]),
      );
      expect(EmblemPictures.length, two);
      expect(two - one, lessThanOrEqualTo(3));
    });

    test('palettes are built once per identity and theme, and initials-only ids share one', () {
      final before = EmblemPalette.cached;
      final a = EmblemPalette.of(SubjectIdentity.of('mystery_a')!, Brightness.dark);
      final b = EmblemPalette.of(SubjectIdentity.of('mystery_b')!, Brightness.dark);
      expect(identical(a, b), isTrue);
      expect(identical(EmblemPalette.of(SubjectIdentity.of('physics')!, Brightness.light), EmblemPalette.of(SubjectIdentity.of('physics')!, Brightness.light)), isTrue);
      expect(EmblemPalette.cached - before, lessThanOrEqualTo(3));
      expect(EmblemPalette.cached, lessThanOrEqualTo(30 * 2));
    });

    testWidgets('clearing the picture cache while an emblem is on screen does not break it', (tester) async {
      await _pump(tester, const SubjectEmblem(subject: 'chemistry', size: 136, framed: false));
      EmblemPictures.clear();
      await tester.pump();
      await _pump(tester, const SubjectEmblem(subject: 'chemistry', size: 136, framed: false, marked: true));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    test('initials are cut by character, not by UTF-16 unit', () {
      expect(SubjectIdentity.monogram('😀 smile'), '😀S');
      expect(SubjectIdentity.monogram('élan'), 'Él');
      expect(SubjectIdentity.monogram('film_arts'), 'FA');
      expect(SubjectIdentity.monogram('a'), 'A');
      expect(SubjectIdentity.monogram('physics'), 'Ph');
      expect(SubjectIdentity.monogram(''), '');
      expect(SubjectIdentity.monogram(null), '');
    });
  });

  group('the contact shadow (SPACING 8.4)', () {
    // The soft ellipse fades from its peak to nothing along 1 - 1.1r then 0.9 - 0.9r; averaged
    // over the ellipse that is 0.3083 of the peak.
    const meanShare = 0.3083;

    test('Night is about 24% black over the ellipse', () {
      final p = EmblemPalette.of(SubjectIdentity.of('accountancy')!, Brightness.dark);
      expect(p.shadow.a * meanShare, closeTo(0.24, 0.02));
      expect(p.shadow.r + p.shadow.g + p.shadow.b, 0, reason: 'Night shadow is black');
    });

    test('Daylight is about 12%, and tinted with the subject ink, not grey', () {
      final shades = <Color>{};
      for (final s in SubjectIdentity.subjects) {
        final p = EmblemPalette.of(s, Brightness.light);
        expect(p.shadow.a * meanShare, closeTo(0.12, 0.02), reason: s.id);
        shades.add(p.shadow.withValues(alpha: 1));
      }
      expect(shades.length, greaterThan(8), reason: 'each subject keeps its own sepia');
    });
  });

  group('EmblemArrive (MOTION 4.1, P0-9)', () {
    test('scales 0.94 to 1 and rises 8 dp over 420 ms after a 160 ms wait, with no sideways travel', () {
      final start = EmblemArrive.poseAt(Duration.zero);
      expect(start.scale, closeTo(0.94, 1e-9));
      expect(start.dy, closeTo(8, 1e-9));
      expect(start.opacity, 0);

      final waiting = EmblemArrive.poseAt(const Duration(milliseconds: 159));
      expect(waiting.scale, closeTo(0.94, 1e-9));
      expect(waiting.dy, closeTo(8, 1e-9));

      final mid = EmblemArrive.poseAt(const Duration(milliseconds: 160 + 100));
      expect(mid.scale, inExclusiveRange(0.94, 1));
      expect(mid.dy, inExclusiveRange(0, 8));
      // The emphasized curve is front-loaded: well over half done a quarter of the way in.
      expect(1 - mid.dy / 8, greaterThan(0.5));

      final end = EmblemArrive.poseAt(const Duration(milliseconds: 160 + 420));
      expect(end.scale, 1);
      expect(end.dy, 0);
      expect(end.opacity, 1);
      final later = EmblemArrive.poseAt(const Duration(seconds: 5));
      expect(later.scale, 1);
      expect(later.dy, 0);
    });

    test('never overshoots: scale stays between 0.94 and 1, offset between 0 and 8, at every millisecond', () {
      for (var ms = 0; ms <= 700; ms++) {
        final p = EmblemArrive.poseAt(Duration(milliseconds: ms));
        expect(p.scale, inInclusiveRange(0.94, 1.0), reason: '$ms ms');
        expect(p.dy, inInclusiveRange(0.0, 8.0), reason: '$ms ms');
        expect(p.opacity, inInclusiveRange(0.0, 1.0), reason: '$ms ms');
      }
    });

    testWidgets('plays once on the emblem, ends at rest, and a rebuild does not replay it', (tester) async {
      Widget at(String subject) => EmblemArrive(child: SubjectEmblem(subject: subject, size: 136, framed: false));
      await _pump(tester, at('accountancy'));
      Matrix4 matrix() => tester.widget<Transform>(find.descendant(of: find.byType(EmblemArrive), matching: find.byType(Transform)).last).transform;

      expect(matrix().storage[0], closeTo(0.94, 1e-6));
      await tester.pump(const Duration(milliseconds: 300));
      expect(matrix().storage[0], inExclusiveRange(0.94, 1));
      await tester.pump(const Duration(milliseconds: 400));
      expect(matrix().storage[0], closeTo(1, 1e-9));
      expect(tester.hasRunningAnimations, isFalse);

      // New data (another subject) and a full rebuild: it stays at rest.
      await _pump(tester, at('chemistry'));
      expect(matrix().storage[0], closeTo(1, 1e-9));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('the emblem under it keeps its state when the arrival ends (no rebuild of the child)', (tester) async {
      await _pump(tester, const EmblemArrive(child: SubjectEmblem(subject: 'physics', size: 136, framed: false)));
      final before = tester.state(find.byType(SubjectEmblem));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.state(find.byType(SubjectEmblem)), same(before));
    });

    testWidgets('under reduced motion (system) it is simply there, at rest, with nothing running', (tester) async {
      await _pump(tester, const EmblemArrive(child: SubjectEmblem(subject: 'physics', size: 136, framed: false)), disableAnimations: true);
      expect(tester.hasRunningAnimations, isFalse);
      final t = tester.widget<Transform>(find.descendant(of: find.byType(EmblemArrive), matching: find.byType(Transform)).last);
      expect(t.transform.storage[0], 1);
      expect(tester.widget<Opacity>(find.descendant(of: find.byType(EmblemArrive), matching: find.byType(Opacity)).first).opacity, 1);
    });

    testWidgets('under the in-app reduced setting it is at rest, and switching it on mid-flight finishes it', (tester) async {
      await _pump(tester, const ReducedMotionSetting(enabled: true, child: EmblemArrive(child: SubjectEmblem(subject: 'physics', size: 136, framed: false))));
      expect(tester.hasRunningAnimations, isFalse);

      await _pump(tester, const ReducedMotionSetting(enabled: false, child: EmblemArrive(key: ValueKey('b'), child: SubjectEmblem(subject: 'physics', size: 136, framed: false))));
      await tester.pump(const Duration(milliseconds: 200));
      expect(tester.hasRunningAnimations, isTrue);
      await _pump(tester, const ReducedMotionSetting(enabled: true, child: EmblemArrive(key: ValueKey('b'), child: SubjectEmblem(subject: 'physics', size: 136, framed: false))));
      await tester.pump();
      expect(tester.hasRunningAnimations, isFalse);
      final t = tester.widget<Transform>(find.descendant(of: find.byType(EmblemArrive), matching: find.byType(Transform)).last);
      expect(t.transform.storage[0], closeTo(1, 1e-9));
    });

    testWidgets('a tap on the card while the emblem arrives reaches the card', (tester) async {
      var taps = 0;
      await _pump(
        tester,
        GestureDetector(
          onTap: () => taps++,
          child: const SizedBox(width: 160, height: 160, child: EmblemArrive(child: SubjectEmblem(subject: 'physics', size: 136, framed: false))),
        ),
      );
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tapAt(tester.getCenter(find.byType(EmblemArrive)));
      expect(taps, 1);
    });
  });
}
