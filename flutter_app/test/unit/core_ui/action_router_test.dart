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

    test('recovery and progress land on Review', () {
      expect(_go('/recovery?subject=accountancy&chapter=x'), const NativeTarget('/review'));
      expect(_go('/progress'), const NativeTarget('/review'));
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
}
