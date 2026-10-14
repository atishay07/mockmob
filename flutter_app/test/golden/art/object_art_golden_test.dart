// Goldens for the photo-real subject objects (SubjectEmblem.objectArt): every render at the hero
// size, the 56 and 40 dp sizes framed and open, the marked and picker states, and the objects in
// place on a Today hero card, a row of Practice tiles and a list of 40 dp rows. Night and Day.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/key_button.dart';
import 'package:mockmob/features/practice/widgets/subject_tiles.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/widgets/hero_stage.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// The fifteen subjects and one language paper.
final List<String> _subjects = [...SubjectIdentity.subjects.map((s) => s.id), 'hindi'];

String _name(String id) => id == 'hindi' ? 'Hindi' : SubjectIdentity.of(id)!.name;

/// Decodes every object in the tree before the golden is taken: each emblem's own render at its
/// own size, through the bundle and pixel ratio it draws with (so the cache keys match).
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

/// Runs [build] once per theme as `goldens/<name>_<night|day>.png`. With `MM_PREVIEW_DIR` set,
/// also writes a DPR 2 render there for close review (not compared).
void _golden(String name, Widget Function() build, {required Size size}) {
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
      await _precacheObjects(tester);
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
        padding: const EdgeInsets.only(top: 18, bottom: 10),
        child: Text(text, style: context.mmType.caption.copyWith(color: context.mmColors.ink3)),
      );
}

Widget _hero() => Builder(builder: (context) {
      final t = context.mmType;
      final c = context.mmColors;
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
                        SubjectEmblem(subject: s, size: 136, framed: false),
                        const SizedBox(height: 2),
                        Text(_name(s), style: t.caption.copyWith(color: c.ink2)),
                      ],
                    ),
                  ),
              ],
            ),
          ],
        ),
      );
    });

Widget _small() => Builder(builder: (context) {
      Widget row(double size, {required bool framed}) => Wrap(
            spacing: size < 50 ? 14 : 12,
            runSpacing: 12,
            children: [for (final s in _subjects) SubjectEmblem(subject: s, size: size, framed: framed)],
          );
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _Heading('56 dp, framed'),
            row(56, framed: true),
            const _Heading('56 dp, open'),
            row(56, framed: false),
            const _Heading('40 dp, framed'),
            row(40, framed: true),
            const _Heading('40 dp, open'),
            row(40, framed: false),
            const _Heading('Marked, picker unmarked and marked, no render, 24 dp glyph'),
            const Wrap(
              spacing: 12,
              runSpacing: 12,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SubjectEmblem(subject: 'economics', size: 56, marked: true),
                SubjectEmblem(subject: 'economics', size: 56, framed: false, marked: true),
                SubjectEmblem(subject: 'history', size: 56, selectable: true),
                SubjectEmblem(subject: 'history', size: 56, selectable: true, marked: true),
                SubjectEmblem(subject: 'history', size: 56, framed: false, selectable: true),
                SubjectEmblem(subject: 'history', size: 56, framed: false, selectable: true, marked: true),
                SubjectEmblem(subject: 'fine_arts', size: 56),
                SubjectEmblem(subject: 'fine_arts', size: 40, framed: false),
                SubjectEmblem(subject: 'physics', size: 24),
                SubjectEmblem(subject: 'physics', size: 24, framed: false),
              ],
            ),
            const _Heading('136 dp, framed'),
            const Row(
              children: [
                SubjectEmblem(subject: 'accountancy', size: 136),
                SizedBox(width: 12),
                SubjectEmblem(subject: 'chemistry', size: 136, marked: true),
              ],
            ),
          ],
        ),
      );
    });

/// A Today hero card as the app builds it (HeroStage and HeroArtView), with stand-in words.
Widget _todayHero(String subject, String title) => Builder(builder: (context) {
      final t = context.mmType;
      final c = context.mmColors;
      return HeroStage(
        subjectId: subject,
        art: HeroArtView(art: HeroArt.object(subject: subject)),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.cardPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(right: heroArtClear - MmSpace.cardPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Tonight', style: t.label.copyWith(color: c.ink3)),
                    const SizedBox(height: 6),
                    Text(title, style: t.title.copyWith(color: c.ink)),
                    const SizedBox(height: 8),
                    Text('6', style: t.figureHero.copyWith(color: c.ink)),
                    Text('questions to repair', style: t.body.copyWith(color: c.ink2)),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              KeyButton(label: 'Start the repair', onPressed: () {}),
            ],
          ),
        ),
      );
    });

Widget _cards() => Builder(builder: (context) {
      final t = context.mmType;
      final c = context.mmColors;
      Widget listRow(String id, String note) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                SubjectEmblem(subject: id, size: EmblemSizes.chip, framed: false),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_name(id), style: t.body.copyWith(fontWeight: FontWeight.w600, color: c.ink)),
                      Text(note, style: t.caption.copyWith(color: c.ink3)),
                    ],
                  ),
                ),
              ],
            ),
          );
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 0, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(padding: const EdgeInsets.only(right: 16), child: _todayHero('economics', 'Economics')),
            const _Heading('Practice'),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.only(top: SubjectTiles.liftRoom),
              child: Row(
                children: [
                  for (final (id, selected, count) in const [
                    ('accountancy', true, 412),
                    ('business_studies', false, 380),
                    ('english', false, null),
                    ('mathematics', false, 290),
                  ]) ...[
                    SubjectTile(id: id, name: _name(id), selected: selected, questions: count, onTap: () {}),
                    const SizedBox(width: SubjectTiles.gap),
                  ],
                ],
              ),
            ),
            const _Heading('Review'),
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Column(
                children: [
                  listRow('political_science', 'Mock 4, 3 to repair'),
                  listRow('general_test', 'Mock 3, all clear'),
                  listRow('computer_science', 'Practice set, 2 to repair'),
                ],
              ),
            ),
          ],
        ),
      );
    });

void main() {
  setUpAll(loadAppFonts);
  setUp(() => SubjectEmblem.objectArt = true);
  tearDown(() => SubjectEmblem.objectArt = false);

  _golden('object_art_hero', _hero, size: const Size(620, 720));
  _golden('object_art_small', _small, size: const Size(620, 920));
  _golden('object_art_cards', _cards, size: const Size(400, 820));
}
