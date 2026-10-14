/// Work other modules need done when the student signs out, such as revoking the push
/// device token. Register once at startup. Hooks run before the tokens are cleared, each
/// failure is ignored so sign-out can never be blocked by one of them.
abstract final class SignOutHooks {
  static final List<Future<void> Function()> _hooks = [];

  static void register(Future<void> Function() hook) => _hooks.add(hook);

  /// Test helper.
  static void clear() => _hooks.clear();

  static Future<void> runAll() async {
    for (final hook in List.of(_hooks)) {
      try {
        await hook();
      } on Object {
        // Best effort: the sign-out continues.
      }
    }
  }
}
