import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/features/auth/copy.dart';

void main() {
  test('names what failed from the error kind', () {
    expect(LoadProblem.of(const ApiError(kind: ApiErrorKind.network, code: 'network')), LoadProblem.offline);
    expect(LoadProblem.of(const ApiError(kind: ApiErrorKind.timeout, code: 'timeout')), LoadProblem.slow);
    expect(LoadProblem.of(const ApiError(status: 503, kind: ApiErrorKind.unavailable, code: 'x')), LoadProblem.busy);
    expect(LoadProblem.of(const ApiError(status: 429, kind: ApiErrorKind.rateLimited, code: 'x')), LoadProblem.busy);
    expect(LoadProblem.of(const ApiError(status: 403, kind: ApiErrorKind.forbidden, code: 'x')), LoadProblem.refused);
    expect(LoadProblem.of(const ApiError(kind: ApiErrorKind.unknown, code: 'unusable_response')), LoadProblem.unreadable);
    expect(LoadProblem.of(StateError('boom')), LoadProblem.unknown);
    expect(LoadProblem.of(null), LoadProblem.unknown);
  });

  test('every cause reads as plain sentences: no exclamation, no em dash, no middle dot', () {
    for (final p in LoadProblem.values) {
      for (final text in [p.sentence, p.advice]) {
        expect(text, isNot(contains('!')));
        expect(text, isNot(contains('—')));
        expect(text, isNot(contains('·')));
        expect(text.endsWith('.'), isTrue, reason: text);
      }
    }
  });

  test('the load-failed message says what failed, that it tried, and that nothing was lost', () {
    expect(AuthCopy.loadFailedMessage(null), AuthCopy.loadFailedBody);
    final message = AuthCopy.loadFailedMessage(LoadProblem.offline, triedAgain: true);
    expect(message, contains('We tried again. It still did not load.'));
    expect(message, contains(LoadProblem.offline.sentence));
    expect(message, endsWith(AuthCopy.loadFailedBody));
  });

  test('the account snapshot carries the cause and compares by it', () {
    const a = AuthSnapshot(status: AuthStatus.unknown, loadFailed: true, loadProblem: LoadProblem.offline);
    const b = AuthSnapshot(status: AuthStatus.unknown, loadFailed: true, loadProblem: LoadProblem.busy);
    expect(a == b, isFalse);
    expect(a, const AuthSnapshot(status: AuthStatus.unknown, loadFailed: true, loadProblem: LoadProblem.offline));
  });
}
