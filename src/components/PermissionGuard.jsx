import React from 'react';
import usePermissions from '../hooks/usePermissions';

export default function PermissionGuard({ children, moduleKey, action = 'read', fallback = null }) {
  const { canRead, canCreate, canEdit, canDelete } = usePermissions();

  let hasPermission = false;
  switch (action) {
    case 'read':
      hasPermission = canRead(moduleKey);
      break;
    case 'create':
      hasPermission = canCreate(moduleKey);
      break;
    case 'edit':
      hasPermission = canEdit(moduleKey);
      break;
    case 'delete':
      hasPermission = canDelete(moduleKey);
      break;
    default:
      hasPermission = false;
  }

  return hasPermission ? children : fallback;
}
