import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/features/review/data/repair_api.dart';
import 'package:mockmob/features/review/data/repair_run.dart' show repairBudgetResetLabel;
import 'package:mockmob/features/review/data/repair_state.dart';

import '../core_data/support/fakes.dart';
import 'support/review_fixtures.dart';

/// Records the receive timeout the repair call was sent with.
class _TimeoutAdapter extends FakeHttpAdapter {
  Duration? receiveTimeout;
  String? path;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) {
    receiveTimeout = options.receiveTimeout;
    path = options.path;
    return super.fetch(options, requestStream, cancelFuture);
  }
}

void main() {
  group('the repair failure bodies reach the app as codes, charged and the server sentence', () {
    test('provider_timeout: charged 0 and the sentence are kept', () {
      final e = ApiError.fromResponse(504, {
        'ok': false,
        'error': 'provider_timeout',
        'charged': 0,
        'message': 'This one took too long. You were not charged.',
      });
      expect(e.code, 'provider_timeout');
      expect(e.chargedNothing, isTrue);
      expect(e.serverMessage, 'This one took too long. You were not charged.');
    });

    test('provider_unavailable, wallet_unavailable, budget_reached and unusable_output keep their sentence', () {
      for (final (status, code) in [
        (503, 'provider_unavailable'),
        (503, 'wallet_unavailable'),
        (503, 'budget_reached'),
        (502, 'unusable_output'),
        (503, 'could_not_start'),
      ]) {
        final e = ApiError.fromResponse(status, {'ok': false, 'error': code, 'charged': 0, 'message': 'A sentence for $code.'});
        expect(e.code, code);
        expect(e.serverMessage, 'A sentence for $code.', reason: code);
        expect(e.chargedNothing, isTrue, reason: code);
      }
    });

    test('a sentence from any other code never reaches the UI, and charged must be exactly 0', () {
      expect(ApiError.fromResponse(500, {'error': 'internal', 'message': 'SyntaxError: Unexpected token <'}).serverMessage, isNull);
      expect(ApiError.fromResponse(402, {'error': 'insufficient_ai_credits', 'message': 'You have 0 left.'}).serverMessage, isNull);
      expect(ApiError.fromResponse(503, {'error': 'paused', 'charged': 0, 'message': 'PrepOS paid features are temporarily unavailable.'}).serverMessage, isNull);
      expect(ApiError.fromResponse(409, {'error': 'in_progress', 'message': 'Still being prepared.'}).serverMessage, isNull);
      expect(ApiError.fromResponse(503, {'error': 'wallet_unavailable', 'message': '   '}).serverMessage, isNull);
      expect(ApiError.fromResponse(503, {'error': 'wallet_unavailable', 'message': 'x' * 401}).serverMessage, isNull);
      expect(ApiError.fromResponse(409, {'error': 'in_progress'}).chargedNothing, isFalse);
      expect(ApiError.fromResponse(500, {'error': 'unusable_output', 'charged': 1}).chargedNothing, isFalse);
      expect(ApiError.fromResponse(500, 'Internal Server Error').chargedNothing, isFalse);
    });
  });

  group('the repair call waits 95 s, a little longer than the 90 s route', () {
    test('the POST goes out with a 95 s receive timeout', () async {
      expect(HttpRepairApi.receiveTimeout, const Duration(seconds: 95));
      final http = _TimeoutAdapter()..replies.add(FakeReply(200, explainedJson()));
      final response = await HttpRepairApi(newApiClient(http)).repair(attemptId: 'm7', questionId: 'm7-q0', requestId: 'req-0000000000000000');
      expect(response.status.wire, 'explained');
      expect(http.path, '/api/recovery/repair');
      expect(http.receiveTimeout, const Duration(seconds: 95));
    });

    test('a 504 provider_timeout body comes through the client with its code, charged and sentence', () async {
      final http = _TimeoutAdapter()
        ..replies.add(const FakeReply(504, {'ok': false, 'error': 'provider_timeout', 'charged': 0, 'message': 'This one took too long. You were not charged.'}));
      final call = HttpRepairApi(newApiClient(http)).repair(attemptId: 'm7', questionId: 'm7-q0', requestId: 'req-0000000000000000');
      await expectLater(
        call,
        throwsA(
          isA<ApiError>()
              .having((e) => e.code, 'code', 'provider_timeout')
              .having((e) => e.chargedNothing, 'chargedNothing', isTrue)
              .having((e) => e.serverMessage, 'serverMessage', 'This one took too long. You were not charged.'),
        ),
      );
      expect(http.requests, hasLength(1), reason: 'a repair is never repeated by the client behind the caller\'s back');
    });
  });

  group('repairs are paused until the first of next month in India', () {
    test('mid month', () => expect(repairBudgetResetLabel(DateTime.utc(2026, 10, 14, 6)), '1 November'));
    test('the last evening in Delhi, after midnight in India it is already next month', () {
      expect(repairBudgetResetLabel(DateTime.utc(2026, 10, 31, 17, 59)), '1 November');
      expect(repairBudgetResetLabel(DateTime.utc(2026, 10, 31, 18, 31)), '1 December');
    });
    test('December rolls into January', () => expect(repairBudgetResetLabel(DateTime.utc(2026, 12, 20)), '1 January'));
  });

  group('which failures can be tried again', () {
    test('everything but a used-up budget, an unrepairable question and a missing one', () {
      for (final f in RepairFailure.values) {
        final expected = switch (f) {
          RepairFailure.budgetReached || RepairFailure.cannotRepair || RepairFailure.notFound => false,
          _ => true,
        };
        expect(f.canRetry, expected, reason: f.name);
      }
    });
  });
}
