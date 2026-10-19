// Every Mob v3 sentence (MOB-BUILD-SPEC-V3 section 5.3), in the owner's voice: plain, warm and
// grammatical, no exclamation marks, no arrows, no emoji, the 12-hour clock in IST, no price, nobody's
// plan, and never "lost", "behind", "last", "waiting on you", "hurry" or "streak at risk" (spec 5.0).
// The lint test (test/unit/social/v3/mob_v3_copy_lint_test.dart) holds C-1 to C-4 over this file.
//
// Screens read their words from here, never inline, so a copy pass touches one file.

import '../../../core/api/api.dart';
import '../copy.dart';
import '../data/mob_repository.dart' show MobFailure, mobFailureFor;
import 'data/mob_v3_models.dart';

// ---------------------------------------------------------------------------------------------------
// Time, always IST, 12-hour
// ---------------------------------------------------------------------------------------------------

const List<String> _weekdaysLong = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const List<String> _monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const List<String> _monthsLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

DateTime _ist(DateTime at) => at.toUtc().add(const Duration(hours: 5, minutes: 30));

abstract final class MobTime {
  /// "2:05 PM".
  static String clock(DateTime at) {
    final t = _ist(at);
    final h = t.hour % 12 == 0 ? 12 : t.hour % 12;
    return '$h:${t.minute.toString().padLeft(2, '0')} ${t.hour < 12 ? 'AM' : 'PM'}';
  }

  /// "Wednesday 28 Oct".
  static String day(DateTime at) {
    final t = _ist(at);
    return '${_weekdaysLong[t.weekday - 1]} ${t.day} ${_monthsShort[t.month - 1]}';
  }

  /// "October" from a month number, 1 to 12.
  static String monthName(int month) => _monthsLong[(month - 1).clamp(0, 11)];

  /// "Monday" for the IST day of [at].
  static String weekdayOf(DateTime at) => _weekdaysLong[_ist(at).weekday - 1];

  /// "Wednesday" from an IST day key `YYYY-MM-DD`.
  static String weekdayOfKey(String key) {
    final d = DateTime.tryParse(key);
    if (d == null) return 'That day';
    return _weekdaysLong[d.weekday - 1];
  }

  /// "2:05 PM tomorrow", "8:44 PM" (today), "2:05 PM yesterday", else "2:05 PM on Saturday 24 Oct".
  static String when(DateTime at, DateTime now) {
    final a = _ist(at);
    final n = _ist(now);
    final da = DateTime.utc(a.year, a.month, a.day);
    final dn = DateTime.utc(n.year, n.month, n.day);
    final diff = da.difference(dn).inDays;
    final c = clock(at);
    return switch (diff) { 0 => c, 1 => '$c tomorrow', -1 => '$c yesterday', _ => '$c on ${day(at)}' };
  }

  /// "m:ss" for the stopwatch chip.
  static String stopwatch(Duration d) {
    final s = d.inSeconds.clamp(0, 99 * 60 + 59);
    return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
  }
}

// ---------------------------------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------------------------------

abstract final class MobV3Copy {
  // ---- Den (D0 to D6) ----
  static const String title = 'Your Mob';
  static const String d0Lead = 'Sit papers and play quick games with up to 4 friends. Your friends see your marks in games, never your answers.';
  static const String startMob = 'Start a Mob';
  static const String joinWithCode = 'Join with a code';
  static const String noSubjects = 'Choose your CUET subjects first. A Mob plays in one of them.';
  static const String chooseSubjects = 'Choose your subjects';
  static const String openSeat = 'Open seat';

  // Den words added by the DEN builder (labels the spec leaves to the build).
  static const String you = 'You';
  static const String openSeatInvite = 'Open seat. Invite a friend to take it.';
  static String pennantWord(int w) => w <= 0 ? 'Mob' : (w == 1 ? 'week' : 'weeks');
  static const String pennantNew = 'New';
  static String pennantSemantics(int w) => w <= 0 ? "A new Mob, no weeks yet. Opens your Mob's chain." : "${pennantWeeks(w)} in a row. Opens your Mob's chain.";
  static String chainChipSemantics(int days) => 'Your chain, ${chainChip(days)} in a row. Opens your chain.';
  static const String settingsSemantics = 'Mob settings';
  static const String switchMob = 'Switch to another Mob';
  static const String switcherTitle = 'Your Mobs';
  static String shelfSemantics(String mob, List<String> items, String? next, int? nextAt) {
    final have = items.isEmpty ? 'Nothing on it yet.' : '${_join(items)}.';
    final coming = next == null || nextAt == null ? '' : ' Next: ${next.toLowerCase()} at $nextAt weeks.';
    return "$mob's shelf. $have$coming Opens your shelf.";
  }

  static String stickerSemantics(StickerKind k) => 'Send the sticker ${sticker(k)}';

  static String denSubtitle(String subject, int size) => size <= 1 ? '$subject, just you' : '$subject, $size of you';
  static String chainChip(int days) => days == 1 ? '1 day' : '$days days';
  static String pennantWeeks(int w) => w == 1 ? '1 week' : '$w weeks';

  static const String quietTitle = 'Nothing is open right now';
  static const String quietLine = "Start a 5-question sprint for your Mob, or sit this week's Mob paper.";
  static const String startAGame = 'Start a game';
  static const String sitPaper = "Sit this week's paper";
  static const String seeAnswers = 'See your answers';
  static const String askTitle = 'Ask your Mob for a game';
  static const String askKey = 'Send "Again?"';
  static const String askLine = 'Anyone with a start left can open one.';

  static String gameKind(GameFormat f) => switch (f) { GameFormat.sprint => 'sprint', GameFormat.round => 'round', GameFormat.rematch => 'rematch' };

