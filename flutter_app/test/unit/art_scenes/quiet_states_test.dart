// The painted rooms of the quiet states (15 Oct 2026): which room each empty, error and offline
// state shows, Mobi sitting in its lit ellipse, the room breathing for a few breaths and then
// resting (never under reduced motion or on a low glass tier), and the scene files themselves: the
// pixels they claim, enough for a 3.5x phone, and the anchors Dart uses equal to the ones
// `shared/scene-anchors.json` hands the website.
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/art/scene_art.dart';
import 'package:mockmob/core/widgets/art/scene_life.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/widgets/plan_seal_moment.dart';
import 'package:mockmob/features/onboarding/widgets/welcome_scene.dart';
import 'package:mockmob/features/review/widgets/review_state_view.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_slot.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// The pixel size a WebP file says it has (lossy, lossless or extended header).
(int, int) _webpSize(Uint8List b) {
  String tag(int o) => String.fromCharCodes(b.sublist(o, o + 4));
  expect(tag(0), 'RIFF');
  expect(tag(8), 'WEBP');
  switch (tag(12)) {
    case 'VP8X':
      return (1 + (b[24] | b[25] << 8 | b[26] << 16), 1 + (b[27] | b[28] << 8 | b[29] << 16));
    case 'VP8 ':
      return ((b[26] | b[27] << 8) & 0x3fff, (b[28] | b[29] << 8) & 0x3fff);
    case 'VP8L':
      final bits = b[21] | b[22] << 8 | b[23] << 16 | b[24] << 24;
      return (1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff));
  }
  fail('unknown WebP chunk ${tag(12)}');
}

Finder _lifeLayer() => find.descendant(
      of: find.byType(SceneLife),
      matching: find.byWidgetPredicate((w) => w is CustomPaint && w.foregroundPainter != null),
    );

Future<void> _pump(WidgetTester tester, Widget view, Brightness b, {bool still = true}) async {
  await pumpMockmob(tester, view, size: kPhone, brightness: b, disableAnimations: still);
  await tester.pump(const Duration(milliseconds: 100));
}

