// Where a Learn v2 link goes in the app (APP-1101 section 6; the web's learn2/links.js). One place builds every
// location, so no screen writes a path by hand, and the server's production hrefs (an end screen's endHref, a
// suggestion's href, a 402's options) are mapped onto the app's own routes.
//
//   web                         app
//   /learn                      the Learn door of Practice (/practice?door=learn)
//   /learn/find                 the Learn door with Find open
//   /learn/c/<key>              /learn/c/<key>                 the chapter page
//   /learn/c/<key>/cards        /learn/c/<key>/cards           the Cards view
//   /learn/run?...              /learn/session?...             a run (the app's /learn/run/<id> is the lesson run)
//   /explore                    /explore                       Explore: the chapter feed covers
//   /explore/run?...            /explore/feed?...              a feed
//   /review/revise              /review/revise                 Revise

import '../../core/router/routes.dart';

/// A run to open: what the run screen starts, resumes or shows the end of. The same fields as the web's
/// `links.run` query (chapter, min, kind, out, cards, run, end) plus `next` (the next chapter joins) and `fresh`.
class RunLaunch {
  const RunLaunch({
    this.chapterKey,
    this.minutes = 10,
    this.kind = 'mix',
    this.leaveOut = const [],
    this.cardIds = const [],
    this.runId,
    this.end = false,
    this.addNext = false,
    this.fresh = false,
  });

  /// From a location's query (`/learn/session?chapter=...&min=10&kind=mix&out=lesson&cards=a,b&run=...&end=1`).
  factory RunLaunch.fromQuery(Map<String, String> q) => RunLaunch(
        chapterKey: _text(q['chapter']),
        minutes: int.tryParse(q['min'] ?? '') ?? 10,
        kind: _text(q['kind']) ?? 'mix',
        leaveOut: _list(q['out']),
        cardIds: _list(q['cards']),
        runId: _text(q['run']),
        end: q['end'] == '1',
        addNext: q['next'] == '1',
        fresh: q['fresh'] == '1',
      );

  final String? chapterKey;
  final int minutes;

  /// `mix` (a chapter run), `cards` (Revise these, Study these), `recap`, `level`, `feed`.
  final String kind;
  final List<String> leaveOut;
  final List<String> cardIds;
  final String? runId;

  /// Open on the run's end (a finished run, or `GET /end` only).
  final bool end;
  final bool addNext;
  final bool fresh;

  Map<String, String> toQuery() => {
        'chapter': ?chapterKey,
        'min': '$minutes',
        if (kind != 'mix') 'kind': kind,
        if (leaveOut.isNotEmpty) 'out': leaveOut.join(','),
        if (cardIds.isNotEmpty) 'cards': cardIds.join(','),
        'run': ?runId,
        if (end) 'end': '1',
        if (addNext) 'next': '1',
        if (fresh) 'fresh': '1',
      };
}

/// A feed to open. `source` is set when it was started from an Explore cover (`explore_cover`, with [forYou] and
/// [position]); the feed sends them with its start (BUILD-1101 B7 item 4).
class FeedLaunch {
  const FeedLaunch({this.chapterKey, this.minutes = 10, this.runId, this.end = false, this.source, this.forYou = false, this.position});

  factory FeedLaunch.fromQuery(Map<String, String> q) => FeedLaunch(
        chapterKey: _text(q['chapter']),
        minutes: int.tryParse(q['min'] ?? '') ?? 10,
        runId: _text(q['run']),
        end: q['end'] == '1',
        source: _text(q['src']),
        forYou: q['fy'] == '1',
        position: int.tryParse(q['pos'] ?? ''),
      );

  final String? chapterKey;
  final int minutes;
  final String? runId;
  final bool end;
  final String? source;
  final bool forYou;
  final int? position;

  Map<String, String> toQuery() => {
        'chapter': ?chapterKey,
        'min': '$minutes',
        'run': ?runId,
        if (end) 'end': '1',
        'src': ?source,
        if (source != null && forYou) 'fy': '1',
        if (source != null && position != null) 'pos': '$position',
      };
}

String? _text(String? v) => v == null || v.trim().isEmpty ? null : v.trim();
List<String> _list(String? v) => [for (final s in (v ?? '').split(',')) if (s.trim().isNotEmpty) s.trim()];

