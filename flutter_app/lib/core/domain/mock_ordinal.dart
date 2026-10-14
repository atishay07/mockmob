import '../models/attempt.dart';

int _byTime(Attempt a, Attempt b) {
  final t = a.completedAt.compareTo(b.completedAt);
  return t != 0 ? t : a.id.compareTo(b.id);
}

/// "Mock 7" is the count of the student's attempts in the same subject whose mode is `full`
/// or `nta`, ordered by completion time, up to and including [attempt]. Quick practice never
/// takes a number, so this returns null for it. (`first_mock` is ordinal 1, not
/// `attempts.length == 1`, because the attempts list also holds Quick practice.)
///
/// [listLoaded] is false while the attempts list has not loaded. An absent attempt then has no
/// knowable number, so this returns null instead of counting from an empty list (which would
/// label a later mock "Mock 1" and make it the first mock).
int? mockOrdinal(Iterable<Attempt> attempts, Attempt attempt, {bool listLoaded = true}) {
  if (!attempt.isMock) return null;
  final mocks = attempts.where((a) => a.isMock && a.subject == attempt.subject).toList()..sort(_byTime);
  final index = mocks.indexWhere((a) => a.id == attempt.id);
  if (index >= 0) return index + 1;
  if (!listLoaded) return null;
  // The attempt is not in the list yet (just submitted): it comes after everything earlier.
  return mocks.where((a) => _byTime(a, attempt) < 0).length + 1;
}

/// The number for a mock about to start: finished full or NTA-style attempts in that subject
/// plus one. [internalSubject] is the attempt-side subject id (`subjects[].internalId`).
int nextMockNumber(Iterable<Attempt> attempts, String internalSubject) =>
    attempts.where((a) => a.isMock && a.subject == internalSubject).length + 1;

/// True for the student's first full or NTA-style mock in that subject (the `first_mock` variant).
bool isFirstMock(Iterable<Attempt> attempts, Attempt attempt, {bool listLoaded = true}) =>
    mockOrdinal(attempts, attempt, listLoaded: listLoaded) == 1;
