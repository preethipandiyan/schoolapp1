import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const { userProfile, currentUser } = useAuth();
  const schoolId = userProfile?.schoolId;
  const role = userProfile?.role?.toLowerCase();

  const [unreadCounts, setUnreadCounts] = useState({
    noticeboard: 0,
    homework: 0,
    complaints: 0,
    leaves: 0,
    canteen: 0,
    chats: 0
  });

  const [lastViewed, setLastViewed] = useState({
    noticeboard: localStorage.getItem('lastViewed_noticeboard') || '1970-01-01T00:00:00.000Z',
    homework: localStorage.getItem('lastViewed_homework') || '1970-01-01T00:00:00.000Z',
    notifications: localStorage.getItem('lastViewed_notifications') || '1970-01-01T00:00:00.000Z'
  });

  const clearBadge = useCallback((moduleKey) => {
    const now = new Date().toISOString();
    localStorage.setItem(`lastViewed_${moduleKey}`, now);
    setLastViewed(prev => ({ ...prev, [moduleKey]: now }));
  }, []);

  useEffect(() => {
    if (!schoolId || !currentUser) {
      setUnreadCounts({ noticeboard: 0, homework: 0, complaints: 0, leaves: 0, canteen: 0, chats: 0 });
      return;
    }

    const unsubscribers = [];

    // 1. Noticeboard Listener (All Roles except Admin)
    if (role !== 'admin') {
      try {
        const noticesRef = collection(db, `schools/${schoolId}/notices`);
        const unsubNotices = onSnapshot(noticesRef, (snapshot) => {
          let count = 0;
          snapshot.forEach((doc) => {
            const data = doc.data();
            const targetAudience = role === 'parent' ? ['all', 'parents', 'students_parents'] : ['all', 'teachers'];
            if (targetAudience.includes(data.audience) && data.createdAt > lastViewed.noticeboard) {
              count++;
            }
          });
          setUnreadCounts(prev => ({ ...prev, noticeboard: count }));
        });
        unsubscribers.push(unsubNotices);
      } catch (e) {
        console.error("Error subscribing to notices:", e);
      }
    }

    // 2. Homework Listener (Parents / Teachers only)
    if (role === 'parent' || role === 'teacher') {
      try {
        const homeworkRef = collection(db, `schools/${schoolId}/homeworks`);
        const unsubHomework = onSnapshot(homeworkRef, (snapshot) => {
          let count = 0;
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.createdAt > lastViewed.homework) {
              count++;
            }
          });
          setUnreadCounts(prev => ({ ...prev, homework: count }));
        });
        unsubscribers.push(unsubHomework);
      } catch (e) {
        console.error("Error subscribing to homeworks:", e);
      }
    }

    // 3. Complaints Listener (Admin only)
    if (role === 'admin') {
      try {
        const complaintsRef = collection(db, `schools/${schoolId}/complaints`);
        const q = query(complaintsRef, where("status", "==", "pending"));
        const unsubComplaints = onSnapshot(q, (snapshot) => {
          setUnreadCounts(prev => ({ ...prev, complaints: snapshot.size }));
        });
        unsubscribers.push(unsubComplaints);
      } catch (e) {
        // Fallback without index query
        const complaintsRef = collection(db, `schools/${schoolId}/complaints`);
        const unsubComplaints = onSnapshot(complaintsRef, (snapshot) => {
          let count = 0;
          snapshot.forEach((doc) => {
            if (doc.data().status === 'pending') count++;
          });
          setUnreadCounts(prev => ({ ...prev, complaints: count }));
        });
        unsubscribers.push(unsubComplaints);
      }
    }

    // 4. Leaves Listener (Admin only)
    if (role === 'admin') {
      try {
        const leavesRef = collection(db, `schools/${schoolId}/leaves`);
        const q = query(leavesRef, where("status", "==", "Pending"));
        const unsubLeaves = onSnapshot(q, (snapshot) => {
          setUnreadCounts(prev => ({ ...prev, leaves: snapshot.size }));
        });
        unsubscribers.push(unsubLeaves);
      } catch (e) {
        const leavesRef = collection(db, `schools/${schoolId}/leaves`);
        const unsubLeaves = onSnapshot(leavesRef, (snapshot) => {
          let count = 0;
          snapshot.forEach((doc) => {
            if (doc.data().status === 'Pending') count++;
          });
          setUnreadCounts(prev => ({ ...prev, leaves: count }));
        });
        unsubscribers.push(unsubLeaves);
      }
    }

    // 5. Canteen Requests Listener (Admin/Staff/Teacher only)
    if (role === 'admin' || role === 'staff' || role === 'teacher') {
      try {
        const canteenRef = collection(db, `schools/${schoolId}/canteen_requests`);
        const q = query(canteenRef, where("status", "==", "Pending"));
        const unsubCanteen = onSnapshot(q, (snapshot) => {
          setUnreadCounts(prev => ({ ...prev, canteen: snapshot.size }));
        });
        unsubscribers.push(unsubCanteen);
      } catch (e) {
        const canteenRef = collection(db, `schools/${schoolId}/canteen_requests`);
        const unsubCanteen = onSnapshot(canteenRef, (snapshot) => {
          let count = 0;
          snapshot.forEach((doc) => {
            if (doc.data().status === 'Pending') count++;
          });
          setUnreadCounts(prev => ({ ...prev, canteen: count }));
        });
        unsubscribers.push(unsubCanteen);
      }
    }

    // 6. Chats Listener (Parent and Teacher)
    if (role === 'parent' || role === 'teacher') {
      try {
        const chatsRef = collection(db, `schools/${schoolId}/chats`);
        let q;
        if (role === 'parent' && userProfile?.linkedStudentId) {
          q = query(chatsRef, where("studentId", "==", userProfile.linkedStudentId));
        } else if (role === 'teacher') {
          q = query(chatsRef, where("teacherId", "==", currentUser.uid));
        }

        if (q) {
          const unsubChats = onSnapshot(q, (snapshot) => {
            let count = 0;
            snapshot.forEach((doc) => {
              const data = doc.data();
              if (role === 'parent') {
                count += (data.unreadCount_parent || 0);
              } else if (role === 'teacher') {
                count += (data.unreadCount_teacher || 0);
              }
            });
            setUnreadCounts(prev => ({ ...prev, chats: count }));
          });
          unsubscribers.push(unsubChats);
        }
      } catch (e) {
        console.error("Error subscribing to chats notifications:", e);
      }
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [schoolId, role, currentUser, lastViewed.noticeboard, lastViewed.homework]);

  return (
    <NotificationContext.Provider value={{ unreadCounts, clearBadge, lastViewed }}>
      {children}
    </NotificationContext.Provider>
  );
};
