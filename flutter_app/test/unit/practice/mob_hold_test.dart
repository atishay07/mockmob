// C-dec 2 item 1 (20 Oct): a Mob paper the Mob is still sitting comes back from the server with its marks, no rows and a
// `mobHold` (server src/lib/mob/paperHold.mjs). The app reads it, shows when and why the answers open in place of them,
// and the side-by-side says the same while it shows picks without right or wrong.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/practice/model/practice_result_model.dart';
import 'package:mockmob/features/practice/widgets/mob_hold_panel.dart';
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/data/mob_models.dart';

import '../../helpers/golden_harness.dart' show FileAssetBundle;

// The held attempt exactly as the server's heldAttemptView sends it (data/tests/mob_paper_hold.test.mjs).
Map<String, Object?> heldJson() => {
      'id': 'att_mob',
      'userId': 'u1',
      'subject': 'accountancy',
      'score': 50,
      'correct': 7,
      'wrong': 2,
      'unattempted': 1,
      'total': 10,
      'details': <Object?>[],
      'questionsSnapshot': <Object?>[],
      'selectionMeta': {
        'mode': 'quick',
        'scoringVersion': 'server_practice_v1',
        'mobPaper': {'mobId': 'm1', 'weekStart': '2026-10-19'},
      },
      'completedAt': DateTime.parse('2026-10-20T04:30:00Z').millisecondsSinceEpoch,
      'mode': 'quick',
      'mobHold': {
        'until': '2026-10-25T18:30:00.000Z',
        'kind': 'weekly',
        'mobId': 'm1',
        'weekStart': '2026-10-19',
        'title': 'The answers open on Sunday 25 Oct',
        'line':
            "This week's paper stays open for your Mob until Sunday 25 Oct, 11:59 PM, so its answers and explanations stay closed until then and nobody can pass them on. Then you can see every answer, fix your mistakes and compare with your Mob.",
        'short': 'The answers open on Sunday 25 Oct, 11:59 PM.',
      },
    };

final _until = DateTime.parse('2026-10-25T18:30:00Z');

void main() {
  test('a held attempt reads: the marks, no rows, and when the answers open', () {
    final a = Attempt.fromJson(heldJson());
    expect(a.mobHold, isNotNull);
    expect(a.mobHold!.until, _until);
    expect(a.mobHold!.title, 'The answers open on Sunday 25 Oct');
    expect([a.correct, a.wrong, a.unattempted, a.total, a.marks, a.maxMarks], [7, 2, 1, 10, 33, 50]);
    expect(a.details, isEmpty);
    expect(a.questions, isEmpty);
    // The result model has no rows to list, so nothing on the page can name a right or wrong answer.
    expect(PracticeResultModel.from(a).hasRows, isFalse);
    // The detail read (GET /api/mobile/attempts/{id}) is the same body.
    expect(AttemptDetail.fromJson(heldJson()).attempt.mobHold?.short, 'The answers open on Sunday 25 Oct, 11:59 PM.');
    // An ordinary attempt, or a hold without a readable time, has none.
    expect(Attempt.fromJson({...heldJson(), 'mobHold': null}).mobHold, isNull);
    expect(MobHold.fromJson({'title': 'x'}), isNull);
    expect(MobHold.fromJson('soon'), isNull);
    expect(a.mobHold!.isOpenAt(_until.subtract(const Duration(seconds: 1))), isFalse);
    expect(a.mobHold!.isOpenAt(_until), isTrue);
  });

  test('how long until the answers open, in the same steps as the website', () {
    String at(Duration left) => opensIn(_until, _until.subtract(left));
    expect(at(const Duration(days: 5, hours: 14)), 'in 5 days');
    expect(at(const Duration(hours: 30)), 'in a day');
    expect(at(const Duration(hours: 3, seconds: 5)), 'in 3 hours');
    expect(at(const Duration(hours: 1)), 'in an hour');
    expect(at(const Duration(minutes: 20)), 'in 20 minutes');
    expect(at(const Duration(seconds: 30)), 'in a minute');
    expect(at(Duration.zero), 'in a moment');
  });

  test('the side-by-side while the paper is open: held, picks without right or wrong', () {
    final c = MobCompare.fromJson({
      'compare': {
        'kind': 'weekly',
        'week': '2026-10-19',
        'sat': 3,
        'size': 4,
        'questions': [
          {
            'number': 1,
            'id': 'q1',
            'stem': 'One',
            'key': null,
            'you': {'picked': 'B', 'right': null, 'changed': 0, 'seconds': 9},
            'others': <Object?>[],
            'trap': null,
          },
        ],
        'held': {'until': '2026-10-25T18:30:00.000Z', 'short': 'The answers open on Sunday 25 Oct, 11:59 PM.'},
      },
    });
    expect(c.held?.until, _until);
    expect(c.questions.single.key, isNull);
    expect(c.questions.single.you?.right, isNull);
    expect(
      MobCopy.heldCompare(c.held!.short),
      'The answers open on Sunday 25 Oct, 11:59 PM. Until then you see what everyone picked and where you split, but not who was right.',
    );
    expect(MobCompare.fromJson({'compare': {'kind': 'weekly'}}).held, isNull, reason: 'a closed week has no hold');
  });

  Future<void> pump(WidgetTester tester, Widget child) async {
    tester.view.physicalSize = const Size(384, 853) * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp(theme: buildTheme(Brightness.dark), home: Scaffold(body: Padding(padding: const EdgeInsets.all(16), child: child))),
      ),
    ));
    await tester.pump();
  }

  testWidgets('the panel says when and why, then offers the answers once they are open', (tester) async {
    final hold = Attempt.fromJson(heldJson()).mobHold!;
    await pump(tester, MobHoldPanel(hold: hold, now: _until.subtract(const Duration(days: 5, hours: 14))));
    expect(find.text('The answers open on Sunday 25 Oct'), findsOneWidget);
    expect(find.textContaining('nobody can pass them on'), findsOneWidget);
    expect(find.text('They open in 5 days, right here on this page.'), findsOneWidget);
    expect(find.text(MobHoldCopy.showAnswers), findsNothing);
    expect(tester.takeException(), isNull);

    var reloads = 0;
    await pump(tester, MobHoldPanel(hold: hold, now: _until, onReload: () => reloads++));
    expect(find.text(MobHoldCopy.openNow), findsOneWidget);
    await tester.tap(find.byType(KeyButton));
    await tester.pump(const Duration(milliseconds: 400));
    expect(reloads, 1);
  });

  testWidgets('a hold without the server sentences still reads plainly, and fits a 320 dp phone at large text', (tester) async {
    tester.view.physicalSize = const Size(320, 640) * 2;
    final hold = MobHold(until: _until);
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(
        theme: buildTheme(Brightness.light),
        builder: (context, child) => MediaQuery(data: MediaQuery.of(context).copyWith(textScaler: const TextScaler.linear(1.6)), child: child!),
        home: Scaffold(body: SingleChildScrollView(child: MobHoldPanel(hold: hold, now: _until.subtract(const Duration(hours: 3))))),
      ),
    ));
    await tester.pump();
    expect(find.text(MobHoldCopy.fallbackTitle), findsOneWidget);
    expect(find.text('They open in 3 hours, right here on this page.'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'no overflow');
    tester.view.reset();
  });
}