  /// "Riya's sprint", "Your round".
  static String gameTitle(MobGameSummary g) {
    final h = g.host;
    if (h == null || h.you) return 'Your ${gameKind(g.format)}';
    return "${h.name}'s ${gameKind(g.format)}";
  }

  /// "Riya opened a sprint".
  static String openedA(MobGameSummary g) {
    final h = g.host;
    final who = h == null || h.you ? 'You' : h.name;
    final article = g.format == GameFormat.rematch ? 'a rematch' : 'a ${gameKind(g.format)}';
    return '$who opened $article';
  }

  /// "5 Goodwill questions. Open until 2:05 PM tomorrow." With no runs yet: "Be the first to set a run."
  /// With runs, the runs row under it says who to race, so the line does not say it twice (H5: the
  /// card is one line shorter and its key stays in view at 360 dp).
  static String openLine(MobGameSummary g, DateTime now) {
    final what = g.chapter == null || g.chapter!.isEmpty ? '${g.count} ${g.subjectName} questions' : '${g.count} ${g.chapter} questions';
    final race = g.runs.isEmpty ? ' Be the first to set a run.' : '';
    final until = g.closesAt == null ? '' : ' Open until ${MobTime.when(g.closesAt!, now)}.';
    return '$what.$race$until';
  }

  /// "Runs so far: Riya, 2:10 PM. Kabir, 4:55 PM." Finished runs only (F2). Null with none.
  static String? runsSoFar(List<FinishedRun> runs, DateTime now) {
    if (runs.isEmpty) return null;
    final parts = [for (final r in runs) r.at == null ? '${r.name}.' : '${r.name}, ${MobTime.when(r.at!, now)}.'];
    return 'Runs so far: ${parts.join(' ')}';
  }

  static String playKey(MobGameSummary g) {
    final h = g.host;
    if (h == null || h.you) return 'Play your ${gameKind(g.format)}';
    return "Play ${h.name}'s ${gameKind(g.format)}";
  }

  static const String moreWays = 'More ways to play';
  static String moreOpen(int n) => n == 1 ? '1 more game is open' : '$n more games are open';

  static String playedAt(DateTime at, DateTime closes, DateTime now) => 'You played at ${MobTime.when(at, now)}. Places can change until ${MobTime.when(closes, now)}.';
  static const String seePodiumSoFar = 'See the podium so far';
  static const String seePodium = 'See the podium';

  static String liveOpened(MobGameSummary g) => '${g.host?.name ?? 'A friend'} opened a live room';
  static String liveLine(MobGameSummary g) => 'A sprint with ${g.count} new ${g.chapter ?? g.subjectName} questions.';
  static String joinRoom(MobGameSummary g) => "Join ${g.host?.name ?? 'the'}'s room";
  static String playLater(DateTime closes, DateTime now) => 'Play it later, until ${MobTime.when(closes, now)}';
  static String roomStarted(DateTime started, DateTime closes, DateTime now) =>
      'The room started at ${MobTime.clock(started)}. You can still play it until ${MobTime.when(closes, now)}.';
  static const String playItNow = 'Play it now';

  // Mob of one (D5)
  static const String oneTitle = 'Save a seat for a friend';
  static const String oneLine = 'A Mob is 2 to 5 friends. Send the card; they tap it and take a seat.';
  static String seatsOpen(int n) => n == 1 ? '1 open seat' : '$n open seats';
  static String inviteCardTitle(String you, String mob) => '$you saved you a seat in $mob';
  /// The code never splits across lines ("K7P" and "2M9" apart, M11): its space is a no-break space.
  static String inviteCardLineFor(String subject, String code) => '${_aAn(subject)} $subject Mob on MockMob. Code ${code.replaceAll(' ', '\u00A0')}.';
  static const String inviteWhatsApp = 'Invite on WhatsApp';
  static const String copyCode = 'Copy the code';
  static const String codeCopied = 'The code is copied.';
  static const String inviteWorks = 'Works for 7 days, for up to 4 friends.';
  static const String onePaper = "This week's Mob paper. 10 questions, 10 minutes. Sit it now; friends who join can too.";
  static const String sitIt = 'Sit it';
  static const String startSprint = 'Start a sprint';

  /// D5 with your own game open (H2): "You played at 8:44 PM. It stays open until 2:05 PM tomorrow, so
  /// friends who join can race your run."
  static String onePlayedLine(DateTime at, DateTime? closes, DateTime now) => closes == null
      ? 'You played at ${MobTime.when(at, now)}.'
      : 'You played at ${MobTime.when(at, now)}. It stays open until ${MobTime.when(closes, now)}, so friends who join can race your run.';
  static String oneOpenLine(MobGameSummary g, DateTime now) {
    final what = g.chapter == null || g.chapter!.isEmpty ? '${g.count} ${g.subjectName} questions' : '${g.count} ${g.chapter} questions';
    final until = g.closesAt == null ? '' : ' Open until ${MobTime.when(g.closesAt!, now)}.';
    return '$what. Set the first run; friends who join race it.$until';
  }

  /// The WhatsApp message beside the card image.
  static String inviteShare(String you, String mob, String subject, String display, String url) =>
      '$you saved you a seat in $mob, ${_aAn(subject).toLowerCase()} $subject Mob on MockMob. Tap to join: $url (code $display)';

  // D6
  static const String loading = 'Loading your Mob';
  static const String failed = "Your Mob didn't load.";
  static const String tryAgain = 'Try again';

  // Quest strip
  static const String questTitle = "This week's quest";
  static String questCount(Quest q) => q.past ? '${q.answered} answered. The quest needed ${q.target}.' : '${q.answered} of ${q.target} questions';

