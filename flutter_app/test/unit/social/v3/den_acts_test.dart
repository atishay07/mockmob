// The den's event acts (MOB-MINIMAL 4.2): which real events play an act, and the once-only memory on the phone.

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/logic/den_acts.dart';
import 'package:mockmob/features/social/v3/widgets/fold_acts.dart';

import 'mob_v3_test_kit.dart';

const _you = MobV3Member(memberId: 'AARAV0000001', name: 'Aarav', you: true);
const _riya = MobV3Member(memberId: 'RIYA00000002', name: 'Riya');
const _kabir = MobV3Member(memberId: 'KABIR0000003', name: 'Kabir');
const _zoya = MobV3Member(memberId: 'ZOYA00000004', name: 'Zoya');
const _meher = MobV3Member(memberId: 'MEHER0000005', name: 'Meher');

final _now = DateTime.utc(2026, 10, 22, 15, 10);

MobV3 _den(List<MobV3Member> members, [List<Reaction> reactions = const []]) => MobV3(name: const MobV3Name(text: 'Chai Circle'), members: members, reactions: reactions);

Reaction _sticker(MobV3Member from, StickerKind kind, Duration ago) => Reaction(memberId: from.memberId, kind: kind, at: _now.subtract(ago));

void main() {
  group('a friend joins', () {
    test('the first open of a Mob plays nothing: everyone there is already there', () {
      final v3 = _den([_you, _riya, _kabir], [_sticker(_riya, StickerKind.niceOne, const Duration(minutes: 5))]);
      final memory = DenActs.baseline(v3);
      expect(memory.members, {'AARAV0000001', 'RIYA00000002', 'KABIR0000003'});
      expect(DenActs.eventsSince(v3, memory, now: _now).events, isEmpty);
      expect(DenActs.newcomers(v3, memory), isEmpty);
    });

    test('a member who was not there when this phone last saw the den is a join; you never are', () {
      final seen = DenActs.baseline(_den([_you, _riya, _kabir]));
      final now = _den([_you, _riya, _kabir, _zoya]);
      expect(DenActs.newcomers(now, seen), {'ZOYA00000004'});
      expect(DenActs.eventsSince(now, seen, now: _now).events, [const DenEvent.join('ZOYA00000004')]);
      final fresh = DenActs.baseline(_den([_riya]));
      expect(DenActs.newcomers(_den([_you, _riya]), fresh), isEmpty, reason: 'your own seat never hops in');
    });

    test('several joins play in join order, at most three acts wait, the earliest past the cap stand in their seats', () {
      final seen = DenActs.baseline(_den([_you]));
      final found = DenActs.eventsSince(_den([_you, _riya, _kabir, _zoya, _meher]), seen, now: _now);
      expect([for (final e in found.events) e.memberId], ['KABIR0000003', 'ZOYA00000004', 'MEHER0000005']);
      expect([for (final e in found.skipped) e.memberId], ['RIYA00000002']);
      final withCheer = DenActs.eventsSince(_den([_you, _riya, _kabir, _zoya], [_sticker(_zoya, StickerKind.goodLuck, const Duration(minutes: 1))]), seen, now: _now);
      expect([for (final e in withCheer.events) e.key], ['join:KABIR0000003', 'join:ZOYA00000004', startsWith('reaction:ZOYA00000004:good_luck:')]);
      expect([for (final e in withCheer.skipped) e.memberId], ['RIYA00000002']);
    });

    test('a join plays once: once it has played the newcomer is simply there', () {
      final v3 = _den([_you, _riya, _zoya]);
      var memory = DenActs.baseline(_den([_you, _riya]));
      final e = DenActs.eventsSince(v3, memory, now: _now).events.single;
      memory = DenActs.played(memory, e);
      expect(DenActs.eventsSince(v3, memory, now: _now).events, isEmpty);
      expect(DenActs.newcomers(v3, memory), isEmpty);
    });

    test('a friend who leaves is forgotten, so coming back is a join again', () {
      var memory = DenActs.baseline(_den([_you, _riya, _zoya]));
      memory = DenActs.tidy(memory, _den([_you, _riya]), now: _now);
      expect(memory.members, isNot(contains('ZOYA00000004')));
      expect(DenActs.eventsSince(_den([_you, _riya, _zoya]), memory, now: _now).events, [const DenEvent.join('ZOYA00000004')]);
    });
  });

  group('a reaction', () {
    test("a friend's sticker newer than the newest one seen makes one cheer, led by the newest sender", () {
      final memory = DenActs.baseline(_den([_you, _riya, _kabir], [_sticker(_riya, StickerKind.niceOne, const Duration(hours: 2))]));
      final v3 = _den([_you, _riya, _kabir], [
        _sticker(_kabir, StickerKind.again, const Duration(minutes: 3)),
        _sticker(_riya, StickerKind.soClose, const Duration(minutes: 9)),
        _sticker(_riya, StickerKind.niceOne, const Duration(hours: 2)),
      ]);
      final e = DenActs.eventsSince(v3, memory, now: _now).events.single;
      expect(e.kind, DenEventKind.reaction);
      expect(e.memberId, 'KABIR0000003');
      expect(e.sticker, StickerKind.again);
      // Played: the mark moves past every sticker in the read, so nothing cheers again.
      final after = DenActs.played(memory, e, reactionsUpTo: DenActs.eventsSince(v3, memory, now: _now).reactionsUpTo);
      expect(DenActs.eventsSince(v3, after, now: _now).events, isEmpty);
    });

    test('your own sticker, a stale one (over 12 hours) or one from someone no longer in the Mob never cheers', () {
      final memory = DenActs.baseline(_den([_you, _riya]));
      expect(DenActs.reactionSince(_den([_you, _riya], [_sticker(_you, StickerKind.niceOne, const Duration(minutes: 1))]), memory, now: _now), isNull);
      expect(DenActs.reactionSince(_den([_you, _riya], [_sticker(_riya, StickerKind.niceOne, const Duration(hours: 13))]), memory, now: _now), isNull);
      expect(DenActs.reactionSince(_den([_you, _riya], [_sticker(_zoya, StickerKind.niceOne, const Duration(minutes: 1))]), memory, now: _now), isNull);
      expect(DenActs.reactionSince(_den([_you, _riya], [_sticker(_riya, StickerKind.niceOne, const Duration(minutes: 1))]), memory, now: _now), isNotNull);
    });

    test('a sticker seen on the first open is already seen', () {
      final v3 = _den([_you, _riya], [_sticker(_riya, StickerKind.letsGo, const Duration(minutes: 1))]);
      expect(DenActs.reactionSince(v3, DenActs.baseline(v3), now: _now), isNull);
    });

    test('a stale sticker moves the mark when the memory is tidied, so it never waits', () {
      final memory = DenActs.tidy(DenActs.baseline(_den([_you, _riya])), _den([_you, _riya], [_sticker(_riya, StickerKind.again, const Duration(hours: 20))]), now: _now);
      expect(memory.reactionsUpTo, _now.subtract(const Duration(hours: 20)));
    });
  });

  group('the memory on the phone', () {
    test('encodes and decodes; anything unreadable reads as a first open', () {
      final m = DenActMemory(members: const {'B', 'A'}, reactionsUpTo: _now);
      final back = DenActMemory.decode(m.encode())!;
      expect(back.members, {'A', 'B'});
      expect(back.reactionsUpTo, _now);
      expect(DenActMemory.decode(null), isNull);
      expect(DenActMemory.decode('not json'), isNull);
      expect(DenActMemory.decode('{"v":2,"m":[]}'), isNull);
    });

    test('the book keeps one memory per Mob in the prefs store', () async {
      final store = MemoryPrefsStore();
      final book = DenActBook(store);
      expect(await book.load('mob-a'), isNull);
      await book.save('mob-a', const DenActMemory(members: {'X'}));
      expect(store.values[DenActBook.keyFor('mob-a')], isA<String>());
      final again = DenActBook(store);
      expect((await again.load('mob-a'))!.members, {'X'});
      expect(await again.load('mob-b'), isNull);
    });
  });

  group('the fixture server (demo builds)', () {
    test("heavy with arrivals: Meher joins on a den read 3 s after the first, then says Let's go", () async {
      var clock = v3Now;
      final server = MobV3FakeServer(clock: () => clock, arrivals: true);
      final first = MobV3.fromJson((await server.den() as Map)['v3'] as Map<String, Object?>);
      expect(first.members, hasLength(4));
      clock = v3Now.add(const Duration(seconds: 2));
      expect(((await server.den() as Map)['v3'] as Map)['members'] as List, hasLength(4));
      clock = v3Now.add(MobV3FakeServer.arrivalAfter);
      final later = MobV3.fromJson((await server.den() as Map)['v3'] as Map<String, Object?>);
      expect([for (final m in later.members) m.name], ['Aarav', 'Riya', 'Kabir', 'Zoya', 'Meher']);
      expect(later.reactions.first.memberId, MobV3FakeServer.newcomerId);
      expect(later.reactions.first.kind, StickerKind.letsGo);
      // The den that first saw four plays Meher's join, then one cheer led by Meher.
      final found = DenActs.eventsSince(later, DenActs.baseline(first), now: clock);
      expect([for (final e in found.events) e.key], ['join:MEHER0000005', startsWith('reaction:MEHER0000005:lets_go:')]);
    });

    test('the tests\' fixture server never adds anyone on its own', () async {
      var clock = v3Now;
      final server = MobV3FakeServer(clock: () => clock);
      await server.den();
      clock = v3Now.add(const Duration(hours: 1));
      expect(((await server.den() as Map)['v3'] as Map)['members'] as List, hasLength(4));
    });
  });

  group('the acts\' lengths', () {
    test('reduced motion: a join cross-fades in 120 ms; a reaction keeps its length and ends idle', () {
      expect(DenActPlayer.lengthFor(DenActKind.join), JoinAct.total);
      expect(DenActPlayer.lengthFor(DenActKind.join, reduced: true), 120);
      expect(DenActPlayer.lengthFor(DenActKind.reaction, reduced: true, members: 4), ReactionAct.totalFor(4));
      final end = ReactionAct.totalFor(4);
      for (var i = 0; i < 4; i++) {
        expect(DenActPlayer.frame(DenActKind.reaction, end, index: i, reduced: true).pose, FoldPose.idle);
        expect(DenActPlayer.frame(DenActKind.reaction, end, index: i).pose, FoldPose.idle);
      }
      final mid = DenActPlayer.frame(DenActKind.join, 60, fromDx: 200, reduced: true);
      expect(mid.dx, 0);
      expect(mid.opacity, closeTo(0.5, 0.01));
    });
  });
}
