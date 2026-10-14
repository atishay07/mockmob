import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/mobi.dart' show MobiAct;
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/model/finish_reaction.dart';

FinishMarks m(int right, int wrong, int blank) => FinishMarks(correct: right, wrong: wrong, blank: blank, total: right + wrong + blank);

void main() {
  test('the marks follow the website: 7 right, 2 wrong, 1 blank is 33 of 50, 12 of the 17 missed to wrong answers', () {
    final x = m(7, 2, 1);
    expect(x.scored, 33);
    expect(x.max, 50);
    expect(x.missed, 17);
    expect(x.lostToWrong, 12);
    expect(x.leftOnBlanks, 5);
    expect(PracticeCopy.marksLine(x), '33 of 50 marks. 2 wrong answers cost 12 of the 17 marks you missed.');
  });

  test('80% celebrates, a good run cheers, a mixed one points at the first slip, a blank sheet reads, nothing right encourages', () {
    expect(finishToneFor(m(8, 1, 1)), FinishTone.great);
    expect(finishToneFor(m(7, 2, 1)), FinishTone.good);
    expect(finishToneFor(m(5, 4, 1)), FinishTone.mixed);
    expect(finishToneFor(m(2, 1, 7)), FinishTone.blank);
    expect(finishToneFor(m(0, 5, 0)), FinishTone.low);
    expect(FinishTone.great.act, MobiAct.celebrate);
    expect(FinishTone.good.act, MobiAct.cheer);
    expect(FinishTone.mixed.act, MobiAct.point);
    expect(FinishTone.mixed.pointsAtMistake, isTrue);
    expect(FinishTone.low.act, MobiAct.encourage);
  });

  test('better than the last practice in the subject counts as a good run', () {
    expect(finishToneFor(m(5, 4, 1), previousAccuracy: 0.3), FinishTone.good);
    expect(finishToneFor(m(5, 4, 1), previousAccuracy: 0.6), FinishTone.mixed);
  });

  test('Mobi never says anything sad about the student', () {
    for (final tone in FinishTone.values) {
      final line = PracticeCopy.finishLine(tone, m(3, 5, 2)).toLowerCase();
      for (final word in ['bad', 'poor', 'fail', 'sad', 'disappoint', '!']) {
        expect(line.contains(word), isFalse, reason: '$tone: $line');
      }
    }
  });

  test('a negative score uses the minus sign', () {
    expect(PracticeCopy.marksLine(m(0, 3, 0)), '−3 of 15 marks. 3 wrong answers cost 18 of the 18 marks you missed.');
  });
}
