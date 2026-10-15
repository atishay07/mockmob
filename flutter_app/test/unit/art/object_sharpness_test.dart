import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';

/// The pixels each object file holds against the pixels its biggest call site needs, and the weight
/// of the whole set. tool/asset_audit.py prints the same numbers for every call site.
void main() {
  group('object renders are sharp where they are drawn biggest', () {
    test('every file holds at least 3.5 pixels per dp at the 136 dp hero size', () {
      for (final r in SubjectRender.all) {
        final drawn = r.rectIn(EmblemSizes.hero, framed: false).width;
        expect(r.width, greaterThanOrEqualTo((drawn * 3.5).ceil()), reason: '${r.name} is ${r.width} px wide and is drawn ${drawn.toStringAsFixed(1)} dp wide at the hero size');
      }
    });

    test('every file holds at least 3.5 pixels per dp at the 96 dp subject tile, framed or open', () {
      for (final r in SubjectRender.all) {
        for (final framed in const [true, false]) {
          final drawn = r.rectIn(96, framed: framed).width;
          expect(r.width, greaterThanOrEqualTo((drawn * 3.5).ceil()), reason: '${r.name} framed: $framed');
        }
      }
    });

    test('no file is bigger than 1024 px on its long side, and none is enlarged past its source', () {
      for (final r in SubjectRender.all) {
        expect(r.width > r.height ? r.width : r.height, lessThanOrEqualTo(1024), reason: r.name);
      }
    });
  });

  group('the objects stay light', () {
    test('no file is over 190 KB and the whole set stays within its APK budget', () {
      var total = 0;
      for (final r in SubjectRender.all) {
        final bytes = File(r.asset).lengthSync();
        total += bytes;
        expect(bytes, lessThanOrEqualTo(190 * 1024), reason: '${r.name} is ${bytes ~/ 1024} KB');
      }
      // The 29 objects: 16 at the sizes the website and the app already shared, re-exported sharper,
      // plus 13 new. The set was 0.8 MB before the 15 Oct 2026 export; the APK may grow by at most 3 MB.
      expect(total, lessThanOrEqualTo((3.6 * 1024 * 1024).round()), reason: 'the object set weighs ${(total / 1024 / 1024).toStringAsFixed(2)} MB');
    });
  });

  group('the new objects stand on a believable foot', () {
    test('foot centre and width are shares of the file, and the ground sits in its lower part', () {
      for (final s in SubjectIdentity.moreSubjects) {
        final r = SubjectRender.of(s.id)!;
        expect(r.footX, inInclusiveRange(0.2, 0.8), reason: r.name);
        expect(r.footWidth, inInclusiveRange(0.4, 1.0), reason: r.name);
        expect(r.ground, inInclusiveRange(0.85, 0.98), reason: r.name);
        // The foot never runs past the file's own edges.
        expect(r.footX - r.footWidth / 2, greaterThanOrEqualTo(-0.01), reason: r.name);
        expect(r.footX + r.footWidth / 2, lessThanOrEqualTo(1.01), reason: r.name);
      }
    });
  });
}
