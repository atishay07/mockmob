import '../pattern/paper_pattern.dart' show PaperFormat;
import 'routes.dart';

/// Where a web `href` from the API (spec 4.3, [API §2.4]) should go.
sealed class ActionTarget {
  const ActionTarget();
}

/// Open this in-app location with go_router.
class NativeTarget extends ActionTarget {
  const NativeTarget(this.location);

  final String location;

  @override
  bool operator ==(Object other) => other is NativeTarget && other.location == location;

  @override
  int get hashCode => location.hashCode;

  @override
  String toString() => 'NativeTarget($location)';
}

/// Open this page on www.mockmob.in in a Custom Tab. Only https links to our own domain get here.
class ExternalTarget extends ActionTarget {
  const ExternalTarget(this.uri);

  final Uri uri;

  @override
  bool operator ==(Object other) => other is ExternalTarget && other.uri == uri;

  @override
  int get hashCode => uri.hashCode;

  @override
  String toString() => 'ExternalTarget($uri)';
}

/// Do nothing: the href is malformed, points off our domain, or is a pricing or checkout link
/// (the app never sells, binding rule 13).
class UnsupportedTarget extends ActionTarget {
  const UnsupportedTarget();

  @override
  bool operator ==(Object other) => other is UnsupportedTarget;

  @override
  int get hashCode => 0;

  @override
  String toString() => 'UnsupportedTarget()';
}

/// The launcher shortcut types (Android app shortcuts). Fresh check is not here: that flow is
/// behind its content gate and has no start of its own, so the third shortcut is Practice 10.
abstract final class AppShortcutType {
  static const String resume = 'resume';
  static const String repair = 'repair';
  static const String practice = 'practice10';
  static const List<String> all = [resume, repair, practice];
}

/// Maps web hrefs to native routes. Pure and strict: hrefs are data from a server, so nothing
/// is opened unless it is recognised, and anything off `https://www.mockmob.in` is refused.
abstract final class ActionRouter {
  static const Set<String> _ownHosts = {'www.mockmob.in', 'mockmob.in'};
  static const String _canonicalHost = 'www.mockmob.in';

  /// Web paths that sell or pay. Never opened, natively or in a browser.
  static const Set<String> _commercePrefixes = {
    '/pricing',
    '/upgrade',
    '/checkout',
    '/payment',
    '/payments',
    '/billing',
    '/subscribe',
    '/premium',
    '/signup',
  };

  /// Returned by the mapper for hrefs that name a known screen with a bad parameter.
  static const String _reject = '';

  static final RegExp _id = RegExp(r'^[A-Za-z0-9_-]{1,100}$');
  static final RegExp _word = RegExp(r'^[a-z][a-z0-9_-]{0,23}$');
  static final RegExp _subject = RegExp(r'^[A-Za-z0-9_.-]{1,64}$');
  static final RegExp _count = RegExp(r'^\d{1,3}$');
  static final RegExp _date = RegExp(r'^\d{4}-\d{2}-\d{2}$');

  /// A whole number from 1 to 999: a repair's `count`, a question number.
  static final RegExp _positive = RegExp(r'^[1-9]\d{0,2}$');

  /// The only `purpose` values a link may claim: the two first-use allowances
  /// (`PracticeLink.allowedPurpose` applies the same rule when the screen reads them).
  static const Set<String> _purposes = {'baseline', 'full_sample'};

  /// Where a launcher shortcut (long-press on the app icon) goes. It builds the same web hrefs
  /// the rest of the app resolves, so a shortcut can never open anything a link could not.
  /// [sessionId] is the open session for [AppShortcutType.resume] (none open: Practice) and
  /// [repairLocation] is tonight's first mistake for [AppShortcutType.repair] (none: Review).
  static ActionTarget forShortcut(String type, {String? sessionId, String? repairLocation}) {
    switch (type) {
      case AppShortcutType.resume:
        if (sessionId == null) return const NativeTarget(AppRoutes.practice);
        return resolve(Uri(path: '/test', queryParameters: {'sessionId': sessionId}).toString());
      case AppShortcutType.repair:
        final here = repairLocation == null ? null : resolve(repairLocation);
        return here is NativeTarget && here.location.startsWith('/review/repair/') ? here : resolve('/recovery');
      case AppShortcutType.practice:
        return resolve('/test?mode=quick&count=10');
    }
    return const UnsupportedTarget();
  }

