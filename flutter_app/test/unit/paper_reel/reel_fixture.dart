import 'package:mockmob/core/models/models.dart';

/// A 30-question Accountancy mock: chapters in blocks of ten, a known mix of right, wrong and blank.
/// Q7 was right then changed to wrong (the Lab's group), Q18 sat 6 min 40 s (stall), Q25 was changed
/// and ended wrong (recovery record only).
const reelChapters = ['Partnership fundamentals', 'Accounting for share capital', 'Cash flow statement'];

/// Result per question number: r right, w wrong, b blank.
const reelPattern = 'rrrwrrwrbr' 'rwwrbwrwbr' 'rrrwwrrrrr';

Map<String, Object?> reelAttemptJson({String pattern = reelPattern, bool withLab = true, bool withTimes = true, bool changed = true}) {
  final n = pattern.length;
  final questions = [
    for (var i = 0; i < n; i++) {'id': 'q${i + 1}', 'chapter': reelChapters[(i ~/ 10) % reelChapters.length], 'question': 'Q${i + 1}', 'correctIndex': 0},
  ];
  final details = [
    for (var i = 0; i < n; i++)
      {
        'qid': 'q${i + 1}',
        'givenIndex': pattern[i] == 'b' ? null : (pattern[i] == 'r' ? 0 : 1),
        'isCorrect': switch (pattern[i]) { 'r' => true, 'w' => false, _ => null },
        if (withTimes) 'timeMs': i == 17 ? 400000 : 45000 + (i % 5) * 5000,
      },
  ];
  final correct = pattern.split('').where((c) => c == 'r').length;
  final wrong = pattern.split('').where((c) => c == 'w').length;
  final blank = n - correct - wrong;
  final gap = wrong * 6 + blank * 5;
  return {
    'id': 'att-1',
    'subject': 'accountancy',
    'score': (correct * 100 / n).round(),
    'correct': correct,
    'wrong': wrong,
    'unattempted': blank,
    'total': n,
    'questionsSnapshot': questions,
    'details': details,
    'selectionMeta': {
      'mode': 'full',
      'scoringVersion': 'server_snapshot_v1',
      if (changed)
        'recovery': {
          'telemetry': 'self_reported',
          'observed': {
            'answerChanges': [
              {'qid': 'q7'},
              {'qid': 'q25'},
            ],
          },
        },
    },
    'completedAt': '2026-10-18T02:00:00Z',
    if (withLab)
      'lab': {
        'state': 'ready',
        'heading': 'Where the marks went',
        'gap': gap,
        'groups': [
          {'id': 'changed_from_right', 'label': 'Right, then changed', 'marks': 6, 'count': 1, 'numbers': [7], 'line': '6 marks on 1 question'},
          {'id': 'long_stay', 'label': 'Long stay', 'marks': 0, 'count': 1, 'numbers': [18], 'line': '0 marks on 1 question'},
          {'id': 'other_wrong', 'label': 'Other wrong', 'marks': gap - 6, 'count': wrong + blank - 1, 'numbers': <int>[], 'line': 'the rest'},
        ],
      },
  };
}

AttemptDetail reelDetail({String pattern = reelPattern, bool withLab = true, bool withTimes = true, bool changed = true}) =>
    AttemptDetail.fromJson(reelAttemptJson(pattern: pattern, withLab: withLab, withTimes: withTimes, changed: changed));
