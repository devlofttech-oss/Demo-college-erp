class DashboardSnapshot {
  const DashboardSnapshot({
    required this.students,
    required this.staff,
    required this.feeDue,
    required this.feeCollected,
    required this.documents,
    required this.notices,
    required this.exams,
    required this.attendanceToday,
  });

  final int students;
  final int staff;
  final num feeDue;
  final num feeCollected;
  final int documents;
  final int notices;
  final int exams;
  final int attendanceToday;
}
