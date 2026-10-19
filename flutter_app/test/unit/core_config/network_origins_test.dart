// 20 Oct, C1: a staging profile build sent its email sign-in to production. Every network origin the
// app dials comes from the build's defines, and a test build can never reach the production site.
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/config/app_config.dart';

import '../core_data/support/fakes.dart';

const _prod = AppConfig(apiBaseUrl: 'https://www.mockmob.in', supabaseUrl: 'https://isrxrxzjocewrdureyhp.supabase.co', supabaseAnonKey: 'a');
const _relay = AppConfig(apiBaseUrl: 'http://localhost:3101', supabaseUrl: 'http://localhost:3102', supabaseAnonKey: 'a');
const _dev = AppConfig(apiBaseUrl: 'http://10.0.2.2:3101', supabaseUrl: 'https://onwkqxmjqjrhfbjjdydu.supabase.co', supabaseAnonKey: 'a');
// API_BASE_URL missing from the defines: the production default, with staging Supabase.
const _droppedDefine = AppConfig(apiBaseUrl: 'https://www.mockmob.in', supabaseUrl: 'https://onwkqxmjqjrhfbjjdydu.supabase.co', supabaseAnonKey: 'a');

/// An API client for [config] whose transport records each full URL it is asked to open.
(ApiClient, List<Uri>) _client(AppConfig config) {
  final opened = <Uri>[];
  final http = FakeHttpAdapter()
    ..handler = (options) {
      opened.add(options.uri);
      return const FakeReply(200, {'ok': true});
    };
  final api = ApiClient(config: config, tokens: FakeTokens(), dio: Dio()..httpClientAdapter = http, sleep: (_) async {});
  return (api, opened);
}

const _noAuth = ApiOptions(authenticated: false, retries: 0);

void main() {
  group('AppConfig origins', () {
    test('only both production origins make a production build', () {
      expect(_prod.isProductionBuild, isTrue);
      expect(_relay.isProductionBuild, isFalse);
      expect(_dev.isProductionBuild, isFalse);
      expect(_droppedDefine.isProductionBuild, isFalse);
    });

    test("a request may go only to API_BASE_URL's own origin", () {
      expect(_relay.allowsApiRequest(Uri.parse('http://localhost:3101/api/auth/email-login')), isTrue);
      expect(_relay.allowsApiRequest(Uri.parse('http://localhost:3102/api/auth/email-login')), isFalse);
      expect(_relay.allowsApiRequest(Uri.parse('https://www.mockmob.in/api/auth/email-login')), isFalse);
      expect(_prod.allowsApiRequest(Uri.parse('https://www.mockmob.in/api/auth/email-login')), isTrue);
      expect(_prod.allowsApiRequest(Uri.parse('https://evil.example/api/auth/email-login')), isFalse);
    });

    test('a test build whose API_BASE_URL fell back to production reaches nothing on production', () {
      expect(_droppedDefine.allowsApiRequest(Uri.parse('https://www.mockmob.in/api/auth/email-login')), isFalse);
      expect(_droppedDefine.allowsApiRequest(Uri.parse('https://mockmob.in/api/stats')), isFalse);
      expect(_droppedDefine.allowsApiRequest(Uri.parse(_droppedDefine.pingUrl)), isFalse);
    });
  });

  group('ApiClient', () {
    test('the email sign-in of a relay build goes to the relay, nowhere else', () async {
      final (api, opened) = _client(_relay);
      await api.post('/api/auth/email-login', body: {'email': 'a@b.co', 'client': 'app'}, options: _noAuth);
      expect(opened.single.toString(), 'http://localhost:3101/api/auth/email-login');
    });

    test('nothing is sent from a test build to production, even with an absolute URL', () async {
      final (api, opened) = _client(_relay);
      await expectLater(
        api.post('https://www.mockmob.in/api/auth/email-login', body: {'email': 'a@b.co'}, options: _noAuth),
        throwsA(isA<ApiError>().having((e) => e.code, 'code', 'origin_refused')),
      );
      expect(opened, isEmpty);
    });

    test('a dropped API_BASE_URL in a staging build sends no sign-in to production', () async {
      final (api, opened) = _client(_droppedDefine);
      await expectLater(
        api.post('/api/auth/email-login', body: {'email': 'a@b.co'}, options: _noAuth),
        throwsA(isA<ApiError>().having((e) => e.code, 'code', 'origin_refused')),
      );
      expect(opened, isEmpty);
    });

    test('the production build still reaches production', () async {
      final (api, opened) = _client(_prod);
      await api.post('/api/auth/email-login', body: {'email': 'a@b.co'}, options: _noAuth);
      expect(opened.single.toString(), 'https://www.mockmob.in/api/auth/email-login');
    });
  });

  test('every network client in lib takes its origin from AppConfig', () {
    // The only places that open connections, and the define each one reads.
    const clients = {
      'lib/core/api/api_client.dart': 'config.apiBaseUrl',
      'lib/core/auth/token_client.dart': '_config.supabaseUrl',
      'lib/core/connectivity/connectivity_providers.dart': 'config.pingUrl',
      'lib/core/auth/auth_service.dart': 'config.supabaseUrl',
    };
    final opener = RegExp(r'\bDio\(|\bHttpClient\(\)|\bhttp\.(get|post|put|delete|Client)\(|Supabase\.initialize\(');
    final literalCall = RegExp(r'''\.(get|post|put|patch|delete|head|request|fetch)\w*(<[^>]*>)?\(\s*['"]https?://''');
    final found = <String>{};
    for (final f in Directory('lib').listSync(recursive: true).whereType<File>().where((f) => f.path.endsWith('.dart'))) {
      final path = f.path.replaceAll(r'\', '/');
      final text = f.readAsStringSync();
      if (opener.hasMatch(text)) found.add(path);
      expect(literalCall.hasMatch(text), isFalse, reason: '$path calls a hard-coded origin');
    }
    expect(found, clients.keys.toSet(), reason: 'a new network client must read its origin from AppConfig and be listed here');
    clients.forEach((path, read) => expect(File(path).readAsStringSync(), contains(read), reason: path));
  });
}
