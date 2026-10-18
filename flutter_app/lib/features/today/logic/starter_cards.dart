// The suggested deck's starter cards (19 Oct, G12, rule R1: fresh account first). A fresh account
// with its subjects picked used to get one card (a full mock), because every other kind of card
// needs a paper first. These cards need only the subjects the student picked, so the deck always
// has real moves to offer, in this order:
//   1. a quick 10 in the subject the student rated weakest (the next one when the lead card is
//      already that subject's check);
//   2. a full mock in their first domain subject;
//   3. a quick 10 in English, the language paper;
//   4. the Mob ("Sit the same paper as your friends"), while the student is in none;
//   5. another subject, when there is room.
// When those leave the deck short of [deckMinimum] (one or two subjects, the Mob off), the first
// chapter of the lead's subject, a way to add the missing subjects and the next chapter fill it.
// Pure: the deck and the tests read the same function.
import '../../../core/models/attempt.dart';
import '../../../core/router/routes.dart';
import '../../../core/widgets/art/mm_art.dart';
import '../../onboarding/data/chapter_order.dart' show rankedChapters;
import '../../onboarding/data/subjects.dart' show SheetSubject;
import '../../social/mob_routes.dart' show MobPaths;
import '../copy.dart';
import '../copy_glance.dart';
import '../copy_suggested.dart';
import 'glance_builder.dart' show choiceKeyOf, presentMove;
import 'move_builder.dart';
import 'subjects.dart';
import 'today_inputs.dart';
import 'today_model.dart';

/// The most cards a deck built without a paper holds: the four kinds, and another subject when
/// there is room.
const int starterDeckSize = 5;

/// A deck is never shorter than this while the student has subjects (R1: "at least 3 or 4 cards
/// before showing nothing else").
const int deckMinimum = 4;

/// A record that makes fewer cards of its own than this (one paper, two) is topped up to
/// [deckMinimum]; one that makes this many keeps the deck it has.
const int recordDeckFloor = 3;

/// The language paper's subject id.
const String languageSubject = 'english';

/// The student's subjects for the deck: the account's own list, weakest first where the setup
/// rated them, then the rest in the account's order. Before the account's list has synced, the
/// setup sheet's subjects stand in.
List<String> deckSubjects(TodayInputs i) {
  List<String> distinct(Iterable<String> ids) {
    final out = <String>[];
    for (final id in ids) {
      final c = canonicalSubject(id.trim());
      if (c.isNotEmpty && !out.contains(c)) out.add(c);
    }
    return out;
  }

  final account = distinct(i.subjects);
  final ranked = distinct(i.profile?.subjects ?? const []);
  if (account.isEmpty) return ranked;
  return [...ranked.where(account.contains), ...account.where((s) => !ranked.contains(s))];
}

/// A domain subject (DU's List B): neither the language nor the General Test.
bool isDomainSubject(String id) => SheetSubject.byId(id)?.isListB ?? (id != languageSubject && id != 'general_test');

