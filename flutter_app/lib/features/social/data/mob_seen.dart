import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'mob_repository.dart';

/// How many filled segments this student has already seen this week (a phone-only memory), so
/// only sitters who are new since the last look ink in. Keyed by the Mob week.
class MobSeen extends AsyncNotifier<int> {
  MobSeen(this.week);

  final String week;

  String get _key => 'mob.seen.$week';

  @override
  Future<int> build() async {
    try {
      return await ref.read(mobPrefsStoreProvider).getInt(_key) ?? 0;
    } on Object {
      return 0;
    }
  }

  Future<void> mark(int sat) async {
    state = AsyncData(sat);
    try {
      await ref.read(mobPrefsStoreProvider).setInt(_key, sat);
    } on Object {
      // Only the ink memory: the next look inks again.
    }
  }
}

final mobSeenProvider = AsyncNotifierProvider.family<MobSeen, int, String>(MobSeen.new);

/// Whether this week's completed ring has had its one Mobi moment on Today.
class MobMoment {
  MobMoment(this.ref);

  final Ref ref;

  Future<bool> claim(String week) async {
    final store = ref.read(mobPrefsStoreProvider);
    final key = 'mob.moment.$week';
    try {
      if (await store.getBool(key) ?? false) return false;
      await store.setBool(key, true);
      return true;
    } on Object {
      return false;
    }
  }
}

final mobMomentProvider = Provider<MobMoment>(MobMoment.new);
