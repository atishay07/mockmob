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
        if (s.length == 1) return AppRoutes.today;
      case 'dashboard':
        if (s.length == 1) {
          final mode = q['mode'];
          if (mode == null) return AppRoutes.today;
          return _setup(mode, q);
        }
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
        if (s.length == 2) return _id.hasMatch(s[1]) ? AppRoutes.result(s[1]) : _reject;
    }

    // Hrefs that already name a native route (for example from a notification payload).
    if (AppRoutes.isNativePath(path) && path != AppRoutes.dashboard && !AppRoutes.isAuthPath(path)) {
      return path;
    }
    return null;
  }

  static String? _setup(String mode, Map<String, String> q) {
    if (!_word.hasMatch(mode)) return _reject;
    final params = <String, String>{};
    final subject = q['subject'];
    if (subject != null && _subject.hasMatch(subject)) params['subject'] = subject;
    final chapter = q['chapter'];
    if (chapter != null && chapter.isNotEmpty && chapter.length <= 120) params['chapter'] = chapter;
    final count = q['count'];
    if (count != null && _count.hasMatch(count)) params['count'] = count;
    final path = AppRoutes.practiceSetup(mode);
    return params.isEmpty ? path : Uri(path: path, queryParameters: params).toString();
  }
}
