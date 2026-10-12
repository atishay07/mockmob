import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';

/// Serves `assets/...` straight from the project folder, so widgets that use `Image.asset`
/// (Mobi) render in tests even though pubspec has no asset list in the test run.
class FileAssetBundle extends CachingAssetBundle {
  FileAssetBundle([this.root = '.']);

  final String root;

  @override
  Future<ByteData> load(String key) async {
    if (key == 'AssetManifest.bin') {
      return const StandardMessageCodec().encodeMessage(<String, Object>{})!;
    }
    final file = File('$root/$key');
    if (!file.existsSync()) throw FlutterError('Unable to load asset: $key');
    return ByteData.sublistView(Uint8List.fromList(await file.readAsBytes()));
  }
}

/// Default golden frame: 360 by 780 logical px at device pixel ratio 2 (spec A10).
const Size kGoldenSize = Size(360, 780);

/// Pumps [child] inside the MockMob theme at the golden size. [textScale] scales text, and
/// [overrides] are Riverpod overrides.
Future<void> pumpMockmob(
  WidgetTester tester,
  Widget child, {
  Brightness brightness = Brightness.light,
  Size size = kGoldenSize,
  double textScale = 1,
  bool disableAnimations = false,
  List<Override> overrides = const [],
  bool wrapInScaffold = true,
}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          themeMode: brightness == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
          builder: (context, app) => MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: TextScaler.linear(textScale),
              disableAnimations: disableAnimations,
            ),
            child: app!,
          ),
          home: wrapInScaffold ? Scaffold(body: child) : child,
        ),
      ),
    ),
  );
  await settleImages(tester);
}

/// Lets asset images load (they decode on the real event loop, not the fake one) and plays
/// out one-shot entrance animations such as Mobi's settle.
Future<void> settleImages(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 80)));
    await tester.pump(const Duration(milliseconds: 80));
  }
}

/// A caption above a golden sample. Test-only chrome.
class Sample extends StatelessWidget {
  const Sample(this.label, this.child, {super.key});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: context.mmType.small.copyWith(color: colors.ink3, fontSize: 12, height: 1.2)),
        const SizedBox(height: 6),
        child,
      ],
    );
  }
}

/// A padded, scrollable column of [Sample]s on the ground colour.
class SampleColumn extends StatelessWidget {
  const SampleColumn({super.key, required this.children, this.gap = 16});

  final List<Widget> children;
  final double gap;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) SizedBox(height: gap),
            children[i],
          ],
        ],
      ),
    );
  }
}
