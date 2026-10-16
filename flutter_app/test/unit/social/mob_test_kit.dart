// Shared setup for the Mob widget tests and goldens: the You overrides (Asha, signed in), a
// settled Mob read, a memory prefs store and a recording navigator. No network.

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

final DateTime mobNow = DateTime(2026, 10, 16, 20);

Map<String, dynamic> mobJson() => jsonDecode(File('test/fixtures/social/mob_get_v1.json').readAsStringSync()) as Map<String, dynamic>;

/// The fixture with [edit] applied to its inner `mob` map.
RemoteState<MobRead> mobState([void Function(Map<String, dynamic> mob)? edit]) {
  final j = mobJson();
  edit?.call(j['mob'] as Map<String, dynamic>);
  return RemoteState(value: MobRead.fromJson(j), fetchedAt: mobNow);
}

RemoteState<MobRead> noMobState() => RemoteState(value: const MobRead(null), fetchedAt: mobNow);

/// [sat] of [size] members sat, in join order; the student is the first member.
RemoteState<MobRead> ringState(int sat, int size, {bool youSat = true}) => mobState((m) {
      const names = ['Asha', 'Riya', 'Kabir', 'Dev', 'Meera'];
      m['members'] = [
        for (var i = 0; i < size; i++) {'memberId': 'm$i', 'name': names[i], 'colour': i * 2 % 8, 'you': i == 0, 'sat': i < sat},
      ];
      final week = m['week'] as Map<String, dynamic>;
      week['sat'] = sat;
      week['size'] = size;
      week['youSat'] = youSat && sat > 0;
      if (sat < 3) m['trap'] = null;
    });

class RecordingNavigator implements MobNavigator {
  final List<String> calls = [];

  @override
  Future<MobFailure?> sitPaper(BuildContext context, WidgetRef ref, Mob mob) async {
    calls.add('sit');
    return null;
  }

  @override
  void openAnswers(BuildContext context, String resultId) => calls.add('answers:$resultId');

  @override
  void openTrap(BuildContext context, MobTrap trap) => calls.add('trap:${trap.questionNumber}');

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
  FakeMobActions(super.ref, {this.previewResult, this.failure});

  final (MobInvitePreview?, MobFailure?)? previewResult;
  final MobFailure? failure;
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
  Future<void> nudgeSeen() async => calls.add('seen');

  @override
  MobWrite updateMe({String? name, int? colour, bool? showScore, bool? nudgesMuted}) async {
    calls.add('me:$showScore:$nudgesMuted');
    return failure;
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
