import 'dart:convert';

import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart' show nowProvider;
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/keycards/data/keycards_api.dart';
import 'package:mockmob/features/keycards/data/keycards_models.dart';
import 'package:mockmob/features/keycards/data/keycards_providers.dart';
import 'package:mockmob/features/keycards/data/keycards_rules.dart';

import 'fixture_deck.dart';

/// The fixture deck's cards, parsed.
List<KeyCard> kcFixtureCards() {
  final j = asJson(jsonDecode(kcFixtureDeckJson));
  return [for (final c in asJsonList(j['cards'])) ?KeyCard.tryParse(c)];
}

const String kcChapter1 = 'business_studies.nature-and-significance-of-management';
const String kcChapter2 = 'business_studies.principles-of-management';
const String kcAccountancyChapter = 'accountancy.accounting-for-partnership-basic-concepts';

/// A fixed evening: 31 October 2026, 9:40 PM on the phone.
final DateTime kcNow = DateTime(2026, 10, 31, 21, 40);

/// One card's place on the student's schedule in the fake server.
class FakeKcState {
  FakeKcState({required this.due, this.reps = 0, this.lapses = 0});

  DateTime due;
  int reps;
  int lapses;
}

/// A Key cards server in memory, answering with bodies shaped exactly as KEYCARDS-BUILD-SPEC 2e writes them
/// (the app then parses them like a real reply). It keeps the website's rules ([KeyCardRules]): Free sees
/// five cards a chapter and 10 reviews a day; a review moves the card on a plain ladder (the real server's
/// FSRS is not the phone's to copy).
class FakeKeyCardsApi implements KeyCardsApi {
  FakeKeyCardsApi({
    this.isPro = false,
    List<KeyCard>? cards,
    DateTime Function()? now,
    this.reviewsLeft = KeyCardRules.freeReviewsPerDay,
    this.off = false,
    this.failWith,
    Map<String, FakeKcState>? states,
    Map<String, List<String>>? links,
    Map<String, String>? chapterStates,
  }) : cards = cards ?? kcFixtureCards(),
       _now = now ?? (() => kcNow),
       states = states ?? {},
       links = links ?? {},
       chapterStates = chapterStates ?? {kcChapter1: 'mid', kcChapter2: 'none'};

  /// A student with Chapter 1's taste cards in Revise: three due now, two new.
  factory FakeKeyCardsApi.withProgress({bool isPro = false, int reviewsLeft = KeyCardRules.freeReviewsPerDay, Object? failWith}) {
    final cards = kcFixtureCards();
    final now = kcNow;
    final ids = [for (final c in cards) if (c.chapterKey == kcChapter1) c.id];
    return FakeKeyCardsApi(
      isPro: isPro,
      cards: cards,
      reviewsLeft: reviewsLeft,
      failWith: failWith,
      states: {
        ids[0]: FakeKcState(due: now.subtract(const Duration(hours: 5)), reps: 3),
        ids[1]: FakeKcState(due: now.subtract(const Duration(hours: 2)), reps: 2, lapses: 1),
        ids[2]: FakeKcState(due: now.subtract(const Duration(minutes: 30)), reps: 1),
        ids[3]: FakeKcState(due: now),
        ids[4]: FakeKcState(due: now),
      },
      links: {'q-wrong-1': [ids[1], ids[2]]},
    );
  }

  final bool isPro;
  final List<KeyCard> cards;
  final DateTime Function() _now;
  int reviewsLeft;
  bool off;

  /// Thrown by every read when set (an offline [ApiError], say).
  Object? failWith;
  final Map<String, FakeKcState> states;
  final Map<String, List<String>> links;

  /// `chapterKey -> state`, for the home's state labels.
  final Map<String, String> chapterStates;

  final List<Json> reviews = [];
  final List<Json> reports = [];
  final Map<String, String> options = {'accountancy': 'AFS'};
  int homeReads = 0;

  void _guard() {
    if (off) throw const KeyCardsOff();
    final f = failWith;
    if (f != null) throw f;
  }

  List<KeyCard> _chapter(String key) => [for (final c in cards) if (c.chapterKey == key) c]..sort(KeyCardRules.bookOrder);

  List<KcDueCard> get _stateCards => [
    for (final c in cards)
      if (states[c.id] case final s?) KcDueCard(card: c, reps: s.reps, lapses: s.lapses, due: s.due),
  ];

