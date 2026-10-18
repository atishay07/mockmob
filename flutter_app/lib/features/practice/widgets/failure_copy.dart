import '../copy.dart';
import '../data/practice_starter.dart';

/// A start failure with the exact words to show.
class StartFailureView {
  const StartFailureView(this.failure, {this.message});

  final StartFailure failure;

  /// The server's reason, when it gave one.
  final String? message;

  String get text => message ?? switch (failure) {
    StartFailure.offline => PracticeCopy.offlineStart,
    StartFailure.generic => PracticeCopy.startFailed,
    StartFailure.notEnoughQuestions => PracticeCopy.notEnoughQuestions,
    StartFailure.notEnoughCredits => PracticeCopy.notEnoughCredits,
    StartFailure.notIncluded => PracticeCopy.notIncluded,
    StartFailure.rateLimited => PracticeCopy.slowDown,
    StartFailure.ended => PracticeCopy.paperEnded,
  };

  /// A retry is pointless until the student changes something.
  bool get retryable => failure == StartFailure.offline || failure == StartFailure.generic || failure == StartFailure.rateLimited;
}
