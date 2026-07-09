import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';

import '../data/role_permissions.dart';
import '../models/app_user.dart';
import '../models/dashboard_snapshot.dart';
import '../models/erp_role.dart';
import '../utils/field_reader.dart';

class ErpRepository {
  ErpRepository({FirebaseFirestore? firestore, FirebaseStorage? storage})
    : this._(firestore, storage);

  ErpRepository._(this._firestore, this._storage);

  final FirebaseFirestore? _firestore;
  final FirebaseStorage? _storage;

  bool get isReady => _firestore != null;

  FirebaseFirestore get _db {
    final db = _firestore;
    if (db == null) {
      throw StateError('Firebase is not configured.');
    }
    return db;
  }

  FirebaseStorage get _bucket {
    final storage = _storage;
    if (storage == null) {
      throw StateError('Firebase Storage is not configured.');
    }
    return storage;
  }

  Future<Map<String, dynamic>?> userProfile(String uid) async {
    if (!isReady || uid.isEmpty) return null;
    final snapshot = await _db.collection('users').doc(uid).get();
    if (!snapshot.exists) return null;
    return withId(snapshot.id, snapshot.data() ?? const {});
  }

  Future<List<ErpRole>> roles() async {
    if (!isReady) return defaultRoles;
    try {
      final snapshot = await _db.collection('roles').get();
      final liveRoles = snapshot.docs
          .where((doc) => doc.id != '__schema')
          .map((doc) => ErpRole.fromMap(doc.id, doc.data()))
          .where((role) => role.permissions.isNotEmpty)
          .toList();
      return liveRoles.isEmpty ? defaultRoles : liveRoles;
    } catch (_) {
      return defaultRoles;
    }
  }

