/**
 * Firestore Database Schema Definitions (Phase 1 Alignment)
 * 
 * Note: These collections are defined here for type reference.
 * Cloud Functions or subsequent UI phases will read/write these collections.
 */

/**
 * Collection: schools/{schoolId}/notifications/{id}
 * Triggered by: attendance pending warnings, submitted leaves, or absentee count flags.
 * 
 * @typedef {Object} SchoolNotification
 * @property {'attendance_pending' | 'leave_submitted' | 'absentee_flagged'} type - Notification trigger type
 * @property {string} [classId] - Associated Class ID (only for 'attendance_pending')
 * @property {string} message - Notification text display
 * @property {string} createdAt - ISO 8601 Timestamp
 * @property {boolean} read - Mark status (default: false)
 */

/**
 * Collection: schools/{schoolId}/absenteeFlags/{id}
 * Triggered by: automated background cron job checking monthly absences per student.
 * 
 * @typedef {Object} AbsenteeFlag
 * @property {string} studentId - Flagged student
 * @property {string} classId - Student's class
 * @property {string} month - Calendar Month (Format: "YYYY-MM")
 * @property {number} absentCount - Total days absent in that month
 * @property {string} flaggedAt - ISO 8601 Timestamp
 */

/**
 * Collection: schools/{schoolId}/attendanceStats/{studentId}
 * Triggered by: incremental compilation when attendance is saved or updated.
 * 
 * @typedef {Object} AttendanceStats
 * @property {string} studentId - Student identifier
 * @property {string} academicYear - Current year designation (e.g. "2026-27")
 * @property {number} totalDays - Total days evaluated
 * @property {number} presentDays - Total days present
 * @property {number} lateDays - Total days late
 * @property {number} attendancePercentage - Aggregate score percentage
 * @property {string} lastUpdated - ISO 8601 Timestamp
 */
