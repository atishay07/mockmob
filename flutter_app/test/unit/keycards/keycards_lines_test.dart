// How real cards' backs are set out (the device walk of 31 Oct with the published NCERT decks): lists break into
// items, journal entries into debit, credit and narration rows, and the words stay the book's. The rules are the
// website's (`kinds.js`); `display_parity_test.dart` holds them equal over real cards, these are the readable cases.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/keycards/data/keycards_lines.dart';
import 'package:mockmob/features/keycards/data/keycards_models.dart';
import 'package:mockmob/features/keycards/keycards_copy.dart';
import 'package:mockmob/features/review/revise/revise_copy.dart';

void main() {
  KeyCard card(String kind, String back, {String front = 'f', Map<String, Object?>? source}) =>
      KeyCard(id: 'c', kind: kind, front: front, back: back, source: KcSource.parse(source ?? {'kind': 'ncert'}));

  group('backShape', () {
    test('a back without line breaks is one paragraph', () {
      final s = backShape(card('term', 'Efficiency means doing the task correctly and with minimum cost.')) as KcParasBack;
      expect(s.texts, ['Efficiency means doing the task correctly and with minimum cost.']);
    });

    test('a list breaks into items, each with a bullet (Biology, the Human Genome Project)', () {
      const back =
          'Identify all the approximately 20,000-25,000 genes in human DNA\n'
          'Determine the sequences of the 3 billion chemical base pairs that make up human DNA\n'
          'Store this information in databases';
      final p = (backShape(card('list', back)) as KcListBack).paragraphs;
      expect(p.length, 3);
      expect(p.every((x) => x.bullet), isTrue);
      expect(p.first.text, 'Identify all the approximately 20,000-25,000 genes in human DNA');
    });

    test('items the book numbers keep their numbers and take no bullet', () {
      final p = (backShape(card('types', '1. Liquidity Ratios\n2. Solvency Ratios\n3. Activity (or Turnover) Ratios')) as KcListBack).paragraphs;
      expect(p.map((x) => x.bullet), everyElement(isFalse));
      expect(p.map((x) => x.text), ['1. Liquidity Ratios', '2. Solvency Ratios', '3. Activity (or Turnover) Ratios']);
    });

    test("a lead-in line stays bare when the other lines carry the book's own markers", () {
      final p = (backShape(card('list', 'The deductions are:\n(i) drawings;\n(ii) interest on drawings;')) as KcListBack).paragraphs;
      expect(p.map((x) => x.bullet), [false, false, false]);
    });

    test('a formula keeps "= ..." joined to its line and breaks before the "="', () {
      final s =
          backShape(card('formula', 'Trade Receivable Turnover ratio\n= Net Credit Revenue from Operations/Average Trade Receivable')) as KcFormulaBack;
      expect(s.texts, ['Trade Receivable Turnover ratio', '= Net Credit Revenue from Operations/Average Trade Receivable']);
    });

    test('an NCERT back that starts mid-sentence leads with an ellipsis; an English answer never does', () {
      expect((backShape(card('fact', 'his capital account will also be credited')) as KcParasBack).texts, ['…his capital account will also be credited']);
      expect((backShape(card('one_word', 'affect', source: {'kind': 'authored'})) as KcParasBack).texts, ['affect']);
    });
  });

  group("entryRows (the website's)", () {
    const debit = KcEntryRowKind.debit;
    const credit = KcEntryRowKind.credit;
    const narration = KcEntryRowKind.narration;

    test('"Dr." on its own line joins the account above it; its qualifier is a note', () {
      const back =
          'Gaining Partners Capital A/c\nDr. (Individually)\nTo Retiring Partners Capital A/c\n(Share in goodwill of retiring partner adjusted)';
      expect(entryRows(back), [
        KcEntryRow(debit, 'Gaining Partners Capital A/c'),
        KcEntryRow(narration, '(Individually)'),
        KcEntryRow(credit, 'To Retiring Partners Capital A/c'),
        KcEntryRow(narration, '(Share in goodwill of retiring partner adjusted)'),
      ]);
    });

    test('"Dr." at the end of a line, a whole entry on one line, and an amount that goes with its row', () {
      expect(entryRows('Profit and Loss A/c Dr.\nTo Profit and Loss Appropriation A/c'), [
        KcEntryRow(debit, 'Profit and Loss A/c'),
        KcEntryRow(credit, 'To Profit and Loss Appropriation A/c'),
      ]);
      expect(entryRows("Partner's Capital A/c Dr. To Bank A/c"), [KcEntryRow(debit, "Partner's Capital A/c"), KcEntryRow(credit, 'To Bank A/c')]);
      expect(entryRows('Bank A/c\nDr.\n10,00,000\nTo Capital A/c\n10,00,000'), [
        KcEntryRow(debit, 'Bank A/c', amount: '10,00,000'),
        KcEntryRow(credit, 'To Capital A/c', amount: '10,00,000'),
      ]);
    });

    test('prose with no Dr. and no To line is not a journal', () {
      expect(entryRows('So when only year-end figures are available use the same as it is.'), isNull);
      expect(entryRows('no entry is required'), isNull);
    });
  });

  group('the book and the face', () {
    test("Accountancy's books read as the syllabus names them, whatever the deck spelled", () {
      expect(
        sourceLine(KcSource.parse({'kind': 'ncert', 'book': 'Accountancy – Partnership Accounts', 'code': 'leac103', 'chapterNo': 3, 'page': 114})),
        'Accountancy Part 1, Ch 3, p. 114',
      );
      expect(
        sourceLine(KcSource.parse({'kind': 'ncert', 'book': 'Accountancy : Company Accounts', 'code': 'leac205', 'chapterNo': 5, 'page': 194})),
        'Accountancy Part 2, Ch 5, p. 194',
      );
    });

    test('an English card says where its meaning comes from', () {
      expect(sourceLine(KcSource.parse({'kind': 'wordnet', 'synset': '00429355-s', 'word': 'lucid'})), 'Meaning from WordNet');
      expect(sourceLine(KcSource.parse({'kind': 'authored'})), isNull);
      expect(sourceLine(KcSource.parse({'kind': 'ncert', 'book': 'Biology', 'chapterNo': 5, 'page': 88})), 'Biology, Ch 5, p. 88');
      expect(sourceLine(KcSource.parse({'kind': 'ncert'})), isNull);
    });

    test('the kind is said once: the repeated lead leaves the front', () {
      final entry = cardFace(card('entry', '', front: 'Journal entry: Shilpa compensates Neeru.'));
      expect((entry.label, entry.front), ('Journal entry', 'Shilpa compensates Neeru.'));
      final formula = cardFace(card('formula', '', front: 'Formula: current ratio'));
      expect((formula.label, formula.front), ('Formula', 'Current ratio'));
      final rule = cardFace(card('rule', '', front: 'Rule: Subject and verb agree.'));
      expect((rule.label, rule.front), ('Rule', 'Subject and verb agree.'));
      expect(cardFace(card('entry', '', front: 'Treatment: x')).label, 'Entry');
    });

    test('a chapter reference drops what the screen already says; counts read with commas', () {
      expect(chapterRef('Business Studies Part 1', 1), 'Business Studies Part 1, Ch 1');
      expect(chapterRef('Business Studies Part 1', 7, unit: 'Business Studies Part 1'), 'Ch 7');
      expect(chapterRef('Computerised Accounting System', null, title: 'Computerised Accounting System'), isNull);
      expect(KeyCardsCopy.cardsDue(165, 6), '165 cards, 6 due');
      expect(KeyCardsCopy.cardsDue(1, 0), '1 card, 0 due');
    });
  });

  test('Revise says how much of what is due its run holds (Key cards come 20 at a time)', () {
    expect(ReviseCopy.runHeadOf(20, 30, 5), '20 of 30 due today, about 5 minutes.');
    expect(ReviseCopy.runHeadOf(19, 19, 5), '19 due today, about 5 minutes.');
    expect(ReviseCopy.runHeadOf(1, 0, 1), '1 due today, about 1 minute.');
  });
}
