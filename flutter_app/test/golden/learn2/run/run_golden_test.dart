// The Learn run on the phone, Night and Day at 360 x 800 (the web's phone band, wt-1031-learn-v2 tmp/learn-1101/r4-merged
// r01 to r08 at 390): the card's front with the turn cue, turned with its three rating keys, the stamp after Got it, an open
// mistake and a new student's first question with its hint, a wrong answer with NCERT's line in place, a recap card and its end,
// "Stop for now?", a lesson, a look past Free's ratings, the cards run's pause, the one end screen (a finished run, a stopped
// one, Free after the claim), Free's day used, the loading stage and the run that did not start. Recorded server answers
// (FixtureLearnApi), reduced motion (each state at rest).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/learn2_links.dart';
import 'package:mockmob/features/learn2/run/run_controller.dart';
import 'package:mockmob/features/learn2/run/run_screen.dart';

import '../../../unit/learn2/run/support/run_harness.dart';
import '../../keycards/kc_golden_support.dart';

/// A server that never answers the start (the loading stage at rest, no timer left behind).
class _Waiting extends FixtureLearnApi {
  @override
  Future<LearnRun> startRun(RunStart start) => Completer<LearnRun>().future;
}

RunController _c(WidgetTester tester) => tester.state<LearnRunScreenState>(find.byType(LearnRunScreen)).controller;

Widget _run([RunLaunch launch = const RunLaunch(chapterKey: l2Pf)]) => LearnRunScreen(launch: launch);

/// Rates the card on screen and lets its hand-off pass.
Future<void> _rate(WidgetTester tester, int rating) async {
  unawaited(_c(tester).rate(rating));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 200));
  await tester.pump(const Duration(milliseconds: 100));
}

/// Where the recorded mix keeps its open mistakes (4 and 8) and its plain questions (13 and 17).
const List<int> _mistakes = [4, 8];
const List<int> _plain = [13, 17];

