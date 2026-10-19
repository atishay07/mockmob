// What the Mob's entry lines say on Today, Practice and Review, as pure functions of the server's
// view, so a plain test reads them. The words are the website's (src/components/mob/mobEntryModel.mjs):
// one calm line for a member, present and never in the face, nothing at all when there is nothing
// true to say. Nothing counts who has not sat (rule 22) and nothing sells.

import '../copy.dart';
import '../data/mob_models.dart';

enum MobEntryPlace { today, practice, review }

/// What a tap on an entry does.
enum MobEntryAct {
  /// Start this week's paper now (the same start as the Mob page's key).
  sit,

  /// Open the Mob page.
  openMob,

  /// Open the student's own answers for this week's paper.
  answers,

  /// Open the invite sheet on the Mob page.
  invite,
}

class MobEntry {
  const MobEntry({required this.title, required this.line, required this.act, this.key, this.ring = false, this.resultId});

  final String title;
  final String line;
  final MobEntryAct act;

  /// The label of the key beside the line, when the entry has one.
  final String? key;

  /// The entry carries the Mob's small ring (Today).
  final bool ring;

  /// The student's result when [act] is [MobEntryAct.answers].
  final String? resultId;
}

/// The week's paper can be sat now: not sat, open, not used up elsewhere, and affordable.
bool mobPaperOpen(Mob mob, {required bool closed}) {
  final week = mob.week;
  return !week.youSat && !closed && !week.paper.freeUsed && week.paper.affordable;
}

/// The line one member sees on [place], or null when there is nothing true to say.
MobEntry? mobEntryFor(MobEntryPlace place, Mob mob, {required DateTime now}) {
  final week = mob.week;
  final closed = week.closedAt(now);
  final name = mob.several ? 'Your ${mob.subjectName} Mob' : 'Your Mob';
  final open = mobPaperOpen(mob, closed: closed);
  final clock = MobCopy.paperClock(week.paper.count, week.paper.minutes);

  switch (place) {
    case MobEntryPlace.review:
      if (!week.youSat) return null;
      final trap = mob.visibleTrap;
      if (trap != null) {
        return MobEntry(
          title: MobCopy.entryTrapTitle(name, trap.questionNumber),
          line: MobCopy.entryTrapLine(trap),
          act: week.yourResultId == null ? MobEntryAct.openMob : MobEntryAct.answers,
          resultId: week.yourResultId,
        );
      }
      final teaser = mob.compare?.teaser?.text;
      if (teaser == null || teaser.isEmpty) return null;
      return MobEntry(title: '$name: ${MobCopy.ringLine(week.sat, week.size)}', line: teaser, act: MobEntryAct.openMob);
    case MobEntryPlace.practice:
      if (open) {
        final cost = MobCopy.costLine(week.paper);
        return MobEntry(
          title: MobCopy.entryPracticeTitle(mob.subjectName, clock),
          line: '${MobCopy.ringLine(week.sat, week.size)}.${cost == null ? '' : ' $cost'}',
          act: MobEntryAct.sit,
          key: MobCopy.sitIt,
        );
      }
      if (week.youSat && week.yourResultId != null) {
        return MobEntry(
          title: MobCopy.entryPracticeSatTitle(mob.subjectName),
          line: '${MobCopy.ringLine(week.sat, week.size)}.',
          act: MobEntryAct.answers,
          key: MobCopy.seeAnswers,
          resultId: week.yourResultId,
        );
      }
      return null;
    case MobEntryPlace.today:
      final received = week.youSat || closed ? null : mob.nudge.receivedFrom;
      final nudge = received == null ? null : MobCopy.nudgeReceived(received);
      // A Mob of one: the way to start the ring is a friend. While invites are paused the page says
      // so and offers no invite key.
      if (week.size == 1 && mob.canInvite) {
        return MobEntry(title: MobCopy.entryAloneTitle(name), line: MobCopy.entryAloneLine, act: MobEntryAct.invite, key: MobCopy.inviteRow(mob.seatsLeft), ring: true);
      }
      if (week.size == 1 && mob.invitesPaused) {
        return MobEntry(title: MobCopy.entryAloneTitle(name), line: MobCopy.invitesPaused, act: MobEntryAct.openMob, key: MobCopy.seeMob, ring: true);
      }
      if (open) {
        return MobEntry(
          title: '$name: ${MobCopy.ringLine(week.sat, week.size)}',
          line: nudge ?? MobCopy.entryOpenLine(mob.subjectName, clock),
          act: MobEntryAct.sit,
          key: MobCopy.sitKey(week.paper.count, week.paper.minutes),
          ring: true,
        );
      }
      return MobEntry(
        title: '$name: ${MobCopy.ringLine(week.sat, week.size)}',
        line: week.youSat ? MobCopy.entrySatLine : (closed ? MobCopy.closed : MobCopy.entryWatchLine),
        act: MobEntryAct.openMob,
        key: MobCopy.seeMob,
        ring: true,
      );
  }
}

/// Whether Today carries a Mob block at all (D105, 19 Oct): only while the student is in no Mob. A
/// member has the Mob tab one tap away, with the week's paper, the ring and the invite, so Today
/// does not repeat it; a student in no Mob may still see the one-time invitation below.
bool mobTodayBlockShows({required bool inMob}) => !inMob;

/// Today's one-time invitation for a student in no Mob, at the moment it is useful: a study week met,
/// or 7 saved sessions. The true reason in words, or null (nothing to say yet).
String? mobInviteMoment({required bool weekMet, required int sessions}) {
  if (weekMet) return MobCopy.inviteMomentWeek;
  if (sessions >= 7) return MobCopy.inviteMomentSessions(sessions);
  return null;
}

/// How long the invitation stays after it first showed: 7 days, then it is gone for good.
const Duration mobInviteLife = Duration(days: 7);
