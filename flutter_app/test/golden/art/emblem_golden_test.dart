import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';
import 'package:mockmob/core/theme/theme.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// Runs [build] once per theme as `goldens/<name>_<night|day>.png`. With `MM_PREVIEW_DIR` set,
/// also writes a DPR 2 render there for close review (not compared).
void _artGolden(String name, Widget Function() build, {required Size size}) {
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      final boundary = GlobalKey();
      await pumpMockmob(
        tester,
        RepaintBoundary(
          key: boundary,
          child: Builder(builder: (context) => ColoredBox(color: context.mmColors.ground, child: build())),
        ),
        brightness: brightness,
        size: size,
        disableAnimations: true,
      );
      await expectLater(find.byType(Scaffold).first, matchesGoldenFile('goldens/${name}_$tag.png'));
      final dir = Platform.environment['MM_PREVIEW_DIR'];
      if (dir != null && dir.isNotEmpty) {
        final box = boundary.currentContext!.findRenderObject()! as RenderRepaintBoundary;
        await tester.runAsync(() async {
          final image = await box.toImage(pixelRatio: 2);
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          image.dispose();
          await File('$dir/${name}_$tag.png').writeAsBytes(bytes!.buffer.asUint8List());
        });
      }
    });
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(text, style: context.mmType.caption.copyWith(color: context.mmColors.ink3)),
      );
}

Widget _gallery() {
  return Builder(builder: (context) {
    final t = context.mmType;
    final c = context.mmColors;
    final subjects = SubjectIdentity.subjects;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Heading('112 dp, plate'),
          Wrap(
            spacing: 12,
            runSpacing: 14,
            children: [
              for (final s in subjects)
                SizedBox(
                  width: 112,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SubjectEmblem(subject: s.id, size: 112),
                      const SizedBox(height: 6),
                      Text(s.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.caption.copyWith(color: c.ink2)),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 24),
          const _Heading('56 dp, tile'),
          Wrap(
            spacing: 14,
            runSpacing: 12,
            children: [
              for (final s in subjects)
                SizedBox(
                  width: 56,
                  child: Column(children: [
                    SubjectEmblem(subject: s.id, size: 56),
                    const SizedBox(height: 4),
                    Text(s.short, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.caption.copyWith(color: c.ink3, fontSize: 11)),
                  ]),
                ),
            ],
          ),
          const SizedBox(height: 24),
          const _Heading('24 dp, glyph, in rows'),
          Wrap(
            spacing: 8,
            runSpacing: 10,
            children: [
              for (final s in subjects)
                SizedBox(
                  width: 168,
                  child: Row(children: [
                    SubjectEmblem(subject: s.id, size: 24),
                    const SizedBox(width: 10),
                    Expanded(child: Text(s.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.labelLarge.copyWith(fontSize: 14))),
                  ]),
                ),
            ],
          ),
        ],
      ),
    );
  });
}

Widget _states() {
  return Builder(builder: (context) {
    final t = context.mmType;
    final c = context.mmColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Heading('160 dp, the largest use (result header)'),
          const Row(children: [
            SubjectEmblem(subject: 'accountancy', size: 160),
            SizedBox(width: 24),
            SubjectEmblem(subject: 'economics', size: 160),
          ]),
          const SizedBox(height: 24),
          const _Heading('Picker: unmarked, marked'),
          Row(children: [
            for (final (id, on) in const [('business_studies', false), ('business_studies', true), ('general_test', false), ('general_test', true)]) ...[
              SubjectEmblem(subject: id, size: 72, marked: on),
              const SizedBox(width: 12),
            ],
          ]),
          const SizedBox(height: 24),
          const _Heading('Unframed, on its own field'),
          Row(children: [
            for (final id in const ['physics', 'geography', 'sociology'])
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: SubjectIdentity.of(id)!.field(Theme.of(context).brightness),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Padding(padding: const EdgeInsets.all(8), child: SubjectEmblem(subject: id, size: 88, framed: false)),
                ),
              ),
          ]),
          const SizedBox(height: 24),
          const _Heading('Language papers and a subject without an object'),
          Row(children: [
            const SubjectEmblem(subject: 'hindi', size: 72),
            const SizedBox(width: 12),
            const SubjectEmblem(subject: 'fine_arts', size: 72),
            const SizedBox(width: 12),
            const SubjectEmblem(subject: 'hindi', size: 32),
            const SizedBox(width: 12),
            const SubjectEmblem(subject: 'fine_arts', size: 32),
            const SizedBox(width: 12),
            Expanded(child: Text('Initials, never a wrong object', style: t.caption.copyWith(color: c.ink3))),
          ]),
        ],
      ),
    );
  });
}

void main() {
  setUpAll(loadAppFonts);
  _artGolden('emblem_gallery', _gallery, size: const Size(384, 1180));
  _artGolden('emblem_states', _states, size: const Size(384, 640));
}
