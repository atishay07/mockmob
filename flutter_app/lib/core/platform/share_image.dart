import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

/// Renders the [RepaintBoundary] under [key] to a PNG, [pixelRatio] times its layout size.
/// Null when the boundary is not on screen or the render fails.
Future<Uint8List?> capturePng(GlobalKey key, {double pixelRatio = 3}) async {
  try {
    final boundary = key.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) return null;
    final image = await boundary.toImage(pixelRatio: pixelRatio);
    try {
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      return data?.buffer.asUint8List();
    } finally {
      image.dispose();
    }
  } on Object {
    return null;
  }
}

/// The system share sheet for one image. Swapped for a fake in tests.
abstract class ShareSurface {
  /// Opens the share sheet with [png] (named [name]) and [text]. False when it could not open.
  Future<bool> shareImage({required Uint8List png, required String name, required String text});
}

class SharePlusSurface implements ShareSurface {
  const SharePlusSurface();

  @override
  Future<bool> shareImage({required Uint8List png, required String name, required String text}) async {
    try {
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}${Platform.pathSeparator}$name');
      await file.writeAsBytes(png, flush: true);
      await SharePlus.instance.share(ShareParams(files: [XFile(file.path, mimeType: 'image/png', name: name)], text: text));
      return true;
    } on Object {
      return false;
    }
  }
}

final shareSurfaceProvider = Provider<ShareSurface>((ref) => const SharePlusSurface());
