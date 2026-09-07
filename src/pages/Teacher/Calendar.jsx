import React from 'react';
import AcademicCalendar from '../../components/AcademicCalendar';

export default function TeacherCalendar() {
  return (
    <div className="p-8 max-w-7xl mx-auto pb-24">
      <AcademicCalendar isAdmin={false} />
    </div>
  );
}
