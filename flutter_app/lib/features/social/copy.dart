// Every Mob sentence. Plain, calm, no exclamation marks, no arrows, 12-hour IST times (P13).
// No count of who has not sat, no rank, no pressure (Rule 22, T005), and nothing about money.

import 'data/mob_models.dart';
import 'data/mob_repository.dart';

abstract final class MobCopy {
  static const String title = 'Your Mob';
  static const String startTitle = 'Start a Mob';
  static const String eyebrow = 'Your Mob';
  static const String pitch = 'Sit one paper a week with up to 4 friends.';
  static const List<String> promises = [
    'Same 10 questions for everyone, fresh each week.',
    'You see who sat, never who didn\'t.',
    'Scores stay private unless you choose.',
  ];
  static const String subjectLabel = 'Subject';
  static const String nameLabel = 'Your name in the Mob';
  static const String nameHint = 'First name';
  static const String nameRule = '2 to 18 letters. Only your Mob sees it.';
  static const String colourLabel = 'Your colour';
  static const String startKey = 'Start a Mob';
  static const String haveLink = 'Got a link from a friend? Open it and it brings you here.';
  static const String noSubjects = 'Pick your subjects in You first, then start a Mob for one of them.';

  static String ringLine(int sat, int size) => '$sat of $size sat this week';
  static const String closes = 'Closes Sunday 11:59 PM';
  static const String closed = 'This week\'s paper closed. Next one opens Monday.';

  static String sitKey(int count, int minutes) => 'Sit this week\'s paper';
  static String sitNote(int count, int minutes) => '$count questions, about $minutes min. Same paper as your Mob.';
  static const String costIncluded = 'Included with your plan.';
  static const String costAllowance = 'Free today.';
  static const String costConfirm = 'You\'ll see what it uses before it starts.';
  static const String seeAnswers = 'See your answers';
  static const String seeMob = 'See your Mob';
  static const String nudgeKey = 'Ask the others to sit it';
  static const String nudgeSentReason = 'Sent this week. One note a week.';
  static const String nudgeSitFirst = 'Sit it first, then you can ask the others.';
  static String nudgeSent(int to) => to == 0 ? 'Everyone has sat. Nothing to send.' : 'Sent. They\'ll see it on their Mob card.';
  static String nudgeReceived(String from) => '$from sat it and asked you to sit it too.';

  static String trapLine(MobTrap t) => 'Your Mob\'s trap: ${t.count} of ${t.of} picked ${t.option} on question ${t.questionNumber}.';
  static String trapName(MobTrap t) => t.trapName == null ? 'A common wrong pick.' : 'Trap: ${t.trapName}.';
  static const String repairIt = 'Repair it';
  static String seeWhy(String option) => 'See why $option is wrong';
  static const String trapTitle = 'The shared trap';

  static const String membersTitle = 'Members';
  static const String you = 'You';
  static const String sat = 'Sat';
  static const String owner = 'Started it';
  static String memberMenu(String name) => 'Options for $name';
  static const String report = 'Report';
  static const String leaveAndBlock = 'Leave and block';
  static const String removeMember = 'Remove from Mob';

  static String inviteRow(int seats) => seats == 1 ? 'Invite a friend (1 seat left)' : 'Invite a friend ($seats seats left)';
  static const String full = 'Your Mob is full: 5 of 5.';
  static const String inviteTitle = 'Invite a friend';
  static const String inviteBody = 'Send this link. Only people with it can join, and it never shows your name.';
  static String inviteUntil(DateTime at) => 'Link works until ${formatIstDayTime(at)}';
  static const String copy = 'Copy link';
  static const String copied = 'Link copied.';
  static const String share = 'Share';
  static const String newLink = 'Make a new link';
  static const String newLinkNote = 'A new link stops the old one.';
  static const String shareText = 'Sit one 10-question paper a week with me on MockMob:';
  static const String aloneLead = 'Invite a friend to start your ring.';

  static const String settingsTitle = 'Settings';
  static const String showScore = 'Show my score to my Mob';
  static const String showScoreNote = 'Shown as "7 of 10" beside your name. Never sorted.';
  static const String muteNudges = 'Mute nudges';
  static const String changeName = 'Change name or colour';
  static const String leave = 'Leave Mob';
  static const String leaveTitle = 'Leave your Mob?';
  static const String leaveBody = 'Your sittings leave with you.';
  static const String leaveConfirm = 'Leave';
  static const String cancel = 'Cancel';
  static const String save = 'Save';

  static String blockTitle(String name) => 'Leave and block $name?';
  static const String blockBody = 'You leave this Mob, and you two never share a Mob again. They are not told.';
  static String removeTitle(String name) => 'Remove $name?';
  static const String removeBody = 'They leave the Mob and their sittings leave with them.';
  static const String reportTitle = 'Report';
  static const String reportName = 'Their name';
  static const String reportNudge = 'A note they sent';
  static const String reportSafety = 'I feel unsafe';
  static const String reportAlsoLeave = 'Also leave and block';
  static const String reportSend = 'Send report';
  static const String reported = 'Reported. Thank you.';

  static const String loadFailed = 'Your Mob didn\'t load.';
  static const String loadFailedOffline = 'You\'re offline, so your Mob didn\'t load.';
  static const String tryAgain = 'Try again';

  // Join.
  static const String joinTitle = 'You\'re invited to a Mob.';
  static String joinBody(MobInvitePreview p) =>
      'A small group sitting one 10-question ${p.subjectName} paper each week. ${p.size} of $mobMaxSize seats taken.';
  static const String joinNoContacts = 'MockMob never asks for your contacts. You can leave any time.';
  static const String joinKey = 'Join';
  static const String joinCodeLabel = 'Invite link or code';
  static const String joinCodeKey = 'Open invite';
  static const String inviteUnusable = 'This invite can\'t be used. Ask your friend for a new link.';
  static const String alreadyInOne = 'You\'re already in a Mob. Leave it first to join this one.';

  // Today and the hub.
  static const String hubRow = 'Your Mob';
  static const String hubStart = 'Start a Mob';
  static const String hubStartNote = 'One paper a week with friends';
  static String mobiComplete(int size) => 'Your Mob sat it, all $size.';

  static String failure(MobFailure f) => switch (f) {
        MobFailure.offline => 'You\'re offline. Nothing changed.',
        MobFailure.alreadyInMob => alreadyInOne,
        MobFailure.nameInvalid => 'That name can\'t be used. Try your first name.',
        MobFailure.subjectInvalid => 'That subject can\'t have a Mob yet.',
        MobFailure.inviteInvalid || MobFailure.inviteExpired => inviteUnusable,
        MobFailure.full => 'This Mob is full.',
        MobFailure.notOwner => 'Only the member who started the Mob can do that.',
        MobFailure.notSat => nudgeSitFirst,
        MobFailure.alreadyNudged => nudgeSentReason,
        MobFailure.weekClosed => closed,
        MobFailure.alreadySat => 'You\'ve sat this week\'s paper.',
        MobFailure.rateLimited => 'Too many tries. Wait a little and try again.',
        MobFailure.generic => 'That didn\'t go through. Try again.',
      };
}

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
