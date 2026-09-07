import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
let db;
try {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      admin.initializeApp({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'school-management-system-6a2c4'
      });
    }
  }
  db = admin.firestore();
} catch (error) {
  console.error("Firebase Admin initialization failed:", error);
}

export default async function handler(req, res) {
  // Allow Cron triggers or manually triggered POST/GET checks
  if (!db) {
    return res.status(500).json({ error: 'Firestore Admin SDK not initialized' });
  }

  try {
    // 1. Fetch all schools
    const schoolsSnap = await db.collection('schools').get();
    const results = [];

    for (const schoolDoc of schoolsSnap.docs) {
      const schoolId = schoolDoc.id;
      const schoolData = schoolDoc.data();

      // Skip pending or inactive schools
      if (schoolData.status === 'pending') continue;

      // 2. Fetch attendance settings
      const settingsRef = db.doc(`schools/${schoolId}/config/attendanceSettings`);
      const settingsSnap = await settingsRef.get();
      
      const settings = settingsSnap.exists ? settingsSnap.data() : {
        cutoffTime: '09:30',
        timezone: 'Asia/Kolkata' // Default timezone
      };

      const cutoffTimeStr = settings.cutoffTime || '09:30';
      const tz = settings.timezone || 'Asia/Kolkata';

      // 3. Calculate today's date and current time in the school's timezone
      const now = new Date();
      
      // Format current date and time in the specified timezone
      const localDateStr = now.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
      const localTimeStr = now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }); // HH:mm

      // Check if already checked today
      if (settings.lastCutoffCheckDate === localDateStr) {
        results.push({ schoolId, status: 'SKIPPED_ALREADY_CHECKED_TODAY' });
        continue;
      }

      // Check if we are past the cutoff time today
      if (localTimeStr < cutoffTimeStr) {
        results.push({ schoolId, status: 'SKIPPED_BEFORE_CUTOFF', time: localTimeStr, cutoff: cutoffTimeStr });
        continue;
      }

      // 4. Fetch active classes
      const classesSnap = await db.collection(`schools/${schoolId}/classes`).get();
      const unmarkedClasses = [];

      for (const classDoc of classesSnap.docs) {
        const classId = classDoc.id;
        const classData = classDoc.data();

        // 5. Check if attendance document exists for today (check both standard and _FN sessions)
        const docIdStandard = `${classId}_${localDateStr}`;
        const docIdSession = `${classId}_${localDateStr}_FN`;

        const [attSnapStandard, attSnapSession] = await Promise.all([
          db.doc(`schools/${schoolId}/attendance/${docIdStandard}`).get(),
          db.doc(`schools/${schoolId}/attendance/${docIdSession}`).get()
        ]);

        const hasAttendance = attSnapStandard.exists || attSnapSession.exists;

        if (!hasAttendance) {
          // Check if unread notification already exists for this class + date to avoid duplicates
          const notificationsRef = db.collection(`schools/${schoolId}/notifications`);
          const existingNotifs = await notificationsRef
            .where('type', '==', 'attendance_pending')
            .where('classId', '==', classId)
            .where('date', '==', localDateStr)
            .where('read', '==', false)
            .get();

          if (existingNotifs.empty) {
            const className = `${classData.name || 'Class'} ${classData.section || ''}`.trim();
            await notificationsRef.add({
              type: 'attendance_pending',
              classId: classId,
              message: `${className} attendance not marked`,
              date: localDateStr,
              createdAt: new Date().toISOString(),
              read: false
            });
            unmarkedClasses.push(className);
          }
        }
      }

      // 6. Update lastCutoffCheckDate to prevent duplicate runs today
      await settingsRef.set({
        lastCutoffCheckDate: localDateStr
      }, { merge: true });

      // 7. Recompute dashboardStats to sync classesPending and classesMarked/Total
      await recomputeDashboardStats(schoolId, localDateStr);

      // 8. Update running stats and absentee flags for all students in the school
      await updateAllStudentStatsAndFlagsForSchool(schoolId, localDateStr);

      results.push({
        schoolId,
        status: 'PROCESSED',
        localDate: localDateStr,
        unmarkedClassesCount: unmarkedClasses.length,
        unmarkedClasses
      });
    }

    return res.status(200).json({ success: true, results });
  } catch (error) {
    console.error("Error running attendance cutoff check:", error);
    return res.status(500).json({ error: error.message });
  }
}

