// Which Now card the den shows (pass-1020 MOB-MINIMAL 3.1 item 3, the V4 nine-step ladder). Pure: the
// server's `v3` object and the week paper's "you sat it" flag in, one [DenCard] out. No number is derived
// here; the card only picks which game the server listed to put forward.
//
// The first step that applies wins:
//   1 a live room you are not in (live, liveRunning)
//   2 Fix it together is ready (fix)
//   3 the Wednesday check (check)
//   4 an open game you have not played (open)
//   5 the weekly paper is unplayed (paper)
//   6 you played and the game is still open (played)
//   7 nothing played yet (quiet; `fresh` when the Mob has not played at all this week)
//   8 your start is used (cantStart)
//   9 a Mob of one (one)
// A brand-new week with nothing played puts step 7 ahead of step 5: "Nobody has played yet" with Start a
// game, and the paper waits as a row under it (the approved empty den).
// A Mob of one is checked first: alone, the invite is the one thing (step 9 is the fallback in the
// ladder's order, but a Mob of one never reaches the others).

import '../data/mob_v3_models.dart';

enum DenCardKind {
  /// Step 7: nothing is open and you may start a game.
  quiet,

  /// Step 8: nothing is open and your start is used ("Ask your Mob for a game").
  cantStart,

  /// Step 4: a game is open that you have not finished.
  open,

  /// Step 6: you played it, and it is still open.
  played,

  /// Step 1: a live room is open (lobby).
  live,

  /// Step 1: the live room already started; you can still play it as a 24-hour game.
  liveRunning,

  /// Step 2: Fix it together is ready.
  fix,

  /// Step 3: the Wednesday check is open.
  check,

  /// Step 5: this week's Mob paper is unplayed.
  paper,

  /// Step 9: a Mob of one.
  one,
}

class DenCard {
  const DenCard(this.kind, {this.game, this.moreOpen = 0, this.paperSat = false, this.fresh = false, this.fix});

  final DenCardKind kind;

  /// The game the card puts forward (open, played, live, and your own game in a Mob of one).
  final MobGameSummary? game;

  /// Other open games (they show as "Also open" rows). Never a count of people.
  final int moreOpen;

  /// The week's Mob paper was sat.
  final bool paperSat;

  /// Step 7 in a week where nobody has played yet ("Nobody has played yet").
  final bool fresh;

  /// Steps 2 and 3.
  final DenFix? fix;

  /// The card's key is "Start a game", so the first den row becomes "Invite friends".
  bool get keyIsStart => kind == DenCardKind.quiet;

  @override
  String toString() => 'DenCard(${kind.name}, game: ${game?.id}, more: $moreOpen, fresh: $fresh)';
}

/// The ladder step (1 to 9) of [kind], for goldens and tests.
int ladderStep(DenCardKind kind) => switch (kind) {
      DenCardKind.live || DenCardKind.liveRunning => 1,
      DenCardKind.fix => 2,
      DenCardKind.check => 3,
      DenCardKind.open => 4,
      DenCardKind.paper => 5,
      DenCardKind.played => 6,
      DenCardKind.quiet => 7,
      DenCardKind.cantStart => 8,
      DenCardKind.one => 9,
    };

/// The card for this read of the den.
DenCard denCardFor(MobV3 v3, {bool paperSat = false}) {
  final open = v3.openGames;
  bool notDone(MobGameSummary g) => g.yourRun != YourRun.finished;
  if (v3.members.length <= 1) {
    // A Mob of one still shows your own game (H2, 19 Oct night walk): the one you have not finished
    // first, else the one you played, so its podium stays a tap away from the den.
    MobGameSummary? yours;
    for (final g in open) {
      if (notDone(g)) {
        yours = g;
        break;
      }
    }
    yours ??= open.isEmpty ? null : open.first;
    return DenCard(DenCardKind.one, game: yours, paperSat: paperSat);
  }

  // 1 a live room you are not in. Live rooms show only while the server says live is on.
  for (final g in open) {
    final room = g.room;
    if (v3.live.enabled && g.mode == GameMode.live && room != null && notDone(g) && (room.state == RoomState.lobby || room.state == RoomState.running)) {
      return DenCard(room.state == RoomState.running ? DenCardKind.liveRunning : DenCardKind.live, game: g, moreOpen: open.length - 1, paperSat: paperSat);
    }
  }
  // 2 and 3: Fix it together, then the Wednesday check.
  final fix = v3.fix;
  if (fix != null) {
    return DenCard(fix.state == DenFixState.check ? DenFixKind.check : DenFixKind.ready, fix: fix, moreOpen: open.length, paperSat: paperSat);
  }
  // 4 an open game you have not played.
  for (final g in open) {
    if (notDone(g)) return DenCard(DenCardKind.open, game: g, moreOpen: open.length - 1, paperSat: paperSat);
  }
  // 7 before 5 in a week where nothing was played yet: Start a game leads, the paper waits as a row.
  final fresh = open.isEmpty && v3.quest.answered == 0 && !paperSat;
  if (fresh && v3.starts.can) return DenCard(DenCardKind.quiet, paperSat: paperSat, fresh: true);
  // 5 the weekly paper.
  if (!paperSat) return DenCard(DenCardKind.paper, moreOpen: open.length, paperSat: paperSat);
  // 6 you played and it is still open.
  if (open.isNotEmpty) return DenCard(DenCardKind.played, game: open.first, moreOpen: open.length - 1, paperSat: paperSat);
  // 7 or 8.
  return DenCard(v3.starts.can ? DenCardKind.quiet : DenCardKind.cantStart, paperSat: paperSat);
}

/// Internal shorthand so the ladder reads in the spec's words.
abstract final class DenFixKind {
  static const DenCardKind ready = DenCardKind.fix;
  static const DenCardKind check = DenCardKind.check;
}
