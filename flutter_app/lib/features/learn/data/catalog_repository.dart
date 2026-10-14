import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/json_remote_notifier.dart';
import '../../../core/repositories/remote_state.dart';
import '../models/learn_catalog.dart';
import 'learn_store.dart';
import 'study_api.dart';

/// `GET /api/study/catalog` for every subject, cached with its fetch time so Learn opens at
/// once and can say it is showing what was last loaded when offline. It also drops kept lessons
/// whose version has changed.
class LearnCatalogRepository extends JsonRemoteNotifier<LearnCatalog> {
  @override
  String get cacheKey => 'study_catalog';

  @override
  LearnCatalog parse(Object? json) => LearnCatalog.fromJson(asJson(json));

  @override
  Future<Object?> fetchJson() async => (await ref.read(studyApiProvider).catalog()).data;

  @override
  Future<Fetched<LearnCatalog>> fetchRemote() async {
    final fetched = await super.fetchRemote();
    final versions = {for (final u in fetched.value.units) u.id: u.version};
    unawaited(ref.read(learnStoreProvider).dropChanged(versions).catchError((Object _) {}));
    return fetched;
  }
}

final learnCatalogProvider = NotifierProvider<LearnCatalogRepository, RemoteState<LearnCatalog>>(LearnCatalogRepository.new);
