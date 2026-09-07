import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { collection, query, where, doc, onSnapshot } from 'firebase/firestore';

export default function usePermissions() {
  const { userProfile, currentUser } = useAuth();
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!userProfile || !currentUser) {
      if (isMounted) {
        setPermissions(null);
        setLoading(false);
      }
      return;
    }

    // If School Admin, they have full access
    if (userProfile.role === 'admin') {
      if (isMounted) {
        setPermissions('ALL');
        setLoading(false);
      }
      return;
    }

    const schoolId = userProfile.schoolId;
    if (!schoolId) {
      if (isMounted) {
        setPermissions({});
        setLoading(false);
      }
      return;
    }

    let roleUnsub = null;

    // 1. Listen to the staff document in real-time to find their actual assigned roles
    const staffRef = collection(db, `schools/${schoolId}/teachers`);
    const q = query(staffRef, where("userId", "==", currentUser.uid));
    
    const staffUnsub = onSnapshot(q, (staffSnap) => {
      let assignedRoles = [];
      
      if (!staffSnap.empty) {
        const staffData = staffSnap.docs[0].data();
        if (Array.isArray(staffData.roles) && staffData.roles.length > 0) {
          assignedRoles = staffData.roles;
        } else if (staffData.role) {
          assignedRoles = [staffData.role];
        }
      }

      if (assignedRoles.length === 0) {
        assignedRoles = [userProfile.role || 'Staffs'];
      }

      // Cleanup previous role listener if it exists
      if (roleUnsub) roleUnsub();

      // 2. Listen to all roles in real-time and merge permissions for assigned roles
      const rolesColRef = collection(db, `schools/${schoolId}/roles`);
      roleUnsub = onSnapshot(rolesColRef, (rolesSnap) => {
        if (isMounted) {
          const merged = {};
          rolesSnap.forEach(roleDoc => {
            const roleName = roleDoc.id;
            const hasRole = assignedRoles.some(r => r.toLowerCase() === roleName.toLowerCase());
            if (hasRole) {
              const roleData = roleDoc.data();
              const rolePermissions = roleData.permissions || {};
              Object.keys(rolePermissions).forEach(moduleKey => {
                if (!merged[moduleKey]) {
                  merged[moduleKey] = { read: false, create: false, edit: false, delete: false };
                }
                const perm = rolePermissions[moduleKey];
                if (perm.read) merged[moduleKey].read = true;
                if (perm.create) merged[moduleKey].create = true;
                if (perm.edit) merged[moduleKey].edit = true;
                if (perm.delete) merged[moduleKey].delete = true;
              });
            }
          });
          setPermissions(merged);
          setLoading(false);
        }
      }, (error) => {
        console.error("Error listening to role permissions:", error);
        if (isMounted) {
          setPermissions({});
          setLoading(false);
        }
      });
    }, (error) => {
      console.error("Error listening to staff role:", error);
      if (isMounted) {
        setPermissions({});
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (staffUnsub) staffUnsub();
      if (roleUnsub) roleUnsub();
    };
  }, [userProfile, currentUser]);

  const canRead = (moduleKey) => {
    if (permissions === 'ALL') return true;
    if (!permissions || !moduleKey) return false;
    return permissions[moduleKey]?.read === true;
  };

  const canCreate = (moduleKey) => {
    if (permissions === 'ALL') return true;
    if (!permissions || !moduleKey) return false;
    return permissions[moduleKey]?.create === true;
  };

  const canEdit = (moduleKey) => {
    if (permissions === 'ALL') return true;
    if (!permissions || !moduleKey) return false;
    return permissions[moduleKey]?.edit === true;
  };

  const canDelete = (moduleKey) => {
    if (permissions === 'ALL') return true;
    if (!permissions || !moduleKey) return false;
    return permissions[moduleKey]?.delete === true;
  };

  return { permissions, loading, canRead, canCreate, canEdit, canDelete };
}