async function recomputeDashboardStats(schoolId, dateStr) {
  try {
    const classesSnap = await db.collection(`schools/${schoolId}/classes`).get();
    const classesList = classesSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

    const pendingSnap = await db.collection(`schools/${schoolId}/notifications`)
      .where('type', '==', 'attendance_pending')
      .where('date', '==', dateStr)
      .where('read', '==', false)
      .get();
    const classesPending = pendingSnap.docs.map(docSnap => docSnap.data().classId);

    const schoolWide = { total: 0, present: 0, absent: 0, late: 0, percentage: 100 };
    const byGrade = {};
    const bySection = {};
    let classesMarked = 0;

    for (const cls of classesList) {
      const classId = cls.id;
      const gradeId = cls.grade || 'unspecified';

      if (!byGrade[gradeId]) {
        byGrade[gradeId] = { total: 0, present: 0, absent: 0, late: 0, percentage: 100 };
      }

      bySection[classId] = { total: 0, present: 0, absent: 0, late: 0, percentage: 100, gradeId, name: cls.name, section: cls.section };

      const docIdStandard = `${classId}_${dateStr}`;
      const docIdFN = `${classId}_${dateStr}_FN`;

      const [snapStd, snapFN] = await Promise.all([
        db.doc(`schools/${schoolId}/attendance/${docIdStandard}`).get(),
        db.doc(`schools/${schoolId}/attendance/${docIdFN}`).get()
      ]);

      const attSnap = snapStd.exists ? snapStd : snapFN.exists ? snapFN : null;

      if (attSnap) {
        classesMarked++;
        const attData = attSnap.data();
        const records = attData.records || {};

        Object.entries(records).forEach(([studentId, status]) => {
          schoolWide.total++;
          if (status === 'Present') schoolWide.present++;
          if (status === 'Absent') schoolWide.absent++;
          if (status === 'Late') schoolWide.late++;

          byGrade[gradeId].total++;
          if (status === 'Present') byGrade[gradeId].present++;
          if (status === 'Absent') byGrade[gradeId].absent++;
          if (status === 'Late') byGrade[gradeId].late++;

          bySection[classId].total++;
          if (status === 'Present') bySection[classId].present++;
          if (status === 'Absent') bySection[classId].absent++;
          if (status === 'Late') bySection[classId].late++;
        });
      }
    }

    const calcPercentage = (s) => {
      if (s.total === 0) return 100;
      return Math.round(((s.present + s.late) / s.total) * 100);
    };

    schoolWide.percentage = calcPercentage(schoolWide);
    Object.keys(byGrade).forEach(gId => {
      byGrade[gId].percentage = calcPercentage(byGrade[gId]);
    });
    Object.keys(bySection).forEach(cId => {
      bySection[cId].percentage = calcPercentage(bySection[cId]);
    });

    const statsRef = db.doc(`schools/${schoolId}/dashboardStats/${dateStr}`);
    await statsRef.set({
      date: dateStr,
      schoolWide,
      byGrade,
      bySection,
      classesMarked,
      classesTotal: classesList.length,
      classesPending,
      lastUpdated: new Date().toISOString()
    }, { merge: true });

  } catch (error) {
    console.error("Error in recomputeDashboardStats inside cutoff check:", error);
  }
}

async function updateAllStudentStatsAndFlagsForSchool(schoolId, dateStr) {
  try {
    const currentMonthStr = dateStr.slice(0, 7); // YYYY-MM
    
    // Fetch threshold settings
    const settingsSnap = await db.doc(`schools/${schoolId}/config/attendanceSettings`).get();
    const threshold = settingsSnap.exists ? (settingsSnap.data().absenteeThreshold || 2) : 2;

    // Fetch all students
    const studentsSnap = await db.collection(`schools/${schoolId}/students`).get();
    const studentsList = studentsSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

    // Fetch all attendance documents
    const attendanceSnap = await db.collection(`schools/${schoolId}/attendance`).get();
    const attendanceDocs = attendanceSnap.docs.map(docSnap => docSnap.data());

    for (const student of studentsList) {
      const studentId = student.id;
      const classId = student.classId || '';

      let totalDays = 0;
      let presentDays = 0;
      let absentDays = 0;
      let lateDays = 0;
      let currentMonthAbsents = 0;

      attendanceDocs.forEach(att => {
        const studentStatus = att.records ? att.records[studentId] : null;
        if (studentStatus) {
          totalDays++;
          if (studentStatus === 'Present') presentDays++;
          if (studentStatus === 'Absent') {
            absentDays++;
            const attDate = att.date ? att.date.split('_')[0] : '';
            if (attDate.startsWith(currentMonthStr)) {
              currentMonthAbsents++;
            }
          }
          if (studentStatus === 'Late') lateDays++;
        }
      });

      if (totalDays > 0) {
        const attendancePercentage = Number((((presentDays + lateDays) / totalDays) * 100).toFixed(1));
        
        await db.doc(`schools/${schoolId}/attendanceStats/${studentId}`).set({
          studentId,
          totalDays,
          presentDays,
          absentDays,
          lateDays,
          attendancePercentage,
          academicYear: '2026-27',
          lastUpdated: new Date().toISOString()
        }, { merge: true });
      }

      const flagRef = db.doc(`schools/${schoolId}/absenteeFlags/${studentId}_${currentMonthStr}`);
      if (currentMonthAbsents >= threshold) {
        await flagRef.set({
          studentId,
          classId,
          month: currentMonthStr,
          absentCount: currentMonthAbsents,
          flaggedAt: new Date().toISOString()
        }, { merge: true });
      } else {
        await flagRef.delete().catch(() => {});
      }
    }
  } catch (error) {
    console.error("Error in updateAllStudentStatsAndFlagsForSchool:", error);
  }
}
