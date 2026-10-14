// Route builders for the auth feature. lib/core/router/screens.dart re-exports these and
// router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'auth_load_failed_screen.dart';
import 'sign_in_code_screen.dart';
import 'sign_in_screen.dart';

Widget signInScreen(BuildContext context, GoRouterState state) =>
    const SignInScreen();

Widget signInCodeScreen(BuildContext context, GoRouterState state) =>
    SignInCodeScreen(email: state.uri.queryParameters['email']);

Widget authLoadFailedScreen(BuildContext context, GoRouterState state) =>
    const AuthLoadFailedScreen();
