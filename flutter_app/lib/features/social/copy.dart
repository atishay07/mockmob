// Every Mob sentence. Plain, calm, no exclamation marks, no arrows, 12-hour IST times (P13).
// No count of who has not sat, no rank, no pressure (Rule 22, T005), nothing that counts down, and
// no price. Pro is named only where it can be had: [sell] is true with `PLAY_BILLING` on for a signed-in
// Free student (proNudgesOnProvider), and then each Pro line comes with the key to the Upgrade sheet
// (D80). With [sell] false (the flag off, or a Pro student) a Free limit is said as the plain fact it
// is ("You get one Mob paper a week.") and nothing names Pro (owner, 18 Oct, H11). The selling words
// follow the website's Mob page so a student sees the same sentence on both.

import 'data/mob_models.dart';
import 'data/mob_repository.dart';

abstract final class MobCopy {
  static const String title = 'Your Mob';
  static const String startTitle = 'Start a Mob';
  static const String pitch = 'Sit one 10-question paper a week with up to 4 friends.';
  /// The rules on the start page: two plain lines under the seat ring, never a bullet list (owner
  /// walk, 18 Oct, H12).
  static const List<String> promises = [
    'The same 10 questions for all of you, fresh each week, free of credits on any plan.',
    'Members see who sat and each other\'s answers, never who didn\'t. One switch keeps yours private.',
  ];

  /// Under the start page's seat ring: the seat that is theirs and the ones that wait.
  static String seatCaption(String name) => '${name.isEmpty ? 'Your seat' : name}, and ${mobMaxSize - 1} seats for friends';
  static const String seatRingLabel = 'Your Mob: your seat, and ${mobMaxSize - 1} open seats for friends.';
  static const String subjectLabel = 'Subject for the weekly paper';
  static const String nameLabel = 'Your name in the Mob';
  static const String nameHint = 'First name';
  static const String nameRule = 'Use 2 to 18 letters. Spaces, dots, apostrophes and hyphens are fine.';
  static const String nameNote = 'Only your Mob sees it. 2 to 18 letters.';
  static const String colourLabel = 'Colour';
  static const String startKey = 'Start a Mob';
  // Join with a code (D105): the Mob tab's second way in for a student in no Mob.
  static const String joinWithCode = 'Join with a code';
  static const String joinCodeLead = 'Got a code or a link from a friend? Join their Mob. You can be in theirs and still start your own.';
  static const String joinCodeTitle = "Join a friend's Mob";
  static const String joinCodeNote = 'Type the code your friend sent you (8 letters and numbers), or paste their whole link.';
  static const String joinCodeLabel = 'Code or link';
  static const String joinCodeHint = 'For example K7P2M9QX';
  static const String joinCodeWrong = 'That code does not look right. A code has 8 letters and numbers. You can also paste the whole link.';
  static const String joinCodeKey = 'Find their Mob';
  static const String haveLink = 'Got a link from a friend? Open it to join their Mob. You can be in theirs and your own.';
  // No subject to start a Mob for: the sentence is the server's (NO_SUBJECTS), the way forward is the key.
  static const String noSubjects = 'Choose your CUET subjects first. A Mob sits one paper a week in one of them.';
  static const String chooseSubjects = 'Choose your subjects';
  static const String everySubjectHasMob = 'Each of your subjects already has one of your Mobs. Add a subject to start another.';
  static const String addSubject = 'Add a subject';
  static const String startCost = 'Free. The weekly paper costs no credits.';

  static String colourName(int i) => const ['Blue', 'Teal', 'Amber', 'Rose', 'Violet', 'Sky', 'Coral', 'Green'][i.clamp(0, 7)];

  // The ring and the week.
  static String ringLine(int sat, int size) => '$sat of $size sat this week';
  static String paperLine(String subject, int count) => '$subject paper, $count questions';
  static const String closes = 'Closes Sunday 11:59 PM';
  static const String closed = 'This week\'s paper closed. Next one opens Monday.';

  // The paper.
  static String sitKey(int count, int minutes) => 'Sit this week\'s paper';

