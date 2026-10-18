// The five fixes of the Mob's 18 Oct gate (server branch web/mob-fix-1017, e89d4a35) as the app shows
// them, with the server's own fixtures and exact error bodies:
//   1  the member menu is a 44 dp target (the switch rows too)
//   2  a Pro student at their cap hears the plan's sentence (MOB_LIMIT_PRO), never a wait
//   3  a member who keeps their answers private is in neither the counts nor the split, and the
//      counts say who they cover ("How you and the members who share picked")
//   4  a failed join counts for nothing: one request, no retry, no read after it, and a rate limit
//      speaks the server's own wait
//   5  (server only: the /mob page switch; the app's own switch is mob_disabled_entries_test)
// Plus EXTRA_ALREADY_SAT, the one code the app lacked.

import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/data/mob_repository.dart';
import 'package:mockmob/features/social/screens/mob_compare_screen.dart';
import 'package:mockmob/features/social/screens/mob_screen.dart';
import 'package:mockmob/features/social/widgets/mob_parts.dart';

import '../../helpers/golden_harness.dart';
import '../core_data/support/fakes.dart';
import 'mob_test_kit.dart';

MobCompare _compare([void Function(Map<String, dynamic>)? edit]) {
  final j = mobJson('compare_v2.json');
  edit?.call(j['compare'] as Map<String, dynamic>);
  return MobCompare.fromJson(j);
}

/// The server's `hidden` case (previewMob ?mob=partial): a fourth sitter keeps answers private, so
/// `hidden` is 1 and `sat` one more; the counts stay over the rows you can read.
MobCompare _partial() => _compare((c) {
      c['hidden'] = 1;
      c['sat'] = (c['sat'] as int) + 1;
    });

/// 3 sitters, one private: only you and one other are readable, so the server sends no counts and no split.
MobCompare _twoReadable() => _compare((c) {
      c['hidden'] = 1;
      for (final q in c['questions'] as List) {
        (q as Map<String, dynamic>)
          ..['picks'] = null
          ..['split'] = null;
        // The private member is not a row: only one other remains.
        (q['others'] as List).removeLast();
      }
    });

Future<void> _pump(WidgetTester tester, Widget child, RemoteState<MobRead> state, {Size size = const Size(390, 3600)}) async {
  await pumpMockmob(
    tester,
    child,
    size: size,
    wrapInScaffold: false,
    disableAnimations: true,
    overrides: mobOverrides(state),
  );
  await tester.pumpAndSettle();
}

class _CountingRepo extends MobRepository {
  static int refreshes = 0;

  @override
  RemoteState<MobRead> build() => RemoteState(value: MobRead.fromJson(mobFixture('get_pro_v2.json')), fetchedAt: DateTime.utc(2026, 10, 18));

  @override
  Future<void> refresh({bool force = false}) async {
    refreshes += 1;
  }
}

