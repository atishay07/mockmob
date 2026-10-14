import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

/// A contact sheet of a moving thing: the frames of an animation, side by side or stacked, as
/// one golden image. A single PNG cannot show motion; this shows where the pieces are at each
/// moment, so the liquid dock tile, the morphing sheet and the shimmer band are judged across
/// their travel, not at one instant.
///
/// Pumps forward by the gap between consecutive [atMs] (times since the caller's last pump, in
/// milliseconds, ascending), captures [root] at 1x each time and draws the [crop] of each (the
/// whole frame when null; in logical px, times [layerScale] when the captured layer is the
/// view's own, which is in physical px) scaled by [scale] into a grid of [columns].
Future<ui.Image> frameSheet(
  WidgetTester tester, {
  required Finder root,
  required List<int> atMs,
  Rect? crop,
  double scale = 1,
  int columns = 1,
  double pixelRatio = 1,
  double layerScale = 1,
  Future<void> Function(int frame)? beforeFrame,
}) async {
  RenderObject object = tester.renderObject(root);
  while (!object.isRepaintBoundary) {
    object = object.parent!;
  }
  final frames = <ui.Image>[];
  var previous = 0;
  for (var i = 0; i < atMs.length; i++) {
    if (beforeFrame != null) await beforeFrame(i);
    final gap = atMs[i] - previous;
    previous = atMs[i];
    if (gap > 0) await tester.pump(Duration(milliseconds: gap));
    final image = await tester.runAsync(() async {
      final layer = object.debugLayer! as OffsetLayer;
      return layer.toImage(object.paintBounds, pixelRatio: pixelRatio);
    });
    frames.add(image!);
  }

  final source = crop == null
      ? Rect.fromLTWH(0, 0, frames.first.width.toDouble(), frames.first.height.toDouble())
      : Rect.fromLTRB(crop.left, crop.top, crop.right, crop.bottom).multiply(pixelRatio * layerScale);
  final tileW = source.width * scale;
  final tileH = source.height * scale;
  const gap = 2.0;
  final rows = (frames.length / columns).ceil();
  final width = columns * tileW + (columns - 1) * gap;
  final height = rows * tileH + (rows - 1) * gap;
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  canvas.drawRect(Rect.fromLTWH(0, 0, width, height), Paint()..color = const Color(0xFF808080));
  for (var i = 0; i < frames.length; i++) {
    final dx = (i % columns) * (tileW + gap);
    final dy = (i ~/ columns) * (tileH + gap);
    canvas.drawImageRect(
      frames[i],
      source,
      Rect.fromLTWH(dx, dy, tileW, tileH),
      Paint()..filterQuality = FilterQuality.medium,
    );
  }
  final picture = recorder.endRecording();
  final sheet = picture.toImageSync(width.ceil(), height.ceil());
  picture.dispose();
  for (final frame in frames) {
    frame.dispose();
  }
  return sheet;
}

extension on Rect {
  Rect multiply(double k) => Rect.fromLTRB(left * k, top * k, right * k, bottom * k);
}