  /// "10 questions, 10 minutes": the paper's own clock (60 seconds a question), the same words the
  /// website uses.
  static String paperClock(int count, int minutes) => '$count questions, $minutes minutes';
  static String sitNote(int count, int minutes) => '${paperClock(count, minutes)}, the same for everyone.';
  static const String seeAnswers = 'See your answers';
  static const String seeMob = 'See your Mob';
  static const String freeUsed = 'You already sat a Mob paper this week, in another Mob. Free includes one a week, and Pro lets you sit one in every Mob.';
  static const String freeUsedPlain = 'You already sat a Mob paper this week, in another Mob. You get one Mob paper a week.';
  static String freeUsedFor({required bool sell}) => sell ? freeUsed : freeUsedPlain;
  static const String includedWithPro = 'Included with Pro.';
  static const String opening = 'Opening';
  static const String openingPaper = 'Opening the paper';

  /// The cost line under the sit key, from the server's quote: never a number the server did not send.
  static String? costLine(MobPaper p) => switch (p.costType) {
        MobCostType.free => 'Free. No credits.',
        MobCostType.included => 'Included with Pro.',
        MobCostType.allowance => 'Free today.',
        MobCostType.credits => _credits(p),
        MobCostType.unknown => null,
      };

  static String? _credits(MobPaper p) {
    final c = p.credits;
    if (c == null) return null;
    final b = p.balance;
    if (b == null) return '$c credits.';
    return b < c ? '$c credits. You have $b, so you need ${c - b} more.' : '$c credits. You have $b.';
  }

  // The nudge.
  static const String nudgeKey = 'Ask the others to sit it';
  static const String nudgeSentReason = 'You asked the others this week.';
  static const String nudgeEveryoneSat = 'Everyone has sat this week.';
  static const String nudgeClosed = 'This week\'s paper has closed.';
  static const String nudgeSitFirst = 'Sit it first, then you can ask the others.';
  static const String nudgeSentNote = 'Sent. Members who have not sat will see it when they next open MockMob.';
  static String nudgeReceived(String from) => '$from sat it and asked you to sit it too.';
  static const String gotIt = 'Got it';

  static String? nudgeReason(MobNudgeReason r) => switch (r) {
        MobNudgeReason.sent => nudgeSentReason,
        MobNudgeReason.everyoneSat => nudgeEveryoneSat,
        MobNudgeReason.closed => nudgeClosed,
        MobNudgeReason.notSat || MobNudgeReason.none => null,
      };

  // The shared trap and what the Mob has in common.
  static String trapLine(MobTrap t) => 'Your Mob\'s trap: ${t.count} of ${t.of} picked ${t.option} on question ${t.questionNumber}.';
  static String trapName(MobTrap t) {
    final name = t.trapName == null ? 'A common wrong pick.' : 'Trap: ${t.trapName}.';
    final you = t.youGotItRight
        ? 'You got this one right.'
        : t.youPickedIt
            ? 'You picked ${t.option} too.'
            : 'You did not pick it.';
    return '$name $you';
  }

  static const String repairIt = 'Repair it';
  static String seeWhy(String option) => 'See why $option is wrong';
  static const String trapTitle = 'The shared trap';
  static const String togetherTitle = 'This week together';

  static String togetherLine(MobTogether t) {
    final two = t.withCount == 1;
    final you = two ? 'You and 1 other member' : 'You and ${t.withCount} other members';
    final first = t.sameRight == 0
        ? '$you got no question right in common.'
        : '$you ${two ? 'both' : 'all'} got ${t.sameRight == 1 ? 'the same question' : 'the same ${t.sameRight} questions'} right.';
    final miss = t.sharedMiss;
    return miss == null ? first : '$first ${two ? 'You both' : 'You all'} missed question $miss.';
  }

