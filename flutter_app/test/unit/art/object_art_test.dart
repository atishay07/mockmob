import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';
import 'package:mockmob/core/art/emblem_painter.dart';
import 'package:mockmob/core/theme/theme.dart';

import '../../helpers/golden_harness.dart' show FileAssetBundle;

/// Every subject id the app meets, as `SubjectIdentity.of` spells its aliases, with the render
/// file it must wear.
const Map<String, String> _ids = {
  'accountancy': 'accountancy',
  'accounts': 'accountancy',
  'accounting': 'accountancy',
  'business_studies': 'business',
  'business': 'business',
  'bst': 'business',
  'Business Studies': 'business',
  'economics': 'economics',
  'eco': 'economics',
  'english': 'english',
  'general_test': 'generaltest',
  'gat': 'generaltest',
  'gt': 'generaltest',
  'general_aptitude_test': 'generaltest',
  'general-test': 'generaltest',
  'mathematics': 'mathematics',
  'applied_mathematics': 'mathematics',
  'maths': 'mathematics',
  'math': 'mathematics',
  'mathematics_applied_mathematics': 'mathematics',
  'physics': 'physics',
  'chemistry': 'chemistry',
  'biology': 'biology',
  'biological_studies': 'biology',
  'history': 'history',
  'political_science': 'politicalscience',
  'pol_sci': 'politicalscience',
  'polity': 'politicalscience',
  'geography': 'geography',
  'geography_geology': 'geography',
  'psychology': 'psychology',
  'sociology': 'sociology',
  'computer_science': 'computerscience',
  'informatics_practices': 'computerscience',
  'computer_science_informatics_practices': 'computerscience',
  'cs': 'computerscience',
  ' PHYSICS ': 'physics',
};

/// A bundle whose object renders are missing, as on a broken install: the manifest loads, every
/// other file fails.
class _EmptyBundle extends CachingAssetBundle {
  @override
  Future<ByteData> load(String key) async {
    if (key == 'AssetManifest.bin') return const StandardMessageCodec().encodeMessage(<String, Object>{})!;
    throw FlutterError('Unable to load asset: $key');
  }
}

final Map<Brightness, ThemeData> _themes = {};

// One bundle for the whole file: an image's cache key names its bundle, so a precache and the
// emblem that draws it must load through the same one.
final AssetBundle _files = FileAssetBundle();

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  Brightness brightness = Brightness.dark,
  bool disableAnimations = false,
  AssetBundle? bundle,
}) {
  return tester.pumpWidget(
    DefaultAssetBundle(
      bundle: bundle ?? _files,
      child: MaterialApp(
        theme: _themes.putIfAbsent(brightness, () => buildTheme(brightness)),
        home: MediaQuery(
          data: MediaQueryData(disableAnimations: disableAnimations, devicePixelRatio: 2),
          child: Scaffold(body: Center(child: child)),
        ),
      ),
    ),
  );
}

Finder get _vector => find.byWidgetPredicate((w) => w is CustomPaint && w.painter is EmblemPainter);

