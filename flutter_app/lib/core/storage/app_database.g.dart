// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $AnswerJournalTable extends AnswerJournal
    with TableInfo<$AnswerJournalTable, JournalRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $AnswerJournalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sessionIdMeta = const VerificationMeta(
    'sessionId',
  );
  @override
  late final GeneratedColumn<String> sessionId = GeneratedColumn<String>(
    'session_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _seqMeta = const VerificationMeta('seq');
  @override
  late final GeneratedColumn<int> seq = GeneratedColumn<int>(
    'seq',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _qidMeta = const VerificationMeta('qid');
  @override
  late final GeneratedColumn<String> qid = GeneratedColumn<String>(
    'qid',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _typeMeta = const VerificationMeta('type');
  @override
  late final GeneratedColumn<String> type = GeneratedColumn<String>(
    'type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _atMsMeta = const VerificationMeta('atMs');
  @override
  late final GeneratedColumn<int> atMs = GeneratedColumn<int>(
    'at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _answerMeta = const VerificationMeta('answer');
  @override
  late final GeneratedColumn<int> answer = GeneratedColumn<int>(
    'answer',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _createdAtMsMeta = const VerificationMeta(
    'createdAtMs',
  );
  @override
  late final GeneratedColumn<int> createdAtMs = GeneratedColumn<int>(
    'created_at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    userId,
    sessionId,
    seq,
    qid,
    type,
    atMs,
    answer,
    createdAtMs,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'answer_journal';
  @override
  VerificationContext validateIntegrity(
    Insertable<JournalRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('session_id')) {
      context.handle(
        _sessionIdMeta,
        sessionId.isAcceptableOrUnknown(data['session_id']!, _sessionIdMeta),
      );
    } else if (isInserting) {
      context.missing(_sessionIdMeta);
    }
    if (data.containsKey('seq')) {
      context.handle(
        _seqMeta,
        seq.isAcceptableOrUnknown(data['seq']!, _seqMeta),
      );
    } else if (isInserting) {
      context.missing(_seqMeta);
    }
    if (data.containsKey('qid')) {
      context.handle(
        _qidMeta,
        qid.isAcceptableOrUnknown(data['qid']!, _qidMeta),
      );
    } else if (isInserting) {
      context.missing(_qidMeta);
    }
    if (data.containsKey('type')) {
      context.handle(
        _typeMeta,
        type.isAcceptableOrUnknown(data['type']!, _typeMeta),
      );
    } else if (isInserting) {
      context.missing(_typeMeta);
    }
    if (data.containsKey('at_ms')) {
      context.handle(
        _atMsMeta,
        atMs.isAcceptableOrUnknown(data['at_ms']!, _atMsMeta),
      );
    } else if (isInserting) {
      context.missing(_atMsMeta);
    }
    if (data.containsKey('answer')) {
      context.handle(
        _answerMeta,
        answer.isAcceptableOrUnknown(data['answer']!, _answerMeta),
      );
    }
    if (data.containsKey('created_at_ms')) {
      context.handle(
        _createdAtMsMeta,
        createdAtMs.isAcceptableOrUnknown(
          data['created_at_ms']!,
          _createdAtMsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_createdAtMsMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  List<Set<GeneratedColumn>> get uniqueKeys => [
    {sessionId, seq},
  ];
  @override
  JournalRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return JournalRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      sessionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}session_id'],
      )!,
      seq: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}seq'],
      )!,
      qid: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}qid'],
      )!,
      type: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}type'],
      )!,
      atMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}at_ms'],
      )!,
      answer: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}answer'],
      ),
      createdAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at_ms'],
      )!,
    );
  }

  @override
  $AnswerJournalTable createAlias(String alias) {
    return $AnswerJournalTable(attachedDatabase, alias);
  }
}

class JournalRow extends DataClass implements Insertable<JournalRow> {
  final int id;
  final String userId;
  final String sessionId;
  final int seq;
  final String qid;

  /// `visit` or `answer`.
  final String type;
  final int atMs;

  /// Only for `answer` events. Null means the answer was cleared.
  final int? answer;
  final int createdAtMs;
  const JournalRow({
    required this.id,
    required this.userId,
    required this.sessionId,
    required this.seq,
    required this.qid,
    required this.type,
    required this.atMs,
    this.answer,
    required this.createdAtMs,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['user_id'] = Variable<String>(userId);
    map['session_id'] = Variable<String>(sessionId);
    map['seq'] = Variable<int>(seq);
    map['qid'] = Variable<String>(qid);
    map['type'] = Variable<String>(type);
    map['at_ms'] = Variable<int>(atMs);
    if (!nullToAbsent || answer != null) {
      map['answer'] = Variable<int>(answer);
    }
    map['created_at_ms'] = Variable<int>(createdAtMs);
    return map;
  }

  AnswerJournalCompanion toCompanion(bool nullToAbsent) {
    return AnswerJournalCompanion(
      id: Value(id),
      userId: Value(userId),
      sessionId: Value(sessionId),
      seq: Value(seq),
      qid: Value(qid),
      type: Value(type),
      atMs: Value(atMs),
      answer: answer == null && nullToAbsent
          ? const Value.absent()
          : Value(answer),
      createdAtMs: Value(createdAtMs),
    );
  }

  factory JournalRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return JournalRow(
      id: serializer.fromJson<int>(json['id']),
      userId: serializer.fromJson<String>(json['userId']),
      sessionId: serializer.fromJson<String>(json['sessionId']),
      seq: serializer.fromJson<int>(json['seq']),
      qid: serializer.fromJson<String>(json['qid']),
      type: serializer.fromJson<String>(json['type']),
      atMs: serializer.fromJson<int>(json['atMs']),
      answer: serializer.fromJson<int?>(json['answer']),
      createdAtMs: serializer.fromJson<int>(json['createdAtMs']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'userId': serializer.toJson<String>(userId),
      'sessionId': serializer.toJson<String>(sessionId),
      'seq': serializer.toJson<int>(seq),
      'qid': serializer.toJson<String>(qid),
      'type': serializer.toJson<String>(type),
      'atMs': serializer.toJson<int>(atMs),
      'answer': serializer.toJson<int?>(answer),
      'createdAtMs': serializer.toJson<int>(createdAtMs),
    };
  }

  JournalRow copyWith({
    int? id,
    String? userId,
    String? sessionId,
    int? seq,
    String? qid,
    String? type,
    int? atMs,
    Value<int?> answer = const Value.absent(),
    int? createdAtMs,
  }) => JournalRow(
    id: id ?? this.id,
    userId: userId ?? this.userId,
    sessionId: sessionId ?? this.sessionId,
    seq: seq ?? this.seq,
    qid: qid ?? this.qid,
    type: type ?? this.type,
    atMs: atMs ?? this.atMs,
    answer: answer.present ? answer.value : this.answer,
    createdAtMs: createdAtMs ?? this.createdAtMs,
  );
  JournalRow copyWithCompanion(AnswerJournalCompanion data) {
    return JournalRow(
      id: data.id.present ? data.id.value : this.id,
      userId: data.userId.present ? data.userId.value : this.userId,
      sessionId: data.sessionId.present ? data.sessionId.value : this.sessionId,
      seq: data.seq.present ? data.seq.value : this.seq,
      qid: data.qid.present ? data.qid.value : this.qid,
      type: data.type.present ? data.type.value : this.type,
      atMs: data.atMs.present ? data.atMs.value : this.atMs,
      answer: data.answer.present ? data.answer.value : this.answer,
      createdAtMs: data.createdAtMs.present
          ? data.createdAtMs.value
          : this.createdAtMs,
    );
  }

  @override
  String toString() {
    return (StringBuffer('JournalRow(')
          ..write('id: $id, ')
          ..write('userId: $userId, ')
          ..write('sessionId: $sessionId, ')
          ..write('seq: $seq, ')
          ..write('qid: $qid, ')
          ..write('type: $type, ')
          ..write('atMs: $atMs, ')
          ..write('answer: $answer, ')
          ..write('createdAtMs: $createdAtMs')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    userId,
    sessionId,
    seq,
    qid,
    type,
    atMs,
    answer,
    createdAtMs,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is JournalRow &&
          other.id == this.id &&
          other.userId == this.userId &&
          other.sessionId == this.sessionId &&
          other.seq == this.seq &&
          other.qid == this.qid &&
          other.type == this.type &&
          other.atMs == this.atMs &&
          other.answer == this.answer &&
          other.createdAtMs == this.createdAtMs);
}

class AnswerJournalCompanion extends UpdateCompanion<JournalRow> {
  final Value<int> id;
  final Value<String> userId;
  final Value<String> sessionId;
  final Value<int> seq;
  final Value<String> qid;
  final Value<String> type;
  final Value<int> atMs;
  final Value<int?> answer;
  final Value<int> createdAtMs;
  const AnswerJournalCompanion({
    this.id = const Value.absent(),
    this.userId = const Value.absent(),
    this.sessionId = const Value.absent(),
    this.seq = const Value.absent(),
    this.qid = const Value.absent(),
    this.type = const Value.absent(),
    this.atMs = const Value.absent(),
    this.answer = const Value.absent(),
    this.createdAtMs = const Value.absent(),
  });
  AnswerJournalCompanion.insert({
    this.id = const Value.absent(),
    required String userId,
    required String sessionId,
    required int seq,
    required String qid,
    required String type,
    required int atMs,
    this.answer = const Value.absent(),
    required int createdAtMs,
  }) : userId = Value(userId),
       sessionId = Value(sessionId),
       seq = Value(seq),
       qid = Value(qid),
       type = Value(type),
       atMs = Value(atMs),
       createdAtMs = Value(createdAtMs);
  static Insertable<JournalRow> custom({
    Expression<int>? id,
    Expression<String>? userId,
    Expression<String>? sessionId,
    Expression<int>? seq,
    Expression<String>? qid,
    Expression<String>? type,
    Expression<int>? atMs,
    Expression<int>? answer,
    Expression<int>? createdAtMs,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (userId != null) 'user_id': userId,
      if (sessionId != null) 'session_id': sessionId,
      if (seq != null) 'seq': seq,
      if (qid != null) 'qid': qid,
      if (type != null) 'type': type,
      if (atMs != null) 'at_ms': atMs,
      if (answer != null) 'answer': answer,
      if (createdAtMs != null) 'created_at_ms': createdAtMs,
    });
  }

  AnswerJournalCompanion copyWith({
    Value<int>? id,
    Value<String>? userId,
    Value<String>? sessionId,
    Value<int>? seq,
    Value<String>? qid,
    Value<String>? type,
    Value<int>? atMs,
    Value<int?>? answer,
    Value<int>? createdAtMs,
  }) {
    return AnswerJournalCompanion(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      sessionId: sessionId ?? this.sessionId,
      seq: seq ?? this.seq,
      qid: qid ?? this.qid,
      type: type ?? this.type,
      atMs: atMs ?? this.atMs,
      answer: answer ?? this.answer,
      createdAtMs: createdAtMs ?? this.createdAtMs,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (sessionId.present) {
      map['session_id'] = Variable<String>(sessionId.value);
    }
    if (seq.present) {
      map['seq'] = Variable<int>(seq.value);
    }
    if (qid.present) {
      map['qid'] = Variable<String>(qid.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(type.value);
    }
    if (atMs.present) {
      map['at_ms'] = Variable<int>(atMs.value);
    }
    if (answer.present) {
      map['answer'] = Variable<int>(answer.value);
    }
    if (createdAtMs.present) {
      map['created_at_ms'] = Variable<int>(createdAtMs.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('AnswerJournalCompanion(')
          ..write('id: $id, ')
          ..write('userId: $userId, ')
          ..write('sessionId: $sessionId, ')
          ..write('seq: $seq, ')
          ..write('qid: $qid, ')
          ..write('type: $type, ')
          ..write('atMs: $atMs, ')
          ..write('answer: $answer, ')
          ..write('createdAtMs: $createdAtMs')
          ..write(')'))
        .toString();
  }
}

class $OutboxTable extends Outbox with TableInfo<$OutboxTable, OutboxRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OutboxTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _kindMeta = const VerificationMeta('kind');
  @override
  late final GeneratedColumn<String> kind = GeneratedColumn<String>(
    'kind',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _idempotencyKeyMeta = const VerificationMeta(
    'idempotencyKey',
  );
  @override
  late final GeneratedColumn<String> idempotencyKey = GeneratedColumn<String>(
    'idempotency_key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  static const VerificationMeta _methodMeta = const VerificationMeta('method');
  @override
  late final GeneratedColumn<String> method = GeneratedColumn<String>(
    'method',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _pathMeta = const VerificationMeta('path');
  @override
  late final GeneratedColumn<String> path = GeneratedColumn<String>(
    'path',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _bodyJsonMeta = const VerificationMeta(
    'bodyJson',
  );
  @override
  late final GeneratedColumn<String> bodyJson = GeneratedColumn<String>(
    'body_json',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _createdAtMsMeta = const VerificationMeta(
    'createdAtMs',
  );
  @override
  late final GeneratedColumn<int> createdAtMs = GeneratedColumn<int>(
    'created_at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _attemptsMeta = const VerificationMeta(
    'attempts',
  );
  @override
  late final GeneratedColumn<int> attempts = GeneratedColumn<int>(
    'attempts',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _nextAttemptAtMsMeta = const VerificationMeta(
    'nextAttemptAtMs',
  );
  @override
  late final GeneratedColumn<int> nextAttemptAtMs = GeneratedColumn<int>(
    'next_attempt_at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _lastErrorCodeMeta = const VerificationMeta(
    'lastErrorCode',
  );
  @override
  late final GeneratedColumn<String> lastErrorCode = GeneratedColumn<String>(
    'last_error_code',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    userId,
    kind,
    idempotencyKey,
    method,
    path,
    bodyJson,
    createdAtMs,
    attempts,
    nextAttemptAtMs,
    lastErrorCode,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'outbox';
  @override
  VerificationContext validateIntegrity(
    Insertable<OutboxRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('kind')) {
      context.handle(
        _kindMeta,
        kind.isAcceptableOrUnknown(data['kind']!, _kindMeta),
      );
    } else if (isInserting) {
      context.missing(_kindMeta);
    }
    if (data.containsKey('idempotency_key')) {
      context.handle(
        _idempotencyKeyMeta,
        idempotencyKey.isAcceptableOrUnknown(
          data['idempotency_key']!,
          _idempotencyKeyMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_idempotencyKeyMeta);
    }
    if (data.containsKey('method')) {
      context.handle(
        _methodMeta,
        method.isAcceptableOrUnknown(data['method']!, _methodMeta),
      );
    } else if (isInserting) {
      context.missing(_methodMeta);
    }
    if (data.containsKey('path')) {
      context.handle(
        _pathMeta,
        path.isAcceptableOrUnknown(data['path']!, _pathMeta),
      );
    } else if (isInserting) {
      context.missing(_pathMeta);
    }
    if (data.containsKey('body_json')) {
      context.handle(
        _bodyJsonMeta,
        bodyJson.isAcceptableOrUnknown(data['body_json']!, _bodyJsonMeta),
      );
    }
    if (data.containsKey('created_at_ms')) {
      context.handle(
        _createdAtMsMeta,
        createdAtMs.isAcceptableOrUnknown(
          data['created_at_ms']!,
          _createdAtMsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_createdAtMsMeta);
    }
    if (data.containsKey('attempts')) {
      context.handle(
        _attemptsMeta,
        attempts.isAcceptableOrUnknown(data['attempts']!, _attemptsMeta),
      );
    }
    if (data.containsKey('next_attempt_at_ms')) {
      context.handle(
        _nextAttemptAtMsMeta,
        nextAttemptAtMs.isAcceptableOrUnknown(
          data['next_attempt_at_ms']!,
          _nextAttemptAtMsMeta,
        ),
      );
    }
    if (data.containsKey('last_error_code')) {
      context.handle(
        _lastErrorCodeMeta,
        lastErrorCode.isAcceptableOrUnknown(
          data['last_error_code']!,
          _lastErrorCodeMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  OutboxRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OutboxRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      kind: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}kind'],
      )!,
      idempotencyKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}idempotency_key'],
      )!,
      method: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}method'],
      )!,
      path: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}path'],
      )!,
      bodyJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}body_json'],
      ),
      createdAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at_ms'],
      )!,
      attempts: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}attempts'],
      )!,
      nextAttemptAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}next_attempt_at_ms'],
      )!,
      lastErrorCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_error_code'],
      ),
    );
  }

  @override
  $OutboxTable createAlias(String alias) {
    return $OutboxTable(attachedDatabase, alias);
  }
}

class OutboxRow extends DataClass implements Insertable<OutboxRow> {
  final int id;
  final String userId;
  final String kind;
  final String idempotencyKey;
  final String method;
  final String path;
  final String? bodyJson;
  final int createdAtMs;
  final int attempts;
  final int nextAttemptAtMs;