  static ActionTarget resolve(String? href) {
    if (href == null) return const UnsupportedTarget();
    final raw = href.trim();
    if (raw.isEmpty || raw.length > 2000 || raw.contains(RegExp(r'[\s\x00-\x1f\\]'))) {
      return const UnsupportedTarget();
    }

    // `Uri` silently collapses "/../", so dot segments are refused on the raw text.
    final rawPath = raw.split(RegExp(r'[?#]')).first;
    if (rawPath.split('/').any((s) => s == '.' || s == '..') || rawPath.toLowerCase().contains('%2e')) {
      return const UnsupportedTarget();
    }

    final uri = Uri.tryParse(raw);
    if (uri == null) return const UnsupportedTarget();

    if (uri.hasScheme || uri.hasAuthority) {
      final isOwnHttps = uri.scheme == 'https' &&
          _ownHosts.contains(uri.host.toLowerCase()) &&
          uri.userInfo.isEmpty &&
          (!uri.hasPort || uri.port == 443);
      if (!isOwnHttps) return const UnsupportedTarget();
    } else if (!raw.startsWith('/') || raw.startsWith('//')) {
      return const UnsupportedTarget();
    }

    final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    final path = '/${segments.join('/')}';
    final query = uri.queryParameters;

    if (_commercePrefixes.any((p) => path == p || path.startsWith('$p/'))) return const UnsupportedTarget();

    final native = _mapToNative(segments, path, query);
    if (native == _reject) return const UnsupportedTarget();
    if (native != null) return NativeTarget(native);

    // Unknown but on our own domain: a Custom Tab, never a native screen.
    final external = Uri(
      scheme: 'https',
      host: _canonicalHost,
      path: path,
      queryParameters: query.isEmpty ? null : query,
    );
    return ExternalTarget(external);
  }

  static String? _mapToNative(List<String> s, String path, Map<String, String> q) {
    if (s.isEmpty) return AppRoutes.today;

    switch (s.first) {
      case 'today':
        // The website opens Week in review as a sheet over Today (`RhythmCard`).
        if (s.length == 1) return q['sheet'] == 'week-review' ? _weekReview(q) : AppRoutes.today;
      case 'dashboard':
        if (s.length == 1) {
          final mode = q['mode'];
          if (mode == null) return AppRoutes.today;
          return _setup(mode, q);
        }
        // Your chapters is served from `/dashboard/chapters` on the website.
        if (s.length == 2 && s[1] == 'chapters') return _chapters(q);
      case 'practice':
        // The website's `/practice/chapters?subject=` (a rewrite of `/dashboard/chapters`).
        if (s.length == 2 && s[1] == 'chapters') return _chapters(q);
      case 'test':
        if (s.length == 1) {
          final sessionId = q['sessionId'];
          if (sessionId != null) {
            return _id.hasMatch(sessionId) ? AppRoutes.run(sessionId) : _reject;
          }
          final mode = q['mode'];
          return mode == null ? AppRoutes.practice : _setup(mode, q);
        }
      case 'recovery' || 'progress':
        if (s.length == 1) return AppRoutes.review;
      case 'study':
        if (s.length == 2) return _id.hasMatch(s[1]) ? AppRoutes.learnRun(s[1]) : _reject;
      case 'result':
        if (s.length == 2) return _id.hasMatch(s[1]) ? _result(s[1], q) : _reject;
      case 'explore':
        if (s.length == 1) return _stream(q);
      case 'saved':
        if (s.length == 1) return AppRoutes.reviewSaved;
      case 'analytics':
        if (s.length == 1) return AppRoutes.reviewInsights;
      case 'mentor':
        if (s.length == 1) return q['tab'] == 'ask' ? AppRoutes.ask : AppRoutes.reviewInsights;
      case 'admission-compass' || 'cuet-cutoff-calculator':
        if (s.length == 1) return AppRoutes.toolsCompass;
      case 'cuet-subject-combination':
        if (s.length == 1) return AppRoutes.toolsCombo;
      case 'cuet-2027':
        if (s.length == 1) return AppRoutes.toolsGuide2027;
      case 'profile':
        if (s.length == 1) return AppRoutes.you;
      case 'onboarding':
        if (s.length == 1 && q['edit'] == 'true') return AppRoutes.youSubjects;
    }

    // Hrefs that already name a native route (for example from a notification payload or a
    // widget tap), with the query that route's screen reads.
    if (AppRoutes.isNativePath(path) && path != AppRoutes.dashboard && !AppRoutes.isAuthPath(path)) {
      return _nativeWithQuery(s, path, q);
    }
    return null;
  }

