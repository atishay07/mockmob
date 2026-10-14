// Where the DU files come from: the same static JSON the website serves at
// `https://www.mockmob.in/du/2026/...` (public, no auth, no cost), kept on disk after the first
// load so the tools work offline, with an optional bundled copy of `index.json` for the very
// first run without a connection.

import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../../core/api/api.dart';

/// The cycle the files describe. Bump with the data.
const String duCycleFolder = 'du/2026';

/// Raw access to the DU files. Replaceable in tests.
abstract interface class DuSource {
  /// A fresh copy from the server, or throws an [ApiError].
  Future<String> fetch(String file);

  /// The last copy kept on this phone and when it was saved, or null.
  Future<({String body, DateTime savedAt})?> readCache(String file);
  Future<void> writeCache(String file, String body);

  /// The copy shipped inside the app, or null when the app has none.
  Future<String?> readBundled(String file);
}

/// Reads through [ApiClient] (unauthenticated GET, raw body) and keeps copies in the app's
/// support directory.
class HttpDuSource implements DuSource {
  HttpDuSource(this._api, {Future<Directory> Function()? directory, AssetBundle? bundle})
      : _directory = directory ?? getApplicationSupportDirectory,
        _bundle = bundle ?? rootBundle;

  final ApiClient _api;
  final Future<Directory> Function() _directory;
  final AssetBundle _bundle;

  @override
  Future<String> fetch(String file) async {
    final response = await _api.get(
      '/$duCycleFolder/$file',
      options: const ApiOptions(authenticated: false, plainBody: true, receiveTimeout: Duration(seconds: 20)),
    );
    final data = response.data;
    if (data is String) return data;
    // Dio may still hand back decoded JSON when the server sends a JSON content type.
    return jsonEncode(data);
  }

  Future<File> _file(String file) async {
    final dir = await _directory();
    return File(p.join(dir.path, 'du', '2026', file.replaceAll('/', p.separator)));
  }

  @override
  Future<({String body, DateTime savedAt})?> readCache(String file) async {
    try {
      final f = await _file(file);
      if (!f.existsSync()) return null;
      return (body: await f.readAsString(), savedAt: f.lastModifiedSync());
    } on Object {
      return null;
    }
  }

  @override
  Future<void> writeCache(String file, String body) async {
    try {
      final f = await _file(file);
      await f.parent.create(recursive: true);
      final tmp = File('${f.path}.part');
      await tmp.writeAsString(body, flush: true);
      await tmp.rename(f.path);
    } on Object {
      // A full disk only costs the offline copy; the tool still works while online.
    }
  }

  @override
  Future<String?> readBundled(String file) async {
    try {
      return await _bundle.loadString('assets/$duCycleFolder/$file');
    } on Object {
      return null;
    }
  }
}
