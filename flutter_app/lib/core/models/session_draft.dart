import 'json_helpers.dart';
import 'session.dart';

/// Everything a restart needs to put the student back in the same mock or practice session.
/// Answers are not stored here: the answer journal is the source of truth for them.
class SessionDraft {
  const SessionDraft({
    required this.draftKey,
    required this.userId,
    required this.view,
    required this.generationKey,
    required this.subject,
    required this.mode,
    required this.count,
    required this.startedRefWallMs,
    required this.endsAtWallMs,
    this.chapter,
    this.difficulty,
    this.mockNumber,
    this.visited = const {},
    this.marked = const {},
    this.currentIndex = 0,
    this.pendingSubmission = false,
    this.acknowledgedSequence = 0,
    this.lastAckAtMs,
    this.windowClosed = false,
    this.rejected = false,
    this.updatedAtMs = 0,
  });

  factory SessionDraft.fromJson(Json j) => SessionDraft(
        draftKey: asStringOr(j['draftKey'], ''),
        userId: asStringOr(j['userId'], ''),
        view: SessionView.fromJson(asJson(j['view'])),
        generationKey: asStringOr(j['generationKey'], ''),
        subject: asStringOr(j['subject'], ''),
        mode: asStringOr(j['mode'], 'quick'),
        count: asInt(j['count']) ?? 0,
        startedRefWallMs: asInt(j['startedRefWallMs']) ?? 0,
        endsAtWallMs: asInt(j['endsAtWallMs']) ?? 0,
        chapter: asString(j['chapter']),
        difficulty: asString(j['difficulty']),
        mockNumber: asInt(j['mockNumber']),
        visited: asStringList(j['visited']).toSet(),
        marked: asStringList(j['marked']).toSet(),
        currentIndex: asInt(j['currentIndex']) ?? 0,
        pendingSubmission: asBool(j['pendingSubmission']) ?? false,
        acknowledgedSequence: asInt(j['acknowledgedSequence']) ?? 0,
        lastAckAtMs: asInt(j['lastAckAtMs']),
        windowClosed: asBool(j['windowClosed']) ?? false,
        rejected: asBool(j['rejected']) ?? false,
        updatedAtMs: asInt(j['updatedAtMs']) ?? 0,
      );

  /// `mm:test:<userId>:<subject>:<chapter|*>:<count>:<difficulty|auto>:<mode>` as the web builds it.
  static String keyFor({
    required String userId,
    required String subject,
    String? chapter,
    required int count,
    String? difficulty,
    required String mode,
  }) =>
      'mm:test:$userId:$subject:${chapter == null || chapter.isEmpty ? '*' : chapter}:$count:${difficulty == null || difficulty.isEmpty ? 'auto' : difficulty}:$mode';

  final String draftKey;
  final String userId;

  /// Questions and meta (including `sessionTicket` in ticket mode).
  final SessionView view;
  final String generationKey;

  /// Public subject id the session was started with.
  final String subject;
  final String mode;
  final int count;
  final String? chapter;
  final String? difficulty;

  /// "Mock 7": set at start for full and NTA-style mocks.
  final int? mockNumber;

  /// Device wall-clock estimate of when the session started (server start corrected for the
  /// phone's offset). Used to re-anchor the clock after a process kill.
  final int startedRefWallMs;

  /// Device wall-clock deadline (`expiresAt`), used to decide if the draft can still resume.
  final int endsAtWallMs;
  final Set<String> visited;

  /// Marked for review. Local only.
  final Set<String> marked;
  final int currentIndex;

  /// The submit did not reach the server yet; retry until `endsAt + 120 s`.
  final bool pendingSubmission;

  /// Highest event `seq` the server confirmed.
  final int acknowledgedSequence;

  /// When the last acknowledgement arrived (device wall clock), for "Saved on the server at 10:03 PM".
  final int? lastAckAtMs;

  /// The server said the submission window ended and no attempt exists.
  final bool windowClosed;

  /// The server refused the submit for a reason retrying cannot fix. The answers stay on the
  /// phone, nothing is pending, and the draft can be dismissed.
  final bool rejected;
  final int updatedAtMs;

  String get sessionId => view.meta.sessionId.isNotEmpty ? view.meta.sessionId : view.id;
  bool get isTicketMode => view.isTicketMode;
  bool get isMock => mode == 'full' || mode == 'nta';

  SessionDraft copyWith({
    Set<String>? visited,
    Set<String>? marked,
    int? currentIndex,
    bool? pendingSubmission,
    int? acknowledgedSequence,
    int? lastAckAtMs,
    bool? windowClosed,
    bool? rejected,
    int? startedRefWallMs,
    int? endsAtWallMs,
    SessionView? view,
  }) =>
      SessionDraft(
        draftKey: draftKey,
        userId: userId,
        view: view ?? this.view,
        generationKey: generationKey,
        subject: subject,
        mode: mode,
        count: count,
        chapter: chapter,
        difficulty: difficulty,
        mockNumber: mockNumber,
        startedRefWallMs: startedRefWallMs ?? this.startedRefWallMs,
        endsAtWallMs: endsAtWallMs ?? this.endsAtWallMs,
        visited: visited ?? this.visited,
        marked: marked ?? this.marked,
        currentIndex: currentIndex ?? this.currentIndex,
        pendingSubmission: pendingSubmission ?? this.pendingSubmission,
        acknowledgedSequence: acknowledgedSequence ?? this.acknowledgedSequence,
        lastAckAtMs: lastAckAtMs ?? this.lastAckAtMs,
        windowClosed: windowClosed ?? this.windowClosed,
        rejected: rejected ?? this.rejected,
        updatedAtMs: updatedAtMs,
      );

  Json toJson() => {
        'draftKey': draftKey,
        'userId': userId,
        'view': view.toJson(),
        'generationKey': generationKey,
        'subject': subject,
        'mode': mode,
        'count': count,
        'chapter': chapter,
        'difficulty': difficulty,
        'mockNumber': mockNumber,
        'startedRefWallMs': startedRefWallMs,
        'endsAtWallMs': endsAtWallMs,
        'visited': visited.toList(),
        'marked': marked.toList(),
        'currentIndex': currentIndex,
        'pendingSubmission': pendingSubmission,
        'acknowledgedSequence': acknowledgedSequence,
        'lastAckAtMs': lastAckAtMs,
        'windowClosed': windowClosed,
        'rejected': rejected,
        'updatedAtMs': updatedAtMs,
      };
}