  List<KcDueCard> _queue({int limit = 20}) =>
      KeyCardRules.dueQueue(_stateCards, now: _now(), newAllowanceLeft: isPro ? KeyCardRules.proNewPerDayDefault : KeyCardRules.freeNewPerDay, limit: limit);

  Json _today() {
    final due = _queue(limit: 1 << 20).length;
    return {
      'due': due,
      'newLeft': isPro ? KeyCardRules.proNewPerDayDefault : KeyCardRules.freeNewPerDay,
      'reviewsLeft': isPro ? null : reviewsLeft,
      'minutes': KeyCardRules.minutesFor(due),
    };
  }

  Json _chapterJson(String key, String title, int ncertChapter, {String? chip}) {
    final list = _chapter(key);
    final open = isPro ? list.length : KeyCardRules.tasteIds(list).length;
    final s = chapterStates[key] ?? 'none';
    return {
      'key': key,
      'title': title,
      'ncert': {'book': 'Business Studies Part 1', 'chapter': ncertChapter},
      'chip': chip,
      'cards': list.length,
      'mustKnow': list.where((c) => c.mustKnow).length,
      'unlocked': open,
      'added': list.where((c) => states.containsKey(c.id)).length,
      'due': _queue(limit: 1 << 20).where((d) => d.card.chapterKey == key).length,
      'state': {'state': s, 'label': KcChapterState.labelFor(s), 'fading': s == 'strong'},
    };
  }

  /// The body of `GET /api/keycards`.
  Json homeBody() => {
    'enabled': true,
    'isPro': isPro,
    'subjects': [
      {
        'subject': 'business_studies',
        'title': 'Business Studies',
        'option': null,
        'units': [
          {'unit': 'Nature and Significance of Management', 'chapters': [_chapterJson(kcChapter1, 'Nature and Significance of Management', 1)]},
          {'unit': 'Principles of Management', 'chapters': [_chapterJson(kcChapter2, 'Principles of Management', 2)]},
        ],
      },
      {
        'subject': 'accountancy',
        'title': 'Accountancy',
        'option': options['accountancy'],
        'options': {
          'label': 'Part',
          'choices': [
            {'id': 'AFS', 'label': 'Analysis of Financial Statements'},
            {'id': 'CAS', 'label': 'Computerised Accounting'},
          ],
          'default': 'AFS',
        },
        'units': [
          {
            'unit': 'Accounting for Partnership Firms',
            'chapters': [
              {
                'key': kcAccountancyChapter,
                'title': 'Accounting for Partnership: Basic Concepts',
                'ncert': {'book': 'Accountancy Part 1', 'chapter': 1},
                'chip': null,
                'cards': 0,
                'mustKnow': 0,
                'unlocked': 0,
                'added': 0,
                'due': 0,
                'state': {'state': 'thin', 'label': 'Too few answers', 'fading': false},
              },
            ],
          },
        ],
      },
    ],
    'today': _today(),
  };

  @override
  Future<(KcHome, Json)> home() async {
    homeReads++;
    _guard();
    final body = homeBody();
    return (KcHome.parse(body), body);
  }

  /// The body of `GET /api/keycards/deck?chapter=`.
  Json deckBody(String chapterKey) {
    final list = _chapter(chapterKey);
    final view = KeyCardRules.deckView(list, isPro: isPro);
    final first = list.firstOrNull;
    return {
      'chapter': {
        'key': chapterKey,
        'title': first?.chapter ?? 'Accounting for Partnership: Basic Concepts',
        'unit': first?.unit ?? 'Accounting for Partnership Firms',
        'ncert': {'book': first?.source.book ?? 'Accountancy Part 1', 'chapter': first?.source.chapterNo ?? 1},
        'chip': null,
      },
      'cards': [for (final e in view) e.toJson()],
      'counts': {'total': list.length, 'mustKnow': list.where((c) => c.mustKnow).length, 'locked': view.where((e) => e.locked).length},
      'added': [for (final c in list) if (states.containsKey(c.id)) c.id],
    };
  }

  @override
  Future<(KcDeck, Json)> deck(String chapterKey) async {
    _guard();
    final body = deckBody(chapterKey);
    return (KcDeck.parse(body, chapterKey: chapterKey), body);
  }

  @override
  Future<KcAddResult> add({String? chapter, List<String>? cardIds}) async {
    _guard();
    final ids = chapter != null ? KeyCardRules.chapterAddSet(cards, chapter, isPro: isPro) : (cardIds ?? const <String>[]);
    var n = 0;
    for (final id in ids) {
      if (states.containsKey(id)) continue;
      states[id] = FakeKcState(due: _now());
      n++;
    }
    return KcAddResult.parse({'added': n, 'today': _today()});
  }

