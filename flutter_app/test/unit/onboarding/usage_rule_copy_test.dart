// D183 (owner, 20 Oct 2026): usage data is on for 18 or older and for "Rather not say", and off only when the
// student says they are under 18; anyone can turn it off in You. Every line in the app that states the rule says
// it that way. Before, "Rather not say" was treated like under 18, and no line may say that any more.

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/consent.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/you/copy.dart';

void main() {
  test('the note under the age question: on unless they say under 18, and where to turn it off', () {
    final note = OnboardingCopy.ageNote;
    expect(note, contains('on unless you say'));
    expect(note, contains('under 18'));
    expect(note, contains('off any time in You'));
    expect(note.toLowerCase(), isNot(contains('stays off')), reason: 'that was the rule before D183');
    expect(note.toLowerCase(), isNot(contains('tracking')), reason: 'the app calls it usage data');
  });

  test('the save step says the same rule in one short line (D185): on unless they say under 18', () {
    final note = OnboardingCopy.ageNoteShort;
    expect(note, contains('on unless you say'));
    expect(note, contains('under 18'));
    expect(note.toLowerCase(), isNot(contains('stays off')));
    expect(note.toLowerCase(), isNot(contains('tracking')));
    expect(note.length, lessThanOrEqualTo(42), reason: 'one caption line at 360 dp, at 1x and at 1.3x text');
  });

  test('the You page says off only for under 18 (stated), and for an age not answered yet', () {
    expect(YouCopy.offForAccountNote, contains('under 18'));
    expect(YouCopy.offForAccountNote, contains('you said'), reason: 'we go by what the student said');
    expect(YouCopy.offUnansweredNote, contains('until you answer'));
    for (final line in [YouCopy.offForAccountNote, YouCopy.offUnansweredNote]) {
      expect(line.toLowerCase(), isNot(contains('prefer not')));
      expect(line.toLowerCase(), isNot(contains('rather not')));
    }
  });

  test('the answers: only "Not yet" turns it off, and only "Not yet" never sees the switch', () {
    expect(AgeAnswer.adult.band, AgeBand.adult);
    expect(AgeAnswer.ratherNot.band, AgeBand.unknown, reason: 'not treated like under 18');
    expect(AgeAnswer.minor.band, AgeBand.minor);
    expect([for (final a in AgeAnswer.values) a.usageSwitch], [true, false, true]);
  });
}
