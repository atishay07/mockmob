// The Explore feed on the phone, Night and Day at 360 x 800 (the web's phone band, wt-1031-learn-v2 tmp/learn-1101/r4-merged
// f01 to f09 at 390): a student's first visit with the Mobi chip in the peek strip, turned (the chip stays); a later card with the
// next item peeking as a card edge; Revise later and its stamp; a question with its options in the thumb zone; a right answer with
// the streak; a wrong answer with NCERT's line in place; the checkpoint and its fan; "Stop for now?"; "This feed"; the one end
// screen (Keep going and the fix link, a stopped feed's Continue, the next chapter's key with its name, Free after the claim);
// Free's day used; the loading stage; the feed that did not start. Recorded server answers (FixtureLearnApi), reduced motion
// (each state at rest).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/data/learn_prefs.dart';
import 'package:mockmob/features/learn2/feed/feed_controller.dart';
import 'package:mockmob/features/learn2/feed/feed_model.dart';
import 'package:mockmob/features/learn2/feed/feed_screen.dart';
import 'package:mockmob/features/learn2/learn2_links.dart';
import 'package:mockmob/features/learn2/stage/stage_frame.dart';

import '../../../unit/learn2/feed/support/feed_harness.dart';
import '../../keycards/kc_golden_support.dart';

/// A server that never answers the start (the loading stage at rest, no timer left behind).
class _Waiting extends FixtureLearnApi {
  @override
  Future<LearnRun> startRun(RunStart start) => Completer<LearnRun>().future;
}

/// A server whose end leads with the next chapter, as `endOptions` answers once every card of the chapter has been seen.
class _NextChapterApi extends FixtureLearnApi {
  @override
  Future<LearnEnd> end(String runId, {bool stop = false}) async {
    await super.end(runId, stop: stop);
    final body = LearnFixtures.json('run_end_feed_aop_pro');
    final keep = body['lead'];
    body['lead'] = {
      'kind': 'next',
      'title': 'Next chapter · 10 min',
      'minutes': 10,
      'label': 'Next chapter · 10 min',
      'chapterTitle': 'Retirement and Death of a Partner',
      'evidence': 'Retirement and Death of a Partner',
      'place': {'n': 6, 'of': 14},
      'run': {'chapterKey': 'accountancy.retirement-and-death-of-partner', 'minutes': 10, 'leaveOut': <Object>[], 'kind': 'feed'},
    };
    body['options'] = [keep];
    return LearnEnd.parse(body);
  }
}

/// A server whose end of a stopped feed offers to continue it (the run stays open on the server).
class _StoppedFeedApi extends FixtureLearnApi {
  @override
  Future<LearnEnd> end(String runId, {bool stop = false}) async {
    if (stop) {
      calls.add('end $runId');
      stops.add(true);
      ended.add(runId);
    } else {
      await super.end(runId, stop: stop);
    }
    final body = LearnFixtures.json('run_end_feed_aop_pro');
    final fix = (body['options'] as List).first;
    body['stopped'] = stop;
    body['lead'] = {
      'kind': 'continue',
      'title': 'Continue · 6 min',
      'minutes': 6,
      'label': 'Continue · 6 min',
      'evidence': null,
      'run': {'chapterKey': 'accountancy.admission-of-partner', 'minutes': 6, 'leaveOut': <Object>[], 'kind': 'feed', 'resume': runId},
    };
    body['options'] = [fix];
    return LearnEnd.parse(body);
  }
}

FeedController _c(WidgetTester tester) => tester.state<FeedScreenState>(find.byType(FeedScreen)).controller;

LearnQuestionItem _q(FeedController c, int slot) => (c.slots[slot] as FeedItemSlot).item as LearnQuestionItem;
LearnCardItem _card(FeedController c, int slot) => (c.slots[slot] as FeedItemSlot).item as LearnCardItem;

Widget _feed([FeedLaunch launch = const FeedLaunch(chapterKey: l2Aop)]) => FeedScreen(launch: launch);

/// A student who has already moved in a feed once: the chip is gone, the card edge shows what comes next.
List<Override> _later(FixtureLearnApi api, {bool proNudges = false}) {
  final store = MemoryPrefsStore()..values[LearnPrefs.coachKey] = <String>[FeedController.cueId(null)];
  return feedOverrides(api, store: store, proNudges: proNudges);
}

