import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/credits_repository.dart';
import '../../insights/data/ai_reply_report.dart' show insightsPrefsStoreProvider;
import '../../insights/data/ask_controller.dart' show AskFailure, askFailureFor;
import '../../insights/data/ask_wallet.dart';

/// Lesson help (owner ledger L39): "Need another explanation?" on a lesson step, the website's
/// `StudyHelp.jsx`. It calls the same route as Ask Mobi, `POST /api/ai/mentor/chat`, with the three
/// fields that tell the server which step of which run this is (`studyRunId`, `studyRevision`,
/// `studyItemId`). The server then builds the context itself from that step's published teaching
/// and from nothing else about the student, answers with a model reply that costs 1 AI credit,
/// and releases the credit when the reply fails (`charged: 0`).
///
/// What the website does, and so does this: help is offered on a reading step at once and on a
/// question or recall card only once its answer is shown (the server refuses earlier with
/// `ANSWER_FIRST`); one explanation per step and revision; the same request id on every retry of an
/// unknown outcome, so a question is never charged twice; a duplicate comes back as the saved reply
/// with `charge.amount` 0 and `replayed: true`. Questions about the student's own record are not
/// part of lesson help (the server skips the record path when a lesson step is attached), so there
/// is no free branch here: every send is a 1 credit reply, and the screen says so before it goes.
@immutable
class LessonHelpKey {
  const LessonHelpKey({required this.runId, required this.itemId, required this.revision});

  final String runId;
  final String itemId;

  /// The run's `revision` when the help was opened. The server refuses help for any other.
  final int revision;

  @override
  bool operator ==(Object other) =>
      other is LessonHelpKey && other.runId == runId && other.itemId == itemId && other.revision == revision;

  @override
  int get hashCode => Object.hash(runId, itemId, revision);

  String get stored => '$runId|$itemId|$revision';
}

/// Why a question got no reply. None of them costs a credit: the server sends `charged: 0` and
/// releases what it reserved.
enum HelpFailure {
  /// No answer arrived. The outcome is unknown, so Send again reuses the request id.
  offline,
  noCredits,
  paused,
  resend,
  rateLimited,
  tooLong,
  unavailable,
  inProgress,
  alreadyAnswered,
  budgetReached,
  walletUnavailable,

  /// The server refused help for this step (422 or `invalid_run`): the run moved on, the card has
  /// not been answered yet, or the lesson changed. Nothing was charged.
  stepMoved,

  /// The app closed while the question was on its way; Send again reuses its request id.
  interrupted,
}

HelpFailure helpFailureFor(ApiError e) {
  final code = e.code.toLowerCase();
  if (e.status == 422 || const {'answer_first', 'revision_conflict', 'study_help_unavailable', 'invalid_run'}.contains(code)) {
    return HelpFailure.stepMoved;
  }
  return switch (askFailureFor(e)) {
    AskFailure.offline => HelpFailure.offline,
    AskFailure.noCredits => HelpFailure.noCredits,
    AskFailure.paused => HelpFailure.paused,
    AskFailure.resend => HelpFailure.resend,
    AskFailure.rateLimited => HelpFailure.rateLimited,
    AskFailure.tooLong => HelpFailure.tooLong,
    AskFailure.unavailable => HelpFailure.unavailable,
    AskFailure.inProgress => HelpFailure.inProgress,
    AskFailure.alreadyAnswered => HelpFailure.alreadyAnswered,
    AskFailure.budgetReached => HelpFailure.budgetReached,
    AskFailure.walletUnavailable => HelpFailure.walletUnavailable,
    AskFailure.interrupted => HelpFailure.interrupted,
  };
}

enum HelpPhase { idle, sending, answered, failed }

class LessonHelpState {
  const LessonHelpState({
    this.phase = HelpPhase.idle,
    this.question,
    this.reply,
    this.charged,
    this.left,
    this.replayed = false,
    this.failure,
    this.balance,
    this.creditHeld = false,
    this.requestId,
    this.wallet,
  });

  final HelpPhase phase;

  /// What was asked (kept for Send again).
  final String? question;
  final String? reply;

  /// Credits the server took for this reply: 1, 0 or null (not reported).
  final int? charged;
  final int? left;

  /// The server found this question already answered and gave back the saved reply.
  final bool replayed;
  final HelpFailure? failure;

  /// Credits the server said the student has, on [HelpFailure.noCredits].
  final int? balance;

