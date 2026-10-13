import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/services.dart';

/// Loads Roboto (from the Flutter SDK's cache) so the exam look draws the face an Android phone
/// falls back to when it is asked for Arial, instead of the Ahem test font. Call once from
/// `setUpAll`, after `loadAppFonts`. If the SDK cache has no Roboto the exam text stays on the
/// test font and the goldens will differ, which is loud rather than silent.
Future<void> loadExamFont() async {
  final root = Platform.environment['FLUTTER_ROOT'] ?? 'C:/flutter';
  final dir = '$root/bin/cache/artifacts/material_fonts';
  final loader = FontLoader('Roboto');
  for (final file in ['roboto-regular.ttf', 'roboto-medium.ttf', 'roboto-bold.ttf']) {
    final f = File('$dir/$file');
    if (!f.existsSync()) continue;
    final bytes = await f.readAsBytes();
    loader.addFont(Future.value(ByteData.sublistView(Uint8List.fromList(bytes))));
  }
  await loader.load();
}
