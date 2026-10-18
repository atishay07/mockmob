// M11 of the v15 emulator walk: production runs with MOB_ENABLED off, the rig with it on, and the Mob's entries showed on the
// rig. The app has no flag of its own: every Mob entry reads the one `GET /api/mob` state, and with the server's switch off
// (404 MOB_DISABLED, or any 404 on that route) none of them may draw anything. This holds all four entry points to it:
// Today's card and invitation, Practice's row, Review's row, and the You hub's row.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/data/mob_repository.dart';
import 'package:mockmob/features/social/logic/mob_entry.dart' show MobEntryPlace;
import 'package:mockmob/features/social/widgets/mob_entry_row.dart';
import 'package:mockmob/features/social/widgets/mob_hub_row.dart';
import 'package:mockmob/features/social/widgets/mob_today_card.dart';

import '../../helpers/golden_harness.dart';
import 'mob_test_kit.dart';

Map<String, dynamic> _errorBody(String code) => (mobFixture('errors_v1.json')[code] as Map<String, dynamic>)['body'] as Map<String, dynamic>;

final _disabled = ApiError.fromResponse(404, _errorBody('MOB_DISABLED'));

/// The server's switch is off, but this phone still holds the Mob it read when the switch was on.
RemoteState<MobRead> _disabledWithCache() => RemoteState(value: mobState().value, fetchedAt: mobNow, error: _disabled);

Future<void> _pump(WidgetTester tester, Widget child, RemoteState<MobRead> state) async {
  await pumpMockmob(tester, child, size: const Size(390, 1600), disableAnimations: true, overrides: mobOverrides(state));
  await tester.pumpAndSettle();
}

/// The four places the Mob can be entered from, each drawn on its own.
final _entries = <String, Widget>{
  'Today (the Mob card, or the invitation)': const MobTodayBlock(),
  'Practice (this week\'s paper)': const MobEntryRow(place: MobEntryPlace.practice),
  'Review (the Mob\'s trap)': const MobEntryRow(place: MobEntryPlace.review),
  'You (Your Mob, Start a Mob)': const MobHubRow(),
};

void main() {

  group('with the server\'s switch off, no Mob entry draws anything', () {
    for (final entry in _entries.entries) {
      testWidgets('${entry.key}: the server answered MOB_DISABLED', (tester) async {
        await _pump(tester, entry.value, RemoteState<MobRead>(error: _disabled));
        expect(find.textContaining('Mob'), findsNothing);
        expect(find.byType(Text), findsNothing);
      });

      testWidgets('${entry.key}: a Mob read while the switch was on stays hidden once the server says it is off', (tester) async {
        await _pump(tester, entry.value, _disabledWithCache());
        expect(find.textContaining('Mob'), findsNothing);
        expect(find.byType(Text), findsNothing);
      });

      testWidgets('${entry.key}: nothing read yet and the read failed, nothing cached: hidden', (tester) async {
        await _pump(tester, entry.value, const RemoteState<MobRead>(error: ApiError(kind: ApiErrorKind.network, code: 'network')));
        expect(find.byType(Text), findsNothing);
      });

      testWidgets('${entry.key}: not read yet: hidden', (tester) async {
        await _pump(tester, entry.value, const RemoteState<MobRead>(loading: true));
        expect(find.byType(Text), findsNothing);
      });
    }

    test('any 404 on the Mob route is the switch being off, and nothing else is', () {
      expect(mobDisabledError(_disabled), isTrue);
      expect(mobDisabledError(const ApiError(kind: ApiErrorKind.notFound, code: 'not_found', status: 404)), isTrue);
      expect(mobDisabledError(const ApiError(kind: ApiErrorKind.network, code: 'network')), isFalse);
      expect(mobDisabledError(const ApiError(kind: ApiErrorKind.server, code: 'server_error', status: 500)), isFalse);
      expect(mobDisabledError(null), isFalse);
    });
  });

  group('with the switch on (the rig), the entries are there', () {
    testWidgets('You: Start a Mob for a student in none', (tester) async {
      await _pump(tester, const MobHubRow(), noMobState());
      expect(find.text(MobCopy.hubStart), findsOneWidget);
    });

    testWidgets('You: Your Mob for a student in one', (tester) async {
      await _pump(tester, const MobHubRow(), mobState());
      expect(find.text(MobCopy.hubRow), findsOneWidget);
    });

    // D105 (19 Oct): a member has the Mob tab one tap away, so Today keeps no Mob card for them (mob_tab_test).
    testWidgets('Today: no Mob card for a student in one (the Mob tab holds it)', (tester) async {
      await _pump(tester, const MobTodayBlock(), mobState());
      expect(find.byType(MobTodayCard), findsNothing);
    });
  });
}