  /// The server could not release the reserved credit at once; it returns by itself.
  final bool creditHeld;

  /// The id the server dedupes on. Kept across a failure whose outcome is unknown.
  final String? requestId;

  /// The wallet the latest server answer reported.
  final AskWallet? wallet;

  bool get sending => phase == HelpPhase.sending;
  bool get answered => phase == HelpPhase.answered;

  LessonHelpState copyWith({
    HelpPhase? phase,
    String? question,
    String? reply,
    int? charged,
    int? left,
    bool? replayed,
    HelpFailure? failure,
    bool clearFailure = false,
    int? balance,
    bool? creditHeld,
    String? requestId,
    bool clearRequestId = false,
    AskWallet? wallet,
  }) => LessonHelpState(
    phase: phase ?? this.phase,
    question: question ?? this.question,
    reply: reply ?? this.reply,
    charged: charged ?? this.charged,
    left: left ?? this.left,
    replayed: replayed ?? this.replayed,
    failure: clearFailure ? null : (failure ?? this.failure),
    balance: balance ?? this.balance,
    creditHeld: creditHeld ?? this.creditHeld,
    requestId: clearRequestId ? null : (requestId ?? this.requestId),
    wallet: wallet ?? this.wallet,
  );
}

/// The longest question the website lets through (`maxLength={500}`); the server's own limit is 1,500.
const lessonHelpMaxChars = 500;

class LessonHelpController extends Notifier<LessonHelpState> {
  LessonHelpController(this.key);

  final LessonHelpKey key;
  bool _flight = false;

  static const _pendingKey = 'lesson_help_pending';
  static const _pendingFor = Duration(hours: 24);

  @override
  LessonHelpState build() {
    // Another account starts with nothing: a reply written for one student is never shown to the next.
    ref.watch(authSnapshotProvider.select((s) => s.userId));
    return const LessonHelpState();
  }

  /// Sends [raw]. Returns the failure it ended in, or null when it was answered (or ignored).
  Future<HelpFailure?> send(String raw) async {
    final text = raw.trim();
    if (text.isEmpty || _flight || state.answered) return null;
    if (text.length > lessonHelpMaxChars) {
      state = state.copyWith(phase: HelpPhase.failed, question: text, failure: HelpFailure.tooLong, creditHeld: false);
      return HelpFailure.tooLong;
    }
    // The same request id on every retry of the same question; a new question is a new request.
    final sameQuestion = state.question == text && state.requestId != null;
    final requestId = sameQuestion ? state.requestId! : const Uuid().v4().replaceAll('-', '');
    return _post(text, requestId);
  }

  /// Sends the question of a failed attempt again (same words, same request id unless the server
  /// said that attempt was released).
  Future<HelpFailure?> retry() async {
    final text = state.question;
    if (text == null || state.failure == null) return null;
    return send(text);
  }

  Future<HelpFailure?> _post(String text, String requestId) async {
    _flight = true;
    final userId = ref.read(userIdProvider);
    state = state.copyWith(phase: HelpPhase.sending, question: text, requestId: requestId, clearFailure: true, creditHeld: false);
    await _remember(text, requestId, userId);
    try {
      final res = await ref.read(apiClientProvider).post(
        '/api/ai/mentor/chat',
        body: {
          'message': text,
          'mode': 'revision',
          'studyRunId': key.runId,
          'studyRevision': key.revision,
          'studyItemId': key.itemId,
          'requestId': requestId,
        },
      );
      final body = res.map;
      await _forget();
      if (!ref.mounted) return null;
      final origin = asString(body['origin']);
      final wallet = AskWallet.fromSnapshot(body['usageSnapshot']);
      if (origin == 'status') {
        // Replies are paused: the server explained instead of answering and charged nothing.
        state = state.copyWith(phase: HelpPhase.failed, failure: HelpFailure.paused, wallet: wallet, clearRequestId: true);
        return HelpFailure.paused;
      }
      final response = asJson(body['response']);
      final reply = (asString(body['reply']) ?? asString(response['reply']) ?? '').trim();
      if (reply.isEmpty) {
        // An answer with no words is not an explanation, and the server only charges for one.
        state = state.copyWith(phase: HelpPhase.failed, failure: HelpFailure.unavailable, wallet: wallet, clearRequestId: true);
        return HelpFailure.unavailable;
      }
      final replayed = asBool(body['replayed']) ?? asBool(response['replayed']) ?? false;
      state = state.copyWith(
        phase: HelpPhase.answered,
        reply: reply,
        // Only the server's charge says what it took.
        charged: asInt(asJson(body['charge'])['amount']) ?? asInt(asJson(response['charge'])['amount']),
        left: wallet?.total,
        replayed: replayed,
        wallet: wallet,
        clearFailure: true,
      );
      if (!replayed) ref.read(creditsRepositoryProvider.notifier).refresh();
      return null;
    } on ApiError catch (e) {
      final failure = helpFailureFor(e);
      // Only an unknown outcome stays remembered: every other failure is the server saying what
      // happened to the question.
      final unknown = failure == HelpFailure.offline || failure == HelpFailure.inProgress;
      if (!unknown) await _forget();
      if (!ref.mounted) return failure;
      final balance = asInt(e.details['balance']);
      final base = state.wallet ?? _readWallet();
      state = state.copyWith(
        phase: HelpPhase.failed,
        failure: failure,
        balance: balance,
        creditHeld: e.serverMessage?.contains('held briefly') ?? false,
        // "Did not go through" or answered already: a fresh id on the next send. Anything
        // uncertain keeps the id, so the server can say it already has the answer.
        clearRequestId: failure == HelpFailure.resend || failure == HelpFailure.alreadyAnswered,
        wallet: failure == HelpFailure.noCredits && balance != null ? (base ?? const AskWallet()).withTotal(balance) : null,
      );
      if (failure == HelpFailure.noCredits) ref.read(creditsRepositoryProvider.notifier).refresh();
      return failure;
    } finally {
      _flight = false;
    }
  }

