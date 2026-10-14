/// Sign-in methods beyond the email code, and the password screens, for the integrator to place.
///
/// - [SignInMethods]: Google, then email code or password (and phone when on). Wrap the sign-in
///   screen's existing email-code block with it.
/// - [GoogleSignInButton], [PasswordSignInForm], [SetPasswordForm], [PhoneCodeForm]: the parts.
/// - [SetPasswordNudge]: "Set a password for faster sign-in", for the after-sign-in sheet or
///   You, Account.
/// - [SignOutOtherDevicesCard]: "Sign out of other devices", for You, Account.
/// - [AccountAccessRoutes] and the route builders in access_routes.dart.
library;

export 'access_gateway.dart'
    show
        AccessMethods,
        AccountAccessGateway,
        accessMethodsProvider,
        accountAccessGatewayProvider;
export 'access_routes.dart';
export 'screens/forgot_password_screen.dart';
export 'screens/password_sign_in_screen.dart';
export 'screens/phone_screens.dart';
export 'screens/set_password_screen.dart';
export 'state/password_hints.dart'
    show passwordHintsProvider, passwordNudgeProvider;
export 'widgets/google_button.dart';
export 'widgets/password_sign_in_form.dart';
export 'widgets/phone_code_form.dart';
export 'widgets/set_password_form.dart';
export 'widgets/set_password_nudge.dart';
export 'widgets/sign_in_methods.dart';
export 'widgets/sign_out_other_devices.dart';
