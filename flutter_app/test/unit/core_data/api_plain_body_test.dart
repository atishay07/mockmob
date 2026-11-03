import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';

import 'support/fakes.dart';

// 16 Oct 2026, APK v10 on the owner's phone: GET /api/attempts asked for the raw body
// (plainBody) but dio handed back the decoded JSON list, so ApiResponse.text was '' and every
// account's Today card said "Could not reach MockMob". The same option feeds the Review record
// (/api/recovery) and the DU catalogue behind My colleges search.
void main() {
  late FakeHttpAdapter http;
  late ApiClient api;

  setUp(() {
    http = FakeHttpAdapter();
    api = newApiClient(http, tokens: FakeTokens());
  });

  test('plainBody returns the raw JSON text of a JSON list answer', () async {
    final rows = [
      {'id': 'a1', 'subject': 'accountancy', 'score': 12},
      {'id': 'a2', 'subject': 'english', 'score': -3},
    ];
    http.replies.add(FakeReply(200, rows));
    final res = await api.get('/api/attempts', options: const ApiOptions(plainBody: true));
    expect(res.text, isNotEmpty);
    expect(jsonDecode(res.text), rows);
  });

  test('plainBody returns the raw JSON text of a JSON object answer', () async {
    final body = {'record': {'sessions': 3}, 'state': 'ready'};
    http.replies.add(FakeReply(200, body));
    final res = await api.get('/api/recovery', options: const ApiOptions(plainBody: true));
    expect(jsonDecode(res.text), body);
  });

  test('an answer read as JSON is unchanged', () async {
    http.replies.add(const FakeReply(200, {'ok': true}));
    final res = await api.get('/api/learning/plan');
    expect(res.map, {'ok': true});
  });

  test('a JSON string reply is served as JSON, like the real server (not as text/html)', () async {
    http.replies.add(FakeReply(200, jsonEncode([{'id': 'a1'}])));
    final plain = await api.get('/api/attempts', options: const ApiOptions(plainBody: true));
    expect(jsonDecode(plain.text), [
      {'id': 'a1'},
    ]);
    http.replies.add(FakeReply(200, jsonEncode({'ok': true})));
    final decoded = await api.get('/api/learning/plan');
    expect(decoded.map, {'ok': true});
  });

  test('an HTML string reply stays text', () async {
    http.replies.add(const FakeReply(200, '<html>Wi-Fi</html>'));
    final res = await api.get('/api/learning/plan', options: const ApiOptions(plainBody: true));
    expect(res.text, '<html>Wi-Fi</html>');
  });
}
