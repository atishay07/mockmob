// Learn v2 from the recordings in test/fixtures/learn2/ (README.md there): a LearnApi that answers every route with the
// bodies the web dev preview really sent, with enough state for widget tests and goldens. A start returns the recorded run
// (kept until it ends, so a second start of the kind picks it up); an answer is graded with the recorded keys and answers
// with the recorded right or wrong body; Keep, the ratings and the end answer the recorded bodies; a wrong answer and a
// Missed put the card back in three items on, as the server does.
//
// Switches (fields, changeable mid-test): pro (Pro or Free), newStudent (new or returning), freeUsed (Free's day is
// claimed), offline, error (503), notFound (404 chapter and run), slow (each call waits), off (404 LEARN_OFF); failOn
// fails one method; startFixtures picks the run a kind starts.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/data/learn_prefs.dart';
import 'package:mockmob/features/learn2/data/learn_providers.dart';

/// The recorded chapters: Admission of a Partner (the feed, covers, cards view, previews), Accounting for Partnership:
/// Basic Concepts (the mix, recap, a new student's feed), Change in Profit Sharing Ratio (four piles at 20 minutes) and
/// Comparative and Common Size Statements (a short chapter at 20 minutes: shrink, addNext).
const String l2Aop = 'accountancy.admission-of-partner';
const String l2Pf = 'accountancy.partnership-fundamentals';
const String l2Cpsr = 'accountancy.change-in-profit-sharing-ratio';
const String l2Ccss = 'accountancy.comparative-and-common-size-statements';

/// A chapter that is not there (404 CHAPTER_NOT_FOUND).
const String l2Missing = 'accountancy.no-such-chapter';

/// The recordings, read once per test run.
abstract final class LearnFixtures {
  static const String dir = 'test/fixtures/learn2';
  static final Map<String, Object?> _cache = {};

  static Object? _read(String name) => _cache.putIfAbsent(name, () => jsonDecode(File('$dir/$name.json').readAsStringSync()));

  /// A recorded body, as a fresh copy the caller may change.
  static Json json(String name) => asJson(jsonDecode(jsonEncode(_read(name))));

  static Json get _fixtures => asJson(asJson(_read('manifest'))['fixtures']);

  /// Every recorded response, in recording order (manifest.json).
  static List<String> names() => [..._fixtures.keys];

  /// The HTTP status [name] was recorded with.
  static int status(String name) => asInt(asJson(_fixtures[name])['status']) ?? 200;

  /// The route [name] answered (`/api/learn/runs/:run/end` style, run ids kept).
  static String route(String name) => asStringOr(asJson(_fixtures[name])['route'], '');

  /// A recorded error answer as the LearnError the app makes of it.
  static LearnError error(String name) => LearnError.fromResponse(status(name), json(name));

  /// The parsed models of the recordings.
  static LearnSubjectData subject(String name) => LearnSubjectData.parse(json(name));
  static LearnCovers covers(String name) => LearnCovers.parse(json(name));
  static LearnPreview preview(String name) => LearnPreview.parse(json(name));
  static LearnRun run(String name) => LearnRun.parse(json(name));
  static LearnAnswer answer(String name) => LearnAnswer.parse(json(name));
  static LearnRateResult rate(String name) => LearnRateResult.parse(json(name));
  static LearnEnd end(String name) => LearnEnd.parse(json(name));

  /// The right key of a recorded question (learnt in a scratch student), null for one never served.
  static String? key(String questionId) => asString(asJson(asJson(_read('answer_keys'))[questionId])['key']);

  static String explanation(String questionId) => asStringOr(asJson(asJson(_read('answer_keys'))[questionId])['explanation'], '');
}

/// One run the fake holds.
class _FakeRun {
  _FakeRun(this.body) : items = [...asJsonList(body['items'])];

  final Json body;
  final List<Json> items;
  final Map<String, Json> answered = {};
  final Map<String, Json> rated = {};
  final Set<String> done = {};
  int revisePile = 0;
  int reinserts = 0;
  Json? endBody;