  // ---- D0a Start a Mob ----
  static const String pickName = "Pick your Mob's name";
  static const String showSixMore = 'Show six more';
  static const String namesKind = 'Names come from our list, so every Mob name is kind.';
  static const String subjectYouPlay = 'Subject you will play';
  static const String pickFold = 'Pick your Fold';
  static String youPlayAs(String fold) => 'You play as $fold';
  static const String change = 'Change';
  static const String nameLabel = 'Your name in the Mob';
  static const String nameHint = 'First name';
  static const String nameNote = 'Only your Mob sees it. 2 to 18 letters.';
  static const String colourLabel = 'Colour';
  static const String marksNote = 'Your Mob sees your marks in games. One switch in Mob settings keeps them private.';
  static String startKey(String mobName) => 'Start $mobName';
  static const String startNext = 'Next, you can invite up to 4 friends.';
  static const String startSheetTitle = 'Start a Mob';
  static const String showFirstSix = 'Back to the first six';
  static const String youTag = 'You';
  static const String denPreviewLabel = 'Your den, with four seats waiting for friends.';
  static const String changeFoldTitle = 'Change your Fold';
  static const String foldPickerLabel = 'Fold';
  static String foldCard(String name, String line) => '$name. $line';
  static String creaseLabel(int folds) => switch (folds) { 1 => 'A starter Fold', 2 => 'Earned by you', _ => 'Earned with your Mob' };

  // ---- J1 Join ----
  static const String joinTitle = 'Join a Mob';
  static const String joinLine = 'Type the 6-character code your friend sent.';
  static String joinPreviewName(JoinPreview p) => '${p.name}, ${p.subjectName}';
  static String seatsTaken(int taken) => '$taken of 5 seats taken';
  static const String pickWho = "Pick who you'll be";
  static const String joinPrivacy = 'MockMob never asks for your contacts. Only your Mob sees your name. You can leave any time.';
  static String joinKey(String mobName) => 'Join $mobName';
  static const String joinCodeLabel = 'Mob code';
  static String joinCodeSemantics(String shown) => shown.isEmpty ? 'Mob code, empty' : 'Mob code, $shown';
  static const String joinChecking = 'Checking the code';
  static const String joinPaused = 'New members cannot join by code just now. Try this code again later.';
  // J1 is the code screen: the server's invite sentences speak of a link, so the screen says code.
  static const String joinCodeInvalid = 'That code does not look right. Check it with your friend.';
  static const String joinCodeExpired = 'That code has expired. Ask your friend for a new one.';
  static const String joinStartOwn = 'Start your own Mob';
  static const String joinYourName = 'Your name in this Mob';
  static String joinPreviewLabel(String mob, String subject, int taken) => '$mob, $subject, ${seatsTaken(taken)}';

  // ---- P1 Play picker ----
  static const String pickerTitle = 'Play with your Mob';
  static const String openNow = 'Open now';
  static String openRow(MobGameSummary g, DateTime now) => '${g.count} questions. Open until ${g.closesAt == null ? 'tomorrow' : MobTime.when(g.closesAt!, now)}.';
  static const String play = 'Play';
  static const String weeklyPaper = "This week's Mob paper";
  static String satOn(String weekday) => 'You sat it on $weekday.';
  static const String answers = 'Answers';
  static const String paperClock = '10 questions, 10 minutes.';
  static String startsLeft(String mob, int n) => n == 1 ? 'You have 1 start in $mob this week.' : 'You have $n starts in $mob this week.';
  static const String startUsed = 'Your start this week is used. It comes back on Monday.';
  static const String anyoneWithPro = 'Anyone in your Mob with Pro can start one, then everyone plays it free.';
  static String micPassed(String from) => '$from passed you the mic. You can start one game, live or anytime.';
  static const String anyoneCanStart = 'Anyone in your Mob can start a game.';
  static const String askForGame = 'Ask your Mob for a game';
  static const String whatProAdds = 'What Pro adds';
  static const String sprint = 'Sprint';
  static const String sprintSub = '5 questions';
  static const String ownRound = 'Your own round';
  static const String ownRoundSub = '10 to 20 questions';
  static const String ownRoundSubStart = '10, 15 or 20 questions';
  static const String live = 'Live';
  static const String fullMock = 'Full mock';
  static const String proTag = 'Pro';

  // ---- P2 Start a game ----
  static const String whatItCovers = 'What it covers';
  static String coversTrap(String chapter) => '$chapter, the chapter of your Mob\'s last trap';
  static String coversWhole(String subject) => 'The whole of $subject';
  static const String howMobPlays = 'How your Mob plays it';
  static const String liveNow = 'Live now';
  static const String anytime24 = 'Anytime in 24 hours';
  static const String liveLineStart = 'Live starts everyone on one 3, 2, 1. Anyone who misses it gets the same questions for 24 hours.';
  static const String asyncLineStart = 'Everyone gets the same questions for 24 hours and races the runs before them.';
  static const String liveHours = 'Live rooms open from 6:00 AM to 11:00 PM.';
  static String passMicRow(int left) => 'Let a friend start one game. $left left this week.';
  static const String passMic = 'Pass the mic';
  static const String openRoom = 'Open the room';
  static const String startTheSprint = 'Start the sprint';
  static const String startTheRound = 'Start the round';
  static String startUnder(String mob) => 'Everyone in $mob plays it free. Marks count the same for all.';
  static String lengthLabel(int n) => '$n questions';

  // ---- P3 Pass the mic ----
  static String micLine(String mob) => 'Let a friend start one game in $mob this week.';
  static String micKey(String name) => 'Pass the mic to $name';
  static const String micNote = 'You can pass it 2 times a week.';
  static String micToast(String name) => '$name can start one game this week.';