void main() {
  setUpAll(loadAppFonts);

  group('which room', () {
    for (final (b, night) in [(Brightness.dark, true), (Brightness.light, false)]) {
      for (final scene in [StateScene.allClear, StateScene.nothingYet, StateScene.saved, StateScene.noResults]) {
        testWidgets('an empty state shows the ${scene.name} room it names (${b.name})', (tester) async {
          await _pump(tester, StateView(kind: StateViewKind.empty, scene: scene, title: 'A title'), b);
          expect(tester.widget<SceneImage>(find.byType(SceneImage)).art, SceneVignette.artFor(scene, night: night));
          expect(find.descendant(of: find.byType(SceneVignette), matching: find.byType(Mobi)), findsOneWidget);
        });
      }

      testWidgets('an error sits Mobi in the room with the loose cable (${b.name})', (tester) async {
        MobiRation.reset();
        addTearDown(MobiRation.reset);
        await _pump(tester, const StateView(kind: StateViewKind.error, title: 'We could not reach MockMob'), b);
        expect(tester.widget<SceneImage>(find.byType(SceneImage)).art, night ? SceneArt.unreachableNight : SceneArt.unreachableDay);
        expect(find.descendant(of: find.byType(SceneVignette), matching: find.byType(Mobi)), findsOneWidget);
      });
    }

    testWidgets('an empty state with no room of its own keeps Mobi in the lamp pool', (tester) async {
      await _pump(tester, const StateView(kind: StateViewKind.empty, title: 'No papers yet'), Brightness.dark);
      expect(find.byType(SceneVignette), findsNothing);
      expect(find.byType(Mobi), findsOneWidget);
    });

    testWidgets('an empty state cannot borrow the offline or error rooms', (tester) async {
      await _pump(tester, const StateView(kind: StateViewKind.empty, scene: StateScene.unreachable, title: 'No papers yet'), Brightness.dark);
      expect(find.byType(SceneVignette), findsNothing);
    });

    testWidgets('an error that brings its own picture keeps it and shows no room', (tester) async {
      await _pump(
        tester,
        const StateView(kind: StateViewKind.error, title: 'We could not reach MockMob', art: SizedBox(key: Key('own-art'), width: 40, height: 40)),
        Brightness.dark,
      );
      expect(find.byKey(const Key('own-art')), findsOneWidget);
      expect(find.byType(SceneVignette), findsNothing);
    });

    testWidgets("Review's empty state is the bare desk, its error the loose cable, its offline the unplugged room", (tester) async {
      for (final (kind, art) in [
        (StateViewKind.empty, SceneArt.nothingYetNight),
        (StateViewKind.error, SceneArt.unreachableNight),
        (StateViewKind.offline, SceneArt.offlineNight),
      ]) {
        await _pump(tester, ReviewStateView(kind: kind, title: 'A title'), Brightness.dark);
        expect(tester.widget<SceneImage>(find.byType(SceneImage)).art, art, reason: kind.name);
      }
    });

    testWidgets("Review's empty state can still say all clear", (tester) async {
      await _pump(tester, const ReviewStateView(kind: StateViewKind.empty, scene: StateScene.allClear, title: 'Nothing to repair'), Brightness.dark);
      expect(tester.widget<SceneImage>(find.byType(SceneImage)).art, SceneArt.allClearNight);
    });
  });

  group('the room is alive, then rests', () {
    const view = StateView(kind: StateViewKind.empty, scene: StateScene.nothingYet, title: 'Nothing here yet');

    testWidgets('Night breathes for three breaths (24 s), then stands still', (tester) async {
      await _pump(tester, view, Brightness.dark, still: false);
      expect(_lifeLayer(), findsOneWidget);
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(seconds: 1));
      }
      expect(_lifeLayer(), findsOneWidget, reason: 'still breathing at 20 s');
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(seconds: 1));
      }
      expect(_lifeLayer(), findsNothing, reason: 'resting after 24 s');
    });

    testWidgets('Day breathes too, on the sunlit pool only', (tester) async {
      await _pump(tester, view, Brightness.light, still: false);
      expect(_lifeLayer(), findsOneWidget);
      await tester.pump(const Duration(seconds: 26));
      expect(_lifeLayer(), findsNothing);
    });

    testWidgets('reduced motion is still from the first frame', (tester) async {
      await _pump(tester, view, Brightness.dark);
      expect(_lifeLayer(), findsNothing);
      expect(find.byType(SceneImage), findsOneWidget);
    });

    testWidgets('the Lite glass tier draws the painting alone', (tester) async {
      await _pump(tester, const GlassScope(quality: GlassQuality.lite, child: view), Brightness.dark, still: false);
      expect(_lifeLayer(), findsNothing);
      expect(find.byType(SceneImage), findsOneWidget);
    });

    testWidgets('an opted-out vignette (life: false) never moves', (tester) async {
      await _pump(
        tester,
        const SceneVignette(scene: StateScene.saved, life: false),
        Brightness.dark,
        still: false,
      );
      expect(find.byType(SceneLife), findsNothing);
    });
  });

  group('the files', () {
    final shared = File('../shared/scene-anchors.json');
    final anchors = jsonDecode(shared.readAsStringSync()) as Map<String, dynamic>;

    test('every scene file is the pixel size the enum says', () {
      for (final art in SceneArt.values) {
        final file = File(art.asset);
        expect(file.existsSync(), isTrue, reason: art.asset);
        expect(_webpSize(file.readAsBytesSync()), (art.pxWidth, art.pxHeight), reason: art.asset);
      }
    });

    test('a scene has at least the pixels it draws at on a 3.5x phone', () {
      // The widest each is drawn: an empty state 248 dp tall (372 dp wide), the milestone band the
      // slot plus both gutters of the widest phone, a room the width of the phone. The two rooms are
      // cropped to their painted part and re-encoded at 1296 px wide: the generator's own
      // detail is about 1100 px across, so 3x of a 412 dp phone is what they can honestly give.
      for (final art in SceneArt.values) {
        final (draw, dpr) = switch (art) {
          SceneArt.welcomeHero || SceneArt.planSeal => (412.0, 3.0),
          SceneArt.milestoneNight || SceneArt.milestoneDay => (430.0, 3.5),
          _ => (248 / art.aspect, 3.5),
        };
        expect(art.pxWidth, greaterThanOrEqualTo((draw * dpr).floor()), reason: '${art.file} draws at ${draw.toStringAsFixed(0)} dp');
      }
    });

    test('the anchors Dart uses are the ones the website reads', () {
      final v = anchors['vignette'] as Map<String, dynamic>;
      expect(SceneAnchor.mobiShare, v['mobiShare']);
      final scenes = v['scenes'] as Map<String, dynamic>;
      for (final scene in StateScene.values) {
        final entry = scenes[scene.name] as Map<String, dynamic>;
        for (final night in [true, false]) {
          final j = entry[night ? 'night' : 'day'] as Map<String, dynamic>;
          final a = SceneAnchor.of(scene, night: night);
          expect(a.x, closeTo(j['footX'] as num, 1e-9), reason: '${scene.name} ${night ? 'night' : 'day'} footX');
          expect(a.y, closeTo(j['footY'] as num, 1e-9), reason: '${scene.name} ${night ? 'night' : 'day'} footY');
        }
        final life = entry['life'] as Map<String, dynamic>;
        final spec = SceneLifeSpec.of(scene, night: true);
        expect(spec.lampX, closeTo(life['lampX'] as num, 1e-9), reason: scene.name);
        expect(spec.lampY, closeTo(life['lampY'] as num, 1e-9), reason: scene.name);
        expect(spec.coneFootY, closeTo(life['coneFootY'] as num, 1e-9), reason: scene.name);
        expect(spec.ellipseX, closeTo(life['ellipseX'] as num, 1e-9), reason: scene.name);
        expect(spec.ellipseY, closeTo(life['ellipseY'] as num, 1e-9), reason: scene.name);
        expect(spec.ellipseW, closeTo(life['ellipseW'] as num, 1e-9), reason: scene.name);
        final stars = (life['stars'] as List).cast<List<dynamic>>();
        expect(spec.stars.length, stars.length);
        for (var i = 0; i < stars.length; i++) {
          expect(spec.stars[i].dx, closeTo(stars[i][0] as num, 1e-9));
          expect(spec.stars[i].dy, closeTo(stars[i][1] as num, 1e-9));
        }
      }
      expect((v['file'] as Map)['width'], 1536);
      expect((v['file'] as Map)['height'], 1024);
    });

    test('the two portrait rooms carry the numbers the website reads', () {
      final w = anchors['welcome'] as Map<String, dynamic>;
      expect(WelcomeHeroLayout.footX, w['footX']);
      expect(WelcomeHeroLayout.footY, w['footY']);
      expect(WelcomeHeroLayout.ellipseX, (w['ellipse'] as Map)['cx']);
      expect(WelcomeHeroLayout.ellipseY, (w['ellipse'] as Map)['cy']);
      expect(WelcomeHeroLayout.ellipseW, (w['ellipse'] as Map)['w']);
      expect(WelcomeHeroLayout.ellipseH, (w['ellipse'] as Map)['h']);
      expect(WelcomeHeroLayout.sheetLeft, w['sheetLeft']);
      expect(WelcomeHeroLayout.mobiWidthShare, closeTo(w['mobiWidthShare'] as num, 1e-4));
      expect(WelcomeHero.lampX, (w['lamp'] as Map)['x']);
      expect(WelcomeHero.lampY, (w['lamp'] as Map)['y']);
      expect(WelcomeHero.coneFootY, w['coneFootY']);
      expect(SceneArt.welcomeHero.pxWidth, (w['file'] as Map)['width']);
      expect(SceneArt.welcomeHero.pxHeight, (w['file'] as Map)['height']);
      final p = anchors['planSeal'] as Map<String, dynamic>;
      expect(SealGeometry.impressionX, p['impressionX']);
      expect(SealGeometry.impressionY, p['impressionY']);
      expect(SealGeometry.discShare, p['discShare']);
      expect(SealGeometry.teethShare, p['teethShare']);
      expect(SceneArt.planSeal.pxWidth, (p['file'] as Map)['width']);
      expect(SceneArt.planSeal.pxHeight, (p['file'] as Map)['height']);
    });

    test('the milestone band numbers are the ones the website reads', () {
      final m = anchors['milestone'] as Map<String, dynamic>;
      expect(MilestoneArtBand.mobiX, m['mobiX']);
      expect(MilestoneArtBand.mobiFootY, m['mobiFootY']);
      expect(MilestoneArtBand.mobiSize, m['mobiHeightDp']);
      expect(MilestoneArtBand.bleed, m['bleedDp']);
      expect(SceneArt.milestoneNight.aspect, closeTo((m['file']['height'] as num) / (m['file']['width'] as num), 1e-9));
    });
  });
}
