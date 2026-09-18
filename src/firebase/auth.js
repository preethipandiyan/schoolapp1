import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth, db } from "./config";
import { collection, query, where, getDocs, setDoc, doc, getDoc } from "firebase/firestore";

// Register User
export const registerUser = async (email, password, role, additionalData = {}) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create user profile in Firestore
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      role: role,
      ...additionalData,
      createdAt: new Date().toISOString()
    });

    return user;
  } catch (error) {
    console.error("Error registering user:", error);
    throw error;
  }
};


// Login User with Email
export const loginUser = async (email, password) => {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return userCredential.user;
  } catch (error) {
    console.warn("Direct Firebase Auth sign-in failed, checking Firestore for pre-registered credentials:", error?.code);

    // If account doesn't exist yet in Auth or invalid credentials, check Firestore
    if (error?.code === 'auth/user-not-found' || error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password') {
      try {
        let matchedRecord = null;
        let matchedRole = 'admin';
        let matchedSchoolId = 'school1';
        let matchedSchoolName = 'School';

        // 1. Check users collection by email
        const userQ = query(collection(db, "users"), where("email", "==", cleanEmail));
        const userSnap = await getDocs(userQ);
        if (!userSnap.empty) {
          matchedRecord = userSnap.docs[0].data();
          matchedRole = matchedRecord.role || 'admin';
          matchedSchoolId = matchedRecord.schoolId || 'school1';
          matchedSchoolName = matchedRecord.schoolName || 'School';
        }

        // 2. Check schools collection if not found in users
        if (!matchedRecord) {
          const schoolQ = query(collection(db, "schools"), where("adminEmail", "==", cleanEmail));
          const schoolSnap = await getDocs(schoolQ);
          if (!schoolSnap.empty) {
            const sDoc = schoolSnap.docs[0];
            matchedRecord = sDoc.data();
            matchedRole = 'admin';
            matchedSchoolId = sDoc.id;
            matchedSchoolName = matchedRecord.name || 'School';
          }
        }

        // 3. Check teachers across schools if not found
        if (!matchedRecord) {
          const schoolsListSnap = await getDocs(collection(db, "schools"));
          for (const sDoc of schoolsListSnap.docs) {
            const tQ = query(collection(db, `schools/${sDoc.id}/teachers`), where("email", "==", cleanEmail));
            const tSnap = await getDocs(tQ);
            if (!tSnap.empty) {
              const tData = tSnap.docs[0].data();
              matchedRecord = tData;
              matchedRole = tData.role || (tData.staff_type === 'teaching' ? 'teacher' : 'staff');
              matchedSchoolId = sDoc.id;
              matchedSchoolName = sDoc.data().name || 'School';
              break;
            }
          }
        }

        // If credentials exist in Firestore, auto-provision the Auth user
        if (matchedRecord) {
          console.log("Found existing Firestore credentials. Auto-provisioning Firebase Auth account...");
          let newUserCred;
          try {
            newUserCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          } catch (createErr) {
            if (createErr?.code === 'auth/email-already-in-use') {
              newUserCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
            } else {
              throw createErr;
            }
          }

          const user = newUserCred.user;
          // Synchronize user profile in users/{uid}
          await setDoc(doc(db, "users", user.uid), {
            ...matchedRecord,
            uid: user.uid,
            email: cleanEmail,
            role: matchedRole,
            schoolId: matchedSchoolId,
            schoolName: matchedSchoolName,
            loginPanel: matchedRecord.loginPanel || (matchedRole === 'admin' ? 'admin' : matchedRole),
            updatedAt: new Date().toISOString()
          }, { merge: true });

          return user;
        }
      } catch (provisionErr) {
        console.error("Auto-provision check failed:", provisionErr);
      }
    }

    console.error("Error logging in:", error);
    throw error;
  }
};

// Login Parent with Admission Number
export const loginWithAdmissionNumber = async (admissionNumber, password) => {
  try {
    // Reconstruct the global synthetic email directly (avoids unauthenticated DB reads!)
    const syntheticEmail = `${admissionNumber.replace(/[^a-zA-Z0-9]/g, '')}@parent.School.com`.toLowerCase();
    
    const userCredential = await signInWithEmailAndPassword(auth, syntheticEmail, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error logging in with admission number:", error);
    throw error;
  }
};

// Logout User
export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error logging out:", error);
    throw error;
  }
};

// Reset Password
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Error resetting password:", error);
    throw error;
  }
};


// Get User Role
export const getUserProfile = async (uid) => {
  try {
    let userDoc = await getDoc(doc(db, "users", uid));
    let data = null;

    if (userDoc.exists()) {
      data = userDoc.data();
    } else {
      // Fallback 1: Query users collection by auth current user email
      const curEmail = auth?.currentUser?.email?.toLowerCase();
      if (curEmail) {
        const q = query(collection(db, "users"), where("email", "==", curEmail));
        const snap = await getDocs(q);
        if (!snap.empty) {
          data = snap.docs[0].data();
          await setDoc(doc(db, "users", uid), { ...data, uid }, { merge: true }).catch(console.error);
        } else {
          // Fallback 2: Check schools collection if this user is a school admin
          const schoolQ = query(collection(db, "schools"), where("adminEmail", "==", curEmail));
          const schoolSnap = await getDocs(schoolQ);
          if (!schoolSnap.empty) {
            const sDoc = schoolSnap.docs[0];
            const sData = sDoc.data();
            data = {
              role: 'admin',
              schoolId: sDoc.id,
              schoolName: sData.name || 'School',
              email: curEmail,
              loginPanel: 'admin',
              uid: uid
            };
            await setDoc(doc(db, "users", uid), data, { merge: true }).catch(console.error);
          }
        }
      }
    }

    if (data) {
      if (data.role) {
        data.role = data.role.toLowerCase();
      }
      
      // If the user is a teacher/staff, dynamically fetch their assignedClassId and resolve their profile role
      if ((data.role === 'teacher' || data.role === 'staff') && data.schoolId) {
        const teacherQuery = query(collection(db, `schools/${data.schoolId}/teachers`), where("userId", "==", uid));
        const snap = await getDocs(teacherQuery);
        if (!snap.empty) {
          const teacherData = snap.docs[0].data();
          data.assignedClassId = teacherData.assignedClassId || null;

          // If they have a non-teaching staff role, migrate their system role to 'staff'
          const isTeaching = teacherData.staff_type === 'teaching' || teacherData.role === 'teacher';
          if (!isTeaching) {
            data.role = 'staff';
            // Update users document in the background to persist migration
            setDoc(doc(db, "users", uid), { role: 'staff' }, { merge: true }).catch(console.error);
          }

          // Fetch the role config document to get loginPanel setting
          const resolvedRole = teacherData.role || (isTeaching ? 'teacher' : 'staff');
          if (resolvedRole) {
            const roleDocRef = doc(db, `schools/${data.schoolId}/roles`, resolvedRole);
            const roleSnap = await getDoc(roleDocRef);
            if (roleSnap.exists()) {
              data.loginPanel = roleSnap.data().loginPanel || null;
            }
          }
        }
      }
      
      return data;
    }
    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
};