  String get id => asStringOr(body['id'], '');
  String get kind => asStringOr(body['kind'], LearnKinds.mix);
  bool get ended => endBody != null;

  Json view({required bool resumed}) => {
    ...body,
    'items': resumed ? [for (final i in items) if (!done.contains(i['id'])) i] : items,
    'revisePile': {'count': revisePile},
    'resumed': resumed ? {'done': done.length, 'of': items.length} : null,
  };

  int indexOf(String itemId) => items.indexWhere((i) => i['id'] == itemId);

  /// Puts [item] back in three places after [after] (never past the end), as the server's reinsert does.
  Json reinsert(Json item, String after) {
    final at = (indexOf(after) + 3).clamp(0, items.length);
    final itemId = '$id-r${++reinserts}';
    final copy = {...item, 'id': itemId};
    items.insert(at, copy);
    return {'itemId': itemId, 'at': at, 'item': copy};
  }
}

class FixtureLearnApi implements LearnApi {
  FixtureLearnApi({
    this.pro = true,
    this.newStudent = false,
    this.freeUsed = false,
    this.offline = false,
    this.error = false,
    this.notFound = false,
    this.off = false,
    this.slow = Duration.zero,
    Map<String, String>? startFixtures,
    Map<String, LearnError>? failOn,
  }) : startFixtures = {...?startFixtures},
       failOn = {...?failOn};

  /// Pro (true) or Free.
  bool pro;

  /// The preview's `new` student (nothing studied) instead of the returning `commerce` one.
  bool newStudent;

  /// Free's session for today is used: a feed start answers 402 FREE_SESSION_USED, a mix is Key cards only, and the home,
  /// the covers and the chapter page say so. The first answered question of a Free feed or mix sets it (the server's claim).
  bool freeUsed;

  /// Every call fails as an offline phone's would.
  bool offline;

  /// Every call fails with 503 LEARN_UNAVAILABLE.
  bool error;

  /// Starts, previews and the Cards view answer 404 CHAPTER_NOT_FOUND; a run read 404 RUN_NOT_FOUND.
  bool notFound;

  /// Learn v2 is off on the server (404 LEARN_OFF).
  bool off;

  /// Every call waits this long first (pump past it in a widget test).
  Duration slow;

  /// The fixture a start of a kind returns (`feed`, `mix`, `recap`, `cards`, `level`), instead of the default for the plan
  /// and student; e.g. `{'mix': 'run_start_mix_aop_resume_pro'}` for a picked-up run.
  final Map<String, String> startFixtures;

  /// One method's failure, by its name (`startRun`, `answer`, `keep`, `rate`, `end`, `getRun`, `preview`, `subject`, `home`,
  /// `covers`, `shelves`, `search`, `chapterCards`, `subjectCards`, `saveQuestion`).
  final Map<String, LearnError> failOn;

  /// 402 PRO_REQUIRED, the answer to a Keep on a card Free cannot open (for [failOn]).
  static final LearnError proRequired = LearnError.fromResponse(402, {'error': 'PRO_REQUIRED', 'reason': 'keycards'});

  /// 409 QUESTION_CHANGED (for [failOn]).
  static final LearnError questionChanged = LearnError.fromResponse(409, {'error': 'QUESTION_CHANGED'});

  /// An offline phone's failure.
  static const LearnError offlineError = LearnError(kind: LearnErrorKind.error, code: 'network', offline: true);

  /// Every call, as `method detail`.
  final List<String> calls = [];
  final List<RunStart> starts = [];
  final List<LearnPreviewKey> previews = [];
  final List<({String runId, String itemId, String choice})> answers = [];
  final List<({String runId, String itemId, int rating})> ratings = [];
  final List<({String runId, String itemId})> keeps = [];
  final List<String> ended = [];

  /// Whether each [end] call was a stop (`?stop=1`), in the order of [ended].
  final List<bool> stops = [];
  final List<String> saved = [];

  final Map<String, _FakeRun> _runs = {};
  int _fresh = 0;

