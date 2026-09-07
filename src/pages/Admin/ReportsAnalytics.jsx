import React, { useState, useEffect } from 'react';
import { LuChartBar, LuTrendingUp, LuUsers, LuIndianRupee, LuBookOpen } from 'react-icons/lu';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import { subscribeToSubCollection, subscribeToInvoices } from '../../firebase/firestore';

export default function ReportsAnalytics() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    studentEnrollment: 0,
    averageAttendance: 0,
    totalStaff: 0
  });

  const [revenueData, setRevenueData] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);

  useEffect(() => {
    if (!schoolId) return;
    
    setLoading(true);
    let unsubStudents, unsubInvoices, unsubAttendance, unsubStaff;

    unsubStudents = subscribeToSubCollection(schoolId, 'students', (data) => {
      setMetrics(prev => ({ ...prev, studentEnrollment: data.length }));
    });

    unsubStaff = subscribeToSubCollection(schoolId, 'teachers', (data) => {
      setMetrics(prev => ({ ...prev, totalStaff: data.length }));
    });

    unsubInvoices = subscribeToInvoices(schoolId, (data) => {
      let total = 0;
      const monthlyRev = {};
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      months.forEach(m => monthlyRev[m] = 0);

      data.forEach(inv => {
        if (inv.status === 'Paid' || inv.status === 'paid') {
          const amt = Number(inv.amount || 0);
          total += amt;
          if (inv.paidDate || inv.createdAt) {
            const date = new Date(inv.paidDate || inv.createdAt);
            const m = months[date.getMonth()];
            if (monthlyRev[m] !== undefined) {
              monthlyRev[m] += amt;
            }
          }
        }
      });
      setMetrics(prev => ({ ...prev, totalRevenue: total }));
      
      const currentMonthIndex = new Date().getMonth();
      const revChart = [];
      let maxRev = 0;
      for (let i = 6; i >= 0; i--) {
        const mIdx = (currentMonthIndex - i + 12) % 12;
        const rev = monthlyRev[months[mIdx]];
        if (rev > maxRev) maxRev = rev;
        revChart.push({ month: months[mIdx], revenue: rev });
      }
      // Calculate percentages for the chart bars (relative to max revenue)
      const chartWithPct = revChart.map(item => ({
        ...item,
        pct: maxRev > 0 ? Math.round((item.revenue / maxRev) * 100) : 0
      }));
      setRevenueData(chartWithPct);
    });

    unsubAttendance = subscribeToSubCollection(schoolId, 'attendance', (data) => {
      let totalPresent = 0;
      let totalRecords = 0;
      const dailyAtt = {};

      data.forEach(att => {
        const dateStr = att.date;
        if (!dateStr) return;
        
        let presentInDoc = 0;
        let totalInDoc = 0;

        if (att.records) {
          Object.values(att.records).forEach(status => {
            totalInDoc++;
            totalRecords++;
            if (status === 'Present' || status === 'Late') {
              presentInDoc++;
              totalPresent++;
            }
          });
        }
        
        if (totalInDoc > 0) {
          const pct = Math.round((presentInDoc / totalInDoc) * 100);
          if (!dailyAtt[dateStr]) dailyAtt[dateStr] = { sum: pct, count: 1 };
          else {
            dailyAtt[dateStr].sum += pct;
            dailyAtt[dateStr].count += 1;
          }
        }
      });

      const avg = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;
      setMetrics(prev => ({ ...prev, averageAttendance: avg }));

      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const attChart = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().split('T')[0];
        const dayName = days[d.getDay()];
        let val = 0;
        if (dailyAtt[iso] && dailyAtt[iso].count > 0) {
          val = Math.round(dailyAtt[iso].sum / dailyAtt[iso].count);
        }
        attChart.push({ day: dayName, attendance: val });
      }
      setAttendanceData(attChart);
      setLoading(false);
    });

    return () => {
      if (unsubStudents) unsubStudents();
      if (unsubInvoices) unsubInvoices();
      if (unsubAttendance) unsubAttendance();
      if (unsubStaff) unsubStaff();
    };
  }, [schoolId]);

  const displayMetrics = [
    { title: 'Total Revenue (YTD)', value: `₹${metrics.totalRevenue.toLocaleString()}`, trend: '', icon: LuIndianRupee, color: 'bg-emerald-500' },
    { title: 'Student Enrollment', value: metrics.studentEnrollment.toLocaleString(), trend: '', icon: LuUsers, color: 'bg-blue-500' },
    { title: 'Average Attendance', value: `${metrics.averageAttendance}%`, trend: '', icon: LuTrendingUp, color: 'bg-indigo-500' },
    { title: 'Total Teachers', value: metrics.totalStaff.toLocaleString(), trend: '', icon: LuBookOpen, color: 'bg-purple-500' },
  ];

  const handleDownload = () => {
    try {
      const data = displayMetrics.map(m => ({
        Metric: m.title,
        Value: m.value
      }));

      const exportRevenue = revenueData.map(r => ({ Month: r.month, Revenue: `₹${r.revenue}` }));
      const exportAttendance = attendanceData.map(a => ({ Day: a.day, Attendance: `${a.attendance}%` }));

      const wb = XLSX.utils.book_new();
      
      const wsMetrics = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, wsMetrics, "KPI Metrics");

      const wsRevenue = XLSX.utils.json_to_sheet(exportRevenue);
      XLSX.utils.book_append_sheet(wb, wsRevenue, "Revenue Overview");

      const wsAttendance = XLSX.utils.json_to_sheet(exportAttendance);
      XLSX.utils.book_append_sheet(wb, wsAttendance, "Attendance Trends");

      XLSX.writeFile(wb, "School_Performance_Report.xlsx");
    } catch (error) {
      console.error("Failed to export report:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto h-[calc(100vh-2rem)] flex flex-col overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-end mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Reports & Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Key performance metrics and school insights.</p>
        </div>
        <button 
          onClick={handleDownload}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-5 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-medium shadow-sm active:scale-95"
        >
          Download Full Report
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 shrink-0">
        {displayMetrics.map((metric, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${metric.color}`}>
                <metric.icon size={24} />
              </div>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wider">{metric.title}</p>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{metric.value}</h2>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[400px]">
        {/* Revenue Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Revenue Overview</h3>
          <div className="flex-1 flex items-end justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            {revenueData.map((data, i) => (
              <div key={i} className="w-full bg-emerald-100 rounded-t-md relative group hover:bg-emerald-200 transition-colors" style={{ height: `${Math.max(data.pct, 5)}%` }}>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  ₹{data.revenue.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-400 dark:text-slate-300 mt-2 font-medium px-2">
            {revenueData.map((data, i) => <span key={i}>{data.month}</span>)}
          </div>
        </div>

        {/* Attendance Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Attendance Trends (Last 7 Days)</h3>
          <div className="flex-1 flex items-end justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            {attendanceData.map((data, i) => (
              <div key={i} className="w-full bg-indigo-100 rounded-t-md relative group hover:bg-indigo-200 transition-colors" style={{ height: `${data.attendance}%` }}>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  {data.attendance}%
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-400 dark:text-slate-300 mt-2 font-medium px-2">
            {attendanceData.map((data, i) => <span key={i}>{data.day}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
