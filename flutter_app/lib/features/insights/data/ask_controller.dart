import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/credits_repository.dart';
import 'insights_repository.dart';
import 'readout.dart';

/// Where a reply came from. Each says what it cost.
enum AskOrigin {
  /// Computed on this phone from the record. Free.
  phone,

  /// The server answered from the record. Free.
  record,

  /// A model reply through the server's budget guard. 1 credit.
  model,

  /// Model replies are paused; the server explained the next step instead. Free.
  paused,
}

enum AskFailure { offline, noCredits, paused, resend, rateLimited, tooLong, unavailable }

class AskMessage {
  const AskMessage.student(this.text)
      : fromStudent = true,
        origin = null,
        actions = const [],
        sending = false,
        failure = null,
        balance = null,
        retryText = null,
        requestId = null;

  const AskMessage.reply(this.text, {required AskOrigin this.origin, this.actions = const [], this.requestId})
      : fromStudent = false,
        sending = false,
        failure = null,
        retryText = null,
        balance = null;

  const AskMessage.sending()
      : fromStudent = false,
        text = '',
        origin = null,
        actions = const [],
        sending = true,
        failure = null,
        balance = null,
        retryText = null,
        requestId = null;

  /// [retryText] and [requestId] are the question this failure belongs to, so Send again on any
  /// failed bubble sends that bubble's own question.
  const AskMessage.failed(AskFailure this.failure, {this.balance, this.retryText, this.requestId})
      : fromStudent = false,
        text = '',
        origin = null,
        actions = const [],
        sending = false;

  final bool fromStudent;
  final String text;
  final AskOrigin? origin;

  /// (label, href) pairs. The screen maps hrefs to app routes and hides what it cannot open.
  final List<(String, String)> actions;
  final bool sending;
  final AskFailure? failure;

  /// Credits the server said the student has, on [AskFailure.noCredits].
  final int? balance;

  /// The request that produced a server reply, so a report names exactly that reply. On a
  /// failure, the request to send again.
  final String? requestId;

  /// On a failure: the question to send again.
  final String? retryText;

  /// Written by a model: carries the "can be wrong" line and Report this reply.
  bool get isModel => origin == AskOrigin.model;
}

class AskState {
  const AskState({this.messages = const [], this.sessionId});

  final List<AskMessage> messages;
  final String? sessionId;

  bool get busy => messages.any((m) => m.sending);
}

/// The longest message the server accepts.
const askMaxChars = 1500;

/// Ask your record. Questions about marks, chapters, timing or the week are answered on the
/// phone from the record (free, works offline). Anything else goes to `POST /api/ai/mentor/chat`,
/// whose budget guard decides: a free record answer, a paused notice, or a 1-credit reply.
class AskController extends Notifier<AskState> {
  // Bumped when the conversation is cleared (another student), so a late reply cannot land in it.
  int _epoch = 0;

  @override
  AskState build() {
    ref.watch(authSnapshotProvider.select((s) => s.userId));
    _epoch++;
    return const AskState();
  }

  /// True when [raw] is answered on the phone from the record, so nothing leaves the phone.
  bool answersOnPhone(String raw) {
    final text = raw.trim();
    if (text.isEmpty || text.length > askMaxChars) return true;
    final insights = ref.read(insightsRepositoryProvider).value;
    return insights != null && answerFromInsights(text, insights, pro: ref.read(insightsProProvider)) != null;
  }

  Future<void> send(String raw) async {
    final text = raw.trim();
    if (text.isEmpty || state.busy) return;
    if (text.length > askMaxChars) {
      _append([const AskMessage.failed(AskFailure.tooLong)]);
      return;
    }
    final insights = ref.read(insightsRepositoryProvider).value;
    final local = insights == null ? null : answerFromInsights(text, insights, pro: ref.read(insightsProProvider));
    if (local != null) {
      _append([AskMessage.student(text), AskMessage.reply(local.reply, origin: AskOrigin.phone, actions: local.actions)]);
      return;
    }
    _append([AskMessage.student(text), const AskMessage.sending()]);
    await _post(state.messages.length - 1, text, const Uuid().v4());
  }

  /// Sends a failed message again: the one at [index], or the last message. After an unknown
  /// outcome the same request id goes, so a reply that did arrive is never charged twice. Only
  /// that bubble changes; later turns stay as they are.
  Future<void> retry([int? index]) async {
    final i = index ?? state.messages.length - 1;
    if (state.busy || i < 0 || i >= state.messages.length) return;
    final failed = state.messages[i];
    final text = failed.retryText;
    if (failed.failure == null || text == null) return;
    _replaceAt(i, const AskMessage.sending());
    await _post(i, text, failed.requestId ?? const Uuid().v4());
  }

  Future<void> _post(int index, String text, String requestId) async {
    final epoch = _epoch;
    try {
      final res = await ref.read(apiClientProvider).post('/api/ai/mentor/chat', body: {
        'message': text,
        'mode': 'mentor',
        'requestId': requestId,
        'sessionId': ?state.sessionId,
      });
      final body = res.map;
      final origin = switch (asString(body['origin'])) {
        'model' => AskOrigin.model,
        'status' => AskOrigin.paused,
        _ => AskOrigin.record,
      };
      final actions = [
        for (final a in asJsonList(body['actions']))
          if (asString(a['label']) case final label? when asString(a['route']) != null) (label, asString(a['route'])!),
      ];
      if (epoch != _epoch) return;
      _replaceAt(
        index,
        AskMessage.reply(asStringOr(body['reply'], ''), origin: origin, actions: actions, requestId: requestId),
        sessionId: asString(body['sessionId']),
      );
      if (origin == AskOrigin.model) ref.read(creditsRepositoryProvider.notifier).refresh();
    } on ApiError catch (e) {
      if (epoch != _epoch) return;
      final failure = switch (e.kind) {
        ApiErrorKind.network || ApiErrorKind.timeout => AskFailure.offline,
        ApiErrorKind.paymentRequired => AskFailure.noCredits,
        ApiErrorKind.unavailable => AskFailure.paused,
        ApiErrorKind.conflict => AskFailure.resend,
        ApiErrorKind.rateLimited => AskFailure.rateLimited,
        ApiErrorKind.payloadTooLarge => AskFailure.tooLong,
        _ => AskFailure.unavailable,
      };
      // "Did not go through": a fresh id. Anything uncertain keeps the id for the retry.
      final next = failure == AskFailure.resend ? const Uuid().v4() : requestId;
      _replaceAt(index, AskMessage.failed(failure, balance: asInt(e.details['balance']), retryText: text, requestId: next));
    }
  }

  void _append(List<AskMessage> add) => state = AskState(messages: [...state.messages, ...add], sessionId: state.sessionId);

  void _replaceAt(int index, AskMessage m, {String? sessionId}) {
    if (!ref.mounted || index >= state.messages.length) return;
    final next = [...state.messages]..[index] = m;
    state = AskState(messages: next, sessionId: sessionId ?? state.sessionId);
  }
}

final askControllerProvider = NotifierProvider<AskController, AskState>(AskController.new);
