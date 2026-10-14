import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/platform/native_prefs.dart';
import 'package:mockmob/core/platform/play_update.dart';
import 'package:mockmob/core/storage/prefs_store.dart';

class _Play implements PlayUpdateGateway {
  PlayUpdateOffer? offer;
  bool accept = true;
  bool fails = false;
  int checks = 0;
  int starts = 0;
  int installs = 0;
  final StreamController<void> finished = StreamController<void>.broadcast();

  @override
  Future<PlayUpdateOffer?> check() async {
    checks++;
    if (fails) throw const PlayCheckFailed();
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

  test('offers a new download at most once a day', () async {
    play.offer = const PlayUpdateOffer(flexibleAllowed: true, downloaded: false);
    await make().onStart();
    await make().onStart();
    expect(play.starts, 1);

    now = now.add(const Duration(hours: 23));
    await make().onStart();
    expect(play.starts, 1);

    now = now.add(const Duration(hours: 2));
    await make().onStart();
    expect(play.starts, 2);
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

  test('a download that finishes after the student left the app is installed at once', () async {
    play.offer = const PlayUpdateOffer(flexibleAllowed: true, downloaded: false);
    final runner = make();
    await runner.onStart();
    await runner.onBackground();
    expect(play.installs, 0, reason: 'nothing is downloaded yet');

    play.finished.add(null);
    await Future<void>.delayed(Duration.zero);
    expect(play.installs, 1);
    expect(runner.readyToInstall, isFalse);
    await runner.dispose();
  });

  test('a download that finishes once the student is back waits for the next time they leave', () async {
    play.offer = const PlayUpdateOffer(flexibleAllowed: true, downloaded: false);
    final runner = make();
    await runner.onStart();
    await runner.onBackground();
    runner.onForeground();

    play.finished.add(null);
    await Future<void>.delayed(Duration.zero);
    expect(play.installs, 0);
    expect(runner.readyToInstall, isTrue);
    await runner.onBackground();
    expect(play.installs, 1);
    await runner.dispose();
  });

  test('a hidden download waits for a session to close before it installs', () async {
    play.offer = const PlayUpdateOffer(flexibleAllowed: true, downloaded: false);
    final runner = make();
    await runner.onStart();
    await runner.onBackground();
    sessionOpen = true;
    play.finished.add(null);
    await Future<void>.delayed(Duration.zero);
    expect(play.installs, 0);
    sessionOpen = false;
    await runner.onBackground();
    expect(play.installs, 1);
    await runner.dispose();
  });

  test('a relaunch inside the day still picks up an update that finished while the app was closed', () async {
    play.offer = const PlayUpdateOffer(flexibleAllowed: true, downloaded: false);
    await make().onStart();
    expect(play.starts, 1);

    now = now.add(const Duration(hours: 3));
    play.offer = const PlayUpdateOffer(flexibleAllowed: true, downloaded: true);
    final runner = make();
    await runner.onStart();
    expect(play.starts, 1, reason: 'no second download is offered inside the day');
    expect(runner.readyToInstall, isTrue);
    await runner.onBackground();
    expect(play.installs, 1);
  });

  test('a relaunch while Play is still downloading installs it when it finishes', () async {
    play.offer = const PlayUpdateOffer(flexibleAllowed: true, downloaded: false, downloading: true);
    final runner = make();
    await runner.onStart();
    expect(play.starts, 0);
    await runner.onBackground();
    play.finished.add(null);
    await Future<void>.delayed(Duration.zero);
    expect(play.installs, 1);
    await runner.dispose();
  });

  test('a check that could not reach Play does not use up the day', () async {
    play.offer = const PlayUpdateOffer(flexibleAllowed: true, downloaded: false);
    play.fails = true;
    await make().onStart();
    expect(play.starts, 0);
    expect(await prefs.updateCheckedAt(), isNull);

    play.fails = false;
    now = now.add(const Duration(minutes: 5));
    await make().onStart();
    expect(play.checks, 2);
    expect(play.starts, 1, reason: 'the next launch asks again and offers the update');
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