  // Compare: the teaser is free, the side-by-side is Pro, and the first one is free once.
  static const String compareTitle = 'Compare with your Mob';
  static const String openCompare = 'See the side-by-side';
  static const String shareLabel = 'Share my score and answers with my Mob';
  // Sharing inside a Mob is on by default (17 Oct decision); one switch turns it off.
  static const String shareHint =
      'On by default. Members who share see what each other picked, how long it took and how they scored, only inside this Mob, never a ranking. Turn it off to keep yours to yourself.';
  static const String shareHintCompare = 'You see what members who share picked, and they see yours. Never a ranking.';
  static const String lockedNote = 'The full side-by-side is included with Pro: who picked what, who changed an answer, and how long each question took.';
  static const String lockedNotePlain = 'Your one free side-by-side went to another week, so this one stays closed.';
  static const String sampleNote = 'This is your free first side-by-side, so it stays open for this week.';
  static const String sampleLead = 'This is your free first side-by-side. Pro opens it every week, with past weeks and extra papers.';
  static const String sampleLeadPlain = 'This is your free first side-by-side.';
  static String sampleLeadFor({required bool sell}) => sell ? sampleLead : sampleLeadPlain;
  static const String offerFree = 'Your first side-by-side is free.';
  static const String offerNeedsOther = 'Your first side-by-side is free. It opens once another member shares their answers.';
  static const String offerNeedsYou = 'Your first side-by-side is free. Share your answers to open it.';
  static const String shareToCompare = 'Share your answers to compare this paper with your Mob.';
  static const String sharedWaiting = 'Your answers are shared. Comparing opens when another member shares theirs.';

  static String? compareNote(MobCompareSummary c, {bool sell = false}) => switch (c.access) {
        MobCompareAccess.offer => c.needsShare ? (c.youShare ? offerNeedsOther : offerNeedsYou) : offerFree,
        MobCompareAccess.sample => sampleNote,
        MobCompareAccess.locked => sell ? lockedNote : lockedNotePlain,
        _ => null,
      };

  static String compareEmpty(MobCompareSummary c) => c.youShare ? sharedWaiting : shareToCompare;

  static String sideBySideTitle(MobCompare c) => c.isExtra ? '${c.chapter ?? 'Whole subject'}, ${countLabel(c.questions.length, 'question')}' : weekLabel(c.week);
  static String sideBySideSat(MobCompare c) => '${c.sat} of ${c.size} sat.${c.hidden > 0 ? ' ${countLabel(c.hidden, 'member keeps', 'members keep')} their answers private.' : ''}';
  static const String backToMob = 'Back to your Mob';
  static const String sideBySideFoot = 'Seconds come from your device\'s own record of the paper. A question shows no time when the record did not keep one.';
  static const String noQuestions = 'The questions of this paper are not available to show just now. Your result is still yours to open.';
  static const String split = 'Split';
  static String answerKey(String k) => 'Answer $k';
  static String questionNumber(int n) => 'Question $n';
  static const String youRow = 'You';
  static const String none = 'None';
  static const String noAnswer = 'No answer';
  static const String right = 'Right';
  static const String wrong = 'Wrong';
  static String changed(int n) => n == 1 ? 'Changed once' : 'Changed $n times';
  /// The counts are over the sitters you can read: with a member who keeps their answers private
  /// ([partial]) the sentence says so, because that member is in neither the counts nor the split.
  static String howPicked(List<MobPickCount> picks, {bool partial = false}) =>
      '${partial ? 'How you and the members who share picked' : 'How your Mob picked'}: ${picks.map((p) => '${p.option ?? 'No answer'} ${p.count}').join(', ')}.';

  static String seconds(int s) {
    if (s < 60) return '${s}s';
    return s % 60 == 0 ? '${s ~/ 60}m' : '${s ~/ 60}m ${(s % 60).toString().padLeft(2, '0')}s';
  }

