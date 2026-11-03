// LK60 (owner, 3 Nov 2026): "Don't use these vague icons ... Make them into a proper branded icon, a generated image".
// The web's desk objects (930b6bcbd) in the app: the files, the 32 dp floor with its line fallback, the fixed box, and the
// rows that lead with them (the chapter shelf, Learn home's Or rows, Practice's More ways in and the Explore door's
// Untimed questions). LK42 (owner, 2 Nov): You's plan strip as one calm capsule, the balance in words, no wallet glyph
// and no filled volt Pro pill.
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/account/account_avatar.dart';
import 'package:mockmob/core/widgets/brand/brand_icon.dart';
import 'package:mockmob/features/insights/widgets/entry_points.dart';
import 'package:mockmob/features/learn2/chapter/chapter_model.dart';
import 'package:mockmob/features/learn2/chapter/chapter_shelf.dart';
import 'package:mockmob/features/learn2/home/roadmap_offer.dart';
import 'package:mockmob/features/you/copy.dart';
import 'package:mockmob/features/you/hub/plan_strip.dart';

import '../../golden/you/you_golden_kit.dart' show setUpGoldenFonts;
import '../../helpers/golden_harness.dart';
import '../billing/billing_test_support.dart';
import '../you/you_test_support.dart';

/// Width and height of a lossy, lossless or extended webp, from its header.
(int, int) _webpSize(Uint8List b) {
  final chunk = String.fromCharCodes(b.sublist(12, 16));
  int le24(int at) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);
  switch (chunk) {
    case 'VP8X':
      return (le24(24) + 1, le24(27) + 1);
    case 'VP8L':
      final bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return ((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1);
    default:
      return ((b[26] | (b[27] << 8)) & 0x3FFF, (b[28] | (b[29] << 8)) & 0x3FFF);
  }
}

