import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/domain/domain.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/core/repositories/repositories.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/notifications/services/notification_providers.dart' show prePromptDueProvider;
import 'package:mockmob/features/result/copy.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/model/recap_model.dart';
import 'package:mockmob/features/result/model/recap_variant.dart';

import '../notifications/support.dart';
import '../notifications/widget_support.dart';
import 'support/fixtures.dart';

class _Attempts extends AttemptsRepository {
  _Attempts(this.initial);

  final RemoteState<List<Attempt>> initial;

  @override
  RemoteState<List<Attempt>> build() => initial;

  @override
  Future<void> refresh({bool force = false}) async {}
}

class _Detail extends AttemptDetailRepository {
  _Detail(super.attemptId, this.value);

  final AttemptDetail value;

  @override
  RemoteState<AttemptDetail> build() => RemoteState(value: value, fetchedAt: DateTime.utc(2026, 10, 12, 17, 14));

  @override
  Future<void> refresh({bool force = false}) async {}
}

class _Rhythm extends RhythmRepository {
  _Rhythm(this.milestones);

  final List<RhythmMilestone> milestones;

  @override
  RemoteState<Rhythm> build() => RemoteState(
    value: Rhythm(
      timeZone: 'Asia/Kolkata',
      weekStart: '2026-10-12',
      studyDays: 1,
      studyDayDates: const ['2026-10-12'],
      daysGoal: 4,
      metThisWeek: false,
      paused: false,
      weeksMetStreak: 0,
      bestRun: 0,
      milestones: milestones,
    ),
    fetchedAt: DateTime.utc(2026, 10, 12, 17, 14),
  );

  @override
  Future<void> refresh({bool force = false}) async {}
}

