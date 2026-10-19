// spec 5.7: every file folds.json lists exists, every Fold has an idle still and a head, the bundle
// stays inside its budget, and pubspec ships the folder.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/widgets/fold_manifest.dart';

void main() {
  final manifest = FoldManifest.parse(File(foldManifestAsset).readAsStringSync());

  test('every Fold has an idle still, every pose resolves, and a head', () {
    for (final k in FoldKey.values) {
      final art = manifest[k];
      expect(art, isNotNull, reason: k.name);
      for (final p in FoldPose.values) {
        expect(art!.still(p), isNotNull, reason: '${k.name} ${p.name}');
      }
      expect(art!.head, isNotNull, reason: k.name);
    }
  });

  test('every listed file exists', () {
    for (final art in manifest.folds.values) {
      for (final f in art.files) {
        expect(File(f).existsSync(), isTrue, reason: f);
      }
    }
  });

  test('figure boxes and eyes are fractions inside the still', () {
    for (final art in manifest.folds.values) {
      for (final s in art.poses.values) {
        expect(s.box.left >= 0 && s.box.top >= 0 && s.box.right <= 1.001 && s.box.bottom <= 1.001, isTrue, reason: s.file);
        for (final e in s.eyes) {
          expect(e.left >= 0 && e.right <= 1 && e.top >= 0 && e.bottom <= 1, isTrue, reason: s.file);
        }
      }
    }
  });

  test('the bundle stays inside the spec budget (about 2.9 MB)', () {
    var bytes = 0;
    for (final f in Directory('assets/folds').listSync().whereType<File>()) {
      bytes += f.lengthSync();
    }
    expect(bytes, lessThan(3200 * 1024));
  });

  test('pubspec ships assets/folds/', () {
    expect(File('pubspec.yaml').readAsStringSync(), contains('- assets/folds/'));
  });
}
