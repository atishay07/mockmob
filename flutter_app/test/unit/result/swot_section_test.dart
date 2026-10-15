import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/full/answer_row.dart' show AnswerRow;
import 'package:mockmob/features/result/full/swot_section.dart';

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';

Map<String, dynamic> _contract() => jsonDecode(File('test/fixtures/swot_contract_stand_in.json').readAsStringSync()) as Map<String, dynamic>;

/// The website's real `contract_v1.json`, built by the server's own code.
Map<String, dynamic> _webContract() => jsonDecode(File('test/fixtures/swot_contract_v1.json').readAsStringSync()) as Map<String, dynamic>;

/// The contract's read with [edit] applied to its `swot` block.
Map<String, dynamic> _withSwot(void Function(Map<String, dynamic> swot) edit) {
  final c = _contract();
  edit(c['swot'] as Map<String, dynamic>);
  return c;
}

double _contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  final hi = la > lb ? la : lb;
  final lo = la > lb ? lb : la;
  return (hi + 0.05) / (lo + 0.05);
}

void main() {
  setUpAll(loadAppFonts);
  setUp(SwotSection.debugResetSeen);

  Future<void> pump(
    WidgetTester tester,
    Map<String, dynamic> extra, {
    Brightness brightness = Brightness.dark,
    bool disableAnimations = true,
    double textScale = 1,
    Size size = const Size(384, 853),
    Duration settle = const Duration(milliseconds: 300),
  }) async {
    final d = AttemptDetail.fromJson({...attemptJson(), 'answerReviews': <String, dynamic>{}, 'answerReviewState': 'ready', ...extra});
    await pumpResultRoute(
      tester,
      location: '/result/a7',
      brightness: brightness,
      disableAnimations: disableAnimations,
      textScale: textScale,
      size: size,
      overrides: resultOverrides(attemptId: 'a7', data: RecapData(model: mock7(withDetail: d), attempt: d.attempt, detail: d)),
    );
    if (settle > Duration.zero) await tester.pump(settle);
  }

  /// Scrolls [finder] to the middle of the screen, so a touch target is not clipped by the edge.
  Future<void> seeInMiddle(WidgetTester tester, Finder finder) async {
    await Scrollable.ensureVisible(tester.element(finder.first), alignment: 0.5);
    await tester.pump();
  }

  /// Where the stub of the setup route says it was opened.
  Uri openedAt(WidgetTester tester) {
    final text = tester.widget<Text>(find.textContaining('AT /practice/setup/')).data!;
    return Uri.parse(text.substring('AT '.length));
  }

  group('what shows for each state', () {
    testWidgets('a ready read lays out the plan, the basis, the held line and all four groups in order', (tester) async {
      await pump(tester, _contract());
      expect(find.text('After this mock'), findsOneWidget);
      expect(find.text('Do these next'), findsOneWidget);
      expect(find.text('SWOT for this mock'), findsOneWidget);
      expect(find.text('From 49 of 50 questions in this paper and 212 earlier answers in Accountancy across 6 papers.'), findsOneWidget);
      expect(find.text('1 question under re-check or corrected is left out of this read.'), findsOneWidget);
      for (final word in ['Strengths', 'Weaknesses', 'Opportunities', 'Threats']) {
        expect(find.text(word), findsOneWidget);
      }
      // The groups read top to bottom in the server's order.
      double top(String t) => tester.getTopLeft(find.text(t)).dy;
      expect(top('Strengths') < top('Weaknesses'), isTrue);
      expect(top('Weaknesses') < top('Opportunities'), isTrue);
      expect(top('Opportunities') < top('Threats'), isTrue);
      // The plan comes before the read, and the whole section before "Where the marks went".
      expect(top('Do these next') < top('SWOT for this mock'), isTrue);
      expect(top('After this mock') < top('Where the marks went'), isTrue);
      expect(find.text('Partnership'), findsOneWidget);
      expect(find.text('14 right of 16 across 4 papers, 4 of 4 in this one.'), findsOneWidget);
      expect(find.text('Practise 10 on Accounting Ratios'), findsOneWidget);
      expect(find.text('Marks lost here in each of your last 3 mocks.'), findsOneWidget);
      expect(find.text('A set on this chapter on 16 Oct: 7 right of 10.'), findsOneWidget);
      expect(find.text('Set up'), findsNWidgets(3));
    });

    testWidgets('checks pending shows only its message', (tester) async {
      await pump(tester, {
        'swot': {'version': 1, 'state': 'checks_pending', 'message': 'This read appears once the answer checks load.', 'basis': null, 'quadrants': <Object>[], 'plan': <Object>[]},
      });
      expect(find.text('This read appears once the answer checks load.'), findsOneWidget);
      expect(find.text('After this mock'), findsNothing);
      expect(find.text('Do these next'), findsNothing);
      expect(find.text('SWOT for this mock'), findsNothing);
      expect(find.text('Set up'), findsNothing);
      expect(find.text('Strengths'), findsNothing);
    });

    testWidgets('too few answers shows only its message', (tester) async {
      await pump(tester, {
        'swot': {'version': 1, 'state': 'too_few', 'message': 'Answer at least 10 questions for a read of this paper.', 'basis': null, 'quadrants': <Object>[], 'plan': <Object>[]},
      });
      expect(find.text('Answer at least 10 questions for a read of this paper.'), findsOneWidget);
      expect(find.text('After this mock'), findsNothing);
      expect(find.text('Set up'), findsNothing);
    });

    testWidgets('not available, a missing read and an unknown state show nothing', (tester) async {
      for (final extra in <Map<String, dynamic>>[
        {'swot': {'version': 1, 'state': 'not_available', 'message': null, 'basis': null, 'quadrants': <Object>[], 'plan': <Object>[]}},
        const <String, dynamic>{},
        {'swot': {'version': 2, 'state': 'brand_new_state', 'message': 'Hello.'}},
      ]) {
        SwotSection.debugResetSeen();
        await pump(tester, extra);
        expect(find.text('After this mock'), findsNothing, reason: '$extra');
        expect(find.text('Do these next'), findsNothing);
        expect(find.text('Hello.'), findsNothing);
        expect(find.text('Where the marks went'), findsOneWidget, reason: 'the rest of the result is untouched');
      }
    });

    testWidgets('an empty group shows its one quiet line, never an empty box', (tester) async {
      await pump(
        tester,
        _withSwot((swot) {
          final q = swot['quadrants'] as List;
          (q[2] as Map<String, dynamic>)
            ..['items'] = <Object>[]
            ..['empty'] = 'Nothing extra to name from this paper.';
          (q[3] as Map<String, dynamic>)
            ..['items'] = <Object>[]
            ..['empty'] = 'Pace is not judged: time per question was not recorded for this paper.';
        }),
      );
      expect(find.text('Opportunities'), findsOneWidget);
      expect(find.text('Nothing extra to name from this paper.'), findsOneWidget);
      expect(find.text('Threats'), findsOneWidget);
      expect(find.text('Pace is not judged: time per question was not recorded for this paper.'), findsOneWidget);
      expect(find.text('Cash Flow Statement'), findsNothing, reason: 'its items are gone with the group');
    });

    testWidgets('a group the server sends with neither items nor a line draws no heading', (tester) async {
      await pump(
        tester,
        _withSwot((swot) {
          (swot['quadrants'] as List)[0] = {'id': 'strength', 'label': 'Strengths', 'empty': null, 'items': <Object>[]};
        }),
      );
      expect(find.text('Strengths'), findsNothing);
      expect(find.text('Weaknesses'), findsOneWidget);
    });

    testWidgets('a group with no label from the server still gets its word', (tester) async {
      await pump(
        tester,
        _withSwot((swot) {
          ((swot['quadrants'] as List)[3] as Map<String, dynamic>).remove('label');
        }),
      );
      expect(find.text('Threats'), findsOneWidget);
      expect(find.text('Questions never opened'), findsOneWidget);
    });

    testWidgets('no held line when there are no exclusions', (tester) async {
      await pump(
        tester,
        _withSwot((swot) {
          (swot['basis'] as Map<String, dynamic>)
            ..['heldLine'] = null
            ..['held'] = 0;
        }),
      );
      expect(find.textContaining('left out of this read'), findsNothing);
      expect(find.textContaining('From 49 of 50 questions'), findsOneWidget);
    });

    testWidgets('a first-paper read with no basis line still draws the groups', (tester) async {
      await pump(
        tester,
        _withSwot((swot) {
          swot['basis'] = null;
        }),
      );
      expect(find.text('SWOT for this mock'), findsOneWidget);
      expect(find.text('Strengths'), findsOneWidget);
    });
  });

  group('the buttons', () {
    testWidgets('a Q button opens that answer on the page, and one for a blank question opens the folded group first', (tester) async {
      final paper = specPaper();
      // The page opens the first wrong answer itself, so use a right one, and a blank one.
      final right = paper.indexWhere((q) => q.$2 == V.right) + 1;
      final blank = paper.indexWhere((q) => q.$2 == V.blank) + 1;
      await pump(
        tester,
        _withSwot((swot) {
          final weak = ((swot['quadrants'] as List)[1] as Map<String, dynamic>)['items'] as List;
          (weak[0] as Map<String, dynamic>)['questions'] = [right, blank];
        }),
      );
      AnswerRow? row(int n) => tester.widgetList<AnswerRow>(find.byWidgetPredicate((w) => w is AnswerRow && w.item.number == n, skipOffstage: false)).firstOrNull;
      expect(row(right)!.expanded, isFalse);
      expect(row(blank), isNull, reason: 'blank rows are not built while their group is folded');
      await seeInMiddle(tester, find.text('Q$right'));
      await tester.tap(find.text('Q$right'));
      await tester.pump(const Duration(milliseconds: 700));
      expect(row(right)!.expanded, isTrue);
      await seeInMiddle(tester, find.text('Q$blank'));
      await tester.tap(find.text('Q$blank'));
      await tester.pump(const Duration(milliseconds: 700));
      expect(row(blank)?.expanded, isTrue);
    });

    testWidgets('every Q button is named "Go to question N"', (tester) async {
      final handle = tester.ensureSemantics();
      await pump(tester, _contract());
      // Q12 and Q18 each sit under two items.
      expect(find.bySemanticsLabel('Go to question 12'), findsNWidgets(2));
      expect(find.bySemanticsLabel('Go to question 47'), findsOneWidget);
      expect(find.bySemanticsLabel('Go to question 33'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('the Q buttons and the Set up keys are at least 48 dp to touch', (tester) async {
      final handle = tester.ensureSemantics();
      await pump(tester, _contract());
      for (final label in ['Go to question 47', 'Set up. Practise 10 on Accounting Ratios']) {
        await seeInMiddle(tester, find.bySemanticsLabel(label));
        final rect = tester.getSemantics(find.bySemanticsLabel(label).first).rect;
        expect(rect.height, greaterThanOrEqualTo(47.9), reason: label);
        expect(rect.width, greaterThanOrEqualTo(47.9), reason: label);
      }
      handle.dispose();
    });

    testWidgets('a chapter row opens chapter practice setup with subject, chapter and count (no charge before the second tap)', (tester) async {
      await pump(tester, _contract());
      await seeInMiddle(tester, find.text('Practise 10 on Accounting Ratios'));
      await tester.tap(find.text('Set up').first);
      await tester.pumpAndSettle();
      final uri = openedAt(tester);
      expect(uri.path, '/practice/setup/chapter');
      expect(uri.queryParameters, {'subject': 'accountancy', 'chapter': 'Accounting Ratios', 'count': '10'});
    });

    testWidgets('the second row opens its own chapter', (tester) async {
      await pump(tester, _contract());
      await seeInMiddle(tester, find.text('Practise 10 on Depreciation'));
      await tester.tap(find.text('Set up').at(1));
      await tester.pumpAndSettle();
      expect(openedAt(tester).queryParameters['chapter'], 'Depreciation');
    });

    testWidgets('a row with no chapter opens Quick setup', (tester) async {
      await pump(
        tester,
        _withSwot((swot) {
          swot['plan'] = [
            {
              'id': 'p1',
              'label': 'Practise 10 mixed questions',
              'reason': 'No single chapter stands out yet. A mixed set adds to your record.',
              'practice': {'subject': 'accountancy', 'mode': 'quick', 'count': 10, 'chapter': null},
              'href': '/dashboard?subject=accountancy&mode=quick&count=10',
              'later': null,
            },
          ];
        }),
      );
      await seeInMiddle(tester, find.text('Practise 10 mixed questions'));
      await tester.tap(find.text('Set up'));
      await tester.pumpAndSettle();
      final uri = openedAt(tester);
      expect(uri.path, '/practice/setup/quick');
      expect(uri.queryParameters, {'subject': 'accountancy', 'count': '10'});
    });

    testWidgets('the first row is outlined in the accent and the others in the hairline; none is filled', (tester) async {
      await pump(tester, _contract());
      final colors = MmColors.dark;
      Color border(String label) {
        final box = tester.widget<DecoratedBox>(
          find.descendant(of: find.bySemanticsLabel(label), matching: find.byType(DecoratedBox)).first,
        );
        final shape = (box.decoration as ShapeDecoration).shape as StadiumBorder;
        expect((box.decoration as ShapeDecoration).color, isNull, reason: 'outlined, never filled');
        return shape.side.color;
      }

      final handle = tester.ensureSemantics();
      await tester.pump();
      expect(border('Set up. Practise 10 on Accounting Ratios'), colors.accentText);
      expect(border('Set up. Practise 10 on Depreciation'), colors.lineStrong);
      handle.dispose();
    });
  });

  group('the one authored moment', () {
    double opacityOf(WidgetTester tester, String text) =>
        tester.widgetList<Opacity>(find.ancestor(of: find.text(text), matching: find.byType(Opacity))).first.opacity;

    testWidgets('the first view rises in, plan rows then groups, and ends at rest', (tester) async {
      await pump(tester, _contract(), disableAnimations: false, settle: Duration.zero);
      // Just started: the first plan row has barely begun, and the last group has not.
      expect(opacityOf(tester, 'Practise 10 on Accounting Ratios'), lessThan(1));
      expect(opacityOf(tester, 'Threats'), 0);
      await tester.pump(const Duration(milliseconds: 100));
      final firstMid = opacityOf(tester, 'Practise 10 on Accounting Ratios');
      expect(firstMid, greaterThan(0));
      expect(opacityOf(tester, 'Practise 10 on Accounting Ratios'), greaterThan(opacityOf(tester, 'Practise 10 on Cash Flow Statement')));
      await tester.pump(const Duration(milliseconds: 1000));
      for (final t in ['Practise 10 on Accounting Ratios', 'Practise 10 on Cash Flow Statement', 'Threats', 'Strengths']) {
        expect(opacityOf(tester, t), 1, reason: t);
      }
      await tester.pumpAndSettle();
    });

    testWidgets('a second view of the same attempt is at rest at once', (tester) async {
      await pump(tester, _contract(), disableAnimations: false, settle: Duration.zero);
      await tester.pump(const Duration(seconds: 2));
      // Open the result again (the route is rebuilt, the app run is the same).
      await pump(tester, _contract(), disableAnimations: false, settle: Duration.zero);
      expect(opacityOf(tester, 'Practise 10 on Accounting Ratios'), 1);
      expect(opacityOf(tester, 'Threats'), 1);
    });

    testWidgets('reduced motion: nothing moves, everything is there at once', (tester) async {
      await pump(tester, _contract());
      expect(opacityOf(tester, 'Practise 10 on Accounting Ratios'), 1);
      expect(opacityOf(tester, 'Threats'), 1);
    });

    testWidgets('a message-only read never plays and never leaves a timer behind', (tester) async {
      await pump(tester, {
        'swot': {'version': 1, 'state': 'checks_pending', 'message': 'This read appears once the answer checks load.', 'basis': null, 'quadrants': <Object>[], 'plan': <Object>[]},
      }, disableAnimations: false);
      await tester.pumpAndSettle();
      expect(find.text('This read appears once the answer checks load.'), findsOneWidget);
    });
  });

  group('themes, size and type', () {
    for (final brightness in Brightness.values) {
      testWidgets('${brightness.name}: a long chapter and a large text size do not overflow at phone width', (tester) async {
        const long = 'Accounting for partnership firms: reconstitution at admission, retirement and death of a partner';
        await pump(
          tester,
          _withSwot((swot) {
            final plan = swot['plan'] as List;
            (plan[0] as Map<String, dynamic>)
              ..['label'] = 'Practise 10 on $long'
              ..['reason'] = 'Marks lost here in each of your last 3 mocks, and 4 right of 21 across 3 papers in this subject.';
            final weak = ((swot['quadrants'] as List)[1] as Map<String, dynamic>)['items'] as List;
            (weak[0] as Map<String, dynamic>)
              ..['title'] = long
              ..['questions'] = [for (var i = 1; i <= 24; i++) i];
          }),
          brightness: brightness,
          textScale: 1.6,
          size: const Size(360, 780),
        );
        expect(tester.takeException(), isNull);
        expect(find.text(long), findsOneWidget);
        expect(find.text('Q24'), findsOneWidget);
      });
    }

    test('the muted text and the group dots clear AA on the ground in both themes', () {
      for (final colors in [MmColors.dark, MmColors.light]) {
        for (final (name, c) in [
          ('ink2', colors.ink2),
          ('goodText', colors.goodText),
          ('badText', colors.badText),
          ('accentText', colors.accentText),
          ('warnText', colors.warnText),
        ]) {
          expect(_contrast(c, colors.ground), greaterThanOrEqualTo(4.5), reason: '$name on ${colors.isNight ? 'Night' : 'Day'}');
        }
      }
    });
  });
  group("the website's real contract_v1.json", () {
    for (final brightness in Brightness.values) {
      testWidgets('${brightness.name}: the server strings are drawn as sent, with no overflow at 360 and 1.3 text', (tester) async {
        final raw = _webContract();
        await pump(tester, raw, brightness: brightness, textScale: 1.3, size: const Size(360, 780));
        expect(tester.takeException(), isNull);
        final swot = raw['swot'] as Map<String, dynamic>;
        expect(find.text('After this mock'), findsOneWidget);
        // Every sentence the server sent is on screen as many times as the server sent it (a plan
        // reason and the item it comes from can be the same sentence).
        final sent = <String>[
          (swot['basis'] as Map<String, dynamic>)['line'] as String,
          for (final p in (swot['plan'] as List).cast<Map<String, dynamic>>()) ...[p['label'] as String, p['reason'] as String],
          for (final q in (swot['quadrants'] as List).cast<Map<String, dynamic>>()) ...[
            q['label'] as String,
            for (final it in (q['items'] as List).cast<Map<String, dynamic>>()) it['detail'] as String,
          ],
        ];
        for (final text in sent.toSet()) {
          expect(find.text(text), findsNWidgets(sent.where((t) => t == text).length), reason: text);
        }
        expect(find.text('Set up'), findsNWidgets((swot['plan'] as List).length));
        await tester.pumpAndSettle();
      });
    }
  });
}
