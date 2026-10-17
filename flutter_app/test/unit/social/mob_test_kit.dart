// Shared setup for the Mob widget tests and goldens: the You overrides (Asha, signed in), a
// settled Mob read from the server's own fixtures (test/fixtures/mob, copied byte for byte from the
// website's data/tests/fixtures/mob), a memory prefs store and a recording navigator. No network.

import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/data/mob_navigator.dart';
import 'package:mockmob/features/social/data/mob_repository.dart';

import '../you/you_test_support.dart';

final DateTime mobNow = DateTime.utc(2026, 10, 16, 14, 30);

Map<String, dynamic> mobFixture(String name) => jsonDecode(File('test/fixtures/mob/$name').readAsStringSync()) as Map<String, dynamic>;

/// A fixture's `mob` map, as a deep copy the caller may edit.
Map<String, dynamic> mobJson([String name = 'get_v1.json']) => jsonDecode(jsonEncode(mobFixture(name))) as Map<String, dynamic>;

/// The fixture with [edit] applied to its inner `mob` map.
RemoteState<MobRead> mobState([void Function(Map<String, dynamic> mob)? edit, String fixture = 'get_v1.json']) {
  final j = mobJson(fixture);
  edit?.call(j['mob'] as Map<String, dynamic>);
  return RemoteState(value: MobRead.fromJson(j), fetchedAt: mobNow);
}

RemoteState<MobRead> noMobState() => RemoteState(value: const MobRead(null), fetchedAt: mobNow);

/// [sat] of [size] members sat, in join order; the student is the first member. A Free student.
RemoteState<MobRead> ringState(int sat, int size, {bool youSat = true}) => mobState((m) {
      const names = ['Asha', 'Riya', 'Kabir', 'Dev', 'Meera'];
      m['members'] = [
        for (var i = 0; i < size; i++) {'memberId': 'M${i}ABCDEF1234'.substring(0, 12).padRight(12, '0'), 'name': names[i], 'colour': i * 2 % 8, 'you': i == 0, 'sat': i < sat},
      ];
      (m['you'] as Map<String, dynamic>)['memberId'] = (m['members'] as List).first['memberId'];
      final week = m['week'] as Map<String, dynamic>;
      week['sat'] = sat;
      week['size'] = size;
      week['youSat'] = youSat && sat > 0;
      week['yourResultId'] = youSat && sat > 0 ? 'practice_u2' : null;
      (week['paper'] as Map<String, dynamic>)['cost'] = youSat && sat > 0 ? null : {'type': 'free'};
      m['seatsLeft'] = 5 - size;
      m['trap'] = null;
      m['compare'] = null;
      m['invite'] = size == 5 ? null : (m['invite']);
      m['nudge'] = {'canSend': false, 'reason': size == 1 ? 'not_sat' : (sat == size ? 'everyone_sat' : 'sent'), 'received': null};
    });

/// A Pro student with two Mobs and extra papers (the server's get_pro_v2 fixture).
RemoteState<MobRead> proState([void Function(Map<String, dynamic> mob)? edit]) => mobState(edit, 'get_pro_v2.json');

class RecordingNavigator implements MobNavigator {
  final List<String> calls = [];

  @override
  Future<MobFailure?> sitPaper(BuildContext context, WidgetRef ref, Mob mob, {MobExtra? extra}) async {
    calls.add(extra == null ? 'sit' : 'sit:${extra.id}');
    return null;
  }

  @override
  void openAnswers(BuildContext context, String resultId) => calls.add('answers:$resultId');

  @override
  void openTrap(BuildContext context, MobTrap trap, {String? resultId}) => calls.add('trap:${trap.questionNumber}:${resultId ?? '-'}');

  @override
  Future<bool> copyLink(String url) async {
    calls.add('copy:$url');
    return true;
  }

  @override
  Future<bool> shareLink(String text) async {
    calls.add('share');
    return true;
  }
}

class FakeMobActions extends MobActions {
  FakeMobActions(super.ref, {this.previewResult, this.failure, this.compareResult, this.compareFailure, this.historyResult});

  final (MobInvitePreview?, MobFailure?)? previewResult;
  final MobFailure? failure;
  final MobCompare? compareResult;
  final MobFailure? compareFailure;
  final MobHistory? historyResult;
  final List<String> calls = [];

  @override
  Future<(MobInvitePreview?, MobFailure?)> preview(String code) async => previewResult ?? (null, MobFailure.inviteInvalid);

  @override
  MobWrite nudge() async {
    calls.add('nudge');
    return failure;
  }

  @override
  MobWrite create({required String subject, required String name, required int colour}) async {
    calls.add('create:$subject:$name:$colour');
    return failure;
  }

  @override
  MobWrite join({required String code, required String name, required int colour}) async {
    calls.add('join:$code:$name:$colour');
    return failure;
  }

  @override
  Future<void> nudgeSeen() async => calls.add('seen');

  @override
  MobWrite updateMe({String? name, int? colour, bool? showScore, bool? nudgesMuted}) async {
    calls.add('me:$showScore:$nudgesMuted');
    return failure;
  }

  @override
  MobWrite leave({String? block}) async {
    calls.add('leave:${block ?? '-'}');
    return failure;
  }

  @override
  Future<(String?, MobFailure?)> createExtra({String? chapter, required int count}) async {
    calls.add('extra:${chapter ?? '-'}:$count');
    return (failure == null ? 'new-extra' : null, failure);
  }

  @override
  Future<(MobCompare?, MobFailure?)> compare({String? week, String? extra}) async {
    calls.add('compare:${week ?? '-'}:${extra ?? '-'}');
    return (compareFailure == null ? compareResult : null, compareFailure);
  }

  @override
  Future<(MobHistory?, MobFailure?)> history() async {
    calls.add('history');
    return (historyResult, historyResult == null ? MobFailure.generic : null);
  }
}

List<Override> mobOverrides(
  RemoteState<MobRead> state, {
  RecordingNavigator? nav,
  FakeMobActions Function(Ref ref)? actions,
  DateTime? now,
}) =>
    [
      ...youOverrides(now: now ?? mobNow),
      mobRepositoryProvider.overrideWithBuild((ref, n) => state),
      mobPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      mobNavigatorProvider.overrideWithValue(nav ?? RecordingNavigator()),
      mobActionsProvider.overrideWith((ref) => actions?.call(ref) ?? FakeMobActions(ref)),
    ];
