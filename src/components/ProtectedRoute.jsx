import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePermissions from '../hooks/usePermissions';

const ProtectedRoute = ({ children, allowedRoles, moduleKey }) => {
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const { canRead, loading: permissionsLoading } = usePermissions();

  if (authLoading || (currentUser && userProfile && userProfile.role !== 'admin' && permissionsLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-800">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // If roles are specified, check if user has required role
  if (allowedRoles && allowedRoles.length > 0) {
    if (!userProfile) return <Navigate to="/unauthorized" replace />;
    
    const userRole = userProfile.role?.toLowerCase();
    const isCustomStaff = userRole !== 'teacher' && userRole !== 'parent' && userRole !== 'student' && userRole !== 'superadmin' && userRole !== 'admin';
    const effectiveRole = isCustomStaff ? 'staff' : userRole;
    
    if (!allowedRoles.includes(effectiveRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // If moduleKey is specified, check if user has read permission for this module
  if (moduleKey && userProfile && userProfile.role !== 'admin') {
    if (!canRead(moduleKey)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
