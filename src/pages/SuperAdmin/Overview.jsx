import React, { useState, useEffect } from 'react';
import { subscribeToAllSchools } from '../../firebase/firestore';
import { LuBuilding2 as Building2, LuTrendingUp as TrendingUp, LuCircleAlert as AlertCircle, LuCircleCheck as CheckCircle2 } from 'react-icons/lu';
import { Link } from 'react-router-dom';

export default function Overview() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);

  // Hardcoded plan prices for MRR calculation
  const planPrices = {
    basic: 49,
    pro: 99,
    enterprise: 199
  };

  const [seeding, setSeeding] = useState(false);

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const { setDoc, doc, collection } = await import('firebase/firestore');
      const { db } = await import('../../firebase/config');
      
      const dummySchools = [
        { name: "Delhi Public School", email: "contact@dps.edu", phone: "9876543210", address: "New Delhi, India", status: "approved", plan: "enterprise", createdAt: new Date(Date.now() - 30*24*60*60*1000).toISOString() },
        { name: "Bombay Scottish School", email: "info@bombayscottish.in", phone: "9876543211", address: "Mumbai, MH", status: "approved", plan: "pro", createdAt: new Date(Date.now() - 15*24*60*60*1000).toISOString() },
        { name: "St. Xavier's High School", email: "admin@xaviers.edu", phone: "9876543212", address: "Kolkata, WB", status: "pending", plan: "basic", createdAt: new Date().toISOString() },
        { name: "Greenwood High", email: "hello@greenwood.edu", phone: "9876543213", address: "Bangalore, KA", status: "approved", plan: "basic", createdAt: new Date(Date.now() - 5*24*60*60*1000).toISOString() },
        { name: "Dhirubhai Ambani School", email: "admissions@dais.edu", phone: "9876543214", address: "Mumbai, MH", status: "suspended", plan: "enterprise", createdAt: new Date(Date.now() - 60*24*60*60*1000).toISOString() }
      ];

      for (let i = 0; i < dummySchools.length; i++) {
        const ref = doc(collection(db, "schools"));
        await setDoc(ref, {
          ...dummySchools[i],
          id: ref.id,
          modules: { library: true, transport: true, hostel: false }
        });
      }
      
      const { default: toast } = await import('react-hot-toast');
      toast.success("Demo Schools Generated!");
      
      // Reload stats - Handled by real-time listener
    } catch (err) {
      console.error(err);
      toast.error("Error seeding data");
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToAllSchools((data) => {
      setSchools(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  // Calculate Metrics
  const activeSchools = schools.filter(s => s.status === 'approved');
  const pendingSchools = schools.filter(s => s.status === 'pending');
  const suspendedSchools = schools.filter(s => s.status === 'suspended');

  // Calculate MRR
  const mrr = activeSchools.reduce((total, school) => {
    const price = planPrices[school.plan?.toLowerCase()] || 0;
    return total + price;
  }, 0);

  // Recent 5 schools
  const recentSchools = [...schools].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  return (
    <div className="p-8 max-w-7xl mx-auto pb-24">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Global Overview</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Platform analytics and tenant metrics.</p>
        </div>
        
        {schools.length === 0 && (
          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-sm shadow-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {seeding ? 'Generating...' : '[Dev] Generate Demo Schools'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Building2 size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Total Active Schools</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">{activeSchools.length}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
              <TrendingUp size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Monthly Recurring Revenue</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">₹{mrr}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <AlertCircle size={24} />
            </div>
            {pendingSchools.length > 0 && (
              <span className="flex h-3 w-3 absolute top-6 right-6">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Pending Approvals</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">{pendingSchools.length}</h3>
            {pendingSchools.length > 0 && (
              <Link to="/superadmin/tenants" className="text-xs text-primary-600 font-bold hover:underline mt-2 inline-block">Review Now &rarr;</Link>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
              <AlertCircle size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Suspended Tenants</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">{suspendedSchools.length}</h3>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recent Registrations</h2>
          <Link to="/superadmin/tenants" className="text-sm font-bold text-primary-600 hover:text-primary-700">View All Tenants</Link>
        </div>
        <div className="divide-y divide-slate-100">
          {recentSchools.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">No schools registered yet.</div>
          ) : (
            recentSchools.map(school => (
              <div key={school.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-500 dark:text-slate-400">
                    {school.schoolName?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">{school.schoolName}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(school.createdAt).toLocaleDateString('en-GB')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    {school.plan}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1
                    ${school.status === 'approved' ? 'bg-green-100 text-green-700' : 
                      school.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                      'bg-red-100 text-red-700'}`}
                  >
                    {school.status === 'approved' && <CheckCircle2 size={12} />}
                    {school.status === 'pending' && <AlertCircle size={12} />}
                    {school.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