  /// [path], a route of the app's own table, with only the query parameters its screen builder
  /// reads, each checked. Any other parameter is dropped: a link can never pass the app
  /// something no screen asks for. Keep this in step with the route builders:
  ///  - `/review/repair/:attemptId/:questionId`: `count` (review_routes.dart)
  ///  - `/result/:attemptId`: `q` (result_routes.dart), mapped in [_mapToNative]
  ///  - `/practice/setup/:mode` and `/practice/start`: `mode` and what `PracticeLink.of` reads
  ///  - `/practice/stream`: subject, chapter, difficulty, or `source=saved` with `start`
  ///  - `/exam/nta`: `subject`
  ///  - `/practice/chapters/:subject`: a well-formed subject in the path, no query
  ///  - `/today/week-review`: `week` (the week's Monday, `YYYY-MM-DD`)
  static String? _nativeWithQuery(List<String> s, String path, Map<String, String> q) {
    if (s.length == 3 && s[0] == 'practice' && s[1] == 'setup') {
      // A mode this table cannot read keeps the bare route, as it always did.
      return _word.hasMatch(s[2]) ? _setup(s[2], q) : path;
    }
    if (path == AppRoutes.practiceStart) return _start(q);
    if (path == AppRoutes.practiceStream) return _stream(q);
    // A subject in the path: letters, digits, `_` and `-` only (no dots, no slashes).
    if (s.length == 3 && s[0] == 'practice' && s[1] == 'chapters') return _id.hasMatch(s[2]) ? path : _reject;
    if (path == AppRoutes.todayWeekReview) return _weekReview(q);
    if (path == AppRoutes.examNta) {
      final subject = q['subject'];
      return _withParams(path, {if (subject != null && _subject.hasMatch(subject)) 'subject': subject});
    }
    if (s.length == 4 && s[0] == 'review' && s[1] == 'repair' && s[3] != 'ending') {
      final count = q['count'];
      return _withParams(path, {if (count != null && _positive.hasMatch(count)) 'count': count});
    }
    return path;
  }

  static String _withParams(String path, Map<String, dynamic> params) =>
      params.isEmpty ? path : Uri(path: path, queryParameters: params).toString();

  /// The full result, optionally opened at question `q`.
  static String _result(String attemptId, Map<String, String> q) {
    final number = q['q'];
    return _withParams(AppRoutes.result(attemptId), {if (number != null && _positive.hasMatch(number)) 'q': number});
  }

  /// The question stream, keeping a well-formed subject, chapter and difficulty, or the saved
  /// questions (`source=saved`) opened at one question (`start`).
  static String _stream(Map<String, String> q) {
    final params = <String, String>{};
    if (q['source'] == 'saved') {
      params['source'] = 'saved';
      final start = q['start'];
      if (start != null && _id.hasMatch(start)) params['start'] = start;
      return _withParams(AppRoutes.practiceStream, params);
    }
    final subject = q['subject'];
    if (subject != null && _subject.hasMatch(subject)) params['subject'] = subject;
    final chapter = q['chapter'];
    if (chapter != null && chapter.isNotEmpty && chapter.length <= 120) params['chapter'] = chapter;
    final difficulty = q['difficulty'];
    if (difficulty != null && _word.hasMatch(difficulty)) params['difficulty'] = difficulty;
    return _withParams(AppRoutes.practiceStream, params);
  }