  // ---- P4 Free and Pro ----
  static const String proLead = 'Pro never changes marks, chains or what you can earn. It adds hosting.';
  static const String freeAlways = 'Free, always';
  static const List<String> freeList = [
    'Play every game your Mob starts, as often as you like.',
    'The weekly Mob paper, in every Mob you are in.',
    'One start a week in each Mob.',
    'Your chain, rest passes and make-up days.',
    'The podium, your marks and Fix it together.',
    'Every Fold and sticker you earn.',
  ];
  static const String proAdds = 'Pro adds';
  static const List<String> proList = [
    'Start as many games as you like, live or anytime.',
    'Open live rooms.',
    'Pass the mic to a friend, twice a week.',
    'Start up to 3 Mobs.',
  ];
  static const String notForSale = 'Nothing you earn in the Mob is for sale.';
  static const String seePlans = 'See Pro plans';

  // ---- R1 to R6 The run ----
  static String runsToRace(int n) => n == 0 ? 'Set the first run' : (n == 1 ? '1 run to race' : '$n runs to race');
  static String liveInRoom(int n) => 'Live, $n of you in the room';
  static const String rulerCaption = 'Where everyone is. Never what they picked.';
  static String questionOf(int i, int n) => 'Question $i of $n';
  static const String marksRule = '+5 if right, -1 if wrong';
  static const String skip = 'Skip';
  static String lockIn(String letter) => 'Lock in $letter';
  static const String pickAnAnswer = 'Pick an answer';
  static const String saving = 'Saving your answer';
  static const String right = 'Right.';
  static const String rightThree = 'Right. Three in a row.';
  static const String rightLine = '+5 marks. Your Mob only sees that you moved on.';
  static const String notThisOne = 'Not this one.';
  static String wrongLine(DateTime closes, DateTime now) => '-1 mark. The right answer and why open for everyone when the game closes at ${MobTime.when(closes, now)}.';
  static const String skippedLine = 'Skipped. No marks either way.';
  static const String nextQuestion = 'Next question';
  static const String seeHowYouDid = 'See how you did';
  static String pace(int delta, String name) => delta.abs() < 1 ? 'Level with $name' : (delta > 0 ? '$delta s ahead of $name' : '${-delta} s behind $name');
  static String friendFinished(String name) => '$name finished. Take your time.';
  static String ghostFinished(String name) => "$name's run reached the flag. Take your time.";
  static String playedAll(int n) => 'You played all $n.';
  static String marks(int m) => m == 1 || m == -1 ? '$m mark' : '$m marks';
  static String stillPlaying(List<String> names) => '${_join(names)} ${names.length == 1 ? 'is' : 'are'} still playing. The podium opens when the room ends.';
  static const String finishNow = 'Finish now';
  static const String leaveRun = 'Leave this run?';
  static const String leaveRunLine = 'Your answers so far are saved. You can come back until your time runs out.';
  static const String keepPlaying = 'Keep playing';
  static const String leave = 'Leave';
  static const String countdownNext = 'Question 1 of 5 is next. +5 if right, -1 if wrong, 0 if you skip.';
  static String countdownNextN(int n) => 'Question 1 of $n is next. +5 if right, -1 if wrong, 0 if you skip.';
  static const String go = 'Go';
  // Added by the RUN builder (screen reader labels, the stamp, the figure's word).
  static const String threeInARow = '3 in a row';
  static String delta(int d) => d > 0 ? '+$d' : '$d';
  static String marksWord(int m) => m == 1 || m == -1 ? 'mark' : 'marks';
  static const String runLoading = 'Getting the questions ready';
  static const String closeRun = 'Leave this run';
  static const String back = 'Back';
  static String runClock(String mmss) => 'Time on this run, $mmss';
  static String optionLabel(String letter, String text) => 'Option $letter, $text';
  static const String optionPicked = 'your pick';
  static const String optionLocked = 'locked in';
  static const String optionRight = 'right, plus 5';
  static const String optionWrong = 'not this one, minus 1';
  static const String rulerLabel = 'Where everyone is on the ruler';
  static String rulerAt(String name, int q, int n) => '$name is on question $q of $n';
  static String rulerDone(String name) => '$name reached the flag';

  // ---- R7 Podium ----
  static const String soFar = 'So far';
  static const String finalLabel = 'Final';
  static String onTopSoFar(String name) => name == 'You' ? "You're on top so far" : '$name is on top so far';
  static String cameFirst(String name) => name == 'You' ? 'You came first' : '$name came first';
  static String sharedTop(List<String> names, bool soFar) => soFar ? '${_join(names)} share the top so far' : '${_join(names)} came first together';
  static String placesCanChange(DateTime closes, DateTime now) => 'Places can change until ${MobTime.when(closes, now)}.';
  static String tieLine(PodiumTie t) {
    final names = _join(t.names);
    return '$names tie on ${t.marks}, so ${t.names.contains('You') ? 'you' : 'they'} share ${ordinal(t.place)}.';
  }

  static String together(int right, int of) => 'Your Mob got $right of $of right together.';
  static String marksLine(int m) => marks(m);
  static const String private = 'Private';
  static const String everyonesMoment = "See everyone's moment";
  static const String askRematch = 'Ask for a rematch';
  static const String everyonesMarks = "Everyone's marks";
  static const String onlyYou = "You're the first to finish. Places fill in as friends play.";
  static const String skipShow = 'Skip';
  // The only-you sentence split for the headline and the line under it (same words as [onlyYou]).
  static const String onlyYouTitle = "You're the first to finish.";
  static const String onlyYouLine = 'Places fill in as friends play.';
  static const String rematchAsked = 'You asked your Mob for a rematch.';
  static String placeOf(int place) => switch (place) { 1 => 'First place', 2 => 'Second place', 3 => 'Third place', _ => 'Place $place' };
  static String podiumSemantics(String name, int? place, int? marks) =>
      '$name, ${place == null ? '' : '${placeOf(place).toLowerCase()}, '}${marks == null ? private.toLowerCase() : MobV3Copy.marks(marks)}';
  static String headName(String name, bool you) => you ? 'You' : name;

