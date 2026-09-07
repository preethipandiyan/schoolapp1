import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth } from "./config";
import { setDoc, doc, getDoc } from "firebase/firestore";
import { db } from "./config";

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
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error logging in:", error);
    throw error;
  }
};

// Login Parent with Admission Number
import { collection, query, where, getDocs } from "firebase/firestore";
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
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
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
