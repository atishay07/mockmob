// Today's first screen with the colleges strip (19 Oct PM, D126 polish). The two-line strip pushed the move card down
// about 90 dp and "Suggested for you" off the first screen. The strip is now ONE 48 dp line, 8 dp under the greeting and
// 12 dp over the move, so the move moves 50 dp from build 9 (not 96). These tests hold, at 360 x 640 and 360 x 780,
// Night and Day, text 1.0 and 1.3, for a fresh student (no colleges, a first move) and a heavy one (six colleges, a
// repair): the greeting and the strip are whole on the first screen, the strip is one line, the move card starts on
// it, and "Suggested for you" comes straight after the
// card. Where the card leaves room above the bar (360 x 780 at text 1.0 with a repair card), the heading and its count
// are on the first screen.
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderParagraph;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/today/copy_suggested.dart';
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/move_hero.dart' show MoveHeroCard;
import 'package:mockmob/features/today/widgets/today_header.dart';
import 'package:mockmob/features/tools/my_colleges/colleges_doors.dart';

import '../../golden/today/today_golden_support.dart' show PhoneFrame, kPhoneInsets, todayOverrides;
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

const _srcc = LadderPick(college: 'Shri Ram College of Commerce', course: 'B.Com (Hons)', closingScore: 924.3009, outOf: 1000, programmeId: 'bcom-hons');
const _hindu = LadderPick(college: 'Hindu College', course: 'B.Com (Hons)', closingScore: 919.9, outOf: 1000);
const _six = YourColleges(status: YourCollegesStatus.some, picks: [_srcc, _hindu, _hindu, _hindu, _hindu, _hindu]);
const _none = YourColleges(status: YourCollegesStatus.none);

/// The bar's top edge above the screen's bottom in [PhoneFrame] (the phone's inset, the lift and the bar).
const double _barTop = 20 + 12 + 64.0;

void main() {
  setUpAll(loadAppFonts);

  final accounts = [
    // The line each shows at 360 dp: text 1.0, then 1.3 (the strip says the most that fits on one line).
    ('fresh', TodayInputs(now: tuesdayEvening, firstName: 'Asha', attempts: const []), _none, ('Choose your colleges', 'Choose your colleges')),
    ('heavy', ashaInputs(), _six, ('Your colleges · SRCC needed 924.3', 'Your 6 colleges')),
  ];

  Future<void> pump(WidgetTester tester, TodayInputs inputs, YourColleges colleges, Size size, double scale, Brightness brightness) async {
    await pumpMockmob(
      tester,
      PhoneFrame(
        child: TodayBody(
          view: buildToday(inputs),
          skeletonDelay: Duration.zero,
          callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {}, onMinutes: (_, _) {}, onShowMe: (_) {}, onWeek: () {}),
        ),
      ),
      size: size,
      textScale: scale,
      brightness: brightness,
      disableAnimations: true,
      overrides: [...todayOverrides, yourCollegesProvider.overrideWithValue(colleges)],
    );
    await tester.pump();
    await tester.pump();
  }

  for (final (name, inputs, colleges, line) in accounts) {
    for (final size in const [Size(360, 640), Size(360, 780)]) {
      for (final scale in const [1.0, 1.3]) {
        for (final brightness in Brightness.values) {
          final label = '$name, ${size.width.round()} x ${size.height.round()}, text $scale, ${brightness == Brightness.dark ? 'Night' : 'Day'}';
          testWidgets('first screen: $label', (tester) async {
            await pump(tester, inputs, colleges, size, scale, brightness);
            expect(tester.takeException(), isNull);
            final fold = size.height - _barTop;

            // The greeting, whole, under the status bar.
            final header = tester.getRect(find.byType(TodayHeader));
            expect(header.top, greaterThanOrEqualTo(kPhoneInsets.top));
            expect(header.bottom, lessThan(fold));

            // The strip: whole on the first screen, 48 dp, one line, 8 dp under the greeting and 12 dp over the move.
            final strip = tester.getRect(find.byKey(const ValueKey('today-colleges-strip')));
            expect(strip.height, TodayCollegesStrip.height);
            expect(strip.top - header.bottom, MmGap.headerToStrip, reason: 'just under the greeting');
            expect(strip.bottom, lessThan(fold));
            final words = tester.renderObject<RenderParagraph>(
              find.descendant(of: find.descendant(of: find.byType(TodayCollegesStrip), matching: find.byType(Text)), matching: find.byType(RichText)).last,
            );
            expect(words.text.toPlainText(), scale == 1.0 ? line.$1 : line.$2);
            expect(words.didExceedMaxLines, isFalse);
            final painter = TextPainter(text: words.text, textDirection: TextDirection.ltr, textScaler: words.textScaler)..layout();
            expect(painter.width, lessThanOrEqualTo(words.size.width + 0.5), reason: 'the line is whole, never cut');
            expect(painter.computeLineMetrics().length, 1, reason: 'ONE line');
            painter.dispose();

            // The move card starts on the first screen, 12 dp under the strip: the strip costs 50 dp over build 9's
            // 18 dp gap between the greeting and the move (it cost 96 as two lines).
            final card = tester.getRect(find.byType(MoveHeroCard));
            expect(card.top - strip.bottom, MmGap.stripToMove);
            expect(card.top - header.bottom, lessThanOrEqualTo(18 + 50), reason: 'at most 50 dp lower than build 9');
            expect(card.top + 120, lessThan(fold), reason: 'the card, its overline and its title, on the first screen');

            // "Suggested for you" comes straight after the card: nothing new sits between them.
            final heading = find.text(SuggestedCopy.title, skipOffstage: false);
            expect(heading, findsOneWidget);
            final top = tester.getRect(heading).top;
            expect(top - card.bottom, lessThanOrEqualTo(28.5), reason: 'the deck follows the card, as in build 9');
            if (name == 'heavy' && size.height == 780 && scale == 1.0) {
              expect(tester.getRect(heading).bottom, lessThanOrEqualTo(fold), reason: 'Suggested for you on the first screen, above the bar');
            }
          });
        }
      }
    }
  }
}

/// The two gaps around the strip, as today_body.dart sets them.
abstract final class MmGap {
  static const double headerToStrip = 8;
  static const double stripToMove = 12;
}