  // ---- R8 Everyone's moment ----
  static const String momentsTitle = "Everyone's moment";
  static String moment(PlayerMoment m, int count) => switch (m.kind) {
        MomentKind.allRight => 'All ${m.count ?? count} right.',
        MomentKind.fastestRight => 'Fastest right answer: question ${m.number ?? 1} in ${m.seconds ?? 0} seconds.',
        MomentKind.quickestFinish => 'Quickest finish: all ${m.count ?? count} in ${MobTime.stopwatch(Duration(seconds: m.seconds ?? 0))}.',
        MomentKind.threeInARow => 'Three right in a row: questions ${m.from ?? 1} to ${m.to ?? 3}.',
        MomentKind.noMinus => 'No minus marks.',
        MomentKind.finishedAll => 'Played all ${m.count ?? count}.',
      };
  static const String trapCardTitle = 'The question that caught most of you';
  static String trapCaught(int q) => 'Question $q caught most of you.';
  static const String stepNow = '1. Now: See why, then one fresh question.';
  static String stepCheck(DateTime opens) => '2. ${MobTime.day(opens)}: One more checks the fix holds.';
  static String trapProgress(String mob, int n, int of) => '$mob has fixed $n of $of traps. Crane comes at $of.';
  static String answersOpenAt(DateTime closes, DateTime now) => 'The answers open when the game closes at ${MobTime.when(closes, now)}. Fix it together starts then.';
  static const String sendSticker = 'Send your Mob a sticker';
  static String fixTogether(int q) => 'Fix question $q together';
  static const String backToDen = 'Back to the den';
  static String momentRow(String name, String sentence) => '$name: $sentence';

  // ---- R9 Fix it together ----
  static String fixSub(String mob) => '$mob, one trap';
  static String question(int q) => 'Question $q';
  static const String whyLooked = 'Why it looked right';
  static const String pathNow = 'Now. One fresh question like it, only for you.';
  static String pathCheck(DateTime opens) => '${MobTime.day(opens)}. One more, to check the fix holds.';
  static const String fixShelf = 'When 2 of you pass on Wednesday, the trap counts as fixed. 3 fixed traps bring Crane to every shelf.';
  static String ofThree(int n, int of) => '$n of $of';
  static const String tryFresh = 'Try a fresh question';
  static String checkOpens(DateTime opens) => 'Your check opens on ${MobTime.day(opens)}.';
  static const String fixRight = 'Right. That one is fixed for you.';
  static const String fixWrong = 'Not this one. Here is why.';
  static const String fixTogetherDone = 'Two of you passed the check, so this trap is fixed together.';
  static const String yourPick = 'Your pick';
  static const String rightAnswer = 'The right answer';
  static const String freshTitle = 'One fresh question, only for you';
  static const String checkTitle = 'The check: one more like it';
  static const String takeCheck = 'Take the check';
  static const String checkKey = 'Check my answer';
  static const String fixTitle = 'Fix it together';
  static String bubbleLabel(String letter, bool yours, bool right) =>
      'Option $letter${yours ? ', your pick' : ''}${right ? ', the right answer' : ''}';

  // ---- C1 Chain, You ----
  static const String tabYou = 'You';
  static String daysInARow(int n) => n == 1 ? 'day in a row' : 'days in a row';
  static String chainBreakdown(ChainState c) {
    final parts = <String>['${c.practised} practised'];
    if (c.rested > 0) parts.add('${c.rested} rested');
    if (c.madeUp > 0) parts.add('${c.madeUp} made up');
    final best = c.days >= c.best ? 'Your best run.' : 'Your best is ${c.best} days.';
    return '${_join(parts)}. $best';
  }

  static String todayProgress(int a, int n) => '$a of $n';
  static String answerMore(int left) => left == 1 ? 'Answer 1 more question today to count it.' : 'Answer $left more questions today to count it.';
  static String passesHeld(int held, int max) => held >= max ? '$held rest passes, the most you can hold' : (held == 1 ? '1 rest pass' : '$held rest passes');
  static const String passesRule = 'Miss a day and one is used for you. You earn one every 7 days, and one for every 3 fixes that hold.';
  static String makeUpOpen(String weekday, int needed) => '$weekday was missed and no pass was left. Answer $needed questions today or tomorrow and $weekday counts.';
  static const String makeUpOnce = 'A make-up can be used once every 14 days.';
  static String newChain(int best) => 'A new chain starts today. Your best is $best days.';
  static const String calendarCaption = 'Moon: a rest pass kept the chain.';
  static String milestone(ChainMilestone m) => switch (m.reward) {
        'rest_pass' => 'Rest pass at ${m.at}',
        'foil' => 'Foil edge at ${m.at}',
        'ribbon' => 'A ribbon at ${m.at}',
        _ => '${m.at} days',
      };
  static String moreDays(int n) => n == 1 ? '1 more day' : '$n more days';
  static const String examPause = 'Exam pause days';
  static const String hideChain = 'Hide my chain';
  static const String hiddenLine = 'Your chain is hidden. It still counts, and nobody else ever sees it.';
  static const String showChain = 'Show my chain';