  String get _plan => pro ? 'pro' : 'free';

  Future<void> _enter(String method, [String detail = '']) async {
    calls.add(detail.isEmpty ? method : '$method $detail');
    if (slow > Duration.zero) await Future<void>.delayed(slow);
    if (off) throw const LearnError.off();
    if (offline) throw offlineError;
    if (error) throw LearnError.fromResponse(503, {'error': 'LEARN_UNAVAILABLE', 'message': 'Learn could not be read.'});
    final fail = failOn[method];
    if (fail != null) throw fail;
  }

  // ---------------------------------------------------------------- reads

  @override
  Future<LearnSubjectData> subject(String subject) async {
    await _enter('subject', subject);
    final String name;
    if (newStudent) {
      name = 'subject_accountancy_new_$_plan';
    } else if (!pro) {
      name = freeUsed ? 'subject_accountancy_free_used' : 'subject_accountancy_free';
    } else {
      name = const {'economics', 'business_studies', 'english'}.contains(subject) ? 'subject_${subject}_pro' : 'subject_accountancy_pro';
    }
    return LearnSubjectData.parse(LearnFixtures.json(name));
  }

  /// The combined read Learn home makes (`GET /api/learn/home`): the subject body with its roadmap offer and the shelves. A
  /// returning student's Accountancy has an unfinished run (the pick-up offer); Economics, Business Studies and English are
  /// the returning offer (Today's 10 minutes); a new student starts at chapter 1; Free after the claim is the Free-done block.
  @override
  Future<LearnSubjectData> home(String subject) async {
    await _enter('home', subject);
    final String name;
    if (newStudent) {
      name = 'home_accountancy_new_$_plan';
    } else if (!pro) {
      name = subject == 'economics' ? 'home_economics_free' : (freeUsed ? 'home_accountancy_free_used' : 'home_accountancy_free');
    } else {
      name = const {'economics', 'business_studies', 'english'}.contains(subject) ? 'home_${subject}_pro' : 'home_accountancy_pro';
    }
    return LearnSubjectData.parse(LearnFixtures.json(name));
  }

  @override
  Future<LearnCovers> covers(String subject) async {
    await _enter('covers', subject);
    final String name;
    if (newStudent) {
      name = 'covers_accountancy_new_$_plan';
    } else if (!pro) {
      name = freeUsed ? 'covers_accountancy_free_used' : 'covers_accountancy_free';
    } else {
      final open = _runs.values.any((r) => r.kind == LearnKinds.feed && !r.ended && r.done.isNotEmpty);
      name = open ? 'covers_accountancy_pro_open' : 'covers_accountancy_pro';
    }
    return LearnCovers.parse(LearnFixtures.json(name));
  }

  @override
  Future<LearnShelves> shelves([String? subject]) async {
    await _enter('shelves', subject ?? '');
    return LearnShelves.parse(LearnFixtures.json(newStudent ? 'shelves_new_pro' : 'shelves_$_plan'));
  }

  /// "goodwill" answers the recorded search; any other query finds nothing (the empty state).
  @override
  Future<LearnSearch> search(String subject, String query) async {
    await _enter('search', query);
    final q = query.trim();
    if (q.length < 2) return LearnSearch(query: q, tooShort: true);
    if (!q.toLowerCase().contains('goodwill')) return LearnSearch(query: q);
    return LearnSearch.parse({...LearnFixtures.json('search_goodwill_$_plan'), 'query': q});
  }

  /// The recorded Admission of a Partner cards (Pro: every card, or the Must-know read; Free: its open cards), filtered as
  /// the server filters for revise and missed.
  @override
  Future<LearnChapterCards> chapterCards(String chapter, {String filter = 'all'}) async {
    await _enter('chapterCards', '$chapter $filter');
    if (notFound || chapter == l2Missing) throw LearnFixtures.error('error_404_chapter_not_found_preview');
    final body = LearnFixtures.json(pro ? (filter == 'must' ? 'cards_aop_must_pro' : 'cards_aop_all_pro') : 'cards_aop_all_free');
    bool keep(Json c) => switch (filter) {
      'must' => c['importance'] == 'must',
      'revise' => c['inRevise'] == true,
      'missed' => c['missedLately'] == true,
      'due' => false,
      _ => true,
    };
    body['sections'] = [
      for (final s in asJsonList(body['sections']))
        if ([for (final c in asJsonList(s['cards'])) if (keep(c)) c] case final cards when cards.isNotEmpty) {...s, 'cards': cards},
    ];
    return LearnChapterCards.parse(body);
  }

