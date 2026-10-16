// Today's hero spacing and art (L02; brief app-today-1016 section 5), measured rather than judged
// by eye: the object (or Mobi) sits beside the overline, the subject and the number, never touches
// the card's top edge, is never clipped and never covers a word; and no empty band taller than one
// line of body text (24 dp) opens anywhere between the card's top padding and its last control.
// At 360 and 412 dp, and at 1.3x text, for an object hero and a Mobi hero.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart' show SubjectEmblem;
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/theme/theme.dart' show MmSpace;
import 'package:mockmob/core/mascot/mobi_character.dart' show MobiCharacter;
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/hero_stage.dart';
import 'package:mockmob/features/today/widgets/move_hero.dart';
import 'package:mockmob/features/today/widgets/number_block.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

/// One line of body text: the tallest empty band the hero may hold.
const double _band = 24;

void main() {
  setUpAll(loadAppFonts);

  final auth = authSnapshotProvider.overrideWithBuild(
    (ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma'),
  );

  Future<void> pumpHero(WidgetTester tester, {required double width, required double text, required bool mobi, Brightness brightness = Brightness.dark}) async {
    await pumpMockmob(
      tester,
      TodayBody(
        // Day one has no papers: Mobi stands in the card. Asha's record gives the object hero.
        view: buildToday(mobi ? ashaInputs(attempts: const []) : ashaInputs()),
        callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {}, onMinutes: (_) {}, onShowMe: (_) {}, onWeek: () {}),
        skeletonDelay: Duration.zero,
      ),
      size: Size(width, 1600),
      textScale: text,
      disableAnimations: true,
      overrides: [auth],
      brightness: brightness,
    );
    await tester.pump(const Duration(seconds: 2));
  }

  /// Where [e] is drawn on screen, after any scale-down (a title fitted beside the art).
  Rect rectOf(Element e) {
    final box = e.renderObject! as RenderBox;
    return MatrixUtils.transformRect(box.getTransformTo(null), Offset.zero & box.size);
  }

  Finder inCard(Finder f) => find.descendant(of: find.byType(MoveHeroCard), matching: f);

  bool inNumber(Element e) {
    var inside = false;
    e.visitAncestorElements((a) => !(inside = a.widget is NumberBlock));
    return inside;
  }

  /// Every word the card shows, outside the number.
  List<Rect> words(WidgetTester tester) => [
        for (final e in inCard(find.byType(RichText)).evaluate())
          if (!inNumber(e)) rectOf(e),
      ].where((r) => r.height > 0 && r.width > 0).toList();

  /// What the number shows: its label and the digits in view (the rolling strip keeps the unseen
  /// digits above and below, clipped by the block's own box).
  List<Rect> numberShown(WidgetTester tester) {
    final box = tester.getRect(inCard(find.byType(NumberBlock)));
    return [
      for (final e in inCard(find.byType(RichText)).evaluate())
        if (inNumber(e))
          if (rectOf(e).intersect(box) case final seen when seen.height > 0 && seen.height >= rectOf(e).height / 2) seen,
    ];
  }

  for (final (width, text) in [(360.0, 1.0), (412.0, 1.0), (360.0, 1.3), (412.0, 1.3)]) {
    for (final mobi in [false, true]) {
      final who = mobi ? 'Mobi' : 'the object';
      testWidgets('at $width dp and ${text}x text, $who stands clear and no empty band opens (L02)', (tester) async {
        await pumpHero(tester, width: width, text: text, mobi: mobi);
        final card = tester.getRect(find.byType(HeroStage).first);
        final art = tester.getRect((mobi ? inCard(find.byType(MobiCharacter)) : inCard(find.byType(SubjectEmblem))).first);

        // Nothing touches the card's top edge, and the art is never cut by the card.
        expect(art.top - card.top, greaterThanOrEqualTo(MmSpace.cardPadding - 0.5), reason: '$who keeps the 20 dp top padding');
        expect(art.right, lessThanOrEqualTo(card.right + 0.5), reason: '$who is not cut on the right');
        expect(art.left, greaterThanOrEqualTo(card.left - 0.5), reason: '$who is not cut on the left');

        // No word sits under the art.
        final texts = words(tester);
        final digits = numberShown(tester);
        expect(digits, isNotEmpty);
        final number = digits.reduce((a, b) => a.expandToInclude(b));
        for (final r in [...texts, ...digits]) {
          final overlap = r.intersect(art);
          expect(overlap.width > 0.5 && overlap.height > 0.5, isFalse, reason: 'a word at $r runs under $who at $art');
        }

        // The empty band rule: from the top padding down to the card's last control, every gap
        // between what the card shows is at most one line of body text.
        final keys = [for (final e in inCard(find.byType(KeyButton)).evaluate()) rectOf(e)];
        final blocks = [art, ...digits, ...texts, ...keys]..sort((a, b) => a.top.compareTo(b.top));
        var reach = card.top + MmSpace.cardPadding;
        var widest = 0.0;
        for (final r in blocks) {
          widest = math.max(widest, r.top - reach);
          reach = math.max(reach, r.bottom);
        }
        expect(widest, lessThanOrEqualTo(_band), reason: 'an empty band of ${widest.toStringAsFixed(1)} dp opened in the hero');

        // The number follows the subject title closely: 4 to 24 dp, never overlapping it.
        final subject = texts.where((r) => r.bottom <= number.top + 0.5).fold<double>(card.top, (m, r) => math.max(m, r.bottom));
        expect(number.top - subject, inInclusiveRange(0, _band), reason: 'the number keeps to the subject');
      });
    }
  }

  testWidgets('Day keeps the same geometry as Night (parity)', (tester) async {
    await pumpHero(tester, width: 390, text: 1, mobi: false);
    final night = tester.getRect(inCard(find.byType(SubjectEmblem)).first);
    final nightNumber = tester.getRect(inCard(find.byType(NumberBlock)));
    await pumpHero(tester, width: 390, text: 1, mobi: false, brightness: Brightness.light);
    expect(tester.getRect(inCard(find.byType(SubjectEmblem)).first), night);
    expect(tester.getRect(inCard(find.byType(NumberBlock))), nightNumber);
  });

  test('the art box keeps its declared measures', () {
    expect(heroArtTop, MmSpace.cardPadding);
    expect(heroArtClear, heroArtWidth - heroArtBleedRight + MmSpace.s12);
  });
}
