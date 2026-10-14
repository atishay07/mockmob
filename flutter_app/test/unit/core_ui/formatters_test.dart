import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/copy/copy.dart';

void main() {
  group('formatTime12', () {
    test('uses 12-hour time with AM and PM', () {
      expect(formatTime12(DateTime(2026, 10, 12, 23, 42)), '11:42 PM');
      expect(formatTime12(DateTime(2026, 10, 12, 9, 5)), '9:05 AM');
    });

    test('midnight and noon', () {
      expect(formatTime12(DateTime(2026, 10, 12, 0, 0)), '12:00 AM');
      expect(formatTime12(DateTime(2026, 10, 12, 12, 30)), '12:30 PM');
      expect(formatTime12(DateTime(2026, 10, 12, 0, 59)), '12:59 AM');
    });
  });

  group('dates', () {
    test('day and month', () {
      expect(formatDayMonth(DateTime(2026, 10, 12)), '12 October');
      expect(formatDayMonth(DateTime(2027, 1, 3)), '3 January');
    });

    test('weekday, day and month', () {
      expect(formatWeekdayDate(DateTime(2026, 10, 12)), 'Monday, 12 October');
      expect(formatWeekdayDate(DateTime(2026, 10, 18)), 'Sunday, 18 October');
    });

    test('weekday names and initials are Monday first', () {
      expect(weekdayName(DateTime.monday), 'Monday');
      expect(weekdayName(DateTime.sunday), 'Sunday');
      expect(weekdayInitials, ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    });
  });

  group('marks', () {
    test('marks with the denominator', () {
      expect(formatMarks(115, 250), '115 out of 250 marks');
      expect(formatMarks(0, 250), '0 out of 250 marks');
    });

    test('negative marks use the real minus sign', () {
      expect(formatMarks(-3, 250), '−3 out of 250 marks');
      expect(formatSignedNumber(-12), '−12');
      expect(formatSignedNumber(7), '7');
    });
  });

  group('formatDurationAbout', () {
    test('minutes', () {
      expect(formatDurationAbout(const Duration(minutes: 10)), 'about 10 minutes');
      expect(formatDurationAbout(const Duration(minutes: 1)), 'about 1 minute');
      expect(formatDurationAbout(const Duration(seconds: 570)), 'about 10 minutes');
    });

    test('under a minute', () {
      expect(formatDurationAbout(const Duration(seconds: 20)), 'less than a minute');
      expect(formatDurationAbout(Duration.zero), 'less than a minute');
    });

    test('hours', () {
      expect(formatDurationAbout(const Duration(minutes: 60)), 'about 1 hour');
      expect(formatDurationAbout(const Duration(minutes: 120)), 'about 2 hours');
      expect(formatDurationAbout(const Duration(minutes: 80)), 'about 1 hour 20 minutes');
    });
  });

  group('formatTimer', () {
    test('minutes and seconds, then hours', () {
      expect(formatTimer(const Duration(minutes: 47, seconds: 12)), '47:12');
      expect(formatTimer(const Duration(hours: 1, minutes: 2, seconds: 18)), '1:02:18');
      expect(formatTimer(const Duration(seconds: 5)), '0:05');
      expect(formatTimer(const Duration(seconds: -4)), '0:00');
    });
  });

  group('plurals', () {
    test('plural', () {
      expect(plural(1, 'question'), '1 question');
      expect(plural(0, 'question'), '0 questions');
      expect(plural(8, 'question'), '8 questions');
      expect(plural(2, 'person', pluralForm: 'people'), '2 people');
    });

    test('pluralWord', () {
      expect(pluralWord(1, 'answer'), 'answer');
      expect(pluralWord(9, 'answer'), 'answers');
    });

    test('joinWithAnd', () {
      expect(joinWithAnd([]), '');
      expect(joinWithAnd(['Monday']), 'Monday');
      expect(joinWithAnd(['Monday', 'Friday']), 'Monday and Friday');
      expect(joinWithAnd(['Monday', 'Wednesday', 'Friday']), 'Monday, Wednesday and Friday');
    });
  });

  group('state words and receipts', () {
    test('the three words', () {
      expect(StateWords.onThisPhone, 'On this phone');
      expect(StateWords.sending, 'Sending');
      expect(StateWords.savedOnServer, 'Saved on the server');
    });

    test('receipt lines', () {
      final at = DateTime(2026, 10, 12, 23, 42);
      expect(Receipts.mockSaved('Mock 7', at), 'Mock 7 saved on the server at 11:42 PM.');
      expect(Receipts.repairFinished(DateTime(2026, 10, 12, 23, 51)), 'Repair finished. Recorded at 11:51 PM.');
      expect(Receipts.notRecordedYet, 'On this phone. Not recorded yet.');
    });

    test('shared copy has no middle dots, arrows or exclamation marks', () {
      final all = [
        StateWords.onThisPhone,
        StateWords.sending,
        StateWords.savedOnServer,
        Receipts.notRecordedYet,
        Receipts.mockSaved('Mock 7', DateTime(2026, 10, 12, 23, 42)),
        Receipts.repairFinished(DateTime(2026, 10, 12, 23, 51)),
      ];
      for (final text in all) {
        expect(text, isNot(contains('·')));
        expect(text, isNot(contains('!')));
        expect(text, isNot(matches(r'[←-⇿]')));
      }
    });
  });
}