  /// Machine code of the last failure, never server text.
  final String? lastErrorCode;
  const OutboxRow({
    required this.id,
    required this.userId,
    required this.kind,
    required this.idempotencyKey,
    required this.method,
    required this.path,
    this.bodyJson,
    required this.createdAtMs,
    required this.attempts,
    required this.nextAttemptAtMs,
    this.lastErrorCode,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['user_id'] = Variable<String>(userId);
    map['kind'] = Variable<String>(kind);
    map['idempotency_key'] = Variable<String>(idempotencyKey);
    map['method'] = Variable<String>(method);
    map['path'] = Variable<String>(path);
    if (!nullToAbsent || bodyJson != null) {
      map['body_json'] = Variable<String>(bodyJson);
    }
    map['created_at_ms'] = Variable<int>(createdAtMs);
    map['attempts'] = Variable<int>(attempts);
    map['next_attempt_at_ms'] = Variable<int>(nextAttemptAtMs);
    if (!nullToAbsent || lastErrorCode != null) {
      map['last_error_code'] = Variable<String>(lastErrorCode);
    }
    return map;
  }

  OutboxCompanion toCompanion(bool nullToAbsent) {
    return OutboxCompanion(
      id: Value(id),
      userId: Value(userId),
      kind: Value(kind),
      idempotencyKey: Value(idempotencyKey),
      method: Value(method),
      path: Value(path),
      bodyJson: bodyJson == null && nullToAbsent
          ? const Value.absent()
          : Value(bodyJson),
      createdAtMs: Value(createdAtMs),
      attempts: Value(attempts),
      nextAttemptAtMs: Value(nextAttemptAtMs),
      lastErrorCode: lastErrorCode == null && nullToAbsent
          ? const Value.absent()
          : Value(lastErrorCode),
    );
  }

  factory OutboxRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OutboxRow(
      id: serializer.fromJson<int>(json['id']),
      userId: serializer.fromJson<String>(json['userId']),
      kind: serializer.fromJson<String>(json['kind']),
      idempotencyKey: serializer.fromJson<String>(json['idempotencyKey']),
      method: serializer.fromJson<String>(json['method']),
      path: serializer.fromJson<String>(json['path']),
      bodyJson: serializer.fromJson<String?>(json['bodyJson']),
      createdAtMs: serializer.fromJson<int>(json['createdAtMs']),
      attempts: serializer.fromJson<int>(json['attempts']),
      nextAttemptAtMs: serializer.fromJson<int>(json['nextAttemptAtMs']),
      lastErrorCode: serializer.fromJson<String?>(json['lastErrorCode']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'userId': serializer.toJson<String>(userId),
      'kind': serializer.toJson<String>(kind),
      'idempotencyKey': serializer.toJson<String>(idempotencyKey),
      'method': serializer.toJson<String>(method),
      'path': serializer.toJson<String>(path),
      'bodyJson': serializer.toJson<String?>(bodyJson),
      'createdAtMs': serializer.toJson<int>(createdAtMs),
      'attempts': serializer.toJson<int>(attempts),
      'nextAttemptAtMs': serializer.toJson<int>(nextAttemptAtMs),
      'lastErrorCode': serializer.toJson<String?>(lastErrorCode),
    };
  }

  OutboxRow copyWith({
    int? id,
    String? userId,
    String? kind,
    String? idempotencyKey,
    String? method,
    String? path,
    Value<String?> bodyJson = const Value.absent(),
    int? createdAtMs,
    int? attempts,
    int? nextAttemptAtMs,
    Value<String?> lastErrorCode = const Value.absent(),
  }) => OutboxRow(
    id: id ?? this.id,
    userId: userId ?? this.userId,
    kind: kind ?? this.kind,
    idempotencyKey: idempotencyKey ?? this.idempotencyKey,
    method: method ?? this.method,
    path: path ?? this.path,
    bodyJson: bodyJson.present ? bodyJson.value : this.bodyJson,
    createdAtMs: createdAtMs ?? this.createdAtMs,
    attempts: attempts ?? this.attempts,
    nextAttemptAtMs: nextAttemptAtMs ?? this.nextAttemptAtMs,
    lastErrorCode: lastErrorCode.present
        ? lastErrorCode.value
        : this.lastErrorCode,
  );
  OutboxRow copyWithCompanion(OutboxCompanion data) {
    return OutboxRow(
      id: data.id.present ? data.id.value : this.id,
      userId: data.userId.present ? data.userId.value : this.userId,
      kind: data.kind.present ? data.kind.value : this.kind,
      idempotencyKey: data.idempotencyKey.present
          ? data.idempotencyKey.value
          : this.idempotencyKey,
      method: data.method.present ? data.method.value : this.method,
      path: data.path.present ? data.path.value : this.path,
      bodyJson: data.bodyJson.present ? data.bodyJson.value : this.bodyJson,
      createdAtMs: data.createdAtMs.present
          ? data.createdAtMs.value
          : this.createdAtMs,
      attempts: data.attempts.present ? data.attempts.value : this.attempts,
      nextAttemptAtMs: data.nextAttemptAtMs.present
          ? data.nextAttemptAtMs.value
          : this.nextAttemptAtMs,
      lastErrorCode: data.lastErrorCode.present
          ? data.lastErrorCode.value
          : this.lastErrorCode,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OutboxRow(')
          ..write('id: $id, ')
          ..write('userId: $userId, ')
          ..write('kind: $kind, ')
          ..write('idempotencyKey: $idempotencyKey, ')
          ..write('method: $method, ')
          ..write('path: $path, ')
          ..write('bodyJson: $bodyJson, ')
          ..write('createdAtMs: $createdAtMs, ')
          ..write('attempts: $attempts, ')
          ..write('nextAttemptAtMs: $nextAttemptAtMs, ')
          ..write('lastErrorCode: $lastErrorCode')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    userId,
    kind,
    idempotencyKey,
    method,
    path,
    bodyJson,
    createdAtMs,
    attempts,
    nextAttemptAtMs,
    lastErrorCode,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OutboxRow &&
          other.id == this.id &&
          other.userId == this.userId &&
          other.kind == this.kind &&
          other.idempotencyKey == this.idempotencyKey &&
          other.method == this.method &&
          other.path == this.path &&
          other.bodyJson == this.bodyJson &&
          other.createdAtMs == this.createdAtMs &&
          other.attempts == this.attempts &&
          other.nextAttemptAtMs == this.nextAttemptAtMs &&
          other.lastErrorCode == this.lastErrorCode);
}

class OutboxCompanion extends UpdateCompanion<OutboxRow> {
  final Value<int> id;
  final Value<String> userId;
  final Value<String> kind;
  final Value<String> idempotencyKey;
  final Value<String> method;
  final Value<String> path;
  final Value<String?> bodyJson;
  final Value<int> createdAtMs;
  final Value<int> attempts;
  final Value<int> nextAttemptAtMs;
  final Value<String?> lastErrorCode;
  const OutboxCompanion({
    this.id = const Value.absent(),
    this.userId = const Value.absent(),
    this.kind = const Value.absent(),
    this.idempotencyKey = const Value.absent(),
    this.method = const Value.absent(),
    this.path = const Value.absent(),
    this.bodyJson = const Value.absent(),
    this.createdAtMs = const Value.absent(),
    this.attempts = const Value.absent(),
    this.nextAttemptAtMs = const Value.absent(),
    this.lastErrorCode = const Value.absent(),
  });
  OutboxCompanion.insert({
    this.id = const Value.absent(),
    required String userId,
    required String kind,
    required String idempotencyKey,
    required String method,
    required String path,
    this.bodyJson = const Value.absent(),
    required int createdAtMs,
    this.attempts = const Value.absent(),
    this.nextAttemptAtMs = const Value.absent(),
    this.lastErrorCode = const Value.absent(),
  }) : userId = Value(userId),
       kind = Value(kind),
       idempotencyKey = Value(idempotencyKey),
       method = Value(method),
       path = Value(path),
       createdAtMs = Value(createdAtMs);
  static Insertable<OutboxRow> custom({
    Expression<int>? id,
    Expression<String>? userId,
    Expression<String>? kind,
    Expression<String>? idempotencyKey,
    Expression<String>? method,
    Expression<String>? path,
    Expression<String>? bodyJson,
    Expression<int>? createdAtMs,
    Expression<int>? attempts,
    Expression<int>? nextAttemptAtMs,
    Expression<String>? lastErrorCode,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (userId != null) 'user_id': userId,
      if (kind != null) 'kind': kind,
      if (idempotencyKey != null) 'idempotency_key': idempotencyKey,
      if (method != null) 'method': method,
      if (path != null) 'path': path,
      if (bodyJson != null) 'body_json': bodyJson,
      if (createdAtMs != null) 'created_at_ms': createdAtMs,
      if (attempts != null) 'attempts': attempts,
      if (nextAttemptAtMs != null) 'next_attempt_at_ms': nextAttemptAtMs,
      if (lastErrorCode != null) 'last_error_code': lastErrorCode,
    });
  }

  OutboxCompanion copyWith({
    Value<int>? id,
    Value<String>? userId,
    Value<String>? kind,
    Value<String>? idempotencyKey,
    Value<String>? method,
    Value<String>? path,
    Value<String?>? bodyJson,
    Value<int>? createdAtMs,
    Value<int>? attempts,
    Value<int>? nextAttemptAtMs,
    Value<String?>? lastErrorCode,
  }) {
    return OutboxCompanion(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      kind: kind ?? this.kind,
      idempotencyKey: idempotencyKey ?? this.idempotencyKey,
      method: method ?? this.method,
      path: path ?? this.path,
      bodyJson: bodyJson ?? this.bodyJson,
      createdAtMs: createdAtMs ?? this.createdAtMs,
      attempts: attempts ?? this.attempts,
      nextAttemptAtMs: nextAttemptAtMs ?? this.nextAttemptAtMs,
      lastErrorCode: lastErrorCode ?? this.lastErrorCode,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (kind.present) {
      map['kind'] = Variable<String>(kind.value);
    }
    if (idempotencyKey.present) {
      map['idempotency_key'] = Variable<String>(idempotencyKey.value);
    }
    if (method.present) {
      map['method'] = Variable<String>(method.value);
    }
    if (path.present) {
      map['path'] = Variable<String>(path.value);
    }
    if (bodyJson.present) {
      map['body_json'] = Variable<String>(bodyJson.value);
    }
    if (createdAtMs.present) {
      map['created_at_ms'] = Variable<int>(createdAtMs.value);
    }
    if (attempts.present) {
      map['attempts'] = Variable<int>(attempts.value);
    }
    if (nextAttemptAtMs.present) {
      map['next_attempt_at_ms'] = Variable<int>(nextAttemptAtMs.value);
    }
    if (lastErrorCode.present) {
      map['last_error_code'] = Variable<String>(lastErrorCode.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OutboxCompanion(')
          ..write('id: $id, ')
          ..write('userId: $userId, ')
          ..write('kind: $kind, ')
          ..write('idempotencyKey: $idempotencyKey, ')
          ..write('method: $method, ')
          ..write('path: $path, ')
          ..write('bodyJson: $bodyJson, ')
          ..write('createdAtMs: $createdAtMs, ')
          ..write('attempts: $attempts, ')
          ..write('nextAttemptAtMs: $nextAttemptAtMs, ')
          ..write('lastErrorCode: $lastErrorCode')
          ..write(')'))
        .toString();
  }
}

class $SessionDraftsTable extends SessionDrafts
    with TableInfo<$SessionDraftsTable, SessionDraftRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SessionDraftsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _draftKeyMeta = const VerificationMeta(
    'draftKey',
  );
  @override
  late final GeneratedColumn<String> draftKey = GeneratedColumn<String>(
    'draft_key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sessionIdMeta = const VerificationMeta(
    'sessionId',
  );
  @override
  late final GeneratedColumn<String> sessionId = GeneratedColumn<String>(
    'session_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _generationKeyMeta = const VerificationMeta(
    'generationKey',
  );
  @override
  late final GeneratedColumn<String> generationKey = GeneratedColumn<String>(
    'generation_key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadJsonMeta = const VerificationMeta(
    'payloadJson',
  );
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
    'payload_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _endsAtMsMeta = const VerificationMeta(
    'endsAtMs',
  );
  @override
  late final GeneratedColumn<int> endsAtMs = GeneratedColumn<int>(
    'ends_at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _pendingSubmissionMeta = const VerificationMeta(
    'pendingSubmission',
  );
  @override
  late final GeneratedColumn<bool> pendingSubmission = GeneratedColumn<bool>(
    'pending_submission',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("pending_submission" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _updatedAtMsMeta = const VerificationMeta(
    'updatedAtMs',
  );
  @override
  late final GeneratedColumn<int> updatedAtMs = GeneratedColumn<int>(
    'updated_at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    draftKey,
    userId,
    sessionId,
    generationKey,
    payloadJson,
    endsAtMs,
    pendingSubmission,
    updatedAtMs,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'session_drafts';
  @override
  VerificationContext validateIntegrity(
    Insertable<SessionDraftRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('draft_key')) {
      context.handle(
        _draftKeyMeta,
        draftKey.isAcceptableOrUnknown(data['draft_key']!, _draftKeyMeta),
      );
    } else if (isInserting) {
      context.missing(_draftKeyMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('session_id')) {
      context.handle(
        _sessionIdMeta,
        sessionId.isAcceptableOrUnknown(data['session_id']!, _sessionIdMeta),
      );
    } else if (isInserting) {
      context.missing(_sessionIdMeta);
    }
    if (data.containsKey('generation_key')) {
      context.handle(
        _generationKeyMeta,
        generationKey.isAcceptableOrUnknown(
          data['generation_key']!,
          _generationKeyMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_generationKeyMeta);
    }
    if (data.containsKey('payload_json')) {
      context.handle(
        _payloadJsonMeta,
        payloadJson.isAcceptableOrUnknown(
          data['payload_json']!,
          _payloadJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('ends_at_ms')) {
      context.handle(
        _endsAtMsMeta,
        endsAtMs.isAcceptableOrUnknown(data['ends_at_ms']!, _endsAtMsMeta),
      );
    } else if (isInserting) {
      context.missing(_endsAtMsMeta);
    }
    if (data.containsKey('pending_submission')) {
      context.handle(
        _pendingSubmissionMeta,
        pendingSubmission.isAcceptableOrUnknown(
          data['pending_submission']!,
          _pendingSubmissionMeta,
        ),
      );
    }
    if (data.containsKey('updated_at_ms')) {
      context.handle(
        _updatedAtMsMeta,
        updatedAtMs.isAcceptableOrUnknown(
          data['updated_at_ms']!,
          _updatedAtMsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMsMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {draftKey};
  @override
  SessionDraftRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SessionDraftRow(
      draftKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}draft_key'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      sessionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}session_id'],
      )!,
      generationKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}generation_key'],
      )!,
      payloadJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload_json'],
      )!,
      endsAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}ends_at_ms'],
      )!,
      pendingSubmission: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}pending_submission'],
      )!,
      updatedAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}updated_at_ms'],
      )!,
    );
  }

  @override
  $SessionDraftsTable createAlias(String alias) {
    return $SessionDraftsTable(attachedDatabase, alias);
  }
}

class SessionDraftRow extends DataClass implements Insertable<SessionDraftRow> {
  final String draftKey;
  final String userId;
  final String sessionId;
  final String generationKey;
  final String payloadJson;

