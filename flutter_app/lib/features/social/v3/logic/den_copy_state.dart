// Which card the den shows (spec 5.3 D1 to D5). Pure: the server's `v3` object and the week paper's
// "you sat it" flag in, one [DenCard] out. No number is derived here; the card only picks which game
// the server listed to put forward (the open game closing soonest, as the spec says).
//
// Order of precedence:
//   D5 a Mob of one (you alone) -> D4 a live room you have not finished -> D2 an open game you have not
//   finished -> D3 an open game you finished -> D1 nothing open (or "Ask your Mob for a game" when the
//   server says you cannot start one).

import '../data/mob_v3_models.dart';

enum DenCardKind {
  /// D1: nothing is open, and you may start a game.
  quiet,

  /// D1 variant: nothing is open and your start is used ("Ask your Mob for a game").
  cantStart,

  /// D2: a game is open that you have not finished.
  open,

  /// D3: you played it, and it is still open.
  played,

  /// D4: a live room is open (lobby).
  live,

  /// D4: the live room already started; you can still play it as a 24-hour game.
  liveRunning,

  /// D5: a Mob of one.
  one,
}

class DenCard {
  const DenCard(this.kind, {this.game, this.moreOpen = 0, this.paperSat = false});

  final DenCardKind kind;

  /// The game the card puts forward (D2, D3, D4).
  final MobGameSummary? game;

  /// Other open games, for "2 more games are open" (opens the picker). Never a count of people.
  final int moreOpen;

  /// The week's Mob paper was sat: the link reads "See your answers".
  final bool paperSat;

  @override
  String toString() => 'DenCard(${kind.name}, game: ${game?.id}, more: $moreOpen)';
}

/// The card for this read of the den.
DenCard denCardFor(MobV3 v3, {bool paperSat = false}) {
  if (v3.members.length <= 1) return DenCard(DenCardKind.one, paperSat: paperSat);
  final open = v3.openGames;
  bool notDone(MobGameSummary g) => g.yourRun != YourRun.finished;

  for (final g in open) {
    final room = g.room;
    if (g.mode == GameMode.live && room != null && notDone(g) && (room.state == RoomState.lobby || room.state == RoomState.running)) {
      return DenCard(room.state == RoomState.running ? DenCardKind.liveRunning : DenCardKind.live, game: g, moreOpen: open.length - 1, paperSat: paperSat);
    }
  }
  for (final g in open) {
    if (notDone(g)) return DenCard(DenCardKind.open, game: g, moreOpen: open.length - 1, paperSat: paperSat);
  }
  if (open.isNotEmpty) return DenCard(DenCardKind.played, game: open.first, moreOpen: open.length - 1, paperSat: paperSat);
  return DenCard(v3.starts.can ? DenCardKind.quiet : DenCardKind.cantStart, paperSat: paperSat);
}
