// The one door every Fold image comes through (spec 5.2, 5.7): `assets/folds/folds.json`, written by
// `tool/fold_manifest.py`. It maps a Fold and a pose to a still, the figure's box in that still (so
// every pose shares one boot pivot), the eye boxes for the blink, the visor colour and the head disc.
// The final art drops in by re-running the script: no code change.

import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/mob_v3_models.dart';

const String foldManifestAsset = 'assets/folds/folds.json';
const String foldAssetDir = 'assets/folds/';

class FoldStill {
  const FoldStill({required this.file, this.large, required this.box, this.eyes = const [], this.visorColour});

  factory FoldStill.fromJson(Map<String, dynamic> j) {
    Rect rect(Object? v) {
      final l = (v as List).map((e) => (e as num).toDouble()).toList();
      return Rect.fromLTWH(l[0], l[1], l[2], l[3]);
    }

    final vc = j['visorColour'];
    return FoldStill(
      file: '$foldAssetDir${j['file']}',
      large: j['large'] == null ? null : '$foldAssetDir${j['large']}',
      box: rect(j['box']),
      eyes: [for (final e in (j['eyes'] as List? ?? const [])) rect(e)],
      visorColour: vc is String && vc.length == 6 ? Color(int.parse('FF$vc', radix: 16)) : null,
    );
  }

  /// 256 px square.
  final String file;

  /// 512 px square, for the reveal, the podium's first place and the shelf detail.
  final String? large;

  /// The figure inside the square still, as fractions (left, top, width, height).
  final Rect box;

  /// Eye boxes as fractions of the still.
  final List<Rect> eyes;
  final Color? visorColour;
}

class FoldArt {
  const FoldArt({required this.key, required this.colour, required this.poses, this.head});

  final FoldKey key;

  /// The paper colour (spec 0.4).
  final Color colour;
  final Map<FoldPose, FoldStill> poses;
  final String? head;

  FoldStill? still(FoldPose pose) => poses[pose] ?? poses[FoldPose.idle];

  Iterable<String> get files sync* {
    final seen = <String>{};
    for (final s in poses.values) {
      if (seen.add(s.file)) yield s.file;
      final l = s.large;
      if (l != null && seen.add(l)) yield l;
    }
    if (head != null) yield head!;
  }
}

class FoldManifest {
  const FoldManifest(this.folds, {this.source = 'interim'});

  factory FoldManifest.parse(String json) {
    final j = jsonDecode(json) as Map<String, dynamic>;
    final out = <FoldKey, FoldArt>{};
    final folds = j['folds'] as Map<String, dynamic>;
    for (final e in folds.entries) {
      final key = FoldKey.parse(e.key);
      if (key == null) continue;
      final v = e.value as Map<String, dynamic>;
      final poses = <FoldPose, FoldStill>{};
      final pj = v['poses'] as Map<String, dynamic>? ?? const {};
      for (final p in FoldPose.values) {
        final raw = pj[p.name];
        if (raw is Map<String, dynamic>) poses[p] = FoldStill.fromJson(raw);
      }
      final c = v['colour'];
      out[key] = FoldArt(
        key: key,
        colour: c is String && c.length == 6 ? Color(int.parse('FF$c', radix: 16)) : const Color(0xFFBDB6A6),
        poses: poses,
        head: v['head'] == null ? null : '$foldAssetDir${v['head']}',
      );
    }
    return FoldManifest(out, source: (j['source'] as String?) ?? 'interim');
  }

  static const FoldManifest empty = FoldManifest({});

  final Map<FoldKey, FoldArt> folds;
  final String source;

  FoldArt? operator [](FoldKey? k) => k == null ? null : folds[k];

  /// Loaded once; widgets draw the initial disc until it arrives (and forever if a file is missing).
  static FoldManifest? _cache;
  static FoldManifest? get cached => _cache;

  static Future<FoldManifest> load([AssetBundle? bundle]) async {
    final c = _cache;
    if (c != null) return c;
    try {
      final s = await (bundle ?? rootBundle).loadString(foldManifestAsset);
      return _cache = FoldManifest.parse(s);
    } on Object {
      return FoldManifest.empty;
    }
  }

  /// Tests set the manifest directly.
  static void setForTest(FoldManifest? m) => _cache = m;
}

final foldManifestProvider = FutureProvider<FoldManifest>((ref) => FoldManifest.load());

/// The manifest when ready, else null (callers draw the fallback).
FoldManifest? foldManifestOf(WidgetRef ref) => FoldManifest.cached ?? ref.watch(foldManifestProvider).value;

/// Warms the decoder for the Folds a screen will show (the den calls it on open).
Future<void> precacheFolds(BuildContext context, Iterable<FoldKey?> keys, {FoldPose pose = FoldPose.idle, bool large = false}) async {
  final m = await FoldManifest.load();
  if (!context.mounted) return;
  for (final k in keys) {
    final s = m[k]?.still(pose);
    if (s == null) continue;
    final path = large ? (s.large ?? s.file) : s.file;
    try {
      await precacheImage(AssetImage(path), context);
    } on Object {
      // A missing file falls back to the initial disc.
    }
    if (!context.mounted) return;
  }
}
