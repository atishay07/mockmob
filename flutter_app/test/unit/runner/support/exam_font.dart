import 'dart:io';

import 'package:flutter/services.dart';

/// Loads Roboto (from the Flutter SDK's cache) as the exam look's 'Arial', the face an Android
/// phone draws when it is asked for Arial, so the exam text is real type instead of the Ahem
/// test font's boxes (the test engine does not follow `fontFamilyFallback`). Call once from
/// `setUpAll`, after `loadAppFonts`. If the SDK cache has no Roboto the exam text stays on the
/// test font and the goldens will differ, which is loud rather than silent.
Future<void> loadExamFont() async {
  final root = Platform.environment['FLUTTER_ROOT'] ?? 'C:/flutter';
  final dir = '$root/bin/cache/artifacts/material_fonts';
  final faces = <ByteData>[];
  for (final file in ['roboto-regular.ttf', 'roboto-medium.ttf', 'roboto-bold.ttf']) {
    final f = File('$dir/$file');
    if (!f.existsSync()) continue;
    faces.add(ByteData.sublistView(Uint8List.fromList(await f.readAsBytes())));
  }
  for (final family in ['Arial', 'Roboto']) {
    final loader = FontLoader(family);
    for (final face in faces) {
      loader.addFont(Future.value(face));
    }
    await loader.load();
  }
}
