import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/storage/prefs_store.dart';
import '../data/guest_sample.dart';
import '../data/sample_questions.dart';

/// Where the guest sample is kept on this phone. Replaced in tests.
final guestSampleStoreProvider = Provider<GuestSampleStore>((ref) => GuestSampleStore(SharedPrefsStore()));

/// Loads the bundled sample JSON. Replaced in tests, which read the file from disk.
final sampleSourceProvider = Provider<Future<String> Function()>(
  (ref) => () => rootBundle.loadString('assets/sample/sample_questions.json'),
);

/// The five bundled questions. No network call is needed.
final sampleSetProvider = FutureProvider<SampleSet>((ref) async => SampleSet.parse(await ref.watch(sampleSourceProvider)()));

/// The guest's subject and answers, persisted on every change.
final guestSampleProvider = AsyncNotifierProvider<GuestSampleController, GuestSample>(GuestSampleController.new);

class GuestSampleController extends AsyncNotifier<GuestSample> {
  static const _uuid = Uuid();

  @override
  Future<GuestSample> build() => ref.read(guestSampleStoreProvider).load();

  Future<void> _write(GuestSample next) async {
    state = AsyncData(next);
    await ref.read(guestSampleStoreProvider).save(next);
  }

  Future<void> chooseSubject(String subjectId) async {
    final current = await future;
    await _write(current.copyWith(subject: subjectId, importKey: current.importKey ?? _uuid.v4()));
  }

  /// Records an answer. A question answered once keeps its first answer, so going back never
  /// changes what the sample shows.
  Future<void> answer(String questionId, String optionKey) async {
    final current = await future;
    if (current.answers.containsKey(questionId)) return;
    await _write(current.copyWith(
      importKey: current.importKey ?? _uuid.v4(),
      answers: {...current.answers, questionId: optionKey},
    ));
  }

  /// Only after the server acknowledged the import.
  Future<void> markImported() async => _write((await future).copyWith(imported: true));

  /// A fresh key, when the server says the old one belongs to another import.
  Future<String> renewImportKey() async {
    final key = _uuid.v4();
    await _write((await future).copyWith(importKey: key));
    return key;
  }
}
