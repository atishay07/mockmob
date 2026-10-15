// Goldens for the thirteen subject objects added on 15 Oct 2026 (SubjectEmblem.objectArt): every one
// at the hero size (open, with its contact shadow under its foot), then framed at 56 dp, open at 56 dp
// and open at 40 dp. Night and Day. The first fifteen and the language notebook are in
// object_art_golden_test.dart.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';
import 'package:mockmob/core/theme/theme.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

final List<SubjectIdentity> _subjects = SubjectIdentity.moreSubjects;

/// Decodes every object in the tree before the golden is taken: each emblem's own render at its own
/// size, through the bundle and pixel ratio it draws with (so the cache keys match).
Future<void> _precacheObjects(WidgetTester tester) async {
  final emblems = find.byType(SubjectEmblem, skipOffstage: false).evaluate().toList();
  await tester.runAsync(() async {
    for (final element in emblems) {
      final emblem = element.widget as SubjectEmblem;
      if (emblem.size < EmblemSizes.chip) continue;
      final render = SubjectRender.of(emblem.subject);
      if (render == null) continue;
      final dpr = MediaQuery.devicePixelRatioOf(element);
      await precacheImage(render.provider(emblem.size, dpr, framed: emblem.framed), element);
    }
  });
  await tester.pump();
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 18, bottom: 10),
        child: Text(text, style: context.mmType.caption.copyWith(color: context.mmColors.ink3)),
      );
}

Widget _sheet() => Builder(builder: (context) {
      final t = context.mmType;
      final c = context.mmColors;
      Widget row(double size, {required bool framed}) => Wrap(
            spacing: size < 50 ? 14 : 12,
            runSpacing: 12,
            children: [for (final s in _subjects) SubjectEmblem(subject: s.id, size: size, framed: framed)],
          );
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _Heading('136 dp, open (hero)'),
            Wrap(
              spacing: 12,
              runSpacing: 10,
              children: [
                for (final s in _subjects)
                  SizedBox(
                    width: 136,
                    child: Column(
                      children: [
                        SubjectEmblem(subject: s.id, size: 136, framed: false),
                        const SizedBox(height: 2),
                        Text(s.name, style: t.caption.copyWith(color: c.ink2), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  ),
              ],
            ),
            const _Heading('56 dp, framed'),
            row(56, framed: true),
            const _Heading('56 dp, open'),
            row(56, framed: false),
            const _Heading('40 dp, open'),
            row(40, framed: false),
          ],
        ),
      );
    });

void main() {
  setUpAll(loadAppFonts);
  setUp(() => SubjectEmblem.objectArt = true);
  tearDown(() => SubjectEmblem.objectArt = false);

  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('the thirteen more objects, $tag', (tester) async {
      final boundary = GlobalKey();
      await pumpMockmob(
        tester,
        RepaintBoundary(
          key: boundary,
          child: Builder(builder: (context) => ColoredBox(color: context.mmColors.ground, child: _sheet())),
        ),
        brightness: brightness,
        size: const Size(620, 1280),
        disableAnimations: true,
      );
      await _precacheObjects(tester);
      await expectLater(find.byType(Scaffold).first, matchesGoldenFile('goldens/object_art_more_$tag.png'));
      final dir = Platform.environment['MM_PREVIEW_DIR'];
      if (dir != null && dir.isNotEmpty) {
        final box = boundary.currentContext!.findRenderObject()! as RenderRepaintBoundary;
        await tester.runAsync(() async {
          final image = await box.toImage(pixelRatio: 2);
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          image.dispose();
          await File('$dir/object_art_more_$tag.png').writeAsBytes(bytes!.buffer.asUint8List());
        });
      }
    });
  }
}
