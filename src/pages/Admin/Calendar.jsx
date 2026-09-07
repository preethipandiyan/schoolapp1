import React from 'react';
import AcademicCalendar from '../../components/AcademicCalendar';

export default function AdminCalendar() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <AcademicCalendar isAdmin={true} />
    </div>
  );
}
