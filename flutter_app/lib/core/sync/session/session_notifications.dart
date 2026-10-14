import '../../models/session_draft.dart';
import '../../notifications/notification_channels.dart';
import '../../notifications/notification_ids.dart';
import '../../notifications/notification_planner.dart';
import '../../notifications/notification_service.dart';
import 'session_engine.dart';

String _label(SessionDraft draft) => draft.isMock && draft.mockNumber != null ? 'Mock ${draft.mockNumber}' : 'Practice';

/// The ongoing status while a mock is open and the app is in the background: only "in
/// progress", then "sending" while a submit is pending. Silent, no actions.
class NotificationSessionStatusNotifier implements SessionStatusNotifier {
  NotificationSessionStatusNotifier(this._service);

  final NotificationService _service;

  @override
  Future<void> showInProgress(SessionDraft draft) => _service.showOngoing(
        taskId: mockInProgressTaskId,
        channel: NotificationChannels.mockInProgress,
        title: '${_label(draft)} in progress',
        body: 'Open MockMob to continue.',
        payload: '/run/${draft.sessionId}',
      );

  @override
  Future<void> showSending(SessionDraft draft) => _service.showOngoing(
        taskId: mockInProgressTaskId,
        channel: NotificationChannels.mockInProgress,
        title: 'Sending ${_label(draft).toLowerCase() == 'practice' ? 'practice' : _label(draft)}',
        body: 'Your answers are on this phone and are being sent.',
        payload: '/run/${draft.sessionId}',
      );

  @override
  Future<void> clear() => _service.cancel(mockInProgressTaskId);
}

/// Posts "Mock 7 was received. Your result is ready." for a submit that was acknowledged later
/// in the background. In the foreground nothing is announced: the sealed sheet is already
/// there. It is a response to the student's own submit, so quiet hours make it silent rather
/// than deferring it.
Future<void> postResultReady(NotificationService service, {required SessionDraft draft, required String attemptId}) async {
  final body = draft.isMock && draft.mockNumber != null
      ? 'Mock ${draft.mockNumber} was received. Your result is ready.'
      : 'Your practice was received. Your result is ready.';
  await service.cancel(mockInProgressTaskId);
  await service.schedule(NotificationRequest(
    taskId: 'result_ready:$attemptId',
    channel: NotificationChannels.resultsReady,
    title: 'Result ready',
    body: body,
    payload: '/result/$attemptId/sealed',
    respondsToStudentAction: true,
  ));
}

/// How a background submit ended without the server recording it.
enum UnrecordedEnd {
  /// The server's time to accept it ended first.
  windowClosed,

  /// The server refused it for a reason a retry cannot fix.
  rejected,

  /// It never reached the server and the time to send it has ended.
  notSent,
}

/// Replaces the pinned "Sending" status once the backup job stops trying, so it never claims
/// answers are being sent when they are not. The replacement can be swiped away.
Future<void> postSendEnded(NotificationService service, {required SessionDraft draft, required UnrecordedEnd end}) {
  final label = _label(draft);
  final (title, body) = switch (end) {
    UnrecordedEnd.windowClosed => ('$label not recorded', 'The time to send it ended before it reached MockMob.'),
    UnrecordedEnd.rejected => ('$label not recorded', 'MockMob could not accept these answers.'),
    UnrecordedEnd.notSent => ('$label not sent', 'Your answers are still on this phone. The time to send them has ended.'),
  };
  return service.settleOngoing(taskId: mockInProgressTaskId, channel: NotificationChannels.mockInProgress, title: title, body: body);
}