void main() {
  final earned = RhythmMilestone(id: 'first_full_mock', achievedAt: DateTime.utc(2026, 10, 12, 17, 14));
  final d = detail();

  group('result-01: an attempts list that is not loaded never numbers a mock', () {
    test('mockOrdinal returns null for an attempt absent from a list that has not loaded', () {
      expect(mockOrdinal(const [], d.attempt, listLoaded: false), isNull);
      // A loaded, empty list is a real fact: the first mock the student ever finished.
      expect(mockOrdinal(const [], d.attempt), 1);
      // A present attempt keeps its place whatever the flag says.
      expect(mockOrdinal([...history(), d.attempt], d.attempt, listLoaded: false), 7);
    });

    test('a later mock built before the list loads is not the first mock and carries no token', () {
      final m = buildRecapModel(attempt: d.attempt, detail: d, attempts: const [], attemptsLoaded: false, milestones: [earned]);
      expect(m.ordinal, isNull);
      expect(m.variant, isNot(RecapVariant.firstMock));
      expect(m.firstMockTokenAt, isNull);
    });

    test('the same mock with its earlier papers loaded is Mock 7 with no first-mock token', () {
      final m = mock7(milestones: [earned]);
      expect(m.ordinal, 7);
      expect(m.variant, isNot(RecapVariant.firstMock));
      expect(m.firstMockTokenAt, isNull);
    });

    ProviderContainer container(RemoteState<List<Attempt>> list) => ProviderContainer(
      overrides: [
        attemptsRepositoryProvider.overrideWith(() => _Attempts(list)),
        attemptDetailProvider('a7').overrideWith(() => _Detail('a7', d)),
        resultReceivedProvider('a7').overrideWith((ref) async => null),
        rhythmRepositoryProvider.overrideWith(() => _Rhythm([earned])),
        creditsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<AiCredits>()),
        userIdProvider.overrideWithValue('u1'),
        repairLocalRecordsProvider.overrideWith((ref) => Stream.value(const [])),
      ],
    );

    test('recapDataProvider builds no model while the list is loading, and keeps the placeholder', () {
      final c = container(const RemoteState(loading: true));
      addTearDown(c.dispose);
      final data = c.read(recapDataProvider('a7'));
      expect(data.model, isNull);
      expect(data.loading, isTrue);
      expect(data.error, isNull);
      expect(data.attempt, isNotNull, reason: 'the detail is known, only the numbering is not');
    });

    test('a failed, empty list shows the error instead of a guessed number', () {
      final c = container(const RemoteState(error: ApiError(kind: ApiErrorKind.network, code: 'network')));
      addTearDown(c.dispose);
      final data = c.read(recapDataProvider('a7'));
      expect(data.model, isNull);
      expect(data.error, isNotNull);
      expect(data.loading, isFalse);
    });

    test('once the list has a value the model is Mock 7, not the first mock', () {
      final c = container(RemoteState(value: [...history(), d.attempt], fetchedAt: DateTime.utc(2026, 10, 12, 17, 14)));
      addTearDown(c.dispose);
      final m = c.read(recapDataProvider('a7')).model!;
      expect(m.ordinal, 7);
      expect(m.variant, isNot(RecapVariant.firstMock));
      expect(m.firstMockTokenAt, isNull);
    });

    test('a first mock with a loaded list that holds only itself is still the first mock', () {
      final c = container(RemoteState(value: [d.attempt], fetchedAt: DateTime.utc(2026, 10, 12, 17, 14)));
      addTearDown(c.dispose);
      final m = c.read(recapDataProvider('a7')).model!;
      expect(m.ordinal, 1);
      expect(m.variant, RecapVariant.firstMock);
      expect(m.firstMockTokenAt, DateTime.utc(2026, 10, 12, 17, 14).toLocal());
    });
  });

  group('result-06: a time is shown only when the server acknowledgement is on this phone', () {
    test('no acknowledgement row gives no time, only the plain fact', () {
      final noAck = buildRecapModel(attempt: d.attempt, detail: d, attempts: [...history(), d.attempt]);
      expect(noAck.receivedAt, isNull);
      expect(ResultCopy.receiptLine(noAck.receivedAt), 'Marked on the server.');
      final acked = mock7();
      expect(acked.receivedAt, isNotNull);
      expect(ResultCopy.receiptLine(acked.receivedAt), startsWith('Saved on the server at '));
    });
  });

  group('result-07: no credits reads as none, not as a zero count', () {
    test('balance 0', () {
      expect(
        ResultCopy.walletShort(3, 0),
        'This repair needs 3 explanation credits. You have none. Read the key explanations in Review.',
      );
      expect(ResultCopy.walletShort(3, 0), isNot(contains('0 mistakes')));
    });

    test('balance 1 or more keeps the covered count', () {
      expect(
        ResultCopy.walletShort(3, 1),
        'This repair needs 3 explanation credits. You have 1. Start with 1 mistake, or read the key explanations in Review.',
      );
    });
  });

  group('notifications-02: one policy governs the recap reminder row', () {
    late Rig rig;
    late FakePermissionRequester permission;
    late AppPrefs prefs;
    late ProviderContainer c;

    setUp(() {
      rig = Rig(prefs: prefsWith());
      permission = FakePermissionRequester(NotificationPermission.notAsked);
      prefs = AppPrefs(MemoryPrefsStore());
      c = ProviderContainer(overrides: featureOverrides(rig: rig, repo: FakePrefsRepo(null), permission: permission, appPrefs: prefs));
    });

    tearDown(() => c.dispose());

    test('Not now from the recap counts like the sheet: the time, the count, then 14 days of quiet', () async {
      expect(await c.read(reminderOfferProvider.future), isTrue);

      await c.read(resultActionsProvider).declineReminder();
      expect((await prefs.lastPrePromptAt())!.isAtSameMomentAs(rig.now), isTrue);
      expect((await rig.store.load()).prePromptNotNowCount, 1);

      c.invalidate(reminderOfferProvider);
      expect(await c.read(reminderOfferProvider.future), isFalse, reason: 'put off today: not asked again on the next open');

      rig.now = rig.now.add(const Duration(days: 14));
      c.invalidate(prePromptDueProvider); // a later visit: the providers are built afresh
      expect(await c.read(reminderOfferProvider.future), isTrue, reason: 'back once, after 14 days');

      await c.read(resultActionsProvider).declineReminder();
      rig.now = rig.now.add(const Duration(days: 60));
      c.invalidate(prePromptDueProvider);
      expect(await c.read(reminderOfferProvider.future), isFalse, reason: 'two Not nows: never again from either entry point');
    });

    test('a student who already answered the system question is not offered the row', () async {
      permission.current = NotificationPermission.denied;
      expect(await c.read(reminderOfferProvider.future), isFalse);
    });
  });
}
