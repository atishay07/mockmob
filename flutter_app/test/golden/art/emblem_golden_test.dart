import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';
import 'package:mockmob/core/art/emblem_painter.dart';
import 'package:mockmob/core/art/emblem_palette.dart';
import 'package:mockmob/core/art/emblem_subjects.dart';
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
                      SubjectEmblem(subject: s.id, size: 112, marked: true),
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
                    SubjectEmblem(subject: s.id, size: 56, marked: true),
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
                    SubjectEmblem(subject: s.id, size: 24, marked: true),
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Heading('160 dp, the largest use (result header)'),
          const Row(children: [
            SubjectEmblem(subject: 'accountancy', size: 160, marked: true),
            SizedBox(width: 24),
            SubjectEmblem(subject: 'economics', size: 160, marked: true),
          ]),
          const SizedBox(height: 24),
          const _Heading('Picker: unmarked, marked'),
          Row(children: [
            for (final (id, on) in const [('business_studies', false), ('business_studies', true), ('general_test', false), ('general_test', true), ('sociology', false), ('sociology', true)]) ...[
              SubjectEmblem(subject: id, size: 56, marked: on, selectable: true),
              const SizedBox(width: 10),
            ],
          ]),
          const SizedBox(height: 24),
          const _Heading('Unframed on the screen: it stands on its own pool'),
          Row(children: [
            for (final id in const ['chemistry', 'sociology', 'physics'])
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: SubjectEmblem(subject: id, size: 88, framed: false, marked: true),
              ),
          ]),
          const SizedBox(height: 24),
          const _Heading('Language papers and a subject without an object'),
          Row(children: [
            const SubjectEmblem(subject: 'hindi', size: 72, marked: true),
            const SizedBox(width: 12),
            const SubjectEmblem(subject: 'fine_arts', size: 72),
            const SizedBox(width: 12),
            const SubjectEmblem(subject: 'hindi', size: 32),
            const SizedBox(width: 12),
            const SubjectEmblem(subject: 'fine_arts', size: 32),
            const SizedBox(width: 12),
            const SubjectEmblem(subject: 'fine_arts', size: 72, marked: true),
          ]),
        ],
      ),
    );
  });
}

/// One subject's emblem frozen at idle phase [t] (what the 7.2 s idle cycle shows at that moment).
class _Frame extends StatelessWidget {
  const _Frame(this.subject, this.t, {this.size = 72});

  final String subject;
  final double t;
  final double size;

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final identity = SubjectIdentity.of(subject)!;
    return CustomPaint(
      size: Size.square(size),
      painter: EmblemPainter(
        subject: identity,
        art: EmblemArt.forKind(identity.kind),
        palette: EmblemPalette.of(identity, brightness),
        brightness: brightness,
        detail: EmblemDetail.forSize(size),
        framed: true,
        idle: ValueNotifier<double>(t == 0 ? 1e-6 : t),
        ink: ValueNotifier<double>(1),
        inking: () => false,
        phase: 0,
      ),
    );
  }
}

Widget _idleFrames() {
  return Builder(builder: (context) {
    final t = context.mmType;
    final c = context.mmColors;
    const phases = [0.0, 0.18, 0.36, 0.54, 0.72];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Heading('Idle cycle, five moments of 7.2 s'),
          for (final id in const ['physics', 'chemistry', 'computer_science', 'sociology', 'geography', 'psychology']) ...[
            Text(SubjectIdentity.of(id)!.name, style: t.caption.copyWith(color: c.ink3, fontSize: 11)),
            const SizedBox(height: 4),
            Row(children: [
              for (final p in phases) ...[_Frame(id, p, size: 60), const SizedBox(width: 10)],
            ]),
            const SizedBox(height: 10),
          ],
          // At 24 dp the drift is larger in the design space so it still reads.
          const _Heading('24 dp: Geography, Sociology, Psychology'),
          for (final id in const ['geography', 'sociology', 'psychology'])
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(children: [
                for (final p in phases) ...[_Frame(id, p, size: 24), const SizedBox(width: 26)],
              ]),
            ),
        ],
      ),
    );
  });
}

/// The default in a list: unframed, unmarked, no tile. Stand-in rows on the screen ground.
Widget _rows() {
  return Builder(builder: (context) {
    final t = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Heading('Rows: unframed, unmarked, 40 dp'),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final s in SubjectIdentity.subjects)
                SizedBox(
                  width: 176,
                  child: Row(children: [
                    SubjectEmblem(subject: s.id, size: 40, framed: false),
                    const SizedBox(width: 8),
                    Expanded(child: Text(s.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.labelLarge.copyWith(fontSize: 14))),
                  ]),
                ),
            ],
          ),
          const SizedBox(height: 20),
          const _Heading('Hero size, unframed and still (96 dp)'),
          Row(children: [
            for (final id in const ['accountancy', 'chemistry', 'psychology']) ...[
              SubjectEmblem(subject: id, size: 96, framed: false),
              const SizedBox(width: 12),
            ],
          ]),
        ],
      ),
    );
  });
}

void main() {
  setUpAll(loadAppFonts);
  _artGolden('emblem_gallery', _gallery, size: const Size(400, 1480));
  _artGolden('emblem_idle_frames', _idleFrames, size: const Size(400, 800));
  _artGolden('emblem_rows', _rows, size: const Size(400, 700));
  _artGolden('emblem_states', _states, size: const Size(384, 640));
}
