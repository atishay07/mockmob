import 'package:drift/native.dart';
import 'package:mockmob/core/storage/app_database.dart';

/// A fresh in-memory database per test.
AppDatabase newTestDb() => AppDatabase(NativeDatabase.memory());
