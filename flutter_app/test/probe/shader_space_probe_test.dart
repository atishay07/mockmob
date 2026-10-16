import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('probe', (tester) async {
    print('supported: ${ui.ImageFilter.isShaderFilterSupported}');
    if (!ui.ImageFilter.isShaderFilterSupported) return;
    final program = await tester.runAsync(() => ui.FragmentProgram.fromAsset('shaders/probe.frag'));
    final shader = program!.fragmentShader();
    tester.view.physicalSize = const Size(400, 300);
    tester.view.devicePixelRatio = 1;
    final key = GlobalKey();
    await tester.pumpWidget(Directionality(
      textDirection: TextDirection.ltr,
      child: RepaintBoundary(
        key: key,
        child: Stack(children: [
          const Positioned.fill(child: ColoredBox(color: Color(0xFF808080))),
          Positioned(
            left: 100, top: 120, width: 200, height: 100,
            child: ClipRect(child: BackdropFilter(filter: ui.ImageFilter.shader(shader), child: const SizedBox.expand())),
          ),
        ]),
      ),
    ));
    final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final bytes = await tester.runAsync(() async {
      final img = await boundary.toImage();
      return (await img.toByteData())!;
    });
    int px(int x, int y, int c) => bytes!.getUint8((y * 400 + x) * 4 + c);
    for (final p in const [(100, 120), (150, 170), (299, 219), (50, 50)]) {
      print('at $p: fragX=${px(p.$1, p.$2, 0) * 4} fragY=${px(p.$1, p.$2, 1) * 4} uSizeX=${px(p.$1, p.$2, 2) * 4}');
    }
  });
}