  // ---- C2 Chain, Mob ----
  static String weeksInARow(int n) => n == 1 ? 'week in a row' : 'weeks in a row';
  static String mobChainLine(String mob) => 'A week is stitched each time $mob finishes the weekly quest. Nobody can break it alone.';
  static String bestRun(int w) => w == 1 ? 'Best run: 1 week' : 'Best run: $w weeks';
  static const String questEnds = 'Ends Sunday 11:59 PM';
  static String questGoal(int target) => 'Answer $target questions together in Mob games and papers.';
  static String questAnswered(int a, int t) => '$a of $t answered';
  static String questPast(int a, int t) => '$a answered. The quest needed $t.';
  static const String whatFilled = 'What filled it';
  static String parcelHolds(QuestParcel p, String mob) => switch (p.kind) {
        ParcelKind.fold => '${foldName(p.fold ?? FoldKey.hop)} is folded in this week\'s parcel. Finish the quest and everyone in $mob gets ${foldName(p.fold ?? FoldKey.hop)}.',
        ParcelKind.item => 'This week\'s parcel holds ${itemName(p.item ?? '').toLowerCase()}. Finish the quest and it goes on $mob\'s shelf.',
        ParcelKind.stitch => "This week's stitch. Finish the quest and the pennant gets one more week.",
      };
  static const String howItCounts = 'How it counts';
  static String countsLine(int sizedFor, int each) =>
      'Every question answered in a Mob game or paper counts, right or wrong. Sized for $sizedFor of you: $each each. Resting this week? Step out, and the quest gets smaller without your name.';
  static const String stepOut = 'Step out this week';
  static const String steppedOut = 'You stepped out this week. Step back in';
  static const List<String> mobPath = ['Den stamp at 2', 'Stamp and the desk bell at 4', 'Brass lamp at 8', 'Foil seal at 12'];
  static String newMobChain(int best) => 'A new chain starts this week. Your best is $best weeks.';

  // ---- P5 Exam pause ----
  static String pauseLine(int left) => 'Set days ahead for school exams. Your chain holds on those days. You have 14 a season, and $left are left.';
  static String pauseKey(int n) => n == 1 ? 'Pause 1 day' : 'Pause $n days';
  static const String clearDays = 'Clear these days';

  // ---- Sheets and chains additions (P1 to P5, C1, C2) ----
  static const String joinGame = 'Join';
  static const String podiumKey = 'Podium';
  static const String aFriend = 'A friend';
  static const String usedThisWeek = 'Used this week';
  static const String liveSub = 'Everyone at once';
  static const String fullMockSub = '50 questions in 60 minutes';
  static const String lockedWord = 'Locked';

  /// "You sat it on Monday." when the server says when; else "You sat it this week."
  static String satLine(DateTime? at) => at == null ? 'You sat it this week.' : satOn(MobTime.weekdayOf(at));

  static String startSub(String mob, String subject) => '$mob, $subject';
  static const String useWholeSubject = 'Use the whole subject';
  static const String fewerQuestions = 'Fewer questions';
  static const String moreQuestions = 'More questions';
  static const String freeProTitle = 'Free and Pro in the Mob';
  static const String pickDays = 'Choose days to pause';
  static const String earlierMonth = 'Earlier month';
  static const String laterMonth = 'Later month';

  static const String chainsTitle = 'Chains';
  static const String chainLoading = 'Loading your chain';
  static const String chainFailed = "Your chain didn't load.";
  static const List<String> dayInitials = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  static const String todayWord = 'Today';
  static const String dayChosen = 'chosen';
  static const String doneWord = 'Done';
  static String dayStateWord(ChainDayState s) => switch (s) {
        ChainDayState.practised => 'practised',
        ChainDayState.rested => 'rested',
        ChainDayState.madeUp => 'made up',
        ChainDayState.paused => 'set aside for exams',
        ChainDayState.open => 'open',
        ChainDayState.today => 'today',
        ChainDayState.missed || ChainDayState.none => 'not practised',
      };
  static String makeUpProgress(int answered, int needed) => 'You have answered $answered of $needed today.';
  static String mobChainTitle(int weeks) => '$weeks ${weeksInARow(weeks)}';
  static const String weeksWord = 'weeks';
  static const String onTheWay = 'On the way';

  // ---- K1 to K5 moments ----
  static String milestoneLine(ChainState c) {
    final rested = c.rested > 0 ? ' and rested ${c.rested}' : '';
    final best = c.days >= c.best ? 'It is your best run so far.' : 'Your best is ${c.best} days.';
    return 'You practised ${c.practised} of them$rested. $best';
  }

  static const String aRestPass = 'A rest pass';
  static const String questDone = 'Quest done';
  static String questDoneLine(String mob, int answered, int target, int week) =>
      '$mob answered $answered questions this week. The quest needed $target, so week $week of your chain is stitched.';
  static const String openParcel = 'Open the parcel';
  static const String seePennant = 'See the pennant';
  static String stitchedLine(String mob, int week, int size) => '$mob finished this week\'s quest together, so week $week is stitched for ${size == 1 ? 'you' : 'all ${_number(size)} of you'}.';
  static String rewardFor(String item) => '${_article(itemName(item))} for your den';
  static const String staysOnShelf = "It stays on your den's shelf.";
  static const String newOnShelf = 'New on your shelf';
  static String revealFact(String mob, FoldKey f) => '$mob finished its first weekly quest, so everyone in it gets ${foldName(f)}. Nobody can buy ${_pronoun(f)}.';
  static String playAs(FoldKey f) => 'Play as ${foldName(f)}';
  static const String seeShelf = 'See your shelf';
  static String passNotice(String weekday, int days) => '$weekday was covered by a rest pass. Your chain is still $days.';
  // Moment chrome (MOMENTS agent).
  static const String close = 'Close';
  static const String headYou = 'You';
  static const String mobsChain = "The Mob's chain";
  static const String yourChain = 'Your chain';
  static String questDoneA11y(int answered, int target) => 'Quest done. $answered answered. The quest needed $target.';
  static String parcelA11y(QuestParcel p) => switch (p.kind) {
        ParcelKind.fold => "This week's parcel. ${foldName(p.fold ?? FoldKey.hop)} is folded inside.",
        ParcelKind.item => "This week's parcel. ${itemName(p.item ?? '')} is inside.",
        ParcelKind.stitch => "This week's stitch.",
      };