  // Extra papers (Pro makes them, any member sits them).
  static const String extrasTitle = 'Extra papers';
  static const String extrasEmpty = 'No extra papers this week. Make one on a chapter you want to drill, and your Mob can sit it too.';
  /// Free student, extras waiting: the website's line, so the one free Mob paper and the open extras never read as a contradiction.
  static const String extrasOpenToAll = 'Extra papers are open to every member of the Mob, on any plan. Pro members make them.';
  static const String extrasOpenToAllPlain = 'Extra papers are open to every member of the Mob, on any plan.';
  static String extrasOpenToAllFor({required bool sell}) => sell ? extrasOpenToAll : extrasOpenToAllPlain;
  static const String makeExtra = 'Make an extra paper';
  static const String makeExtraSheetTitle = 'Make an extra paper';
  static String chapterOf(String subject) => 'Chapter of $subject';
  static const String wholeSubject = 'Whole subject';
  static String chapterUpTo(int n) => 'Up to $n questions';
  static const String chaptersLoading = 'Checking which chapters have questions ready.';
  static const String chaptersFailed = 'Chapters did not load. The whole subject still works.';
  static const String chaptersNone = 'No single chapter has enough questions ready yet. The whole subject does.';
  static const String chaptersOnly = 'Only chapters with enough questions ready for a paper are listed.';
  static String chapterReady(int longest) => 'Enough questions are ready in this chapter for a paper of up to $longest.';
  static const String searchChapters = 'Search chapters';
  static String suggestKey(MobSuggestion s) =>
      s.chapter == null ? 'Make a ${s.count}-question paper on the whole subject' : 'Make a ${s.count}-question paper on ${s.chapter}';
  static const String lengthLabel = 'Length';
  static String questionsN(int n) => '$n questions';
  static const String extraNote = 'Free of credits. Anyone in your Mob can sit it for 7 days. Your Mob can have 3 extra papers a week.';
  static const String makePaper = 'Make the paper';
  static const String makingPaper = 'Making the paper';
  static const String sitIt = 'Sit it';
  static const String sideBySide = 'Side by side';
  static String extraTitleOf(MobExtra x) => '${x.chapter ?? wholeSubject}, ${x.count} questions';
  static String extraWhen(MobExtra x) => x.closed || x.closesAt == null ? 'Closed.' : 'Closes ${formatIstDayTime(x.closesAt!)}.';
  static String extraSat(MobExtra x, int size) => '${x.sat} of $size sat.';
  static const List<int> extraLengths = [5, 10, 15, 20];

  // Past weeks (Pro).
  static const String historyTitle = 'Past weeks';
  static const String showHistory = 'Show past weeks';
  static const String historyEmpty = 'Past weeks appear here after the first week closes.';
  static String historyCount(int n) => countLabel(n, 'week');
  static String historyLine(MobHistoryWeek w) {
    final sat = '${w.sat} ${w.sat == 1 ? 'member' : 'members'} sat.';
    final you = w.youSat && w.score != null && w.scoreOf != null ? ' You scored ${w.score} of ${w.scoreOf}.' : ' You did not sit it.';
    final extras = w.extras > 0 ? ' ${countLabel(w.extras, 'extra paper')}.' : '';
    return '$sat$you$extras';
  }

  // Members, the invite, settings.
  static const String membersTitle = 'Members';
  static String membersCount(int size) => '$size of $mobMaxSize';
  static const String you = 'You';
  static const String owner = 'Started it';
  static String memberMenu(String name) => 'More for $name';
  static const String report = 'Report';
  static const String leaveAndBlock = 'Leave and block';
  static const String removeMember = 'Remove from Mob';

  static String seatsLine(int n) => n == 1 ? '1 seat left' : '$n seats left';
  static String inviteRow(int seats) => 'Invite a friend (${seatsLine(seats)})';
  static const String full = 'Your Mob is full: 5 of 5.';
  static const String inviteTitle = 'Invite a friend';
  static const String inviteBody = 'Anyone with this link can join while there are seats. MockMob never asks for your contacts.';
  static const String invitesPaused = 'New invites are paused for now. Your Mob works as before.';
  static String inviteUntil(DateTime at) => 'Link works until ${formatIstDayTime(at)}';
  static const String copy = 'Copy link';
  static const String copied = 'Link copied.';
  static const String share = 'Share';
  static const String newLink = 'Make a new link';
  static const String newLinkNote = 'A new link turns this one off.';
  static const String makeLink = 'Make an invite link';
  static const String shareText = 'Sit one 10-question paper a week with me on MockMob:';
  static const String aloneLead = 'Invite a friend to sit this week\'s paper with you.';

  static const String settingsTitle = 'Settings';
  static const String showScoreNote = shareHint;
  static const String muteNudges = 'Mute nudges';
  static const String muteNudgesNote = 'You will not see Sit it with me notes.';
  static const String changeName = 'Change name or colour';
  static const String leave = 'Leave Mob';
  static String leaveTitle(bool several, String subject) => several ? 'Leave your $subject Mob?' : 'Leave your Mob?';
  static const String leaveBody = 'Your sittings leave with you. You can start or join another Mob after.';
  static const String leaveConfirm = 'Leave Mob';
  static const String stay = 'Stay';
  static const String cancel = 'Cancel';
  static const String save = 'Save';