String _with(String path, Map<String, String> query) => query.isEmpty ? path : Uri(path: path, queryParameters: query).toString();

/// Every Learn v2 location in the app.
abstract final class Learn2Links {
  /// The Learn door (Learn home), on [subject] when given.
  static String home({String? subject}) => AppRoutes.practiceDoorLocation('learn', from: Uri(queryParameters: {'subject': ?subject}));

  /// The Learn door with Find open, on [subject], searching [q] when given.
  static String find({String? subject, String? q}) =>
      AppRoutes.practiceDoorLocation('learn', from: Uri(queryParameters: {'subject': ?subject, 'find': '1', 'q': ?q}));

  /// The chapter page; [minutes] picks the length shown.
  static String chapter(String key, {int? minutes}) => _with(AppRoutes.learn2Chapter(key), {if (minutes != null) 'min': '$minutes'});

  /// The chapter's Cards view; [filter] is `must`, `revise` or `missed`.
  static String cards(String key, {String? filter}) => _with(AppRoutes.learn2Cards(key), {'f': ?filter});

  /// A run.
  static String run(RunLaunch launch) => _with(AppRoutes.learn2Session, launch.toQuery());

  /// A feed.
  static String feed(FeedLaunch launch) => _with(AppRoutes.exploreFeed, launch.toQuery());

  /// Explore: the chapter feed covers (and the way to Untimed questions).
  static String explore({String? subject}) => _with(AppRoutes.explore, {'subject': ?subject});

  /// Revise.
  static String revise() => AppRoutes.reviewRevise;

  /// Where a Key cards page (`/cards`, `/cards/<key>[?mode=study|last-look]`) opens while Learn v2 is on, so one student
  /// meets one Key cards world, not two (the web's useLearn2On rule): Key cards home is the Learn door, a deck is the
  /// chapter's Cards view, Study is the chapter page and Last look the Must-know cards. Null for anything else.
  static String? fromKeyCards(Uri uri) {
    final s = [for (final p in uri.pathSegments) if (p.isNotEmpty) p];
    if (s.isEmpty || s.first != 'cards' || s.length > 2) return null;
    if (s.length == 1) return home(subject: _text(uri.queryParameters['subject']));
    final key = s[1];
    return switch (uri.queryParameters['mode']) {
      'study' => chapter(key),
      'last-look' => cards(key, filter: 'must'),
      _ => cards(key),
    };
  }

  /// A production href the server wrote, drawn as the app's location; null when it is not a Learn place (the
  /// caller then hands it to the ActionRouter).
  static String? resolve(String? href) {
    if (href == null || href.isEmpty) return null;
    final Uri url;
    try {
      url = Uri.parse(href);
    } on FormatException {
      return null;
    }
    final q = url.queryParameters;
    final path = url.path.length > 1 && url.path.endsWith('/') ? url.path.substring(0, url.path.length - 1) : url.path;
    if (path == '/learn/run' || path == AppRoutes.learn2Session) return run(RunLaunch.fromQuery(q));
    if (path == '/explore/run' || path == AppRoutes.exploreFeed) return feed(FeedLaunch.fromQuery(q));
    // Explore with a question filter ("Questions on this chapter in Explore") is the question stream: the ActionRouter's.
    if (path == AppRoutes.explore) return q.containsKey('chapter') || q.containsKey('difficulty') ? null : explore(subject: _text(q['subject']));
    if (path == '/learn/find') return find(subject: _text(q['subject']), q: _text(q['q']));
    if (path == AppRoutes.learn) return home(subject: _text(q['subject']));
    if (path == AppRoutes.reviewRevise) return revise();
    final cardsMatch = RegExp(r'^/learn/c/([^/]+)/cards$').firstMatch(path);
    if (cardsMatch != null) return cards(Uri.decodeComponent(cardsMatch.group(1)!), filter: _text(q['f']));
    final chapterMatch = RegExp(r'^/learn/c/([^/]+)$').firstMatch(path);
    if (chapterMatch != null) return chapter(Uri.decodeComponent(chapterMatch.group(1)!), minutes: int.tryParse(q['min'] ?? ''));
    return null;
  }
}
