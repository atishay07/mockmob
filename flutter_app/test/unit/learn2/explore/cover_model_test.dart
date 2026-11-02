// The words on an Explore cover, case by case (the web's coverModel.test.mjs, ported), with and without the server's newer
// fields. The parity test holds the same functions to the web's own outputs over every recorded cover.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/explore/cover_model.dart';

LearnCover cover(Map<String, dynamic> j) => LearnCover.tryParse({'key': 'accountancy.x', 'title': 'X', ...j})!;

Map<String, dynamic> counts(int cards, int questions, int minutes, {bool capped = false}) => {
  'cards': cards,
  'questions': questions,
  'minutes': minutes,
  if (capped) 'capped': true,
};

void main() {
  test('label: the chapter\'s place, never the NCERT number; none without a place', () {
    expect(CoverModel.refLineOf(cover({'place': {'n': 5, 'of': 14}, 'refLine': 'Part 1, Ch 2', 'ref': 'Ch 2'})), 'Chapter 5');
    expect(CoverModel.refLineOf(cover({'place': {'n': 12}})), 'Chapter 12');
    expect(CoverModel.refLineOf(cover({'place': {'n': 0, 'of': 14}, 'ref': 'Ch 2'})), isNull);
    expect(CoverModel.refLineOf(cover({'refLine': 'Part 1, Ch 2', 'ref': 'Ch 9', 'partTitle': 'Part 1, Partnership Accounts'})), isNull);
    expect(CoverModel.refLineOf(cover({})), isNull);
  });

  test('lead line: For you only from history; book order reads Start here', () {
    expect(CoverModel.leadLine(cover({'forYou': true, 'reason': '3 old mistakes to fix'})), (prefix: 'For you:', text: '3 open mistakes to fix'));
    expect(CoverModel.leadLine(cover({'forYou': true, 'reason': '3 open mistakes to fix'})), (prefix: 'For you:', text: '3 open mistakes to fix'));
    expect(CoverModel.leadLine(cover({'forYou': true, 'reason': 'Pick up where you stopped'})), (prefix: 'For you:', text: 'pick up where you stopped'));
    expect(
      CoverModel.leadLine(cover({'forYou': true, 'reason': 'Next after Goodwill: Nature and Valuation'})),
      (prefix: 'For you:', text: 'next after Goodwill: Nature and Valuation'),
    );
    expect(CoverModel.leadLine(cover({'forYou': true, 'reason': 'Chapter 1 of your book'})), (prefix: 'Start here:', text: 'first in the syllabus'));
    expect(CoverModel.leadLine(cover({'forYou': true, 'reason': 'First in the syllabus'})), (prefix: 'Start here:', text: 'first in the syllabus'));
    expect(
      CoverModel.leadLine(cover({'forYou': true, 'reason': '3 old mistakes to fix'}), history: false),
      (prefix: 'Start here:', text: 'first in the syllabus'),
    );
    expect(CoverModel.leadLine(cover({'forYou': true})), (prefix: 'Start here:', text: 'first in the syllabus'));
    expect(CoverModel.leadLine(cover({'forYou': false, 'reason': 'x'})), isNull);
  });

  test('student line: never a due count; resume, mistakes, state, New to you; nothing without history', () {
    String? line(Map<String, dynamic> j, {bool history = true}) => CoverModel.studentLineOf(cover(j), history: history);
    expect(line({'studentLine': '3 due, 3 old mistakes'}), '3 open mistakes to fix');
    expect(line({'studentLine': '2 open mistakes to fix'}), '2 open mistakes to fix');
    expect(line({'studentLine': '1 old mistake'}), '1 open mistake to fix');
    // The only verdict word is "Needs work" (R2 ruling 2): the others never show on a cover.
    expect(line({'studentLine': '3 due', 'state': {'key': 'holding', 'label': 'Holding'}}), isNull);
    expect(line({'studentLine': '3 due', 'state': {'key': 'needs_work', 'label': 'Needs work'}}), 'Needs work');
    expect(line({'studentLine': '3 due', 'state': {'key': 'none', 'label': 'Not started'}}), 'New to you');
    for (final quiet in ['Getting there', 'Holding', 'Too few answers', 'Fading', 'Thin']) {
      expect(line({'studentLine': quiet}), isNull, reason: quiet);
    }
    expect(line({'studentLine': 'Not started'}), 'New to you');
    expect(line({'studentLine': 'x', 'resume': {'runId': 'lr_1', 'done': 6, 'of': 16, 'minutesLeft': 4}}), 'You stopped at 6 of 16');
    expect(line({'studentLine': 'New to you'}), 'New to you');
    expect(line({'studentLine': 'New to you'}, history: false), isNull);
    expect(line({'studentLine': '', 'mistakes': 3}), '3 open mistakes to fix');
    expect(line({'studentLine': '', 'mistakes': 1}), '1 open mistake to fix');
  });

  test('history: the server flag, else any line that is not New to you', () {
    LearnCovers answer(Map<String, dynamic> j) => LearnCovers.parse(j);
    expect(CoverModel.hasHistory(answer({'history': false, 'covers': [{'key': 'a', 'studentLine': 'Holding'}]})), isFalse);
    expect(CoverModel.hasHistory(answer({'covers': [{'key': 'a', 'studentLine': 'New to you'}, {'key': 'b', 'studentLine': 'New to you'}]})), isFalse);
    expect(CoverModel.hasHistory(answer({'covers': [{'key': 'a', 'studentLine': 'New to you'}, {'key': 'b', 'studentLine': '3 due'}]})), isTrue);
    expect(CoverModel.hasHistory(answer({'history': true, 'covers': []})), isTrue);
  });

  test('mix line and key: the picked length, short chapters, Free, resume and the day limit', () {
    final c = cover({
      'counts': {'5': counts(8, 2, 5), '10': counts(16, 5, 10), '20': counts(16, 0, 4)},
    });
    expect(CoverModel.mixLineOf(c, 10), '16 Key cards, 5 questions');
    expect(CoverModel.mixLineOf(c, 20), '16 Key cards, all it has today');
    expect(CoverModel.mixLineOf(cover({'counts': {'10': counts(0, 8, 10)}}), 10), '8 questions');
    expect(CoverModel.mixLineOf(cover({'counts': {'10': counts(1, 1, 10)}}), 10), '1 Key card, 1 question');
    expect(CoverModel.mixLineOf(cover({'counts': {'10': counts(5, 0, 1)}}), 10, free: true), '5 Key cards');
    expect(CoverModel.mixLineOf(cover({'counts': {'20': counts(5, 7, 9, capped: true)}}), 20), '5 Key cards, 7 questions');
    expect(CoverModel.keyLabelOf(c, 10), 'Play · 10 min');
    expect(CoverModel.keyLabelOf(c, 20), 'Play · 4 min');
    expect(CoverModel.keyLabelOf(cover({'counts': {'10': counts(5, 0, 1)}}), 10), 'Play · 1 min');
    // A first visit says what a feed holds in plain words (phone-clarity 18).
    expect(CoverModel.mixLineOf(c, 10, history: false), 'Cards and questions');
    expect(CoverModel.mixLineOf(cover({'counts': {'10': counts(0, 8, 10)}}), 10, history: false), 'Questions, one at a time');
    expect(CoverModel.mixLineOf(cover({'counts': {'10': counts(5, 0, 10)}}), 10, history: false), 'Cards, one at a time');
    final r = cover({
      'counts': {'5': counts(8, 2, 5), '10': counts(16, 5, 10), '20': counts(16, 0, 4)},
      'resume': {'runId': 'lr_1', 'done': 6, 'of': 16, 'minutesLeft': 4},
    });
    expect(CoverModel.keyLabelOf(r, 20), 'Continue · 4 min');
    // On a resume the key carries the time, so the mix line is empty.
    expect(CoverModel.mixLineOf(r, 5), '');
    expect(CoverModel.keyLabelOf(c, 10, freeDone: true), 'Questions on this chapter');
    // At Free's day limit a cover with a feed to pick up says so (the feed resumes its own run); only the others open questions.
    expect(CoverModel.keyLabelOf(r, 10, freeDone: true), 'Continue · 4 min');
    expect(CoverModel.opensQuestions(r, freeDone: true), isFalse);
    expect(CoverModel.opensQuestions(c, freeDone: true), isTrue);
    expect(CoverModel.opensQuestions(c), isFalse);
    expect(CoverModel.isFreePlan(LearnCovers.parse({'covers': [{'key': 'a', 'counts': {'10': counts(1, 1, 1)}}, {'key': 'b', 'counts': {'20': counts(5, 0, 2, capped: true)}}]})), isTrue);
    expect(CoverModel.isFreePlan(LearnCovers.parse({'covers': [{'key': 'a', 'counts': {'20': counts(1, 1, 1)}}]})), isFalse);
  });

  test('counts say a figure the Indian way, one minute and one question in the singular', () {
    final big = cover({'counts': {'10': counts(1234, 56789, 10), '20': counts(123456, 1, 20)}});
    expect(CoverModel.mixLineOf(big, 10), '1,234 Key cards, 56,789 questions');
    expect(CoverModel.mixLineOf(big, 20), '1,23,456 Key cards, 1 question');
    expect(CoverModel.grouped(14), '14');
    expect(CoverModel.grouped(1234), '1,234');
    expect(CoverModel.grouped(12345678), '1,23,45,678');
    expect(CoverModel.chaptersText(1), '1 chapter');
    expect(CoverModel.chaptersText(14), '14 chapters');
    // A feed with a minute left reads "1 minute", never "0 minutes".
    final one = cover({'resume': {'runId': 'lr_1', 'done': 6, 'of': 16, 'minutesLeft': 0}});
    expect(CoverModel.keyLabelOf(one, 10), 'Continue · 1 min');
    expect(CoverModel.mixLineOf(one, 10), '');
    // A fraction rounds up, as the web's wholeMinutes does.
    final half = cover({'resume': {'runId': 'lr_1', 'done': 1, 'of': 4, 'minutesLeft': 3.5}});
    expect(CoverModel.keyLabelOf(half, 10), 'Continue · 4 min');
    expect(CoverModel.keyLabelOf(cover({'resume': {'runId': 'lr_1', 'done': 1, 'of': 4, 'minutesLeft': 2.4}}), 10), 'Continue · 3 min');
  });

  test('media: the opening card, a locked card never prints null, a questions-only chapter', () {
    expect(CoverModel.mediaOf(cover({'hook': {'front': 'What is goodwill?'}}), 10), const CoverMediaCard('What is goodwill?'));
    expect(CoverModel.mediaOf(cover({'hook': {'front': null, 'kind': 'definition', 'locked': true}}), 10), const CoverMediaLocked('Definition'));
    expect(
      CoverModel.mediaOf(cover({'hook': null, 'counts': {'10': counts(0, 8, 10)}}), 10),
      const CoverMediaQuestions(text: '8 questions', note: 'No Key cards here yet.'),
    );
    // A chapter that still has cards (kept or due, so none is served in a feed) says where they are, not that it has none.
    expect(
      CoverModel.mediaOf(cover({'hook': null, 'due': 6, 'kept': 6, 'counts': {'10': counts(0, 4, 10)}}), 10),
      const CoverMediaQuestions(text: '4 questions', note: 'Your cards here are in Revise.'),
    );
    expect((CoverModel.mediaOf(cover({'hook': null, 'kept': 2, 'counts': {'10': counts(0, 4, 10)}}), 10) as CoverMediaQuestions).note, 'Your cards here are in Revise.');
    expect(CoverModel.mediaOf(cover({'hook': null}), 10), const CoverMediaQuestions(text: 'Questions', note: 'No Key cards here yet.'));
    expect(CoverModel.hookTier('What is goodwill?'), 's');
    expect(CoverModel.hookTier('What is reconstitution of a partnership firm?'), 'm');
    expect(CoverModel.hookTier('Sum due to a retiring/deceased partner includes: name items (i) to (v).'), 'l');
    expect(CoverModel.hookTier('Define the dissolution of the firm (Section 39 of the Partnership Act 1932) as a whole.'), 'xl');
    expect(CoverModel.hookTier('Which Article requires the government to present its estimated receipts and expenditures to Parliament every year?'), 'xxl');
  });

  test('a cover never leads with a cloze or a long front: the first readable hook, else what the feed holds', () {
    // The first of the length's hooks (feed order) that is short and not a fill-in-the-blank wins over the cover's own hook.
    final withHooks = cover({
      'hook': {'front': 'Fill ____'},
      'counts': {
        '10': {
          ...counts(10, 2, 10),
          'hooks': [
            {'front': 'Cloze [...]'},
            {'front': 'Define partnership.'},
            {'front': 'Later'},
          ],
        },
      },
    });
    expect(CoverModel.mediaOf(withHooks, 10), const CoverMediaCard('Define partnership.'));
    // The cover's own top-level hooks serve a length that sends none.
    expect(
      CoverModel.mediaOf(cover({'hook': {'front': 'Fill ____'}, 'hooks': [{'front': 'Fill ___'}, {'front': 'What is goodwill?'}], 'counts': {'10': counts(10, 2, 10)}}), 10),
      const CoverMediaCard('What is goodwill?'),
    );
    // Only a cloze or a long card is left: the cover says what the feed holds instead of an unfinished sentence.
    expect(CoverModel.mediaOf(cover({'hook': {'front': 'Fill the ____ in.'}, 'counts': {'10': counts(10, 2, 10)}}), 10), const CoverMediaCards(text: '10 Key cards', note: 'and 2 questions'));
    expect(CoverModel.mediaOf(cover({'hook': {'front': 'x' * 106}, 'counts': {'10': counts(5, 0, 10)}}), 10), const CoverMediaCards(text: '5 Key cards', note: 'one at a time'));
    expect(CoverModel.mediaOf(cover({'hook': {'front': 'x' * 105}, 'counts': {'10': counts(5, 0, 10)}}), 10), CoverMediaCard('x' * 105));
    expect(CoverModel.isCloze('Fill the ____ in.'), isTrue);
    expect(CoverModel.isCloze('A [ … ] is missing'), isTrue);
    expect(CoverModel.isCloze('Dashes ---- here'), isTrue);
    expect(CoverModel.isCloze('A well-known rule: 1-2-3.'), isFalse);
    expect(CoverModel.isReadableHook('  '), isFalse);
    expect(CoverModel.isReadableHook(null), isFalse);
    expect(CoverModel.isReadableHook('What is goodwill?'), isTrue);
  });

  test('kind labels: the card kinds, whatever the case, and "Key card" for one nobody knows', () {
    expect(CoverModel.kindLabel('definition'), 'Definition');
    expect(CoverModel.kindLabel('KEY_LINE'), 'Key line');
    expect(CoverModel.kindLabel('one_word'), 'One word');
    expect(CoverModel.kindLabel('weird'), 'Key card');
    expect(CoverModel.kindLabel(''), 'Key card');
    expect(CoverModel.kindLabel(null), 'Key card');
  });

  test('chapter names: the server name, else the syllabus chapter matching the key or title', () {
    const names = ['Partnership Fundamentals', 'Admission of Partner', 'Profit & Loss Appropriation Account'];
    expect(CoverModel.chapterNameOf(cover({'name': 'Goodwill'}), names), 'Goodwill');
    expect(CoverModel.chapterNameOf(cover({'key': 'accountancy.admission-of-partner', 'title': 'Admission of a Partner'}), names), 'Admission of Partner');
    expect(
      CoverModel.chapterNameOf(cover({'key': 'accountancy.profit-and-loss-appropriation-account', 'title': 'Profit and Loss Appropriation Account'}), names),
      'Profit & Loss Appropriation Account',
    );
    expect(CoverModel.chapterNameOf(cover({'key': 'accountancy.none', 'title': 'None'}), names), isNull);
    expect(CoverModel.slugOf('accountancy.partnership-fundamentals'), 'partnership-fundamentals');
  });

  test('the lengths the control offers are 5, 10 and 20, and 10 is the default', () {
    expect(CoverModel.lengths, [5, 10, 20]);
    expect(CoverModel.defaultLength, 10);
  });
}
