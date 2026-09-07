import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { LuArrowLeft as ArrowLeft } from 'react-icons/lu';
import { FiLoader as Loader, FiCheckCircle as CheckCircle } from 'react-icons/fi';
import { sendEmail } from '../services/emailService';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const targetEmail = email.toLowerCase().trim();

      // 1. Try serverless backend endpoint first (/api/forgot-password)
      let sentViaServerless = false;
      try {
        const res = await fetch('/api/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: targetEmail })
        });
        if (res.ok) {
          sentViaServerless = true;
        }
      } catch (apiErr) {
        console.warn("Serverless API offline, falling back to direct Resend service call...", apiErr);
      }

      // 2. Fallback if running in local Vite dev mode: Send email directly via Resend service
      if (!sentViaServerless) {
        const resetLink = `https://school-management-system-6a2c4.firebaseapp.com/__/auth/action?mode=resetPassword&email=${encodeURIComponent(targetEmail)}`;
        
        await sendEmail({
          to: targetEmail,
          templateType: 'FORGOT_PASSWORD',
          data: { resetLink }
        });

        // Try updating user timestamp in DB if accessible
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', targetEmail));
          const querySnapshot = await getDocs(q);

          querySnapshot.forEach(async (userDoc) => {
            await updateDoc(doc(db, 'users', userDoc.id), {
              lastPasswordResetAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          });
        } catch (dbErr) {
          console.warn("Client DB update skipped (requires auth permissions):", dbErr);
        }
      }

      // Always show success screen
      setSuccess(true);
    } catch (err) {
      console.error("Password reset submission error:", err);
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans selection:bg-primary-500 selection:text-white flex flex-col items-center justify-center relative overflow-hidden px-4">
      
      {/* Subtle Background Ambiance */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-200 rounded-full blur-[120px] opacity-40 pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary-300 rounded-full blur-[100px] opacity-30 pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="mb-8 flex flex-col items-center">
          <Link to="/" className="inline-flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-lg p-1">
            <img src="/logo.png" alt="School Logo" className="w-auto h-12 object-contain group-hover:scale-105 transition-transform drop-shadow-sm filter invert" />
          </Link>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Reset Password</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 text-center">Enter your email address and we'll send you a link to reset your password.</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700 shadow-[0_8px_32px_rgba(0,0,0,0.05)] rounded-3xl p-8 sm:p-10">
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="relative group">
                <input 
                  type="email" 
                  id="email" 
                  name="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  className="w-full px-5 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none peer text-slate-900 dark:text-white placeholder-transparent disabled:opacity-50" 
                  placeholder="Email Address" 
                  disabled={loading}
                  required 
                />
                <label 
                  htmlFor="email" 
                  className="absolute left-5 -top-2.5 bg-white dark:bg-slate-900 px-1 text-sm font-bold text-slate-500 dark:text-slate-400 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-primary-600 cursor-text"
                >
                  Email Address
                </label>
              </div>

              <motion.div 
                initial={false}
                animate={{ height: error ? 'auto' : 0, opacity: error ? 1 : 0 }}
                className="overflow-hidden"
              >
                <p className="text-red-500 text-sm font-medium text-center">{error}</p>
              </motion.div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity shadow-[0_4px_14px_rgba(229,189,223,0.4)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-primary-500 flex justify-center items-center gap-2 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader className="animate-spin" size={20} /> Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <div className="w-16 h-16 bg-primary-400/20 text-primary-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Check your email</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                If an account exists for <span className="text-slate-900 dark:text-white font-medium">{email}</span>, a reset link has been sent.
              </p>
              <button 
                onClick={() => navigate('/login')}
                className="w-full py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                Return to Login
              </button>
            </motion.div>
          )}
        </div>

        {!success && (
          <div className="mt-8 text-center">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors focus:outline-none focus:underline">
              <ArrowLeft size={16} /> Back to Login
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