  /// The recorded due shelf over Accountancy (whatever the filter: a stand-in for the others).
  @override
  Future<LearnSubjectCards> subjectCards(String subject, {String filter = 'all'}) async {
    await _enter('subjectCards', '$subject $filter');
    return LearnSubjectCards.parse({...LearnFixtures.json('cards_subject_due_$_plan'), 'filter': filter});
  }

  @override
  Future<LearnPreview> preview({required String chapterKey, required int minutes, List<String> leaveOut = const [], bool addNext = false}) async {
    previews.add(LearnPreviewKey(chapterKey: chapterKey, minutes: minutes, leaveOut: leaveOut, addNext: addNext));
    await _enter('preview', '$chapterKey $minutes');
    if (notFound || chapterKey == l2Missing) throw LearnFixtures.error('error_404_chapter_not_found_preview');
    final length = minutes <= 5 ? 5 : (minutes >= 20 ? 20 : 10);
    final String name;
    if (newStudent) {
      name = 'preview_aop_10_new_$_plan';
    } else if (!pro) {
      name = freeUsed ? 'preview_pf_10_free_used' : 'preview_aop_${length}_free';
    } else if (chapterKey == l2Ccss) {
      name = addNext ? 'preview_ccss_20_addnext_pro' : 'preview_ccss_20_pro';
    } else if (chapterKey == l2Cpsr) {
      name = addNext ? 'preview_cpsr_20_addnext_pro' : 'preview_cpsr_20_pro';
    } else if (chapterKey == l2Pf) {
      name = 'preview_pf_10_pro';
    } else if (leaveOut.contains(LearnPiles.questions)) {
      name = 'preview_aop_10_out_questions_pro';
    } else {
      name = 'preview_aop_${length}_pro';
    }
    return LearnPreview.parse(LearnFixtures.json(name));
  }

  // ---------------------------------------------------------------- runs

  String _startFixture(RunStart start) {
    final own = startFixtures[start.kind];
    if (own != null) return own;
    switch (start.kind) {
      case LearnKinds.feed:
        if (!pro && freeUsed) throw LearnFixtures.error('error_402_free_session_used');
        if (newStudent) return 'run_start_feed_pf_new_pro';
        return pro ? 'run_start_feed_aop_pro' : 'run_start_feed_aop_free';
      case LearnKinds.recap:
        return 'run_start_recap_pf_pro';
      case LearnKinds.cards:
        return 'run_start_cards_due_pro';
      case LearnKinds.level:
        return 'run_start_level_new_pro';
      default:
        if (!pro && freeUsed) return 'run_start_mix_pf_free_cards_only';
        return newStudent ? 'run_start_mix_aop_20_new_pro' : 'run_start_mix_pf_pro';
    }
  }

  @override
  Future<LearnRun> startRun(RunStart start) async {
    starts.add(start);
    await _enter('startRun', '${start.kind} ${start.chapterKey ?? ''} ${start.minutes}');
    if (notFound || start.chapterKey == l2Missing) throw LearnFixtures.error('error_404_chapter_not_found_start');
    final resume = start.resume;
    if (resume != null) {
      final held = _runs[resume];
      if (held != null && !held.ended) return LearnRun.parse(held.view(resumed: true));
    }
    final body = LearnFixtures.json(_startFixture(start));
    final id = asStringOr(body['id'], 'lr_fixture');
    final held = _runs[id];
    // The same run again, as the server's request key or same-day resume gives it; fresh (or an ended run) is a new one.
    if (held != null && !held.ended && !start.fresh) return LearnRun.parse(held.view(resumed: held.done.isNotEmpty));
    final run = _FakeRun(held == null ? body : {...body, 'id': '$id-${++_fresh}'});
    _runs[run.id] = run;
    return LearnRun.parse(run.view(resumed: false)..['resumed'] = body['resumed']);
  }