  static String blockTitle(String name) => 'Leave and block $name?';
  static String blockBody(String name) => 'You leave this Mob and never share one with $name again. Your sittings leave with you.';
  static String removeTitle(String name) => 'Remove $name?';
  static String removeBody(String name) => '$name leaves the Mob, with their sittings. They can join again only with a new link.';
  static const String reportTitle = 'Report';
  static const String reportIntro = 'What is wrong? Moderators see the reason and the name, nothing else.';
  static const String reportName = 'Their name is not okay';
  static const String reportNudge = 'Their nudges bother me';
  static const String reportSafety = 'I do not feel safe';
  static const String reportAlsoLeave = 'Also leave and block';
  static const String reportSend = 'Send report';
  static const String reported = 'Reported. A moderator will look at it.';

  // The plan. Only with [sell] (PLAY_BILLING on, a Free student): one quiet line near the end of the
  // page, never a block of bullets (the website's wording). Free starts 1 Mob and joins any by
  // invite; Pro starts up to 3. With the flag off nothing here is drawn for a Free student.
  static const String proLine = 'Pro adds the full side-by-side every week, past weeks, extra papers on a chapter you choose, and up to 3 Mobs you start.';
  /// Pro at its cap of Mobs it started: the server's own sentence (MOB_LIMIT_PRO), shown where the
  /// start key would be, so a missing key is never a mystery. Joining stays open.
  static const String proCapLine = 'You already started 3 Mobs, the most Pro allows. You can still join any Mob a friend invites you to.';
  static const String startAnother = 'Start another Mob';
  static const String startOwn = 'Start your own Mob';
  static const String startAnotherTitle = 'Start another Mob';
  static const String startOwnTitle = 'Start your own Mob';
  static String switcherLabel(String subject) => subject;
  static const String switcherSemantics = 'Your Mobs';

  // States.
  static const String loadFailed = 'Your Mob didn\'t load.';
  static const String loadFailedOffline = 'You\'re offline, so your Mob didn\'t load.';
  static const String tryAgain = 'Try again';
  static const String unavailable = 'The Mob is not available yet.';
  static const String loadingMob = 'Loading your Mob';

  // Join.
  static const String joinTitle = 'You\'re invited to a Mob.';
  static String joinHeadline(MobInvitePreview p) =>
      p.inviter == null ? joinTitle : '${p.inviter} invited you to this week\'s 10-question ${p.subjectName} paper.';
  static String joinBody(MobInvitePreview p) => p.inviter == null
      ? 'A small group sitting one 10-question ${p.subjectName} paper each week. ${p.size} of $mobMaxSize seats taken.'
      : 'A small group, one paper a week. ${p.size} of $mobMaxSize seats taken.';
  static const List<String> joinFacts = [
    'One paper a week, the same 10 questions for all of you, 10 minutes. Free of credits, on any plan.',
    'You see who sat, never who didn\'t. Never ranked, and you can leave any time.',
    'Shared inside the Mob only: members see each other\'s answers and scores. One switch turns yours off.',
  ];
  static const String joinNoContacts = 'MockMob never asks for your contacts. You can leave any time.';
  static const String joinKey = 'Join';
  static const String joinAs = 'Join as';
  static const String openYourMob = 'Open your Mob';
  static const String inviteUnusableTitle = 'This invite can\'t be used.';
  static const String inviteUnusableNote = 'Ask your friend for a new link.';
  static const String inviteUnusable ='This invite can\'t be used. Ask your friend for a new link.';
  static const String checkingInvite = 'Checking the invite.';
  static const String inviteFullTitle = 'This Mob is full.';
  static const String inviteFullNote = 'It has 5 members, the most a Mob can have. Ask your friend to tell you if a seat opens, or start a Mob of your own and invite your friends to it.';
  static const String invitePausedTitle = 'Joining is paused for now.';
  static const String invitePausedNote = 'New members cannot join a Mob by link just now. Keep the link and try it again later.';
  static const String inviteLoadFailedTitle = 'The invite did not load.';
  static const String openYourMobs = 'Open your Mobs';

