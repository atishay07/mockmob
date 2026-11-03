import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/learn2_links.dart';

void main() {
  group('Learn2Links.resolve draws the server\'s production hrefs as the app\'s places (APP-1101 6)', () {
    test('a run, a feed, the chapter pages, Find, Learn and Revise', () {
      expect(Learn2Links.resolve('/learn/run?chapter=accountancy.admission-of-partner&min=10&kind=mix&out=lesson'),
          '/learn/session?chapter=accountancy.admission-of-partner&min=10&out=lesson');
      expect(Learn2Links.resolve('/learn/run?run=lr_1&end=1'), '/learn/session?min=10&run=lr_1&end=1');
      expect(Learn2Links.resolve('/explore/run?chapter=accountancy.goodwill&min=5'), '/explore/feed?chapter=accountancy.goodwill&min=5');
      expect(Learn2Links.resolve('/learn/c/accountancy.goodwill'), '/learn/c/accountancy.goodwill');
      expect(Learn2Links.resolve('/learn/c/accountancy.goodwill/cards?f=must'), '/learn/c/accountancy.goodwill/cards?f=must');
      expect(Learn2Links.resolve('/learn/find?subject=accountancy&q=goodwill'), '/practice?subject=accountancy&find=1&q=goodwill&door=learn');
      expect(Learn2Links.resolve('/learn?subject=economics'), '/practice?subject=economics&door=learn');
      expect(Learn2Links.resolve('/review/revise'), '/review/revise');
    });

    test('Explore: the covers, unless the link filters questions (then the ActionRouter opens the stream)', () {
      // Explore is Practice's fourth door (LK51).
      expect(Learn2Links.resolve('/explore'), '/practice?door=explore');
      expect(Learn2Links.resolve('/explore?subject=accountancy'), '/practice?subject=accountancy&door=explore');
      expect(Learn2Links.resolve('/explore?subject=accountancy&chapter=Goodwill'), isNull);
      expect(Learn2Links.resolve('/explore?difficulty=hard'), isNull);
    });

    test('anything else is not a Learn place', () {
      expect(Learn2Links.resolve('/today'), isNull);
      expect(Learn2Links.resolve(null), isNull);
      expect(Learn2Links.resolve(''), isNull);
    });
  });

  test('the Key cards pages open their Learn v2 places while it is on', () {
    expect(Learn2Links.fromKeyCards(Uri.parse('/cards')), '/practice?door=learn');
    expect(Learn2Links.fromKeyCards(Uri.parse('/cards?subject=economics')), '/practice?subject=economics&door=learn');
    expect(Learn2Links.fromKeyCards(Uri.parse('/cards/accountancy.goodwill')), '/learn/c/accountancy.goodwill/cards');
    expect(Learn2Links.fromKeyCards(Uri.parse('/cards/accountancy.goodwill?mode=study')), '/learn/c/accountancy.goodwill');
    expect(Learn2Links.fromKeyCards(Uri.parse('/cards/accountancy.goodwill?mode=last-look')), '/learn/c/accountancy.goodwill/cards?f=must');
    expect(Learn2Links.fromKeyCards(Uri.parse('/learn')), isNull);
  });

  test('RunLaunch and FeedLaunch round-trip through their query', () {
    const run = RunLaunch(chapterKey: 'accountancy.goodwill', minutes: 20, kind: 'cards', leaveOut: ['lesson'], cardIds: ['kc.a', 'kc.b'], runId: 'lr_9', end: true, addNext: true, fresh: true);
    final back = RunLaunch.fromQuery(run.toQuery());
    expect((back.chapterKey, back.minutes, back.kind, back.leaveOut.join(','), back.cardIds.join(','), back.runId, back.end, back.addNext, back.fresh),
        ('accountancy.goodwill', 20, 'cards', 'lesson', 'kc.a,kc.b', 'lr_9', true, true, true));
    const feed = FeedLaunch(chapterKey: 'accountancy.goodwill', minutes: 5, source: 'explore_cover', forYou: true, position: 3);
    final f = FeedLaunch.fromQuery(feed.toQuery());
    expect((f.chapterKey, f.minutes, f.source, f.forYou, f.position, f.runId, f.end), ('accountancy.goodwill', 5, 'explore_cover', true, 3, null, false));
  });
}
