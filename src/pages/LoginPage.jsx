import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { LuEye as Eye, LuEyeOff as EyeOff, LuArrowLeft } from 'react-icons/lu';
import { FiLoader as Loader, FiCheckCircle as CheckCircle } from 'react-icons/fi';
import { loginUser, getUserProfile, loginWithAdmissionNumber } from '../firebase/auth';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const reducedMotion = useReducedMotion();
  
  const [formData, setFormData] = useState({ identifier: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser && userProfile) {
      redirectBasedOnRole(userProfile.role, userProfile.loginPanel);
    }
  }, [currentUser, userProfile, navigate]);

  const redirectBasedOnRole = (role, loginPanel) => {
    if (loginPanel === 'teacher') {
      navigate('/teacher');
      return;
    }
    if (loginPanel === 'admin') {
      navigate('/admin');
      return;
    }

    const r = role?.toLowerCase();
    switch (r) {
      case 'superadmin': navigate('/superadmin'); break;
      case 'teacher': navigate('/teacher'); break;
      case 'parent': navigate('/parent'); break;
      default: navigate('/admin');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!formData.identifier || !formData.password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let user;
      const { identifier, password } = formData;
      if (identifier.includes('@')) {
        user = await loginUser(identifier, password);
      } else {
        user = await loginWithAdmissionNumber(identifier, password);
      }
      
      const profile = await getUserProfile(user.uid);
      
      if (profile) {
        setSuccess(true);
        setTimeout(() => {
          redirectBasedOnRole(profile.role, profile.loginPanel);
        }, 600); // Wait for success animation
      } else {
        setError("User profile not found. Please contact support.");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError("Invalid email/admission number or password.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans selection:bg-primary-500 selection:text-white flex flex-col items-center justify-center p-4 sm:p-8">
      <motion.div 
        initial={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row h-auto md:h-[90vh] max-h-[800px] min-h-[600px] border border-slate-100 dark:border-slate-800"
      >
        {/* Left Gradient Panel */}
        <div className="w-full md:w-1/2 p-4 hidden md:flex flex-col relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500 via-indigo-600 to-cyan-400 rounded-2xl m-4 z-0">
             {/* Decorative mesh elements */}
             <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-white/20 blur-[60px] rounded-full mix-blend-screen animate-pulse pointer-events-none"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-300/30 blur-[80px] rounded-full mix-blend-screen animate-[pulse_4s_ease-in-out_infinite_reverse] pointer-events-none"></div>
          </div>
          
          <div className="relative z-10 flex flex-col h-full justify-between p-8 text-white">
            <Link to="/" className="inline-flex items-center gap-2 group focus:outline-none focus:ring-2 focus:ring-white/50 rounded-lg w-max">
              <img src="/logo.png" alt="School Logo" className="w-auto h-10 object-contain drop-shadow-sm filter brightness-0 invert" />
            </Link>

            <div className="mt-auto">
              <p className="text-sm font-medium text-white/80 mb-2">Welcome back</p>
              <h1 className="text-3xl lg:text-4xl font-bold leading-tight">
                Log in to access your dashboard and tools
              </h1>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="w-full md:w-1/2 p-6 sm:p-8 lg:p-12 flex flex-col justify-center bg-white dark:bg-slate-900 relative overflow-y-auto overflow-x-hidden custom-scrollbar">
          
          {/* Back to Home Button */}
          <div className="mb-4 sm:mb-8 flex">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-primary-600 transition-colors focus:outline-none focus:text-primary-600">
              <LuArrowLeft size={16} /> Back to Home
            </Link>
          </div>
          
          {/* Mobile Logo */}
          <div className="md:hidden flex justify-center mb-8">
            <Link to="/">
              <img src="/logo.png" alt="School Logo" className="w-auto h-10 object-contain" />
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">Log in to your account</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Access your tasks, notes, and projects anytime, anywhere - and keep everything flowing in one place.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1">
              <label htmlFor="identifier" className="block text-sm font-bold text-slate-700 dark:text-slate-200">Email or Admission No.</label>
              <input 
                type="text" 
                id="identifier" 
                name="identifier"
                value={formData.identifier}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none text-slate-900 dark:text-white disabled:opacity-50" 
                placeholder="you@example.com" 
                disabled={loading || success}
                required 
              />
            </div>

            <div className="space-y-1 relative">
              <label htmlFor="password" className="block text-sm font-bold text-slate-700 dark:text-slate-200">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  id="password" 
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-4 pr-12 py-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none text-slate-900 dark:text-white disabled:opacity-50" 
                  placeholder="••••••••" 
                  disabled={loading || success}
                  required 
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none focus:text-primary-600"
                  tabIndex="-1"
                  disabled={loading || success}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm pt-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-primary-500 focus:ring-primary-500 focus:ring-offset-white transition-colors cursor-pointer" />
                <span className="text-slate-500 dark:text-slate-400 group-hover:text-slate-700 transition-colors">Remember me</span>
              </label>
              <Link to="/forgot-password" className="font-bold text-primary-600 hover:text-primary-700 transition-colors focus:outline-none focus:underline">
                Forgot password?
              </Link>
            </div>

            <motion.div 
              initial={false}
              animate={{ height: error ? 'auto' : 0, opacity: error ? 1 : 0 }}
              className="overflow-hidden"
            >
              <p className="text-red-500 text-sm font-medium">{error}</p>
            </motion.div>

            <button 
              type="submit" 
              disabled={loading || success}
              className="w-full py-3.5 mt-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 flex justify-center items-center gap-2 disabled:cursor-not-allowed"
            >
              {success ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                  <CheckCircle size={20} /> Success
                </motion.div>
              ) : loading ? (
                <>
                  <Loader className="animate-spin" size={20} /> Signing in...
                </>
              ) : (
                "Log In"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="font-bold text-primary-600 hover:text-primary-700 transition-colors focus:outline-none focus:underline">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