  Future<List<Map<String, dynamic>>> listCollection(
    String collectionName, {
    String academicYear = '',
    bool optional = true,
  }) async {
    if (!isReady) return const [];
    try {
      Query<Map<String, dynamic>> query = _db.collection(collectionName);
      if (academicYear.isNotEmpty) {
        query = query.where('academicYear', isEqualTo: academicYear);
      }
      final snapshot = await query.get();
      return snapshot.docs
          .where((doc) => doc.id != '__schema')
          .map((doc) => withId(doc.id, doc.data()))
          .toList();
    } catch (_) {
      if (optional) return const [];
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> documentsByIds(
    String collectionName,
    Iterable<String> ids,
  ) async {
    if (!isReady) return const [];
    final uniqueIds = ids.where((id) => id.isNotEmpty).toSet().toList();
    if (uniqueIds.isEmpty) return const [];
    final snapshots = await Future.wait(
      uniqueIds.map((id) => _db.collection(collectionName).doc(id).get()),
    );
    return snapshots
        .where((snapshot) => snapshot.exists && snapshot.id != '__schema')
        .map((snapshot) => withId(snapshot.id, snapshot.data() ?? const {}))
        .toList();
  }

  Future<List<Map<String, dynamic>>> whereIn(
    String collectionName,
    String field,
    Iterable<String> values, {
    String academicYear = '',
    List<Query<Map<String, dynamic>>>? unused,
  }) async {
    if (!isReady) return const [];
    final uniqueValues = values
        .where((value) => value.isNotEmpty)
        .toSet()
        .toList();
    if (uniqueValues.isEmpty) return const [];

    final chunks = <List<String>>[];
    for (var index = 0; index < uniqueValues.length; index += 10) {
      chunks.add(
        uniqueValues.sublist(
          index,
          index + 10 > uniqueValues.length ? uniqueValues.length : index + 10,
        ),
      );
    }

    final groups = await Future.wait(
      chunks.map((chunk) async {
        Query<Map<String, dynamic>> query = _db
            .collection(collectionName)
            .where(field, whereIn: chunk);
        if (academicYear.isNotEmpty) {
          query = query.where('academicYear', isEqualTo: academicYear);
        }
        final snapshot = await query.get();
        return snapshot.docs.map((doc) => withId(doc.id, doc.data())).toList();
      }),
    );

    final byId = <String, Map<String, dynamic>>{};
    for (final item in groups.expand((group) => group)) {
      byId[item['id'].toString()] = item;
    }
    return byId.values.toList();
  }

  Future<List<Map<String, dynamic>>> linkedParentStudents(
    AppUser user, {
    String academicYear = '',
  }) async {
    final profile = await userProfile(user.uid).catchError((_) => null);
    final linkedRecordIds = <String>{
      ...user.linkedStudentRecordIds,
      if (profile != null) ...readStringList(profile, 'linkedStudentRecordIds'),
    };
    final linkedStudentIds = <String>{
      ...user.linkedStudentIds,
      if (profile != null) ...readStringList(profile, 'linkedStudentIds'),
    };
    final byRecord = await documentsByIds('students', linkedRecordIds);
    final byStudentId = await whereIn(
      'students',
      'studentId',
      linkedStudentIds,
      academicYear: academicYear,
    );
    return _mergeById([byRecord, byStudentId]);
  }

  Future<Map<String, List<Map<String, dynamic>>>> moduleData(
    String moduleId, {
    required AppUser user,
    String academicYear = '',
  }) async {
    switch (moduleId) {
      case 'students':
        return {
          'students': await listCollection(
            'students',
            academicYear: academicYear,
          ),
          'admissions': await listCollection(
            'studentAdmissions',
            academicYear: academicYear,
          ),
          'promotions': await listCollection(
            'studentPromotions',
            academicYear: academicYear,
          ),
          'transfers': await listCollection(
            'studentTransfers',
            academicYear: academicYear,
          ),
          'admissionBatches': await listCollection(
            'admissionBatches',
            academicYear: academicYear,
          ),
          'attendance': await listCollection(
            'studentAttendanceRecords',
            academicYear: academicYear,
          ),
          'marks': await listCollection(
            'marksEntries',
            academicYear: academicYear,
          ),
          'results': await listCollection(
            'studentResults',
            academicYear: academicYear,
          ),
          'fees': await listCollection(
            'feeAssignments',
            academicYear: academicYear,
          ),
          'collections': await listCollection(
            'feeCollections',
            academicYear: academicYear,
          ),
          'documents': await listCollection(
            'studentDocuments',
            academicYear: academicYear,
          ),
          'health': await listCollection(
            'studentHealthRecords',
            academicYear: academicYear,
          ),
        };
      case 'faculty-staff':
        return {
          'staff': await listCollection('staffMembers'),
          'departments': await listCollection('departments'),
          'leave': await listCollection(
            'staffLeaveRecords',
            academicYear: academicYear,
          ),
          'attendance': await listCollection(
            'staffAttendanceRecords',
            academicYear: academicYear,
          ),
          'timetable': await listCollection(
            'timetableEntries',
            academicYear: academicYear,
          ),
        };
      case 'attendance':
        return {
          'students': user.isParent
              ? await linkedParentStudents(user, academicYear: academicYear)
              : await listCollection('students', academicYear: academicYear),
          'staff': await listCollection('staffMembers'),
          'studentAttendance': await listCollection(
            'studentAttendanceRecords',
            academicYear: academicYear,
          ),
          'staffAttendance': await listCollection(
            'staffAttendanceRecords',
            academicYear: academicYear,
          ),
        };
      case 'timetable':
        return {
          'students': user.isParent
              ? await linkedParentStudents(user, academicYear: academicYear)
              : await listCollection('students', academicYear: academicYear),
          'staff': await listCollection('staffMembers'),
          'classrooms': await listCollection('classrooms'),
          'entries': await listCollection(
            'timetableEntries',
            academicYear: academicYear,
          ),
          'publications': await listCollection(
            'timetablePublications',
            academicYear: academicYear,
          ),
        };
      case 'examination-results':
        return {
          'students': user.isParent
              ? await linkedParentStudents(user, academicYear: academicYear)
              : await listCollection('students', academicYear: academicYear),
          'schedules': await listCollection(
            'examSchedules',
            academicYear: academicYear,
          ),
          'assessments': await listCollection(
            'internalAssessments',
            academicYear: academicYear,
          ),
          'marks': await listCollection(
            'marksEntries',
            academicYear: academicYear,
          ),
          'results': await listCollection(
            'studentResults',
            academicYear: academicYear,
          ),
          'reportCards': await listCollection(
            'reportCards',
            academicYear: academicYear,
          ),
        };
      case 'fees':
        return {
          'students': user.isParent
              ? await linkedParentStudents(user, academicYear: academicYear)
              : await listCollection('students', academicYear: academicYear),
          'structures': await listCollection(
            'feeStructures',
            academicYear: academicYear,
          ),
          'assignments': await listCollection(
            'feeAssignments',
            academicYear: academicYear,
          ),
          'collections': await listCollection(
            'feeCollections',
            academicYear: academicYear,
          ),
          'adjustments': await listCollection(
            'feeAdjustments',
            academicYear: academicYear,
          ),
        };
      case 'communication':
        return {
          'notices': await listCollection(
            'noticeItems',
            academicYear: academicYear,
          ),
        };
      case 'document-management':
        return {
          'documents': await listCollection(
            'managedDocuments',
            academicYear: academicYear,
          ),
          'studentDocuments': await listCollection(
            'studentDocuments',
            academicYear: academicYear,
          ),
          'students': user.isParent
              ? await linkedParentStudents(user, academicYear: academicYear)
              : await listCollection('students', academicYear: academicYear),
          'staff': await listCollection('staffMembers'),
        };
      case 'hostel-management':
        return {
          'rooms': await listCollection(
            'hostelRooms',
            academicYear: academicYear,
          ),
          'allocations': await listCollection(
            'hostelAllocations',
            academicYear: academicYear,
          ),
          'records': await listCollection(
            'hostelRecords',
            academicYear: academicYear,
          ),
        };
      case 'parent-portal':
        final students = await linkedParentStudents(
          user,
          academicYear: academicYear,
        );
        final studentIds = students
            .map(
              (student) => readText(student, const ['studentId'], fallback: ''),
            )
            .where((id) => id.isNotEmpty);
        final recordIds = students
            .map((student) => readText(student, const ['id'], fallback: ''))
            .where((id) => id.isNotEmpty);
        return {
          'students': students,
          'attendance': _mergeById([
            await whereIn(
              'studentAttendanceRecords',
              'entityRecordId',
              recordIds,
              academicYear: academicYear,
            ),
            await whereIn(
              'studentAttendanceRecords',
              'entityId',
              studentIds,
              academicYear: academicYear,
            ),
          ]),
          'marks': _mergeById([
            await whereIn(
              'marksEntries',
              'studentRecordId',
              recordIds,
              academicYear: academicYear,
            ),
            await whereIn(
              'marksEntries',
              'studentId',
              studentIds,
              academicYear: academicYear,
            ),
          ]),
          'results': _mergeById([
            await whereIn(
              'studentResults',
              'studentRecordId',
              recordIds,
              academicYear: academicYear,
            ),
            await whereIn(
              'studentResults',
              'studentId',
              studentIds,
              academicYear: academicYear,
            ),
          ]),
          'fees': _mergeById([
            await whereIn(
              'feeAssignments',
              'studentRecordId',
              recordIds,
              academicYear: academicYear,
            ),
            await whereIn(
              'feeAssignments',
              'studentId',
              studentIds,
              academicYear: academicYear,
            ),
          ]),
          'documents': _mergeById([
            await whereIn(
              'managedDocuments',
              'ownerRecordId',
              recordIds,
              academicYear: academicYear,
            ),
            await whereIn(
              'managedDocuments',
              'ownerId',
              studentIds,
              academicYear: academicYear,
            ),
          ]),
          'notices': await listCollection(
            'noticeItems',
            academicYear: academicYear,
          ),
        };
      case 'academics':
      case 'calendar':
        return {
          'programs': await listCollection(
            'academicPrograms',
            academicYear: academicYear,
          ),
          'subjects': await listCollection(
            'academicSubjects',
            academicYear: academicYear,
          ),
          'batches': await listCollection(
            'academicBatches',
            academicYear: academicYear,
          ),
          'events': await listCollection(
            'academicCalendarEvents',
            academicYear: academicYear,
          ),
        };
      case 'user-roles':
        return {
          'users': await listCollection('users'),
          'roles': await listCollection('roles'),
        };
      case 'settings':
        return {
          'settings': await listCollection('systemSettings'),
          'colleges': await listCollection('colleges'),
        };
      case 'reports':
      case 'dashboard':
      default:
        return {
          'students': await listCollection(
            'students',
            academicYear: academicYear,
          ),
          'staff': await listCollection('staffMembers'),
          'fees': await listCollection(
            'feeAssignments',
            academicYear: academicYear,
          ),
          'collections': await listCollection(
            'feeCollections',
            academicYear: academicYear,
          ),
          'documents': await listCollection(
            'managedDocuments',
            academicYear: academicYear,
          ),
          'notices': await listCollection(
            'noticeItems',
            academicYear: academicYear,
          ),
          'exams': await listCollection(
            'examSchedules',
            academicYear: academicYear,
          ),
          'attendance': await listCollection(
            'studentAttendanceRecords',
            academicYear: academicYear,
          ),
        };
    }
  }

  Future<DashboardSnapshot> dashboard({String academicYear = ''}) async {
    final data = await moduleData(
      'dashboard',
      user: const AppUser(
        uid: '',
        name: '',
        email: '',
        roleId: 'admin',
        status: 'Active',
        permissions: [],
        displayId: '',
        collegeIds: ['main-campus'],
        linkedStudentIds: [],
        linkedStudentRecordIds: [],
      ),
      academicYear: academicYear,
    );
    final fees = data['fees'] ?? const [];
    final collections = data['collections'] ?? const [];
    return DashboardSnapshot(
      students: data['students']?.length ?? 0,
      staff: data['staff']?.length ?? 0,
      feeDue: fees.fold<num>(
        0,
        (total, item) =>
            total +
            readNumber(item, const [
              'balanceAmount',
              'unpaid',
              'dueAmount',
              'amountDue',
            ]),
      ),
      feeCollected: collections.fold<num>(
        0,
        (total, item) =>
            total +
            readNumber(item, const [
              'paidAmount',
              'amount',
              'totalPaid',
              'collectedAmount',
            ]),
      ),
      documents: data['documents']?.length ?? 0,
      notices: data['notices']?.length ?? 0,
      exams: data['exams']?.length ?? 0,
      attendanceToday: data['attendance']?.length ?? 0,
    );
  }

  Future<String> createDocument(
    String collectionName,
    Map<String, dynamic> data,
  ) async {
    if (!isReady) throw StateError('Firebase is not configured.');
    final ref = await _db.collection(collectionName).add({
      ...data,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  Future<void> updateDocument(
    String collectionName,
    String id,
    Map<String, dynamic> data,
  ) async {
    if (!isReady) throw StateError('Firebase is not configured.');
    if (id.trim().isEmpty || id.startsWith('sample-')) {
      throw ArgumentError('A live $collectionName record id is required.');
    }
    await _db.collection(collectionName).doc(id).update({
      ...data,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> deleteDocument(String collectionName, String id) async {
    if (!isReady) throw StateError('Firebase is not configured.');
    if (id.trim().isEmpty || id.startsWith('sample-')) {
      throw ArgumentError('A live $collectionName record id is required.');
    }
    await _db.collection(collectionName).doc(id).delete();
  }

  Future<String> uploadManagedDocument({
    required Uint8List bytes,
    required String fileName,
    required String uploadedBy,
    required Map<String, dynamic> metadata,
  }) async {
    if (!isReady) throw StateError('Firebase is not configured.');
    final safeName = _safeStorageName(fileName);
    final ownerType = (metadata['ownerType'] ?? 'Unknown').toString();
    final ownerId = (metadata['ownerId'] ?? uploadedBy).toString();
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final storagePath =
        'managed-documents/${_safeStorageName(ownerType)}/${_safeStorageName(ownerId)}/$timestamp-$safeName';
    final ref = _bucket.ref(storagePath);
    final contentType = _contentTypeFor(fileName);

    await ref.putData(
      bytes,
      SettableMetadata(
        contentType: contentType,
        customMetadata: {'ownerType': ownerType, 'ownerId': ownerId},
      ),
    );

    final downloadUrl = await ref.getDownloadURL();
    final docRef = await _db.collection('managedDocuments').add({
      ...metadata,
      'fileName': fileName,
      'fileType': contentType,
      'storagePath': storagePath,
      'fileUrl': downloadUrl,
      'downloadUrl': downloadUrl,
      'fileSize': bytes.length,
      'verificationStatus': metadata['verificationStatus'] ?? 'Uploaded',
      'createdBy': uploadedBy,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  String _safeStorageName(String fileName) {
    final cleaned = fileName.trim().replaceAll(
      RegExp(r'[^A-Za-z0-9._-]+'),
      '-',
    );
    return cleaned.isEmpty ? 'document.bin' : cleaned;
  }

  String _contentTypeFor(String fileName) {
    final lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.doc')) return 'application/msword';
    if (lower.endsWith('.docx')) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
    if (lower.endsWith('.xlsx')) {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    return 'application/octet-stream';
  }

  List<Map<String, dynamic>> _mergeById(
    List<List<Map<String, dynamic>>> groups,
  ) {
    final byId = <String, Map<String, dynamic>>{};
    for (final item in groups.expand((group) => group)) {
      final id = item['id']?.toString() ?? '';
      if (id.isNotEmpty) byId[id] = item;
    }
    return byId.values.toList();
  }
}