  // ---- S1 Shelf ----
  static const String shelfTitle = 'Your shelf';
  static const String shelfLead = 'Every one is earned. None can be bought.';
  static const String finishes = 'Finishes';
  static String foilProgress(int have, int need) => 'Foil edge. $need days in a row. ${have.clamp(0, need)} of $need.';
  static String mobShelf(String mob) => "$mob's shelf";
  static String lockedRule(ShelfFold f) {
    final rule = foldRule(f.key);
    final count = f.have == null || f.need == null ? '' : ' ${f.have!.clamp(0, f.need!)} of ${f.need}';
    final where = f.mob == null ? '' : ', in ${f.mob}';
    return '${foldName(f.key)}. $rule$count$where.';
  }

  static const String shelfOwned = 'Yours';
  static const String shelfToEarn = 'Still to earn';
  static const String foilEarned = 'Foil edge. Earned.';
  static const String foilWear = 'Wear it on your Fold';
  static const String shelfFailed = "Your shelf didn't load.";
  static const String shelfLoading = 'Loading your shelf';
  static const String mobShelfOwned = 'On the shelf';
  static String mobShelfNext(int? have, int? need) => have != null && need != null ? '${have.clamp(0, need)} of $need weeks in a row' : (need != null ? 'At $need weeks in a row' : 'Next on the shelf');
  static String shelfSeatTag(String fold) => 'You play as $fold';

  // ---- Stickers ----
  static String sticker(StickerKind k) => switch (k) {
        StickerKind.niceOne => 'Nice one',
        StickerKind.soClose => 'So close',
        StickerKind.teachMe => 'Teach me',
        StickerKind.again => 'Again?',
        StickerKind.goodLuck => 'Good luck',
        StickerKind.letsGo => "Let's go",
        StickerKind.oneSec => 'One sec',
        StickerKind.ready => 'Ready',
      };
  static const String stickerSent = 'Sent to your Mob.';

  // ---- SET Mob settings ----
  static const String showPodium = 'Show a podium';
  static const String showPodiumNote = 'Games show places by marks. Off: everyone\'s marks, with no places.';
  static String podiumNotOwner(String mob, bool on, String owner) => '$mob ${on ? 'shows' : 'does not show'} a podium. $owner can change this.';
  static const String mobName = 'Mob name';
  static const String restingWeek = 'Resting this week';
  static const String shareMarks = 'Share my marks in games';
  static const String settingsTitle = 'Mob settings';
  static const String restingNote = 'The quest gets smaller without your name.';
  static const String shareMarksNote = 'Off: your Fold stands on the podium with "Private" instead of marks, and you get no place. The collective line still counts your answers.';
  static const String membersHeading = 'In this Mob';
  static String memberRow(String name, bool you) => you ? '$name, you' : name;
  static String memberMenu(String name) => 'More for $name';
  static const String settingsFailed = "Your Mob's settings didn't load.";
  static const String namePicked = 'The Mob name is changed.';

  // ---- Folds ----
  static String foldName(FoldKey f) => switch (f) {
        FoldKey.dart => 'Dart',
        FoldKey.dogear => 'Dog-ear',
        FoldKey.hexa => 'Hexa',
        FoldKey.kandil => 'Kandil',
        FoldKey.hop => 'Hop',
        FoldKey.crane => 'Crane',
        FoldKey.stamp => 'Stamp',
        FoldKey.naav => 'Naav',
        FoldKey.tally => 'Tally',
        FoldKey.patang => 'Patang',
        FoldKey.sticky => 'Sticky',
        FoldKey.cutting => 'Cutting',
      };

  /// The shelf line (spec 0.4).
  static String foldLine(FoldKey f) => switch (f) {
        FoldKey.dart => 'Answers first, then learns to check.',
        FoldKey.dogear => 'Learning to trust the first pick.',
        FoldKey.hexa => 'Builds each answer step by step.',
        FoldKey.kandil => 'Keeps the desk lit for everyone.',
        FoldKey.hop => 'Bounces back after a wrong one.',
        FoldKey.crane => 'Folds it until it is right.',
        FoldKey.stamp => 'Seals every fix that held.',
        FoldKey.naav => 'Steady in the last ten minutes.',
        FoldKey.tally => 'Counts the minus marks too.',
        FoldKey.patang => 'Rises against the wind.',
        FoldKey.sticky => 'Remembers the formula for you.',
        FoldKey.cutting => 'Knows a break is part of the plan.',
      };

  /// How each is earned, as the locked card says it (spec 0.4).
  static String foldRule(FoldKey f) => switch (f) {
        FoldKey.dart || FoldKey.dogear || FoldKey.hexa || FoldKey.kandil => 'Free to everyone.',
        FoldKey.hop => 'Your Mob finishes its first weekly quest.',
        FoldKey.crane => 'Your Mob fixes 3 traps together.',
        FoldKey.stamp => "Your Mob's chain reaches 4 weeks in a row.",
        FoldKey.naav => 'Finish your first full-length mock.',
        FoldKey.tally => 'Finish 3 Mob games with no minus marks.',
        FoldKey.patang => "Beat your own best score in a subject's full mock.",
        FoldKey.sticky => '5 fixes that held.',
        FoldKey.cutting => 'Come back after 3 or more days away.',
      };