/// The starter cards for [lead]'s deck, at most [limit], leaving out any kind already in
/// [existing] (a light record's own cards come first and these only top it up).
List<MoveChoice> starterChoices(TodayInputs i, MoveHero lead, {List<MoveChoice> existing = const [], int limit = starterDeckSize}) {
  if (limit <= 0) return const [];
  final subjects = deckSubjects(i);
  final leadSubject = lead.subjectId == null ? null : canonicalSubject(lead.subjectId!);
  final leadIsMock = lead.kind == MoveKind.mock || lead.kind == MoveKind.firstMock;
  // Subjects a practice card already covers: the lead's own, and any card already in the deck.
  final covered = <String>{
    if (leadSubject != null && !leadIsMock) leadSubject,
    for (final c in existing)
      if (c.hero?.subjectId != null && c.key != 'mock') canonicalSubject(c.hero!.subjectId!),
  };
  final out = <MoveChoice>[];
  final taken = {for (final c in existing) c.key, choiceKeyOf(lead)};
  void add(String key, MoveChoice? Function() build) {
    if (out.length >= limit || taken.contains(key)) return;
    final c = build();
    if (c == null) return;
    out.add(c);
    taken.add(key);
    final s = c.hero?.subjectId;
    if (s != null && key != 'mock') covered.add(canonicalSubject(s));
  }

  MoveChoice practice(String key, {required String subject, String? chapter, required String title, required String Function(int) meaning}) {
    final m = starterPracticeFor(i, subject: subject, chapter: chapter, meaning: meaning, title: title);
    // presentMove sets the overline and the 1018 title; the starter keeps its own title and key.
    final hero = presentMove(m, i).copyWith(title: title, choiceKey: key);
    return MoveChoice(key: key, title: title, line: hero.meaning, hero: hero);
  }

  final all = i.attempts ?? const <Attempt>[];
  final weakestRated = i.profile?.weakestRated == null ? null : canonicalSubject(i.profile!.weakestRated!);

  // 1. The weakest subject the lead card does not already practise.
  add('quick', () {
    final s = subjects.where((s) => !covered.contains(s)).firstOrNull;
    if (s == null) return null;
    final name = subjectName(s);
    final rated = s == weakestRated;
    return practice(
      'quick',
      subject: s,
      title: rated ? StarterCopy.titleWeakest : TodayCopy.altPractiseTitle(name),
      meaning: (n) => rated ? StarterCopy.weakestWhy(name, n) : StarterCopy.quickWhy(name, n),
    );
  });

  // 2. A full mock in the first domain subject (the lead's subject when none is known), unless a
  // mock was sat in the last 14 days (the record's own rule).
  add('mock', () {
    if (leadIsMock) return null;
    if (all.any((a) => a.isMock && i.daysSince(a.completedAt) < 14)) return null;
    // "First" in the order the student picked them (the account's list), not the weakest first.
    final picked = [for (final s in i.subjects) canonicalSubject(s)];
    final s = picked.where(isDomainSubject).firstOrNull ?? subjects.where(isDomainSubject).firstOrNull ?? leadSubject ?? subjects.firstOrNull;
    if (s == null) return null;
    final m = presentMove(mockMoveFor(i, subject: s), i);
    return MoveChoice(key: 'mock', title: GlanceCopy.choiceMock, line: GlanceCopy.choiceMockLine, hero: m);
  });

  // 3. The language paper, when it is one of the student's subjects and not covered yet.
  add('language', () {
    if (!subjects.contains(languageSubject) || covered.contains(languageSubject)) return null;
    final name = subjectName(languageSubject);
    return practice('language', subject: languageSubject, title: TodayCopy.altPractiseTitle(name), meaning: (n) => StarterCopy.languageWhy(name, n));
  });

  // 4. The Mob, while the Mob is on and the student is in none.
  add('mob', () {
    if (!i.mobInvite) return null;
    return const MoveChoice(
      key: 'mob',
      title: StarterCopy.titleMob,
      line: StarterCopy.mobLine,
      action: TodayAction(StarterCopy.mobKey, GoTo(MobPaths.mob)),
    );
  });

  // 5. Another subject, when there is room.
  add('other', () {
    final s = otherSubjectFor(i, skip: covered);
    if (s == null) return null;
    return MoveChoice(key: 'other', title: GlanceCopy.titleOtherSubject, line: GlanceCopy.choiceOtherLine(subjectName(s)), hero: presentMove(otherSubjectMoveFor(i, subject: s), i));
  });

  // Short of the minimum: the lead subject's first chapters and a way to add subjects.
  final floor = existing.length + out.length;
  if (floor < deckMinimum) {
    final room = deckMinimum - floor;
    final chapterSubject = leadSubject ?? subjects.firstOrNull;
    final chapters = chapterSubject == null ? null : rankedChapters(chapterSubject);
    final before = out.length;
    bool full() => out.length - before >= room;
    if (chapters != null && chapters.isNotEmpty && !full()) {
      final name = subjectName(chapterSubject!);
      add('chapter', () => practice('chapter', subject: chapterSubject, chapter: chapters.first, title: StarterCopy.titleChapter, meaning: (n) => StarterCopy.chapterWhy(chapters.first, name, n)));
    }
    if (!full() && subjects.length < 4) {
      add('subjects', () => MoveChoice(
            key: 'subjects',
            title: subjects.isEmpty ? StarterCopy.titleSubjectsNone : StarterCopy.titleSubjects,
            line: StarterCopy.subjectsLine,
            action: const TodayAction(StarterCopy.subjectsKey, GoTo(AppRoutes.youSubjects)),
          ));
    }
    if (chapters != null && chapters.length > 1 && !full()) {
      add('chapter2', () => practice('chapter2', subject: chapterSubject!, chapter: chapters[1], title: StarterCopy.titleNextChapter, meaning: (n) => StarterCopy.nextChapterWhy(chapters[1], n)));
    }
  }
  return out;
}

/// Mobi's pose on a card that opens something rather than holding a move.
MmArt starterPoseFor(String key) => switch (key) {
      'mob' => MmArt.mobiGreet,
      _ => MmArt.mobiPoint,
    };