  /// Wall-clock deadline, used only to decide whether a draft is still resumable after a kill.
  final int endsAtMs;
  final bool pendingSubmission;
  final int updatedAtMs;
  const SessionDraftRow({
    required this.draftKey,
    required this.userId,
    required this.sessionId,
    required this.generationKey,
    required this.payloadJson,
    required this.endsAtMs,
    required this.pendingSubmission,
    required this.updatedAtMs,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['draft_key'] = Variable<String>(draftKey);
    map['user_id'] = Variable<String>(userId);
    map['session_id'] = Variable<String>(sessionId);
    map['generation_key'] = Variable<String>(generationKey);
    map['payload_json'] = Variable<String>(payloadJson);
    map['ends_at_ms'] = Variable<int>(endsAtMs);
    map['pending_submission'] = Variable<bool>(pendingSubmission);
    map['updated_at_ms'] = Variable<int>(updatedAtMs);
    return map;
  }

  SessionDraftsCompanion toCompanion(bool nullToAbsent) {
    return SessionDraftsCompanion(
      draftKey: Value(draftKey),
      userId: Value(userId),
      sessionId: Value(sessionId),
      generationKey: Value(generationKey),
      payloadJson: Value(payloadJson),
      endsAtMs: Value(endsAtMs),
      pendingSubmission: Value(pendingSubmission),
      updatedAtMs: Value(updatedAtMs),
    );
  }

  factory SessionDraftRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SessionDraftRow(
      draftKey: serializer.fromJson<String>(json['draftKey']),
      userId: serializer.fromJson<String>(json['userId']),
      sessionId: serializer.fromJson<String>(json['sessionId']),
      generationKey: serializer.fromJson<String>(json['generationKey']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      endsAtMs: serializer.fromJson<int>(json['endsAtMs']),
      pendingSubmission: serializer.fromJson<bool>(json['pendingSubmission']),
      updatedAtMs: serializer.fromJson<int>(json['updatedAtMs']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'draftKey': serializer.toJson<String>(draftKey),
      'userId': serializer.toJson<String>(userId),
      'sessionId': serializer.toJson<String>(sessionId),
      'generationKey': serializer.toJson<String>(generationKey),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'endsAtMs': serializer.toJson<int>(endsAtMs),
      'pendingSubmission': serializer.toJson<bool>(pendingSubmission),
      'updatedAtMs': serializer.toJson<int>(updatedAtMs),
    };
  }

  SessionDraftRow copyWith({
    String? draftKey,
    String? userId,
    String? sessionId,
    String? generationKey,
    String? payloadJson,
    int? endsAtMs,
    bool? pendingSubmission,
    int? updatedAtMs,
  }) => SessionDraftRow(
    draftKey: draftKey ?? this.draftKey,
    userId: userId ?? this.userId,
    sessionId: sessionId ?? this.sessionId,
    generationKey: generationKey ?? this.generationKey,
    payloadJson: payloadJson ?? this.payloadJson,
    endsAtMs: endsAtMs ?? this.endsAtMs,
    pendingSubmission: pendingSubmission ?? this.pendingSubmission,
    updatedAtMs: updatedAtMs ?? this.updatedAtMs,
  );
  SessionDraftRow copyWithCompanion(SessionDraftsCompanion data) {
    return SessionDraftRow(
      draftKey: data.draftKey.present ? data.draftKey.value : this.draftKey,
      userId: data.userId.present ? data.userId.value : this.userId,
      sessionId: data.sessionId.present ? data.sessionId.value : this.sessionId,
      generationKey: data.generationKey.present
          ? data.generationKey.value
          : this.generationKey,
      payloadJson: data.payloadJson.present
          ? data.payloadJson.value
          : this.payloadJson,
      endsAtMs: data.endsAtMs.present ? data.endsAtMs.value : this.endsAtMs,
      pendingSubmission: data.pendingSubmission.present
          ? data.pendingSubmission.value
          : this.pendingSubmission,
      updatedAtMs: data.updatedAtMs.present
          ? data.updatedAtMs.value
          : this.updatedAtMs,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SessionDraftRow(')
          ..write('draftKey: $draftKey, ')
          ..write('userId: $userId, ')
          ..write('sessionId: $sessionId, ')
          ..write('generationKey: $generationKey, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('endsAtMs: $endsAtMs, ')
          ..write('pendingSubmission: $pendingSubmission, ')
          ..write('updatedAtMs: $updatedAtMs')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    draftKey,
    userId,
    sessionId,
    generationKey,
    payloadJson,
    endsAtMs,
    pendingSubmission,
    updatedAtMs,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SessionDraftRow &&
          other.draftKey == this.draftKey &&
          other.userId == this.userId &&
          other.sessionId == this.sessionId &&
          other.generationKey == this.generationKey &&
          other.payloadJson == this.payloadJson &&
          other.endsAtMs == this.endsAtMs &&
          other.pendingSubmission == this.pendingSubmission &&
          other.updatedAtMs == this.updatedAtMs);
}

class SessionDraftsCompanion extends UpdateCompanion<SessionDraftRow> {
  final Value<String> draftKey;
  final Value<String> userId;
  final Value<String> sessionId;
  final Value<String> generationKey;
  final Value<String> payloadJson;
  final Value<int> endsAtMs;
  final Value<bool> pendingSubmission;
  final Value<int> updatedAtMs;
  final Value<int> rowid;
  const SessionDraftsCompanion({
    this.draftKey = const Value.absent(),
    this.userId = const Value.absent(),
    this.sessionId = const Value.absent(),
    this.generationKey = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.endsAtMs = const Value.absent(),
    this.pendingSubmission = const Value.absent(),
    this.updatedAtMs = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SessionDraftsCompanion.insert({
    required String draftKey,
    required String userId,
    required String sessionId,
    required String generationKey,
    required String payloadJson,
    required int endsAtMs,
    this.pendingSubmission = const Value.absent(),
    required int updatedAtMs,
    this.rowid = const Value.absent(),
  }) : draftKey = Value(draftKey),
       userId = Value(userId),
       sessionId = Value(sessionId),
       generationKey = Value(generationKey),
       payloadJson = Value(payloadJson),
       endsAtMs = Value(endsAtMs),
       updatedAtMs = Value(updatedAtMs);
  static Insertable<SessionDraftRow> custom({
    Expression<String>? draftKey,
    Expression<String>? userId,
    Expression<String>? sessionId,
    Expression<String>? generationKey,
    Expression<String>? payloadJson,
    Expression<int>? endsAtMs,
    Expression<bool>? pendingSubmission,
    Expression<int>? updatedAtMs,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (draftKey != null) 'draft_key': draftKey,
      if (userId != null) 'user_id': userId,
      if (sessionId != null) 'session_id': sessionId,
      if (generationKey != null) 'generation_key': generationKey,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (endsAtMs != null) 'ends_at_ms': endsAtMs,
      if (pendingSubmission != null) 'pending_submission': pendingSubmission,
      if (updatedAtMs != null) 'updated_at_ms': updatedAtMs,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SessionDraftsCompanion copyWith({
    Value<String>? draftKey,
    Value<String>? userId,
    Value<String>? sessionId,
    Value<String>? generationKey,
    Value<String>? payloadJson,
    Value<int>? endsAtMs,
    Value<bool>? pendingSubmission,
    Value<int>? updatedAtMs,
    Value<int>? rowid,
  }) {
    return SessionDraftsCompanion(
      draftKey: draftKey ?? this.draftKey,
      userId: userId ?? this.userId,
      sessionId: sessionId ?? this.sessionId,
      generationKey: generationKey ?? this.generationKey,
      payloadJson: payloadJson ?? this.payloadJson,
      endsAtMs: endsAtMs ?? this.endsAtMs,
      pendingSubmission: pendingSubmission ?? this.pendingSubmission,
      updatedAtMs: updatedAtMs ?? this.updatedAtMs,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (draftKey.present) {
      map['draft_key'] = Variable<String>(draftKey.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (sessionId.present) {
      map['session_id'] = Variable<String>(sessionId.value);
    }
    if (generationKey.present) {
      map['generation_key'] = Variable<String>(generationKey.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (endsAtMs.present) {
      map['ends_at_ms'] = Variable<int>(endsAtMs.value);
    }
    if (pendingSubmission.present) {
      map['pending_submission'] = Variable<bool>(pendingSubmission.value);
    }
    if (updatedAtMs.present) {
      map['updated_at_ms'] = Variable<int>(updatedAtMs.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SessionDraftsCompanion(')
          ..write('draftKey: $draftKey, ')
          ..write('userId: $userId, ')
          ..write('sessionId: $sessionId, ')
          ..write('generationKey: $generationKey, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('endsAtMs: $endsAtMs, ')
          ..write('pendingSubmission: $pendingSubmission, ')
          ..write('updatedAtMs: $updatedAtMs, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedPlanTable extends CachedPlan
    with TableInfo<$CachedPlanTable, CachedPlanRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedPlanTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _minutesMeta = const VerificationMeta(
    'minutes',
  );
  @override
  late final GeneratedColumn<int> minutes = GeneratedColumn<int>(
    'minutes',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _jsonMeta = const VerificationMeta('json');
  @override
  late final GeneratedColumn<String> json = GeneratedColumn<String>(
    'json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _fetchedAtMsMeta = const VerificationMeta(
    'fetchedAtMs',
  );
  @override
  late final GeneratedColumn<int> fetchedAtMs = GeneratedColumn<int>(
    'fetched_at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [userId, minutes, json, fetchedAtMs];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_plan';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedPlanRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('minutes')) {
      context.handle(
        _minutesMeta,
        minutes.isAcceptableOrUnknown(data['minutes']!, _minutesMeta),
      );
    } else if (isInserting) {
      context.missing(_minutesMeta);
    }
    if (data.containsKey('json')) {
      context.handle(
        _jsonMeta,
        json.isAcceptableOrUnknown(data['json']!, _jsonMeta),
      );
    } else if (isInserting) {
      context.missing(_jsonMeta);
    }
    if (data.containsKey('fetched_at_ms')) {
      context.handle(
        _fetchedAtMsMeta,
        fetchedAtMs.isAcceptableOrUnknown(
          data['fetched_at_ms']!,
          _fetchedAtMsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_fetchedAtMsMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, minutes};
  @override
  CachedPlanRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedPlanRow(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      minutes: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}minutes'],
      )!,
      json: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}json'],
      )!,
      fetchedAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}fetched_at_ms'],
      )!,
    );
  }

  @override
  $CachedPlanTable createAlias(String alias) {
    return $CachedPlanTable(attachedDatabase, alias);
  }
}

class CachedPlanRow extends DataClass implements Insertable<CachedPlanRow> {
  final String userId;
  final int minutes;
  final String json;
  final int fetchedAtMs;
  const CachedPlanRow({
    required this.userId,
    required this.minutes,
    required this.json,
    required this.fetchedAtMs,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['minutes'] = Variable<int>(minutes);
    map['json'] = Variable<String>(json);
    map['fetched_at_ms'] = Variable<int>(fetchedAtMs);
    return map;
  }

  CachedPlanCompanion toCompanion(bool nullToAbsent) {
    return CachedPlanCompanion(
      userId: Value(userId),
      minutes: Value(minutes),
      json: Value(json),
      fetchedAtMs: Value(fetchedAtMs),
    );
  }

  factory CachedPlanRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedPlanRow(
      userId: serializer.fromJson<String>(json['userId']),
      minutes: serializer.fromJson<int>(json['minutes']),
      json: serializer.fromJson<String>(json['json']),
      fetchedAtMs: serializer.fromJson<int>(json['fetchedAtMs']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'minutes': serializer.toJson<int>(minutes),
      'json': serializer.toJson<String>(json),
      'fetchedAtMs': serializer.toJson<int>(fetchedAtMs),
    };
  }

  CachedPlanRow copyWith({
    String? userId,
    int? minutes,
    String? json,
    int? fetchedAtMs,
  }) => CachedPlanRow(
    userId: userId ?? this.userId,
    minutes: minutes ?? this.minutes,
    json: json ?? this.json,
    fetchedAtMs: fetchedAtMs ?? this.fetchedAtMs,
  );
  CachedPlanRow copyWithCompanion(CachedPlanCompanion data) {
    return CachedPlanRow(
      userId: data.userId.present ? data.userId.value : this.userId,
      minutes: data.minutes.present ? data.minutes.value : this.minutes,
      json: data.json.present ? data.json.value : this.json,
      fetchedAtMs: data.fetchedAtMs.present
          ? data.fetchedAtMs.value
          : this.fetchedAtMs,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedPlanRow(')
          ..write('userId: $userId, ')
          ..write('minutes: $minutes, ')
          ..write('json: $json, ')
          ..write('fetchedAtMs: $fetchedAtMs')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(userId, minutes, json, fetchedAtMs);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedPlanRow &&
          other.userId == this.userId &&
          other.minutes == this.minutes &&
          other.json == this.json &&
          other.fetchedAtMs == this.fetchedAtMs);
}

class CachedPlanCompanion extends UpdateCompanion<CachedPlanRow> {
  final Value<String> userId;
  final Value<int> minutes;
  final Value<String> json;
  final Value<int> fetchedAtMs;
  final Value<int> rowid;
  const CachedPlanCompanion({
    this.userId = const Value.absent(),
    this.minutes = const Value.absent(),
    this.json = const Value.absent(),
    this.fetchedAtMs = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedPlanCompanion.insert({
    required String userId,
    required int minutes,
    required String json,
    required int fetchedAtMs,
    this.rowid = const Value.absent(),
  }) : userId = Value(userId),
       minutes = Value(minutes),
       json = Value(json),
       fetchedAtMs = Value(fetchedAtMs);
  static Insertable<CachedPlanRow> custom({
    Expression<String>? userId,
    Expression<int>? minutes,
    Expression<String>? json,
    Expression<int>? fetchedAtMs,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (minutes != null) 'minutes': minutes,
      if (json != null) 'json': json,
      if (fetchedAtMs != null) 'fetched_at_ms': fetchedAtMs,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedPlanCompanion copyWith({
    Value<String>? userId,
    Value<int>? minutes,
    Value<String>? json,
    Value<int>? fetchedAtMs,
    Value<int>? rowid,
  }) {
    return CachedPlanCompanion(
      userId: userId ?? this.userId,
      minutes: minutes ?? this.minutes,
      json: json ?? this.json,
      fetchedAtMs: fetchedAtMs ?? this.fetchedAtMs,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (minutes.present) {
      map['minutes'] = Variable<int>(minutes.value);
    }
    if (json.present) {
      map['json'] = Variable<String>(json.value);
    }
    if (fetchedAtMs.present) {
      map['fetched_at_ms'] = Variable<int>(fetchedAtMs.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedPlanCompanion(')
          ..write('userId: $userId, ')
          ..write('minutes: $minutes, ')
          ..write('json: $json, ')
          ..write('fetchedAtMs: $fetchedAtMs, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedAttemptsTable extends CachedAttempts
    with TableInfo<$CachedAttemptsTable, CachedAttemptRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedAttemptsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _attemptIdMeta = const VerificationMeta(
    'attemptId',
  );
  @override
  late final GeneratedColumn<String> attemptId = GeneratedColumn<String>(
    'attempt_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _subjectMeta = const VerificationMeta(
    'subject',
  );
  @override
  late final GeneratedColumn<String> subject = GeneratedColumn<String>(
    'subject',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _completedAtMsMeta = const VerificationMeta(
    'completedAtMs',
  );
  @override
  late final GeneratedColumn<int> completedAtMs = GeneratedColumn<int>(
    'completed_at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _jsonMeta = const VerificationMeta('json');
  @override
  late final GeneratedColumn<String> json = GeneratedColumn<String>(
    'json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _fetchedAtMsMeta = const VerificationMeta(
    'fetchedAtMs',
  );
  @override
  late final GeneratedColumn<int> fetchedAtMs = GeneratedColumn<int>(
    'fetched_at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    userId,
    attemptId,
    subject,
    completedAtMs,
    json,
    fetchedAtMs,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_attempts';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedAttemptRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('attempt_id')) {
      context.handle(
        _attemptIdMeta,
        attemptId.isAcceptableOrUnknown(data['attempt_id']!, _attemptIdMeta),
      );
    } else if (isInserting) {
      context.missing(_attemptIdMeta);
    }
    if (data.containsKey('subject')) {
      context.handle(
        _subjectMeta,
        subject.isAcceptableOrUnknown(data['subject']!, _subjectMeta),
      );
    } else if (isInserting) {
      context.missing(_subjectMeta);
    }
    if (data.containsKey('completed_at_ms')) {
      context.handle(
        _completedAtMsMeta,
        completedAtMs.isAcceptableOrUnknown(
          data['completed_at_ms']!,
          _completedAtMsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_completedAtMsMeta);
    }
    if (data.containsKey('json')) {
      context.handle(
        _jsonMeta,
        json.isAcceptableOrUnknown(data['json']!, _jsonMeta),
      );
    } else if (isInserting) {
      context.missing(_jsonMeta);
    }
    if (data.containsKey('fetched_at_ms')) {
      context.handle(
        _fetchedAtMsMeta,
        fetchedAtMs.isAcceptableOrUnknown(
          data['fetched_at_ms']!,
          _fetchedAtMsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_fetchedAtMsMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, attemptId};
  @override
  CachedAttemptRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedAttemptRow(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      attemptId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}attempt_id'],
      )!,
      subject: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}subject'],
      )!,
      completedAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}completed_at_ms'],
      )!,
      json: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}json'],
      )!,
      fetchedAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}fetched_at_ms'],
      )!,
    );
  }

  @override
  $CachedAttemptsTable createAlias(String alias) {
    return $CachedAttemptsTable(attachedDatabase, alias);
  }
}

class CachedAttemptRow extends DataClass
    implements Insertable<CachedAttemptRow> {
  final String userId;
  final String attemptId;
  final String subject;
  final int completedAtMs;
  final String json;
  final int fetchedAtMs;
  const CachedAttemptRow({
    required this.userId,
    required this.attemptId,
    required this.subject,
    required this.completedAtMs,
    required this.json,
    required this.fetchedAtMs,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['attempt_id'] = Variable<String>(attemptId);
    map['subject'] = Variable<String>(subject);
    map['completed_at_ms'] = Variable<int>(completedAtMs);
    map['json'] = Variable<String>(json);
    map['fetched_at_ms'] = Variable<int>(fetchedAtMs);
    return map;
  }

  CachedAttemptsCompanion toCompanion(bool nullToAbsent) {
    return CachedAttemptsCompanion(
      userId: Value(userId),
      attemptId: Value(attemptId),
      subject: Value(subject),
      completedAtMs: Value(completedAtMs),
      json: Value(json),
      fetchedAtMs: Value(fetchedAtMs),
    );
  }

  factory CachedAttemptRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedAttemptRow(
      userId: serializer.fromJson<String>(json['userId']),
      attemptId: serializer.fromJson<String>(json['attemptId']),
      subject: serializer.fromJson<String>(json['subject']),
      completedAtMs: serializer.fromJson<int>(json['completedAtMs']),
      json: serializer.fromJson<String>(json['json']),
      fetchedAtMs: serializer.fromJson<int>(json['fetchedAtMs']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'attemptId': serializer.toJson<String>(attemptId),
      'subject': serializer.toJson<String>(subject),
      'completedAtMs': serializer.toJson<int>(completedAtMs),
      'json': serializer.toJson<String>(json),
      'fetchedAtMs': serializer.toJson<int>(fetchedAtMs),
    };
  }

  CachedAttemptRow copyWith({
    String? userId,
    String? attemptId,
    String? subject,
    int? completedAtMs,
    String? json,
    int? fetchedAtMs,
  }) => CachedAttemptRow(
    userId: userId ?? this.userId,
    attemptId: attemptId ?? this.attemptId,
    subject: subject ?? this.subject,
    completedAtMs: completedAtMs ?? this.completedAtMs,
    json: json ?? this.json,
    fetchedAtMs: fetchedAtMs ?? this.fetchedAtMs,
  );
  CachedAttemptRow copyWithCompanion(CachedAttemptsCompanion data) {
    return CachedAttemptRow(
      userId: data.userId.present ? data.userId.value : this.userId,
      attemptId: data.attemptId.present ? data.attemptId.value : this.attemptId,
      subject: data.subject.present ? data.subject.value : this.subject,
      completedAtMs: data.completedAtMs.present
          ? data.completedAtMs.value
          : this.completedAtMs,
      json: data.json.present ? data.json.value : this.json,
      fetchedAtMs: data.fetchedAtMs.present
          ? data.fetchedAtMs.value
          : this.fetchedAtMs,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedAttemptRow(')
          ..write('userId: $userId, ')
          ..write('attemptId: $attemptId, ')
          ..write('subject: $subject, ')
          ..write('completedAtMs: $completedAtMs, ')
          ..write('json: $json, ')
          ..write('fetchedAtMs: $fetchedAtMs')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(userId, attemptId, subject, completedAtMs, json, fetchedAtMs);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedAttemptRow &&
          other.userId == this.userId &&
          other.attemptId == this.attemptId &&
          other.subject == this.subject &&
          other.completedAtMs == this.completedAtMs &&
          other.json == this.json &&
          other.fetchedAtMs == this.fetchedAtMs);
}

class CachedAttemptsCompanion extends UpdateCompanion<CachedAttemptRow> {
  final Value<String> userId;
  final Value<String> attemptId;
  final Value<String> subject;
  final Value<int> completedAtMs;
  final Value<String> json;
  final Value<int> fetchedAtMs;
  final Value<int> rowid;
  const CachedAttemptsCompanion({
    this.userId = const Value.absent(),
    this.attemptId = const Value.absent(),
    this.subject = const Value.absent(),
    this.completedAtMs = const Value.absent(),
    this.json = const Value.absent(),
    this.fetchedAtMs = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedAttemptsCompanion.insert({
    required String userId,
    required String attemptId,
    required String subject,
    required int completedAtMs,
    required String json,
    required int fetchedAtMs,
    this.rowid = const Value.absent(),
  }) : userId = Value(userId),
       attemptId = Value(attemptId),
       subject = Value(subject),
       completedAtMs = Value(completedAtMs),
       json = Value(json),
       fetchedAtMs = Value(fetchedAtMs);
  static Insertable<CachedAttemptRow> custom({
    Expression<String>? userId,
    Expression<String>? attemptId,
    Expression<String>? subject,
    Expression<int>? completedAtMs,
    Expression<String>? json,
    Expression<int>? fetchedAtMs,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (attemptId != null) 'attempt_id': attemptId,
      if (subject != null) 'subject': subject,
      if (completedAtMs != null) 'completed_at_ms': completedAtMs,
      if (json != null) 'json': json,
      if (fetchedAtMs != null) 'fetched_at_ms': fetchedAtMs,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedAttemptsCompanion copyWith({
    Value<String>? userId,
    Value<String>? attemptId,
    Value<String>? subject,
    Value<int>? completedAtMs,
    Value<String>? json,
    Value<int>? fetchedAtMs,
    Value<int>? rowid,
  }) {
    return CachedAttemptsCompanion(
      userId: userId ?? this.userId,
      attemptId: attemptId ?? this.attemptId,
      subject: subject ?? this.subject,
      completedAtMs: completedAtMs ?? this.completedAtMs,
      json: json ?? this.json,
      fetchedAtMs: fetchedAtMs ?? this.fetchedAtMs,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (attemptId.present) {
      map['attempt_id'] = Variable<String>(attemptId.value);
    }
    if (subject.present) {
      map['subject'] = Variable<String>(subject.value);
    }
    if (completedAtMs.present) {
      map['completed_at_ms'] = Variable<int>(completedAtMs.value);
    }
    if (json.present) {
      map['json'] = Variable<String>(json.value);
    }
    if (fetchedAtMs.present) {
      map['fetched_at_ms'] = Variable<int>(fetchedAtMs.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedAttemptsCompanion(')
          ..write('userId: $userId, ')
          ..write('attemptId: $attemptId, ')
          ..write('subject: $subject, ')
          ..write('completedAtMs: $completedAtMs, ')
          ..write('json: $json, ')
          ..write('fetchedAtMs: $fetchedAtMs, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CacheEntriesTable extends CacheEntries
    with TableInfo<$CacheEntriesTable, CacheEntryRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CacheEntriesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cacheKeyMeta = const VerificationMeta(
    'cacheKey',
  );
  @override
  late final GeneratedColumn<String> cacheKey = GeneratedColumn<String>(
    'cache_key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _jsonMeta = const VerificationMeta('json');
  @override
  late final GeneratedColumn<String> json = GeneratedColumn<String>(
    'json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _fetchedAtMsMeta = const VerificationMeta(
    'fetchedAtMs',
  );
  @override
  late final GeneratedColumn<int> fetchedAtMs = GeneratedColumn<int>(
    'fetched_at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [userId, cacheKey, json, fetchedAtMs];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cache_entries';
  @override
  VerificationContext validateIntegrity(
    Insertable<CacheEntryRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('cache_key')) {
      context.handle(
        _cacheKeyMeta,
        cacheKey.isAcceptableOrUnknown(data['cache_key']!, _cacheKeyMeta),
      );
    } else if (isInserting) {
      context.missing(_cacheKeyMeta);
    }
    if (data.containsKey('json')) {
      context.handle(
        _jsonMeta,
        json.isAcceptableOrUnknown(data['json']!, _jsonMeta),
      );
    } else if (isInserting) {
      context.missing(_jsonMeta);
    }
    if (data.containsKey('fetched_at_ms')) {
      context.handle(
        _fetchedAtMsMeta,
        fetchedAtMs.isAcceptableOrUnknown(
          data['fetched_at_ms']!,
          _fetchedAtMsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_fetchedAtMsMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, cacheKey};
  @override
  CacheEntryRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CacheEntryRow(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      cacheKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}cache_key'],
      )!,
      json: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}json'],
      )!,
      fetchedAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}fetched_at_ms'],
      )!,
    );
  }

  @override
  $CacheEntriesTable createAlias(String alias) {
    return $CacheEntriesTable(attachedDatabase, alias);
  }
}

class CacheEntryRow extends DataClass implements Insertable<CacheEntryRow> {
  final String userId;
  final String cacheKey;
  final String json;
  final int fetchedAtMs;
  const CacheEntryRow({
    required this.userId,
    required this.cacheKey,
    required this.json,
    required this.fetchedAtMs,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['cache_key'] = Variable<String>(cacheKey);
    map['json'] = Variable<String>(json);
    map['fetched_at_ms'] = Variable<int>(fetchedAtMs);
    return map;
  }

  CacheEntriesCompanion toCompanion(bool nullToAbsent) {
    return CacheEntriesCompanion(
      userId: Value(userId),
      cacheKey: Value(cacheKey),
      json: Value(json),
      fetchedAtMs: Value(fetchedAtMs),
    );
  }

  factory CacheEntryRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CacheEntryRow(
      userId: serializer.fromJson<String>(json['userId']),
      cacheKey: serializer.fromJson<String>(json['cacheKey']),
      json: serializer.fromJson<String>(json['json']),
      fetchedAtMs: serializer.fromJson<int>(json['fetchedAtMs']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'cacheKey': serializer.toJson<String>(cacheKey),
      'json': serializer.toJson<String>(json),
      'fetchedAtMs': serializer.toJson<int>(fetchedAtMs),
    };
  }

  CacheEntryRow copyWith({
    String? userId,
    String? cacheKey,
    String? json,
    int? fetchedAtMs,
  }) => CacheEntryRow(
    userId: userId ?? this.userId,
    cacheKey: cacheKey ?? this.cacheKey,
    json: json ?? this.json,
    fetchedAtMs: fetchedAtMs ?? this.fetchedAtMs,
  );
  CacheEntryRow copyWithCompanion(CacheEntriesCompanion data) {
    return CacheEntryRow(
      userId: data.userId.present ? data.userId.value : this.userId,
      cacheKey: data.cacheKey.present ? data.cacheKey.value : this.cacheKey,
      json: data.json.present ? data.json.value : this.json,
      fetchedAtMs: data.fetchedAtMs.present
          ? data.fetchedAtMs.value
          : this.fetchedAtMs,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CacheEntryRow(')
          ..write('userId: $userId, ')
          ..write('cacheKey: $cacheKey, ')
          ..write('json: $json, ')
          ..write('fetchedAtMs: $fetchedAtMs')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(userId, cacheKey, json, fetchedAtMs);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CacheEntryRow &&
          other.userId == this.userId &&
          other.cacheKey == this.cacheKey &&
          other.json == this.json &&
          other.fetchedAtMs == this.fetchedAtMs);
}

class CacheEntriesCompanion extends UpdateCompanion<CacheEntryRow> {
  final Value<String> userId;
  final Value<String> cacheKey;
  final Value<String> json;
  final Value<int> fetchedAtMs;
  final Value<int> rowid;
  const CacheEntriesCompanion({
    this.userId = const Value.absent(),
    this.cacheKey = const Value.absent(),
    this.json = const Value.absent(),
    this.fetchedAtMs = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CacheEntriesCompanion.insert({
    required String userId,
    required String cacheKey,
    required String json,
    required int fetchedAtMs,
    this.rowid = const Value.absent(),
  }) : userId = Value(userId),
       cacheKey = Value(cacheKey),
       json = Value(json),
       fetchedAtMs = Value(fetchedAtMs);
  static Insertable<CacheEntryRow> custom({
    Expression<String>? userId,
    Expression<String>? cacheKey,
    Expression<String>? json,
    Expression<int>? fetchedAtMs,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (cacheKey != null) 'cache_key': cacheKey,
      if (json != null) 'json': json,
      if (fetchedAtMs != null) 'fetched_at_ms': fetchedAtMs,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CacheEntriesCompanion copyWith({
    Value<String>? userId,
    Value<String>? cacheKey,
    Value<String>? json,
    Value<int>? fetchedAtMs,
    Value<int>? rowid,
  }) {
    return CacheEntriesCompanion(
      userId: userId ?? this.userId,
      cacheKey: cacheKey ?? this.cacheKey,
      json: json ?? this.json,
      fetchedAtMs: fetchedAtMs ?? this.fetchedAtMs,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (cacheKey.present) {
      map['cache_key'] = Variable<String>(cacheKey.value);
    }
    if (json.present) {
      map['json'] = Variable<String>(json.value);
    }
    if (fetchedAtMs.present) {
      map['fetched_at_ms'] = Variable<int>(fetchedAtMs.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CacheEntriesCompanion(')
          ..write('userId: $userId, ')
          ..write('cacheKey: $cacheKey, ')
          ..write('json: $json, ')
          ..write('fetchedAtMs: $fetchedAtMs, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $LearnCacheTable extends LearnCache
    with TableInfo<$LearnCacheTable, LearnCacheRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LearnCacheTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cacheKeyMeta = const VerificationMeta(
    'cacheKey',
  );
  @override
  late final GeneratedColumn<String> cacheKey = GeneratedColumn<String>(
    'cache_key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _versionMeta = const VerificationMeta(
    'version',
  );
  @override
  late final GeneratedColumn<String> version = GeneratedColumn<String>(
    'version',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _contentHashMeta = const VerificationMeta(
    'contentHash',
  );
  @override
  late final GeneratedColumn<String> contentHash = GeneratedColumn<String>(
    'content_hash',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _jsonMeta = const VerificationMeta('json');
  @override
  late final GeneratedColumn<String> json = GeneratedColumn<String>(
    'json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sizeBytesMeta = const VerificationMeta(
    'sizeBytes',
  );
  @override
  late final GeneratedColumn<int> sizeBytes = GeneratedColumn<int>(
    'size_bytes',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _updatedAtMsMeta = const VerificationMeta(
    'updatedAtMs',
  );
  @override
  late final GeneratedColumn<int> updatedAtMs = GeneratedColumn<int>(
    'updated_at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    userId,
    cacheKey,
    version,
    contentHash,
    json,
    sizeBytes,
    updatedAtMs,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'learn_cache';
  @override
  VerificationContext validateIntegrity(
    Insertable<LearnCacheRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('cache_key')) {
      context.handle(
        _cacheKeyMeta,
        cacheKey.isAcceptableOrUnknown(data['cache_key']!, _cacheKeyMeta),
      );
    } else if (isInserting) {
      context.missing(_cacheKeyMeta);
    }
    if (data.containsKey('version')) {
      context.handle(
        _versionMeta,
        version.isAcceptableOrUnknown(data['version']!, _versionMeta),
      );
    }
    if (data.containsKey('content_hash')) {
      context.handle(
        _contentHashMeta,
        contentHash.isAcceptableOrUnknown(
          data['content_hash']!,
          _contentHashMeta,
        ),
      );
    }
    if (data.containsKey('json')) {
      context.handle(
        _jsonMeta,
        json.isAcceptableOrUnknown(data['json']!, _jsonMeta),
      );
    } else if (isInserting) {
      context.missing(_jsonMeta);
    }
    if (data.containsKey('size_bytes')) {
      context.handle(
        _sizeBytesMeta,
        sizeBytes.isAcceptableOrUnknown(data['size_bytes']!, _sizeBytesMeta),
      );
    }
    if (data.containsKey('updated_at_ms')) {
      context.handle(
        _updatedAtMsMeta,
        updatedAtMs.isAcceptableOrUnknown(
          data['updated_at_ms']!,
          _updatedAtMsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMsMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, cacheKey};
  @override
  LearnCacheRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return LearnCacheRow(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      cacheKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}cache_key'],
      )!,
      version: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}version'],
      )!,
      contentHash: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}content_hash'],
      )!,
      json: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}json'],
      )!,
      sizeBytes: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}size_bytes'],
      )!,
      updatedAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}updated_at_ms'],
      )!,
    );
  }

  @override
  $LearnCacheTable createAlias(String alias) {
    return $LearnCacheTable(attachedDatabase, alias);
  }
}

class LearnCacheRow extends DataClass implements Insertable<LearnCacheRow> {
  final String userId;
  final String cacheKey;
  final String version;
  final String contentHash;
  final String json;
  final int sizeBytes;
  final int updatedAtMs;
  const LearnCacheRow({
    required this.userId,
    required this.cacheKey,
    required this.version,
    required this.contentHash,
    required this.json,
    required this.sizeBytes,
    required this.updatedAtMs,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['cache_key'] = Variable<String>(cacheKey);
    map['version'] = Variable<String>(version);
    map['content_hash'] = Variable<String>(contentHash);
    map['json'] = Variable<String>(json);
    map['size_bytes'] = Variable<int>(sizeBytes);
    map['updated_at_ms'] = Variable<int>(updatedAtMs);
    return map;
  }

  LearnCacheCompanion toCompanion(bool nullToAbsent) {
    return LearnCacheCompanion(
      userId: Value(userId),
      cacheKey: Value(cacheKey),
      version: Value(version),
      contentHash: Value(contentHash),
      json: Value(json),
      sizeBytes: Value(sizeBytes),
      updatedAtMs: Value(updatedAtMs),
    );
  }

  factory LearnCacheRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return LearnCacheRow(
      userId: serializer.fromJson<String>(json['userId']),
      cacheKey: serializer.fromJson<String>(json['cacheKey']),
      version: serializer.fromJson<String>(json['version']),
      contentHash: serializer.fromJson<String>(json['contentHash']),
      json: serializer.fromJson<String>(json['json']),
      sizeBytes: serializer.fromJson<int>(json['sizeBytes']),
      updatedAtMs: serializer.fromJson<int>(json['updatedAtMs']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'cacheKey': serializer.toJson<String>(cacheKey),
      'version': serializer.toJson<String>(version),
      'contentHash': serializer.toJson<String>(contentHash),
      'json': serializer.toJson<String>(json),
      'sizeBytes': serializer.toJson<int>(sizeBytes),
      'updatedAtMs': serializer.toJson<int>(updatedAtMs),
    };
  }

  LearnCacheRow copyWith({
    String? userId,
    String? cacheKey,
    String? version,
    String? contentHash,
    String? json,
    int? sizeBytes,
    int? updatedAtMs,
  }) => LearnCacheRow(
    userId: userId ?? this.userId,
    cacheKey: cacheKey ?? this.cacheKey,
    version: version ?? this.version,
    contentHash: contentHash ?? this.contentHash,
    json: json ?? this.json,
    sizeBytes: sizeBytes ?? this.sizeBytes,
    updatedAtMs: updatedAtMs ?? this.updatedAtMs,
  );
  LearnCacheRow copyWithCompanion(LearnCacheCompanion data) {
    return LearnCacheRow(
      userId: data.userId.present ? data.userId.value : this.userId,
      cacheKey: data.cacheKey.present ? data.cacheKey.value : this.cacheKey,
      version: data.version.present ? data.version.value : this.version,
      contentHash: data.contentHash.present
          ? data.contentHash.value
          : this.contentHash,
      json: data.json.present ? data.json.value : this.json,
      sizeBytes: data.sizeBytes.present ? data.sizeBytes.value : this.sizeBytes,
      updatedAtMs: data.updatedAtMs.present
          ? data.updatedAtMs.value
          : this.updatedAtMs,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LearnCacheRow(')
          ..write('userId: $userId, ')
          ..write('cacheKey: $cacheKey, ')
          ..write('version: $version, ')
          ..write('contentHash: $contentHash, ')
          ..write('json: $json, ')
          ..write('sizeBytes: $sizeBytes, ')
          ..write('updatedAtMs: $updatedAtMs')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    userId,
    cacheKey,
    version,
    contentHash,
    json,
    sizeBytes,
    updatedAtMs,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LearnCacheRow &&
          other.userId == this.userId &&
          other.cacheKey == this.cacheKey &&
          other.version == this.version &&
          other.contentHash == this.contentHash &&
          other.json == this.json &&
          other.sizeBytes == this.sizeBytes &&
          other.updatedAtMs == this.updatedAtMs);
}

class LearnCacheCompanion extends UpdateCompanion<LearnCacheRow> {
  final Value<String> userId;
  final Value<String> cacheKey;
  final Value<String> version;
  final Value<String> contentHash;
  final Value<String> json;
  final Value<int> sizeBytes;
  final Value<int> updatedAtMs;
  final Value<int> rowid;
  const LearnCacheCompanion({
    this.userId = const Value.absent(),
    this.cacheKey = const Value.absent(),
    this.version = const Value.absent(),
    this.contentHash = const Value.absent(),
    this.json = const Value.absent(),
    this.sizeBytes = const Value.absent(),
    this.updatedAtMs = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LearnCacheCompanion.insert({
    required String userId,
    required String cacheKey,
    this.version = const Value.absent(),
    this.contentHash = const Value.absent(),
    required String json,
    this.sizeBytes = const Value.absent(),
    required int updatedAtMs,
    this.rowid = const Value.absent(),
  }) : userId = Value(userId),
       cacheKey = Value(cacheKey),
       json = Value(json),
       updatedAtMs = Value(updatedAtMs);
  static Insertable<LearnCacheRow> custom({
    Expression<String>? userId,
    Expression<String>? cacheKey,
    Expression<String>? version,
    Expression<String>? contentHash,
    Expression<String>? json,
    Expression<int>? sizeBytes,
    Expression<int>? updatedAtMs,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (cacheKey != null) 'cache_key': cacheKey,
      if (version != null) 'version': version,
      if (contentHash != null) 'content_hash': contentHash,
      if (json != null) 'json': json,
      if (sizeBytes != null) 'size_bytes': sizeBytes,
      if (updatedAtMs != null) 'updated_at_ms': updatedAtMs,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LearnCacheCompanion copyWith({
    Value<String>? userId,
    Value<String>? cacheKey,
    Value<String>? version,
    Value<String>? contentHash,
    Value<String>? json,
    Value<int>? sizeBytes,
    Value<int>? updatedAtMs,
    Value<int>? rowid,
  }) {
    return LearnCacheCompanion(
      userId: userId ?? this.userId,
      cacheKey: cacheKey ?? this.cacheKey,
      version: version ?? this.version,
      contentHash: contentHash ?? this.contentHash,
      json: json ?? this.json,
      sizeBytes: sizeBytes ?? this.sizeBytes,
      updatedAtMs: updatedAtMs ?? this.updatedAtMs,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (cacheKey.present) {
      map['cache_key'] = Variable<String>(cacheKey.value);
    }
    if (version.present) {
      map['version'] = Variable<String>(version.value);
    }
    if (contentHash.present) {
      map['content_hash'] = Variable<String>(contentHash.value);
    }
    if (json.present) {
      map['json'] = Variable<String>(json.value);
    }
    if (sizeBytes.present) {
      map['size_bytes'] = Variable<int>(sizeBytes.value);
    }
    if (updatedAtMs.present) {
      map['updated_at_ms'] = Variable<int>(updatedAtMs.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LearnCacheCompanion(')
          ..write('userId: $userId, ')
          ..write('cacheKey: $cacheKey, ')
          ..write('version: $version, ')
          ..write('contentHash: $contentHash, ')
          ..write('json: $json, ')
          ..write('sizeBytes: $sizeBytes, ')
          ..write('updatedAtMs: $updatedAtMs, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ReviewLogTable extends ReviewLog
    with TableInfo<$ReviewLogTable, ReviewLogRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ReviewLogTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _attemptIdMeta = const VerificationMeta(
    'attemptId',
  );
  @override
  late final GeneratedColumn<String> attemptId = GeneratedColumn<String>(
    'attempt_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _questionIdMeta = const VerificationMeta(
    'questionId',
  );
  @override
  late final GeneratedColumn<String> questionId = GeneratedColumn<String>(
    'question_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _kindMeta = const VerificationMeta('kind');
  @override
  late final GeneratedColumn<String> kind = GeneratedColumn<String>(
    'kind',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _atMsMeta = const VerificationMeta('atMs');
  @override
  late final GeneratedColumn<int> atMs = GeneratedColumn<int>(
    'at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    userId,
    attemptId,
    questionId,
    kind,
    atMs,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'review_log';
  @override
  VerificationContext validateIntegrity(
    Insertable<ReviewLogRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('attempt_id')) {
      context.handle(
        _attemptIdMeta,
        attemptId.isAcceptableOrUnknown(data['attempt_id']!, _attemptIdMeta),
      );
    } else if (isInserting) {
      context.missing(_attemptIdMeta);
    }
    if (data.containsKey('question_id')) {
      context.handle(
        _questionIdMeta,
        questionId.isAcceptableOrUnknown(data['question_id']!, _questionIdMeta),
      );
    } else if (isInserting) {
      context.missing(_questionIdMeta);
    }
    if (data.containsKey('kind')) {
      context.handle(
        _kindMeta,
        kind.isAcceptableOrUnknown(data['kind']!, _kindMeta),
      );
    } else if (isInserting) {
      context.missing(_kindMeta);
    }
    if (data.containsKey('at_ms')) {
      context.handle(
        _atMsMeta,
        atMs.isAcceptableOrUnknown(data['at_ms']!, _atMsMeta),
      );
    } else if (isInserting) {
      context.missing(_atMsMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  List<Set<GeneratedColumn>> get uniqueKeys => [
    {userId, attemptId, questionId, kind},
  ];
  @override
  ReviewLogRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ReviewLogRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      attemptId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}attempt_id'],
      )!,
      questionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}question_id'],
      )!,
      kind: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}kind'],
      )!,
      atMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}at_ms'],
      )!,
    );
  }

  @override
  $ReviewLogTable createAlias(String alias) {
    return $ReviewLogTable(attachedDatabase, alias);
  }
}

class ReviewLogRow extends DataClass implements Insertable<ReviewLogRow> {
  final int id;
  final String userId;
  final String attemptId;
  final String questionId;
  final String kind;
  final int atMs;
  const ReviewLogRow({
    required this.id,
    required this.userId,
    required this.attemptId,
    required this.questionId,
    required this.kind,
    required this.atMs,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['user_id'] = Variable<String>(userId);
    map['attempt_id'] = Variable<String>(attemptId);
    map['question_id'] = Variable<String>(questionId);
    map['kind'] = Variable<String>(kind);
    map['at_ms'] = Variable<int>(atMs);
    return map;
  }

  ReviewLogCompanion toCompanion(bool nullToAbsent) {
    return ReviewLogCompanion(
      id: Value(id),
      userId: Value(userId),
      attemptId: Value(attemptId),
      questionId: Value(questionId),
      kind: Value(kind),
      atMs: Value(atMs),
    );
  }

  factory ReviewLogRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ReviewLogRow(
      id: serializer.fromJson<int>(json['id']),
      userId: serializer.fromJson<String>(json['userId']),
      attemptId: serializer.fromJson<String>(json['attemptId']),
      questionId: serializer.fromJson<String>(json['questionId']),
      kind: serializer.fromJson<String>(json['kind']),
      atMs: serializer.fromJson<int>(json['atMs']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'userId': serializer.toJson<String>(userId),
      'attemptId': serializer.toJson<String>(attemptId),
      'questionId': serializer.toJson<String>(questionId),
      'kind': serializer.toJson<String>(kind),
      'atMs': serializer.toJson<int>(atMs),
    };
  }

  ReviewLogRow copyWith({
    int? id,
    String? userId,
    String? attemptId,
    String? questionId,
    String? kind,
    int? atMs,
  }) => ReviewLogRow(
    id: id ?? this.id,
    userId: userId ?? this.userId,
    attemptId: attemptId ?? this.attemptId,
    questionId: questionId ?? this.questionId,
    kind: kind ?? this.kind,
    atMs: atMs ?? this.atMs,
  );
  ReviewLogRow copyWithCompanion(ReviewLogCompanion data) {
    return ReviewLogRow(
      id: data.id.present ? data.id.value : this.id,
      userId: data.userId.present ? data.userId.value : this.userId,
      attemptId: data.attemptId.present ? data.attemptId.value : this.attemptId,
      questionId: data.questionId.present
          ? data.questionId.value
          : this.questionId,
      kind: data.kind.present ? data.kind.value : this.kind,
      atMs: data.atMs.present ? data.atMs.value : this.atMs,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ReviewLogRow(')
          ..write('id: $id, ')
          ..write('userId: $userId, ')
          ..write('attemptId: $attemptId, ')
          ..write('questionId: $questionId, ')
          ..write('kind: $kind, ')
          ..write('atMs: $atMs')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, userId, attemptId, questionId, kind, atMs);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ReviewLogRow &&
          other.id == this.id &&
          other.userId == this.userId &&
          other.attemptId == this.attemptId &&
          other.questionId == this.questionId &&
          other.kind == this.kind &&
          other.atMs == this.atMs);
}

class ReviewLogCompanion extends UpdateCompanion<ReviewLogRow> {
  final Value<int> id;
  final Value<String> userId;
  final Value<String> attemptId;
  final Value<String> questionId;
  final Value<String> kind;
  final Value<int> atMs;
  const ReviewLogCompanion({
    this.id = const Value.absent(),
    this.userId = const Value.absent(),
    this.attemptId = const Value.absent(),
    this.questionId = const Value.absent(),
    this.kind = const Value.absent(),
    this.atMs = const Value.absent(),
  });
  ReviewLogCompanion.insert({
    this.id = const Value.absent(),
    required String userId,
    required String attemptId,
    required String questionId,
    required String kind,
    required int atMs,
  }) : userId = Value(userId),
       attemptId = Value(attemptId),
       questionId = Value(questionId),
       kind = Value(kind),
       atMs = Value(atMs);
  static Insertable<ReviewLogRow> custom({
    Expression<int>? id,
    Expression<String>? userId,
    Expression<String>? attemptId,
    Expression<String>? questionId,
    Expression<String>? kind,
    Expression<int>? atMs,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (userId != null) 'user_id': userId,
      if (attemptId != null) 'attempt_id': attemptId,
      if (questionId != null) 'question_id': questionId,
      if (kind != null) 'kind': kind,
      if (atMs != null) 'at_ms': atMs,
    });
  }

  ReviewLogCompanion copyWith({
    Value<int>? id,
    Value<String>? userId,
    Value<String>? attemptId,
    Value<String>? questionId,
    Value<String>? kind,
    Value<int>? atMs,
  }) {
    return ReviewLogCompanion(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      attemptId: attemptId ?? this.attemptId,
      questionId: questionId ?? this.questionId,
      kind: kind ?? this.kind,
      atMs: atMs ?? this.atMs,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (attemptId.present) {
      map['attempt_id'] = Variable<String>(attemptId.value);
    }
    if (questionId.present) {
      map['question_id'] = Variable<String>(questionId.value);
    }
    if (kind.present) {
      map['kind'] = Variable<String>(kind.value);
    }
    if (atMs.present) {
      map['at_ms'] = Variable<int>(atMs.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ReviewLogCompanion(')
          ..write('id: $id, ')
          ..write('userId: $userId, ')
          ..write('attemptId: $attemptId, ')
          ..write('questionId: $questionId, ')
          ..write('kind: $kind, ')
          ..write('atMs: $atMs')
          ..write(')'))
        .toString();
  }
}

class $AnalyticsQueueTable extends AnalyticsQueue
    with TableInfo<$AnalyticsQueueTable, AnalyticsQueueRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $AnalyticsQueueTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _eventIdMeta = const VerificationMeta(
    'eventId',
  );
  @override
  late final GeneratedColumn<String> eventId = GeneratedColumn<String>(
    'event_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _propsJsonMeta = const VerificationMeta(
    'propsJson',
  );
  @override
  late final GeneratedColumn<String> propsJson = GeneratedColumn<String>(
    'props_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _appVersionMeta = const VerificationMeta(
    'appVersion',
  );
  @override
  late final GeneratedColumn<String> appVersion = GeneratedColumn<String>(
    'app_version',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _occurredAtMsMeta = const VerificationMeta(
    'occurredAtMs',
  );
  @override
  late final GeneratedColumn<int> occurredAtMs = GeneratedColumn<int>(
    'occurred_at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    eventId,
    userId,
    name,
    propsJson,
    appVersion,
    occurredAtMs,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'analytics_queue';
  @override
  VerificationContext validateIntegrity(
    Insertable<AnalyticsQueueRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('event_id')) {
      context.handle(
        _eventIdMeta,
        eventId.isAcceptableOrUnknown(data['event_id']!, _eventIdMeta),
      );
    } else if (isInserting) {
      context.missing(_eventIdMeta);
    }
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('props_json')) {
      context.handle(
        _propsJsonMeta,
        propsJson.isAcceptableOrUnknown(data['props_json']!, _propsJsonMeta),
      );
    } else if (isInserting) {
      context.missing(_propsJsonMeta);
    }
    if (data.containsKey('app_version')) {
      context.handle(
        _appVersionMeta,
        appVersion.isAcceptableOrUnknown(data['app_version']!, _appVersionMeta),
      );
    }
    if (data.containsKey('occurred_at_ms')) {
      context.handle(
        _occurredAtMsMeta,
        occurredAtMs.isAcceptableOrUnknown(
          data['occurred_at_ms']!,
          _occurredAtMsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_occurredAtMsMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {eventId};
  @override
  AnalyticsQueueRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return AnalyticsQueueRow(
      eventId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}event_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      propsJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}props_json'],
      )!,
      appVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}app_version'],
      ),
      occurredAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}occurred_at_ms'],
      )!,
    );
  }

  @override
  $AnalyticsQueueTable createAlias(String alias) {
    return $AnalyticsQueueTable(attachedDatabase, alias);
  }
}

class AnalyticsQueueRow extends DataClass
    implements Insertable<AnalyticsQueueRow> {
  final String eventId;
  final String userId;
  final String name;
  final String propsJson;
  final String? appVersion;
  final int occurredAtMs;
  const AnalyticsQueueRow({
    required this.eventId,
    required this.userId,
    required this.name,
    required this.propsJson,
    this.appVersion,
    required this.occurredAtMs,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['event_id'] = Variable<String>(eventId);
    map['user_id'] = Variable<String>(userId);
    map['name'] = Variable<String>(name);
    map['props_json'] = Variable<String>(propsJson);
    if (!nullToAbsent || appVersion != null) {
      map['app_version'] = Variable<String>(appVersion);
    }
    map['occurred_at_ms'] = Variable<int>(occurredAtMs);
    return map;
  }

  AnalyticsQueueCompanion toCompanion(bool nullToAbsent) {
    return AnalyticsQueueCompanion(
      eventId: Value(eventId),
      userId: Value(userId),
      name: Value(name),
      propsJson: Value(propsJson),
      appVersion: appVersion == null && nullToAbsent
          ? const Value.absent()
          : Value(appVersion),
      occurredAtMs: Value(occurredAtMs),
    );
  }

  factory AnalyticsQueueRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return AnalyticsQueueRow(
      eventId: serializer.fromJson<String>(json['eventId']),
      userId: serializer.fromJson<String>(json['userId']),
      name: serializer.fromJson<String>(json['name']),
      propsJson: serializer.fromJson<String>(json['propsJson']),
      appVersion: serializer.fromJson<String?>(json['appVersion']),
      occurredAtMs: serializer.fromJson<int>(json['occurredAtMs']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'eventId': serializer.toJson<String>(eventId),
      'userId': serializer.toJson<String>(userId),
      'name': serializer.toJson<String>(name),
      'propsJson': serializer.toJson<String>(propsJson),
      'appVersion': serializer.toJson<String?>(appVersion),
      'occurredAtMs': serializer.toJson<int>(occurredAtMs),
    };
  }

  AnalyticsQueueRow copyWith({
    String? eventId,
    String? userId,
    String? name,
    String? propsJson,
    Value<String?> appVersion = const Value.absent(),
    int? occurredAtMs,
  }) => AnalyticsQueueRow(
    eventId: eventId ?? this.eventId,
    userId: userId ?? this.userId,
    name: name ?? this.name,
    propsJson: propsJson ?? this.propsJson,
    appVersion: appVersion.present ? appVersion.value : this.appVersion,
    occurredAtMs: occurredAtMs ?? this.occurredAtMs,
  );
  AnalyticsQueueRow copyWithCompanion(AnalyticsQueueCompanion data) {
    return AnalyticsQueueRow(
      eventId: data.eventId.present ? data.eventId.value : this.eventId,
      userId: data.userId.present ? data.userId.value : this.userId,
      name: data.name.present ? data.name.value : this.name,
      propsJson: data.propsJson.present ? data.propsJson.value : this.propsJson,
      appVersion: data.appVersion.present
          ? data.appVersion.value
          : this.appVersion,
      occurredAtMs: data.occurredAtMs.present
          ? data.occurredAtMs.value
          : this.occurredAtMs,
    );
  }

  @override
  String toString() {
    return (StringBuffer('AnalyticsQueueRow(')
          ..write('eventId: $eventId, ')
          ..write('userId: $userId, ')
          ..write('name: $name, ')
          ..write('propsJson: $propsJson, ')
          ..write('appVersion: $appVersion, ')
          ..write('occurredAtMs: $occurredAtMs')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(eventId, userId, name, propsJson, appVersion, occurredAtMs);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is AnalyticsQueueRow &&
          other.eventId == this.eventId &&
          other.userId == this.userId &&
          other.name == this.name &&
          other.propsJson == this.propsJson &&
          other.appVersion == this.appVersion &&
          other.occurredAtMs == this.occurredAtMs);
}

class AnalyticsQueueCompanion extends UpdateCompanion<AnalyticsQueueRow> {
  final Value<String> eventId;
  final Value<String> userId;
  final Value<String> name;
  final Value<String> propsJson;
  final Value<String?> appVersion;
  final Value<int> occurredAtMs;
  final Value<int> rowid;
  const AnalyticsQueueCompanion({
    this.eventId = const Value.absent(),
    this.userId = const Value.absent(),
    this.name = const Value.absent(),
    this.propsJson = const Value.absent(),
    this.appVersion = const Value.absent(),
    this.occurredAtMs = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  AnalyticsQueueCompanion.insert({
    required String eventId,
    required String userId,
    required String name,
    required String propsJson,
    this.appVersion = const Value.absent(),
    required int occurredAtMs,
    this.rowid = const Value.absent(),
  }) : eventId = Value(eventId),
       userId = Value(userId),
       name = Value(name),
       propsJson = Value(propsJson),
       occurredAtMs = Value(occurredAtMs);
  static Insertable<AnalyticsQueueRow> custom({
    Expression<String>? eventId,
    Expression<String>? userId,
    Expression<String>? name,
    Expression<String>? propsJson,
    Expression<String>? appVersion,
    Expression<int>? occurredAtMs,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (eventId != null) 'event_id': eventId,
      if (userId != null) 'user_id': userId,
      if (name != null) 'name': name,
      if (propsJson != null) 'props_json': propsJson,
      if (appVersion != null) 'app_version': appVersion,
      if (occurredAtMs != null) 'occurred_at_ms': occurredAtMs,
      if (rowid != null) 'rowid': rowid,
    });
  }

  AnalyticsQueueCompanion copyWith({
    Value<String>? eventId,
    Value<String>? userId,
    Value<String>? name,
    Value<String>? propsJson,
    Value<String?>? appVersion,
    Value<int>? occurredAtMs,
    Value<int>? rowid,
  }) {
    return AnalyticsQueueCompanion(
      eventId: eventId ?? this.eventId,
      userId: userId ?? this.userId,
      name: name ?? this.name,
      propsJson: propsJson ?? this.propsJson,
      appVersion: appVersion ?? this.appVersion,
      occurredAtMs: occurredAtMs ?? this.occurredAtMs,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (eventId.present) {
      map['event_id'] = Variable<String>(eventId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (propsJson.present) {
      map['props_json'] = Variable<String>(propsJson.value);
    }
    if (appVersion.present) {
      map['app_version'] = Variable<String>(appVersion.value);
    }
    if (occurredAtMs.present) {
      map['occurred_at_ms'] = Variable<int>(occurredAtMs.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('AnalyticsQueueCompanion(')
          ..write('eventId: $eventId, ')
          ..write('userId: $userId, ')
          ..write('name: $name, ')
          ..write('propsJson: $propsJson, ')
          ..write('appVersion: $appVersion, ')
          ..write('occurredAtMs: $occurredAtMs, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $PendingResultsTable extends PendingResults
    with TableInfo<$PendingResultsTable, PendingResultRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PendingResultsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _attemptIdMeta = const VerificationMeta(
    'attemptId',
  );
  @override
  late final GeneratedColumn<String> attemptId = GeneratedColumn<String>(
    'attempt_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _receivedAtMsMeta = const VerificationMeta(
    'receivedAtMs',
  );
  @override
  late final GeneratedColumn<int> receivedAtMs = GeneratedColumn<int>(
    'received_at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _openedAtMsMeta = const VerificationMeta(
    'openedAtMs',
  );
  @override
  late final GeneratedColumn<int> openedAtMs = GeneratedColumn<int>(
    'opened_at_ms',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    userId,
    attemptId,
    receivedAtMs,
    openedAtMs,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'pending_results';
  @override
  VerificationContext validateIntegrity(
    Insertable<PendingResultRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('attempt_id')) {
      context.handle(
        _attemptIdMeta,
        attemptId.isAcceptableOrUnknown(data['attempt_id']!, _attemptIdMeta),
      );
    } else if (isInserting) {
      context.missing(_attemptIdMeta);
    }
    if (data.containsKey('received_at_ms')) {
      context.handle(
        _receivedAtMsMeta,
        receivedAtMs.isAcceptableOrUnknown(
          data['received_at_ms']!,
          _receivedAtMsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_receivedAtMsMeta);
    }
    if (data.containsKey('opened_at_ms')) {
      context.handle(
        _openedAtMsMeta,
        openedAtMs.isAcceptableOrUnknown(
          data['opened_at_ms']!,
          _openedAtMsMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, attemptId};
  @override
  PendingResultRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PendingResultRow(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      attemptId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}attempt_id'],
      )!,
      receivedAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}received_at_ms'],
      )!,
      openedAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}opened_at_ms'],
      ),
    );
  }

  @override
  $PendingResultsTable createAlias(String alias) {
    return $PendingResultsTable(attachedDatabase, alias);
  }
}

class PendingResultRow extends DataClass
    implements Insertable<PendingResultRow> {
  final String userId;
  final String attemptId;
  final int receivedAtMs;
  final int? openedAtMs;
  const PendingResultRow({
    required this.userId,
    required this.attemptId,
    required this.receivedAtMs,
    this.openedAtMs,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['attempt_id'] = Variable<String>(attemptId);
    map['received_at_ms'] = Variable<int>(receivedAtMs);
    if (!nullToAbsent || openedAtMs != null) {
      map['opened_at_ms'] = Variable<int>(openedAtMs);
    }
    return map;
  }

  PendingResultsCompanion toCompanion(bool nullToAbsent) {
    return PendingResultsCompanion(
      userId: Value(userId),
      attemptId: Value(attemptId),
      receivedAtMs: Value(receivedAtMs),
      openedAtMs: openedAtMs == null && nullToAbsent
          ? const Value.absent()
          : Value(openedAtMs),
    );
  }

  factory PendingResultRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PendingResultRow(
      userId: serializer.fromJson<String>(json['userId']),
      attemptId: serializer.fromJson<String>(json['attemptId']),
      receivedAtMs: serializer.fromJson<int>(json['receivedAtMs']),
      openedAtMs: serializer.fromJson<int?>(json['openedAtMs']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'attemptId': serializer.toJson<String>(attemptId),
      'receivedAtMs': serializer.toJson<int>(receivedAtMs),
      'openedAtMs': serializer.toJson<int?>(openedAtMs),
    };
  }

  PendingResultRow copyWith({
    String? userId,
    String? attemptId,
    int? receivedAtMs,
    Value<int?> openedAtMs = const Value.absent(),
  }) => PendingResultRow(
    userId: userId ?? this.userId,
    attemptId: attemptId ?? this.attemptId,
    receivedAtMs: receivedAtMs ?? this.receivedAtMs,
    openedAtMs: openedAtMs.present ? openedAtMs.value : this.openedAtMs,
  );
  PendingResultRow copyWithCompanion(PendingResultsCompanion data) {
    return PendingResultRow(
      userId: data.userId.present ? data.userId.value : this.userId,
      attemptId: data.attemptId.present ? data.attemptId.value : this.attemptId,
      receivedAtMs: data.receivedAtMs.present
          ? data.receivedAtMs.value
          : this.receivedAtMs,
      openedAtMs: data.openedAtMs.present
          ? data.openedAtMs.value
          : this.openedAtMs,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PendingResultRow(')
          ..write('userId: $userId, ')
          ..write('attemptId: $attemptId, ')
          ..write('receivedAtMs: $receivedAtMs, ')
          ..write('openedAtMs: $openedAtMs')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(userId, attemptId, receivedAtMs, openedAtMs);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PendingResultRow &&
          other.userId == this.userId &&
          other.attemptId == this.attemptId &&
          other.receivedAtMs == this.receivedAtMs &&
          other.openedAtMs == this.openedAtMs);
}

class PendingResultsCompanion extends UpdateCompanion<PendingResultRow> {
  final Value<String> userId;
  final Value<String> attemptId;
  final Value<int> receivedAtMs;
  final Value<int?> openedAtMs;
  final Value<int> rowid;
  const PendingResultsCompanion({
    this.userId = const Value.absent(),
    this.attemptId = const Value.absent(),
    this.receivedAtMs = const Value.absent(),
    this.openedAtMs = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  PendingResultsCompanion.insert({
    required String userId,
    required String attemptId,
    required int receivedAtMs,
    this.openedAtMs = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : userId = Value(userId),
       attemptId = Value(attemptId),
       receivedAtMs = Value(receivedAtMs);
  static Insertable<PendingResultRow> custom({
    Expression<String>? userId,
    Expression<String>? attemptId,
    Expression<int>? receivedAtMs,
    Expression<int>? openedAtMs,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (attemptId != null) 'attempt_id': attemptId,
      if (receivedAtMs != null) 'received_at_ms': receivedAtMs,
      if (openedAtMs != null) 'opened_at_ms': openedAtMs,
      if (rowid != null) 'rowid': rowid,
    });
  }

  PendingResultsCompanion copyWith({
    Value<String>? userId,
    Value<String>? attemptId,
    Value<int>? receivedAtMs,
    Value<int?>? openedAtMs,
    Value<int>? rowid,
  }) {
    return PendingResultsCompanion(
      userId: userId ?? this.userId,
      attemptId: attemptId ?? this.attemptId,
      receivedAtMs: receivedAtMs ?? this.receivedAtMs,
      openedAtMs: openedAtMs ?? this.openedAtMs,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (attemptId.present) {
      map['attempt_id'] = Variable<String>(attemptId.value);
    }
    if (receivedAtMs.present) {
      map['received_at_ms'] = Variable<int>(receivedAtMs.value);
    }
    if (openedAtMs.present) {
      map['opened_at_ms'] = Variable<int>(openedAtMs.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PendingResultsCompanion(')
          ..write('userId: $userId, ')
          ..write('attemptId: $attemptId, ')
          ..write('receivedAtMs: $receivedAtMs, ')
          ..write('openedAtMs: $openedAtMs, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $RepairLocalTable extends RepairLocal
    with TableInfo<$RepairLocalTable, RepairLocalRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $RepairLocalTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _attemptIdMeta = const VerificationMeta(
    'attemptId',
  );
  @override
  late final GeneratedColumn<String> attemptId = GeneratedColumn<String>(
    'attempt_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _questionIdMeta = const VerificationMeta(
    'questionId',
  );
  @override
  late final GeneratedColumn<String> questionId = GeneratedColumn<String>(
    'question_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _requestIdMeta = const VerificationMeta(
    'requestId',
  );
  @override
  late final GeneratedColumn<String> requestId = GeneratedColumn<String>(
    'request_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _ackedAtMsMeta = const VerificationMeta(
    'ackedAtMs',
  );
  @override
  late final GeneratedColumn<int> ackedAtMs = GeneratedColumn<int>(
    'acked_at_ms',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    userId,
    attemptId,
    questionId,
    requestId,
    status,
    ackedAtMs,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'repair_local';
  @override
  VerificationContext validateIntegrity(
    Insertable<RepairLocalRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('attempt_id')) {
      context.handle(
        _attemptIdMeta,
        attemptId.isAcceptableOrUnknown(data['attempt_id']!, _attemptIdMeta),
      );
    } else if (isInserting) {
      context.missing(_attemptIdMeta);
    }
    if (data.containsKey('question_id')) {
      context.handle(
        _questionIdMeta,
        questionId.isAcceptableOrUnknown(data['question_id']!, _questionIdMeta),
      );
    } else if (isInserting) {
      context.missing(_questionIdMeta);
    }
    if (data.containsKey('request_id')) {
      context.handle(
        _requestIdMeta,
        requestId.isAcceptableOrUnknown(data['request_id']!, _requestIdMeta),
      );
    } else if (isInserting) {
      context.missing(_requestIdMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('acked_at_ms')) {
      context.handle(
        _ackedAtMsMeta,
        ackedAtMs.isAcceptableOrUnknown(data['acked_at_ms']!, _ackedAtMsMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, attemptId, questionId};
  @override
  RepairLocalRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return RepairLocalRow(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      attemptId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}attempt_id'],
      )!,
      questionId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}question_id'],
      )!,
      requestId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}request_id'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      ackedAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}acked_at_ms'],
      ),
    );
  }

  @override
  $RepairLocalTable createAlias(String alias) {
    return $RepairLocalTable(attachedDatabase, alias);
  }
}

class RepairLocalRow extends DataClass implements Insertable<RepairLocalRow> {
  final String userId;
  final String attemptId;
  final String questionId;
  final String requestId;

  /// `explained`, `stored`, `held_for_recheck`, `not_explained`, `not_a_mistake`, `reviewed`.
  final String status;
  final int? ackedAtMs;
  const RepairLocalRow({
    required this.userId,
    required this.attemptId,
    required this.questionId,
    required this.requestId,
    required this.status,
    this.ackedAtMs,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['attempt_id'] = Variable<String>(attemptId);
    map['question_id'] = Variable<String>(questionId);
    map['request_id'] = Variable<String>(requestId);
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || ackedAtMs != null) {
      map['acked_at_ms'] = Variable<int>(ackedAtMs);
    }
    return map;
  }

  RepairLocalCompanion toCompanion(bool nullToAbsent) {
    return RepairLocalCompanion(
      userId: Value(userId),
      attemptId: Value(attemptId),
      questionId: Value(questionId),
      requestId: Value(requestId),
      status: Value(status),
      ackedAtMs: ackedAtMs == null && nullToAbsent
          ? const Value.absent()
          : Value(ackedAtMs),
    );
  }

  factory RepairLocalRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return RepairLocalRow(
      userId: serializer.fromJson<String>(json['userId']),
      attemptId: serializer.fromJson<String>(json['attemptId']),
      questionId: serializer.fromJson<String>(json['questionId']),
      requestId: serializer.fromJson<String>(json['requestId']),
      status: serializer.fromJson<String>(json['status']),
      ackedAtMs: serializer.fromJson<int?>(json['ackedAtMs']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'attemptId': serializer.toJson<String>(attemptId),
      'questionId': serializer.toJson<String>(questionId),
      'requestId': serializer.toJson<String>(requestId),
      'status': serializer.toJson<String>(status),
      'ackedAtMs': serializer.toJson<int?>(ackedAtMs),
    };
  }

  RepairLocalRow copyWith({
    String? userId,
    String? attemptId,
    String? questionId,
    String? requestId,
    String? status,
    Value<int?> ackedAtMs = const Value.absent(),
  }) => RepairLocalRow(
    userId: userId ?? this.userId,
    attemptId: attemptId ?? this.attemptId,
    questionId: questionId ?? this.questionId,
    requestId: requestId ?? this.requestId,
    status: status ?? this.status,
    ackedAtMs: ackedAtMs.present ? ackedAtMs.value : this.ackedAtMs,
  );
  RepairLocalRow copyWithCompanion(RepairLocalCompanion data) {
    return RepairLocalRow(
      userId: data.userId.present ? data.userId.value : this.userId,
      attemptId: data.attemptId.present ? data.attemptId.value : this.attemptId,
      questionId: data.questionId.present
          ? data.questionId.value
          : this.questionId,
      requestId: data.requestId.present ? data.requestId.value : this.requestId,
      status: data.status.present ? data.status.value : this.status,
      ackedAtMs: data.ackedAtMs.present ? data.ackedAtMs.value : this.ackedAtMs,
    );
  }

  @override
  String toString() {
    return (StringBuffer('RepairLocalRow(')
          ..write('userId: $userId, ')
          ..write('attemptId: $attemptId, ')
          ..write('questionId: $questionId, ')
          ..write('requestId: $requestId, ')
          ..write('status: $status, ')
          ..write('ackedAtMs: $ackedAtMs')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(userId, attemptId, questionId, requestId, status, ackedAtMs);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is RepairLocalRow &&
          other.userId == this.userId &&
          other.attemptId == this.attemptId &&
          other.questionId == this.questionId &&
          other.requestId == this.requestId &&
          other.status == this.status &&
          other.ackedAtMs == this.ackedAtMs);
}

class RepairLocalCompanion extends UpdateCompanion<RepairLocalRow> {
  final Value<String> userId;
  final Value<String> attemptId;
  final Value<String> questionId;
  final Value<String> requestId;
  final Value<String> status;
  final Value<int?> ackedAtMs;
  final Value<int> rowid;
  const RepairLocalCompanion({
    this.userId = const Value.absent(),
    this.attemptId = const Value.absent(),
    this.questionId = const Value.absent(),
    this.requestId = const Value.absent(),
    this.status = const Value.absent(),
    this.ackedAtMs = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  RepairLocalCompanion.insert({
    required String userId,
    required String attemptId,
    required String questionId,
    required String requestId,
    required String status,
    this.ackedAtMs = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : userId = Value(userId),
       attemptId = Value(attemptId),
       questionId = Value(questionId),
       requestId = Value(requestId),
       status = Value(status);
  static Insertable<RepairLocalRow> custom({
    Expression<String>? userId,
    Expression<String>? attemptId,
    Expression<String>? questionId,
    Expression<String>? requestId,
    Expression<String>? status,
    Expression<int>? ackedAtMs,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (attemptId != null) 'attempt_id': attemptId,
      if (questionId != null) 'question_id': questionId,
      if (requestId != null) 'request_id': requestId,
      if (status != null) 'status': status,
      if (ackedAtMs != null) 'acked_at_ms': ackedAtMs,
      if (rowid != null) 'rowid': rowid,
    });
  }

  RepairLocalCompanion copyWith({
    Value<String>? userId,
    Value<String>? attemptId,
    Value<String>? questionId,
    Value<String>? requestId,
    Value<String>? status,
    Value<int?>? ackedAtMs,
    Value<int>? rowid,
  }) {
    return RepairLocalCompanion(
      userId: userId ?? this.userId,
      attemptId: attemptId ?? this.attemptId,
      questionId: questionId ?? this.questionId,
      requestId: requestId ?? this.requestId,
      status: status ?? this.status,
      ackedAtMs: ackedAtMs ?? this.ackedAtMs,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (attemptId.present) {
      map['attempt_id'] = Variable<String>(attemptId.value);
    }
    if (questionId.present) {
      map['question_id'] = Variable<String>(questionId.value);
    }
    if (requestId.present) {
      map['request_id'] = Variable<String>(requestId.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (ackedAtMs.present) {
      map['acked_at_ms'] = Variable<int>(ackedAtMs.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('RepairLocalCompanion(')
          ..write('userId: $userId, ')
          ..write('attemptId: $attemptId, ')
          ..write('questionId: $questionId, ')
          ..write('requestId: $requestId, ')
          ..write('status: $status, ')
          ..write('ackedAtMs: $ackedAtMs, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $RhythmSeenTable extends RhythmSeen
    with TableInfo<$RhythmSeenTable, RhythmSeenRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $RhythmSeenTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _lastSeenWeekJsonMeta = const VerificationMeta(
    'lastSeenWeekJson',
  );
  @override
  late final GeneratedColumn<String> lastSeenWeekJson = GeneratedColumn<String>(
    'last_seen_week_json',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lastCelebratedWeekStartMeta =
      const VerificationMeta('lastCelebratedWeekStart');
  @override
  late final GeneratedColumn<String> lastCelebratedWeekStart =
      GeneratedColumn<String>(
        'last_celebrated_week_start',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _celebratedIdsJsonMeta = const VerificationMeta(
    'celebratedIdsJson',
  );
  @override
  late final GeneratedColumn<String> celebratedIdsJson =
      GeneratedColumn<String>(
        'celebrated_ids_json',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
        defaultValue: const Constant('[]'),
      );
  @override
  List<GeneratedColumn> get $columns => [
    userId,
    lastSeenWeekJson,
    lastCelebratedWeekStart,
    celebratedIdsJson,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'rhythm_seen';
  @override
  VerificationContext validateIntegrity(
    Insertable<RhythmSeenRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('last_seen_week_json')) {
      context.handle(
        _lastSeenWeekJsonMeta,
        lastSeenWeekJson.isAcceptableOrUnknown(
          data['last_seen_week_json']!,
          _lastSeenWeekJsonMeta,
        ),
      );
    }
    if (data.containsKey('last_celebrated_week_start')) {
      context.handle(
        _lastCelebratedWeekStartMeta,
        lastCelebratedWeekStart.isAcceptableOrUnknown(
          data['last_celebrated_week_start']!,
          _lastCelebratedWeekStartMeta,
        ),
      );
    }
    if (data.containsKey('celebrated_ids_json')) {
      context.handle(
        _celebratedIdsJsonMeta,
        celebratedIdsJson.isAcceptableOrUnknown(
          data['celebrated_ids_json']!,
          _celebratedIdsJsonMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId};
  @override
  RhythmSeenRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return RhythmSeenRow(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      lastSeenWeekJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_seen_week_json'],
      ),
      lastCelebratedWeekStart: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_celebrated_week_start'],
      ),
      celebratedIdsJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}celebrated_ids_json'],
      )!,
    );
  }

  @override
  $RhythmSeenTable createAlias(String alias) {
    return $RhythmSeenTable(attachedDatabase, alias);
  }
}

class RhythmSeenRow extends DataClass implements Insertable<RhythmSeenRow> {
  final String userId;

  /// JSON of the last seen week (weekStart, studyDays, daysGoal, metThisWeek, weeksMetStreak).
  final String? lastSeenWeekJson;
  final String? lastCelebratedWeekStart;

  /// JSON list of celebration ids that already fired.
  final String celebratedIdsJson;
  const RhythmSeenRow({
    required this.userId,
    this.lastSeenWeekJson,
    this.lastCelebratedWeekStart,
    required this.celebratedIdsJson,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    if (!nullToAbsent || lastSeenWeekJson != null) {
      map['last_seen_week_json'] = Variable<String>(lastSeenWeekJson);
    }
    if (!nullToAbsent || lastCelebratedWeekStart != null) {
      map['last_celebrated_week_start'] = Variable<String>(
        lastCelebratedWeekStart,
      );
    }
    map['celebrated_ids_json'] = Variable<String>(celebratedIdsJson);
    return map;
  }

  RhythmSeenCompanion toCompanion(bool nullToAbsent) {
    return RhythmSeenCompanion(
      userId: Value(userId),
      lastSeenWeekJson: lastSeenWeekJson == null && nullToAbsent
          ? const Value.absent()
          : Value(lastSeenWeekJson),
      lastCelebratedWeekStart: lastCelebratedWeekStart == null && nullToAbsent
          ? const Value.absent()
          : Value(lastCelebratedWeekStart),
      celebratedIdsJson: Value(celebratedIdsJson),
    );
  }

  factory RhythmSeenRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return RhythmSeenRow(
      userId: serializer.fromJson<String>(json['userId']),
      lastSeenWeekJson: serializer.fromJson<String?>(json['lastSeenWeekJson']),
      lastCelebratedWeekStart: serializer.fromJson<String?>(
        json['lastCelebratedWeekStart'],
      ),
      celebratedIdsJson: serializer.fromJson<String>(json['celebratedIdsJson']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'lastSeenWeekJson': serializer.toJson<String?>(lastSeenWeekJson),
      'lastCelebratedWeekStart': serializer.toJson<String?>(
        lastCelebratedWeekStart,
      ),
      'celebratedIdsJson': serializer.toJson<String>(celebratedIdsJson),
    };
  }

  RhythmSeenRow copyWith({
    String? userId,
    Value<String?> lastSeenWeekJson = const Value.absent(),
    Value<String?> lastCelebratedWeekStart = const Value.absent(),
    String? celebratedIdsJson,
  }) => RhythmSeenRow(
    userId: userId ?? this.userId,
    lastSeenWeekJson: lastSeenWeekJson.present
        ? lastSeenWeekJson.value
        : this.lastSeenWeekJson,
    lastCelebratedWeekStart: lastCelebratedWeekStart.present
        ? lastCelebratedWeekStart.value
        : this.lastCelebratedWeekStart,
    celebratedIdsJson: celebratedIdsJson ?? this.celebratedIdsJson,
  );
  RhythmSeenRow copyWithCompanion(RhythmSeenCompanion data) {
    return RhythmSeenRow(
      userId: data.userId.present ? data.userId.value : this.userId,
      lastSeenWeekJson: data.lastSeenWeekJson.present
          ? data.lastSeenWeekJson.value
          : this.lastSeenWeekJson,
      lastCelebratedWeekStart: data.lastCelebratedWeekStart.present
          ? data.lastCelebratedWeekStart.value
          : this.lastCelebratedWeekStart,
      celebratedIdsJson: data.celebratedIdsJson.present
          ? data.celebratedIdsJson.value
          : this.celebratedIdsJson,
    );
  }

  @override
  String toString() {
    return (StringBuffer('RhythmSeenRow(')
          ..write('userId: $userId, ')
          ..write('lastSeenWeekJson: $lastSeenWeekJson, ')
          ..write('lastCelebratedWeekStart: $lastCelebratedWeekStart, ')
          ..write('celebratedIdsJson: $celebratedIdsJson')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    userId,
    lastSeenWeekJson,
    lastCelebratedWeekStart,
    celebratedIdsJson,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is RhythmSeenRow &&
          other.userId == this.userId &&
          other.lastSeenWeekJson == this.lastSeenWeekJson &&
          other.lastCelebratedWeekStart == this.lastCelebratedWeekStart &&
          other.celebratedIdsJson == this.celebratedIdsJson);
}

class RhythmSeenCompanion extends UpdateCompanion<RhythmSeenRow> {
  final Value<String> userId;
  final Value<String?> lastSeenWeekJson;
  final Value<String?> lastCelebratedWeekStart;
  final Value<String> celebratedIdsJson;
  final Value<int> rowid;
  const RhythmSeenCompanion({
    this.userId = const Value.absent(),
    this.lastSeenWeekJson = const Value.absent(),
    this.lastCelebratedWeekStart = const Value.absent(),
    this.celebratedIdsJson = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  RhythmSeenCompanion.insert({
    required String userId,
    this.lastSeenWeekJson = const Value.absent(),
    this.lastCelebratedWeekStart = const Value.absent(),
    this.celebratedIdsJson = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : userId = Value(userId);
  static Insertable<RhythmSeenRow> custom({
    Expression<String>? userId,
    Expression<String>? lastSeenWeekJson,
    Expression<String>? lastCelebratedWeekStart,
    Expression<String>? celebratedIdsJson,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (lastSeenWeekJson != null) 'last_seen_week_json': lastSeenWeekJson,
      if (lastCelebratedWeekStart != null)
        'last_celebrated_week_start': lastCelebratedWeekStart,
      if (celebratedIdsJson != null) 'celebrated_ids_json': celebratedIdsJson,
      if (rowid != null) 'rowid': rowid,
    });
  }

  RhythmSeenCompanion copyWith({
    Value<String>? userId,
    Value<String?>? lastSeenWeekJson,
    Value<String?>? lastCelebratedWeekStart,
    Value<String>? celebratedIdsJson,
    Value<int>? rowid,
  }) {
    return RhythmSeenCompanion(
      userId: userId ?? this.userId,
      lastSeenWeekJson: lastSeenWeekJson ?? this.lastSeenWeekJson,
      lastCelebratedWeekStart:
          lastCelebratedWeekStart ?? this.lastCelebratedWeekStart,
      celebratedIdsJson: celebratedIdsJson ?? this.celebratedIdsJson,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (lastSeenWeekJson.present) {
      map['last_seen_week_json'] = Variable<String>(lastSeenWeekJson.value);
    }
    if (lastCelebratedWeekStart.present) {
      map['last_celebrated_week_start'] = Variable<String>(
        lastCelebratedWeekStart.value,
      );
    }
    if (celebratedIdsJson.present) {
      map['celebrated_ids_json'] = Variable<String>(celebratedIdsJson.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('RhythmSeenCompanion(')
          ..write('userId: $userId, ')
          ..write('lastSeenWeekJson: $lastSeenWeekJson, ')
          ..write('lastCelebratedWeekStart: $lastCelebratedWeekStart, ')
          ..write('celebratedIdsJson: $celebratedIdsJson, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $DismissalsTable extends Dismissals
    with TableInfo<$DismissalsTable, DismissalRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DismissalsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _kindMeta = const VerificationMeta('kind');
  @override
  late final GeneratedColumn<String> kind = GeneratedColumn<String>(
    'kind',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _subjectMeta = const VerificationMeta(
    'subject',
  );
  @override
  late final GeneratedColumn<String> subject = GeneratedColumn<String>(
    'subject',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _chapterMeta = const VerificationMeta(
    'chapter',
  );
  @override
  late final GeneratedColumn<String> chapter = GeneratedColumn<String>(
    'chapter',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _sourceAttemptIdMeta = const VerificationMeta(
    'sourceAttemptId',
  );
  @override
  late final GeneratedColumn<String> sourceAttemptId = GeneratedColumn<String>(
    'source_attempt_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _createdAtMsMeta = const VerificationMeta(
    'createdAtMs',
  );
  @override
  late final GeneratedColumn<int> createdAtMs = GeneratedColumn<int>(
    'created_at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _expiresAtMsMeta = const VerificationMeta(
    'expiresAtMs',
  );
  @override
  late final GeneratedColumn<int> expiresAtMs = GeneratedColumn<int>(
    'expires_at_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    userId,
    kind,
    subject,
    chapter,
    sourceAttemptId,
    createdAtMs,
    expiresAtMs,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'dismissals';
  @override
  VerificationContext validateIntegrity(
    Insertable<DismissalRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('user_id')) {
      context.handle(
        _userIdMeta,
        userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta),
      );
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('kind')) {
      context.handle(
        _kindMeta,
        kind.isAcceptableOrUnknown(data['kind']!, _kindMeta),
      );
    } else if (isInserting) {
      context.missing(_kindMeta);
    }
    if (data.containsKey('subject')) {
      context.handle(
        _subjectMeta,
        subject.isAcceptableOrUnknown(data['subject']!, _subjectMeta),
      );
    }
    if (data.containsKey('chapter')) {
      context.handle(
        _chapterMeta,
        chapter.isAcceptableOrUnknown(data['chapter']!, _chapterMeta),
      );
    }
    if (data.containsKey('source_attempt_id')) {
      context.handle(
        _sourceAttemptIdMeta,
        sourceAttemptId.isAcceptableOrUnknown(
          data['source_attempt_id']!,
          _sourceAttemptIdMeta,
        ),
      );
    }
    if (data.containsKey('created_at_ms')) {
      context.handle(
        _createdAtMsMeta,
        createdAtMs.isAcceptableOrUnknown(
          data['created_at_ms']!,
          _createdAtMsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_createdAtMsMeta);
    }
    if (data.containsKey('expires_at_ms')) {
      context.handle(
        _expiresAtMsMeta,
        expiresAtMs.isAcceptableOrUnknown(
          data['expires_at_ms']!,
          _expiresAtMsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_expiresAtMsMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {
    userId,
    kind,
    subject,
    chapter,
    sourceAttemptId,
  };
  @override
  DismissalRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DismissalRow(
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      kind: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}kind'],
      )!,
      subject: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}subject'],
      )!,
      chapter: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}chapter'],
      )!,
      sourceAttemptId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}source_attempt_id'],
      )!,
      createdAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at_ms'],
      )!,
      expiresAtMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}expires_at_ms'],
      )!,
    );
  }

  @override
  $DismissalsTable createAlias(String alias) {
    return $DismissalsTable(attachedDatabase, alias);
  }
}

class DismissalRow extends DataClass implements Insertable<DismissalRow> {
  final String userId;
  final String kind;
  final String subject;
  final String chapter;
  final String sourceAttemptId;
  final int createdAtMs;
  final int expiresAtMs;
  const DismissalRow({
    required this.userId,
    required this.kind,
    required this.subject,
    required this.chapter,
    required this.sourceAttemptId,
    required this.createdAtMs,
    required this.expiresAtMs,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['kind'] = Variable<String>(kind);
    map['subject'] = Variable<String>(subject);
    map['chapter'] = Variable<String>(chapter);
    map['source_attempt_id'] = Variable<String>(sourceAttemptId);
    map['created_at_ms'] = Variable<int>(createdAtMs);
    map['expires_at_ms'] = Variable<int>(expiresAtMs);
    return map;
  }

  DismissalsCompanion toCompanion(bool nullToAbsent) {
    return DismissalsCompanion(
      userId: Value(userId),
      kind: Value(kind),
      subject: Value(subject),
      chapter: Value(chapter),
      sourceAttemptId: Value(sourceAttemptId),
      createdAtMs: Value(createdAtMs),
      expiresAtMs: Value(expiresAtMs),
    );
  }

  factory DismissalRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DismissalRow(
      userId: serializer.fromJson<String>(json['userId']),
      kind: serializer.fromJson<String>(json['kind']),
      subject: serializer.fromJson<String>(json['subject']),
      chapter: serializer.fromJson<String>(json['chapter']),
      sourceAttemptId: serializer.fromJson<String>(json['sourceAttemptId']),
      createdAtMs: serializer.fromJson<int>(json['createdAtMs']),
      expiresAtMs: serializer.fromJson<int>(json['expiresAtMs']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'kind': serializer.toJson<String>(kind),
      'subject': serializer.toJson<String>(subject),
      'chapter': serializer.toJson<String>(chapter),
      'sourceAttemptId': serializer.toJson<String>(sourceAttemptId),
      'createdAtMs': serializer.toJson<int>(createdAtMs),
      'expiresAtMs': serializer.toJson<int>(expiresAtMs),
    };
  }

  DismissalRow copyWith({
    String? userId,
    String? kind,
    String? subject,
    String? chapter,
    String? sourceAttemptId,
    int? createdAtMs,
    int? expiresAtMs,
  }) => DismissalRow(
    userId: userId ?? this.userId,
    kind: kind ?? this.kind,
    subject: subject ?? this.subject,
    chapter: chapter ?? this.chapter,
    sourceAttemptId: sourceAttemptId ?? this.sourceAttemptId,
    createdAtMs: createdAtMs ?? this.createdAtMs,
    expiresAtMs: expiresAtMs ?? this.expiresAtMs,
  );
  DismissalRow copyWithCompanion(DismissalsCompanion data) {
    return DismissalRow(
      userId: data.userId.present ? data.userId.value : this.userId,
      kind: data.kind.present ? data.kind.value : this.kind,
      subject: data.subject.present ? data.subject.value : this.subject,
      chapter: data.chapter.present ? data.chapter.value : this.chapter,
      sourceAttemptId: data.sourceAttemptId.present
          ? data.sourceAttemptId.value
          : this.sourceAttemptId,
      createdAtMs: data.createdAtMs.present
          ? data.createdAtMs.value
          : this.createdAtMs,
      expiresAtMs: data.expiresAtMs.present
          ? data.expiresAtMs.value
          : this.expiresAtMs,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DismissalRow(')
          ..write('userId: $userId, ')
          ..write('kind: $kind, ')
          ..write('subject: $subject, ')
          ..write('chapter: $chapter, ')
          ..write('sourceAttemptId: $sourceAttemptId, ')
          ..write('createdAtMs: $createdAtMs, ')
          ..write('expiresAtMs: $expiresAtMs')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    userId,
    kind,
    subject,
    chapter,
    sourceAttemptId,
    createdAtMs,
    expiresAtMs,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DismissalRow &&
          other.userId == this.userId &&
          other.kind == this.kind &&
          other.subject == this.subject &&
          other.chapter == this.chapter &&
          other.sourceAttemptId == this.sourceAttemptId &&
          other.createdAtMs == this.createdAtMs &&
          other.expiresAtMs == this.expiresAtMs);
}

class DismissalsCompanion extends UpdateCompanion<DismissalRow> {
  final Value<String> userId;
  final Value<String> kind;
  final Value<String> subject;
  final Value<String> chapter;
  final Value<String> sourceAttemptId;
  final Value<int> createdAtMs;
  final Value<int> expiresAtMs;
  final Value<int> rowid;
  const DismissalsCompanion({
    this.userId = const Value.absent(),
    this.kind = const Value.absent(),
    this.subject = const Value.absent(),
    this.chapter = const Value.absent(),
    this.sourceAttemptId = const Value.absent(),
    this.createdAtMs = const Value.absent(),
    this.expiresAtMs = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  DismissalsCompanion.insert({
    required String userId,
    required String kind,
    this.subject = const Value.absent(),
    this.chapter = const Value.absent(),
    this.sourceAttemptId = const Value.absent(),
    required int createdAtMs,
    required int expiresAtMs,
    this.rowid = const Value.absent(),
  }) : userId = Value(userId),
       kind = Value(kind),
       createdAtMs = Value(createdAtMs),
       expiresAtMs = Value(expiresAtMs);
  static Insertable<DismissalRow> custom({
    Expression<String>? userId,
    Expression<String>? kind,
    Expression<String>? subject,
    Expression<String>? chapter,
    Expression<String>? sourceAttemptId,
    Expression<int>? createdAtMs,
    Expression<int>? expiresAtMs,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (kind != null) 'kind': kind,
      if (subject != null) 'subject': subject,
      if (chapter != null) 'chapter': chapter,
      if (sourceAttemptId != null) 'source_attempt_id': sourceAttemptId,
      if (createdAtMs != null) 'created_at_ms': createdAtMs,
      if (expiresAtMs != null) 'expires_at_ms': expiresAtMs,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DismissalsCompanion copyWith({
    Value<String>? userId,
    Value<String>? kind,
    Value<String>? subject,
    Value<String>? chapter,
    Value<String>? sourceAttemptId,
    Value<int>? createdAtMs,
    Value<int>? expiresAtMs,
    Value<int>? rowid,
  }) {
    return DismissalsCompanion(
      userId: userId ?? this.userId,
      kind: kind ?? this.kind,
      subject: subject ?? this.subject,
      chapter: chapter ?? this.chapter,
      sourceAttemptId: sourceAttemptId ?? this.sourceAttemptId,
      createdAtMs: createdAtMs ?? this.createdAtMs,
      expiresAtMs: expiresAtMs ?? this.expiresAtMs,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (kind.present) {
      map['kind'] = Variable<String>(kind.value);
    }
    if (subject.present) {
      map['subject'] = Variable<String>(subject.value);
    }
    if (chapter.present) {
      map['chapter'] = Variable<String>(chapter.value);
    }
    if (sourceAttemptId.present) {
      map['source_attempt_id'] = Variable<String>(sourceAttemptId.value);
    }
    if (createdAtMs.present) {
      map['created_at_ms'] = Variable<int>(createdAtMs.value);
    }
    if (expiresAtMs.present) {
      map['expires_at_ms'] = Variable<int>(expiresAtMs.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DismissalsCompanion(')
          ..write('userId: $userId, ')
          ..write('kind: $kind, ')
          ..write('subject: $subject, ')
          ..write('chapter: $chapter, ')
          ..write('sourceAttemptId: $sourceAttemptId, ')
          ..write('createdAtMs: $createdAtMs, ')
          ..write('expiresAtMs: $expiresAtMs, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $AnswerJournalTable answerJournal = $AnswerJournalTable(this);
  late final $OutboxTable outbox = $OutboxTable(this);
  late final $SessionDraftsTable sessionDrafts = $SessionDraftsTable(this);
  late final $CachedPlanTable cachedPlan = $CachedPlanTable(this);
  late final $CachedAttemptsTable cachedAttempts = $CachedAttemptsTable(this);
  late final $CacheEntriesTable cacheEntries = $CacheEntriesTable(this);
  late final $LearnCacheTable learnCache = $LearnCacheTable(this);
  late final $ReviewLogTable reviewLog = $ReviewLogTable(this);
  late final $AnalyticsQueueTable analyticsQueue = $AnalyticsQueueTable(this);
  late final $PendingResultsTable pendingResults = $PendingResultsTable(this);
  late final $RepairLocalTable repairLocal = $RepairLocalTable(this);
  late final $RhythmSeenTable rhythmSeen = $RhythmSeenTable(this);
  late final $DismissalsTable dismissals = $DismissalsTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    answerJournal,
    outbox,
    sessionDrafts,
    cachedPlan,
    cachedAttempts,
    cacheEntries,
    learnCache,
    reviewLog,
    analyticsQueue,
    pendingResults,
    repairLocal,
    rhythmSeen,
    dismissals,
  ];
}

typedef $$AnswerJournalTableCreateCompanionBuilder =
    AnswerJournalCompanion Function({
      Value<int> id,
      required String userId,
      required String sessionId,
      required int seq,
      required String qid,
      required String type,
      required int atMs,
      Value<int?> answer,
      required int createdAtMs,
    });
typedef $$AnswerJournalTableUpdateCompanionBuilder =
    AnswerJournalCompanion Function({
      Value<int> id,
      Value<String> userId,
      Value<String> sessionId,
      Value<int> seq,
      Value<String> qid,
      Value<String> type,
      Value<int> atMs,
      Value<int?> answer,
      Value<int> createdAtMs,
    });

class $$AnswerJournalTableFilterComposer
    extends Composer<_$AppDatabase, $AnswerJournalTable> {
  $$AnswerJournalTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sessionId => $composableBuilder(
    column: $table.sessionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get seq => $composableBuilder(
    column: $table.seq,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get qid => $composableBuilder(
    column: $table.qid,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get atMs => $composableBuilder(
    column: $table.atMs,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get answer => $composableBuilder(
    column: $table.answer,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get createdAtMs => $composableBuilder(
    column: $table.createdAtMs,
    builder: (column) => ColumnFilters(column),
  );
}

class $$AnswerJournalTableOrderingComposer
    extends Composer<_$AppDatabase, $AnswerJournalTable> {
  $$AnswerJournalTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sessionId => $composableBuilder(
    column: $table.sessionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get seq => $composableBuilder(
    column: $table.seq,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get qid => $composableBuilder(
    column: $table.qid,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get atMs => $composableBuilder(
    column: $table.atMs,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get answer => $composableBuilder(
    column: $table.answer,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get createdAtMs => $composableBuilder(
    column: $table.createdAtMs,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$AnswerJournalTableAnnotationComposer
    extends Composer<_$AppDatabase, $AnswerJournalTable> {
  $$AnswerJournalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get sessionId =>
      $composableBuilder(column: $table.sessionId, builder: (column) => column);

  GeneratedColumn<int> get seq =>
      $composableBuilder(column: $table.seq, builder: (column) => column);

  GeneratedColumn<String> get qid =>
      $composableBuilder(column: $table.qid, builder: (column) => column);

  GeneratedColumn<String> get type =>
      $composableBuilder(column: $table.type, builder: (column) => column);

  GeneratedColumn<int> get atMs =>
      $composableBuilder(column: $table.atMs, builder: (column) => column);

  GeneratedColumn<int> get answer =>
      $composableBuilder(column: $table.answer, builder: (column) => column);

  GeneratedColumn<int> get createdAtMs => $composableBuilder(
    column: $table.createdAtMs,
    builder: (column) => column,
  );
}

class $$AnswerJournalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $AnswerJournalTable,
          JournalRow,
          $$AnswerJournalTableFilterComposer,
          $$AnswerJournalTableOrderingComposer,
          $$AnswerJournalTableAnnotationComposer,
          $$AnswerJournalTableCreateCompanionBuilder,
          $$AnswerJournalTableUpdateCompanionBuilder,
          (
            JournalRow,
            BaseReferences<_$AppDatabase, $AnswerJournalTable, JournalRow>,
          ),
          JournalRow,
          PrefetchHooks Function()
        > {
  $$AnswerJournalTableTableManager(_$AppDatabase db, $AnswerJournalTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$AnswerJournalTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$AnswerJournalTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$AnswerJournalTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> sessionId = const Value.absent(),
                Value<int> seq = const Value.absent(),
                Value<String> qid = const Value.absent(),
                Value<String> type = const Value.absent(),
                Value<int> atMs = const Value.absent(),
                Value<int?> answer = const Value.absent(),
                Value<int> createdAtMs = const Value.absent(),
              }) => AnswerJournalCompanion(
                id: id,
                userId: userId,
                sessionId: sessionId,
                seq: seq,
                qid: qid,
                type: type,
                atMs: atMs,
                answer: answer,
                createdAtMs: createdAtMs,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String userId,
                required String sessionId,
                required int seq,
                required String qid,
                required String type,
                required int atMs,
                Value<int?> answer = const Value.absent(),
                required int createdAtMs,
              }) => AnswerJournalCompanion.insert(
                id: id,
                userId: userId,
                sessionId: sessionId,
                seq: seq,
                qid: qid,
                type: type,
                atMs: atMs,
                answer: answer,
                createdAtMs: createdAtMs,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$AnswerJournalTable, JournalRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $AnswerJournalTable,
                    JournalRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$AnswerJournalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $AnswerJournalTable,
      JournalRow,
      $$AnswerJournalTableFilterComposer,
      $$AnswerJournalTableOrderingComposer,
      $$AnswerJournalTableAnnotationComposer,
      $$AnswerJournalTableCreateCompanionBuilder,
      $$AnswerJournalTableUpdateCompanionBuilder,
      (
        JournalRow,
        BaseReferences<_$AppDatabase, $AnswerJournalTable, JournalRow>,
      ),
      JournalRow,
      PrefetchHooks Function()
    >;
typedef $$OutboxTableCreateCompanionBuilder =
    OutboxCompanion Function({
      Value<int> id,
      required String userId,
      required String kind,
      required String idempotencyKey,
      required String method,
      required String path,
      Value<String?> bodyJson,
      required int createdAtMs,
      Value<int> attempts,
      Value<int> nextAttemptAtMs,
      Value<String?> lastErrorCode,
    });
typedef $$OutboxTableUpdateCompanionBuilder =
    OutboxCompanion Function({
      Value<int> id,
      Value<String> userId,
      Value<String> kind,
      Value<String> idempotencyKey,
      Value<String> method,
      Value<String> path,
      Value<String?> bodyJson,
      Value<int> createdAtMs,
      Value<int> attempts,
      Value<int> nextAttemptAtMs,
      Value<String?> lastErrorCode,
    });

class $$OutboxTableFilterComposer
    extends Composer<_$AppDatabase, $OutboxTable> {
  $$OutboxTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get idempotencyKey => $composableBuilder(
    column: $table.idempotencyKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get method => $composableBuilder(
    column: $table.method,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get path => $composableBuilder(
    column: $table.path,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get bodyJson => $composableBuilder(
    column: $table.bodyJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get createdAtMs => $composableBuilder(
    column: $table.createdAtMs,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get nextAttemptAtMs => $composableBuilder(
    column: $table.nextAttemptAtMs,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastErrorCode => $composableBuilder(
    column: $table.lastErrorCode,
    builder: (column) => ColumnFilters(column),
  );
}

class $$OutboxTableOrderingComposer
    extends Composer<_$AppDatabase, $OutboxTable> {
  $$OutboxTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get idempotencyKey => $composableBuilder(
    column: $table.idempotencyKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get method => $composableBuilder(
    column: $table.method,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get path => $composableBuilder(
    column: $table.path,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get bodyJson => $composableBuilder(
    column: $table.bodyJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get createdAtMs => $composableBuilder(
    column: $table.createdAtMs,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get nextAttemptAtMs => $composableBuilder(
    column: $table.nextAttemptAtMs,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastErrorCode => $composableBuilder(
    column: $table.lastErrorCode,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$OutboxTableAnnotationComposer
    extends Composer<_$AppDatabase, $OutboxTable> {
  $$OutboxTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get kind =>
      $composableBuilder(column: $table.kind, builder: (column) => column);

  GeneratedColumn<String> get idempotencyKey => $composableBuilder(
    column: $table.idempotencyKey,
    builder: (column) => column,
  );

  GeneratedColumn<String> get method =>
      $composableBuilder(column: $table.method, builder: (column) => column);

  GeneratedColumn<String> get path =>
      $composableBuilder(column: $table.path, builder: (column) => column);

  GeneratedColumn<String> get bodyJson =>
      $composableBuilder(column: $table.bodyJson, builder: (column) => column);

  GeneratedColumn<int> get createdAtMs => $composableBuilder(
    column: $table.createdAtMs,
    builder: (column) => column,
  );

  GeneratedColumn<int> get attempts =>
      $composableBuilder(column: $table.attempts, builder: (column) => column);

  GeneratedColumn<int> get nextAttemptAtMs => $composableBuilder(
    column: $table.nextAttemptAtMs,
    builder: (column) => column,
  );

  GeneratedColumn<String> get lastErrorCode => $composableBuilder(
    column: $table.lastErrorCode,
    builder: (column) => column,
  );
}

class $$OutboxTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $OutboxTable,
          OutboxRow,
          $$OutboxTableFilterComposer,
          $$OutboxTableOrderingComposer,
          $$OutboxTableAnnotationComposer,
          $$OutboxTableCreateCompanionBuilder,
          $$OutboxTableUpdateCompanionBuilder,
          (OutboxRow, BaseReferences<_$AppDatabase, $OutboxTable, OutboxRow>),
          OutboxRow,
          PrefetchHooks Function()
        > {
  $$OutboxTableTableManager(_$AppDatabase db, $OutboxTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OutboxTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OutboxTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OutboxTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> kind = const Value.absent(),
                Value<String> idempotencyKey = const Value.absent(),
                Value<String> method = const Value.absent(),
                Value<String> path = const Value.absent(),
                Value<String?> bodyJson = const Value.absent(),
                Value<int> createdAtMs = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                Value<int> nextAttemptAtMs = const Value.absent(),
                Value<String?> lastErrorCode = const Value.absent(),
              }) => OutboxCompanion(
                id: id,
                userId: userId,
                kind: kind,
                idempotencyKey: idempotencyKey,
                method: method,
                path: path,
                bodyJson: bodyJson,
                createdAtMs: createdAtMs,
                attempts: attempts,
                nextAttemptAtMs: nextAttemptAtMs,
                lastErrorCode: lastErrorCode,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String userId,
                required String kind,
                required String idempotencyKey,
                required String method,
                required String path,
                Value<String?> bodyJson = const Value.absent(),
                required int createdAtMs,
                Value<int> attempts = const Value.absent(),
                Value<int> nextAttemptAtMs = const Value.absent(),
                Value<String?> lastErrorCode = const Value.absent(),
              }) => OutboxCompanion.insert(
                id: id,
                userId: userId,
                kind: kind,
                idempotencyKey: idempotencyKey,
                method: method,
                path: path,
                bodyJson: bodyJson,
                createdAtMs: createdAtMs,
                attempts: attempts,
                nextAttemptAtMs: nextAttemptAtMs,
                lastErrorCode: lastErrorCode,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$OutboxTable, OutboxRow>(table),
                  BaseReferences<_$AppDatabase, $OutboxTable, OutboxRow>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$OutboxTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $OutboxTable,
      OutboxRow,
      $$OutboxTableFilterComposer,
      $$OutboxTableOrderingComposer,
      $$OutboxTableAnnotationComposer,
      $$OutboxTableCreateCompanionBuilder,
      $$OutboxTableUpdateCompanionBuilder,
      (OutboxRow, BaseReferences<_$AppDatabase, $OutboxTable, OutboxRow>),
      OutboxRow,
      PrefetchHooks Function()
    >;
typedef $$SessionDraftsTableCreateCompanionBuilder =
    SessionDraftsCompanion Function({
      required String draftKey,
      required String userId,
      required String sessionId,
      required String generationKey,
      required String payloadJson,
      required int endsAtMs,
      Value<bool> pendingSubmission,
      required int updatedAtMs,
      Value<int> rowid,
    });
typedef $$SessionDraftsTableUpdateCompanionBuilder =
    SessionDraftsCompanion Function({
      Value<String> draftKey,
      Value<String> userId,
      Value<String> sessionId,
      Value<String> generationKey,
      Value<String> payloadJson,
      Value<int> endsAtMs,
      Value<bool> pendingSubmission,
      Value<int> updatedAtMs,
      Value<int> rowid,
    });

class $$SessionDraftsTableFilterComposer
    extends Composer<_$AppDatabase, $SessionDraftsTable> {
  $$SessionDraftsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get draftKey => $composableBuilder(
    column: $table.draftKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sessionId => $composableBuilder(
    column: $table.sessionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get generationKey => $composableBuilder(
    column: $table.generationKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get endsAtMs => $composableBuilder(
    column: $table.endsAtMs,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get pendingSubmission => $composableBuilder(
    column: $table.pendingSubmission,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get updatedAtMs => $composableBuilder(
    column: $table.updatedAtMs,
    builder: (column) => ColumnFilters(column),
  );
}

class $$SessionDraftsTableOrderingComposer
    extends Composer<_$AppDatabase, $SessionDraftsTable> {
  $$SessionDraftsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get draftKey => $composableBuilder(
    column: $table.draftKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sessionId => $composableBuilder(
    column: $table.sessionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get generationKey => $composableBuilder(
    column: $table.generationKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get endsAtMs => $composableBuilder(
    column: $table.endsAtMs,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get pendingSubmission => $composableBuilder(
    column: $table.pendingSubmission,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get updatedAtMs => $composableBuilder(
    column: $table.updatedAtMs,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$SessionDraftsTableAnnotationComposer
    extends Composer<_$AppDatabase, $SessionDraftsTable> {
  $$SessionDraftsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get draftKey =>
      $composableBuilder(column: $table.draftKey, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get sessionId =>
      $composableBuilder(column: $table.sessionId, builder: (column) => column);

  GeneratedColumn<String> get generationKey => $composableBuilder(
    column: $table.generationKey,
    builder: (column) => column,
  );

  GeneratedColumn<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => column,
  );

  GeneratedColumn<int> get endsAtMs =>
      $composableBuilder(column: $table.endsAtMs, builder: (column) => column);

  GeneratedColumn<bool> get pendingSubmission => $composableBuilder(
    column: $table.pendingSubmission,
    builder: (column) => column,
  );

  GeneratedColumn<int> get updatedAtMs => $composableBuilder(
    column: $table.updatedAtMs,
    builder: (column) => column,
  );
}

class $$SessionDraftsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $SessionDraftsTable,
          SessionDraftRow,
          $$SessionDraftsTableFilterComposer,
          $$SessionDraftsTableOrderingComposer,
          $$SessionDraftsTableAnnotationComposer,
          $$SessionDraftsTableCreateCompanionBuilder,
          $$SessionDraftsTableUpdateCompanionBuilder,
          (
            SessionDraftRow,
            BaseReferences<_$AppDatabase, $SessionDraftsTable, SessionDraftRow>,
          ),
          SessionDraftRow,
          PrefetchHooks Function()
        > {
  $$SessionDraftsTableTableManager(_$AppDatabase db, $SessionDraftsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SessionDraftsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SessionDraftsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SessionDraftsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> draftKey = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> sessionId = const Value.absent(),
                Value<String> generationKey = const Value.absent(),
                Value<String> payloadJson = const Value.absent(),
                Value<int> endsAtMs = const Value.absent(),
                Value<bool> pendingSubmission = const Value.absent(),
                Value<int> updatedAtMs = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SessionDraftsCompanion(
                draftKey: draftKey,
                userId: userId,
                sessionId: sessionId,
                generationKey: generationKey,
                payloadJson: payloadJson,
                endsAtMs: endsAtMs,
                pendingSubmission: pendingSubmission,
                updatedAtMs: updatedAtMs,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String draftKey,
                required String userId,
                required String sessionId,
                required String generationKey,
                required String payloadJson,
                required int endsAtMs,
                Value<bool> pendingSubmission = const Value.absent(),
                required int updatedAtMs,
                Value<int> rowid = const Value.absent(),
              }) => SessionDraftsCompanion.insert(
                draftKey: draftKey,
                userId: userId,
                sessionId: sessionId,
                generationKey: generationKey,
                payloadJson: payloadJson,
                endsAtMs: endsAtMs,
                pendingSubmission: pendingSubmission,
                updatedAtMs: updatedAtMs,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$SessionDraftsTable, SessionDraftRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $SessionDraftsTable,
                    SessionDraftRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$SessionDraftsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $SessionDraftsTable,
      SessionDraftRow,
      $$SessionDraftsTableFilterComposer,
      $$SessionDraftsTableOrderingComposer,
      $$SessionDraftsTableAnnotationComposer,
      $$SessionDraftsTableCreateCompanionBuilder,
      $$SessionDraftsTableUpdateCompanionBuilder,
      (
        SessionDraftRow,
        BaseReferences<_$AppDatabase, $SessionDraftsTable, SessionDraftRow>,
      ),
      SessionDraftRow,
      PrefetchHooks Function()
    >;
typedef $$CachedPlanTableCreateCompanionBuilder =
    CachedPlanCompanion Function({
      required String userId,
      required int minutes,
      required String json,
      required int fetchedAtMs,
      Value<int> rowid,
    });
typedef $$CachedPlanTableUpdateCompanionBuilder =
    CachedPlanCompanion Function({
      Value<String> userId,
      Value<int> minutes,
      Value<String> json,
      Value<int> fetchedAtMs,
      Value<int> rowid,
    });

class $$CachedPlanTableFilterComposer
    extends Composer<_$AppDatabase, $CachedPlanTable> {
  $$CachedPlanTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get minutes => $composableBuilder(
    column: $table.minutes,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get json => $composableBuilder(
    column: $table.json,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get fetchedAtMs => $composableBuilder(
    column: $table.fetchedAtMs,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedPlanTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedPlanTable> {
  $$CachedPlanTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get minutes => $composableBuilder(
    column: $table.minutes,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get json => $composableBuilder(
    column: $table.json,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get fetchedAtMs => $composableBuilder(
    column: $table.fetchedAtMs,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedPlanTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedPlanTable> {
  $$CachedPlanTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<int> get minutes =>
      $composableBuilder(column: $table.minutes, builder: (column) => column);

  GeneratedColumn<String> get json =>
      $composableBuilder(column: $table.json, builder: (column) => column);

  GeneratedColumn<int> get fetchedAtMs => $composableBuilder(
    column: $table.fetchedAtMs,
    builder: (column) => column,
  );
}

class $$CachedPlanTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CachedPlanTable,
          CachedPlanRow,
          $$CachedPlanTableFilterComposer,
          $$CachedPlanTableOrderingComposer,
          $$CachedPlanTableAnnotationComposer,
          $$CachedPlanTableCreateCompanionBuilder,
          $$CachedPlanTableUpdateCompanionBuilder,
          (
            CachedPlanRow,
            BaseReferences<_$AppDatabase, $CachedPlanTable, CachedPlanRow>,
          ),
          CachedPlanRow,
          PrefetchHooks Function()
        > {
  $$CachedPlanTableTableManager(_$AppDatabase db, $CachedPlanTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedPlanTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedPlanTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedPlanTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<int> minutes = const Value.absent(),
                Value<String> json = const Value.absent(),
                Value<int> fetchedAtMs = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedPlanCompanion(
                userId: userId,
                minutes: minutes,
                json: json,
                fetchedAtMs: fetchedAtMs,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                required int minutes,
                required String json,
                required int fetchedAtMs,
                Value<int> rowid = const Value.absent(),
              }) => CachedPlanCompanion.insert(
                userId: userId,
                minutes: minutes,
                json: json,
                fetchedAtMs: fetchedAtMs,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedPlanTable, CachedPlanRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $CachedPlanTable,
                    CachedPlanRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedPlanTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CachedPlanTable,
      CachedPlanRow,
      $$CachedPlanTableFilterComposer,
      $$CachedPlanTableOrderingComposer,
      $$CachedPlanTableAnnotationComposer,
      $$CachedPlanTableCreateCompanionBuilder,
      $$CachedPlanTableUpdateCompanionBuilder,
      (
        CachedPlanRow,
        BaseReferences<_$AppDatabase, $CachedPlanTable, CachedPlanRow>,
      ),
      CachedPlanRow,
      PrefetchHooks Function()
    >;
typedef $$CachedAttemptsTableCreateCompanionBuilder =
    CachedAttemptsCompanion Function({
      required String userId,
      required String attemptId,
      required String subject,
      required int completedAtMs,
      required String json,
      required int fetchedAtMs,
      Value<int> rowid,
    });
typedef $$CachedAttemptsTableUpdateCompanionBuilder =
    CachedAttemptsCompanion Function({
      Value<String> userId,
      Value<String> attemptId,
      Value<String> subject,
      Value<int> completedAtMs,
      Value<String> json,
      Value<int> fetchedAtMs,
      Value<int> rowid,
    });

class $$CachedAttemptsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedAttemptsTable> {
  $$CachedAttemptsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get attemptId => $composableBuilder(
    column: $table.attemptId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get subject => $composableBuilder(
    column: $table.subject,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get completedAtMs => $composableBuilder(
    column: $table.completedAtMs,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get json => $composableBuilder(
    column: $table.json,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get fetchedAtMs => $composableBuilder(
    column: $table.fetchedAtMs,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedAttemptsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedAttemptsTable> {
  $$CachedAttemptsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get attemptId => $composableBuilder(
    column: $table.attemptId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get subject => $composableBuilder(
    column: $table.subject,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get completedAtMs => $composableBuilder(
    column: $table.completedAtMs,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get json => $composableBuilder(
    column: $table.json,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get fetchedAtMs => $composableBuilder(
    column: $table.fetchedAtMs,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedAttemptsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedAttemptsTable> {
  $$CachedAttemptsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get attemptId =>
      $composableBuilder(column: $table.attemptId, builder: (column) => column);

  GeneratedColumn<String> get subject =>
      $composableBuilder(column: $table.subject, builder: (column) => column);

  GeneratedColumn<int> get completedAtMs => $composableBuilder(
    column: $table.completedAtMs,
    builder: (column) => column,
  );

  GeneratedColumn<String> get json =>
      $composableBuilder(column: $table.json, builder: (column) => column);

  GeneratedColumn<int> get fetchedAtMs => $composableBuilder(
    column: $table.fetchedAtMs,
    builder: (column) => column,
  );
}

class $$CachedAttemptsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CachedAttemptsTable,
          CachedAttemptRow,
          $$CachedAttemptsTableFilterComposer,
          $$CachedAttemptsTableOrderingComposer,
          $$CachedAttemptsTableAnnotationComposer,
          $$CachedAttemptsTableCreateCompanionBuilder,
          $$CachedAttemptsTableUpdateCompanionBuilder,
          (
            CachedAttemptRow,
            BaseReferences<
              _$AppDatabase,
              $CachedAttemptsTable,
              CachedAttemptRow
            >,
          ),
          CachedAttemptRow,
          PrefetchHooks Function()
        > {
  $$CachedAttemptsTableTableManager(
    _$AppDatabase db,
    $CachedAttemptsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedAttemptsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedAttemptsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedAttemptsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<String> attemptId = const Value.absent(),
                Value<String> subject = const Value.absent(),
                Value<int> completedAtMs = const Value.absent(),
                Value<String> json = const Value.absent(),
                Value<int> fetchedAtMs = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedAttemptsCompanion(
                userId: userId,
                attemptId: attemptId,
                subject: subject,
                completedAtMs: completedAtMs,
                json: json,
                fetchedAtMs: fetchedAtMs,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                required String attemptId,
                required String subject,
                required int completedAtMs,
                required String json,
                required int fetchedAtMs,
                Value<int> rowid = const Value.absent(),
              }) => CachedAttemptsCompanion.insert(
                userId: userId,
                attemptId: attemptId,
                subject: subject,
                completedAtMs: completedAtMs,
                json: json,
                fetchedAtMs: fetchedAtMs,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedAttemptsTable, CachedAttemptRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $CachedAttemptsTable,
                    CachedAttemptRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedAttemptsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CachedAttemptsTable,
      CachedAttemptRow,
      $$CachedAttemptsTableFilterComposer,
      $$CachedAttemptsTableOrderingComposer,
      $$CachedAttemptsTableAnnotationComposer,
      $$CachedAttemptsTableCreateCompanionBuilder,
      $$CachedAttemptsTableUpdateCompanionBuilder,
      (
        CachedAttemptRow,
        BaseReferences<_$AppDatabase, $CachedAttemptsTable, CachedAttemptRow>,
      ),
      CachedAttemptRow,
      PrefetchHooks Function()
    >;
typedef $$CacheEntriesTableCreateCompanionBuilder =
    CacheEntriesCompanion Function({
      required String userId,
      required String cacheKey,
      required String json,
      required int fetchedAtMs,
      Value<int> rowid,
    });
typedef $$CacheEntriesTableUpdateCompanionBuilder =
    CacheEntriesCompanion Function({
      Value<String> userId,
      Value<String> cacheKey,
      Value<String> json,
      Value<int> fetchedAtMs,
      Value<int> rowid,
    });

class $$CacheEntriesTableFilterComposer
    extends Composer<_$AppDatabase, $CacheEntriesTable> {
  $$CacheEntriesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get cacheKey => $composableBuilder(
    column: $table.cacheKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get json => $composableBuilder(
    column: $table.json,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get fetchedAtMs => $composableBuilder(
    column: $table.fetchedAtMs,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CacheEntriesTableOrderingComposer
    extends Composer<_$AppDatabase, $CacheEntriesTable> {
  $$CacheEntriesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get cacheKey => $composableBuilder(
    column: $table.cacheKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get json => $composableBuilder(
    column: $table.json,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get fetchedAtMs => $composableBuilder(
    column: $table.fetchedAtMs,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CacheEntriesTableAnnotationComposer
    extends Composer<_$AppDatabase, $CacheEntriesTable> {
  $$CacheEntriesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get cacheKey =>
      $composableBuilder(column: $table.cacheKey, builder: (column) => column);

  GeneratedColumn<String> get json =>
      $composableBuilder(column: $table.json, builder: (column) => column);

  GeneratedColumn<int> get fetchedAtMs => $composableBuilder(
    column: $table.fetchedAtMs,
    builder: (column) => column,
  );
}

class $$CacheEntriesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CacheEntriesTable,
          CacheEntryRow,
          $$CacheEntriesTableFilterComposer,
          $$CacheEntriesTableOrderingComposer,
          $$CacheEntriesTableAnnotationComposer,
          $$CacheEntriesTableCreateCompanionBuilder,
          $$CacheEntriesTableUpdateCompanionBuilder,
          (
            CacheEntryRow,
            BaseReferences<_$AppDatabase, $CacheEntriesTable, CacheEntryRow>,
          ),
          CacheEntryRow,
          PrefetchHooks Function()
        > {
  $$CacheEntriesTableTableManager(_$AppDatabase db, $CacheEntriesTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CacheEntriesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CacheEntriesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CacheEntriesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<String> cacheKey = const Value.absent(),
                Value<String> json = const Value.absent(),
                Value<int> fetchedAtMs = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CacheEntriesCompanion(
                userId: userId,
                cacheKey: cacheKey,
                json: json,
                fetchedAtMs: fetchedAtMs,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                required String cacheKey,
                required String json,
                required int fetchedAtMs,
                Value<int> rowid = const Value.absent(),
              }) => CacheEntriesCompanion.insert(
                userId: userId,
                cacheKey: cacheKey,
                json: json,
                fetchedAtMs: fetchedAtMs,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CacheEntriesTable, CacheEntryRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $CacheEntriesTable,
                    CacheEntryRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CacheEntriesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CacheEntriesTable,
      CacheEntryRow,
      $$CacheEntriesTableFilterComposer,
      $$CacheEntriesTableOrderingComposer,
      $$CacheEntriesTableAnnotationComposer,
      $$CacheEntriesTableCreateCompanionBuilder,
      $$CacheEntriesTableUpdateCompanionBuilder,
      (
        CacheEntryRow,
        BaseReferences<_$AppDatabase, $CacheEntriesTable, CacheEntryRow>,
      ),
      CacheEntryRow,
      PrefetchHooks Function()
    >;
typedef $$LearnCacheTableCreateCompanionBuilder =
    LearnCacheCompanion Function({
      required String userId,
      required String cacheKey,
      Value<String> version,
      Value<String> contentHash,
      required String json,
      Value<int> sizeBytes,
      required int updatedAtMs,
      Value<int> rowid,
    });
typedef $$LearnCacheTableUpdateCompanionBuilder =
    LearnCacheCompanion Function({
      Value<String> userId,
      Value<String> cacheKey,
      Value<String> version,
      Value<String> contentHash,
      Value<String> json,
      Value<int> sizeBytes,
      Value<int> updatedAtMs,
      Value<int> rowid,
    });

class $$LearnCacheTableFilterComposer
    extends Composer<_$AppDatabase, $LearnCacheTable> {
  $$LearnCacheTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get cacheKey => $composableBuilder(
    column: $table.cacheKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get version => $composableBuilder(
    column: $table.version,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get contentHash => $composableBuilder(
    column: $table.contentHash,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get json => $composableBuilder(
    column: $table.json,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get sizeBytes => $composableBuilder(
    column: $table.sizeBytes,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get updatedAtMs => $composableBuilder(
    column: $table.updatedAtMs,
    builder: (column) => ColumnFilters(column),
  );
}

class $$LearnCacheTableOrderingComposer
    extends Composer<_$AppDatabase, $LearnCacheTable> {
  $$LearnCacheTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get cacheKey => $composableBuilder(
    column: $table.cacheKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get version => $composableBuilder(
    column: $table.version,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get contentHash => $composableBuilder(
    column: $table.contentHash,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get json => $composableBuilder(
    column: $table.json,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get sizeBytes => $composableBuilder(
    column: $table.sizeBytes,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get updatedAtMs => $composableBuilder(
    column: $table.updatedAtMs,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$LearnCacheTableAnnotationComposer
    extends Composer<_$AppDatabase, $LearnCacheTable> {
  $$LearnCacheTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get cacheKey =>
      $composableBuilder(column: $table.cacheKey, builder: (column) => column);

  GeneratedColumn<String> get version =>
      $composableBuilder(column: $table.version, builder: (column) => column);

  GeneratedColumn<String> get contentHash => $composableBuilder(
    column: $table.contentHash,
    builder: (column) => column,
  );

  GeneratedColumn<String> get json =>
      $composableBuilder(column: $table.json, builder: (column) => column);

  GeneratedColumn<int> get sizeBytes =>
      $composableBuilder(column: $table.sizeBytes, builder: (column) => column);

  GeneratedColumn<int> get updatedAtMs => $composableBuilder(
    column: $table.updatedAtMs,
    builder: (column) => column,
  );
}

class $$LearnCacheTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $LearnCacheTable,
          LearnCacheRow,
          $$LearnCacheTableFilterComposer,
          $$LearnCacheTableOrderingComposer,
          $$LearnCacheTableAnnotationComposer,
          $$LearnCacheTableCreateCompanionBuilder,
          $$LearnCacheTableUpdateCompanionBuilder,
          (
            LearnCacheRow,
            BaseReferences<_$AppDatabase, $LearnCacheTable, LearnCacheRow>,
          ),
          LearnCacheRow,
          PrefetchHooks Function()
        > {
  $$LearnCacheTableTableManager(_$AppDatabase db, $LearnCacheTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$LearnCacheTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$LearnCacheTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$LearnCacheTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<String> cacheKey = const Value.absent(),
                Value<String> version = const Value.absent(),
                Value<String> contentHash = const Value.absent(),
                Value<String> json = const Value.absent(),
                Value<int> sizeBytes = const Value.absent(),
                Value<int> updatedAtMs = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LearnCacheCompanion(
                userId: userId,
                cacheKey: cacheKey,
                version: version,
                contentHash: contentHash,
                json: json,
                sizeBytes: sizeBytes,
                updatedAtMs: updatedAtMs,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                required String cacheKey,
                Value<String> version = const Value.absent(),
                Value<String> contentHash = const Value.absent(),
                required String json,
                Value<int> sizeBytes = const Value.absent(),
                required int updatedAtMs,
                Value<int> rowid = const Value.absent(),
              }) => LearnCacheCompanion.insert(
                userId: userId,
                cacheKey: cacheKey,
                version: version,
                contentHash: contentHash,
                json: json,
                sizeBytes: sizeBytes,
                updatedAtMs: updatedAtMs,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$LearnCacheTable, LearnCacheRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $LearnCacheTable,
                    LearnCacheRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$LearnCacheTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $LearnCacheTable,
      LearnCacheRow,
      $$LearnCacheTableFilterComposer,
      $$LearnCacheTableOrderingComposer,
      $$LearnCacheTableAnnotationComposer,
      $$LearnCacheTableCreateCompanionBuilder,
      $$LearnCacheTableUpdateCompanionBuilder,
      (
        LearnCacheRow,
        BaseReferences<_$AppDatabase, $LearnCacheTable, LearnCacheRow>,
      ),
      LearnCacheRow,
      PrefetchHooks Function()
    >;
typedef $$ReviewLogTableCreateCompanionBuilder =
    ReviewLogCompanion Function({
      Value<int> id,
      required String userId,
      required String attemptId,
      required String questionId,
      required String kind,
      required int atMs,
    });
typedef $$ReviewLogTableUpdateCompanionBuilder =
    ReviewLogCompanion Function({
      Value<int> id,
      Value<String> userId,
      Value<String> attemptId,
      Value<String> questionId,
      Value<String> kind,
      Value<int> atMs,
    });

class $$ReviewLogTableFilterComposer
    extends Composer<_$AppDatabase, $ReviewLogTable> {
  $$ReviewLogTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get attemptId => $composableBuilder(
    column: $table.attemptId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get questionId => $composableBuilder(
    column: $table.questionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get atMs => $composableBuilder(
    column: $table.atMs,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ReviewLogTableOrderingComposer
    extends Composer<_$AppDatabase, $ReviewLogTable> {
  $$ReviewLogTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get attemptId => $composableBuilder(
    column: $table.attemptId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get questionId => $composableBuilder(
    column: $table.questionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get atMs => $composableBuilder(
    column: $table.atMs,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ReviewLogTableAnnotationComposer
    extends Composer<_$AppDatabase, $ReviewLogTable> {
  $$ReviewLogTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get attemptId =>
      $composableBuilder(column: $table.attemptId, builder: (column) => column);

  GeneratedColumn<String> get questionId => $composableBuilder(
    column: $table.questionId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get kind =>
      $composableBuilder(column: $table.kind, builder: (column) => column);

  GeneratedColumn<int> get atMs =>
      $composableBuilder(column: $table.atMs, builder: (column) => column);
}

class $$ReviewLogTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ReviewLogTable,
          ReviewLogRow,
          $$ReviewLogTableFilterComposer,
          $$ReviewLogTableOrderingComposer,
          $$ReviewLogTableAnnotationComposer,
          $$ReviewLogTableCreateCompanionBuilder,
          $$ReviewLogTableUpdateCompanionBuilder,
          (
            ReviewLogRow,
            BaseReferences<_$AppDatabase, $ReviewLogTable, ReviewLogRow>,
          ),
          ReviewLogRow,
          PrefetchHooks Function()
        > {
  $$ReviewLogTableTableManager(_$AppDatabase db, $ReviewLogTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ReviewLogTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ReviewLogTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ReviewLogTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> attemptId = const Value.absent(),
                Value<String> questionId = const Value.absent(),
                Value<String> kind = const Value.absent(),
                Value<int> atMs = const Value.absent(),
              }) => ReviewLogCompanion(
                id: id,
                userId: userId,
                attemptId: attemptId,
                questionId: questionId,
                kind: kind,
                atMs: atMs,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String userId,
                required String attemptId,
                required String questionId,
                required String kind,
                required int atMs,
              }) => ReviewLogCompanion.insert(
                id: id,
                userId: userId,
                attemptId: attemptId,
                questionId: questionId,
                kind: kind,
                atMs: atMs,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$ReviewLogTable, ReviewLogRow>(table),
                  BaseReferences<_$AppDatabase, $ReviewLogTable, ReviewLogRow>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ReviewLogTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ReviewLogTable,
      ReviewLogRow,
      $$ReviewLogTableFilterComposer,
      $$ReviewLogTableOrderingComposer,
      $$ReviewLogTableAnnotationComposer,
      $$ReviewLogTableCreateCompanionBuilder,
      $$ReviewLogTableUpdateCompanionBuilder,
      (
        ReviewLogRow,
        BaseReferences<_$AppDatabase, $ReviewLogTable, ReviewLogRow>,
      ),
      ReviewLogRow,
      PrefetchHooks Function()
    >;
typedef $$AnalyticsQueueTableCreateCompanionBuilder =
    AnalyticsQueueCompanion Function({
      required String eventId,
      required String userId,
      required String name,
      required String propsJson,
      Value<String?> appVersion,
      required int occurredAtMs,
      Value<int> rowid,
    });
typedef $$AnalyticsQueueTableUpdateCompanionBuilder =
    AnalyticsQueueCompanion Function({
      Value<String> eventId,
      Value<String> userId,
      Value<String> name,
      Value<String> propsJson,
      Value<String?> appVersion,
      Value<int> occurredAtMs,
      Value<int> rowid,
    });

class $$AnalyticsQueueTableFilterComposer
    extends Composer<_$AppDatabase, $AnalyticsQueueTable> {
  $$AnalyticsQueueTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get eventId => $composableBuilder(
    column: $table.eventId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get propsJson => $composableBuilder(
    column: $table.propsJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get appVersion => $composableBuilder(
    column: $table.appVersion,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get occurredAtMs => $composableBuilder(
    column: $table.occurredAtMs,
    builder: (column) => ColumnFilters(column),
  );
}

class $$AnalyticsQueueTableOrderingComposer
    extends Composer<_$AppDatabase, $AnalyticsQueueTable> {
  $$AnalyticsQueueTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get eventId => $composableBuilder(
    column: $table.eventId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get propsJson => $composableBuilder(
    column: $table.propsJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get appVersion => $composableBuilder(
    column: $table.appVersion,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get occurredAtMs => $composableBuilder(
    column: $table.occurredAtMs,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$AnalyticsQueueTableAnnotationComposer
    extends Composer<_$AppDatabase, $AnalyticsQueueTable> {
  $$AnalyticsQueueTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get eventId =>
      $composableBuilder(column: $table.eventId, builder: (column) => column);

  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get propsJson =>
      $composableBuilder(column: $table.propsJson, builder: (column) => column);

  GeneratedColumn<String> get appVersion => $composableBuilder(
    column: $table.appVersion,
    builder: (column) => column,
  );

  GeneratedColumn<int> get occurredAtMs => $composableBuilder(
    column: $table.occurredAtMs,
    builder: (column) => column,
  );
}

class $$AnalyticsQueueTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $AnalyticsQueueTable,
          AnalyticsQueueRow,
          $$AnalyticsQueueTableFilterComposer,
          $$AnalyticsQueueTableOrderingComposer,
          $$AnalyticsQueueTableAnnotationComposer,
          $$AnalyticsQueueTableCreateCompanionBuilder,
          $$AnalyticsQueueTableUpdateCompanionBuilder,
          (
            AnalyticsQueueRow,
            BaseReferences<
              _$AppDatabase,
              $AnalyticsQueueTable,
              AnalyticsQueueRow
            >,
          ),
          AnalyticsQueueRow,
          PrefetchHooks Function()
        > {
  $$AnalyticsQueueTableTableManager(
    _$AppDatabase db,
    $AnalyticsQueueTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$AnalyticsQueueTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$AnalyticsQueueTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$AnalyticsQueueTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> eventId = const Value.absent(),
                Value<String> userId = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String> propsJson = const Value.absent(),
                Value<String?> appVersion = const Value.absent(),
                Value<int> occurredAtMs = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => AnalyticsQueueCompanion(
                eventId: eventId,
                userId: userId,
                name: name,
                propsJson: propsJson,
                appVersion: appVersion,
                occurredAtMs: occurredAtMs,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String eventId,
                required String userId,
                required String name,
                required String propsJson,
                Value<String?> appVersion = const Value.absent(),
                required int occurredAtMs,
                Value<int> rowid = const Value.absent(),
              }) => AnalyticsQueueCompanion.insert(
                eventId: eventId,
                userId: userId,
                name: name,
                propsJson: propsJson,
                appVersion: appVersion,
                occurredAtMs: occurredAtMs,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$AnalyticsQueueTable, AnalyticsQueueRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $AnalyticsQueueTable,
                    AnalyticsQueueRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$AnalyticsQueueTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $AnalyticsQueueTable,
      AnalyticsQueueRow,
      $$AnalyticsQueueTableFilterComposer,
      $$AnalyticsQueueTableOrderingComposer,
      $$AnalyticsQueueTableAnnotationComposer,
      $$AnalyticsQueueTableCreateCompanionBuilder,
      $$AnalyticsQueueTableUpdateCompanionBuilder,
      (
        AnalyticsQueueRow,
        BaseReferences<_$AppDatabase, $AnalyticsQueueTable, AnalyticsQueueRow>,
      ),
      AnalyticsQueueRow,
      PrefetchHooks Function()
    >;
typedef $$PendingResultsTableCreateCompanionBuilder =
    PendingResultsCompanion Function({
      required String userId,
      required String attemptId,
      required int receivedAtMs,
      Value<int?> openedAtMs,
      Value<int> rowid,
    });
typedef $$PendingResultsTableUpdateCompanionBuilder =
    PendingResultsCompanion Function({
      Value<String> userId,
      Value<String> attemptId,
      Value<int> receivedAtMs,
      Value<int?> openedAtMs,
      Value<int> rowid,
    });

class $$PendingResultsTableFilterComposer
    extends Composer<_$AppDatabase, $PendingResultsTable> {
  $$PendingResultsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get attemptId => $composableBuilder(
    column: $table.attemptId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get receivedAtMs => $composableBuilder(
    column: $table.receivedAtMs,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get openedAtMs => $composableBuilder(
    column: $table.openedAtMs,
    builder: (column) => ColumnFilters(column),
  );
}

class $$PendingResultsTableOrderingComposer
    extends Composer<_$AppDatabase, $PendingResultsTable> {
  $$PendingResultsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get attemptId => $composableBuilder(
    column: $table.attemptId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get receivedAtMs => $composableBuilder(
    column: $table.receivedAtMs,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get openedAtMs => $composableBuilder(
    column: $table.openedAtMs,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$PendingResultsTableAnnotationComposer
    extends Composer<_$AppDatabase, $PendingResultsTable> {
  $$PendingResultsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get attemptId =>
      $composableBuilder(column: $table.attemptId, builder: (column) => column);

  GeneratedColumn<int> get receivedAtMs => $composableBuilder(
    column: $table.receivedAtMs,
    builder: (column) => column,
  );

  GeneratedColumn<int> get openedAtMs => $composableBuilder(
    column: $table.openedAtMs,
    builder: (column) => column,
  );
}

class $$PendingResultsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $PendingResultsTable,
          PendingResultRow,
          $$PendingResultsTableFilterComposer,
          $$PendingResultsTableOrderingComposer,
          $$PendingResultsTableAnnotationComposer,
          $$PendingResultsTableCreateCompanionBuilder,
          $$PendingResultsTableUpdateCompanionBuilder,
          (
            PendingResultRow,
            BaseReferences<
              _$AppDatabase,
              $PendingResultsTable,
              PendingResultRow
            >,
          ),
          PendingResultRow,
          PrefetchHooks Function()
        > {
  $$PendingResultsTableTableManager(
    _$AppDatabase db,
    $PendingResultsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$PendingResultsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$PendingResultsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PendingResultsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<String> attemptId = const Value.absent(),
                Value<int> receivedAtMs = const Value.absent(),
                Value<int?> openedAtMs = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => PendingResultsCompanion(
                userId: userId,
                attemptId: attemptId,
                receivedAtMs: receivedAtMs,
                openedAtMs: openedAtMs,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                required String attemptId,
                required int receivedAtMs,
                Value<int?> openedAtMs = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => PendingResultsCompanion.insert(
                userId: userId,
                attemptId: attemptId,
                receivedAtMs: receivedAtMs,
                openedAtMs: openedAtMs,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$PendingResultsTable, PendingResultRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $PendingResultsTable,
                    PendingResultRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$PendingResultsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $PendingResultsTable,
      PendingResultRow,
      $$PendingResultsTableFilterComposer,
      $$PendingResultsTableOrderingComposer,
      $$PendingResultsTableAnnotationComposer,
      $$PendingResultsTableCreateCompanionBuilder,
      $$PendingResultsTableUpdateCompanionBuilder,
      (
        PendingResultRow,
        BaseReferences<_$AppDatabase, $PendingResultsTable, PendingResultRow>,
      ),
      PendingResultRow,
      PrefetchHooks Function()
    >;
typedef $$RepairLocalTableCreateCompanionBuilder =
    RepairLocalCompanion Function({
      required String userId,
      required String attemptId,
      required String questionId,
      required String requestId,
      required String status,
      Value<int?> ackedAtMs,
      Value<int> rowid,
    });
typedef $$RepairLocalTableUpdateCompanionBuilder =
    RepairLocalCompanion Function({
      Value<String> userId,
      Value<String> attemptId,
      Value<String> questionId,
      Value<String> requestId,
      Value<String> status,
      Value<int?> ackedAtMs,
      Value<int> rowid,
    });

class $$RepairLocalTableFilterComposer
    extends Composer<_$AppDatabase, $RepairLocalTable> {
  $$RepairLocalTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get attemptId => $composableBuilder(
    column: $table.attemptId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get questionId => $composableBuilder(
    column: $table.questionId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get requestId => $composableBuilder(
    column: $table.requestId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get ackedAtMs => $composableBuilder(
    column: $table.ackedAtMs,
    builder: (column) => ColumnFilters(column),
  );
}

class $$RepairLocalTableOrderingComposer
    extends Composer<_$AppDatabase, $RepairLocalTable> {
  $$RepairLocalTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get attemptId => $composableBuilder(
    column: $table.attemptId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get questionId => $composableBuilder(
    column: $table.questionId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get requestId => $composableBuilder(
    column: $table.requestId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get ackedAtMs => $composableBuilder(
    column: $table.ackedAtMs,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$RepairLocalTableAnnotationComposer
    extends Composer<_$AppDatabase, $RepairLocalTable> {
  $$RepairLocalTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get attemptId =>
      $composableBuilder(column: $table.attemptId, builder: (column) => column);

  GeneratedColumn<String> get questionId => $composableBuilder(
    column: $table.questionId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get requestId =>
      $composableBuilder(column: $table.requestId, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get ackedAtMs =>
      $composableBuilder(column: $table.ackedAtMs, builder: (column) => column);
}

class $$RepairLocalTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $RepairLocalTable,
          RepairLocalRow,
          $$RepairLocalTableFilterComposer,
          $$RepairLocalTableOrderingComposer,
          $$RepairLocalTableAnnotationComposer,
          $$RepairLocalTableCreateCompanionBuilder,
          $$RepairLocalTableUpdateCompanionBuilder,
          (
            RepairLocalRow,
            BaseReferences<_$AppDatabase, $RepairLocalTable, RepairLocalRow>,
          ),
          RepairLocalRow,
          PrefetchHooks Function()
        > {
  $$RepairLocalTableTableManager(_$AppDatabase db, $RepairLocalTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$RepairLocalTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$RepairLocalTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$RepairLocalTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<String> attemptId = const Value.absent(),
                Value<String> questionId = const Value.absent(),
                Value<String> requestId = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int?> ackedAtMs = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RepairLocalCompanion(
                userId: userId,
                attemptId: attemptId,
                questionId: questionId,
                requestId: requestId,
                status: status,
                ackedAtMs: ackedAtMs,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                required String attemptId,
                required String questionId,
                required String requestId,
                required String status,
                Value<int?> ackedAtMs = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RepairLocalCompanion.insert(
                userId: userId,
                attemptId: attemptId,
                questionId: questionId,
                requestId: requestId,
                status: status,
                ackedAtMs: ackedAtMs,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$RepairLocalTable, RepairLocalRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $RepairLocalTable,
                    RepairLocalRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$RepairLocalTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $RepairLocalTable,
      RepairLocalRow,
      $$RepairLocalTableFilterComposer,
      $$RepairLocalTableOrderingComposer,
      $$RepairLocalTableAnnotationComposer,
      $$RepairLocalTableCreateCompanionBuilder,
      $$RepairLocalTableUpdateCompanionBuilder,
      (
        RepairLocalRow,
        BaseReferences<_$AppDatabase, $RepairLocalTable, RepairLocalRow>,
      ),
      RepairLocalRow,
      PrefetchHooks Function()
    >;
typedef $$RhythmSeenTableCreateCompanionBuilder =
    RhythmSeenCompanion Function({
      required String userId,
      Value<String?> lastSeenWeekJson,
      Value<String?> lastCelebratedWeekStart,
      Value<String> celebratedIdsJson,
      Value<int> rowid,
    });
typedef $$RhythmSeenTableUpdateCompanionBuilder =
    RhythmSeenCompanion Function({
      Value<String> userId,
      Value<String?> lastSeenWeekJson,
      Value<String?> lastCelebratedWeekStart,
      Value<String> celebratedIdsJson,
      Value<int> rowid,
    });

class $$RhythmSeenTableFilterComposer
    extends Composer<_$AppDatabase, $RhythmSeenTable> {
  $$RhythmSeenTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastSeenWeekJson => $composableBuilder(
    column: $table.lastSeenWeekJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastCelebratedWeekStart => $composableBuilder(
    column: $table.lastCelebratedWeekStart,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get celebratedIdsJson => $composableBuilder(
    column: $table.celebratedIdsJson,
    builder: (column) => ColumnFilters(column),
  );
}

class $$RhythmSeenTableOrderingComposer
    extends Composer<_$AppDatabase, $RhythmSeenTable> {
  $$RhythmSeenTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastSeenWeekJson => $composableBuilder(
    column: $table.lastSeenWeekJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastCelebratedWeekStart => $composableBuilder(
    column: $table.lastCelebratedWeekStart,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get celebratedIdsJson => $composableBuilder(
    column: $table.celebratedIdsJson,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$RhythmSeenTableAnnotationComposer
    extends Composer<_$AppDatabase, $RhythmSeenTable> {
  $$RhythmSeenTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get lastSeenWeekJson => $composableBuilder(
    column: $table.lastSeenWeekJson,
    builder: (column) => column,
  );

  GeneratedColumn<String> get lastCelebratedWeekStart => $composableBuilder(
    column: $table.lastCelebratedWeekStart,
    builder: (column) => column,
  );

  GeneratedColumn<String> get celebratedIdsJson => $composableBuilder(
    column: $table.celebratedIdsJson,
    builder: (column) => column,
  );
}

class $$RhythmSeenTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $RhythmSeenTable,
          RhythmSeenRow,
          $$RhythmSeenTableFilterComposer,
          $$RhythmSeenTableOrderingComposer,
          $$RhythmSeenTableAnnotationComposer,
          $$RhythmSeenTableCreateCompanionBuilder,
          $$RhythmSeenTableUpdateCompanionBuilder,
          (
            RhythmSeenRow,
            BaseReferences<_$AppDatabase, $RhythmSeenTable, RhythmSeenRow>,
          ),
          RhythmSeenRow,
          PrefetchHooks Function()
        > {
  $$RhythmSeenTableTableManager(_$AppDatabase db, $RhythmSeenTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$RhythmSeenTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$RhythmSeenTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$RhythmSeenTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<String?> lastSeenWeekJson = const Value.absent(),
                Value<String?> lastCelebratedWeekStart = const Value.absent(),
                Value<String> celebratedIdsJson = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RhythmSeenCompanion(
                userId: userId,
                lastSeenWeekJson: lastSeenWeekJson,
                lastCelebratedWeekStart: lastCelebratedWeekStart,
                celebratedIdsJson: celebratedIdsJson,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                Value<String?> lastSeenWeekJson = const Value.absent(),
                Value<String?> lastCelebratedWeekStart = const Value.absent(),
                Value<String> celebratedIdsJson = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RhythmSeenCompanion.insert(
                userId: userId,
                lastSeenWeekJson: lastSeenWeekJson,
                lastCelebratedWeekStart: lastCelebratedWeekStart,
                celebratedIdsJson: celebratedIdsJson,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$RhythmSeenTable, RhythmSeenRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $RhythmSeenTable,
                    RhythmSeenRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$RhythmSeenTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $RhythmSeenTable,
      RhythmSeenRow,
      $$RhythmSeenTableFilterComposer,
      $$RhythmSeenTableOrderingComposer,
      $$RhythmSeenTableAnnotationComposer,
      $$RhythmSeenTableCreateCompanionBuilder,
      $$RhythmSeenTableUpdateCompanionBuilder,
      (
        RhythmSeenRow,
        BaseReferences<_$AppDatabase, $RhythmSeenTable, RhythmSeenRow>,
      ),
      RhythmSeenRow,
      PrefetchHooks Function()
    >;
typedef $$DismissalsTableCreateCompanionBuilder =
    DismissalsCompanion Function({
      required String userId,
      required String kind,
      Value<String> subject,
      Value<String> chapter,
      Value<String> sourceAttemptId,
      required int createdAtMs,
      required int expiresAtMs,
      Value<int> rowid,
    });
typedef $$DismissalsTableUpdateCompanionBuilder =
    DismissalsCompanion Function({
      Value<String> userId,
      Value<String> kind,
      Value<String> subject,
      Value<String> chapter,
      Value<String> sourceAttemptId,
      Value<int> createdAtMs,
      Value<int> expiresAtMs,
      Value<int> rowid,
    });

class $$DismissalsTableFilterComposer
    extends Composer<_$AppDatabase, $DismissalsTable> {
  $$DismissalsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get subject => $composableBuilder(
    column: $table.subject,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get chapter => $composableBuilder(
    column: $table.chapter,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sourceAttemptId => $composableBuilder(
    column: $table.sourceAttemptId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get createdAtMs => $composableBuilder(
    column: $table.createdAtMs,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get expiresAtMs => $composableBuilder(
    column: $table.expiresAtMs,
    builder: (column) => ColumnFilters(column),
  );
}

class $$DismissalsTableOrderingComposer
    extends Composer<_$AppDatabase, $DismissalsTable> {
  $$DismissalsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get userId => $composableBuilder(
    column: $table.userId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get subject => $composableBuilder(
    column: $table.subject,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get chapter => $composableBuilder(
    column: $table.chapter,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sourceAttemptId => $composableBuilder(
    column: $table.sourceAttemptId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get createdAtMs => $composableBuilder(
    column: $table.createdAtMs,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get expiresAtMs => $composableBuilder(
    column: $table.expiresAtMs,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$DismissalsTableAnnotationComposer
    extends Composer<_$AppDatabase, $DismissalsTable> {
  $$DismissalsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get kind =>
      $composableBuilder(column: $table.kind, builder: (column) => column);

  GeneratedColumn<String> get subject =>
      $composableBuilder(column: $table.subject, builder: (column) => column);

  GeneratedColumn<String> get chapter =>
      $composableBuilder(column: $table.chapter, builder: (column) => column);

  GeneratedColumn<String> get sourceAttemptId => $composableBuilder(
    column: $table.sourceAttemptId,
    builder: (column) => column,
  );

  GeneratedColumn<int> get createdAtMs => $composableBuilder(
    column: $table.createdAtMs,
    builder: (column) => column,
  );

  GeneratedColumn<int> get expiresAtMs => $composableBuilder(
    column: $table.expiresAtMs,
    builder: (column) => column,
  );
}

class $$DismissalsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $DismissalsTable,
          DismissalRow,
          $$DismissalsTableFilterComposer,
          $$DismissalsTableOrderingComposer,
          $$DismissalsTableAnnotationComposer,
          $$DismissalsTableCreateCompanionBuilder,
          $$DismissalsTableUpdateCompanionBuilder,
          (
            DismissalRow,
            BaseReferences<_$AppDatabase, $DismissalsTable, DismissalRow>,
          ),
          DismissalRow,
          PrefetchHooks Function()
        > {
  $$DismissalsTableTableManager(_$AppDatabase db, $DismissalsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DismissalsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DismissalsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DismissalsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> userId = const Value.absent(),
                Value<String> kind = const Value.absent(),
                Value<String> subject = const Value.absent(),
                Value<String> chapter = const Value.absent(),
                Value<String> sourceAttemptId = const Value.absent(),
                Value<int> createdAtMs = const Value.absent(),
                Value<int> expiresAtMs = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DismissalsCompanion(
                userId: userId,
                kind: kind,
                subject: subject,
                chapter: chapter,
                sourceAttemptId: sourceAttemptId,
                createdAtMs: createdAtMs,
                expiresAtMs: expiresAtMs,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String userId,
                required String kind,
                Value<String> subject = const Value.absent(),
                Value<String> chapter = const Value.absent(),
                Value<String> sourceAttemptId = const Value.absent(),
                required int createdAtMs,
                required int expiresAtMs,
                Value<int> rowid = const Value.absent(),
              }) => DismissalsCompanion.insert(
                userId: userId,
                kind: kind,
                subject: subject,
                chapter: chapter,
                sourceAttemptId: sourceAttemptId,
                createdAtMs: createdAtMs,
                expiresAtMs: expiresAtMs,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$DismissalsTable, DismissalRow>(table),
                  BaseReferences<_$AppDatabase, $DismissalsTable, DismissalRow>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$DismissalsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $DismissalsTable,
      DismissalRow,
      $$DismissalsTableFilterComposer,
      $$DismissalsTableOrderingComposer,
      $$DismissalsTableAnnotationComposer,
      $$DismissalsTableCreateCompanionBuilder,
      $$DismissalsTableUpdateCompanionBuilder,
      (
        DismissalRow,
        BaseReferences<_$AppDatabase, $DismissalsTable, DismissalRow>,
      ),
      DismissalRow,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$AnswerJournalTableTableManager get answerJournal =>
      $$AnswerJournalTableTableManager(_db, _db.answerJournal);
  $$OutboxTableTableManager get outbox =>
      $$OutboxTableTableManager(_db, _db.outbox);
  $$SessionDraftsTableTableManager get sessionDrafts =>
      $$SessionDraftsTableTableManager(_db, _db.sessionDrafts);
  $$CachedPlanTableTableManager get cachedPlan =>
      $$CachedPlanTableTableManager(_db, _db.cachedPlan);
  $$CachedAttemptsTableTableManager get cachedAttempts =>
      $$CachedAttemptsTableTableManager(_db, _db.cachedAttempts);
  $$CacheEntriesTableTableManager get cacheEntries =>
      $$CacheEntriesTableTableManager(_db, _db.cacheEntries);
  $$LearnCacheTableTableManager get learnCache =>
      $$LearnCacheTableTableManager(_db, _db.learnCache);
  $$ReviewLogTableTableManager get reviewLog =>
      $$ReviewLogTableTableManager(_db, _db.reviewLog);
  $$AnalyticsQueueTableTableManager get analyticsQueue =>
      $$AnalyticsQueueTableTableManager(_db, _db.analyticsQueue);
  $$PendingResultsTableTableManager get pendingResults =>
      $$PendingResultsTableTableManager(_db, _db.pendingResults);
  $$RepairLocalTableTableManager get repairLocal =>
      $$RepairLocalTableTableManager(_db, _db.repairLocal);
  $$RhythmSeenTableTableManager get rhythmSeen =>
      $$RhythmSeenTableTableManager(_db, _db.rhythmSeen);
  $$DismissalsTableTableManager get dismissals =>
      $$DismissalsTableTableManager(_db, _db.dismissals);
}