  _FakeRun _run(String runId) {
    final run = _runs[runId];
    if (run == null) throw LearnFixtures.error('error_404_run_not_found');
    return run;
  }

  LearnError _closed(_FakeRun run) => LearnError.fromResponse(409, {
    'error': 'RUN_ENDED',
    'endHref': '${run.kind == LearnKinds.feed ? '/explore/run' : '/learn/run'}?run=${run.id}&end=1',
  });

  @override
  Future<LearnRun> getRun(String runId) async {
    await _enter('getRun', runId);
    if (notFound) throw LearnFixtures.error('error_404_run_not_found');
    final run = _run(runId);
    if (run.ended) throw _closed(run);
    return LearnRun.parse(run.view(resumed: true));
  }

  @override
  Future<LearnAnswer> answer(String runId, String itemId, String choice) async {
    answers.add((runId: runId, itemId: itemId, choice: choice));
    await _enter('answer', '$itemId $choice');
    final run = _run(runId);
    final prior = run.answered[itemId];
    if (prior != null) return LearnAnswer.parse(prior);
    if (run.ended) throw _closed(run);
    final at = run.indexOf(itemId);
    if (at < 0 || run.items[at]['type'] != 'question') throw LearnError.fromResponse(422, {'error': 'ITEM_NOT_A_QUESTION'});
    final item = run.items[at];
    final questionId = asStringOr(asJson(item['question'])['id'], '');
    final key = LearnFixtures.key(questionId) ?? 'A';
    final picked = choice.trim().toUpperCase();
    final mistake = item['origin'] == 'mistake';
    final Json body;
    if (picked == key) {
      body = LearnFixtures.json('answer_right_pro');
      if (mistake) {
        final fixed = LearnFixtures.json('answer_mistake_fixed_pro');
        body.addAll({'fixed': true, 'fixedText': fixed['fixedText'], 'retired': false, 'line': fixed['line']});
      }
    } else {
      body = LearnFixtures.json('answer_wrong_pro');
      if (!mistake) body.remove('retired');
      // The line's card comes back three items on ("The line you needed").
      final back = asJson(body['reinsert']);
      if (back.isNotEmpty) body['reinsert'] = run.reinsert(asJson(back['item']), itemId);
    }
    body.addAll({'key': key, 'choice': picked, 'explanation': LearnFixtures.explanation(questionId)});
    run.answered[itemId] = body;
    run.done.add(itemId);
    // Free's day is claimed at the first answered question of a mix or a feed.
    if (!pro && (run.kind == LearnKinds.mix || run.kind == LearnKinds.feed)) freeUsed = true;
    return LearnAnswer.parse(body);
  }

  Json _cardItem(_FakeRun run, String itemId) {
    final at = run.indexOf(itemId);
    if (at < 0 || run.items[at]['type'] == 'question') throw LearnError.fromResponse(422, {'error': 'ITEM_NOT_A_CARD'});
    return run.items[at];
  }

