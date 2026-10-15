import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/errors/error_buffer.dart';
import 'package:mockmob/core/errors/error_report.dart';
import 'package:mockmob/core/errors/error_reporter.dart';
import 'package:mockmob/core/errors/error_scrubber.dart';
import 'package:mockmob/core/errors/error_uploader.dart';
import 'package:mockmob/core/storage/prefs_store.dart';

class _FailingStore extends MemoryPrefsStore {
  @override
  Future<String?> getString(String key) async => throw StateError('disk read failed');

  @override
  Future<void> setString(String key, String value) async => throw StateError('disk write failed');

  @override
  Future<void> remove(String key) async => throw StateError('disk remove failed');
}

class _BadToString {
  @override
  String toString() => throw StateError('no text');
}

class _FakeTransport implements ErrorTransport {
  final List<List<Map<String, Object?>>> batches = [];
  Object? failure;
  bool collecting = true;
  Completer<void>? hold;

  @override
  Future<ErrorSendResult> send(List<Map<String, Object?>> errors) async {
    batches.add(errors);
    if (hold != null) await hold!.future;
    if (failure != null) throw failure!;
    return ErrorSendResult(accepted: errors.length, collecting: collecting);
  }
}

const _facts = DeviceFacts(appVersion: '1.2.3', build: '45', platform: 'android', osVersion: 'Android 14', deviceClass: 'phone');

ErrorReport _report(String message, {String stack = '#0 Foo.bar (package:mockmob/a.dart:10:5)', int count = 1, int atMs = 1000, int run = 1, String kind = 'flutter'}) =>
    ErrorReport(kind: kind, message: message, stack: stack, count: count, atMs: atMs, run: run, appVersion: '1.2.3', platform: 'android');

