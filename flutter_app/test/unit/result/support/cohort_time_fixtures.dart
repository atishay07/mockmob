import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/model/answer_items.dart';

import 'lab_fixtures.dart';

/// The Lab contract the website builds for its Full mock paper with every slice 5 gate met
/// (`cohort.slow`, and `others.lines` on 33 questions), copied byte for byte from the website's
/// `data/cohort_time_preview.js` run over `replay_full_input.json`. Illustrative students.
MistakeLab timeLab() => labOf('cohort_time');

/// The same paper one short of every gate: no `slow`, no `lines`.
MistakeLab gatedLab() => labOf('cohort_time_gated');

/// Question 1 of that paper: the student picked B, the key is D; 45 other students, 3 lines of time.
AnswerItem q1Item() => AnswerItem(
      number: 1,
      question: SnapshotQuestion.fromJson(const {
        'id': 'q1',
        'chapter': 'Partnership Fundamentals',
        'question': 'Illustrative question 1',
        'options': ['q1 statement one', 'q1 statement two', 'q1 statement three', 'q1 statement four'],
        'correctIndex': 3,
      }),
      verdict: Verdict.wrong,
      given: 1,
      keyIndex: 3,
    );