void main() {
  setUpGoldenFonts();
  tearDown(disposeContainers);

  group('the files', () {
    test('every desk object ships as a 192 px square webp under assets/art/icons, declared in pubspec', () {
      expect(File('pubspec.yaml').readAsStringSync(), contains('- assets/art/icons/'));
      var total = 0;
      for (final name in BrandIconName.values) {
        final file = File(name.asset);
        expect(file.existsSync(), isTrue, reason: name.asset);
        final bytes = file.readAsBytesSync();
        expect(String.fromCharCodes(bytes.sublist(0, 4)), 'RIFF', reason: name.asset);
        expect(String.fromCharCodes(bytes.sublist(8, 12)), 'WEBP', reason: name.asset);
        expect(_webpSize(bytes), (BrandIcon.filePixels, BrandIcon.filePixels), reason: name.asset);
        expect(bytes.length, lessThan(16 * 1024), reason: '${name.asset} is ${bytes.length} bytes');
        total += bytes.length;
      }
      expect(total, lessThan(120 * 1024));
    });

    test('the decode width is the drawn size in device pixels, never more than the file holds', () {
      expect(BrandIcon.cacheWidth(40, 3), 120);
      expect(BrandIcon.cacheWidth(44, 3), 132);
      expect(BrandIcon.cacheWidth(80, 3), BrandIcon.filePixels);
    });
  });

  group('BrandIcon', () {
    testWidgets('from 32 dp it draws the object in a fixed square, decorative by default', (tester) async {
      final semantics = tester.ensureSemantics();
      await pumpMockmob(tester, const Center(child: BrandIcon(BrandIconName.keycards, size: 40)), size: const Size(200, 200));
      final image = tester.widget<Image>(find.byType(Image));
      expect((image.image as ResizeImage).imageProvider, isA<AssetImage>().having((a) => a.assetName, 'asset', BrandIconName.keycards.asset));
      expect(tester.getSize(find.byType(BrandIcon)), const Size(40, 40));
      expect(find.byType(Icon), findsNothing);
      expect(find.descendant(of: find.byType(BrandIcon), matching: find.byType(ExcludeSemantics)), findsOneWidget);
      expect(find.descendant(of: find.byType(BrandIcon), matching: find.byWidgetPredicate((w) => w is Semantics && w.properties.label != null)), findsNothing);
      semantics.dispose();
    });

    testWidgets('below 32 dp it draws the line icon of the same meaning in the same square', (tester) async {
      await pumpMockmob(tester, const Center(child: BrandIcon(BrandIconName.print, size: 24)), size: const Size(200, 200));
      expect(find.byType(Image), findsNothing);
      expect(find.byIcon(LucideIcons.printer), findsOneWidget);
      expect(tester.getSize(find.byType(BrandIcon)), const Size(24, 24));
    });

    testWidgets('standing alone it says its label once, as an image', (tester) async {
      final semantics = tester.ensureSemantics();
      await pumpMockmob(tester, const Center(child: BrandIcon(BrandIconName.compass, size: 48, label: 'Admission Compass')), size: const Size(200, 200));
      expect(find.bySemanticsLabel('Admission Compass'), findsOneWidget);
      semantics.dispose();
    });
  });

  group('the rows that lead with them', () {
    test('the chapter shelf: one object per kind, the print sheet its clipped page', () {
      expect(ShelfRow.iconFor('cards'), BrandIconName.keycards);
      expect(ShelfRow.iconFor('questions'), BrandIconName.questions);
      expect(ShelfRow.iconFor('mistakes'), BrandIconName.mistakes);
      expect(ShelfRow.iconFor('lesson'), BrandIconName.lesson);
      expect(ShelfRow.iconFor('print'), BrandIconName.print);
      expect(ShelfRow.iconSize, greaterThanOrEqualTo(BrandIcon.minObject));
    });

    test("Learn home's Or rows: the web's map, and words alone for a kind it does not know", () {
      expect(RoadmapOffer.orIcon('revise'), BrandIconName.revise);
      expect(RoadmapOffer.orIcon('fix'), BrandIconName.mistakes);
      expect(RoadmapOffer.orIcon('feed'), BrandIconName.feeds);
      expect(RoadmapOffer.orIcon('singles'), BrandIconName.questions);
      expect(RoadmapOffer.orIcon('level'), BrandIconName.questions);
      expect(RoadmapOffer.orIcon('continue'), BrandIconName.keycards);
      expect(RoadmapOffer.orIcon('something-new'), isNull);
      expect(RoadmapOffer.orIcon(null), isNull);
    });

    testWidgets('a shelf row draws its object at 40 dp, a still row dimmed, and keeps its chevron', (tester) async {
      await pumpMockmob(
        tester,
        ChapterShelf(
          rows: const [
            ShelfRowModel(id: 'cards', title: 'Key cards', line: '24 cards'),
            ShelfRowModel(id: 'print', title: 'Print sheet', line: '12 Must-know lines, with your name', link: false, action: 'print'),
            ShelfRowModel(id: 'questions', title: 'Questions only', line: '40 questions, back tomorrow', link: false),
          ],
          onOpen: (_) {},
        ),
        size: const Size(360, 400),
      );
      final icons = tester.widgetList<BrandIcon>(find.byType(BrandIcon)).toList();
      expect(icons.map((i) => i.name), [BrandIconName.keycards, BrandIconName.print, BrandIconName.questions]);
      expect(icons.every((i) => i.size == 40), isTrue);
      expect(icons.map((i) => i.dim), [false, false, true]);
      expect(find.byIcon(LucideIcons.printer), findsNothing);
      expect(find.byIcon(LucideIcons.chevronRight), findsNWidgets(2));
      expect(tester.takeException(), isNull);
    });

    testWidgets('an entry row with a desk object leads with it instead of the line icon; Untimed questions has the answer sheet', (tester) async {
      await pumpMockmob(
        tester,
        Column(
          children: [
            const StreamEntry(subject: 'accountancy'),
            EntryRow(icon: LucideIcons.bookmark, title: 'Saved questions', onTap: () {}),
          ],
        ),
        size: const Size(360, 300),
      );
      expect(tester.widget<BrandIcon>(find.byType(BrandIcon)).name, BrandIconName.questions);
      expect(find.byIcon(LucideIcons.layers), findsNothing);
      expect(find.byIcon(LucideIcons.bookmark), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group("LK42: You's plan strip as one calm capsule", () {
    Future<void> pump(WidgetTester tester, {bool pro = false, double textScale = 1}) async {
      final List<Override> overrides = [...youOverrides(credits: oneBalanceState(pro: pro)), ...BillingRig().overrides];
      await pumpMockmob(
        tester,
        const Padding(padding: EdgeInsets.all(16), child: Align(alignment: Alignment.topCenter, child: YouPlanStrip())),
        size: const Size(360, 240),
        textScale: textScale,
        overrides: overrides,
      );
      await tester.pumpAndSettle();
    }

    for (final pro in [false, true]) {
      for (final scale in [1.0, 1.3]) {
        testWidgets('${pro ? 'Pro' : 'Free'} at text $scale: the balance in words, no wallet glyph, two full-height doors', (tester) async {
          await pump(tester, pro: pro, textScale: scale);
          expect(tester.takeException(), isNull);
          expect(find.text(YouCopy.stripBalance(108)), findsOneWidget);
          expect(find.byIcon(LucideIcons.wallet), findsNothing);
          expect(find.byIcon(LucideIcons.chevronRight), findsNothing);
          for (final key in const ['you-strip-credits', 'you-strip-plan']) {
            final door = tester.getSize(find.byKey(ValueKey(key)));
            expect(door.height, greaterThanOrEqualTo(YouPlanStrip.minHeight), reason: key);
          }
        });
      }
    }

    testWidgets('Pro is a small accent word on a faint wash, never a filled volt pill', (tester) async {
      await pump(tester, pro: true);
      final colors = MmColors.light;
      final word = tester.widget<Text>(find.text(YouCopy.stripPro));
      expect(word.style?.color, colors.accentText);
      final filled = tester.widgetList<DecoratedBox>(find.ancestor(of: find.text(YouCopy.stripPro), matching: find.byType(DecoratedBox))).where((d) {
        final deco = d.decoration;
        return deco is BoxDecoration && deco.color == colors.volt;
      });
      expect(filled, isEmpty);
    });

    testWidgets('the balance door says its number and unit and where it goes', (tester) async {
      final semantics = tester.ensureSemantics();
      await pump(tester);
      expect(find.bySemanticsLabel(YouCopy.stripCreditsLabel(YouCopy.stripBalance(108))), findsOneWidget);
      semantics.dispose();
    });
  });

  test('the account key says Pro in words on Pro, not only with the volt ring', () {
    expect(AccountAvatarButton.proSemanticsLabel, 'Account and settings, Pro');
  });
}