void main() {
  setUp(() => SubjectEmblem.objectArt = true);
  tearDown(() => SubjectEmblem.objectArt = false);

  group('subject to render', () {
    test('every subject id the app meets wears its own render', () {
      for (final MapEntry(key: id, value: file) in _ids.entries) {
        expect(SubjectRender.of(id)?.name, file, reason: id);
      }
    });

    test('the fifteen subjects each have a render of their own', () {
      final names = {for (final s in SubjectIdentity.subjects) SubjectRender.of(s.id)!.name};
      expect(names, hasLength(15));
      expect(names, isNot(contains('language')));
    });

    test('every CUET language paper except English shares the notebook', () {
      for (final id in languagePaperIds) {
        expect(SubjectRender.of(id), same(SubjectRender.language), reason: id);
      }
      expect(SubjectRender.of('english'), same(SubjectRender.english));
    });

    test('every kind but other has a render, and other has none', () {
      for (final kind in EmblemKind.values) {
        expect(SubjectRender.forKind(kind) == null, kind == EmblemKind.other, reason: kind.name);
      }
      expect(SubjectRender.of('fine_arts'), isNull);
      expect(SubjectRender.of(null), isNull);
      expect(SubjectRender.of('  '), isNull);
    });

    test('the sixteen files on disk are exactly the renders, at the sizes declared', () async {
      final onDisk = Directory('assets/art')
          .listSync()
          .map((e) => e.uri.pathSegments.last)
          .where((f) => f.startsWith('obj-') && f.endsWith('.webp'))
          .toSet();
      expect(onDisk, {for (final r in SubjectRender.all) 'obj-${r.name}.webp'});
      for (final r in SubjectRender.all) {
        final codec = await ui.instantiateImageCodec(File(r.asset).readAsBytesSync());
        final frame = await codec.getNextFrame();
        expect((frame.image.width, frame.image.height), (r.width, r.height), reason: r.name);
        frame.image.dispose();
        codec.dispose();
      }
    });

    test('the object always sits wholly inside its box, centred across it', () {
      for (final r in SubjectRender.all) {
        for (final side in const [40.0, 56.0, 84.0, 96.0, 136.0, 160.0]) {
          for (final framed in const [true, false]) {
            final rect = r.rectIn(side, framed: framed);
            expect(Offset.zero & Size.square(side), _contains(rect), reason: '${r.name} $side $framed');
            expect(rect.center.dx, closeTo(side / 2, 0.01));
            expect(rect.width / rect.height, closeTo(r.aspect, 0.001));
            // Room above for the float, and the foot above the box's floor for the shadow.
            expect(rect.top, greaterThanOrEqualTo(side * 0.03));
            expect(rect.top + rect.height * r.ground, lessThan(side * 0.94));
          }
        }
      }
    });

    test('decodes at the drawn size, never more than the file holds', () {
      final r = SubjectRender.accountancy;
      expect(r.cacheWidth(56, 2, framed: false), (r.rectIn(56, framed: false).width * 2).round());
      expect(r.cacheWidth(136, 3, framed: false), (r.rectIn(136, framed: false).width * 3).round());
      expect(r.cacheWidth(160, 8, framed: false), r.width);
    });
  });

  group('SubjectEmblem with object art', () {
    testWidgets('40 dp and up draw the render; 24 dp keeps the drawn glyph', (tester) async {
      for (final size in const [40.0, 56.0, 96.0, 136.0]) {
        await _pump(tester, SubjectEmblem(subject: 'business_studies', size: size));
        final image = tester.widget<Image>(find.byType(Image));
        final provider = image.image as ResizeImage;
        expect((provider.imageProvider as AssetImage).assetName, 'assets/art/obj-business.webp');
        expect(provider.width, SubjectRender.business.cacheWidth(size, 2, framed: true), reason: '$size');
        expect(image.filterQuality, FilterQuality.medium);
        expect(_vector, findsNothing);
      }
      for (final size in const [24.0, 32.0, 39.9]) {
        await _pump(tester, SubjectEmblem(subject: 'business_studies', size: size));
        expect(find.byType(Image), findsNothing, reason: '$size');
        expect(_vector, findsOneWidget);
      }
    });

    testWidgets('with the flag off every size keeps the drawn emblem', (tester) async {
      SubjectEmblem.objectArt = false;
      await _pump(tester, const SubjectEmblem(subject: 'economics', size: 136));
      expect(find.byType(Image), findsNothing);
      expect(_vector, findsOneWidget);
    });

    testWidgets('a subject without a render keeps its initials card', (tester) async {
      await _pump(tester, const SubjectEmblem(subject: 'fine_arts', size: 56));
      expect(find.byType(Image), findsNothing);
      expect(_vector, findsOneWidget);
      expect(find.text('FA'), findsOneWidget);
    });

    testWidgets('a file that will not load falls back to the drawn object', (tester) async {
      await _pump(tester, const SubjectEmblem(subject: 'physics', size: 56), bundle: _EmptyBundle());
      expect(find.byType(Image), findsOneWidget);
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
      await tester.pump();
      await tester.pump();
      expect(find.byType(Image), findsNothing);
      expect(_vector, findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a precached render is on the first frame', (tester) async {
      late BuildContext context;
      await _pump(tester, Builder(builder: (c) {
        context = c;
        return const SizedBox();
      }));
      await tester.runAsync(() => SubjectRender.precache(context, 'gat', 136, framed: false));
      await _pump(tester, const SubjectEmblem(subject: 'gat', size: 136, framed: false));
      expect(tester.widget<RawImage>(find.byType(RawImage)).image, isNotNull);
    });

    testWidgets('takes exactly its size, framed or open', (tester) async {
      for (final framed in const [true, false]) {
        await _pump(tester, SubjectEmblem(subject: 'english', size: 56, framed: framed));
        expect(tester.getSize(find.byType(SubjectEmblem)), const Size.square(56));
      }
    });

    testWidgets('the picker states: dim and small unmarked, lifted marked, reported to assistive tech', (tester) async {
      final handle = tester.ensureSemantics();
      Opacity opacity() => tester.widget<Opacity>(find.descendant(of: find.byType(SubjectEmblem), matching: find.byType(Opacity)));
      await _pump(tester, const SubjectEmblem(subject: 'history', size: 56, semanticLabel: 'History', selectable: true));
      expect(opacity().opacity, closeTo(0.6, 0.001));
      expect(tester.getSemantics(find.bySemanticsLabel('History')), matchesSemantics(label: 'History', isImage: true, hasSelectedState: true));
      await _pump(tester, const SubjectEmblem(subject: 'history', size: 56, semanticLabel: 'History', selectable: true, marked: true));
      await tester.pumpAndSettle();
      expect(opacity().opacity, closeTo(1, 0.001));
      expect(tester.getSemantics(find.bySemanticsLabel('History')), matchesSemantics(label: 'History', isImage: true, hasSelectedState: true, isSelected: true));
      handle.dispose();
    });

    testWidgets('an emblem that is not a choice never dims', (tester) async {
      await _pump(tester, const SubjectEmblem(subject: 'history', size: 56, marked: true));
      expect(find.descendant(of: find.byType(SubjectEmblem), matching: find.byType(Opacity)), findsNothing);
    });

    testWidgets('marking paints the volt mark (ring and tick framed, a bubble open)', (tester) async {
      for (final framed in const [true, false]) {
        final off = await _render(tester, SubjectEmblem(subject: 'sociology', size: 56, framed: framed));
        final on = await _render(tester, SubjectEmblem(subject: 'sociology', size: 56, framed: framed, marked: true));
        expect(_voltPixels(on) - _voltPixels(off), greaterThan(framed ? 300 : 60), reason: 'framed $framed');
      }
    });

    testWidgets('the idle float moves the picture only, and stops under reduced motion', (tester) async {
      SubjectEmblem.idleEnabled = true;
      addTearDown(() => SubjectEmblem.idleEnabled = false);
      Transform drift() => tester.widget<Transform>(find.ancestor(of: find.byType(Image), matching: find.byType(Transform)).first);
      await _pump(tester, const SubjectEmblem(subject: 'physics', size: 136, framed: false, animate: true));
      final providerBefore = tester.widget<Image>(find.byType(Image)).image;
      final heights = <double>{};
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 600));
        heights.add(drift().transform.getTranslation().y.roundToDouble());
      }
      expect(heights.length, greaterThan(2));
      expect(heights.every((y) => y <= 0 && y >= -136 * 0.031), isTrue);
      // The same decoded picture every frame.
      expect(tester.widget<Image>(find.byType(Image)).image, same(providerBefore));

      await _pump(tester, const SubjectEmblem(subject: 'physics', size: 136, framed: false, animate: true), disableAnimations: true);
      await tester.pump(const Duration(seconds: 2));
      expect(drift().transform.getTranslation().y, 0);
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('tests keep the float off, so pumpAndSettle settles with object art on', (tester) async {
      await _pump(tester, const SubjectEmblem(subject: 'physics', size: 136, animate: true));
      await tester.pumpAndSettle();
      expect(tester.hasRunningAnimations, isFalse);
    });
  });
}

Matcher _contains(Rect inner) => predicate<Rect>(
      (outer) => outer.left <= inner.left + 1e-9 && outer.top <= inner.top + 1e-9 && outer.right >= inner.right - 1e-9 && outer.bottom >= inner.bottom - 1e-9,
      'contains $inner',
    );

/// Paints [emblem] alone (no image decode needed: the mark is paint) and returns RGBA pixels.
Future<Uint8List> _render(WidgetTester tester, Widget emblem) async {
  final key = GlobalKey();
  await _pump(tester, RepaintBoundary(key: key, child: emblem), disableAnimations: true);
  await tester.pumpAndSettle();
  final bytes = await tester.runAsync(() async {
    final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final image = await boundary.toImage(pixelRatio: 2);
    final data = await image.toByteData();
    image.dispose();
    return data!.buffer.asUint8List();
  });
  return bytes!;
}

/// How many pixels are close to volt (D2F000).
int _voltPixels(Uint8List rgba) {
  var n = 0;
  for (var i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] > 200 && (rgba[i] - 0xD2).abs() < 30 && (rgba[i + 1] - 0xF0).abs() < 30 && rgba[i + 2] < 60) n++;
  }
  return n;
}
