import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Normalizes any gender input string to standard title case: 'Male', 'Female', 'Other', or a fallback.
 * Handles variations such as:
 * - Male / Boy / boy / BOY / male / M / m / Man / man / gentleman
 * - Female / Girl / girl / GIRL / female / F / f / Woman / woman / lady
 * - Other / other / O / o / Transgender / Non-binary
 */
export const normalizeGender = (val, defaultVal = 'Male') => {
  if (!val) return defaultVal;
  const str = String(val).trim().toLowerCase();
  if (['m', 'male', 'boy', 'b', 'man', 'gentleman'].includes(str)) return 'Male';
  if (['f', 'female', 'girl', 'g', 'woman', 'lady'].includes(str)) return 'Female';
  if (['o', 'other', 'transgender', 'non-binary', 'nonbinary'].includes(str)) return 'Other';
  return defaultVal;
};

export const isMale = (val) => normalizeGender(val, '') === 'Male';
export const isFemale = (val) => normalizeGender(val, '') === 'Female';
export const isOther = (val) => normalizeGender(val, '') === 'Other';

/**
 * Scans all students and teachers for a given school and updates documents
 * with normalized gender values in Firestore batches.
 */
export const standardizeSchoolGenderData = async (schoolId) => {
  if (!schoolId) throw new Error("School ID is required for standardizing gender data");

  let studentsUpdated = 0;
  let staffUpdated = 0;
  const MAX_BATCH_SIZE = 400;

  // 1. Standardize Students
  const studentsSnap = await getDocs(collection(db, `schools/${schoolId}/students`));
  let currentBatch = writeBatch(db);
  let batchOps = 0;

  for (const docSnap of studentsSnap.docs) {
    const data = docSnap.data();
    const currentGender = data.gender;
    const normalized = normalizeGender(currentGender, 'Male');

    if (currentGender !== normalized) {
      currentBatch.update(doc(db, `schools/${schoolId}/students`, docSnap.id), {
        gender: normalized,
        updatedAt: new Date().toISOString()
      });
      batchOps++;
      studentsUpdated++;

      if (batchOps >= MAX_BATCH_SIZE) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        batchOps = 0;
      }
    }
  }
  if (batchOps > 0) {
    await currentBatch.commit();
    currentBatch = writeBatch(db);
    batchOps = 0;
  }

  // 2. Standardize Teachers/Staff
  const staffSnap = await getDocs(collection(db, `schools/${schoolId}/teachers`));
  for (const docSnap of staffSnap.docs) {
    const data = docSnap.data();
    const currentGender = data.gender;
    const normalized = normalizeGender(currentGender, 'Male');

    if (currentGender !== normalized) {
      currentBatch.update(doc(db, `schools/${schoolId}/teachers`, docSnap.id), {
        gender: normalized,
        updatedAt: new Date().toISOString()
      });
      batchOps++;
      staffUpdated++;

      if (batchOps >= MAX_BATCH_SIZE) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        batchOps = 0;
      }
    }
  }
  if (batchOps > 0) {
    await currentBatch.commit();
  }

  return {
    studentsUpdated,
    totalStudents: studentsSnap.size,
    staffUpdated,
    totalStaff: staffSnap.size
  };
};