  @override
  Future<(KcDue, Json)> due({int limit = 20}) async {
    _guard();
    final body = {'cards': [for (final d in _queue(limit: limit)) d.toJson()], 'today': _today()};
    return (KcDue.parse(body), body);
  }

  @override
  Future<KcReviewResult> review({required String cardId, required int rating, required String mode, DateTime? clientReviewedAt}) async {
    _guard();
    if (!isPro && mode != KeyCardRules.modeLastLook) {
      if (reviewsLeft <= 0) throw const KeyCardsProRequired();
      reviewsLeft--;
    }
    reviews.add({'cardId': cardId, 'rating': rating, 'mode': mode, 'clientReviewedAt': ?clientReviewedAt?.toUtc().toIso8601String()});
    final s = states.putIfAbsent(cardId, () => FakeKcState(due: _now()));
    final days = switch (rating) {
      KeyCardRules.missed => 1,
      KeyCardRules.easy => 7,
      _ => 3,
    };
    if (mode != KeyCardRules.modeLastLook) {
      s
        ..reps += 1
        ..lapses += rating == KeyCardRules.missed ? 1 : 0
        ..due = _now().add(Duration(days: days));
    }
    return KcReviewResult.parse({
      'ok': true,
      'next': {'due_at': s.due.toUtc().toIso8601String(), 'interval_days': days},
      'today': _today(),
    });
  }

  @override
  Future<KcLine> line(String questionId) async {
    _guard();
    final ids = links[questionId];
    if (ids == null) return KcLine.parse({'cards': <Json>[], 'source': 'none'});
    return KcLine.parse({
      'cards': [for (final c in cards) if (ids.contains(c.id)) c.toJson()],
      'source': 'linked',
      'left': isPro ? null : 2,
    });
  }

  @override
  Future<void> report({required String cardId, required String reason}) async {
    _guard();
    reports.add({'cardId': cardId, 'reason': reason});
  }

  @override
  Future<KcMyChapters> myChapters(String subject) async {
    _guard();
    return KcMyChapters.parse({
      'subject': subject,
      'option': null,
      'units': [
        {
          'unit': 'Nature and Significance of Management',
          'chapters': [
            {
              'key': kcChapter1,
              'title': 'Nature and Significance of Management',
              'state': 'mid',
              'label': 'Getting there',
              'fading': false,
              if (isPro) ...{'n': 12, 'right': 7, 'reason': '7 of 12 right on the latest try at each question. Cards: 3 of 5 holding', 'memory': {'holding': 3, 'added': 5, 'mustKnow': 6}},
              'marksLost': 6,
              'available': {'questions': 140, 'cards': 8},
            },
          ],
        },
      ],
    });
  }

  @override
  Future<({String subject, String option})> setOption({required String subject, required String option}) async {
    _guard();
    options[subject] = option;
    return (subject: subject, option: option);
  }
}

/// A signed-in student, Free or Pro.
AuthSnapshot kcStudent({bool isPro = false}) => AuthSnapshot(
  status: AuthStatus.signedIn,
  userId: 'u1',
  email: 'asha.verma@example.com',
  name: 'Asha Verma',
  isPro: isPro,
  subjects: const ['accountancy', 'business_studies', 'economics', 'english'],
);

class KcFakeAuth extends AuthController {
  KcFakeAuth(this.snapshot);

  final AuthSnapshot snapshot;

  @override
  AuthSnapshot build() => snapshot;

  @override
  Future<void> reload() async {}
}

/// The overrides a Key cards screen needs under test: the fake server, a signed-in student, an in-memory
/// store and a fixed clock. Ratings go straight to the fake (the default [DirectKeyCardReviews]).
List<Override> keyCardsOverrides(FakeKeyCardsApi api, {bool? isPro, PrefsStore? store, DateTime Function()? now}) => [
  keyCardsApiProvider.overrideWithValue(api),
  keyCardsPrefsStoreProvider.overrideWithValue(store ?? MemoryPrefsStore()),
  authSnapshotProvider.overrideWith(() => KcFakeAuth(kcStudent(isPro: isPro ?? api.isPro))),
  nowProvider.overrideWithValue(now ?? () => kcNow),
];

/// An offline read.
const ApiError kcOffline = ApiError(kind: ApiErrorKind.network, code: 'network');