  @override
  Future<LearnRateResult> rate(String runId, String itemId, int rating) async {
    ratings.add((runId: runId, itemId: itemId, rating: rating));
    await _enter('rate', '$itemId $rating');
    final run = _run(runId);
    final prior = run.rated[itemId];
    if (prior != null) return LearnRateResult.parse({...prior, 'replay': true, 'revisePile': {'count': run.revisePile}});
    if (run.ended) throw _closed(run);
    final item = _cardItem(run, itemId);
    final Json body;
    if (item['type'] == 'lesson' || run.kind == LearnKinds.recap || item['recap'] == true) {
      body = {'ok': true, 'stamp': null, 'revisePile': {'count': run.revisePile}, 'limit': null};
    } else if (item['look'] == true) {
      body = {'ok': true, 'saved': false, 'look': true, 'stamp': null, 'revisePile': {'count': run.revisePile}, 'limit': run.body['looks']};
    } else if (rating == 1) {
      // Round 5, LK38: every rated card is scheduled, Missed it included, so the pile counts it. The copy put back in the run is a last
      // look: it carries no words (`returns`).
      run.revisePile += 1;
      body = LearnFixtures.json('rate_missed_pro');
      body['reinsert'] = run.reinsert({...item, 'stage': 'again', 'seconds': 12}..remove('reason')..remove('returns'), itemId);
      body['revisePile'] = {'count': run.revisePile};
    } else if (rating == 3 || rating == 4) {
      run.revisePile += 1;
      body = LearnFixtures.json(rating == 3 ? 'rate_got_it_pro' : 'rate_easy_pro');
      body['revisePile'] = {'count': run.revisePile};
      // The stamp is the key's promise: "Back " and the words the card carried.
      final words = (item['returns'] as Map?)?[rating == 3 ? 'got' : 'easy'];
      if (words is String) body['stamp'] = 'Back $words';
    } else {
      throw LearnError.fromResponse(422, {'error': 'INVALID_RATING'});
    }
    run.rated[itemId] = body;
    run.done.add(itemId);
    return LearnRateResult.parse(body);
  }

  @override
  Future<LearnRateResult> keep(String runId, String itemId) async {
    keeps.add((runId: runId, itemId: itemId));
    await _enter('keep', itemId);
    final run = _run(runId);
    final prior = run.rated[itemId];
    if (prior != null) return LearnRateResult.parse({...prior, 'replay': true});
    if (run.ended) throw _closed(run);
    _cardItem(run, itemId);
    final body = LearnFixtures.json(pro ? 'keep_pro' : 'keep_free')..['revisePile'] = {'count': run.revisePile};
    run.rated[itemId] = body;
    run.done.add(itemId);
    return LearnRateResult.parse(body);
  }

  /// The recorded end of the run's kind (a feed's on Pro, or Free's after the claim; a mix's for every other kind). [stop] (the
  /// stop sheet) answers the recorded stopped end of a picked-up run and leaves the run open.
  @override
  Future<LearnEnd> end(String runId, {bool stop = false}) async {
    stops.add(stop);
    ended.add(runId);
    await _enter('end', runId);
    final run = _run(runId);
    if (stop && run.kind != LearnKinds.feed) return LearnEnd.parse(LearnFixtures.json('run_end_mix_aop_stopped_pro'));
    final body = run.endBody ??= LearnFixtures.json(
      run.kind == LearnKinds.feed ? (!pro && freeUsed ? 'run_end_feed_aop_free' : 'run_end_feed_aop_pro') : 'run_end_mix_pf_pro',
    );
    return LearnEnd.parse(body);
  }

  @override
  Future<LearnSaved> saveQuestion(String questionId) async {
    await _enter('saveQuestion', questionId);
    if (!saved.contains(questionId)) {
      if (!pro && saved.length >= 25) throw LearnError.fromResponse(402, {'error': 'Free bookmark limit reached', 'limit': 25});
      saved.add(questionId);
    }
    return LearnSaved.parse({'saved': true, 'count': saved.length, 'limit': pro ? null : 25});
  }
}

/// The overrides a Learn v2 screen needs under test: the fixture server, an in-memory store and the shared subject held at
/// [subject] (so Practice's subject, its catalogue and the account are not read). [on] fixes the server switch.
List<Override> learnFixtureOverrides(FixtureLearnApi api, {PrefsStore? store, String subject = 'accountancy', bool? on}) => [
  learnApiProvider.overrideWithValue(api),
  learn2PrefsStoreProvider.overrideWithValue(store ?? MemoryPrefsStore()),
  learnSubjectIdProvider.overrideWithValue(subject),
  if (on != null) learnOnProvider.overrideWithBuild((ref, notifier) => on),
];
