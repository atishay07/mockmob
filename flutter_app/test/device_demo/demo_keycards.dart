// Key cards in the device demo (KEYCARDS-BUILD-SPEC 4): six real NCERT chapters (demo_keycards_decks.dart)
// behind a Key cards server held in memory, for a Free student (the default) or a Pro one
// (`--dart-define=DEMO_PRO=true`). Ratings and reports go straight to that server; nothing here reaches the
// network.
//
// Asha's Revise holds real cards from four chapters on Free (a few due now, a few new) and, on Pro, the deeper
// ones too: journal entries, formulas and long Biology answers. "The line you needed" shows under a wrong
// answer whose question the copied chapters answer (Mock 7's retiring-partner goodwill, the Business Studies
// Quick 10's functional foremanship, unity of command, the money multiplier and four English words), found by
// the question's own words as the server's links would be.
//
// Free reads three lines a day (the fourth wrong answer with a line shows the Pro gate in its place: Quick 10
// Q2, Mock 7 Q6 and Q26, then Mock 6 Q26).
//
// Offline: put the emulator in airplane mode and every read fails as a phone's would, so the screens fall back
// to what this phone kept and say "As of 9:40 PM".
// ignore_for_file: depend_on_referenced_packages
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/features/keycards/data/keycards_api.dart' show KeyCardsProRequired;
import 'package:mockmob/features/keycards/data/keycards_models.dart';
import 'package:mockmob/features/keycards/data/keycards_providers.dart';
import 'package:mockmob/features/keycards/data/keycards_rules.dart';

import '../unit/keycards/support/keycards_fakes.dart';
import 'demo_book.dart';
import 'demo_keycards_decks.dart';
import 'demo_questions.dart';
import 'demo_session.dart';

/// `--dart-define=DEMO_PRO=true`: Asha is on Pro (every card open, no daily limits); otherwise Free.
const bool demoPro = bool.fromEnvironment('DEMO_PRO');

const String _ratios = 'accountancy.accounting-ratios';
const String _retirement = 'accountancy.retirement-and-death-of-partner';
const String _principles = 'business_studies.principles-of-management';
const String _money = 'economics.money-and-banking';
const String _molecular = 'biology.molecular-basis-of-inheritance';
const String _vocabulary = 'english.vocabulary';

/// The student's subjects as the server lists them, with the copied chapters in each (NCERT order).
const List<(String, String, List<String>)> _subjects = [
  ('accountancy', 'Accountancy', [_retirement, _ratios]),
  ('business_studies', 'Business Studies', [_principles]),
  ('economics', 'Economics', [_money]),
  ('english', 'English', [_vocabulary]),
  ('biology', 'Biology', [_molecular]),
];

/// Each chapter's state on the home (one of each the spec names).
const Map<String, (String, bool)> _chapterStates = {
  _ratios: ('weak', false),
  _retirement: ('mid', false),
  _principles: ('strong', true),
  _money: ('thin', false),
  _molecular: ('none', false),
  _vocabulary: ('strong', false),
};

String _id(String chapterKey, String slug) => 'kc.${chapterKey.split('.').first}.${chapterKey.split('.').last}.$slug';

