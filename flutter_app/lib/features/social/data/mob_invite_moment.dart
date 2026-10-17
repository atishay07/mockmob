// Today's one-time invitation to the Mob, for a student in no Mob, at the moment it is useful (the
// website's rule, src/components/mob/MobEntry.jsx): after a study week met, or 7 saved sessions.
// Inline on Today, never a pop-up, dismissable for good, and gone 7 days after it first showed. The
// memory is a per-viewer convenience on this phone: losing it shows the line once more at worst.

import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/attempt.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/repositories/rhythm_repository.dart';
import '../logic/mob_entry.dart';
import 'mob_repository.dart';

const String _inviteKey = 'mob.invite.line';

/// The true reason to invite, in words, or null: nothing to say yet. Reads only what Today already
/// holds (the rhythm and the attempts list), and starts no read of its own.
final mobInviteReasonProvider = Provider<String?>((ref) {
  final rhythm = ref.watch(rhythmRepositoryProvider.select((s) => s.value));
  final attempts = ref.watch(attemptsRepositoryProvider.select((s) => s.value));
  final weekMet = rhythm != null && (rhythm.metThisWeek || rhythm.weeksMetStreak >= 1 || (rhythm.history?.any((w) => w.met) ?? false));
  // Server-scored sessions with 5 or more answers: the same count the milestones use.
  final sessions = attempts == null ? 0 : attempts.where((Attempt a) => a.selectionMeta.isServerScored && a.correct + a.wrong >= 5).length;
  return mobInviteMoment(weekMet: weekMet, sessions: sessions);
});

/// Whether the invitation may show now, and the one memory behind it: `{ first, done }`.
class MobInviteMemory {
  MobInviteMemory(this.ref);

  final Ref ref;

  Map<String, dynamic> _decode(String? raw) {
    if (raw == null || raw.isEmpty) return {};
    try {
      final j = jsonDecode(raw);
      return j is Map<String, dynamic> ? j : {};
    } on Object {
      return {};
    }
  }

  Future<void> _write(Map<String, dynamic> v) async {
    try {
      await ref.read(mobPrefsStoreProvider).setString(_inviteKey, jsonEncode(v));
    } on Object {
      // The line shows again next time.
    }
  }

  /// True while the invitation is still wanted. The first time it is asked for starts its 7 days.
  Future<bool> visible(DateTime now) async {
    Map<String, dynamic> v;
    try {
      v = _decode(await ref.read(mobPrefsStoreProvider).getString(_inviteKey));
    } on Object {
      v = {};
    }
    if (v['done'] == true) return false;
    final first = v['first'] is int ? v['first'] as int : null;
    if (first == null) {
      await _write({'first': now.millisecondsSinceEpoch});
      return true;
    }
    if (now.millisecondsSinceEpoch - first > mobInviteLife.inMilliseconds) {
      await _write({'first': first, 'done': true});
      return false;
    }
    return true;
  }

  /// "Start a Mob" or "Not now": the line does not come back.
  Future<void> done(DateTime now) async {
    Map<String, dynamic> v;
    try {
      v = _decode(await ref.read(mobPrefsStoreProvider).getString(_inviteKey));
    } on Object {
      v = {};
    }
    await _write({'first': v['first'] ?? now.millisecondsSinceEpoch, 'done': true});
  }
}

final mobInviteMemoryProvider = Provider<MobInviteMemory>(MobInviteMemory.new);
