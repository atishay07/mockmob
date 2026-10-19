// Mob v3 contract (spec section 3): every fixture parses; the app never reads a correct option before
// close; the fixture server plays the server's rules (marks, places with shared ties, the trap, F1, F3,
// F8). Fixtures are the spec's JSON, in test/fixtures/mob_v3.

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/dev/mob_v3_bank.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/logic/fold_catalog.dart';
import 'package:mockmob/features/social/v3/logic/mob_names.dart';

Map<String, dynamic> fx(String name) => jsonDecode(File('test/fixtures/mob_v3/$name').readAsStringSync()) as Map<String, dynamic>;

void main() {
  group('fixtures parse', () {
    test('GET /api/mob with v3', () {
      final read = MobRead.fromJson(fx('den_v3.json'));
      expect(read.mob, isNotNull);
      final v3 = read.v3!;
      expect(v3.name.text, 'Chai Circle');
      expect(v3.members.single.fold, FoldKey.patang);
      expect(v3.games.single.runs.single.name, 'Riya');
      expect(v3.games.single.yourRun, YourRun.none);
      expect(v3.quest.answered, 51);
      expect(v3.quest.parcel.kind, ParcelKind.fold);
      expect(v3.quest.parcel.fold, FoldKey.hop);
      expect(v3.mobChain.weeks, 3);
      expect(v3.starts.can, isTrue);
      expect(v3.starts.via, StartVia.open);
      expect(v3.chainChip.days, 13);
      expect(v3.reactions.single.kind, StickerKind.niceOne);
      expect(v3.moments, ['quest_done:2026-10-19', 'reveal:hop']);
      expect(v3.live.enabled, isTrue);
    });

    test('a read without v3 falls back to today\'s Mob', () {
      final j = fx('den_v3.json')..remove('v3');
      final read = MobRead.fromJson(j);
      expect(read.mob, isNotNull);
      expect(read.v3, isNull);
    });

    test('unknown fields are ignored', () {
      final j = fx('den_v3.json');
      (j['v3'] as Map)['somethingNew'] = {'x': 1};
      ((j['v3'] as Map)['games'] as List).first['future'] = true;
      expect(MobRead.fromJson(j).v3!.games.length, 1);
    });

    test('starts: Free with a start, used, Pro', () {
      final free = StartRight.fromJson(fx('starts_free.json'));
      expect([free.billingOn, free.can, free.via, free.freeLeft], [true, true, StartVia.freeWeekly, 1]);
      expect(free.liveAllowed, isFalse);
      final used = StartRight.fromJson(fx('starts_used.json'));
      expect([used.can, used.reason, used.freeLeft], [false, 'used', 0]);
      final pro = StartRight.fromJson(fx('starts_pro.json'));
      expect([pro.via, pro.micsToGive], [StartVia.pro, 2]);
    });

    test('game, run, answer, podium, review, shelf, chain, invite, join, fix', () {
      final g = MobGame.fromEnvelope(fx('game.json'));
      expect(g.title, "Riya's sprint");
      expect(g.ghosts.single.arrivalsMs, [41000, 79000, 130000, 151000, 190000]);
      expect(g.ghosts.single.reachedAt(130000), 3);
      final run = RunStart.fromJson(fx('run.json'));
      expect(run.run.answers.single.correct, isTrue);
      expect(run.questions.single.options.length, 4);
      final a = AnswerResult.fromJson(fx('answer.json'));
      expect([a.correct, a.delta, a.marks], [true, 5, 14]);
      final skip = AnswerResult.fromJson(fx('answer_skip.json'));
      expect([skip.correct, skip.delta], [null, 0]);
      final p = Podium.fromJson(fx('podium.json'));
      expect(p.places.map((x) => x.place), [1, 2, 2, 4]);
      expect(p.floorPlaces.single.name, 'Zoya');
      expect(p.tie!.names, ['You', 'Kabir']);
      expect([p.right, p.of], [15, 20]);
      final r = Review.fromJson(fx('review.json'));
      expect(r.trap!.caught, 'most');
      expect(r.trap!.number, 4);
      expect(r.trap!.fix.fixedOf, 3);
      final s = Shelf.fromJson(fx('shelf.json'));
      expect(s.folds.last.mob, 'Chai Circle');
      expect(s.folds.first.foil.need, 30);
      final c = ChainState.fromJson(fx('chain.json'));
      expect([c.days, c.passesHeld, c.todayAnswered, c.todayNeeded], [14, 2, 2, 5]);
      expect(c.week.first.state, ChainDayState.rested);
      final inv = InviteV3.fromJson(fx('invite.json'));
      expect(inv.display, 'K7P 2M9');
      final jp = JoinPreview.fromJson(fx('join_preview.json'));
      expect([jp.valid, jp.seatsLeft], [true, 2]);
      final fs = FixStart.fromJson(fx('fix_start.json'));
      expect(fs.correctIndex, 2);
      final fa = FixAnswer.fromJson(fx('fix_answer.json'));
      expect([fa.correct, fa.fixedCount], [true, 1]);
    });

    test('a member carries no played state (F2)', () {
      final members = (fx('den_v3.json')['v3'] as Map)['members'] as List;
      for (final m in members) {
        expect((m as Map).keys.any((k) => k.toString().toLowerCase().contains('play') || k == 'sat'), isFalse);
      }
    });
  });

  group('codes', () {
    test('normalise O/0, I/L/1, spaces, hyphens and links', () {
      expect(normalizeJoinCode('k7p 2m9'), 'K7P2M9');
      expect(normalizeJoinCode('K7P-2M9'), 'K7P2M9');
      expect(normalizeJoinCode('https://www.mockmob.in/join/K7P2M9'), 'K7P2M9');
      expect(normalizeJoinCode('ABOIL1'), 'AB0111');
      expect(isJoinCode('K7P2M9'), isTrue);
      expect(isJoinCode('K7P2M9QX'), isTrue);
      expect(isJoinCode('K7P2M'), isFalse);
      expect(displayCode('K7P2M9'), 'K7P 2M9');
    });
  });

  group('names and catalog', () {
    test('24 kind names, no Night Owls (F9)', () {
      expect(mobNames.length, 24);
      expect(mobNames.toSet().length, 24);
      expect(mobNames.any((n) => n.toLowerCase().contains('night')), isFalse);
      expect(mobNameOf(0), 'Chai Circle');
      expect(mobNameOf(23), 'Calm Clocks');
    });

    test('the earn table (spec 0.4)', () {
      expect(foldCatalog.length, 12);
      expect([for (final r in foldCatalog) if (r.source == null) r.fold], FoldKey.starters);
      expect(foldRuleOf(FoldKey.hop).folds, 3);
      expect(foldRuleOf(FoldKey.crane).source, 'mob_traps');
      expect(foldRuleOf(FoldKey.cutting).folds, 2);
      expect(chainMilestones[30], 'foil');
    });
  });

  group('fixture server', () {
    late MobV3FakeServer s;
    setUp(() => s = MobV3FakeServer(scenario: 'heavy')..answerDelay = Duration.zero);

    Future<int> playRiya(List<bool?> rights) async {
      final start = await s.run('game-riya-sprint');
      for (final q in start.questions) {
        expect(q.toString(), isNot(contains('correct')));
      }
      var marks = 0;
      for (var i = 0; i < 5; i++) {
        final correct = mobV3Bank[i].correct;
        final r = rights[i];
        final pick = r == null ? -1 : (r ? correct : (correct + 1) % 4);
        final a = await s.answer('game-riya-sprint', q: i, pick: pick);
        marks = a.marks;
      }
      return marks;
    }

    test('the den is the spec fixture', () async {
      final read = MobRead.fromJson(Map<String, dynamic>.from(await s.den() as Map));
      final v3 = read.v3!;
      expect(v3.members.map((m) => m.name), ['Aarav', 'Riya', 'Kabir', 'Zoya']);
      expect(v3.openGames.length, 2);
      expect(v3.closedGames.length, 1);
      expect(v3.quest.answered, 51);
      expect(v3.quest.target, 60);
      final riya = v3.games.firstWhere((g) => g.id == 'game-riya-sprint');
      expect(riya.runs.map((r) => r.name), ['Riya', 'Kabir', 'Zoya']);
    });

    test('marks +5, -1, 0; a retry returns the stored result', () async {
      await s.run('game-riya-sprint');
      final a = await s.answer('game-riya-sprint', q: 0, pick: mobV3Bank[0].correct);
      expect([a.correct, a.delta, a.marks], [true, 5, 5]);
      final again = await s.answer('game-riya-sprint', q: 0, pick: (mobV3Bank[0].correct + 1) % 4);
      expect([again.correct, again.marks], [true, 5]);
      final w = await s.answer('game-riya-sprint', q: 1, pick: (mobV3Bank[1].correct + 1) % 4);
      expect([w.correct, w.delta, w.marks], [false, -1, 4]);
      final sk = await s.answer('game-riya-sprint', q: 2, pick: -1);
      expect([sk.correct, sk.delta, sk.marks], [null, 0, 4]);
    });

    test('podium so far: Riya 20 first, You and Kabir share second on 19, Zoya on the floor', () async {
      expect(await playRiya([true, true, false, true, true]), 19);
      final p = await s.podium('game-riya-sprint');
      expect(p.soFar, isTrue);
      expect([for (final x in p.places) (x.name, x.marks, x.place, x.floor)], [
        ('Riya', 20, 1, false),
        ('Kabir', 19, 2, false),
        ('Aarav', 19, 2, false),
        ('Zoya', 13, 4, true),
      ]);
      expect(p.tie!.names, ['You', 'Kabir']);
      expect([p.right, p.of], [15, 20]);
      expect(p.trap, isNull);
      expect(p.moments.length, 4);
    });

    test('podium before you finish an open game: PODIUM_NOT_YET', () async {
      expect(() => s.podium('game-riya-sprint'), throwsA(isA<ApiError>().having((e) => e.code, 'code', 'PODIUM_NOT_YET')));
    });

    test('nothing is answered before close (F1): review and fix refuse', () async {
      await playRiya([true, true, false, true, true]);
      expect(() => s.review('game-riya-sprint'), throwsA(isA<ApiError>().having((e) => e.code, 'code', 'REVIEW_NOT_YET')));
      expect(() => s.fixStart(game: 'game-riya-sprint', q: 1, stage: 'now'), throwsA(isA<ApiError>().having((e) => e.code, 'code', 'FIX_NOT_YET')));
    });

    test('the closed game has its trap as "most", and moments never touch it (F3)', () async {
      final p = await s.podium('game-zoya-closed');
      expect(p.soFar, isFalse);
      expect(p.trap!.q, 3);
      expect(p.trap!.number, 4);
      expect(p.trap!.caught, 'most');
      for (final m in p.moments) {
        expect(m.number, isNot(4));
        if (m.kind == MomentKind.threeInARow) expect(m.from! > 4 || m.to! < 4, isTrue);
      }
      final r = await s.review('game-zoya-closed');
      expect(r.trap!.number, 4);
      expect(r.questions.length, 5);
    });

    test('the quest counts past its goal (F8)', () async {
      final q = MobV3FakeServer(scenario: 'questdone');
      final v3 = MobRead.fromJson(Map<String, dynamic>.from(await q.den() as Map)).v3!;
      expect(v3.quest.answered, 70);
      expect(v3.quest.target, 60);
      expect(v3.quest.done, isTrue);
      expect(v3.moments.first, startsWith('quest_done:'));
    });

    test('Free starts: one a week, then START_USED', () async {
      final f = MobV3FakeServer(scenario: 'quiet', billing: 'free');
      final g = await f.openGame(mob: MobV3FakeServer.chaiId, format: GameFormat.sprint, mode: GameMode.async, count: 5);
      expect(g.count, 5);
      expect(() => f.openGame(mob: MobV3FakeServer.chaiId, format: GameFormat.sprint, mode: GameMode.async, count: 5), throwsA(isA<ApiError>().having((e) => e.code, 'code', 'START_USED')));
    });

    test('billing off: anyone starts', () async {
      final f = MobV3FakeServer(scenario: 'quiet');
      final v3 = MobRead.fromJson(Map<String, dynamic>.from(await f.den() as Map)).v3!;
      expect([v3.starts.billingOn, v3.starts.can, v3.starts.via], [false, true, StartVia.open]);
    });
  });
}