  // Today and the hub.
  static const String hubRow = 'Your Mob';
  static const String hubStart = 'Start a Mob';
  static const String hubStartNote = 'One paper a week with friends';
  static String mobiComplete(int size) => 'Your Mob sat it, all $size.';

  // Entry points on Today, Practice and Review (the website's lines).
  static const String entryAloneBig = 'Just you so far';
  static const String entryAloneLine = 'Send the link to a friend. The ring fills as you sit the same paper.';
  static String entryAloneTitle(String name) => '$name is just you so far';
  static String entryOpenLine(String subject, String clock) => 'This week\'s $subject paper: $clock, no credits.';
  static const String entrySatLine = 'You sat this week\'s paper.';
  static const String entryWatchLine = 'See where your Mob is this week.';
  static String entryPracticeTitle(String subject, String clock) => 'Mob paper, $subject, $clock';
  static String entryPracticeSatTitle(String subject) => 'Mob paper, $subject: sat';
  static String entryTrapTitle(String name, int question) => '$name\'s trap: question $question';
  static String entryTrapLine(MobTrap t) {
    final what = t.trapName == null ? '' : ' Trap: ${t.trapName}.';
    final you = t.youGotItRight
        ? 'You got it right.'
        : t.youPickedIt
            ? 'You picked ${t.option} too.'
            : 'You did not pick it.';
    return '${t.count} of ${t.of} picked ${t.option}.$what $you';
  }

  static const String notNow = 'Not now';
  static const String inviteMomentTitle = 'Sit one paper a week with friends';

  /// What a Mob is and why to start one, first (owner walk, 18 Oct: "You have saved 12 sessions."
  /// opened the card as a non sequitur). The moment's reason decides when the card shows; it is not
  /// the card's first line.
  static const String inviteMomentBody =
      'Sit the same 10 questions as your friends each week, then see the questions your Mob got wrong together. Up to 5 of you, free of credits. Only people you send the link to can join.';
  static const String inviteMomentWeek = 'You met your study goal for a week.';
  static String inviteMomentSessions(int n) => 'You have saved $n sessions.';
  static String todayTitle(Mob m) => m.several ? 'Your ${m.subjectName} Mob' : 'Your Mob';

