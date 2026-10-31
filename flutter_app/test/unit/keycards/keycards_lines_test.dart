// How real cards' backs are set out (the device walk of 31 Oct with the published NCERT decks): lists break into
// items, journal entries into debit, credit and narration rows, and the words stay the book's. Every input here
// is a published card's back, copied exactly.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/keycards/data/keycards_lines.dart';
import 'package:mockmob/features/keycards/data/keycards_models.dart';
import 'package:mockmob/features/keycards/keycards_copy.dart';
import 'package:mockmob/features/review/revise/revise_copy.dart';

void main() {
  group('backParagraphs', () {
    test('a back without line breaks is one paragraph', () {
      expect(backParagraphs('Efficiency means doing the task correctly and with minimum cost.', 'term'), [
        (text: 'Efficiency means doing the task correctly and with minimum cost.', bullet: false),
      ]);
    });

    test('a list breaks into items, each with a bullet (Biology, the Human Genome Project)', () {
      const back =
          'Identify all the approximately 20,000-25,000 genes in human DNA\n'
          'Determine the sequences of the 3 billion chemical base pairs that make up human DNA\n'
          'Store this information in databases';
      final p = backParagraphs(back, 'list');
      expect(p.length, 3);
      expect(p.every((x) => x.bullet), isTrue);
      expect(p.first.text, 'Identify all the approximately 20,000-25,000 genes in human DNA');
    });

    test('items the book numbers keep their numbers and take no bullet', () {
      final p = backParagraphs('1. Liquidity Ratios\n2. Solvency Ratios\n3. Activity (or Turnover) Ratios\n4. Profitability Ratios', 'types');
      expect(p.map((x) => x.bullet), everyElement(isFalse));
      expect(p.map((x) => x.text), ['1. Liquidity Ratios', '2. Solvency Ratios', '3. Activity (or Turnover) Ratios', '4. Profitability Ratios']);
      expect(backParagraphs('(i) over a number of periods\n(ii) with other enterprises', 'list').map((x) => x.bullet), everyElement(isFalse));
      expect(backParagraphs('Step 1 : List out absolute figures.\nStep 2 : Find out change.', 'steps').map((x) => x.bullet), everyElement(isFalse));
    });

    test('a line that introduces the items takes no bullet', () {
      final p = backParagraphs('The objectives are:\nTo know the liquidity\nTo know the solvency', 'list');
      expect(p.map((x) => x.bullet), [false, true, true]);
    });

    test('a fact or a formula over two lines is two paragraphs without bullets', () {
      expect(backParagraphs('2:1\nNormally, it is safe to have this ratio within the range of 2:1.', 'fact').map((x) => x.bullet), [false, false]);
      expect(
        backParagraphs('Trade Receivable Turnover ratio\n= Net Credit Revenue from Operations/Average Trade Receivable', 'formula').map((x) => x.text),
        ['Trade Receivable Turnover ratio', '= Net Credit Revenue from Operations/Average Trade Receivable'],
      );
    });
  });

  group('journalRows', () {
    const debit = KcEntryRowKind.debit;
    const credit = KcEntryRowKind.credit;
    const narration = KcEntryRowKind.narration;

    test('"Dr." on its own line joins the account above it, with its qualifier', () {
      const back = 'Gaining Partners Capital A/c\nDr. (Individually)\nTo Retiring Partners Capital A/c\n(Share in goodwill of retiring partner adjusted)';
      expect(journalRows(back), const [
        KcEntryRow(debit, 'Gaining Partners Capital A/c', aside: '(Individually)'),
        KcEntryRow(credit, 'To Retiring Partners Capital A/c'),
        KcEntryRow(narration, '(Share in goodwill of retiring partner adjusted)'),
      ]);
    });

    test('a narration the book breaks over lines is joined; several credits stay in order', () {
      const back =
          "Shilpa's Capital A/c\nDr.\nTo Neeru's Capital A/c\nTo Deepa's Capital A/c\n(Shilpa compensated Neeru for her share of\ngoodwill and to Deepa for the sacrifice made\nby her on Neeru's retirement)";
      expect(journalRows(back), const [
        KcEntryRow(debit, "Shilpa's Capital A/c"),
        KcEntryRow(credit, "To Neeru's Capital A/c"),
        KcEntryRow(credit, "To Deepa's Capital A/c"),
        KcEntryRow(narration, "(Shilpa compensated Neeru for her share of goodwill and to Deepa for the sacrifice made by her on Neeru's retirement)"),
      ]);
    });

    test('"Dr." at the end of a line, and a whole entry on one line', () {
      expect(journalRows('Profit and Loss A/c Dr.\nTo Profit and Loss Appropriation A/c'), const [
        KcEntryRow(debit, 'Profit and Loss A/c'),
        KcEntryRow(credit, 'To Profit and Loss Appropriation A/c'),
      ]);
      expect(journalRows("Partner's Capital A/c Dr. To Bank A/c"), const [
        KcEntryRow(debit, "Partner's Capital A/c"),
        KcEntryRow(credit, 'To Bank A/c'),
      ]);
    });

    test('a labelled entry keeps its label on the debit, and two debits stay two', () {
      expect(journalRows('(b) Debenture Application & Allotment A/c\nDr.\nTo Debentures A/c\nTo Securities Premium Reserve A/c\n(Allotment of debentures at a premium)'), const [
        KcEntryRow(debit, '(b) Debenture Application & Allotment A/c'),
        KcEntryRow(credit, 'To Debentures A/c'),
        KcEntryRow(credit, 'To Securities Premium Reserve A/c'),
        KcEntryRow(narration, '(Allotment of debentures at a premium)'),
      ]);
      final rows = journalRows("P's Capital A/c\nDr.\nQ's Capital A/c\nDr.\nTo R's Capital A/c")!;
      expect(rows.where((r) => r.kind == debit).map((r) => r.text), ["P's Capital A/c", "Q's Capital A/c"]);
    });

    test('a narration closed with a full stop does not swallow the next entry', () {
      final rows = journalRows(
        "Bank A/c\nDr.\nTo New Partner's Capital A/c\n(Amount brought by new partner for his share of goodwill).\nNew Partner's Capital A/c\nDr.\nTo Sacrificing Partner's Capital A/c's (Individually)",
      )!;
      expect(rows.map((r) => r.kind), [debit, credit, narration, debit, credit]);
    });

    test('a treatment written as prose, or an entry without a debit, is not a journal', () {
      expect(journalRows('So when only year-end figures are available use the same as it is.'), isNull);
      expect(journalRows('no entry is required'), isNull);
      expect(journalRows('Gaining Partners Capital A/c [In gaining ratio]\nTo Profit and Loss Suspense A/c\n(P&L Suspense account transferred).'), isNull);
    });
  });

  group('references (no middle-dot strings, as on the website)', () {
    test('a book reference and a chapter row read with commas', () {
      expect(KeyCardsCopy.reference('Business Studies Part 1', 1, 3), 'Business Studies Part 1, Ch 1, p. 3');
      expect(KeyCardsCopy.ncertChapter('Business Studies Part 1', 1), 'Business Studies Part 1, Ch 1');
      expect(KeyCardsCopy.cardsDue(165, 6), '165 cards, 6 due');
      expect(KeyCardsCopy.cardsDue(1, 0), '1 card, 0 due');
    });

    test('an English card says where its meaning comes from', () {
      expect(KcSource.parse({'kind': 'wordnet', 'synset': '00429355-s', 'word': 'lucid'}).reference, 'Meaning from WordNet');
      expect(KcSource.parse({'kind': 'authored'}).reference, 'Written for the MockMob English deck');
      expect(KcSource.parse({'kind': 'ncert', 'book': 'Biology', 'chapterNo': 5, 'page': 88}).reference, 'Biology, Ch 5, p. 88');
      expect(KcSource.parse({'kind': 'ncert'}).reference, isNull);
    });
  });

  test('Revise says how much of what is due its run holds (Key cards come 20 at a time)', () {
    expect(ReviseCopy.runHeadOf(20, 30, 5), '20 of 30 due today, about 5 minutes.');
    expect(ReviseCopy.runHeadOf(19, 19, 5), '19 due today, about 5 minutes.');
    expect(ReviseCopy.runHeadOf(1, 0, 1), '1 due today, about 1 minute.');
  });
}
