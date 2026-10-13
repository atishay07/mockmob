import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/platform/native_prefs.dart';
import 'package:mockmob/core/platform/play_update.dart';
import 'package:mockmob/core/storage/prefs_store.dart';

class _Play implements PlayUpdateGateway {
  PlayUpdateOffer? offer;
  bool accept = true;
  int checks = 0;
  int starts = 0;
  int installs = 0;
  final StreamController<void> finished = StreamController<void>.broadcast();

  @override
  Future<PlayUpdateOffer?> check() async {
    checks++;
    return offer;
  }

  @override
  Future<bool> startFlexible() async {
    starts++;
    return accept;
  }

  @override
  Stream<void> get downloaded => finished.stream;

  @override
  Future<void> install() async => installs++;
}

void main() {
  late _Play play;
  late NativePrefs prefs;
  late DateTime now;
  late bool sessionOpen;

  PlayUpdateRunner make() => PlayUpdateRunner(gateway: play, prefs: prefs, now: () => now, sessionOpen: () => sessionOpen);

  setUp(() {
    play = _Play();
    prefs = NativePrefs(MemoryPrefsStore());
    now = DateTime.utc(2026, 10, 14, 12);
    sessionOpen = false;
  });

  test('a sideloaded build (no offer) does nothing and never starts a download', () async {
    final runner = make();
    await runner.onStart();
    expect(play.checks, 1);
    expect(play.starts, 0);
    expect(runner.readyToInstall, isFalse);
  });

  test('checks at most once a day', () async {
    await make().onStart();
    await make().onStart();
    expect(play.checks, 1);

    now = now.add(const Duration(hours: 23));
    await make().onStart();
    expect(play.checks, 1);

    now = now.add(const Duration(hours: 2));
    await make().onStart();
    expect(play.checks, 2);
  });

  test('a flexible update is started, then installed only when the app goes to the background', () async {
    play.offer = const PlayUpdateOffer(flexibleAllowed: true, downloaded: false);
    final runner = make();
    await runner.onStart();
    expect(play.starts, 1);
    expect(runner.readyToInstall, isFalse);

    play.finished.add(null);
    await Future<void>.delayed(Duration.zero);
    expect(runner.readyToInstall, isTrue);
    expect(play.installs, 0, reason: 'the app never restarts under a student who is studying');

    await runner.onBackground();
    expect(play.installs, 1);
    expect(runner.readyToInstall, isFalse);
    await runner.dispose();
  });

  test('an update that is already downloaded waits for the background too', () async {
    play.offer = const PlayUpdateOffer(flexibleAllowed: true, downloaded: true);
    final runner = make();
    await runner.onStart();
    expect(play.starts, 0);
    expect(runner.readyToInstall, isTrue);
    await runner.onBackground();
    expect(play.installs, 1);
  });

  test('it never installs while a session is open', () async {
    play.offer = const PlayUpdateOffer(flexibleAllowed: true, downloaded: true);
    final runner = make();
    await runner.onStart();
    sessionOpen = true;
    await runner.onBackground();
    expect(play.installs, 0);
    expect(runner.readyToInstall, isTrue, reason: 'it installs on a later background, or Play does on the next launch');
    sessionOpen = false;
    await runner.onBackground();
    expect(play.installs, 1);
  });

  test('it does not check or ask while a session is open, and keeps the day for later', () async {
    play.offer = const PlayUpdateOffer(flexibleAllowed: true, downloaded: false);
    sessionOpen = true;
    await make().onStart();
    expect(play.checks, 0);
    expect(await prefs.updateCheckedAt(), isNull);
  });

  test('an update Play does not allow as flexible is left alone', () async {
    play.offer = const PlayUpdateOffer(flexibleAllowed: false, downloaded: false);
    await make().onStart();
    expect(play.starts, 0);
  });

  test('a declined update is not installed', () async {
    play.offer = const PlayUpdateOffer(flexibleAllowed: true, downloaded: false);
    play.accept = false;
    final runner = make();
    await runner.onStart();
    await runner.onBackground();
    expect(play.installs, 0);
  });
}
