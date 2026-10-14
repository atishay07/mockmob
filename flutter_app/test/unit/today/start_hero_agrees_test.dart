// The Start sheet's hero and Today's hero are one move: the same words, the same place, the same
// kind (bar review leftover). They are built from the same inputs, so they cannot drift apart.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/app_overrides.dart';
import 'package:mockmob/core/router/quick_start.dart';
import 'package:mockmob/features/today/data/today_providers.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';

import 'support/today_fixtures.dart';

void main() {
  final now = tuesdayEvening;

  void agrees(String name, TodayInputs inputs) {
    test(name, () {
      final container = ProviderContainer(overrides: [todayInputsProvider.overrideWithValue(inputs), ...liveAppOverrides()]);
      addTearDown(container.dispose);
      final hero = buildToday(inputs).hero;
      final start = container.read(startTonightMoveProvider);
      expect(hero, isA<MoveHero>());
      final move = hero! as MoveHero;
      expect(start, isNotNull);
      expect(start!.title, move.summary);
      expect(start.location, (move.primary.target as GoTo).location);
      expect(start.kind, move.primary.actionType);
    });
  }

  agrees('on a night with mistakes to repair', ashaInputs());
  agrees('after a clean practice', ashaInputs(attempts: [accountancyMock('clean', daysBefore(now, 1))]));
}
