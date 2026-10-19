// M6 (walk, 19 Oct): the NTA instructions header and the exam screens name the candidate by the name the student
// gave, never by the email's own prefix (the same rule as the rest of the app, core/auth/display_name.dart).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/features/runner/nta/nta_runner_screen.dart' show ntaCandidateNameProvider;

class _Auth extends AuthController {
  _Auth(this.snapshot);

  final AuthSnapshot snapshot;

  @override
  AuthSnapshot build() => snapshot;
}

String? _candidate(AuthSnapshot auth) {
  final container = ProviderContainer(overrides: [authSnapshotProvider.overrideWith(() => _Auth(auth))]);
  addTearDown(container.dispose);
  return container.read(ntaCandidateNameProvider);
}

void main() {
  test('the email\'s own prefix is no candidate name', () {
    expect(_candidate(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'walk-v153-fresh-1019b', email: 'walk-v153-fresh-1019b@example.com')), isNull);
    expect(_candidate(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'riya', email: 'Riya@example.com')), isNull);
    expect(_candidate(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'student42')), isNull);
    expect(_candidate(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u')), isNull);
  });

  test('a name the student gave is the candidate name', () {
    expect(_candidate(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma', email: 'asha@example.com')), 'Asha Verma');
  });
}