/// The demo questions the copied chapters have a line for, by their words.
final Map<String, List<String>> _linesByQuestion = {
  'Which principle of Fayol says each employee should receive orders from one superior only?': [
    _id(_principles, 'def-fayol-unity-of-command'),
    _id(_principles, 'diff-command-vs-direction-meaning'),
  ],
  'Which technique of Taylor separates planning from doing?': [_id(_principles, 'def-functional-foremanship')],
  'On retirement, the retiring partner’s share of goodwill is debited to the': [
    _id(_retirement, 'fact-goodwill-who-compensates'),
    _id(_retirement, 'entry-goodwill-not-in-books'),
  ],
  'If the legal reserve ratio is 20%, the money multiplier is': [_id(_money, 'fact-deposits-500'), _id(_money, 'def-crr')],
  'Choose the word closest in meaning to “candid”.': [_id(_vocabulary, 'word-candid')],
  'Choose the antonym of “scarce”.': [_id(_vocabulary, 'word-scarce')],
  'Choose the synonym of “diligent”.': [_id(_vocabulary, 'word-diligent')],
  'The idiom “a blessing in disguise” means': [_id(_vocabulary, 'idiom-a-blessing-in-disguise')],
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

List<KeyCard> _realCards() => [for (final c in asJsonList(asJson(jsonDecode(demoKeyCardsJson))['cards'])) ?KeyCard.tryParse(c)];

/// Asha's Revise, relative to [now]. Free: the open (taste) cards of four chapters, some due, some new. Pro: those
/// plus deeper cards a Free student cannot open (entries, formulas, long Biology answers), all due.
Map<String, FakeKcState> _states(List<KeyCard> cards, DateTime now, {required bool isPro}) {
  final taste = KeyCardRules.tasteIds(cards);
  List<String> open(String chapter) => ([for (final c in cards) if (c.chapterKey == chapter && taste.contains(c.id)) c]..sort(KeyCardRules.bookOrder))
      .map((c) => c.id)
      .toList();
  FakeKcState due(int hours, {int reps = 2, int lapses = 0}) => FakeKcState(due: now.subtract(Duration(hours: hours)), reps: reps, lapses: lapses);
  final ratios = open(_ratios);
  final principles = open(_principles);
  final money = open(_money);
  final vocabulary = open(_vocabulary);
  final states = <String, FakeKcState>{
    ratios[0]: due(30, reps: 4),
    ratios[1]: due(6, reps: 2, lapses: 1),
    ratios[2]: due(2),
    ratios[3]: FakeKcState(due: now),
    ratios[4]: FakeKcState(due: now),
    principles[0]: due(20, reps: 3),
    principles[1]: due(3, lapses: 1),
    money[0]: due(9),
    money[1]: FakeKcState(due: now),
    vocabulary[0]: due(26, reps: 5),
    vocabulary[1]: due(4),
    vocabulary[2]: due(1, reps: 1),
  };
  if (isPro) {
    for (final (slug, hours) in [
      (_id(_retirement, 'entry-goodwill-not-in-books'), 12),
      (_id(_retirement, 'entry-shilpa-neeru-deepa'), 7),
      (_id(_ratios, 'fml-current-ratio'), 5),
      (_id(_money, 'formula-m4'), 8),
      (_id(_vocabulary, 'idiom-a-blessing-in-disguise'), 10),
    ]) {
      states[slug] = due(hours);
    }
    final longest = ([for (final c in cards) if (c.chapterKey == _molecular) c]..sort((a, b) => b.back.length.compareTo(a.back.length))).take(2);
    for (final c in longest) {
      states[c.id] = due(15, lapses: 1);
    }
  }
  final known = {for (final c in cards) c.id};
  states.removeWhere((id, _) => !known.contains(id));
  return states;
}

/// The fixture server, answering for the real chapters instead of the fixture deck. Every read fails as an
/// offline phone's would while the emulator has no network.
class DemoKeyCardsApi extends FakeKeyCardsApi {
  DemoKeyCardsApi._({required super.isPro, required super.cards, required DateTime Function() now, required super.states, super.lineFor})
    : _clock = now,
      super(now: now, chapterStates: {for (final e in _chapterStates.entries) e.key: e.value.$1});

  factory DemoKeyCardsApi({required bool isPro, required DateTime Function() now, List<String>? Function(String questionId)? lineFor}) {
    final cards = _realCards();
    return DemoKeyCardsApi._(isPro: isPro, cards: cards, now: now, states: _states(cards, now(), isPro: isPro), lineFor: lineFor);
  }

  final DateTime Function() _clock;

  Future<void> _online() async {
    final radio = await Connectivity().checkConnectivity();
    if (radio.every((r) => r == ConnectivityResult.none)) throw kcOffline;
  }

  List<KeyCard> _chapterCards(String key) => [for (final c in cards) if (c.chapterKey == key) c]..sort(KeyCardRules.bookOrder);

  List<KcDueCard> _queue() => KeyCardRules.dueQueue(
    [for (final c in cards) if (states[c.id] case final s?) KcDueCard(card: c, reps: s.reps, lapses: s.lapses, due: s.due)],
    now: _clock(),
    newAllowanceLeft: isPro ? KeyCardRules.proNewPerDayDefault : KeyCardRules.freeNewPerDay,
    limit: 1 << 20,
  );

  Json _todayJson(List<KcDueCard> queue) => {
    'due': queue.length,
    'newLeft': isPro ? KeyCardRules.proNewPerDayDefault : KeyCardRules.freeNewPerDay,
    'reviewsLeft': isPro ? null : reviewsLeft,
    'minutes': KeyCardRules.minutesFor(queue.length),
  };

  Json _chapterRow(String key, List<KcDueCard> queue) {
    final list = _chapterCards(key);
    final first = list.first;
    final (state, fading) = _chapterStates[key] ?? ('none', false);
    return {
      'key': key,
      'title': first.chapter ?? key,
      'ncert': {'book': first.source.book, 'chapter': first.source.chapterNo},
      'chip': null,
      'cards': list.length,
      'mustKnow': list.where((c) => c.mustKnow).length,
      'unlocked': isPro ? list.length : KeyCardRules.tasteIds(list).length,
      'added': list.where((c) => states.containsKey(c.id)).length,
      'due': queue.where((d) => d.card.chapterKey == key).length,
      'state': {'state': state, 'label': KcChapterState.labelFor(state), 'fading': fading},
    };
  }

  List<Json> _units(List<String> chapters, Json Function(String key) row) {
    final units = <String, List<Json>>{};
    for (final key in chapters) {
      final unit = _chapterCards(key).first.unit ?? '';
      units.putIfAbsent(unit, () => []).add(row(key));
    }
    return [for (final e in units.entries) {'unit': e.key, 'chapters': e.value}];
  }

  @override
  Json homeBody() {
    final queue = _queue();
    return {
      'enabled': true,
      'isPro': isPro,
      'subjects': [
        for (final (subject, title, chapters) in _subjects)
          {
            'subject': subject,
            'title': title,
            'option': subject == 'accountancy' ? options['accountancy'] : null,
            if (subject == 'accountancy')
              'options': {
                'label': 'Part',
                'choices': [
                  {'id': 'AFS', 'label': 'Analysis of Financial Statements'},
                  {'id': 'CAS', 'label': 'Computerised Accounting'},
                ],
                'default': 'AFS',
              },
            'units': _units(chapters, (key) => _chapterRow(key, queue)),
          },
      ],
      'today': _todayJson(queue),
    };
  }

  @override
  Future<(KcHome, Json)> home() async {
    await _online();
    return super.home();
  }

  @override
  Future<(KcDeck, Json)> deck(String chapterKey) async {
    await _online();
    return super.deck(chapterKey);
  }

  @override
  Future<(KcDue, Json)> due({int limit = 20}) async {
    await _online();
    return super.due(limit: limit);
  }

  /// Questions whose line Free has read today (the server counts `keycard_line` per IST day).
  final Set<String> _linesRead = {};

  /// Free reads three lines a day, as the server allows; the fourth question's block is the Pro gate.
  @override
  Future<KcLine> line(String questionId) async {
    await _online();
    final ids = lineFor?.call(questionId);
    if (ids == null || ids.isEmpty) return KcLine.parse({'cards': <Json>[], 'source': 'none'});
    if (!isPro && !_linesRead.contains(questionId)) {
      if (_linesRead.length >= KeyCardRules.freeLineNeededPerDay) throw const KeyCardsProRequired('keycard_line');
      _linesRead.add(questionId);
    }
    return KcLine.parse({
      'cards': [for (final c in cards) if (ids.contains(c.id)) c.toJson()],
      'source': 'linked',
      'left': isPro ? null : KeyCardRules.freeLineNeededPerDay - _linesRead.length,
    });
  }

  @override
  Future<KcMyChapters> myChapters(String subject) async {
    await _online();
    final chapters = [for (final s in _subjects) if (s.$1 == subject) ...s.$3];
    return KcMyChapters.parse({
      'subject': subject,
      'option': null,
      'units': _units(chapters, (key) {
        final list = _chapterCards(key);
        final (state, fading) = _chapterStates[key] ?? ('none', false);
        final added = list.where((c) => states.containsKey(c.id)).length;
        final must = list.where((c) => c.mustKnow).length;
        return {
          'key': key,
          'title': list.first.chapter ?? key,
          'state': state,
          'label': KcChapterState.labelFor(state),
          'fading': fading,
          if (isPro && state != 'none') ...{
            'n': 12,
            'right': 7,
            'reason': '7 of 12 right on the latest try at each question. Cards: ${added > 0 ? added - 1 : 0} of $added holding',
            'memory': {'holding': added > 0 ? added - 1 : 0, 'added': added, 'mustKnow': must},
          },
          'marksLost': 6,
          'available': {'questions': 140, 'cards': list.length},
        };
      }),
    });
  }
}

List<Override> demoKeyCardsOverrides() => [
  keyCardsApiProvider.overrideWithValue(DemoKeyCardsApi(isPro: demoPro, now: DateTime.now, lineFor: _demoLine)),
];
