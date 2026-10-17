import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/widgets/mistake_row.dart' show MistakeSummary;
import 'package:mockmob/features/result/model/time_decisions.dart';

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';

const _letters = 'ABCD';

/// The spec paper (50 questions, 60 minutes) with a device record: 60 s on each question, and on the
/// first wrong answer 200 s with the key picked first and changed to the wrong final answer.
({Map<String, dynamic> json, int changed, int key, int given}) _withRecord() {
  final a = attemptJson();
  final qs = (a['questionsSnapshot'] as List).cast<Map<String, dynamic>>();
  final ds = (a['details'] as List).cast<Map<String, dynamic>>();
  final changed = ds.indexWhere((d) => d['isCorrect'] == false);
  final ev = <Map<String, dynamic>>[];
  final changes = <Map<String, dynamic>>[];
  var seq = 1;
  var at = 0;
  for (var i = 0; i < qs.length; i++) {
    final qid = qs[i]['id'] as String;
    final given = ds[i]['givenIndex'] as int?;
    final key = qs[i]['correctIndex'] as int;
    ev.add({'seq': seq++, 'qid': qid, 'at': at, 'type': 'visit'});
    if (i == changed) {
      ev.add({'seq': seq++, 'qid': qid, 'at': at + 20000, 'type': 'answer', 'answer': key});
      ev.add({'seq': seq++, 'qid': qid, 'at': at + 90000, 'type': 'answer', 'answer': given});
      changes.add({'qid': qid, 'at': at + 90000, 'before': key, 'after': given, 'markEffect': -6});
    } else if (given != null) {
      ev.add({'seq': seq++, 'qid': qid, 'at': at + 30000, 'type': 'answer', 'answer': given});
    }
    at += (i == changed ? 200 : 60) * 1000;
  }
  ev.add({'seq': seq++, 'qid': qs.last['id'], 'at': at, 'type': 'visit'});
  (a['selectionMeta'] as Map<String, dynamic>)['recovery'] = {
    'telemetry': 'self_reported',
    'timeline': ev,
    'observed': {'answerChanges': changes},
  };
  return (json: a, changed: changed, key: qs[changed]['correctIndex'] as int, given: ds[changed]['givenIndex'] as int);
}

void main() {
  setUpAll(loadAppFonts);

  Future<void> pump(WidgetTester tester, Map<String, dynamic> json) async {
    final d = AttemptDetail.fromJson({...json, 'answerReviews': <String, dynamic>{}, 'answerReviewState': 'ready'});
    await pumpResultRoute(
      tester,
      openFolds: true,
      location: '/result/a7',
      disableAnimations: true,
      overrides: resultOverrides(attemptId: 'a7', data: RecapData(model: mock7(withDetail: d), attempt: d.attempt, detail: d)),
    );
    await tester.pump(const Duration(milliseconds: 300));
  }

  testWidgets('the full result shows Time and decisions after how the marks split, and each answer its own time and picks', (tester) async {
    final r = _withRecord();
    await pump(tester, r.json);
    final at = r.changed * 60;
    final picks = 'Picked ${_letters[r.key]} at ${clockLabel(at + 20)}. Changed to ${_letters[r.given]} at ${clockLabel(at + 90)}, 1m 10s later.';

    expect(find.text(TimeCopy.title), findsOneWidget);
    expect(find.text('This paper gives you 1m 12s a question: 60 minutes for 50 questions. Your median was 1m a question, over 50 timed questions.'), findsOneWidget);
    expect(find.text(TimeCopy.longestTitle), findsOneWidget);
    expect(find.text(TimeCopy.changesTitle), findsOneWidget);
    expect(find.text('You changed one answer. Net effect on your marks: −6.'), findsOneWidget);
    // The section reads after how the marks split.
    expect(tester.getTopLeft(find.text('How the marks split')).dy < tester.getTopLeft(find.text(TimeCopy.title)).dy, isTrue);

    // A mistake opens on a tap (none opens by itself, RESULT-1017 4.5): its own time and picks, in the same words.
    final summary = find.byWidgetPredicate((w) => w is MistakeSummary && w.number == r.changed + 1, skipOffstage: false);
    if (summary.evaluate().isEmpty) {
      await tester.ensureVisible(find.textContaining('Show all'));
      await tester.tap(find.textContaining('Show all'));
      await tester.pump();
    }
    await tester.ensureVisible(summary);
    await tester.pump();
    await tester.tap(summary);
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text(TimeCopy.rowLabel), findsOneWidget);
    expect(find.text("3m 20s on this question. The paper gives 1m 12s a question, and your median was 1m. That is 2.8 times the paper's pace."), findsOneWidget);
    // Once in the change list and once in the open answer.
    expect(find.text(picks), findsNWidgets(2));
    expect(find.text('That change cost 6 marks.'), findsOneWidget);
  });

  testWidgets('a paper without a device record shows no section and keeps the plain changed line', (tester) async {
    await pump(tester, attemptJson());
    expect(find.text(TimeCopy.title), findsNothing);
    expect(find.text(TimeCopy.rowLabel), findsNothing);
  });
}