  /// Call when the sheet opens: a question that was on its way when the app closed comes back as a
  /// failed attempt with Send again, which reuses the request id the server already knows.
  Future<void> restoreInterrupted() async {
    if (state.phase != HelpPhase.idle) return;
    final owner = ref.read(userIdProvider);
    if (owner == null) return;
    final store = ref.read(insightsPrefsStoreProvider);
    try {
      final raw = await store.getString(_pendingKey);
      if (raw == null) return;
      final j = jsonDecode(raw);
      if (j is! Map) return _forget();
      final text = j['text'];
      final requestId = j['requestId'];
      final at = DateTime.tryParse('${j['at']}');
      if (text is! String || text.isEmpty || requestId is! String || requestId.isEmpty) return _forget();
      if (at == null || ref.read(nowProvider)().difference(at) > _pendingFor) return _forget();
      if (j['userId'] != owner || j['key'] != key.stored) return;
      if (!ref.mounted || state.phase != HelpPhase.idle) return;
      state = state.copyWith(phase: HelpPhase.failed, question: text, requestId: requestId, failure: HelpFailure.interrupted);
    } on Object {
      // Nothing to bring back.
    }
  }

  Future<void> _remember(String text, String requestId, String? userId) async {
    try {
      await ref.read(insightsPrefsStoreProvider).setString(
        _pendingKey,
        jsonEncode({
          'text': text,
          'requestId': requestId,
          'key': key.stored,
          'userId': userId,
          'at': ref.read(nowProvider)().toUtc().toIso8601String(),
        }),
      );
    } on Object {
      // Without the note the worst case is a question that is not offered again.
    }
  }

  Future<void> _forget() async {
    try {
      await ref.read(insightsPrefsStoreProvider).remove(_pendingKey);
    } on Object {
      // A stale note expires by itself.
    }
  }

  AskWallet? _readWallet() {
    final c = ref.read(creditsRepositoryProvider).value;
    return c == null ? null : AskWallet.fromCredits(c);
  }
}

final lessonHelpProvider = NotifierProvider.family<LessonHelpController, LessonHelpState, LessonHelpKey>(LessonHelpController.new);

/// The wallet lesson help shows: the one the latest reply or refusal reported, or else the credits
/// read. Null until either has arrived. An unreadable wallet has no number, never zero.
final lessonHelpWalletProvider = Provider.family<AskWallet?, LessonHelpKey>((ref, key) {
  final fromHelp = ref.watch(lessonHelpProvider(key).select((s) => s.wallet));
  final read = ref.watch(creditsRepositoryProvider);
  final fromRead = read.value == null ? null : AskWallet.fromCredits(read.value!);
  if (fromHelp == null) return fromRead;
  if (fromRead == null) return fromHelp;
  // A network read that finished after a reply is the newer truth only when it is not the cache.
  return read.fromCache ? fromHelp : fromRead;
});