void main() {
  group('scrubbing', () {
    test('emails, phone numbers, tokens, ids and addresses are gone', () {
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      final secrets = {
        'mail asha.k+x@example.co.in failed': 'asha.k+x@example.co.in',
        'call 9876543210 now': '9876543210',
        'call +91 98765 43210 now': '98765 43210',
        'call 0091-98765-43210 now': '98765-43210',
        'id 123456789012 bad': '123456789012',
        'auth $jwt': jwt,
        'Authorization: Bearer abcDEF123456xyz': 'abcDEF123456xyz',
        'GET /x?access_token=abc123def456&y=1': 'abc123def456',
        'user 3f2504e0-4f89-11d3-9a0c-0305e82c3301 gone': '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
        'key sk-abcdefghijklmnop1234 used': 'sk-abcdefghijklmnop1234',
        'from 192.168.1.100 refused': '192.168.1.100',
        'digest a3f9c2d1e8b74a6f9c0d1e2f3a4b5c6d7e8f9a0b done': 'a3f9c2d1e8b74a6f9c0d1e2f3a4b5c6d7e8f9a0b',
        r'C:\Users\atish\proj\a.dart': 'atish',
      };
      secrets.forEach((input, secret) {
        final out = scrubErrorText(input);
        expect(out.contains(secret), isFalse, reason: '$input -> $out');
      });
      expect(scrubErrorText('mail a@b.com'), contains('[email]'));
      expect(scrubErrorText('call 9876543210'), contains('[phone]'));
    });

    test('ordinary error text stays readable', () {
      const plain = [
        "type 'Null' is not a subtype of type 'String' in type cast",
        'RangeError (index): Invalid value: Not in inclusive range 0..4: 7',
        'package:mockmob/features/today/screens/today_screen.dart:120:9',
        'A RenderFlex overflowed by 14 pixels on the right.',
        'SomeVeryLongProviderNameThatIsOnlyLettersAndLong.build',
      ];
      for (final text in plain) {
        expect(scrubErrorText(text), text);
      }
      expect(scrubErrorText(null), '');
      expect(scrubErrorText(''), '');
    });

    test('a hostile megabyte is handled quickly', () {
      final watch = Stopwatch()..start();
      scrubErrorText('a' * 1000000);
      scrubErrorText('1.' * 500000);
      scrubErrorText('a@' * 500000);
      expect(watch.elapsedMilliseconds, lessThan(3000));
    });

    test('trimming never cuts a character in half', () {
      expect(trimChars('é' * 600, 500).runes.length, 500);
      expect(trimChars('😀' * 600, 500).runes.length, 500);
      final bytes = trimUtf8Bytes('é😀' * 4000, 4096);
      expect(utf8.encode(bytes).length, lessThanOrEqualTo(4096));
      expect(bytes.runes.every((r) => r != 0xFFFD), isTrue);
      expect(trimUtf8Bytes('short', 4096), 'short');
    });

    test('a route keeps its shape and loses ids and queries', () {
      expect(cleanScreen('/today'), '/today');
      expect(cleanScreen('/learn/chapter/9f1c2d3e4a5b?x=1#y'), '/learn/chapter/:id');
      expect(cleanScreen('   '), isNull);
      expect(cleanScreen(null), isNull);
    });
  });

  group('a report', () {
    test('is scrubbed and trimmed before it is kept: 500 characters, 4 KB', () {
      final report = ErrorReport.fromError(
        Exception('fail for asha@example.com ${'x ' * 900}'),
        StackTrace.fromString('line é 9876543210\n' * 2000),
        kind: ErrorKinds.flutter,
        atMs: 5,
        run: 1,
      );
      expect(report.message.runes.length, lessThanOrEqualTo(maxMessageChars));
      expect(utf8.encode(report.stack).length, lessThanOrEqualTo(maxStackBytes));
      expect(report.message, isNot(contains('asha@example.com')));
      expect(report.stack, isNot(contains('9876543210')));
    });

    test('an error whose text cannot be read still becomes a report', () {
      final report = ErrorReport.fromError(_BadToString(), null, kind: 'nonsense', atMs: 1, run: 1);
      expect(report.message, isNotEmpty);
      expect(report.kind, ErrorKinds.other);
    });

    test('the wire shape carries no time, user, device id or address', () {
      final wire = ErrorReport.fromError(StateError('boom'), StackTrace.fromString('#0 A.b (package:mockmob/a.dart:1:1)'), kind: ErrorKinds.zone, atMs: 77, run: 3, screen: '/today', facts: _facts).toWire();
      expect(wire.keys.toSet(), {'kind', 'message', 'stack', 'screen', 'count', 'platform', 'device_class', 'app_version', 'build', 'os_version'});
      expect(wire['kind'], 'zone');
      expect(wire['platform'], 'android');
      expect(jsonEncode(wire), isNot(contains('77')));
    });

    test('numbers and a moved line do not make a different error; a different place does', () {
      final a = _report('Index 7 out of range for list of 5');
      final b = _report('Index 3 out of range for list of 9', stack: '#0 Foo.bar (package:mockmob/a.dart:99:7)');
      final c = _report('Index 7 out of range for list of 5', stack: '#0 Other.place (package:mockmob/z.dart:1:1)');
      expect(a.key, b.key);
      expect(a.key, isNot(c.key));
      expect(a.key, isNot(_report('Index 7 out of range for list of 5', kind: 'zone').key));
    });

    test('round trips through storage', () {
      final decoded = decodeReports(encodeReports([_report('one', count: 3)])).single;
      expect(decoded.message, 'one');
      expect(decoded.count, 3);
      expect(decodeReports('not json'), isEmpty);
      expect(decodeReports('{"a":1}'), isEmpty);
      expect(decodeReports(null), isEmpty);
    });
  });

  group('the buffer', () {
    late MemoryPrefsStore store;
    late DateTime now;

    setUp(() {
      store = MemoryPrefsStore();
      now = DateTime.fromMillisecondsSinceEpoch(10000);
    });

    ErrorBuffer make([PrefsStore? s]) => ErrorBuffer(s ?? store, now: () => now);

    test('the same error again adds to its count instead of a second place', () async {
      final buffer = make();
      await buffer.add(_report('Index 7 out of range'));
      await buffer.add(_report('Index 3 out of range', count: 2));
      await buffer.add(_report('Another one'));
      final items = await buffer.take(10);
      expect(items.length, 2);
      expect(items.first.count, 3);
    });

    test('keeps at most 30, dropping the oldest', () async {
      final buffer = make();
      for (var i = 0; i < 40; i++) {
        await buffer.add(_report('message ${String.fromCharCodes([97 + i % 26, 97 + i ~/ 26])}', stack: '#0 F$i.x (package:mockmob/f$i.dart:1:1)'));
      }
      expect(await buffer.count(), maxBufferedReports);
    });

    test('survives a restart and drops what is over 7 days old', () async {
      await make().add(_report('stays', atMs: now.millisecondsSinceEpoch));
      await make().add(_report('too old', atMs: now.subtract(const Duration(days: 8)).millisecondsSinceEpoch, stack: '#0 Old.x (package:mockmob/o.dart:1:1)'));
      final items = await make().take(10);
      expect(items.map((r) => r.message), ['stays']);
    });

    test('removeSent drops what was sent and keeps what grew meanwhile', () async {
      final buffer = make();
      await buffer.add(_report('grows', atMs: now.millisecondsSinceEpoch));
      await buffer.add(_report('gone', atMs: now.millisecondsSinceEpoch, stack: '#0 G.x (package:mockmob/g.dart:1:1)'));
      final taken = await buffer.take(10);
      await buffer.add(_report('grows', count: 2, atMs: now.millisecondsSinceEpoch));
      await buffer.removeSent(taken);
      final left = await buffer.take(10);
      expect(left.length, 1);
      expect(left.single.message, 'grows');
      expect(left.single.count, 2);
    });

    test('clear empties it, in memory and on disk', () async {
      final buffer = make();
      await buffer.add(_report('x', atMs: now.millisecondsSinceEpoch));
      await buffer.clear();
      expect(await buffer.count(), 0);
      expect(store.values.containsKey(errorBufferKey), isFalse);
    });

    test('a failing disk never throws and the run still holds the report', () async {
      final buffer = make(_FailingStore());
      await buffer.add(_report('x', atMs: now.millisecondsSinceEpoch));
      expect(await buffer.count(), 1);
      await buffer.clear();
      expect(await buffer.count(), 0);
    });

    test('facts learned late are added only to this run', () async {
      final buffer = make();
      ErrorReport bare(String m, int run) => ErrorReport(kind: 'flutter', message: m, stack: '#0 $m.x (package:mockmob/${m}1.dart:1:1)', atMs: now.millisecondsSinceEpoch, run: run);
      await buffer.add(bare('mine', 7));
      await buffer.add(bare('earlier', 6));
      await buffer.fillFacts(7, _facts);
      final items = await buffer.take(10);
      expect(items.firstWhere((r) => r.message == 'mine').appVersion, '1.2.3');
      expect(items.firstWhere((r) => r.message == 'earlier').appVersion, isNull);
    });
  });

  group('the reporter', () {
    late ErrorBuffer buffer;
    late DateTime now;
    late ErrorReporter reporter;

    setUp(() {
      now = DateTime.fromMillisecondsSinceEpoch(1000000);
      buffer = ErrorBuffer(MemoryPrefsStore(), now: () => now);
      reporter = ErrorReporter(buffer: buffer, now: () => now, factsLoader: () async => _facts, run: 9);
    });

    Future<void> settle() async {
      for (var i = 0; i < 20; i++) {
        await Future<void>.delayed(Duration.zero);
      }
    }

    test('keeps an error with the route, and learns the phone facts', () async {
      reporter.screenOf = () => '/learn/chapter/9f1c2d3e4a5b';
      reporter.report(StateError('boom'), StackTrace.fromString('#0 A.b (package:mockmob/a.dart:1:1)'), kind: ErrorKinds.platform);
      await settle();
      final item = (await buffer.take(5)).single;
      expect(item.kind, 'platform');
      expect(item.screen, '/learn/chapter/:id');
      expect(item.appVersion, '1.2.3');
      expect(item.platform, 'android');
    });

    test('never throws: odd errors, a route that throws, a null stack', () async {
      reporter.screenOf = () => throw StateError('router gone');
      reporter.report(_BadToString(), null);
      reporter.report('plain string', StackTrace.empty);
      reporter.report(StateError('x'), null, kind: 'whatever');
      await settle();
      expect(await buffer.count(), 3);
    });

    test('a failing disk or facts loader never throws', () async {
      final bad = ErrorReporter(buffer: ErrorBuffer(_FailingStore()), factsLoader: () async => throw StateError('no info'));
      bad.report(StateError('x'), null);
      await settle();
    });

    test('at most 30 a minute: an error thrown every frame costs one counter', () async {
      for (var i = 0; i < 500; i++) {
        reporter.report(StateError('frame error'), StackTrace.fromString('#0 A.b (package:mockmob/a.dart:1:1)'));
      }
      await settle();
      final item = (await buffer.take(5)).single;
      expect(item.count, 30);
      now = now.add(const Duration(minutes: 2));
      reporter.report(StateError('frame error'), StackTrace.fromString('#0 A.b (package:mockmob/a.dart:1:1)'));
      await settle();
      expect((await buffer.take(5)).single.count, 31);
    });

    test('keeps nothing once the usage-data choice is known to be off', () async {
      reporter.collectionAllowed = false;
      reporter.report(StateError('x'), null);
      await settle();
      expect(await buffer.count(), 0);
    });
  });

  group('the uploader', () {
    late ErrorBuffer buffer;
    late _FakeTransport transport;
    late ErrorGate gate;
    late ErrorUploader uploader;
    final fresh = DateTime.now().millisecondsSinceEpoch;

    setUp(() async {
      buffer = ErrorBuffer(MemoryPrefsStore());
      transport = _FakeTransport();
      gate = const ErrorGate(signedIn: true, consentActive: true, consentKnownOff: false);
      uploader = ErrorUploader(buffer: buffer, transport: transport, gate: () => gate, run: 1);
    });

    Future<void> fill(int n) async {
      for (var i = 0; i < n; i++) {
        await buffer.add(_report('error $i', atMs: fresh, stack: '#0 F${String.fromCharCodes([97 + i % 26])}.x (package:mockmob/f${String.fromCharCodes([97 + i % 26])}.dart:1:1)'));
      }
    }

    test('sends in batches of at most 10 and empties what was accepted', () async {
      await fill(25);
      await uploader.flush();
      expect(transport.batches.map((b) => b.length), [10, 10, 5]);
      expect(await buffer.count(), 0);
    });

    test('an allowed student sends the scrubbed wire shape and nothing else', () async {
      await fill(1);
      await uploader.flush();
      final sent = transport.batches.single.single;
      expect(sent.keys.toSet().difference({'kind', 'message', 'stack', 'count', 'platform', 'device_class', 'app_version'}), isEmpty);
    });

    test('usage data not allowed: nothing is sent and the buffer is emptied', () async {
      await fill(3);
      gate = const ErrorGate(signedIn: true, consentActive: false, consentKnownOff: true);
      await uploader.flush();
      expect(transport.batches, isEmpty);
      expect(await buffer.count(), 0);
    });

    test('consent not known yet or signed out: nothing is sent and nothing is lost', () async {
      await fill(3);
      gate = const ErrorGate(signedIn: true, consentActive: false, consentKnownOff: false);
      await uploader.flush();
      gate = const ErrorGate(signedIn: false, consentActive: true, consentKnownOff: false);
      await uploader.flush();
      expect(transport.batches, isEmpty);
      expect(await buffer.count(), 3);
    });

    test('offline, rate limited, server error, signed out or blocked: kept for the next try', () async {
      await fill(2);
      for (final kind in [ApiErrorKind.network, ApiErrorKind.timeout, ApiErrorKind.rateLimited, ApiErrorKind.server, ApiErrorKind.unavailable, ApiErrorKind.unauthorized, ApiErrorKind.blocked]) {
        transport.failure = ApiError(kind: kind, code: kind.name);
        await uploader.flush();
        expect(await buffer.count(), 2, reason: kind.name);
      }
      transport.failure = null;
      await uploader.flush();
      expect(await buffer.count(), 0);
    });

    test('a request the server calls malformed is dropped, not repeated forever', () async {
      await fill(2);
      transport.failure = const ApiError(kind: ApiErrorKind.validation, code: 'invalid_request', status: 400);
      await uploader.flush();
      expect(await buffer.count(), 0);
    });

    test('the server saying it is not collecting clears the buffer and stops until resumed', () async {
      await fill(2);
      transport.collecting = false;
      await uploader.flush();
      expect(uploader.stopped, isTrue);
      expect(await buffer.count(), 0);
      await fill(1);
      transport.collecting = true;
      await uploader.flush();
      expect(transport.batches.length, 1);
      uploader.resume();
      await uploader.flush();
      expect(transport.batches.length, 2);
    });

    test('any other failure never escapes', () async {
      await fill(1);
      transport.failure = StateError('weird');
      await uploader.flush();
      expect(await buffer.count(), 1);
    });

    test('two flushes at once send once', () async {
      await fill(1);
      transport.hold = Completer<void>();
      final a = uploader.flush();
      final b = uploader.flush();
      transport.hold!.complete();
      await Future.wait([a, b]);
      expect(transport.batches.length, 1);
    });

    test('consent withdrawn while a request is in flight empties the buffer', () async {
      await fill(1);
      transport.hold = Completer<void>();
      final flushing = uploader.flush();
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);
      gate = const ErrorGate(signedIn: true, consentActive: false, consentKnownOff: true);
      transport.hold!.complete();
      await flushing;
      expect(await buffer.count(), 0);
    });

    test('reports of this run made before the version was known get it at send time', () async {
      await buffer.add(ErrorReport(kind: 'flutter', message: 'early', stack: '#0 E.x (package:mockmob/e.dart:1:1)', atMs: fresh, run: 1));
      final withFacts = ErrorUploader(buffer: buffer, transport: transport, gate: () => gate, facts: () => _facts, run: 1);
      await withFacts.flush();
      expect(transport.batches.single.single['app_version'], '1.2.3');
    });
  });
}
