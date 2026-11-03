import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth.dart';
import '../data/guest_sample.dart';
import '../data/sample_questions.dart';
import 'onboarding_providers.dart';

/// Where the guest carry-over stands (spec 5.1.5).
///
/// [accepted] is reached only after the server acknowledges. [unavailable] means the server
/// cannot take the import (route missing or the request is not acceptable): the answers stay on
/// this phone and nothing claims they are saved.
enum SampleImportPhase { idle, pending, accepted, failed, unavailable }

class SampleImportState {
  const SampleImportState(this.phase);

  final SampleImportPhase phase;

  bool get showsStatus => phase == SampleImportPhase.pending || phase == SampleImportPhase.accepted || phase == SampleImportPhase.failed;
}

/// After sign-in, writes the chosen subject (`PATCH /api/users/{id}`, subjects only) and sends
/// the five guest answers once (`POST /api/me/sample-import`, idempotent on `importKey`).
///
/// It starts by itself when a signed-in student has a finished, not yet imported sample. Keep it
/// alive by watching it from the app shell or from the first screen after sign-in.
final sampleImportProvider = NotifierProvider<SampleImportController, SampleImportState>(SampleImportController.new);

class SampleImportController extends Notifier<SampleImportState> {
  bool _running = false;
  String? _subjectSyncedFor;

  @override
  SampleImportState build() {
    ref.listen(authSnapshotProvider, (previous, next) {
      if (!next.isSignedIn || previous?.userId != next.userId) {
        // Another account, or signed out: start from a clean slate.
        _subjectSyncedFor = null;
        if (!_running && state.phase != SampleImportPhase.idle) state = const SampleImportState(SampleImportPhase.idle);
      }
      _maybeRun();
    });
    ref.listen(guestSampleProvider, (_, _) => _maybeRun());
    scheduleMicrotask(_maybeRun);
    return const SampleImportState(SampleImportPhase.idle);
  }

  void _maybeRun() {
    if (!ref.mounted || _running) return;
    if (!ref.read(authSnapshotProvider).isSignedIn) return;
    if (state.phase == SampleImportPhase.idle) unawaited(run());
  }

  /// Runs the carry-over. Also the "Try again" action after a failure.
  Future<void> run() async {
    if (_running || !ref.read(authSnapshotProvider).isSignedIn) return;
    _running = true;
    try {
      await _syncSubject();
      await _importSample();
    } finally {
      _running = false;
    }
  }

  /// Writes the chosen subject once per account when the profile has none yet. A failure is
  /// retried on the next run and never blocks the sample import.
  Future<void> _syncSubject() async {
    final auth = ref.read(authSnapshotProvider);
    final guest = await ref.read(guestSampleProvider.future);
    final subject = guest.subject;
    final userId = auth.userId;
    if (subject == null || userId == null || auth.subjects.isNotEmpty || _subjectSyncedFor == userId) return;
    try {
      await ref.read(apiClientProvider).patch('/api/users/${Uri.encodeComponent(userId)}', body: {'subjects': [subject]});
      _subjectSyncedFor = userId;
    } on ApiError {
      // Try again on the next run.
      return;
    }
    // Refresh the profile so the app sees the subject. A failed refresh changes nothing here.
    try {
      await ref.read(authSnapshotProvider.notifier).reload();
    } on Object {
      // The profile loads again on the next launch.
    }
  }

  Future<void> _importSample() async {
    final guest = await ref.read(guestSampleProvider.future);
    if (guest.imported || !guest.isComplete(kSampleQuestionCount) || guest.subject == null) return;
    if (!ref.mounted) return;
    state = const SampleImportState(SampleImportPhase.pending);
    try {
      await _post(guest, guest.importKey ?? await ref.read(guestSampleProvider.notifier).renewImportKey());
    } on ApiError catch (e) {
      if (!ref.mounted) return;
      if (e.status == 409 || e.hasCode('import_key_taken')) {
        // The key is taken by another import: use a fresh one, once.
        try {
          await _post(guest, await ref.read(guestSampleProvider.notifier).renewImportKey());
          return;
        } on ApiError catch (retry) {
          _fail(retry);
          return;
        }
      }
      _fail(e);
    }
  }

  Future<void> _post(GuestSample guest, String importKey) async {
    await ref.read(apiClientProvider).post(
      '/api/me/sample-import',
      body: {
        'importKey': importKey,
        'sampleVersion': 'landing-v1',
        'subject': guest.subject,
        'answers': [
          for (final e in guest.answers.entries) {'sampleQuestionId': e.key, 'optionKey': e.value},
        ],
      },
    );
    // Only now, with the server's acknowledgment in hand, is the sample saved.
    await ref.read(guestSampleProvider.notifier).markImported();
    if (ref.mounted) state = const SampleImportState(SampleImportPhase.accepted);
  }

  void _fail(ApiError e) {
    // A missing route or a request the server will never accept is not worth retrying: the sample
    // stays on this phone and no "saved" line is shown.
    final hopeless = e.status == 404 || e.status == 405 || (e.status == 400 && !e.isRetryable);
    state = SampleImportState(hopeless ? SampleImportPhase.unavailable : SampleImportPhase.failed);
  }
}