  static String itemName(String item) => switch (item) {
        'den_stamp' => 'Den stamp',
        'desk_bell' => 'A desk bell',
        'brass_lamp' => 'Brass lamp',
        'foil_seal' => 'Foil seal',
        'den_stamp_row' => 'A second den stamp row',
        'stamp' => 'Stamp',
        _ => 'A new piece',
      };

  // ---- Errors (spec 3.2), by the server's code ----
  static const Map<String, String> errors = {
    'START_PRO': 'Starting games is part of Pro. You can play every game your Mob starts.',
    'START_USED': "You started this week's game in this Mob. You can start another on Monday, or a friend with Pro can pass you the mic.",
    'START_FORMAT': 'Live rooms are part of Pro. You can start this game for anytime in 24 hours.',
    'GAMES_OPEN_LIMIT': 'Your Mob already has 3 games open. A new one can start when one closes.',
    'ROOM_OPEN_ALREADY': 'A live room is already open in your Mob. Join it from the den.',
    'LIVE_OFF': 'Live rooms are not on yet. Start it for anytime in 24 hours.',
    'LIVE_HOURS': 'Live rooms open from 6:00 AM to 11:00 PM. You can start it for anytime in 24 hours.',
    'LIVE_BUSY': 'Live is busy right now. Play now, and your Mob can catch up within 24 hours.',
    'GAME_NOT_FOUND': 'That game is not in your Mob.',
    'GAME_CLOSED': 'This game has closed. Its answers are open now.',
    'RUN_DONE': 'You already played this game. Your marks are on the podium.',
    'RUN_EXPIRED': 'Your time on this game ran out. Questions you did not answer count as skipped.',
    'NO_RUN': 'Start the game first.',
    'Q_INVALID': 'That question is not in this game.',
    'PODIUM_NOT_YET': 'Finish your run first, then you can see the podium.',
    'REVIEW_NOT_YET': 'The answers open for everyone when this game closes.',
    'NOT_LIVE': 'This game is played anytime, not live.',
    'ROOM_NOT_HOST': 'Only the member who opened this room can start it.',
    'ROOM_STARTED': 'This room has already started.',
    'STICKER_INVALID': 'Choose one of the stickers.',
    'MIC_LIMIT': 'You passed the mic twice this week, the most a week allows. You can pass it again on Monday.',
    'MIC_SELF': 'Pass the mic to a friend in your Mob.',
    'BILLING_OFF': 'Everyone can start games right now, so there is no mic to pass.',
    'NOT_OWNER_SETTINGS': 'Only the member who started the Mob can change this.',
    'NAME_KEY_INVALID': 'Choose one of the names.',
    'FOLD_INVALID': 'Choose one of the Folds.',
    'FOLD_LOCKED': 'You have not earned that Fold yet. Its card says how.',
    'STEP_OUT_DONE': "This week's quest is already done, so there is nothing to step out of.",
    'FIX_NOT_YET': 'This opens when the game closes.',
    'FIX_CLOSED': 'This check has closed. A new trap brings a new one.',
    'PAUSE_PAST': 'Pause days have to be after today.',
    'PAUSE_LIMIT': 'You have used the 14 pause days this season allows.',
    'LENGTH_INVALID': 'Choose 5, 10, 15 or 20 questions.',
    'CHAPTER_INVALID': 'Choose a chapter of this subject.',
    'BANK_THIN': 'There are not enough questions ready for that paper.',
    'INVITE_INVALID': "This invite can't be used. Ask your friend for a new link.",
    'INVITE_EXPIRED': "This invite can't be used. Ask your friend for a new link.",
    'MOB_FULL': 'This Mob is full: it has 5 members, the most a Mob can have. Ask your friend to tell you if a seat opens, or start a Mob of your own.',
  };

  static const String offline = "You're offline. Nothing changed.";
  static const String generic = "That didn't go through. Try again.";

  /// The sentence for any failure: the server's code first, then offline, then a plain fallback.
  static String error(Object e) {
    final code = _codeOf(e);
    if (code != null) {
      final s = errors[code.toUpperCase()];
      if (s != null) return s;
    }
    // Today's Mob codes (join, create, names, rate limits) keep today's sentences.
    if (e is ApiError) {
      final f = mobFailureFor(e);
      if (f != MobFailure.generic) return MobCopy.failure(f);
    }
    if (_offline(e)) return offline;
    return generic;
  }

  /// The server's code of a failure (START_USED, LIVE_BUSY...), or null.
  static String? codeOf(Object e) => _codeOf(e);

  static String? _codeOf(Object e) {
    try {
      final dynamic d = e;
      final c = d.code;
      return c is String ? c : null;
    } on Object {
      return null;
    }
  }

  static bool _offline(Object e) {
    try {
      final dynamic d = e;
      return d.isOffline == true;
    } on Object {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------

String ordinal(int n) => switch (n) { 1 => 'first', 2 => 'second', 3 => 'third', 4 => 'fourth', 5 => 'fifth', _ => '$n' };

String _number(int n) => switch (n) { 2 => 'two', 3 => 'three', 4 => 'four', 5 => 'five', _ => '$n' };

String _join(List<String> names) {
  if (names.isEmpty) return '';
  if (names.length == 1) return names.first;
  if (names.length == 2) return '${names[0]} and ${names[1]}';
  return '${names.sublist(0, names.length - 1).join(', ')} and ${names.last}';
}

String joinNames(List<String> names) => _join(names);

String _aAn(String word) => RegExp(r'^[AEIOUaeiou]').hasMatch(word) ? 'An' : 'A';

String _article(String phrase) => phrase.startsWith('A ') ? phrase : (phrase.startsWith('An ') ? phrase : '${_aAn(phrase)} ${phrase.toLowerCase()}');

String _pronoun(FoldKey f) => f == FoldKey.hop ? 'him' : 'it';