void main() {
  group('fix 1: 44 dp targets', () {
    testWidgets('a member\'s menu button is at least 44 x 44', (tester) async {
      await _pump(tester, const MobScreen(), mobState());
      final button = find.byTooltip(MobCopy.memberMenu('Riya'));
      expect(button, findsOneWidget);
      final size = tester.getSize(button);
      expect(size.width, greaterThanOrEqualTo(44));
      expect(size.height, greaterThanOrEqualTo(44));
    });

    testWidgets('the member menu keys are tall enough to tap', (tester) async {
      await _pump(tester, const MobScreen(), mobState());
      await tester.tap(find.byTooltip(MobCopy.memberMenu('Riya')));
      await tester.pumpAndSettle();
      for (final label in [MobCopy.report, MobCopy.leaveAndBlock]) {
        final size = tester.getSize(find.ancestor(of: find.text(label), matching: find.byType(ConstrainedBox)).first);
        expect(size.height, greaterThanOrEqualTo(44), reason: label);
      }
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    });

    testWidgets('the switch rows are a 44 dp or taller box', (tester) async {
      await _pump(tester, const MobScreen(), mobState());
      for (final title in [MobCopy.shareLabel, MobCopy.muteNudges]) {
        final row = find.ancestor(of: find.text(title), matching: find.byType(MobSwitchRow)).first;
        expect(tester.getSize(row).height, greaterThanOrEqualTo(44), reason: title);
      }
    });
  });

  group('fix 2: Pro at its cap', () {
    RemoteState<MobRead> capped() => proState((m) {
          (m['plan'] as Map<String, dynamic>)
            ..['started'] = 3
            ..['mobCount'] = 3
            ..['canStartAnother'] = false;
        });

    test('the plan reads as at its cap only for Pro with every start used', () {
      expect(capped().value!.mob!.plan.atProCap, isTrue);
      expect(proState().value!.mob!.plan.atProCap, isFalse);
      expect(mobState().value!.mob!.plan.atProCap, isFalse);
      // Older servers send no `started`: the app does not guess.
      final noStarted = proState((m) => (m['plan'] as Map<String, dynamic>)..remove('started')..['canStartAnother'] = false);
      expect(noStarted.value!.mob!.plan.atProCap, isFalse);
    });

    testWidgets('no start key, and the plan\'s own sentence where it would be, selling nothing', (tester) async {
      await _pump(tester, const MobScreen(), capped());
      expect(find.text(MobCopy.startAnother), findsNothing);
      expect(find.text(MobCopy.proCapLine), findsOneWidget);
      expect(find.text(MobCopy.proLine), findsNothing);
      expect(MobCopy.proCapLine, MobCopy.failure(MobFailure.mobLimitPro));
    });

    testWidgets('a Pro student under the cap sees neither line', (tester) async {
      await _pump(tester, const MobScreen(), proState());
      expect(find.text(MobCopy.proCapLine), findsNothing);
      expect(find.text(MobCopy.proLine), findsNothing);
      expect(find.text(MobCopy.startAnother), findsOneWidget);
    });

    test('MOB_LIMIT_PRO is the server\'s sentence, is not an upsell, and reads the plan again', () async {
      final body = (errorsFixture['MOB_LIMIT_PRO'] as Map<String, dynamic>)['body'];
      _CountingRepo.refreshes = 0;
      final http = FakeHttpAdapter()..handler = (o) => FakeReply(409, body);
      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWithValue(newApiClient(http)),
        mobRepositoryProvider.overrideWith(_CountingRepo.new),
        mobPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      ]);
      addTearDown(container.dispose);
      final actions = container.read(mobActionsProvider);
      final f = await actions.create(subject: 'economics', name: 'Asha', colour: 0);
      expect(f, MobFailure.mobLimitPro);
      expect(actions.say(f!), (body['error'] as Map)['message']);
      expect(f.needsPro, isFalse, reason: 'a Pro student is never sent to Pro');
      expect(_CountingRepo.refreshes, 1, reason: 'the start key the page drew is out of date');
    });
  });

  group('fix 3: a private member is in neither the counts nor the split', () {
    testWidgets('with a member who keeps answers private the counts say who they cover', (tester) async {
      await _pump(tester, MobCompareScreen(data: _partial()), mobState(), size: const Size(390, 4800));
      expect(find.text('4 of 4 sat. 1 member keeps their answers private.'), findsOneWidget);
      const picks = [MobPickCount(option: 'B', count: 3)];
      expect(find.text(MobCopy.howPicked(picks, partial: true)), findsNWidgets(2));
      expect(find.text('How you and the members who share picked: B 3.'), findsNWidgets(2));
      expect(find.textContaining('How your Mob picked'), findsNothing);
    });

    testWidgets('with nobody private the counts still say "your Mob"', (tester) async {
      await _pump(tester, MobCompareScreen(data: _compare()), mobState(), size: const Size(390, 4800));
      expect(find.textContaining('How your Mob picked'), findsWidgets);
      expect(find.textContaining('How you and the members who share'), findsNothing);
    });

    testWidgets('two readable sitters: no counts and no Split tag, the private member never named', (tester) async {
      await _pump(tester, MobCompareScreen(data: _twoReadable()), mobState(), size: const Size(390, 4800));
      expect(find.textContaining('How your Mob picked'), findsNothing);
      expect(find.textContaining('How you and the members who share'), findsNothing);
      expect(find.text(MobCopy.split), findsNothing);
      expect(find.text('Kabir'), findsNothing, reason: 'the private member is only counted');
      expect(find.text('3 of 4 sat. 1 member keeps their answers private.'), findsOneWidget);
    });

    testWidgets('a student who keeps their own answers private sees no one else\'s row', (tester) async {
      final data = _compare((c) {
        c['youShare'] = false;
        c['hidden'] = 2;
        for (final q in c['questions'] as List) {
          (q as Map<String, dynamic>)
            ..['others'] = <Object>[]
            ..['picks'] = null
            ..['split'] = null;
        }
      });
      await _pump(tester, MobCompareScreen(data: data), mobState(), size: const Size(390, 4800));
      expect(find.text('Riya'), findsNothing);
      expect(find.text('Kabir'), findsNothing);
      expect(find.text('3 of 4 sat. 2 members keep their answers private.'), findsOneWidget);
    });
  });

  group('fix 4: a failed join counts for nothing', () {
    late FakeHttpAdapter http;
    late ProviderContainer container;
    late List<String> sent;

    setUp(() {
      http = FakeHttpAdapter();
      sent = [];
      container = ProviderContainer(overrides: [
        apiClientProvider.overrideWithValue(newApiClient(http)),
        mobRepositoryProvider.overrideWith(_CountingRepo.new),
        mobPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      ]);
      addTearDown(container.dispose);
      _CountingRepo.refreshes = 0;
    });

    test('a wrong code is one request with no retry and no read after it', () async {
      http.handler = (RequestOptions o) {
        sent.add('${o.method} ${Uri.parse(o.path).path}');
        return FakeReply(404, (errorsFixture['INVITE_INVALID'] as Map<String, dynamic>)['body']);
      };
      final f = await container.read(mobActionsProvider).join(code: '7KQ2M9XR', name: 'Asha', colour: 1);
      expect(f, MobFailure.inviteInvalid);
      expect(sent, ['POST /api/mob/join']);
      expect(_CountingRepo.refreshes, 0);
    });

    test('a block reads exactly like a wrong code (no tell)', () async {
      http.handler = (o) => FakeReply(404, (errorsFixture['INVITE_INVALID'] as Map<String, dynamic>)['body']);
      final a = await container.read(mobActionsProvider).join(code: '7KQ2M9XR', name: 'Asha', colour: 1);
      expect(MobCopy.failure(a!), MobCopy.failure(MobFailure.inviteExpired));
    });

    test('the join limit speaks the server\'s own wait, and one try is still one request', () async {
      const message = 'That was a lot of tries to join in an hour. You can try again in 25 minutes.';
      http.handler = (RequestOptions o) {
        sent.add('${o.method} ${Uri.parse(o.path).path}');
        return const FakeReply(429, {'error': {'code': 'RATE_LIMITED', 'message': message}}, {'retry-after': '1500'});
      };
      final actions = container.read(mobActionsProvider);
      final f = await actions.join(code: '7KQ2M9XR', name: 'Asha', colour: 1);
      expect(f, MobFailure.rateLimited);
      expect(actions.say(f!), message);
      expect(sent, hasLength(1));
    });
  });

  group('the page says each thing once', () {
    testWidgets('the nudge reason is one line, not two', (tester) async {
      await _pump(tester, const MobScreen(), ringState(3, 5));
      expect(find.text(MobCopy.nudgeSentReason), findsOneWidget);
    });

    final extras = (mobJson('get_pro_v2.json')['mob'] as Map<String, dynamic>)['extras'];

    testWidgets('a free student sees the extras are open to every member', (tester) async {
      await _pump(tester, const MobScreen(), mobState((m) => m['extras'] = extras), size: const Size(390, 4200));
      expect(find.text(MobCopy.extrasOpenToAll), findsOneWidget);
    });

    testWidgets('Pro does not need the line', (tester) async {
      await _pump(tester, const MobScreen(), proState(), size: const Size(390, 4200));
      expect(find.text(MobCopy.extrasOpenToAll), findsNothing);
    });

    testWidgets('a free student with no extras sees neither the line nor the section', (tester) async {
      await _pump(tester, const MobScreen(), mobState(), size: const Size(390, 4200));
      expect(find.text(MobCopy.extrasOpenToAll), findsNothing);
      expect(find.text(MobCopy.extrasTitle), findsNothing);
    });
  });

  group('EXTRA_ALREADY_SAT', () {
    test('the app knows the code and says the server\'s sentence', () {
      final message = (((errorsFixture['EXTRA_ALREADY_SAT'] as Map<String, dynamic>)['body'] as Map)['error'] as Map)['message'];
      expect(MobFailure.fromCode('EXTRA_ALREADY_SAT'), MobFailure.extraAlreadySat);
      expect(MobCopy.failure(MobFailure.extraAlreadySat), message);
    });
  });
}

final Map<String, dynamic> errorsFixture = jsonDecode(File('test/fixtures/mob/errors_v1.json').readAsStringSync()) as Map<String, dynamic>;
