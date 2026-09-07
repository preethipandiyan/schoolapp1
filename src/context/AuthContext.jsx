import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { getUserProfile } from '../firebase/auth';
import { CacheService } from '../services/CacheService';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If auth is mocked (no config), just set loading false
    if (!auth || !auth.onAuthStateChanged) {
      if (import.meta.env.DEV) {
        setCurrentUser({
          uid: "dev-admin-uid",
          email: "admin@School.com"
        });
        setUserProfile({
          uid: "dev-admin-uid",
          email: "admin@School.com",
          role: "admin",
          schoolId: "dev-school-id",
          schoolName: "Dev Academy",
          permittedModules: [
            "noticeboard", "classes", "timetables", "calendar", "exams", 
            "fees", "transport", "hostel", "library", "inventory", 
            "health", "complaints", "alumni", "documents", "branches", 
            "reports", "hr-payroll"
          ]
        });
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // 1. Optimistic Cache Load
        const cachedProfile = CacheService.getPersistent('global', `userProfile_${user.uid}`);
        if (cachedProfile) {
          setUserProfile(cachedProfile);
          setLoading(false); // Instantly unblock the UI
        }

        // 2. Background Sync
        try {
          const profile = await getUserProfile(user.uid);
          const fullProfile = profile ? { ...profile, uid: user.uid } : null;
          setUserProfile(fullProfile);
          if (fullProfile) {
            CacheService.setPersistent('global', `userProfile_${user.uid}`, fullProfile);
          }
        } catch (error) {
          console.error("Error fetching profile", error);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const updateProfileData = async () => {
    if (currentUser) {
      try {
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile ? { ...profile, uid: currentUser.uid } : null);
      } catch (error) {
        console.error("Error refreshing profile", error);
      }
    }
  };

  const value = {
    currentUser,
    userProfile,
    loading,
    updateProfileData
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