void main() {
  // The first visit: the chip says how the feed moves.
  kcGolden('feed_first_visit', _feed, overrides: () => feedOverrides(FixtureLearnApi()));

  kcGolden(
    'feed_first_visit_turned',
    _feed,
    overrides: () => feedOverrides(FixtureLearnApi()),
    after: (tester) async {
      _c(tester).turn(_card(_c(tester), 0));
      await kcSettle(tester);
    },
  );

  kcGolden('feed_card_front', _feed, overrides: () => _later(FixtureLearnApi()));

  kcGolden(
    'feed_card_turned',
    _feed,
    overrides: () => _later(FixtureLearnApi()),
    after: (tester) async {
      _c(tester).turn(_card(_c(tester), 0));
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_kept',
    _feed,
    overrides: () => _later(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      c.turn(_card(c, 0));
      await c.keep(_card(c, 0));
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_question',
    _feed,
    overrides: () => _later(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      c.turn(_card(c, 0));
      await c.keep(_card(c, 0));
      c.go(4);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_mistake_question',
    _feed,
    overrides: () => _later(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      c.go(7);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_right_streak',
    _feed,
    overrides: () => _later(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      // Slots 4, 7, 10 and 13 are two plain questions and two open mistakes; the last question of the feed, a short one, says the
      // fifth right answer in a row.
      for (final i in [4, 7, 10, 13]) {
        c.go(i);
        await c.choose(_q(c, i), rightKey(_q(c, i)));
      }
      c.go(16);
      await kcSettle(tester);
      await c.choose(_q(c, 16), rightKey(_q(c, 16)));
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_wrong_line',
    _feed,
    overrides: () => _later(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      await c.keep(_card(c, 0));
      // The feed's last question, a short one, so the verdict and NCERT's line can be seen in place.
      c.go(16);
      await kcSettle(tester);
      await c.choose(_q(c, 16), wrongKey(_q(c, 16)));
      await kcSettle(tester);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_checkpoint',
    _feed,
    overrides: () => _later(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      await c.keep(_card(c, 0));
      await c.keep(_card(c, 1));
      c.go(4);
      await c.choose(_q(c, 4), rightKey(_q(c, 4)));
      c.go(8);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_stop_sheet',
    _feed,
    overrides: () => _later(FixtureLearnApi()),
    capture: () => find.byType(MaterialApp),
    after: (tester) async {
      final c = _c(tester);
      await c.keep(_card(c, 0));
      c.go(4);
      await c.choose(_q(c, 4), rightKey(_q(c, 4)));
      c.go(8);
      await kcSettle(tester);
      await tester.tap(find.bySemanticsLabel('Close the feed'));
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_this_feed_sheet',
    _feed,
    overrides: () => _later(FixtureLearnApi()),
    capture: () => find.byType(MaterialApp),
    after: (tester) async {
      final c = _c(tester);
      c.turn(_card(c, 0));
      await c.keep(_card(c, 1));
      c.go(4);
      await c.choose(_q(c, 4), wrongKey(_q(c, 4)));
      await kcSettle(tester);
      await tester.tap(find.byType(StageCounter));
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_end',
    _feed,
    overrides: () => _later(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      for (var i = 1; i < 4; i++) {
        c.go(i);
      }
      await c.keep(_card(c, 2));
      // A plain question and an open mistake, both right: three numbers on the end.
      c.go(4);
      await c.choose(_q(c, 4), rightKey(_q(c, 4)));
      c.go(7);
      await c.choose(_q(c, 7), rightKey(_q(c, 7)));
      c.go(c.endAt);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_end_stopped',
    _feed,
    overrides: () => _later(_StoppedFeedApi()),
    after: (tester) async {
      final c = _c(tester);
      for (var i = 1; i < 6; i++) {
        c.go(i);
      }
      await c.keep(_card(c, 2));
      c.stopHere();
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_end_next_chapter',
    _feed,
    overrides: () => _later(_NextChapterApi()),
    after: (tester) async {
      final c = _c(tester);
      await c.keep(_card(c, 0));
      await c.keep(_card(c, 1));
      c.go(c.endAt);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_end_free',
    _feed,
    overrides: () => _later(FixtureLearnApi(pro: false), proNudges: true),
    after: (tester) async {
      final c = _c(tester);
      await c.keep(_card(c, 0));
      c.go(1);
      await c.choose(_q(c, 1), rightKey(_q(c, 1)));
      c.go(c.endAt);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_free_used',
    () => _feed(const FeedLaunch(chapterKey: l2Pf)),
    overrides: () => feedOverrides(FixtureLearnApi(pro: false, freeUsed: true), proNudges: true),
  );

  kcGolden('feed_loading', _feed, overrides: () => feedOverrides(_Waiting()));

  kcGolden('feed_error', _feed, overrides: () => feedOverrides(FixtureLearnApi(error: true)));
}
