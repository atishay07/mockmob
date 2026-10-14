import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../sync/pending_work.dart';
import 'connectivity_monitor.dart';

bool _hasRadio(List<ConnectivityResult> results) => results.any((r) => r != ConnectivityResult.none);

/// Long enough for a slow 2G or 3G link: the ping must not call a working network offline.
const pingTimeout = Duration(seconds: 12);

/// The ping is a HEAD on a cached public endpoint. Any HTTP answer proves the network, and so
/// does a connection that opened but answered slowly. Only failing to connect means offline.
Future<bool> _ping(String url, {HttpClientAdapter? adapter}) async {
  final dio = Dio(BaseOptions(connectTimeout: pingTimeout, receiveTimeout: pingTimeout, validateStatus: (_) => true));
  if (adapter != null) dio.httpClientAdapter = adapter;
  try {
    final response = await dio.head<Object?>(url);
    return response.statusCode != null;
  } on DioException catch (e) {
    return e.type == DioExceptionType.receiveTimeout || e.type == DioExceptionType.sendTimeout;
  } finally {
    dio.close();
  }
}

/// Pending-work aware connectivity. Also the API client's network observer, so real requests
/// keep it honest.
final connectivityMonitorProvider = Provider<ConnectivityMonitor>((ref) {
  final connectivity = Connectivity();
  final radio = StreamController<bool>();
  unawaited(connectivity.checkConnectivity().then((r) => radio.add(_hasRadio(r))));
  final sub = connectivity.onConnectivityChanged.listen((r) => radio.add(_hasRadio(r)));
  final monitor = ConnectivityMonitor(
    radioPresent: radio.stream,
    ping: () => _ping(ref.read(appConfigProvider).pingUrl),
    hasPendingWork: () => ref.read(pendingWorkProvider),
  );
  ref.listen(pendingWorkProvider, (previous, next) => monitor.pendingWorkChanged());
  ref.onDispose(() {
    unawaited(sub.cancel());
    unawaited(radio.close());
    unawaited(monitor.dispose());
  });
  return monitor;
});

/// Online, offline or unknown, for banners and for deciding to show "Connect to start".
final networkStatusProvider = NotifierProvider<NetworkStatusNotifier, NetworkStatus>(NetworkStatusNotifier.new);

class NetworkStatusNotifier extends Notifier<NetworkStatus> {
  @override
  NetworkStatus build() {
    final monitor = ref.watch(connectivityMonitorProvider);
    void listener() => state = monitor.status.value;
    monitor.status.addListener(listener);
    ref.onDispose(() => monitor.status.removeListener(listener));
    return monitor.status.value;
  }
}

/// Emits each time the network returns after being offline.
///
/// Every event carries a fresh token. A provider only notifies when its value changes, and
/// `AsyncData(null)` equals `AsyncData(null)`, so plain `null` events would reach listeners on
/// the first reconnect only and a second reconnect would never retry a pending submit.
final networkRestoredProvider = StreamProvider<void>(
  (ref) => ref.watch(connectivityMonitorProvider).restored.map<void>((_) => _RestoreEvent()),
);

/// One reconnect. Identity equality keeps each event distinct from the last.
final class _RestoreEvent {}

@visibleForTesting
Future<bool> pingForTest(String url, {HttpClientAdapter? adapter}) => _ping(url, adapter: adapter);
