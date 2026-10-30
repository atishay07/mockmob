// Key cards in the device demo (KEYCARDS-BUILD-SPEC 4): the fixture deck behind a Key cards server held in
// memory, for a Free student (the default) or a Pro one (`--dart-define=DEMO_PRO=true`). Ratings and reports
// go straight to that server; nothing here reaches the network.
//
// Asha starts with Chapter 1's five taste cards in Revise (three due now, two new). "The line you needed"
// shows under a wrong answer to the two Business Studies questions the fixture deck covers (unity of command,
// and why management is multidimensional), found by the question's own words as the server's links would be.
// ignore_for_file: depend_on_referenced_packages
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/features/keycards/data/keycards_providers.dart';

import '../unit/keycards/support/keycards_fakes.dart';
import 'demo_book.dart';
import 'demo_questions.dart';
import 'demo_session.dart';

/// `--dart-define=DEMO_PRO=true`: Asha is on Pro (every card open, no daily limits); otherwise Free.
const bool demoPro = bool.fromEnvironment('DEMO_PRO');

const String _unityOfCommand = 'kc.business_studies.principles-of-management.def-unity-of-command';
const String _unityOfDirection = 'kc.business_studies.principles-of-management.kl-unity-of-direction';
const String _characteristics = 'kc.business_studies.nature-and-significance-of-management.list-characteristics';

/// The demo questions the fixture deck has a line for, by their words.
const Map<String, List<String>> _linesByQuestion = {
  'Which principle of Fayol says each employee should receive orders from one superior only?': [_unityOfCommand, _unityOfDirection],
  'Management is multidimensional because it manages': [_characteristics],
};

/// A demo question's words from its id (`<session>-q<n>`): the paper's subject, then the pool's n-th question.
String? _questionText(String questionId) {
  final cut = questionId.lastIndexOf('-q');
  if (cut <= 0) return null;
  final n = int.tryParse(questionId.substring(cut + 2));
  if (n == null || n < 1) return null;
  final session = questionId.substring(0, cut);
  final subject = demoSessions[session]?.subject ?? demoBook.detail(session)?.attempt.subject;
  if (subject == null) return null;
  final pool = demoPool(subject);
  return pool.isEmpty ? null : pool[(n - 1) % pool.length].question;
}

List<String>? _demoLine(String questionId) => _linesByQuestion[_questionText(questionId)];

List<Override> demoKeyCardsOverrides() => [
  keyCardsApiProvider.overrideWithValue(FakeKeyCardsApi.withProgress(isPro: demoPro, now: DateTime.now, lineFor: _demoLine)),
];
