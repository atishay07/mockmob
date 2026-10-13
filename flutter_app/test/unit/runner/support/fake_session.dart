import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/question.dart';
import 'package:mockmob/core/sync/session/save_state.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';
import 'package:mockmob/features/runner/data/runner_session.dart';

/// Real-looking questions for the runner's goldens and widget tests.
List<SessionQuestion> accountancyQuestions(int count) => [
  for (var i = 0; i < count; i++) _accountancy[i % _accountancy.length].withId('q${i + 1}'),
];

extension on SessionQuestion {
  SessionQuestion withId(String id) => SessionQuestion(
    id: id,
    subject: subject,
    chapter: chapter,
    question: question,
    body: body,
    options: options,
    passageText: passageText,
    passageGroupId: passageGroupId,
  );
}

List<QuestionOption> _opts(List<String> texts) => [
  for (var i = 0; i < texts.length; i++) QuestionOption(key: String.fromCharCode(65 + i), text: texts[i]),
];

final _accountancy = [
  SessionQuestion(
    id: '',
    subject: 'accountancy',
    chapter: 'Admission of a partner',
    question:
        'A and B share profits in the ratio 3:2. C is admitted for a 1/5 share, which he takes equally from A and B. What is the new profit-sharing ratio?',
    options: _opts(['5:3:2', '3:2:1', '11:5:4', '2:2:1']),
  ),
  SessionQuestion(
    id: '',
    subject: 'accountancy',
    chapter: 'Goodwill',
    question:
        'Average profit of a firm is Rs 60,000 and normal profit is Rs 45,000. What is goodwill at three years\' purchase of super profit?',
    options: _opts(['Rs 45,000', 'Rs 1,35,000', 'Rs 1,80,000', 'Rs 15,000']),
  ),
  SessionQuestion(
    id: '',
    subject: 'accountancy',
    chapter: 'Retirement of a partner',
    question: 'On the retirement of a partner, the gaining ratio is calculated as',
    options: _opts([
      'Old ratio minus new ratio',
      'New ratio minus old ratio',
      'Sacrificing ratio of the remaining partners',
      'Capital ratio of the remaining partners',
    ]),
  ),
];

/// A passage question, the second of a group of three.
List<SessionQuestion> passageQuestions() {
  const passage =
      'The first bus to the old market leaves before the tea stalls open. By the time it reaches the river, '
      'the vendors have already laid out their baskets, and the town that seemed asleep an hour ago is arguing '
      'loudly about the price of onions. Nobody plans this rhythm; it is simply how the place has always woken up.';
  return [
    for (var i = 1; i <= 3; i++)
      SessionQuestion(
        id: 'p$i',
        subject: 'english',
        chapter: 'Reading comprehension',
        question: switch (i) {
          1 => 'What does the passage say about the first bus?',
          2 => 'The phrase "arguing loudly about the price of onions" suggests that the town is',
          _ => 'Which word best describes the rhythm of the town?',
        },
        options: _opts(['busy and awake', 'angry with the vendors', 'short of food', 'quiet and sleepy']),
        passageText: passage,
        passageGroupId: 'g1',
      ),
  ];
}

/// A scripted [RunnerSession] whose every fact the test sets.
class FakeRunnerSession extends ChangeNotifier implements RunnerSession {
  FakeRunnerSession({
    List<SessionQuestion>? questions,
    this.mode = 'full',
    this.subject = 'accountancy',
    this.chapter,
    this.mockNumber = 7,
    this.isTicketMode = false,
    int currentIndex = 0,
    Map<String, int>? answers,
    Set<String>? marked,
    Set<String>? visited,
    Set<String>? unsynced,
    this.canAnswer = true,
    DateTime? endsAt,
    this.endedByTimeUp = false,
    this.submitOwedOnOpen = false,
    Duration remaining = const Duration(minutes: 47, seconds: 12),
    SaveSnapshot save = const SaveSnapshot(state: SaveState.saved),
    SubmitUiState submit = SubmitUiState.idle,
    AwayInfo? away,
  }) : questions = questions ?? accountancyQuestions(50),
       _index = currentIndex,
       answers = answers ?? {},
       _marked = marked ?? {},
       _visited = visited ?? {},
       _unsynced = unsynced ?? {},
       endsAt = endsAt ?? DateTime(2026, 10, 13, 23, 42),
       remaining = ValueNotifier(remaining),
       saveState = ValueNotifier(save),
       submitState = ValueNotifier(submit),
       away = ValueNotifier(away);

