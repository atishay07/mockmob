/// The one calm sentence about the question bank, wherever the plan is shown (M-002, owner 16 Oct:
/// "unlimited mocks from one central question bank", said truthfully and never in the face). The
/// same claim as the website's question-bank line: every paper is drawn fresh from one live bank, so
/// there is no fixed set to run out of, and only Pro says "unlimited" (Free spends Practice credits
/// on a mock). No subject count and no promise that a question never returns.
abstract final class PlanCopy {
  static const String bankPro = 'Unlimited mocks, each one built fresh from one central question bank.';
  static const String bankFree =
      'Every mock is built fresh from one central question bank, so there is no fixed set to run out of.';

  static String bankLine({required bool pro}) => pro ? bankPro : bankFree;
}
