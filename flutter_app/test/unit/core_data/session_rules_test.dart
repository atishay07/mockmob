import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/domain.dart';
import 'package:mockmob/core/models/session.dart';
import 'package:mockmob/core/models/session_draft.dart';
import 'package:mockmob/core/sync/session/save_state.dart';
import 'package:mockmob/core/sync/session/session_syncer.dart';

import 'support/fixtures.dart';

void main() {
  const now = 10000000;

  group('resumableDraft (ported from data/session_draft.js)', () {
    test('resumes while the deadline is in the future and the session id matches', () {
      final draft = draftOf(endsAtWallMs: now + 1000);
      expect(resumableDraft(draft, sessionId: 'sess-1', nowMs: now), isTrue);
    });

    test('matches by generation key when no session id is given', () {
      final draft = draftOf(endsAtWallMs: now + 1000, generationKey: 'gen-9');
      expect(resumableDraft(draft, generationKey: 'gen-9', nowMs: now), isTrue);
      expect(resumableDraft(draft, generationKey: 'other', nowMs: now), isFalse);
    });

    test('a different session id never resumes', () {
      final draft = draftOf(endsAtWallMs: now + 1000);
      expect(resumableDraft(draft, sessionId: 'sess-2', nowMs: now), isFalse);
    });

    test('an ended draft does not resume unless a submit is pending', () {
      final ended = draftOf(endsAtWallMs: now - 1000);
      expect(resumableDraft(ended, sessionId: 'sess-1', nowMs: now), isFalse);
      final pending = draftOf(endsAtWallMs: now - 1000, pending: true);
      expect(resumableDraft(pending, sessionId: 'sess-1', nowMs: now), isTrue);
    });

    test('a pending submit resumes through the 120 second window and not after it', () {
      final pending = draftOf(endsAtWallMs: now - 119999, pending: true);
      expect(resumableDraft(pending, sessionId: 'sess-1', nowMs: now), isTrue);
      final late = draftOf(endsAtWallMs: now - 120001, pending: true);
      expect(resumableDraft(late, sessionId: 'sess-1', nowMs: now), isFalse);
    });

    test('needs one to fifty questions and a finite deadline', () {
      expect(resumableDraft(draftOf(endsAtWallMs: now + 1, count: 0), sessionId: 'sess-1', nowMs: now), isFalse);
      expect(resumableDraft(draftOf(endsAtWallMs: now + 1, count: 51), sessionId: 'sess-1', nowMs: now), isFalse);
      expect(resumableDraft(draftOf(endsAtWallMs: now + 1, count: 50), sessionId: 'sess-1', nowMs: now), isTrue);
      expect(resumableDraft(draftOf(endsAtWallMs: 0), sessionId: 'sess-1', nowMs: now), isFalse);
    });

    test('null draft and an empty session id never resume', () {
      expect(resumableDraft(null, sessionId: 'sess-1', nowMs: now), isFalse);
      final json = draftOf(endsAtWallMs: now + 1000).toJson();
      (json['view'] as Map<String, dynamic>)['meta'] = {'sessionId': ''};
      final noId = SessionDraft.fromJson(json);
      expect(resumableDraft(noId, generationKey: 'gen-1', nowMs: now), isFalse);
    });

    test('a draft survives a round trip through json', () {
      final draft = draftOf(endsAtWallMs: now + 1000, ticket: 'p2.abc.def.ghi', mockNumber: 4);
      final copy = SessionDraft.fromJson(draft.toJson());
      expect(copy.sessionId, 'sess-1');
      expect(copy.isTicketMode, isTrue);
      expect(copy.view.meta.sessionTicket, 'p2.abc.def.ghi');
      expect(copy.view.questions.length, 3);
      expect(copy.mockNumber, 4);
      expect(copy.endsAtWallMs, now + 1000);
    });
  });

  group('submission window', () {
    test('open until endsAt plus 120 seconds', () {
      expect(submissionWindowOpen(endsAtMs: 1000, nowMs: 121000), isTrue);
      expect(submissionWindowOpen(endsAtMs: 1000, nowMs: 121001), isFalse);
    });
  });

  group('ended mock outcome (the three Today copies)', () {
    test('recorded when the attempt exists on the server', () {
      expect(endedMockOutcome(attemptExistsOnServer: true, endsAtMs: 1000, nowMs: 999999), EndedMockOutcome.recorded);
    });

    test('being sent when no attempt yet and the window is open', () {
      expect(endedMockOutcome(attemptExistsOnServer: false, endsAtMs: 1000, nowMs: 60000), EndedMockOutcome.beingSent);
    });

    test('window closed when no attempt and the window has passed', () {
      expect(endedMockOutcome(attemptExistsOnServer: false, endsAtMs: 1000, nowMs: 130000), EndedMockOutcome.windowClosed);
    });

    test('asks the server first when it has not been asked', () {
      expect(endedMockOutcome(attemptExistsOnServer: null, endsAtMs: 1000, nowMs: 130000), EndedMockOutcome.needsCheck);
    });
  });

  group('save state (three states)', () {
    test('saved only when every answer is acknowledged', () {
      final s = deriveSaveState(ticketMode: false, unsyncedAnswers: 0, syncStatus: SyncStatus.idle);
      expect(s.state, SaveState.saved);
    });

    test('saving while answers are on their way', () {
      final s = deriveSaveState(ticketMode: false, unsyncedAnswers: 2, syncStatus: SyncStatus.sending);
      expect(s.state, SaveState.saving);
      expect(s.unsyncedAnswers, 2);
    });

    test('waiting for the network when sending fails', () {
      final s = deriveSaveState(ticketMode: false, unsyncedAnswers: 3, syncStatus: SyncStatus.failing);
      expect(s.state, SaveState.waitingForNetwork);
      expect(s.unsyncedAnswers, 3);
    });

    test('ticket mode is always on this phone, never saved', () {
      final none = deriveSaveState(ticketMode: true, unsyncedAnswers: 0, syncStatus: SyncStatus.idle);
      final some = deriveSaveState(ticketMode: true, unsyncedAnswers: 5, syncStatus: SyncStatus.idle);
      expect(none.state, SaveState.onThisPhone);
      expect(some.state, SaveState.onThisPhone);
    });
  });

  test('event json key order is fixed', () {
    const e = SessionEvent(seq: 3, qid: 'q1', type: 'answer', at: 120, answer: 2);
    expect(e.toJson().keys.toList(), ['seq', 'qid', 'type', 'at', 'answer']);
  });
}
