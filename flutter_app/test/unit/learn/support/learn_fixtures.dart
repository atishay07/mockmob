import 'package:mockmob/core/models/study.dart';
import 'package:mockmob/features/learn/models/learn_catalog.dart';

typedef J = Map<String, dynamic>;

J unitJson(
  String id,
  String title,
  String status, {
  String subject = 'accountancy',
  int order = 0,
  int minutes = 7,
  int due = 0,
  J? inProgress,
  String version = '2',
}) =>
    {
      'id': id,
      'version': version,
      'subject': subject,
      'chapter': 'Change in Profit Sharing Ratio',
      'title': title,
      'summary': 'Work out who gave up profit share and who gained it.',
      'estimatedMinutes': minutes,
      'order': order,
      'status': status,
      'cardCount': 6,
      'memory': {'cards': 6, 'due': due},
      'inProgress': inProgress,
    };

/// A catalog with one lesson of every status word.
J catalogJson({
  int due = 12,
  int newCount = 0,
  int newAllowance = 5,
  bool pausedNew = false,
  String state = 'ready',
  J? active,
  bool recall = true,
}) =>
    {
      'state': state,
      'subjects': [
        {'subject': 'accountancy', 'title': 'Accountancy'},
        {'subject': 'english', 'title': 'English'},
      ],
      'units': state == 'disabled'
          ? []
          : [
              unitJson('acc-sacrifice', 'Sacrificing and gaining ratios', 'new', order: 1),
              unitJson('acc-goodwill', 'Goodwill on admission', 'in_progress', order: 2, minutes: 9, inProgress: {'runId': 'run-9', 'step': 3, 'total': 9}),
              unitJson('acc-reval', 'Revaluation account', 'lock_in', order: 3, minutes: 8),
              unitJson('eng-vocab', 'Vocabulary set 1', 'due', subject: 'english', order: 4, due: 4),
              unitJson('eng-passage', 'Reading a factual passage', 'learned', subject: 'english', order: 5, minutes: 10),
            ],
      'queue': {
        'dueCount': due,
        'overdueCount': 0,
        'newAllowance': newAllowance,
        'availableCount': due + newCount,
        'newCount': newCount,
        'pausedNew': pausedNew,
      },
      'active': active,
      'nextUnit': {
        'id': 'acc-sacrifice',
        'title': 'Sacrificing and gaining ratios',
        'subject': 'accountancy',
        'chapter': 'Change in Profit Sharing Ratio',
        'reason': 'You have missed Change in Profit Sharing Ratio questions in practice. This lesson covers the idea behind them.',
      },
      'recallEnabled': recall,
      'newCardsPerDay': 5,
      'introducedToday': 0,
    };

LearnCatalog catalog({
  int due = 12,
  int newCount = 0,
  bool pausedNew = false,
  String state = 'ready',
  J? active,
  bool recall = true,
}) =>
    LearnCatalog.fromJson(catalogJson(due: due, newCount: newCount, pausedNew: pausedNew, state: state, active: active, recall: recall));

J revealCard({String id = 'card-1', bool revealed = false}) => {
      'id': id,
      'type': 'reveal',
      'prompt': 'Complete the formula: sacrifice = …',
      'objective': 'Calculate a partner’s sacrifice or gain from old and new shares',
      if (revealed) 'answer': 'Old share − New share',
      if (revealed) 'explanation': 'A sacrifice is how much a share fell, so start from the old share.',
    };

J choiceCard({bool revealed = false, int? answer}) => {
      'id': 'card-2',
      'type': 'choice',
      'prompt': 'A and B share 3:2. C is admitted for 1/5, taken in the old ratio. What is the sacrificing ratio?',
      'options': ['3:2', '1:1', '4:1', '2:3'],
      if (revealed) 'answer': answer ?? 0,
      if (revealed) 'explanation': 'C takes the share in the old ratio, so the old ratio is the sacrificing ratio.',
    };

J textCard() => {
      'id': 'card-3',
      'type': 'text',
      'context': 'The committee will _____ the proposal on Friday.',
      'prompt': 'Type the missing word.',
      'hint': 'It means: to look at something carefully',
      'inputHint': 'Type the word',
    };

J readingBlock() => {
      'id': 'ratio-rule',
      'type': 'reading',
      'kind': 'explanation',
      'title': 'Start with the change in share',
      'body': 'For each partner, sacrifice = old share − new share. Gain = new share − old share. Use a common denominator before subtracting.',
      'formula': 'Sacrifice = Old share − New share · Gain = New share − Old share',
    };

/// A run in the server's public shape.
J runJson({
  String id = 'run-1',
  String mode = 'recall',
  String state = 'active',
  int cursor = 0,
  int revision = 0,
  int total = 8,
  bool revealed = false,
  J? item,
  J? feedback,
  List<J> reviewed = const [],
  String? updatedAt,
  String title = 'Review',
  bool noItem = false,
}) =>
    {
      'id': id,
      'mode': mode,
      'state': state,
      'cursor': cursor,
      'revision': revision,
      'total': total,
      'revealed': revealed,
      'title': title,
      'item': item ?? (state == 'active' && !noItem ? revealCard(revealed: revealed) : null),
      'feedback': feedback,
      'units': [
        {'id': 'acc-sacrifice', 'title': 'Sacrificing and gaining ratios', 'subject': 'accountancy'}
      ],
      'reviewed': reviewed,
      'updatedAt': ?updatedAt,
    };

StudyRun run({
  String id = 'run-1',
  String mode = 'recall',
  String state = 'active',
  int cursor = 0,
  int revision = 0,
  int total = 8,
  bool revealed = false,
  J? item,
  J? feedback,
  List<J> reviewed = const [],
  String? updatedAt,
  String title = 'Review',
}) =>
    StudyRun.fromJson(runJson(
      id: id,
      mode: mode,
      state: state,
      cursor: cursor,
      revision: revision,
      total: total,
      revealed: revealed,
      item: item,
      feedback: feedback,
      reviewed: reviewed,
      updatedAt: updatedAt,
      title: title,
    ));
