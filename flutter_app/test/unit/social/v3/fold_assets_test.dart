// spec 5.7: every file folds.json lists exists, every Fold has its real stills (idle, cheer and think
// from the final art of 20 Oct) and a head, a pose not generated yet (shrug, wave) falls back to that
// Fold's idle (never a broken image), the bundle stays inside its budget, and pubspec ships the folder.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/logic/fold_catalog.dart';
import 'package:mockmob/features/social/v3/widgets/fold_manifest.dart';
import 'package:mockmob/features/social/v3/widgets/parcel.dart';

void main() {
  final manifest = FoldManifest.parse(File(foldManifestAsset).readAsStringSync());

  test('the manifest is the final art', () {
    expect(manifest.source, 'final');
    expect(manifest.folds.length, 12);
  });

  test('every Fold has its own idle, cheer and think, and a head', () {
    for (final k in FoldKey.values) {
      final art = manifest[k];
      expect(art, isNotNull, reason: k.name);
      for (final p in [FoldPose.idle, FoldPose.cheer, FoldPose.think]) {
        final s = art!.poses[p];
        expect(s, isNotNull, reason: '${k.name} ${p.name}');
        expect(s!.file, '${foldAssetDir}fold-${k.name}-${p.name}@256.webp');
      }
      expect(art!.poses[FoldPose.idle]!.large, '${foldAssetDir}fold-${k.name}-idle@512.webp');
      expect(art.poses[FoldPose.cheer]!.large, '${foldAssetDir}fold-${k.name}-cheer@512.webp');
      expect(art.head, '${foldAssetDir}fold-${k.name}-head@128.webp');
    }
  });

  test('a pose without art (shrug, wave) falls back to the same Fold\'s idle', () {
    for (final k in FoldKey.values) {
      final art = manifest[k]!;
      for (final p in FoldPose.values) {
        final s = art.still(p);
        expect(s, isNotNull, reason: '${k.name} ${p.name}');
        if (!art.poses.containsKey(p)) expect(s!.file, art.poses[FoldPose.idle]!.file, reason: '${k.name} ${p.name}');
        expect(File(s!.file).existsSync(), isTrue, reason: s.file);
      }
    }
  });

  test('every pose of a Fold shares the idle box, so a cross-fade never jumps', () {
    for (final art in manifest.folds.values) {
      final idle = art.poses[FoldPose.idle]!.box;
      for (final s in art.poses.values) {
        expect(s.box, idle, reason: s.file);
      }
    }
  });

  test('every listed file exists', () {
    for (final art in manifest.folds.values) {
      for (final f in art.files) {
        expect(File(f).existsSync(), isTrue, reason: f);
      }
    }
  });

  test('figure boxes and eyes are fractions inside the still; two eyes per pose', () {
    for (final art in manifest.folds.values) {
      for (final s in art.poses.values) {
        expect(s.box.left >= 0 && s.box.top >= 0 && s.box.right <= 1.001 && s.box.bottom <= 1.001, isTrue, reason: s.file);
        expect(s.eyes.length, 2, reason: s.file);
        for (final e in s.eyes) {
          expect(e.left >= 0 && e.right <= 1 && e.top >= 0 && e.bottom <= 1, isTrue, reason: s.file);
        }
      }
    }
  });

  test('the paper colour is the catalog\'s', () {
    for (final art in manifest.folds.values) {
      expect(art.colour.toARGB32(), foldPaperArgb(art.key), reason: art.key.name);
    }
  });

  test('the parcel stills and the stamp seal are bundled', () {
    for (final f in [...ParcelStills.all, ParcelStills.seal]) {
      expect(File(f).existsSync(), isTrue, reason: f);
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