void main() {
  kcGolden('run_card_front', _run, overrides: () => runOverrides(FixtureLearnApi()));

  kcGolden(
    'run_card_revealed',
    _run,
    overrides: () => runOverrides(FixtureLearnApi()),
    after: (tester) async {
      _c(tester).turn(_c(tester).item! as LearnCardItem);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'run_stamp',
    _run,
    overrides: () => runOverrides(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      c.turn(c.item! as LearnCardItem);
      await kcSettle(tester);
      await _rate(tester, 3);
    },
  );

  kcGolden(
    'run_question',
    _run,
    overrides: () => runOverrides(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      c.turn(c.item! as LearnCardItem);
      await _rate(tester, 3);
      while (c.at < _mistakes.first) {
        c.advance();
      }
      await kcSettle(tester);
    },
  );

  kcGolden(
    'run_question_hint',
    () => _run(const RunLaunch(chapterKey: l2Aop, minutes: 20)),
    overrides: () => runOverrides(FixtureLearnApi(startFixtures: {'mix': 'run_start_mix_aop_20_new_pro'})),
    after: (tester) async {
      final c = _c(tester);
      final first = c.items.indexWhere((i) => i is LearnQuestionItem);
      while (c.at < first) {
        c.advance();
      }
      await kcSettle(tester);
    },
  );

  kcGolden(
    'run_right_streak',
    _run,
    overrides: () => runOverrides(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      for (final i in [..._mistakes, _plain.first]) {
        while (c.at < i) {
          c.advance();
        }
        await c.pick(rightKey(c.item! as LearnQuestionItem));
      }
      await kcSettle(tester);
      await kcSettle(tester);
      // The question may be a long one: bring its verdict into view, as the student's thumb would.
      await tester.ensureVisible(find.textContaining('in a row'));
      await kcSettle(tester);
    },
  );

  kcGolden(
    'run_wrong_line',
    _run,
    overrides: () => runOverrides(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      while (c.at < _mistakes.first) {
        c.advance();
      }
      await kcSettle(tester);
      await c.pick(wrongKey(c.item! as LearnQuestionItem));
      await kcSettle(tester);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'run_recap',
    () => _run(const RunLaunch(chapterKey: l2Pf, kind: 'recap', minutes: 5)),
    overrides: () => runOverrides(FixtureLearnApi()),
    after: (tester) async {
      _c(tester).goRecap(1);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'run_recap_end',
    () => _run(const RunLaunch(chapterKey: l2Pf, kind: 'recap', minutes: 5)),
    overrides: () => runOverrides(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      while (c.phase == RunPhase.play) {
        c.goRecap(1);
      }
      await kcSettle(tester);
    },
  );

  kcGolden(
    'run_stop_sheet',
    _run,
    overrides: () => runOverrides(FixtureLearnApi()),
    capture: () => find.byType(MaterialApp),
    after: (tester) async {
      final c = _c(tester);
      c.turn(c.item! as LearnCardItem);
      await _rate(tester, 3);
      while (c.at < _mistakes.first) {
        c.advance();
      }
      await kcSettle(tester);
      await c.pick(wrongKey(c.item! as LearnQuestionItem));
      await kcSettle(tester);
      await tester.tap(find.bySemanticsLabel('Close'));
      await kcSettle(tester);
    },
  );

  kcGolden(
    'run_lesson',
    () => _run(const RunLaunch(chapterKey: l2Aop, minutes: 20)),
    overrides: () => runOverrides(FixtureLearnApi(startFixtures: {'mix': 'run_start_mix_aop_20_new_pro'})),
  );

  kcGolden(
    'run_look',
    _run,
    overrides: () => runOverrides(_Looks()),
    after: (tester) async {
      final c = _c(tester);
      c.turn(c.item! as LearnCardItem);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'run_round',
    () => _run(const RunLaunch(chapterKey: l2Pf, kind: 'cards', minutes: 8)),
    overrides: () => runOverrides(_ManyCards()),
    after: (tester) async {
      final c = _c(tester);
      for (var i = 0; i < 20; i++) {
        c.turn(c.item! as LearnCardItem);
        await _rate(tester, 3);
      }
      await kcSettle(tester);
    },
  );

  kcGolden(
    'run_end',
    _run,
    overrides: () => runOverrides(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      for (var i = 0; i < 3; i++) {
        c.turn(c.item! as LearnCardItem);
        await _rate(tester, 3);
      }
      c.finish();
      await kcSettle(tester);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'run_end_stopped',
    _run,
    overrides: () => runOverrides(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      for (var i = 0; i < 3; i++) {
        c.turn(c.item! as LearnCardItem);
        await _rate(tester, 3);
      }
      c.finish(c.doneCount);
      await kcSettle(tester);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'run_end_free',
    _run,
    overrides: () => runOverrides(_FreeEnd(), proNudges: true),
    after: (tester) async {
      final c = _c(tester);
      c.turn(c.item! as LearnCardItem);
      await _rate(tester, 3);
      c.finish();
      await kcSettle(tester);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'run_free_used',
    () => _run(const RunLaunch(chapterKey: l2Pf, kind: 'feed')),
    overrides: () => runOverrides(FixtureLearnApi(pro: false, freeUsed: true), proNudges: true),
  );

  kcGolden('run_loading', _run, overrides: () => runOverrides(_Waiting()));

  kcGolden('run_error', _run, overrides: () => runOverrides(FixtureLearnApi(error: true)));
}

/// A cards run of 25 recorded cards (the pause comes after 20).
class _ManyCards extends FixtureLearnApi {
  int _piled = 0;

  @override
  Future<LearnRun> startRun(RunStart start) async {
    final base = await super.startRun(start);
    final cards = [
      for (final i in base.items)
        if (i is LearnCardItem) i,
    ];
    final raw = base.raw;
    return LearnRun.parse({
      ...raw,
      'kind': 'cards',
      'items': [
        for (var i = 0; i < 25; i++) {...cards[i % cards.length].raw, 'id': '${base.id}-m$i'},
      ],
    });
  }

  @override
  Future<LearnRateResult> rate(String runId, String itemId, int rating) async => LearnRateResult.parse({
    'ok': true,
    'stamp': 'Back Wed',
    'revisePile': {'count': ++_piled},
  });
}

/// Free past its ratings: every card of the run is a look, with the server's line.
class _Looks extends FixtureLearnApi {
  _Looks() : super(pro: false);

  @override
  Future<LearnRun> startRun(RunStart start) async {
    final base = await super.startRun(start);
    return LearnRun.parse({
      ...base.raw,
      'looks': {'text': "You've used today's 10 free card ratings. The rest show their answers but won't be added to Revise."},
      'items': [
        for (final i in base.raw['items'] as List<Object?>) {...(i! as Map<String, Object?>), 'look': (i as Map<String, Object?>)['type'] == 'card'},
      ],
    });
  }
}

/// Free's end after the day's session: the server's line over Quick recap, See Pro as the quiet link.
class _FreeEnd extends FixtureLearnApi {
  _FreeEnd() : super(pro: false);

  @override
  Future<LearnEnd> end(String runId, {bool stop = false}) async => LearnEnd.parse(LearnFixtures.json('run_end_feed_aop_free'));
}