  @override
  final String sessionId = 'sess-1';
  @override
  final String mode;
  @override
  final String subject;
  @override
  final String? chapter;
  @override
  final int? mockNumber;
  @override
  final bool isTicketMode;
  @override
  bool get isMock => mode == 'full' || mode == 'nta';
  @override
  final List<SessionQuestion> questions;
  @override
  bool canAnswer;
  @override
  final DateTime endsAt;
  @override
  bool endedByTimeUp;
  @override
  final bool submitOwedOnOpen;

  final Map<String, int> answers;
  final Set<String> _marked;
  final Set<String> _visited;
  final Set<String> _unsynced;
  int _index;

  @override
  final ValueNotifier<Duration> remaining;
  @override
  final ValueNotifier<SaveSnapshot> saveState;
  @override
  final ValueNotifier<SubmitUiState> submitState;
  @override
  final ValueNotifier<AwayInfo?> away;

  final StreamController<SessionWarning> warningController = StreamController.broadcast();
  @override
  Stream<SessionWarning> get warnings => warningController.stream;

  /// What the next submit returns; null leaves it sending forever.
  SubmitOutcome? nextOutcome = SubmitReceived(attempt: const {'id': 'att-1'}, receivedAt: DateTime(2026, 10, 13, 22, 42));
  final List<String> calls = [];
  int submits = 0;
  bool closed = false;

  @override
  int get currentIndex => _index;
  @override
  int? answerFor(String qid) => answers[qid];
  @override
  int get answeredCount => answers.length;
  @override
  Set<String> get marked => _marked;
  @override
  Set<String> get visited => {..._visited, questions[_index].id};
  @override
  Set<String> get unsyncedQuestionIds => _unsynced;

  @override
  Future<bool> selectAnswer(String qid, int? option) async {
    calls.add('select $qid $option');
    if (!canAnswer) return false;
    if (option == null) {
      answers.remove(qid);
    } else {
      answers[qid] = option;
    }
    notifyListeners();
    return true;
  }

  @override
  Future<void> goTo(int index) async {
    calls.add('goTo $index');
    _visited.add(questions[_index].id);
    _index = index;
    notifyListeners();
  }

  @override
  void setMarked(String qid, bool value) {
    calls.add('mark $qid $value');
    value ? _marked.add(qid) : _marked.remove(qid);
    notifyListeners();
  }

  @override
  Future<SubmitOutcome> submit({bool timedOut = false}) async {
    submits++;
    calls.add('submit');
    endedByTimeUp = endedByTimeUp || timedOut;
    canAnswer = false;
    submitState.value = const SubmitUiState(SubmitStage.sending);
    final outcome = nextOutcome;
    if (outcome == null) return const SubmitPending(ApiError(kind: ApiErrorKind.network, code: 'network'));
    await Future<void>.delayed(Duration.zero);
    submitState.value = switch (outcome) {
      SubmitReceived() => SubmitUiState(SubmitStage.received, outcome: outcome),
      SubmitPending() => SubmitUiState(SubmitStage.pending, outcome: outcome),
      SubmitWindowClosed() => SubmitUiState(SubmitStage.windowClosed, outcome: outcome),
      SubmitRejected() => SubmitUiState(SubmitStage.rejected, outcome: outcome),
    };
    return outcome;
  }

  @override
  void dismissAway() => away.value = null;

  @override
  Future<void> onPaused() async => calls.add('paused');
  @override
  Future<void> onResumed() async => calls.add('resumed');
  @override
  void onConnectivityRestored() => calls.add('restored');

  @override
  Future<void> close() async {
    closed = true;
    calls.add('close');
  }
}
