// What a student can do to My colleges, and the one view every screen reads.
//
// Every change shows at once and is then confirmed by the server's own answer. Changes run one at
// a time, so two quick taps cannot reorder each other. When the server refuses or cannot be
// reached the list goes back to what the server last confirmed and a plain line says why.
//
// A list kept before this one existed is moved over once, only after the server list has loaded:
// the colleges from the setup (the Today ladder) and the Compass shortlist kept on this phone.

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/my_colleges.dart';
import '../../../core/repositories/remote_state.dart';
import '../../onboarding/onboarding.dart' show DuCatalog, onboardingAnswersProvider;
import '../my_colleges/my_colleges_copy.dart';
import 'my_colleges_repository.dart';
import 'tools_store.dart';

/// How a change ended.
enum MyCollegesOutcome {
  /// The server confirmed it.
  saved,

  /// The list is at its limit.
  full,

  /// The list has not loaded, so nothing was sent.
  notLoaded,

  /// No connection: nothing was saved.
  offline,

  /// The server refused or failed: nothing was saved.
  failed,
}

class MyCollegesChange {
  const MyCollegesChange({this.busy = false, this.notice = ''});

  /// A change is being saved.
  final bool busy;

  /// A plain line about the last change that did not save, or empty.
  final String notice;
}

class MyCollegesActions extends Notifier<MyCollegesChange> {
  Future<void> _chain = Future<void>.value();
  int _pending = 0;
  MyColleges? _confirmed;
  String? _migrationStartedFor;

  static String movedKey(String userId) => 'mm.mycolleges.moved.v1.$userId';

  @override
  MyCollegesChange build() {
    ref.listen<RemoteState<MyColleges>>(myCollegesRepositoryProvider, (previous, next) => _read(next));
    _read(ref.read(myCollegesRepositoryProvider));
    return const MyCollegesChange();
  }

  /// The server's own list has arrived (not the copy on the phone, not a failed read).
  void _read(RemoteState<MyColleges> s) {
    if (s.value == null || s.fromCache || s.loading || s.error != null) return;
    if (_pending == 0) _confirmed = s.value;
    final id = ref.read(authSnapshotProvider).userId;
    if (id != null && _migrationStartedFor != id && _pending == 0) {
      _migrationStartedFor = id;
      scheduleMicrotask(() {
        if (ref.mounted) unawaited(_migrate(id));
      });
    }
  }

  MyCollegesRepository get _repo => ref.read(myCollegesRepositoryProvider.notifier);

  Future<MyCollegesOutcome> add(MyCollege entry) => _change(
        (list) => list.withAdded(entry),
        (id) => _repo.sendAdd(entry, id),
        guard: (list) => list.contains(entry) ? MyCollegesOutcome.saved : (list.isFull ? MyCollegesOutcome.full : null),
      );

  Future<MyCollegesOutcome> remove(MyCollege entry) => _change((list) => list.withRemoved(entry), (id) => _repo.sendRemove(entry, id));

  /// The whole list in the order given.
  Future<MyCollegesOutcome> replace(MyColleges next) => _change((_) => next, (id) => _repo.sendReplace(next, id));

  /// The college at [from] one place or more to [to].
  Future<MyCollegesOutcome> move(int from, int to) {
    final shown = ref.read(myCollegesRepositoryProvider).value;
    if (shown == null) return Future.value(MyCollegesOutcome.notLoaded);
    final next = shown.withMoved(from, to);
    if (identical(next, shown)) return Future.value(MyCollegesOutcome.saved);
    return replace(next);
  }

  /// Reads the list from the server again (the "Try again" key).
  Future<void> retry() => _repo.refresh(force: true);

  void dismissNotice() {
    if (state.notice.isNotEmpty) state = MyCollegesChange(busy: state.busy);
  }

  Future<MyCollegesOutcome> _change(
    MyColleges Function(MyColleges shown) optimistic,
    Future<Object?> Function(String userId) send, {
    MyCollegesOutcome? Function(MyColleges shown)? guard,
  }) {
    final repo = _repo;
    final shown = ref.read(myCollegesRepositoryProvider).value;
    final id = repo.userId;
    if (shown == null || id == null) return Future.value(MyCollegesOutcome.notLoaded);
    final early = guard?.call(shown);
    if (early != null) {
      state = MyCollegesChange(busy: state.busy, notice: early == MyCollegesOutcome.full ? MyCollegesCopy.fullLine : '');
      return Future.value(early);
    }
    if (_pending == 0) _confirmed = shown;
    _pending++;
    repo.showOptimistic(optimistic(shown));
    state = const MyCollegesChange(busy: true);

    Future<MyCollegesOutcome> run() async {
      try {
        final body = await send(id);
        if (!ref.mounted || repo.userId != id) return MyCollegesOutcome.saved;
        await repo.accept(body, id);
        _confirmed = ref.read(myCollegesRepositoryProvider).value ?? _confirmed;
        return MyCollegesOutcome.saved;
      } on ApiError catch (e) {
        if (!ref.mounted || repo.userId != id || e.isAccountChanged) return MyCollegesOutcome.failed;
        final full = e.status == 409 && e.hasCode('list_full');
        // Whatever went wrong, show what the server last confirmed. A full list or a doubtful answer
        // is read from the server again so the screen shows its list.
        _revert();
        if (full || !e.isOffline) unawaited(repo.refresh(force: true));
        if (full) return _note(MyCollegesOutcome.full, MyCollegesCopy.fullLine);
        return _note(e.isOffline ? MyCollegesOutcome.offline : MyCollegesOutcome.failed, _lineFor(e));
      } on Object {
        // The server answered something that is not a list: it may have applied the change, so read again.
        if (!ref.mounted || repo.userId != id) return MyCollegesOutcome.failed;
        _revert();
        unawaited(repo.refresh(force: true));
        return _note(MyCollegesOutcome.failed, MyCollegesCopy.saveFailed);
      }
    }

    final result = _chain.then((_) => run(), onError: (Object _) => run());
    _chain = result.then<void>((_) {}, onError: (Object _) {});
    return result.whenComplete(() {
      _pending--;
      if (ref.mounted && _pending == 0) state = MyCollegesChange(notice: state.notice);
    });
  }

