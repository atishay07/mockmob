// The Explore feed on the phone, Night and Day at 360 x 800 (the web's phone band, tmp/learn-1101/final/*-feed-*-360-*.png
// in the web worktree): the card's front, turned, kept; a question; a right answer with the streak; a wrong answer with
// NCERT's line in place; the checkpoint; "Stop for now?"; "This feed"; the end on Pro and on Free after the claim;
// Free's day used; the loading stage; the feed that did not start. Recorded server answers (FixtureLearnApi), reduced
// motion (each state at rest).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
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

FeedController _c(WidgetTester tester) => tester.state<FeedScreenState>(find.byType(FeedScreen)).controller;

LearnQuestionItem _q(FeedController c, int slot) => (c.slots[slot] as FeedItemSlot).item as LearnQuestionItem;
LearnCardItem _card(FeedController c, int slot) => (c.slots[slot] as FeedItemSlot).item as LearnCardItem;

Widget _feed([FeedLaunch launch = const FeedLaunch(chapterKey: l2Aop)]) => FeedScreen(launch: launch);

void main() {
  kcGolden('feed_card_front', _feed, overrides: () => feedOverrides(FixtureLearnApi()));

  kcGolden(
    'feed_card_turned',
    _feed,
    overrides: () => feedOverrides(FixtureLearnApi()),
    after: (tester) async {
      _c(tester).turn(_card(_c(tester), 0));
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_kept',
    _feed,
    overrides: () => feedOverrides(FixtureLearnApi()),
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
    overrides: () => feedOverrides(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      c.turn(_card(c, 0));
      await c.keep(_card(c, 0));
      c.go(4);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_right_streak',
    _feed,
    overrides: () => feedOverrides(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      for (final i in [0, 1, 2]) {
        await c.keep(_card(c, i));
      }
      for (final i in [10, 13]) {
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
    overrides: () => feedOverrides(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      await c.keep(_card(c, 0));
      c.go(7);
      await kcSettle(tester);
      await c.choose(_q(c, 7), wrongKey(_q(c, 7)));
      await kcSettle(tester);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_checkpoint',
    _feed,
    overrides: () => feedOverrides(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      await c.keep(_card(c, 0));
      c.go(4);
      await c.choose(_q(c, 4), rightKey(_q(c, 4)));
      c.go(8);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_stop_sheet',
    _feed,
    overrides: () => feedOverrides(FixtureLearnApi()),
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
    overrides: () => feedOverrides(FixtureLearnApi()),
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
    overrides: () => feedOverrides(FixtureLearnApi()),
    after: (tester) async {
      final c = _c(tester);
      for (var i = 1; i < 4; i++) {
        c.go(i);
      }
      await c.keep(_card(c, 2));
      c.go(c.endAt);
      await kcSettle(tester);
    },
  );

  kcGolden(
    'feed_end_free',
    _feed,
    overrides: () => feedOverrides(FixtureLearnApi(pro: false), proNudges: true),
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
