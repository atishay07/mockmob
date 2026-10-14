import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Loads the bundled TTFs so goldens render the real type instead of the Ahem test font.
/// Call once from `setUpAll`. Tests run with the project root as the working directory.
Future<void> loadAppFonts() async {
  TestWidgetsFlutterBinding.ensureInitialized();

  await _loadFamily('BricolageCondensed', ['assets/fonts/BricolageCondensed-Bold.ttf']);
  await _loadFamily('BricolageHeadline', ['assets/fonts/BricolageHeadline-SemiBold.ttf']);
  await _loadFamily('BricolageTitle', ['assets/fonts/BricolageTitle-SemiBold.ttf']);
  await _loadFamily('BricolageWordmark', ['assets/fonts/BricolageWordmark-Bold.ttf']);
  await _loadFamily('HankenGrotesk', [
    'assets/fonts/HankenGrotesk-Regular.ttf',
    'assets/fonts/HankenGrotesk-Medium.ttf',
    'assets/fonts/HankenGrotesk-SemiBold.ttf',
    'assets/fonts/HankenGrotesk-Bold.ttf',
  ]);

  // The icon fonts of lucide_icons_flutter: the default weight and the 1.55 stroke weight.
  final lucide = _packageRoot('lucide_icons_flutter');
  if (lucide != null) {
    await _loadFamily('packages/lucide_icons_flutter/Lucide', ['$lucide/assets/lucide.ttf']);
    await _loadFamily(
      'packages/lucide_icons_flutter/Lucide300',
      ['$lucide/assets/build_font/LucideVariable-w300.ttf'],
    );
  }
}

/// The Material icon font from the Flutter SDK, for screens that draw `Icons.*` (the bar's tab
/// glyphs, a switch thumb's check). The test font loader does not include it, so without this
/// every such icon renders as an empty box. Does nothing when the SDK's font is not found.
Future<void> loadMaterialIconFont() async {
  TestWidgetsFlutterBinding.ensureInitialized();
  final root = Platform.environment['FLUTTER_ROOT'];
  if (root == null) return;
  final file = File('$root/bin/cache/artifacts/material_fonts/materialicons-regular.otf');
  if (!file.existsSync()) return;
  final bytes = await file.readAsBytes();
  final loader = FontLoader('MaterialIcons')..addFont(Future.value(ByteData.sublistView(Uint8List.fromList(bytes))));
  await loader.load();
}

Future<void> _loadFamily(String family, List<String> paths) async {
  final loader = FontLoader(family);
  for (final path in paths) {
    final bytes = await File(path).readAsBytes();
    loader.addFont(Future.value(ByteData.sublistView(Uint8List.fromList(bytes))));
  }
  await loader.load();
}

/// Resolves a dependency's directory from `.dart_tool/package_config.json`.
String? _packageRoot(String name) {
  final config = File('.dart_tool/package_config.json');
  if (!config.existsSync()) return null;
  final json = jsonDecode(config.readAsStringSync()) as Map<String, dynamic>;
  for (final entry in (json['packages'] as List).cast<Map<String, dynamic>>()) {
    if (entry['name'] == name) {
      final root = Uri.parse(entry['rootUri'] as String);
      final base = root.isAbsolute ? root : config.absolute.parent.uri.resolveUri(root);
      return File.fromUri(base).path.replaceAll(r'\', '/');
    }
  }
  return null;
}
