// Small copy fixes, 20 Oct. (1) The fresh account's move card said "Find your starting point" over two lines and a
// three-line body that repeated the number and the subject above it, so "Suggested for you" fell off the first screen:
// the title is "Your starting point" (one line on a 412 dp phone), the body is two lines, and the heading comes up above
// the bar at 412 x 915 and 360 x 800. (2) A programme DU prints as "B.Com." was read as "B.Com.." by a screen reader and
// shown as "B.Com., 2026 Round 1.": the label builders never double a full stop.
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderParagraph;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/copy/sentences.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/copy_glance.dart';
import 'package:mockmob/features/today/copy_suggested.dart';
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/colleges_sheet.dart' show TodayCollegesCopy;
import 'package:mockmob/features/today/widgets/move_hero.dart' show MoveHeroCard;
import 'package:mockmob/features/tools/my_colleges/colleges_doors.dart';

import '../../golden/today/today_golden_support.dart' show PhoneFrame, todayOverrides;
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

const _barTop = 20 + 12 + 64.0;

void main() {
  setUpAll(loadAppFonts);

  group('the full stop is never doubled', () {
    test('withoutStop takes one closing stop and leaves the rest', () {
      expect(withoutStop('B.Com.'), 'B.Com');
      expect(withoutStop('B.Com (Hons)'), 'B.Com (Hons)');
      expect(withoutStop('B.A. (Hons.)'), 'B.A. (Hons.)');
      expect(withoutStop('Wait...'), 'Wait...');
      expect(withoutStop(' B.Sc. '), 'B.Sc');
    });

    test('the college row is read with one stop', () {
      const p = LadderPick(college: 'Shri Ram College of Commerce', course: 'B.Com.', closingScore: 880, outOf: 1000);
      final said = CollegesDoorCopy.rowSemantics(p);
      expect(said, 'Shri Ram College of Commerce, B.Com. Closed at 880 of 1000.');
      expect(said, isNot(contains('..')));
      const none = LadderPick(college: 'Hindu College', course: 'B.Com.');
      expect(CollegesDoorCopy.rowSemantics(none), 'Hindu College, B.Com. No 2026 figure is published for your category.');
    });

    test("Today's colleges sheet row is read with one stop", () {
      final said = TodayCollegesCopy.rowSemantics(1, 'Hindu College', 'B.Com.', 'Closed at 880 of 1000', 'Needs 12 more');
      expect(said, '1. Hindu College. B.Com. Closed at 880 of 1000. Needs 12 more.');
      expect(said, isNot(contains('..')));
    });

    test('the lines under a college name read cleanly', () {
      expect(TodayCopy.collegeRowSub('B.Com.', figure: true), 'B.Com, 2026 Round 1.');
      expect(TodayCopy.collegeRowSub('B.Com.', figure: false), 'B.Com. There is no 2026 Round 1 cutoff for your category.');
      expect(TodayCopy.collegesSub('B.Com.', 2), 'B.Com, 2026 Round 1. 2 more saved.');
      expect(TodayCopy.collegeRowSub('B.Com (Hons)', figure: true), 'B.Com (Hons), 2026 Round 1.');
    });
  });

  group('the day-one move card', () {
    test('says what the number above it does not', () {
      expect(TodayCopy.startingPointLine('Accountancy', 10), 'CUET-style, marked +5 and −1. It shows where your marks go, by chapter.');
      expect(TodayCopy.startingPointWith('Accountancy', 'It decides what you repair first.', 10), 'CUET-style questions. It decides what you repair first.');
      expect(GlanceCopy.titleStart, 'Your starting point');
    });

    Future<void> pump(WidgetTester tester, TodayInputs inputs, Size size, Brightness brightness) async {
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
        brightness: brightness,
        disableAnimations: true,
        overrides: todayOverrides,
      );
      await tester.pump();
      await tester.pump();
    }

    final fresh = TodayInputs(now: tuesdayEvening, firstName: 'Asha', attempts: const []);
    final framed = TodayInputs(
      now: tuesdayEvening,
      firstName: 'Asha',
      attempts: const [],
      profile: const TodayProfile(firstMoveLine: 'After that you start on Partnership, the first chapter on your plan.'),
    );

    for (final (name, inputs) in [('no framing', fresh), ('with the set-up line', framed)]) {
      for (final brightness in Brightness.values) {
        final tag = brightness == Brightness.dark ? 'Night' : 'Day';
        testWidgets('412 x 915, $name, $tag: one title line, "Suggested for you" above the bar', (tester) async {
          await pump(tester, inputs, const Size(412, 915), brightness);
          expect(tester.takeException(), isNull);
          final title = tester.renderObject<RenderParagraph>(find.descendant(of: find.byType(MoveHeroCard), matching: find.text(GlanceCopy.titleStart)).first);
          expect(title.size.height, lessThan(title.text.style!.fontSize! * 1.6), reason: 'the title is one line');
          final heading = tester.getRect(find.text(SuggestedCopy.title, skipOffstage: false));
          expect(heading.bottom, lessThanOrEqualTo(915 - _barTop), reason: 'Suggested for you is on the first screen, above the bar');
        });

        testWidgets('360 x 800, $name, $tag: "Suggested for you" above the bar', (tester) async {
          await pump(tester, inputs, const Size(360, 800), brightness);
          expect(tester.takeException(), isNull);
          final heading = tester.getRect(find.text(SuggestedCopy.title, skipOffstage: false));
          expect(heading.bottom, lessThanOrEqualTo(800 - _barTop), reason: 'Suggested for you is on the first screen, above the bar');
        });
      }
    }
  });
}
