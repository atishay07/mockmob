// The bar's measured geometry (NAV-1017 section 10, D105 and G11 of 19 Oct): one capsule with the
// four tabs, Today, Practice, Mob and You, and the 64 dp Start key in its exact middle, measured on
// the laid-out widgets at 320, 360, 390, 412 and 480 dp, expanded and compact, with the app's real
// fonts. Plus the lens: a perfect stadium (radius half its height, even insets, centred on its icon
// and word) that never cuts into its icon or its word (the owner, 17 Oct, on the old round lens over
// Practice; 19 Oct, on the bubble around Today that was "not evenly rounded at the edges").
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

Finder _iconOf(BarIconKind kind) =>
    find.byWidgetPredicate((w) => w is CustomPaint && w.painter is BarIconPainter && (w.painter! as BarIconPainter).glyph == kind.glyph);

BarLensPainter _lens(WidgetTester tester) =>
    tester.widgetList<CustomPaint>(find.byType(CustomPaint)).map((w) => w.painter).whereType<BarLensPainter>().first;

/// How far [p] lies inside the rounded rect [shape] (circular corners, as the lens is drawn);
/// negative when outside.
double _depth(LensShape shape, Offset p) {
  final r = shape.rect;
  final rad = shape.radius;
  // A stadium's straight part can be zero long, so its ends may meet (or cross by a rounding error).
  double clampTo(double v, double lo, double hi) => lo >= hi ? (lo + hi) / 2 : v.clamp(lo, hi);
  final cx = clampTo(p.dx, r.left + rad, r.right - rad);
  final cy = clampTo(p.dy, r.top + rad, r.bottom - rad);
  final inCorner = p.dx < r.left + rad || p.dx > r.right - rad;
  final inCornerY = p.dy < r.top + rad || p.dy > r.bottom - rad;
  if (inCorner && inCornerY) return rad - (p - Offset(cx, cy)).distance;
  return math.min(math.min(p.dx - r.left, r.right - p.dx), math.min(p.dy - r.top, r.bottom - p.dy));
}

/// The baseline of a word drawn in its 14 dp line box (Hanken Grotesk at 11 sp: ascent 10.83).
double _baseline(Rect label) => label.top + label.height * (10.83 / 14);