  /// One sentence for every failure: the server's own wording for its codes (a test holds the two together).
  ///
  /// [sell]: the three Free limits Pro answers ([MobFailure.needsPro]) name Pro only when the Upgrade
  /// sheet can open (PLAY_BILLING on, a Free student). Otherwise they say the plain fact.
  static String failure(MobFailure f, {bool sell = false}) => switch (f) {
        MobFailure.offline => 'You\'re offline. Nothing changed.',
        MobFailure.unauthenticated => 'Sign in to use your Mob.',
        MobFailure.disabled => 'This page is not available.',
        MobFailure.notInMob => 'You are not in a Mob.',
        MobFailure.notFound => 'That member is not in your Mob.',
        MobFailure.inviteInvalid || MobFailure.inviteExpired => inviteUnusable,
        MobFailure.full => 'This Mob is full: it has 5 members, the most a Mob can have. Ask your friend to tell you if a seat opens, or start a Mob of your own.',
        MobFailure.alreadyInMob => 'You are already in this Mob.',
        MobFailure.mobLimit => sell
            ? 'You already started a Mob. Free lets you start one, and join as many as friends invite you to. Pro lets you start up to 3.'
            : 'You already started a Mob. You can start one, and join as many as friends invite you to.',
        MobFailure.mobLimitPro => 'You already started 3 Mobs, the most Pro allows. You can still join any Mob a friend invites you to.',
        MobFailure.mobCeiling => 'You are in 12 Mobs, the most one account can be in. Leave one to start or join another.',
        MobFailure.invitesPaused => 'New invites are paused for now. Your Mob works as before.',
        MobFailure.joinPaused => 'Joining a Mob by link is paused for now. Try this link again later.',
        MobFailure.weekInvalid => 'There is no Mob paper for that week.',
        MobFailure.extraNotFound => 'That extra paper is not in your Mob.',
        MobFailure.compareSitFirst => 'Sit this paper first, then you can compare it with your Mob.',
        MobFailure.notSatThatWeek => 'You did not sit that week\'s paper, so there is nothing of yours to compare.',
        MobFailure.comparePastAlone => 'Only one member sat that week\'s paper, so there is nothing to compare.',
        MobFailure.bankThin => 'There are not enough questions ready for that paper.',
        MobFailure.mobRequired => 'Say which Mob this is for.',
        MobFailure.proRequired => sell ? 'This part of the Mob is included with Pro.' : 'This part of the Mob is not on your plan.',
        MobFailure.compareUnavailable => 'There is nothing to compare yet. It needs one more member to sit this paper.',
        MobFailure.shareFirst => 'Share your answers with your Mob to compare. Members who share see each other, never a ranking.',
        MobFailure.compareWaiting => 'No one else has shared their answers yet. Your first comparison stays free until someone does.',
        MobFailure.freePaperUsed => sell ? 'You already sat a Mob paper this week. Pro lets you sit one in every Mob.' : 'You already sat a Mob paper this week. You get one Mob paper a week.',
        MobFailure.extraLimit => 'Your Mob already has 3 extra papers this week. It can make more next week.',
        MobFailure.extraClosed => 'This extra paper has closed.',
        MobFailure.extraAlreadySat => 'You already sat this extra paper. Your answers are under See your answers.',
        MobFailure.chapterInvalid => 'Choose a chapter of this subject.',
        MobFailure.lengthInvalid => 'Choose 5, 10, 15 or 20 questions.',
        MobFailure.notOwner => 'Only the member who started the Mob can remove someone.',
        MobFailure.notSat => 'Sit this week\'s paper first, then you can ask the others.',
        MobFailure.alreadyNudged => 'You already asked the others this week.',
        MobFailure.alreadySat => 'You already sat this week\'s paper. The next one opens Monday.',
        MobFailure.weekClosed => 'This week\'s paper closed. The next one opens Monday.',
        MobFailure.paperExpired => 'Your time on this week\'s paper ran out. The next one opens Monday.',
        MobFailure.credits => 'You do not have enough credits for this paper.',
        MobFailure.nameInvalid => 'Use 2 to 18 letters for your name. Spaces, dots, apostrophes and hyphens are fine.',
        MobFailure.nameRefused => 'Choose a different name. Your Mob sees it.',
        MobFailure.subjectInvalid => 'Choose one of your subjects.',
        MobFailure.noSubjects => noSubjects,
        MobFailure.colourInvalid => 'Choose one of the 8 colours.',
        MobFailure.reasonInvalid => 'Choose why you are reporting.',
        MobFailure.bodyInvalid => 'Something in the request was not right. Try again.',
        MobFailure.rateLimited => 'Too many tries in a short time. Try again in a few minutes.',
        MobFailure.paperUnavailable => 'This week\'s paper could not be built just now. Nothing was charged. Try again shortly.',
        MobFailure.migration => 'Your Mob is not available just now. Try again shortly.',
        MobFailure.unavailable => 'Your Mob did not load. Try again shortly.',
        MobFailure.generic => 'That didn\'t go through. Try again.',
      };
}

String countLabel(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';

const List<String> _weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const List<String> _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/// India time, whatever the phone's zone: "Fri 23 Oct, 9:40 PM".
String formatIstDayTime(DateTime at) {
  final ist = at.toUtc().add(const Duration(hours: 5, minutes: 30));
  final h = ist.hour % 12 == 0 ? 12 : ist.hour % 12;
  final m = ist.minute.toString().padLeft(2, '0');
  final ampm = ist.hour < 12 ? 'AM' : 'PM';
  return '${_weekdays[ist.weekday - 1]} ${ist.day} ${_months[ist.month - 1]}, $h:$m $ampm';
}

/// "12 Oct" from a Monday key (`YYYY-MM-DD`), or empty.
String dayLabel(String key) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(key);
  if (m == null) return '';
  return '${int.parse(m.group(3)!)} ${_months[int.parse(m.group(2)!) - 1]}';
}

/// "Week of 12 Oct".
String weekLabel(String key) => dayLabel(key).isEmpty ? 'This week' : 'Week of ${dayLabel(key)}';