  void _revert() {
    final confirmed = _confirmed;
    if (confirmed != null) _repo.showOptimistic(confirmed);
  }

  MyCollegesOutcome _note(MyCollegesOutcome outcome, String line) {
    if (ref.mounted) state = MyCollegesChange(busy: state.busy, notice: line);
    return outcome;
  }

  static String _lineFor(ApiError e) {
    if (e.isOffline) return MyCollegesCopy.offlineSave;
    if (e.isUnauthorized) return MyCollegesCopy.signInAgain;
    if (e.isRateLimited) return MyCollegesCopy.slowDown;
    return MyCollegesCopy.saveFailed;
  }

  // ---- the lists kept before this one -------------------------------------------------------------------------

  /// The colleges named in the setup (course and colleges) and the shortlist kept on this phone, as My
  /// colleges entries in that order: the setup first, because it was the Today ladder.
  Future<List<MyCollege>> _legacy(String userId) async {
    final found = <MyCollege>[];
    try {
      final answers = await ref.read(onboardingAnswersProvider.future);
      final owner = answers.owner;
      final course = DuCatalog.course(answers.courseId);
      if (course != null && (owner == null || owner == userId)) {
        for (final name in answers.colleges) {
          final o = course.offeringAt(name);
          if (o != null) found.add(MyCollege(programmeId: course.id, programme: course.name, college: o.college));
        }
      }
    } on Object {
      // A setup that cannot be read adds nothing: the shortlist below is still moved.
    }
    try {
      for (final t in await ref.read(toolsStoreProvider).shortlist(userId)) {
        found.add(MyCollege(programmeId: t.groupId, programme: t.programme, college: t.college));
      }
    } on Object {
      // No readable shortlist: nothing to add.
    }
    return found;
  }

  Future<void> _migrate(String userId) async {
    final prefs = ref.read(toolsPrefsProvider);
    try {
      if (await prefs.getBool(movedKey(userId)) == true) return;
    } on Object {
      return;
    }
    final legacy = await _legacy(userId);
    if (!ref.mounted || _repo.userId != userId) return;
    var droppedForRoom = false;
    for (final entry in legacy) {
      final shown = ref.read(myCollegesRepositoryProvider).value;
      if (shown == null) return;
      if (shown.contains(entry)) continue;
      if (shown.isFull) {
        droppedForRoom = true;
        continue;
      }
      final outcome = await add(entry);
      if (!ref.mounted) return;
      // A refusal for the wrong reason (no connection, a failed save) ends the move: it runs again next time.
      if (outcome == MyCollegesOutcome.offline || outcome == MyCollegesOutcome.failed || outcome == MyCollegesOutcome.notLoaded) return;
      if (outcome == MyCollegesOutcome.full) droppedForRoom = true;
    }
    try {
      await prefs.setBool(movedKey(userId), true);
      if (!droppedForRoom) await ref.read(toolsStoreProvider).saveShortlist(userId, const []);
    } on Object {
      // The flag is only a courtesy: a second move finds every college already on the list.
    }
    if (ref.mounted) state = MyCollegesChange(busy: state.busy);
  }
}

final myCollegesActionsProvider = NotifierProvider<MyCollegesActions, MyCollegesChange>(MyCollegesActions.new);

enum MyCollegesStatus {
  /// Nobody is signed in.
  signedOut,

  /// The first read is running and nothing is kept on the phone.
  loading,

  /// A list is showing (the server's, or the last one it confirmed).
  ready,

  /// The read failed and no list is kept on the phone.
  failed,
}

/// What a screen shows about My colleges.
class MyCollegesView {
  const MyCollegesView({
    required this.status,
    this.list = MyColleges.empty,
    this.stale = false,
    this.offline = false,
    this.busy = false,
    this.notice = '',
  });

  final MyCollegesStatus status;
  final MyColleges list;

  /// The list shown is the copy kept on this phone, because the server could not be read.
  final bool stale;

  /// The failed read had no connection.
  final bool offline;

  /// A change is being saved.
  final bool busy;

  /// A plain line about the last change that did not save.
  final String notice;

  bool get ready => status == MyCollegesStatus.ready;

  /// A real list is known (the server's or the phone's copy). An empty list counts: it was read.
  bool get hasList => ready;

  List<MyCollege> get colleges => list.colleges;
}

/// The one view of My colleges, for Today, Compass and You.
final myCollegesProvider = Provider<MyCollegesView>((ref) {
  final repo = ref.watch(myCollegesRepositoryProvider);
  final change = ref.watch(myCollegesActionsProvider);
  final signedIn = ref.watch(authSnapshotProvider.select((s) => s.userId != null));
  if (!signedIn) return const MyCollegesView(status: MyCollegesStatus.signedOut);
  final value = repo.value;
  if (value == null) {
    if (repo.isFailedEmpty) return MyCollegesView(status: MyCollegesStatus.failed, offline: repo.error!.isOffline);
    return const MyCollegesView(status: MyCollegesStatus.loading);
  }
  return MyCollegesView(
    status: MyCollegesStatus.ready,
    list: value,
    stale: repo.isStale,
    offline: repo.error?.isOffline ?? false,
    busy: change.busy,
    notice: change.notice,
  );
});
