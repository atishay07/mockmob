import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/explore/covers_row.dart' show ExploreCovers;
import 'package:mockmob/features/learn2/explore/explore_screen.dart';

import '../../../unit/learn2/explore/explore_support.dart';
import '../../keycards/kc_golden_support.dart';

/// Explore (Learn v2, the chapter feed covers) at 360 by 800 dp, Night and Day, on the recorded covers answers of the web
/// preview (Accountancy): Pro with three subjects (the chips), Free at 20 minutes (the capped line), Free with the day used,
/// a new student, Pro with a feed to pick up, the second cover in view, the covers' other faces, loading, error and empty.
void main() {
  const size = Size(360, 800);

  kcGolden(
    'explore_pro',
    () => const ExploreScreen(),
    overrides: () => exploreOverrides(CoversApi.of(CoversFixture.pro), subjects: const ['accountancy', 'business_studies', 'economics']),
    size: size,
  );

  kcGolden(
    'explore_pro_single',
    () => const ExploreScreen(),
    overrides: () => exploreOverrides(CoversApi.of(CoversFixture.pro)),
    size: size,
  );

  kcGolden(
    'explore_free_20',
    () => const ExploreScreen(),
    overrides: () => exploreOverrides(CoversApi.of(CoversFixture.free), minutes: 20),
    size: size,
  );

  kcGolden(
    'explore_free_day_used',
    () => const ExploreScreen(),
    overrides: () => exploreOverrides(CoversApi.of(CoversFixture.freeUsed)),
    size: size,
  );

  kcGolden(
    'explore_new_student',
    () => const ExploreScreen(),
    overrides: () => exploreOverrides(CoversApi.of(CoversFixture.newPro)),
    size: size,
  );

  kcGolden(
    'explore_resume',
    () => const ExploreScreen(),
    overrides: () => exploreOverrides(CoversApi.of(CoversFixture.proOpen)),
    size: size,
  );

  kcGolden(
    'explore_second_cover',
    () => const ExploreScreen(),
    overrides: () => exploreOverrides(CoversApi.of(CoversFixture.pro)),
    size: size,
    after: (tester) async {
      await tester.drag(find.byKey(ExploreCovers.rowKey), const Offset(-200, 0));
      await settleExplore(tester);
    },
  );

  kcGolden(
    'explore_last_cover',
    () => const ExploreScreen(),
    overrides: () => exploreOverrides(CoversApi.of(CoversFixture.pro)),
    size: size,
    after: (tester) async {
      for (var i = 0; i < 16; i++) {
        await tester.drag(find.byKey(ExploreCovers.rowKey), const Offset(-400, 0));
        await tester.pump(const Duration(milliseconds: 300));
      }
      await settleExplore(tester);
    },
  );

  // The covers' other faces, one cover in view each: a locked card (and a long title), a questions-only chapter, a
  // questions-only chapter whose cards wait in Revise, the longest hook.
  for (final (name, page) in const [('locked', 0), ('questions', 1), ('revise', 2), ('long_hook', 3)]) {
    kcGolden(
      'explore_face_$name',
      () => const ExploreScreen(),
      overrides: () => exploreOverrides(CoversApi(_faces)),
      size: size,
      after: page == 0
          ? null
          : (tester) async {
              await tester.drag(find.byKey(ExploreCovers.rowKey), Offset(-284.0 * page, 0));
              await settleExplore(tester);
            },
    );
  }

  kcGolden(
    'explore_loading',
    () => const ExploreScreen(),
    overrides: () => exploreOverrides(CoversApi.of(CoversFixture.pro, hold: Completer<void>())),
    size: size,
  );

  kcGolden(
    'explore_error',
    () => const ExploreScreen(),
    overrides: () => exploreOverrides(CoversApi.of(CoversFixture.pro, fail: const LearnError(kind: LearnErrorKind.error, status: 500))),
    size: size,
  );

  kcGolden(
    'explore_empty',
    () => const ExploreScreen(),
    overrides: () => exploreOverrides(CoversApi(() => {'subject': {'id': 'accountancy', 'name': 'Accountancy'}, 'lengths': [5, 10, 20], 'covers': <dynamic>[], 'history': false})),
    size: size,
  );
}

/// The recorded Pro covers with the faces the recording does not hold: a locked card, a questions-only chapter (with and
/// without cards waiting in Revise), the longest hook, a long title.
Map<String, dynamic> _faces() {
  final json = CoversFixture.json(CoversFixture.pro);
  final covers = (json['covers'] as List).cast<Map<String, dynamic>>();
  // The covers also send their hooks (up to 5 fronts in feed order, and each length's own): a locked or questions-only face has none.
  const locked = {'id': 'x', 'front': null, 'kind': 'definition', 'mustKnow': true, 'locked': true};
  covers[0]
    ..['hook'] = locked
    ..['hooks'] = <Object?>[]
    ..['title'] = 'Development Experiences of India: A Comparison with Neighbours'
    ..['forYou'] = true;
  for (final c in (covers[0]['counts'] as Map<String, dynamic>).values) {
    (c as Map<String, dynamic>)
      ..['hooks'] = <Object?>[]
      ..['hook'] = locked;
  }
  covers[1]
    ..['hook'] = null
    ..['hooks'] = <Object?>[]
    ..['kept'] = 0
    ..['due'] = 0
    ..['counts'] = {'5': {'cards': 0, 'questions': 3, 'minutes': 5}, '10': {'cards': 0, 'questions': 8, 'minutes': 10}, '20': {'cards': 0, 'questions': 14, 'minutes': 20}};
  covers[2]
    ..['hook'] = null
    ..['hooks'] = <Object?>[]
    ..['kept'] = 4
    ..['due'] = 2
    ..['counts'] = {'5': {'cards': 0, 'questions': 2, 'minutes': 5}, '10': {'cards': 0, 'questions': 4, 'minutes': 10}, '20': {'cards': 0, 'questions': 7, 'minutes': 12}};
  const longHook = {'id': 'y', 'front': 'Which Article requires the government to present its estimated receipts and expenditures to Parliament every year?', 'kind': 'definition', 'mustKnow': false};
  covers[3]
    ..['hook'] = longHook
    ..['hooks'] = [longHook];
  for (final c in (covers[3]['counts'] as Map<String, dynamic>).values) {
    (c as Map<String, dynamic>)
      ..['hooks'] = [longHook]
      ..['hook'] = longHook;
  }
  return json;
}