Future<void> _pumpBar(WidgetTester tester, {required double width, int branch = 0, bool compact = false, double textScale = 1}) async {
  final notifier = ValueNotifier(compact);
  addTearDown(notifier.dispose);
  await pumpMockmob(
    tester,
    Align(
      alignment: Alignment.bottomCenter,
      child: MmBottomBar(currentBranch: branch, compact: notifier, onTab: (_) {}, onStart: (_) {}),
    ),
    size: Size(width, 780),
    textScale: textScale,
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() async {
    await loadAppFonts();
    await loadMaterialIconFont();
  });

  group('the formula (NAV 6.1, D105)', () {
    test('row, capsule, key, gap, pad and slot at every width', () {
      for (final (screen, row, gap, pad, slot) in const [
        (320.0, 304.0, 3.0, 3.0, 57.0),
        (360.0, 328.0, 4.0, 4.0, 62.0),
        (390.0, 358.0, 4.0, 4.0, 69.5),
        (393.0, 361.0, 4.0, 4.0, 70.25),
        (412.0, 380.0, 4.0, 4.0, 75.0),
        (480.0, 440.0, 4.0, 4.0, 90.0),
      ]) {
        final geo = BarGeometry(screen);
        expect(geo.width, closeTo(row, 1e-9), reason: '$screen');
        expect(geo.keyGap, gap, reason: '$screen');
        expect(geo.pad, pad, reason: '$screen');
        expect(geo.capsuleWidth, closeTo(row, 1e-9), reason: 'the capsule is the whole row at $screen');
        expect(geo.slot, closeTo(slot, 1e-9), reason: '$screen');
        // Four slots + the key + its two gaps + 2 x pad = the row; 44 dp targets at least.
        expect(4 * geo.slot + MmBar.keySize + 2 * geo.keyGap + 2 * geo.pad, closeTo(geo.width, 1e-9));
        expect(geo.slot, greaterThanOrEqualTo(44), reason: 'a 44 dp target at $screen');
        // Start is the centre key: two tabs on each side.
        expect(geo.keyBox.center.dx, closeTo(geo.width / 2, 1e-9), reason: 'the key sits in the middle at $screen');
        expect(geo.keyBox.left - (geo.slotLeft(1) + geo.slot), closeTo(geo.keyGap, 1e-9));
        expect(geo.slotLeft(2) - geo.keyBox.right, closeTo(geo.keyGap, 1e-9));
        expect(geo.slotLeft(3) + geo.slot + geo.pad, closeTo(geo.width, 1e-9), reason: 'You closes the row');
      }
    });

    test('the key and the capsule share their top, bottom and centre, expanded and compact', () {
      for (final screen in const [320.0, 360.0, 390.0, 412.0, 480.0]) {
        final geo = BarGeometry(screen);
        for (final e in const [0.0, 0.5, 1.0]) {
          final capsule = geo.capsuleShape(e).outerRect;
          final key = geo.keyCircle(collapse: e);
          expect(key.top, closeTo(capsule.top, 1e-9), reason: '$screen at $e');
          expect(key.bottom, closeTo(capsule.bottom, 1e-9), reason: '$screen at $e');
          expect(key.width, closeTo(key.height, 1e-9), reason: 'a circle');
          expect(key.center.dx, closeTo(capsule.center.dx, 1e-9), reason: 'in the middle of the capsule');
        }
        expect(geo.keyCircle().size, const Size(64, 64));
        expect(geo.keyCircle(collapse: 1).size, const Size(52, 52));
        expect(geo.capsuleShape(1).outerRect.center.dy, 38);
      }
    });

    test('the lens: as wide as its slot, y 4 to 60 expanded, 16 to 60 compact', () {
      final geo = BarGeometry(360);
      for (var i = 0; i < kBarSlots; i++) {
        final lens = geo.lensRect(i);
        expect(lens.top, 4);
        expect(lens.bottom, 60);
        expect(lens.center.dx, closeTo(geo.slotCenter(i), 1e-9));
        expect(lens.width, closeTo(geo.slot, 1e-9));
        final compact = geo.lensRect(i, collapse: 1);
        expect(compact.top, 16);
        expect(compact.bottom, 60);
        expect(geo.iconRect(i, collapse: 1).center.dy, closeTo(compact.center.dy, 1e-9), reason: 'compact icons centre in the lens');
        // The icon and label group (y 11 to 53) centres in the lens.
        expect((geo.iconRect(i).top + geo.labelRect(i).bottom) / 2, closeTo(lens.center.dy, 1e-9));
      }
      expect(MmBar.compactShift, 15);
    });

    test('slots and branches are the same number; Start is no slot, and a finger over it goes to the nearer side', () {
      expect(kBarSlots, 4);
      for (var i = 0; i < kBarSlots; i++) {
        expect(slotToBranch(i), i);
        expect(branchToSlot(i), i);
      }
      final geo = BarGeometry(412);
      for (var x = 0.0; x <= geo.capsuleWidth; x += 3) {
        expect(geo.nearestSlot(x), inInclusiveRange(0, 3));
        expect(geo.slotAt(x), inInclusiveRange(0, 3));
      }
      final mid = geo.keyBox.center.dx;
      expect(geo.nearestSlot(mid - 1), 1, reason: 'left of the key: Practice');
      expect(geo.nearestSlot(mid + 1), 2, reason: 'right of the key: Mob');
      expect(geo.slotAt(geo.slotLeft(2) + 1), 2);
      expect(geo.nearestSlot(geo.slotCenter(0) + geo.slot * 0.49), 0);
      expect(geo.nearestSlot(geo.slotCenter(0) + geo.slot * 0.51), 1);
    });
  });

  group('measured on screen (NAV 10, check A2)', () {
    for (final width in const [320.0, 360.0, 390.0, 412.0, 480.0]) {
      for (final compact in const [false, true]) {
        final name = '${width.toInt()} dp, ${compact ? 'compact' : 'expanded'}';
        testWidgets('$name: five centres on one y, five words on one line, the key in the middle on the capsule\'s edges', (tester) async {
          await _pumpBar(tester, width: width, branch: BarBranch.practice, compact: compact);
          final bar = tester.getRect(find.byType(MmBottomBar));
          final geo = BarGeometry(width);
          final e = compact ? 1.0 : 0.0;
          expect(bar.width, closeTo(geo.width, 0.01));
          expect(bar.left, closeTo((width - geo.width) / 2, 0.01), reason: 'the row is centred');

          // (a) the four tab icons and the key's glyph share one centre line.
          final iconY = bar.top + geo.iconRect(0, collapse: e).center.dy;
          for (final kind in BarIconKind.values) {
            final icon = tester.getRect(_iconOf(kind));
            expect(icon.center.dy, closeTo(iconY, 0.5), reason: '$kind');
            expect(icon.center.dx, closeTo(bar.left + geo.slotCenter(kind.index), 0.5), reason: '$kind on its slot');
          }
          final glyph = tester.getRect(find.byType(StartGlyph));
          expect(glyph.center.dy, closeTo(iconY, 0.5), reason: 'the Start glyph');
          expect(glyph.center.dx, closeTo(bar.center.dx, 0.5), reason: 'Start is the centre key');

          // (b) the four labels and the word Start share one line box (y 39 to 53).
          if (!compact) {
            for (final label in [...kBarTabs.map((t) => t.label), StartKeyFace.word]) {
              final rect = tester.getRect(find.text(label));
              expect(rect.center.dy, closeTo(bar.top + MmBar.labelTop + MmBar.labelHeight / 2, 0.5), reason: label);
              expect(rect.height, lessThanOrEqualTo(MmBar.labelHeight + 0.01), reason: '$label never wraps');
            }
          }

          // (c) the key's circle shares the capsule's top and bottom, with even air either side.
          final keyBox = tester.getRect(find.byType(StartKeyFace));
          final circle = StartKeyFace.keyRect(keyBox.size, e).shift(keyBox.topLeft - bar.topLeft);
          final capsule = geo.capsuleShape(e).outerRect;
          expect(circle.top, closeTo(capsule.top, 0.01));
          expect(circle.bottom, closeTo(capsule.bottom, 0.01));
          final airLeft = circle.left - (geo.slotLeft(1) + geo.slot);
          final airRight = geo.slotLeft(2) - circle.right;
          expect(airLeft, closeTo(airRight, 0.01));
          expect(airLeft, closeTo(geo.keyGap + (MmBar.keySize - circle.width) / 2, 0.01));

          // (f) the lens sits centred on the open tab.
          final lens = _lens(tester);
          expect((lens.left.value + lens.right.value) / 2, closeTo(geo.slotCenter(BarBranch.practice), 0.01));
        });
      }
    }
  });

  group('G11: the lens is a perfect stadium, centred on its icon and word (owner, 19 Oct)', () {
    for (final width in const [360.0, 412.0]) {
      for (final scale in const [1.0, 1.3, 1.6]) {
        testWidgets('${width.toInt()} dp, text ${scale}x: radius half the height, even insets, on every tab', (tester) async {
          for (var branch = 0; branch < kBarSlots; branch++) {
            await _pumpBar(tester, width: width, branch: branch, textScale: scale);
            final bar = tester.getRect(find.byType(MmBottomBar));
            final geo = BarGeometry(width);
            final painter = _lens(tester);
            final shape = BarLensPainter.shapeFor(
              left: painter.left.value,
              right: painter.right.value,
              collapse: 0,
              labelsOut: 0,
              restWidth: painter.restWidth,
              labelWidth: painter.labelWidth,
            );
            final why = '${kBarTabs[branch].label} at ${width.toInt()} dp, ${scale}x';
            // A stadium: both ends half circles.
            expect(shape.radius, closeTo(shape.rect.height / 2, 1e-9), reason: why);
            expect(shape.rect.width, greaterThanOrEqualTo(shape.rect.height), reason: 'wider than tall: $why');
            expect(shape.rrect.tlRadius, shape.rrect.trRadius, reason: why);
            expect(shape.rrect.blRadius, shape.rrect.brRadius, reason: why);
            // Even insets on both sides, within its slot.
            final slotLeft = geo.slotLeft(branch);
            final slotRight = slotLeft + geo.slot;
            expect(shape.rect.left - slotLeft, closeTo(slotRight - shape.rect.right, 0.01), reason: why);
            // Centred on its icon and its word.
            final icon = tester.getRect(_iconOf(BarIconKind.values[branch])).shift(-bar.topLeft);
            final label = tester.getRect(find.text(kBarTabs[branch].label)).shift(-bar.topLeft);
            expect(icon.center.dx, closeTo(shape.rect.center.dx, 0.5), reason: 'icon, $why');
            expect(label.center.dx, closeTo(shape.rect.center.dx, 0.5), reason: 'word, $why');
            // Top and bottom insets are equal (4 dp each in the 64 dp row).
            expect(shape.rect.top, closeTo(MmBar.height - shape.rect.bottom, 0.01), reason: why);
            // At rest the capsule never clips it: on Today and You its round end shares the capsule's centre.
            if (branch == 0 || branch == kBarSlots - 1) {
              final endCentre = branch == 0 ? shape.rect.left + shape.radius : shape.rect.right - shape.radius;
              final capsuleCentre = branch == 0 ? MmBar.height / 2 : geo.capsuleWidth - MmBar.height / 2;
              expect(endCentre, closeTo(capsuleCentre, 0.01), reason: 'concentric with the capsule end, $why');
            }
          }
        });
      }
    }

    test('the corner radius is half the height, labels shown or gone', () {
      expect(BarLensPainter.cornerRadiusFor(width: 70, height: 56, labelWidth: 20, labelsOut: 0), 28);
      expect(BarLensPainter.cornerRadiusFor(width: 62, height: 56, labelWidth: 41, labelsOut: 0), 28);
      expect(BarLensPainter.cornerRadiusFor(width: 62, height: 44, labelWidth: 41, labelsOut: 1), 22);
      final travelling = BarLensPainter.shapeFor(left: 10, right: 110, collapse: 0, labelsOut: 0, restWidth: 62, labelWidth: 41);
      expect(travelling.radius, closeTo(travelling.rect.height / 2, 1e-9), reason: 'stretched in travel it stays a stadium');
      final compact = BarLensPainter.shapeFor(left: 4, right: 66, collapse: 1, labelsOut: 1, restWidth: 62, labelWidth: 41);
      expect(compact.radius, closeTo(compact.rect.height / 2, 1e-9));
    });
  });

  group('the lens never cuts into what it holds (owner, 17 Oct)', () {
    for (final width in const [320.0, 360.0, 390.0, 412.0]) {
      for (final scale in const [1.0, 1.2, 1.6]) {
        testWidgets('${width.toInt()} dp, text ${scale}x: every tab, icon and word inside the lens', (tester) async {
          for (var branch = 0; branch < kBarSlots; branch++) {
            await _pumpBar(tester, width: width, branch: branch, textScale: scale);
            final bar = tester.getRect(find.byType(MmBottomBar));
            final geo = BarGeometry(width);
            final painter = _lens(tester);
            final shape = BarLensPainter.shapeFor(
              left: painter.left.value,
              right: painter.right.value,
              collapse: 0,
              labelsOut: 0,
              restWidth: painter.restWidth,
              labelWidth: painter.labelWidth,
            );
            final icon = tester.getRect(_iconOf(BarIconKind.values[branch])).shift(-bar.topLeft);
            final label = tester.getRect(find.text(kBarTabs[branch].label)).shift(-bar.topLeft);
            final why = '${kBarTabs[branch].label} at ${width.toInt()} dp, ${scale}x';
            for (final corner in [icon.topLeft, icon.topRight, icon.bottomLeft, icon.bottomRight]) {
              expect(_depth(shape, corner), greaterThanOrEqualTo(2), reason: 'icon corner $corner, $why, lens $shape');
            }
            // The word's ink (cap line to baseline) stays 2 dp inside the curve (1 dp on a phone under
            // 360 dp, where the slots are narrowest).
            final base = _baseline(label);
            final ink = width < 360 ? 1.0 : 2.0;
            for (final corner in [label.topLeft, label.topRight, Offset(label.left, base), Offset(label.right, base)]) {
              expect(_depth(shape, corner), greaterThanOrEqualTo(ink), reason: 'word ink corner $corner, $why, r ${shape.radius}');
            }
            // From 360 dp up even the word's whole line box (its descent included) stays inside the lens.
            if (width >= 360) {
              for (final corner in [label.bottomLeft, label.bottomRight]) {
                expect(_depth(shape, corner), greaterThanOrEqualTo(0), reason: 'line box corner $corner, $why');
              }
            }
            // And the lens never reaches a neighbour's icon or the Start key.
            for (final n in [branch - 1, branch + 1]) {
              if (n < 0 || n >= kBarSlots) continue;
              final other = tester.getRect(_iconOf(BarIconKind.values[n])).shift(-bar.topLeft);
              expect(shape.rect.overlaps(other), isFalse, reason: 'touches ${kBarTabs[n].label}, $why');
            }
            expect(shape.rect.overlaps(geo.keyCircle()), isFalse, reason: 'touches the Start key, $why');
          }
        });
      }
    }

    // The same promise through the motion, not only at rest. A finger lifts the lens (it grows 8%)
    // while the icon under it magnifies 10%; a landing squashes it 5% wide and short; a compact bar
    // holds the icon alone.
    for (final width in const [320.0, 360.0, 390.0, 412.0]) {
      test('${width.toInt()} dp: a lifted, landing or compact lens never cuts into its icon', () {
        final geo = BarGeometry(width);
        for (var slot = 0; slot < kBarSlots; slot++) {
          final (l, r) = geo.lensEdges(slot);
          LensShape shape({double lift = 0, double squash = 0, double collapse = 0}) => BarLensPainter.shapeFor(
            left: l,
            right: r,
            collapse: collapse,
            labelsOut: collapse,
            restWidth: geo.lensWidth,
            labelWidth: geo.labelBoxWidth,
            lift: lift,
            squash: squash,
          );
          Rect icon(double scale, {double collapse = 0}) {
            final box = geo.iconRect(slot, collapse: collapse);
            return Rect.fromCenter(center: box.center, width: box.width * scale, height: box.height * scale);
          }

          final cases = <String, (LensShape, Rect)>{
            'lifted': (shape(lift: 1), icon(1 + MmBottomBar.magnify)),
            'landing': (shape(squash: 0.05), icon(1)),
            'compact': (shape(collapse: 1), icon(1, collapse: 1)),
            'compact and lifted': (shape(collapse: 1, lift: 1), icon(1 + MmBottomBar.magnify, collapse: 1)),
          };
          for (final MapEntry(key: name, value: (lens, box)) in cases.entries) {
            for (final corner in [box.topLeft, box.topRight, box.bottomLeft, box.bottomRight]) {
              expect(_depth(lens, corner), greaterThanOrEqualTo(2), reason: '$name, slot $slot at ${width.toInt()} dp: icon corner $corner, lens $lens');
            }
          }
        }
      });
    }
  });

  group('the scrub physics (NAV 6.5)', () {
    test('the rubber band resists more the further it is pulled, and never passes 0.55 x 1.2 slots', () {
      const slot = 60.0;
      var last = 0.0;
      for (var o = 6.0; o <= 600; o += 6) {
        final b = MmBottomBar.rubberBand(o, slot);
        expect(b, greaterThan(last));
        expect(b, lessThan(o));
        expect(b, lessThan(1.2 * slot));
        last = b;
      }
      expect(MmBottomBar.rubberBand(-30, slot), -MmBottomBar.rubberBand(30, slot));
    });

    test('a flick projects with the fast decay: 1,000 dp/s travels about 99 dp', () {
      expect(MmBottomBar.project(100, 1000), closeTo(199, 0.01));
      expect(MmBottomBar.project(100, -500), closeTo(50.5, 0.01));
      expect(MmBottomBar.project(100, 0), 100);
    });

    test("the badges: Review's count on Practice and You's dot; Colleges has no tab to show one", () {
      final all = MmBottomBar.visibleBadges(const BarBadges(reviewCount: 3, collegesDot: true, youDot: true));
      expect(all, (review: true, you: true));
      final none = MmBottomBar.visibleBadges(const BarBadges(collegesDot: true));
      expect(none, (review: false, you: false));
    });
  });
}