  /// What a practice link may ask for, each value checked: the parameters `PracticeLink.of`
  /// reads (subject, chapter or chapters, count, difficulty, purpose, recoveryFrom) and the
  /// format drill (`format`, a [PaperFormat] id).
  static Map<String, dynamic> _practiceParams(String mode, Map<String, String> q) {
    final params = <String, dynamic>{};
    final subject = q['subject'];
    if (subject != null && _subject.hasMatch(subject)) params['subject'] = subject;
    final chapter = q['chapter'];
    if (chapter != null && chapter.isNotEmpty && chapter.length <= 120) params['chapter'] = chapter;
    // The website joins several chapters with commas (`DashboardPageClient`); the app's setup
    // link repeats `chapters` instead, so a name is never split twice.
    final chapters = [
      for (final name in (q['chapters'] ?? '').split(','))
        if (name.trim().isNotEmpty && name.trim().length <= 120) name.trim(),
    ];
    if (chapters.isNotEmpty) params['chapters'] = chapters.take(12).toList();
    final count = q['count'];
    if (count != null && _count.hasMatch(count)) params['count'] = count;
    final difficulty = q['difficulty'];
    if (difficulty != null && _word.hasMatch(difficulty)) params['difficulty'] = difficulty;
    final purpose = q['purpose'];
    if (purpose != null && _purposes.contains(purpose)) params['purpose'] = purpose;
    // A "5 fresh questions" check of an earlier attempt: chapter practice only.
    final recoveryFrom = q['recoveryFrom'];
    if (mode == 'chapter' && recoveryFrom != null && _id.hasMatch(recoveryFrom)) {
      params['recoveryFrom'] = recoveryFrom;
    }
    // A format drill ("Drill 5 sequence questions"): only the formats the app knows.
    final format = q['format'];
    if (PaperFormat.byId(format) != null) params['format'] = format;
    return params;
  }

  /// Your chapters for `subject`; without one, Practice (where the chapters link lives).
  static String? _chapters(Map<String, String> q) {
    final subject = q['subject'];
    if (subject == null) return AppRoutes.practice;
    // The subject becomes a path segment: no dots, so it can never step out of the route.
    return _id.hasMatch(subject) && subject.length <= 64 ? AppRoutes.practiceChapters(subject) : _reject;
  }

  /// Week in review, of the week whose Monday is `week` when that is a well-formed date.
  static String _weekReview(Map<String, String> q) {
    final week = q['week'];
    return week != null && _date.hasMatch(week) ? AppRoutes.todayWeekReviewOf(week) : AppRoutes.todayWeekReview;
  }

  static String? _setup(String mode, Map<String, String> q) {
    if (!_word.hasMatch(mode)) return _reject;
    final subject = q['subject'];
    // The exam-day screen (`mode=nta`) opens its own instructions page, where the clock has not
    // started yet. On the website `mode=full&interface=nta` is an ordinary full mock (its
    // `classicInterface` needs NTA mode itself), so that link stays a free full mock here too.
    if (mode == 'nta' && subject != null && _subject.hasMatch(subject)) {
      return Uri(path: AppRoutes.examNta, queryParameters: {'subject': subject}).toString();
    }
    return _withParams(AppRoutes.practiceSetup(mode), _practiceParams(mode, q));
  }

  /// `/practice/start`: starts Quick, Smart or chapter practice at once. No `mode` means Quick.
  static String? _start(Map<String, String> q) {
    final mode = q['mode'];
    if (mode == null) return _withParams(AppRoutes.practiceStart, _practiceParams('quick', q));
    if (!_word.hasMatch(mode)) return _reject;
    // The exam-day layout always opens its instructions first, never a running clock.
    if (mode == 'nta') return _setup(mode, q);
    return _withParams(AppRoutes.practiceStart, {'mode': mode, ..._practiceParams(mode, q)});
  }
}
