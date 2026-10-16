import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/router/action_router.dart';
import 'package:mockmob/core/router/routes.dart';

ActionTarget _go(String href) => ActionRouter.resolve(href);

void main() {
  group('known web paths become native routes', () {
    test('plain tabs', () {
      expect(_go('/today'), const NativeTarget('/today'));
      expect(_go('/review'), const NativeTarget('/review'));
      expect(_go('/learn'), const NativeTarget('/learn'));
      expect(_go('/learn?recall=due'), const NativeTarget('/learn'));
    });

    test('/dashboard is Today, and with a mode is a practice setup', () {
      expect(_go('/dashboard'), const NativeTarget('/today'));
      expect(_go('/dashboard?mode=quick&count=10'), const NativeTarget('/practice/setup/quick?count=10'));
      // The website joins chapters with commas; the app link repeats them, and difficulty stays.
      expect(
        _go('/dashboard?mode=quick&subject=business_studies&count=5&chapters=Staffing%2CControlling&difficulty=hard'),
        const NativeTarget('/practice/setup/quick?subject=business_studies&chapters=Staffing&chapters=Controlling&count=5&difficulty=hard'),
      );
      expect(
        _go('/dashboard?mode=quick&count=5&subject=accountancy&chapter=Partnership%20accounts'),
        const NativeTarget('/practice/setup/quick?subject=accountancy&chapter=Partnership+accounts&count=5'),
      );
    });

    test('/test with a session id resumes it, otherwise opens the setup', () {
      expect(_go('/test?subject=accountancy&mode=full&sessionId=abc123-DEF'), const NativeTarget('/run/abc123-DEF'));
      expect(_go('/test?subject=economics&mode=quick'), const NativeTarget('/practice/setup/quick?subject=economics'));
      expect(_go('/test'), const NativeTarget('/practice'));
    });

    test('results, study runs and units', () {
      expect(_go('/result/att_42'), const NativeTarget('/result/att_42'));
      expect(_go('/study/run-7'), const NativeTarget('/learn/run/run-7'));
      expect(_go('/learn/unit-3'), const NativeTarget('/learn/unit-3'));
    });

    test('recovery lands on Review; progress (milestones and bests) on You', () {
      expect(_go('/recovery?subject=accountancy&chapter=x'), const NativeTarget('/review'));
      expect(_go('/progress'), const NativeTarget('/you'));
    });

    test('absolute links to our own domain map the same way', () {
      expect(_go('https://www.mockmob.in/result/abc'), const NativeTarget('/result/abc'));
      expect(_go('https://mockmob.in/review'), const NativeTarget('/review'));
      expect(_go('https://www.mockmob.in/dashboard?mode=quick&count=20'), const NativeTarget('/practice/setup/quick?count=20'));
    });

    test('hrefs that already name a native route pass through', () {
      expect(_go('/practice/setup/full'), const NativeTarget('/practice/setup/full'));
      expect(_go('/you/notifications'), const NativeTarget('/you/notifications'));
    });
  });

  group('never opened blindly', () {
    test('pricing, checkout and signup are refused everywhere', () {
      for (final href in [
        '/pricing',
        '/pricing/pro',
        '/upgrade',
        '/checkout',
        '/payment/confirm',
        '/billing',
        '/subscribe',
        '/premium',
        '/signup',
        'https://www.mockmob.in/pricing',
      ]) {
        expect(_go(href), const UnsupportedTarget(), reason: href);
      }
    });

    test('other hosts and schemes are refused', () {
      for (final href in [
        'https://evil.example/result/abc',
        'https://www.mockmob.in.evil.example/today',
        'http://www.mockmob.in/today',
        'javascript:alert(1)',
        'intent://scan/#Intent;scheme=zxing;end',
        'mockmob://today',
        'file:///etc/passwd',
        '//evil.example/today',
        'https://user:pass@www.mockmob.in/today',
        'https://www.mockmob.in:8443/today',
        'today',
        'www.mockmob.in/today',
      ]) {
        expect(_go(href), const UnsupportedTarget(), reason: href);
      }
    });

    test('malformed and empty hrefs are refused', () {
      expect(ActionRouter.resolve(null), const UnsupportedTarget());
      expect(_go(''), const UnsupportedTarget());
      expect(_go('   '), const UnsupportedTarget());
      expect(_go('/result/a b'), const UnsupportedTarget());
      expect(_go('/result/a\\b'), const UnsupportedTarget());
      expect(_go('/learn/../../etc'), const UnsupportedTarget());
      expect(_go('/result/${'a' * 101}'), const UnsupportedTarget());
    });

    test('bad parameters on a known screen are refused, not sent to the browser', () {
      expect(_go('/test?sessionId=bad%21id'), const UnsupportedTarget());
      expect(_go('/dashboard?mode=QUICK!'), const UnsupportedTarget());
      expect(_go('/result/a%2Fb'), const UnsupportedTarget());
    });

    test('unknown query values are dropped from a setup route', () {
      expect(
        _go('/dashboard?mode=quick&count=abc&subject=bad subject!&extra=1'),
        const UnsupportedTarget(),
        reason: 'whitespace is refused outright',
      );
      expect(_go('/dashboard?mode=quick&count=abc&extra=1'), const NativeTarget('/practice/setup/quick'));
    });
  });

  group('unknown pages on our own domain open in a Custom Tab', () {
    test('relative and absolute', () {
      expect(_go('/cuet-mock-test-free'), ExternalTarget(Uri.parse('https://www.mockmob.in/cuet-mock-test-free')));
      expect(
        _go('https://mockmob.in/features?x=1'),
        ExternalTarget(Uri.parse('https://www.mockmob.in/features?x=1')),
      );
    });

    test('the auth flow paths are not reachable by href', () {
      expect(_go('/sign-in'), isA<ExternalTarget>());
      expect(_go('/welcome'), isA<ExternalTarget>());
    });
  });

  test('every route template is recognised as native, and the dashboard alias is not passed through', () {
    for (final template in AppRoutes.templates) {
      final sample = template.replaceAllMapped(RegExp(r':(\w+)'), (m) => 'x${m[1]}');
      expect(AppRoutes.isNativePath(sample), isTrue, reason: sample);
    }
    expect(AppRoutes.isNativePath('/pricing'), isFalse);
  });

  group('native routes keep the query their screen reads, and nothing else', () {
    test('a repair keeps its count (the widget tap and the shortcut)', () {
      expect(_go('/review/repair/m7/m7-q3?count=4'), const NativeTarget('/review/repair/m7/m7-q3?count=4'));
      expect(_go('https://www.mockmob.in/review/repair/m7/m7-q3?count=3'), const NativeTarget('/review/repair/m7/m7-q3?count=3'));
      // The repair builder reads `count` only; `minutes` and anything else is dropped.
      expect(_go('/review/repair/m7/m7-q3?count=4&minutes=15&x=1'), const NativeTarget('/review/repair/m7/m7-q3?count=4'));
      // A count that is not a whole number from 1 to 999 means no count, never a refusal.
      for (final bad in ['0', '-2', 'abc', '1000', '4.5']) {
        expect(_go('/review/repair/m7/m7-q3?count=$bad'), const NativeTarget('/review/repair/m7/m7-q3'), reason: bad);
      }
      expect(_go('/review/repair/m7/ending?count=4'), const NativeTarget('/review/repair/m7/ending'));
    });

    test('a practice link keeps its purpose, but only the two first-use values', () {
      expect(
        _go('/dashboard?mode=quick&subject=accountancy&count=10&purpose=baseline'),
        const NativeTarget('/practice/setup/quick?subject=accountancy&count=10&purpose=baseline'),
      );
      expect(
        _go('/test?mode=full&purpose=full_sample'),
        const NativeTarget('/practice/setup/full?purpose=full_sample'),
      );
      expect(_go('/test?mode=quick&purpose=free_credits'), const NativeTarget('/practice/setup/quick'));
      expect(_go('/test?mode=quick&purpose=BASELINE'), const NativeTarget('/practice/setup/quick'));
    });

    test('a practice setup or start route keeps what the practice link reads', () {
      expect(
        _go('/practice/setup/quick?count=10&purpose=baseline&subject=economics&x=1'),
        const NativeTarget('/practice/setup/quick?subject=economics&count=10&purpose=baseline'),
      );
      expect(
        _go('/practice/start?mode=chapter&subject=accountancy&chapter=Partnership%20accounts&count=5&purpose=baseline'),
        const NativeTarget('/practice/start?mode=chapter&subject=accountancy&chapter=Partnership+accounts&count=5&purpose=baseline'),
      );
      expect(_go('/practice/start'), const NativeTarget('/practice/start'));
      expect(_go('/practice/start?mode=QUICK!'), const UnsupportedTarget());
      // The exam-day layout still opens its instructions, never a running clock.
      expect(_go('/practice/start?mode=nta&subject=economics'), const NativeTarget('/exam/nta?subject=economics'));
    });

    test('a fresh-questions check is carried for chapter practice only', () {
      expect(
        _go('/dashboard?mode=chapter&subject=accountancy&count=5&chapter=Staffing&recoveryFrom=att_42'),
        const NativeTarget('/practice/setup/chapter?subject=accountancy&chapter=Staffing&count=5&recoveryFrom=att_42'),
      );
      expect(_go('/dashboard?mode=quick&recoveryFrom=att_42'), const NativeTarget('/practice/setup/quick'));
      expect(_go('/dashboard?mode=chapter&recoveryFrom=a%2Fb'), const NativeTarget('/practice/setup/chapter'));
    });

    test('the result keeps the question it opens at, the stream keeps its filters', () {
      expect(_go('/result/att_42?q=12'), const NativeTarget('/result/att_42?q=12'));
      expect(_go('/result/att_42?q=abc&x=1'), const NativeTarget('/result/att_42'));
      expect(_go('/practice/stream?subject=economics&difficulty=hard&x=1'), const NativeTarget('/practice/stream?subject=economics&difficulty=hard'));
      expect(_go('/practice/stream?source=saved&start=q_9'), const NativeTarget('/practice/stream?source=saved&start=q_9'));
      expect(_go('/practice/stream?source=elsewhere'), const NativeTarget('/practice/stream'));
      expect(_go('/exam/nta?subject=economics&x=1'), const NativeTarget('/exam/nta?subject=economics'));
      expect(_go('/exam/nta'), const NativeTarget('/exam/nta'));
    });

    test('screens that read no query get none', () {
      expect(_go('/review/mistakes?count=4&purpose=baseline'), const NativeTarget('/review/mistakes'));
      expect(_go('/you/notifications?x=1'), const NativeTarget('/you/notifications'));
    });

    test('unsafe and unknown hosts are still refused with a query', () {
      for (final href in [
        'https://evil.example/review/repair/m7/m7-q3?count=4',
        'https://www.mockmob.in.evil.example/test?mode=quick&purpose=baseline',
        'http://www.mockmob.in/review/repair/m7/m7-q3?count=4',
        '//evil.example/review/repair/m7/m7-q3?count=4',
        'javascript:alert(1)?count=4',
      ]) {
        expect(_go(href), const UnsupportedTarget(), reason: href);
      }
      expect(_go('/review/repair/m7/../x?count=4'), const UnsupportedTarget());
      expect(_go('/pricing?mode=quick&purpose=baseline'), const UnsupportedTarget());
    });
  });

  group('website features with a native home (WEB-PARITY 2.3)', () {
    test('explore, saved, analytics and the mentor', () {
      expect(_go('/explore'), const NativeTarget('/practice/stream'));
      expect(_go('/explore?subject=economics&difficulty=hard'), const NativeTarget('/practice/stream?subject=economics&difficulty=hard'));
      expect(_go('/saved'), const NativeTarget('/review/saved'));
      expect(_go('/analytics'), const NativeTarget('/review/insights'));
      expect(_go('/mentor'), const NativeTarget('/review/insights'));
      expect(_go('/mentor?tab=ask'), const NativeTarget('/ask'));
    });

    test('the DU tools and the 2027 guide', () {
      expect(_go('/admission-compass'), const NativeTarget('/tools/compass'));
      expect(_go('/cuet-cutoff-calculator'), const NativeTarget('/colleges/cutoff'), reason: 'Check a score on Colleges');
      expect(_go('/cuet-subject-combination'), const NativeTarget('/tools/combo'));
      expect(_go('https://www.mockmob.in/cuet-2027'), const NativeTarget('/tools/guide-2027'));
    });

    test('the Colleges tab and Check a score keep only a well-formed score and category', () {
      expect(_go('/colleges'), const NativeTarget('/colleges'));
      expect(_go('/colleges/cutoff?score=612&category=UR&x=1'), const NativeTarget('/colleges/cutoff?score=612&category=UR'));
      expect(_go('/colleges/cutoff?score=abc&category=%3Cb%3E'), const NativeTarget('/colleges/cutoff'));
      expect(_go('/colleges/cutoff?score=600-650&category=OBC-NCL'), const NativeTarget('/colleges/cutoff?score=600-650&category=OBC-NCL'));
      expect(_go('/tools'), const NativeTarget('/tools'), reason: 'the router redirects it to /colleges');
    });

    test('profile opens You with the account sheet, and editing subjects', () {
      expect(_go('/profile'), const NativeTarget('/you?account=1'));
      expect(_go('/you?account=1'), const NativeTarget('/you?account=1'));
      expect(_go('/you?account=2'), const NativeTarget('/you'));
      expect(_go('/onboarding?edit=true'), const NativeTarget('/you/subjects'));
      expect(_go('/onboarding'), isA<ExternalTarget>());
    });

    test('the exam-day layout opens its instructions, never a running clock', () {
      expect(_go('/dashboard?mode=nta&subject=economics'), const NativeTarget('/exam/nta?subject=economics'));
      // On the website this is an ordinary full mock, so it stays free here too.
      expect(_go('/dashboard?mode=full&interface=nta&subject=accountancy'), const NativeTarget('/practice/setup/full?subject=accountancy'));
      expect(_go('/dashboard?mode=full&subject=accountancy'), const NativeTarget('/practice/setup/full?subject=accountancy'));
    });
  });
}
