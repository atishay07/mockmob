import 'package:drift/drift.dart';

// Every row carries `userId` (the MockMob user id) so a different account on the same phone
// never sees or sends another account's data.

/// Append-only session events, written before the UI shows an answer selected.
@DataClassName('JournalRow')
class AnswerJournal extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get userId => text()();
  TextColumn get sessionId => text()();
  IntColumn get seq => integer()();
  TextColumn get qid => text()();

  /// `visit`, `answer`, `mark`, `strike`, `away`, `back` or `end`.
  TextColumn get type => text()();
  IntColumn get atMs => integer()();

  /// For `answer` events the option, null when the answer was cleared. The newer types pack their
  /// own field here (SessionJournal.encodeStored): a visit's via, a mark, a strike, an end reason.
  IntColumn get answer => integer().nullable()();
  IntColumn get createdAtMs => integer()();

  @override
  List<Set<Column>> get uniqueKeys => [
        {sessionId, seq},
      ];
}

/// Writes waiting for the network, each with an idempotency key reused across retries.
@DataClassName('OutboxRow')
class Outbox extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get userId => text()();
  TextColumn get kind => text()();
  TextColumn get idempotencyKey => text().unique()();
  TextColumn get method => text()();
  TextColumn get path => text()();
  TextColumn get bodyJson => text().nullable()();
  IntColumn get createdAtMs => integer()();
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  IntColumn get nextAttemptAtMs => integer().withDefault(const Constant(0))();

  /// Machine code of the last failure, never server text.
  TextColumn get lastErrorCode => text().nullable()();
}

/// One in-progress or just-ended mock or practice session per draft key.
@DataClassName('SessionDraftRow')
class SessionDrafts extends Table {
  TextColumn get draftKey => text()();
  TextColumn get userId => text()();
  TextColumn get sessionId => text()();
  TextColumn get generationKey => text()();
  TextColumn get payloadJson => text()();

  /// Wall-clock deadline, used only to decide whether a draft is still resumable after a kill.
  IntColumn get endsAtMs => integer()();
  BoolColumn get pendingSubmission => boolean().withDefault(const Constant(false))();
  IntColumn get updatedAtMs => integer()();

  @override
  Set<Column> get primaryKey => {draftKey};
}

@DataClassName('CachedPlanRow')
class CachedPlan extends Table {
  TextColumn get userId => text()();
  IntColumn get minutes => integer()();
  TextColumn get json => text()();
  IntColumn get fetchedAtMs => integer()();

  @override
  Set<Column> get primaryKey => {userId, minutes};
}

@DataClassName('CachedAttemptRow')
class CachedAttempts extends Table {
  TextColumn get userId => text()();
  TextColumn get attemptId => text()();
  TextColumn get subject => text()();
  IntColumn get completedAtMs => integer()();
  TextColumn get json => text()();
  IntColumn get fetchedAtMs => integer()();

  @override
  Set<Column> get primaryKey => {userId, attemptId};
}

/// Small server reads cached with their fetch time (rhythm, credits, the attempts-list fetch time).
@DataClassName('CacheEntryRow')
class CacheEntries extends Table {
  TextColumn get userId => text()();
  TextColumn get cacheKey => text()();
  TextColumn get json => text()();
  IntColumn get fetchedAtMs => integer()();

  @override
  Set<Column> get primaryKey => {userId, cacheKey};
}

/// Lesson content cached by `id + version + contentHash`, dropped when any of them changes.
@DataClassName('LearnCacheRow')
class LearnCache extends Table {
  TextColumn get userId => text()();
  TextColumn get cacheKey => text()();
  TextColumn get version => text().withDefault(const Constant(''))();
  TextColumn get contentHash => text().withDefault(const Constant(''))();
  TextColumn get json => text()();
  IntColumn get sizeBytes => integer().withDefault(const Constant(0))();
  IntColumn get updatedAtMs => integer()();

  @override
  Set<Column> get primaryKey => {userId, cacheKey};
}

/// Answer reviews done on this phone (the no-AI "Reviewed" fallback).
@DataClassName('ReviewLogRow')
class ReviewLog extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get userId => text()();
  TextColumn get attemptId => text()();
  TextColumn get questionId => text()();
  TextColumn get kind => text()();
  IntColumn get atMs => integer()();

  @override
  List<Set<Column>> get uniqueKeys => [
        {userId, attemptId, questionId, kind},
      ];
}

@DataClassName('AnalyticsQueueRow')
class AnalyticsQueue extends Table {
  TextColumn get eventId => text()();
  TextColumn get userId => text()();
  TextColumn get name => text()();
  TextColumn get propsJson => text()();
  TextColumn get appVersion => text().nullable()();
  IntColumn get occurredAtMs => integer()();

  @override
  Set<Column> get primaryKey => {eventId};
}

/// A result that was received but not opened yet. Drives Today and the Review tab dot.
@DataClassName('PendingResultRow')
class PendingResults extends Table {
  TextColumn get userId => text()();
  TextColumn get attemptId => text()();
  IntColumn get receivedAtMs => integer()();
  IntColumn get openedAtMs => integer().nullable()();

  @override
  Set<Column> get primaryKey => {userId, attemptId};
}

@DataClassName('RepairLocalRow')
class RepairLocal extends Table {
  TextColumn get userId => text()();
  TextColumn get attemptId => text()();
  TextColumn get questionId => text()();
  TextColumn get requestId => text()();

  /// `explained`, `stored`, `held_for_recheck`, `not_explained`, `not_a_mistake`, `reviewed`.
  TextColumn get status => text()();
  IntColumn get ackedAtMs => integer().nullable()();

  @override
  Set<Column> get primaryKey => {userId, attemptId, questionId};
}

@DataClassName('RhythmSeenRow')
class RhythmSeen extends Table {
  TextColumn get userId => text()();

  /// JSON of the last seen week (weekStart, studyDays, daysGoal, metThisWeek, weeksMetStreak).
  TextColumn get lastSeenWeekJson => text().nullable()();
  TextColumn get lastCelebratedWeekStart => text().nullable()();

  /// JSON list of celebration ids that already fired.
  TextColumn get celebratedIdsJson => text().withDefault(const Constant('[]'))();

  @override
  Set<Column> get primaryKey => {userId};
}

@DataClassName('DismissalRow')
class Dismissals extends Table {
  TextColumn get userId => text()();
  TextColumn get kind => text()();
  TextColumn get subject => text().withDefault(const Constant(''))();
  TextColumn get chapter => text().withDefault(const Constant(''))();
  TextColumn get sourceAttemptId => text().withDefault(const Constant(''))();
  IntColumn get createdAtMs => integer()();
  IntColumn get expiresAtMs => integer()();

  @override
  Set<Column> get primaryKey => {userId, kind, subject, chapter, sourceAttemptId};
}
