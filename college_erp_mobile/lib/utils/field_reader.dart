import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';

String readText(
  Map<String, dynamic> data,
  List<String> keys, {
  String fallback = '-',
}) {
  for (final key in keys) {
    final value = data[key];
    if (value == null) continue;
    final text = value.toString().trim();
    if (text.isNotEmpty) return text;
  }
  return fallback;
}

num readNumber(
  Map<String, dynamic> data,
  List<String> keys, {
  num fallback = 0,
}) {
  for (final key in keys) {
    final value = data[key];
    if (value is num) return value;
    if (value is String) {
      final parsed = num.tryParse(value.replaceAll(',', '').trim());
      if (parsed != null) return parsed;
    }
  }
  return fallback;
}

List<String> readStringList(Map<String, dynamic> data, String key) {
  final value = data[key];
  if (value is Iterable) {
    return value
        .map((item) => item.toString())
        .where((item) => item.isNotEmpty)
        .toList();
  }
  return const [];
}

DateTime? readDate(Object? value) {
  if (value == null) return null;
  if (value is Timestamp) return value.toDate();
  if (value is DateTime) return value;
  if (value is String) return DateTime.tryParse(value);
  return null;
}

String formatDateValue(Object? value, {String fallback = '-'}) {
  final date = readDate(value);
  if (date == null) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? fallback : text;
  }
  return DateFormat('d MMM yyyy').format(date);
}

String formatMoney(num value) {
  final formatter = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  );
  return formatter.format(value);
}

bool containsQuery(Map<String, dynamic> data, String query, List<String> keys) {
  if (query.trim().isEmpty) return true;
  final normalized = query.toLowerCase();
  return keys.any(
    (key) => (data[key] ?? '').toString().toLowerCase().contains(normalized),
  );
}

Map<String, dynamic> withId(String id, Map<String, dynamic> data) {
  return <String, dynamic>{'id': id, ...data};
}
