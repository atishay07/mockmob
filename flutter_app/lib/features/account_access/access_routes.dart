// Paths and route builders of the account-access screens, for the router owner to bind.
//
// The sign-in paths sit under /sign-in/, so the router's signed-out rules already allow them.
// The set-password and add-phone paths sit under /you/account/, which needs a signed-in student.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'screens/forgot_password_screen.dart';
import 'screens/password_sign_in_screen.dart';
import 'screens/phone_screens.dart';
import 'screens/set_password_screen.dart';

abstract final class AccountAccessRoutes {
  static const String passwordSignIn = '/sign-in/password';
  static const String forgotPassword = '/sign-in/forgot';
  static const String phoneSignIn = '/sign-in/phone';
  static const String setPassword = '/you/account/password';
  static const String addPhone = '/you/account/phone';

  /// After a forgot-password code sign-in, the router continues here (via the remembered route).
  static const String setPasswordAfterReset = '$setPassword?mode=reset';

  static String passwordSignInFor({String? email}) =>
      _withEmail(passwordSignIn, email);
  static String forgotPasswordFor({String? email}) =>
      _withEmail(forgotPassword, email);

  static String _withEmail(String path, String? email) =>
      email == null || email.trim().isEmpty
      ? path
      : Uri(
          path: path,
          queryParameters: {'email': email.trim().toLowerCase()},
        ).toString();
}

Widget passwordSignInScreen(BuildContext context, GoRouterState state) =>
    PasswordSignInScreen(email: state.uri.queryParameters['email']);

Widget forgotPasswordScreen(BuildContext context, GoRouterState state) =>
    ForgotPasswordScreen(email: state.uri.queryParameters['email']);

Widget phoneSignInScreen(BuildContext context, GoRouterState state) =>
    const PhoneSignInScreen();

Widget setPasswordScreen(BuildContext context, GoRouterState state) =>
    SetPasswordScreen(reset: state.uri.queryParameters['mode'] == 'reset');

Widget addPhoneScreen(BuildContext context, GoRouterState state) =>
    const AddPhoneScreen();
