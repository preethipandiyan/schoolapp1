import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useSpring, useMotionValue, useReducedMotion } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial } from '@react-three/drei';
import { LuAtom as Atom, LuSparkles as Sparkles, LuShieldCheck as ShieldCheck, LuUsers as Users, LuChevronRight as ChevronRight, LuZap as Zap, LuGlobe as Globe, LuCheck as Check, LuGraduationCap as GraduationCap, LuBookOpen as BookOpen, LuLaptop as Laptop, LuMail as Mail, LuMapPin as MapPin, LuPhone as Phone, LuMenu as Menu, LuX as X, LuBriefcase, LuClock as Clock, LuMessageSquare as MessageSquare, LuFileText as FileText } from 'react-icons/lu';
import { subscribeToSubscriptionPlans } from '../firebase/firestore';

// --- 3D Background Component ---
function Hero3DBackground() {
  const meshRef = useRef(null);
  const reducedMotion = useReducedMotion();
  
  useFrame((state) => {
    if (meshRef.current && !reducedMotion) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.1;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.15;
    }
  });

  return (
    <Float speed={reducedMotion ? 0 : 2} rotationIntensity={reducedMotion ? 0 : 1} floatIntensity={reducedMotion ? 0 : 2}>
      <mesh ref={meshRef} position={[0, 0, -5]} scale={1.5}>
        <sphereGeometry args={[2.5, 64, 64]} />
        <MeshDistortMaterial 
          color="#E5BDDF" 
          attach="material" 
          distort={reducedMotion ? 0 : 0.4} 
          speed={reducedMotion ? 0 : 2} 
          roughness={0.2} 
          transparent 
          opacity={0.15} 
        />
      </mesh>
    </Float>
  );
}

// --- Floating Icon Component ---
function FloatingIcon({ icon: Icon, delay, x, y, mouseX, mouseY }) {
  const reducedMotion = useReducedMotion();
  const springX = useSpring(useTransform(mouseX, [-0.5, 0.5], [x - 20, x + 20]), { stiffness: 50, damping: 20 });
  const springY = useSpring(useTransform(mouseY, [-0.5, 0.5], [y - 20, y + 20]), { stiffness: 50, damping: 20 });
  
  return (
    <motion.div
      className="absolute text-primary-400 opacity-40 mix-blend-screen"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        x: reducedMotion ? 0 : springX,
        y: reducedMotion ? 0 : springY,
      }}
      animate={{
        y: reducedMotion ? 0 : [0, -15, 0],
        rotate: reducedMotion ? 0 : [0, 5, -5, 0],
      }}
      transition={{
        duration: 4,
        ease: "easeInOut",
        repeat: Infinity,
        delay: delay
      }}
    >
      <Icon size={42} />
    </motion.div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [plans, setPlans] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Mouse Parallax values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Scroll values for Navbar
  const { scrollY } = useScroll();
  const navBg = useTransform(scrollY, [0, 80], ['rgba(18, 16, 26, 0)', 'rgba(18, 16, 26, 0.8)']);
  const navBackdrop = useTransform(scrollY, [0, 80], ['blur(0px)', 'blur(16px)']);
  const navBorder = useTransform(scrollY, [0, 80], ['rgba(229, 189, 223, 0)', 'rgba(229, 189, 223, 0.1)']);
  const navPy = useTransform(scrollY, [0, 80], ['1.5rem', '1rem']);

  useEffect(() => {
    const unsub = subscribeToSubscriptionPlans((data) => {
      const order = ['base', 'standard', 'premium', 'enterprise'];
      const sortedPlans = [...data].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      const visiblePlans = sortedPlans.filter(plan => plan.active !== false);
      setPlans(visiblePlans);
    });

    return () => unsub();
  }, []);
  useEffect(() => {
    const handleMouseMove = (e) => {
      mouseX.set(e.clientX / window.innerWidth - 0.5);
      mouseY.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  const scrollToSection = (id) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const services = [
    { title: "Admissions", icon: <Users size={28} />, desc: "Streamline the enrollment process with automated workflows." },
    { title: "Attendance", icon: <Clock size={28} />, desc: "Real-time tracking for students and staff with instant alerts." },
    { title: "Fee & Billing", icon: <Zap size={28} />, desc: "Automate invoicing, online payments, and financial reporting." },
    { title: "Timetable", icon: <BookOpen size={28} />, desc: "Conflict-free schedule generation for classes and teachers." },
    { title: "Exams & Grading", icon: <FileText size={28} />, desc: "Comprehensive report cards and analytics dashboards." },
    { title: "Communication", icon: <MessageSquare size={28} />, desc: "Seamless parent-teacher messaging and broadcast alerts." },
  ];

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[#12101A] text-[#F5F5F7] font-sans selection:bg-primary-500 selection:text-[#12101A] overflow-x-hidden">
      
      {/* --- Navigation --- */}
      <motion.nav 
        style={{ 
          backgroundColor: navBg, 
          backdropFilter: navBackdrop, 
          borderBottomColor: navBorder,
          borderBottomWidth: '1px',
          paddingTop: navPy,
          paddingBottom: navPy
        }}
        className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 transition-all duration-300"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => scrollToSection('home')}>
            <img src="/logo.png" alt="School Logo" className="w-auto h-10 object-contain group-hover:scale-105 transition-transform mix-blend-screen bg-transparent" style={{ filter: 'drop-shadow(0 0 10px rgba(229,189,223,0.2))' }} />
          </div>
          
          <div className="hidden md:flex gap-8 items-center font-medium text-[#A8A0AC]">
            <button onClick={() => scrollToSection('home')} className="hover:text-primary-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 rounded-md px-2 py-1">Home</button>
            <button onClick={() => scrollToSection('services')} className="hover:text-primary-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 rounded-md px-2 py-1">Services</button>
            <button onClick={() => scrollToSection('pricing')} className="hover:text-primary-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 rounded-md px-2 py-1">Pricing</button>
            <button onClick={() => scrollToSection('contact')} className="hover:text-primary-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 rounded-md px-2 py-1">Contact</button>
          </div>

          <div className="hidden md:flex gap-4 items-center">
            <button 
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 font-bold text-[#A8A0AC] hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 rounded-md"
            >
              Log in
            </button>
            <button 
              onClick={() => navigate('/register')}
              className="px-6 py-2.5 bg-gradient-to-r from-[#6B4A73] to-primary-400 text-white font-bold rounded-full hover:scale-105 hover:shadow-[0_0_20px_rgba(229,189,223,0.4)] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#12101A] focus:ring-primary-400"
            >
              Get Started
            </button>
          </div>

          <button className="md:hidden text-[#F5F5F7] p-2 -mr-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle menu">
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed inset-0 z-40 bg-[#12101A]/95 backdrop-blur-xl flex flex-col items-center justify-center gap-8 md:hidden pt-20"
        >
          <button onClick={() => scrollToSection('home')} className="text-2xl font-bold text-[#A8A0AC] hover:text-white">Home</button>
          <button onClick={() => scrollToSection('services')} className="text-2xl font-bold text-[#A8A0AC] hover:text-white">Services</button>
          <button onClick={() => scrollToSection('pricing')} className="text-2xl font-bold text-[#A8A0AC] hover:text-white">Pricing</button>
          <button onClick={() => scrollToSection('contact')} className="text-2xl font-bold text-[#A8A0AC] hover:text-white">Contact</button>
          <button onClick={() => navigate('/login')} className="text-2xl font-bold text-[#A8A0AC] hover:text-white mt-4">Log in</button>
          <button 
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/register');
            }}
            className="px-8 py-4 bg-gradient-to-r from-[#6B4A73] to-primary-400 text-white font-bold rounded-full text-xl shadow-[0_0_20px_rgba(229,189,223,0.4)]"
          >
            Get Started
          </button>
        </motion.div>
      )}

      <main>
        {/* --- Hero Section --- */}
        <section id="home" className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
          {/* 3D Canvas Background */}
          <div className="absolute inset-0 z-0 opacity-80">
            <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
              <ambientLight intensity={0.5} />
              <directionalLight position={[10, 10, 10]} intensity={1} color="#E5BDDF" />
              <Hero3DBackground />
            </Canvas>
          </div>

          {/* Mouse Parallax Floating Icons */}
          <div className="absolute inset-0 z-10 pointer-events-none hidden md:block">
            <FloatingIcon icon={GraduationCap} delay={0} x={15} y={25} mouseX={mouseX} mouseY={mouseY} />
            <FloatingIcon icon={Globe} delay={0.5} x={80} y={30} mouseX={mouseX} mouseY={mouseY} />
            <FloatingIcon icon={BookOpen} delay={1.2} x={25} y={75} mouseX={mouseX} mouseY={mouseY} />
            <FloatingIcon icon={Atom} delay={0.8} x={85} y={70} mouseX={mouseX} mouseY={mouseY} />
            <FloatingIcon icon={Clock} delay={1.5} x={10} y={50} mouseX={mouseX} mouseY={mouseY} />
          </div>

          <div className="relative z-20 text-center px-6 max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary-900/50 bg-[#1a1625]/50 backdrop-blur-md text-primary-400 font-bold text-sm mb-8 shadow-sm">
                <Sparkles size={16} />
                The Future of Education
              </div>
              
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1.1] mb-6">
                Manage your school,<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-[#6B4A73]">
                  at the speed of thought.
                </span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-lg lg:text-xl text-[#A8A0AC] max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              School is the ultimate multi-tenant OS for education. Seamlessly connect administrators, teachers, and parents in a secure, lightning-fast cloud ecosystem.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <button 
                onClick={() => navigate('/register')}
                className="px-8 py-4 bg-gradient-to-r from-[#6B4A73] to-primary-400 text-white font-bold text-lg rounded-full hover:scale-105 hover:shadow-[0_0_40px_rgba(229,189,223,0.4)] transition-all duration-300 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#12101A] focus:ring-primary-400"
              >
                Get Started <ChevronRight size={20} />
              </button>
              <button 
                onClick={() => scrollToSection('services')}
                className="px-8 py-4 bg-[#1a1625]/80 backdrop-blur-md border border-primary-900/50 text-[#F5F5F7] font-bold text-lg rounded-full hover:bg-primary-900/30 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                See Services
              </button>
            </motion.div>
          </div>
          
          {/* Scroll Cue */}
          <motion.div 
            className="absolute bottom-10 left-1/2 -translate-x-1/2 text-primary-400"
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <div className="w-px h-12 bg-gradient-to-b from-primary-400 to-transparent mx-auto"></div>
          </motion.div>
        </section>

        {/* --- Services Section --- */}
        <section id="services" className="py-32 px-6 max-w-7xl mx-auto scroll-mt-20">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl lg:text-5xl font-black mb-4 tracking-tight">Everything you need</h2>
            <p className="text-lg text-[#A8A0AC] max-w-2xl mx-auto">A complete suite of tools designed specifically for modern educational institutions.</p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -8, transition: { duration: 0.2, ease: "easeOut" } }}
                className="group bg-[#1a1625]/60 backdrop-blur-xl border border-primary-900/30 p-8 rounded-[32px] hover:border-primary-400/60 hover:shadow-[0_20px_40px_rgba(229,189,223,0.1)] transition-colors"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-[#3D2A4A] to-[#6B4A73] rounded-2xl flex items-center justify-center text-primary-400 mb-6 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg border border-primary-900/50">
                  {service.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{service.title}</h3>
                <p className="text-[#A8A0AC] leading-relaxed">
                  {service.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* --- Pricing Section --- */}
        <section id="pricing" className="py-32 px-6 scroll-mt-20 relative bg-[#0f0e15]">
          <div className="absolute inset-0 bg-gradient-to-b from-[#12101A] via-transparent to-[#12101A] pointer-events-none"></div>
          
          <div className="relative z-10 max-w-7xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl lg:text-5xl font-black mb-4 tracking-tight">Simple, transparent pricing</h2>
              <p className="text-lg text-[#A8A0AC] max-w-2xl mx-auto">Choose the perfect plan for your institution. Upgrade at any time as your school grows.</p>
            </motion.div>
            
            {plans.length === 0 ? (
              <div className="flex justify-center items-center h-64">
                <div className="w-10 h-10 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar pb-8 pt-6 -mt-6 px-2 -mx-2">
                <div className={`min-w-[1000px] grid gap-8 justify-center ${
                  plans.length === 1 ? 'grid-cols-1 max-w-md mx-auto' :
                  plans.length === 2 ? 'grid-cols-2 max-w-3xl mx-auto' :
                  plans.length === 3 ? 'grid-cols-3 max-w-5xl mx-auto' :
                  'grid-cols-4'
                }`}>
                  {plans.map((plan, idx) => {
                    const isPopular = plan.id === 'premium';
                    
                    return (
                      <motion.div 
                        key={plan.id}
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: idx * 0.1 }}
                        className={`w-full max-w-[280px] mx-auto rounded-3xl flex flex-col relative transition-all duration-300 ${
                          isPopular 
                            ? 'bg-gradient-to-b from-[#2a1a35] to-[#1a1625] border-2 border-primary-400 shadow-[0_0_30px_rgba(229,189,223,0.15)] z-10' 
                            : 'bg-[#1a1625]/60 backdrop-blur-xl border border-primary-900/40 hover:border-primary-400/40 mt-4'
                        }`}
                      >
                        {isPopular && (
                          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary-400 text-[#12101A] font-bold text-xs uppercase tracking-widest py-1 px-4 rounded-full">
                            Most Popular
                          </div>
                        )}
                        
                        <div className={`p-6 border-b ${isPopular ? 'border-primary-900/50' : 'border-primary-900/30'}`}>
                          <h3 className="text-2xl font-black mb-4 uppercase tracking-wide text-center">{plan.name}</h3>
                          <div className="text-center mb-6 h-16 flex flex-col justify-center">
                            {plan.custom ? (
                              <span className="text-3xl font-black text-[#F5F5F7]">Custom Pricing</span>
                            ) : (
                              <div className="flex flex-col items-center justify-center">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-4xl font-black text-primary-400">INR {plan.pricePerUserPerYear}</span>
                                </div>
                                <span className="text-[#A8A0AC] font-medium text-sm">per user / year</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-3 mb-6">
                            <div className="flex justify-between items-center bg-[#12101A]/50 p-3 rounded-xl border border-primary-900/20">
                              <span className="text-[#A8A0AC] text-sm font-medium">User Limit</span>
                              <span className="text-[#F5F5F7] font-bold">{plan.custom ? 'Unlimited' : plan.userLimit}</span>
                            </div>
                            <div className="flex justify-between items-center bg-[#12101A]/50 p-3 rounded-xl border border-primary-900/20">
                              <span className="text-[#A8A0AC] text-sm font-medium">Cloud Storage</span>
                              <span className="text-[#F5F5F7] font-bold">{plan.custom ? 'Custom' : `${plan.cloudStorageGB} GB`}</span>
                            </div>
                          </div>

                          <button 
                            onClick={() => window.open(plan.custom ? '#contact' : `/register?plan=${plan.id}`, '_self')}
                            className={`w-full py-3.5 font-bold text-sm uppercase tracking-wider rounded-xl transition-all shadow-sm ${
                              isPopular 
                                ? 'bg-primary-400 text-[#12101A] hover:bg-primary-300' 
                                : 'bg-[#3D2A4A] text-white hover:bg-[#6B4A73]'
                            }`}
                          >
                            {plan.custom ? 'Contact Us' : 'Get Started'}
                          </button>
                        </div>
                        
                        <div className="p-6 flex-1">
                          <h4 className="text-xs font-bold text-[#A8A0AC] uppercase tracking-widest mb-4 text-center">Modules Included</h4>
                          <ul className="space-y-4">
                            {[
                              { key: 'staffManagement', label: 'Staff Management' },
                              { key: 'studentManagement', label: 'Student Management' },
                              { key: 'timetable', label: 'Timetable' },
                              { key: 'feeManagement', label: 'Fee Management' },
                              { key: 'attendance', label: 'Attendance' },
                              { key: 'exams', label: 'Exams & Reports' },
                              { key: 'library', label: 'Library' },
                              { key: 'transport', label: 'Transport' },
                              { key: 'lms', label: 'LMS Integration' },
                              { key: 'apiIntegration', label: 'API Integration' }
                            ].map((mod) => {
                              const isIncluded = plan.modules && plan.modules[mod.key];
                              return (
                                <li key={mod.key} className="flex justify-between items-center border-b border-primary-900/20 pb-3 last:border-0 last:pb-0">
                                  <span className={`text-sm font-medium ${isIncluded ? 'text-[#F5F5F7]' : 'text-[#A8A0AC]'}`}>{mod.label}</span>
                                  {isIncluded ? (
                                    <div className="text-emerald-400 bg-emerald-400/10 p-1 rounded-full"><Check size={14} strokeWidth={3} /></div>
                                  ) : (
                                    <div className="text-red-400 bg-red-400/10 p-1 rounded-full"><X size={14} strokeWidth={3} /></div>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* --- Contact Us Section --- */}
        <section id="contact" className="py-32 px-6 max-w-7xl mx-auto scroll-mt-20">
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid lg:grid-cols-2 gap-16 items-center"
          >
            <div>
              <h2 className="text-4xl lg:text-5xl font-black mb-6 tracking-tight">Get in touch</h2>
              <p className="text-lg text-[#A8A0AC] mb-10">
                Have questions about School? Our team is here to help you set up your institution for success. Reach out to us anytime.
              </p>
              
              <div className="space-y-6">
                <motion.div whileHover={{ x: 10 }} className="flex items-center gap-5 p-6 glass-card-dark rounded-3xl cursor-default">
                  <div className="w-14 h-14 bg-gradient-to-tr from-[#3D2A4A] to-[#6B4A73] text-primary-400 rounded-2xl flex items-center justify-center shrink-0">
                    <Mail size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#F5F5F7]">Email Us</h4>
                    <p className="text-[#A8A0AC]">hello@School.edu</p>
                  </div>
                </motion.div>
                
                <motion.div whileHover={{ x: 10 }} className="flex items-center gap-5 p-6 glass-card-dark rounded-3xl cursor-default">
                  <div className="w-14 h-14 bg-gradient-to-tr from-[#3D2A4A] to-[#6B4A73] text-primary-400 rounded-2xl flex items-center justify-center shrink-0">
                    <Phone size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#F5F5F7]">Call Us</h4>
                    <p className="text-[#A8A0AC]">+91 (800) 123-4567</p>
                  </div>
                </motion.div>

                <motion.div whileHover={{ x: 10 }} className="flex items-center gap-5 p-6 glass-card-dark rounded-3xl cursor-default">
                  <div className="w-14 h-14 bg-gradient-to-tr from-[#3D2A4A] to-[#6B4A73] text-primary-400 rounded-2xl flex items-center justify-center shrink-0">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#F5F5F7]">Visit Us</h4>
                    <p className="text-[#A8A0AC]">Tech Park, Bengaluru, India</p>
                  </div>
                </motion.div>
              </div>
            </div>
            
            {/* Contact Form */}
            <div className="glass-dark p-8 sm:p-10 rounded-[40px] relative">
              {/* Blur accent */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary-600 rounded-full blur-[80px] opacity-30 -z-10 pointer-events-none"></div>
              
              <h3 className="text-2xl font-bold mb-8">Send a Message</h3>
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div className="relative group">
                  <input type="text" id="name" className="w-full px-5 py-4 rounded-2xl bg-[#12101A]/80 border border-primary-900/50 focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all outline-none peer text-[#F5F5F7] placeholder-transparent" placeholder="John Doe" required />
                  <label htmlFor="name" className="absolute left-5 -top-2.5 bg-[#12101A] px-1 text-sm font-bold text-[#A8A0AC] transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-primary-400">Full Name</label>
                </div>
                <div className="relative group">
                  <input type="email" id="email" className="w-full px-5 py-4 rounded-2xl bg-[#12101A]/80 border border-primary-900/50 focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all outline-none peer text-[#F5F5F7] placeholder-transparent" placeholder="john@school.edu" required />
                  <label htmlFor="email" className="absolute left-5 -top-2.5 bg-[#12101A] px-1 text-sm font-bold text-[#A8A0AC] transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-primary-400">Email Address</label>
                </div>
                <div className="relative group">
                  <textarea id="message" rows="4" className="w-full px-5 py-4 rounded-2xl bg-[#12101A]/80 border border-primary-900/50 focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all outline-none resize-none peer text-[#F5F5F7] placeholder-transparent" placeholder="How can we help you?" required></textarea>
                  <label htmlFor="message" className="absolute left-5 -top-2.5 bg-[#12101A] px-1 text-sm font-bold text-[#A8A0AC] transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-primary-400">Message</label>
                </div>
                <button className="w-full py-4 bg-gradient-to-r from-[#6B4A73] to-primary-400 text-white font-bold rounded-2xl hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(229,189,223,0.3)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#12101A] focus:ring-primary-400">
                  Send Message
                </button>
              </form>
            </div>
          </motion.div>
        </section>
      </main>
      
      {/* --- Footer --- */}
      <footer className="border-t border-primary-900/30 pt-20 pb-10 relative z-10 bg-[#0f0e15]">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-6">
              <img src="/logo.png" alt="School Logo" className="w-auto h-10 object-contain mix-blend-screen bg-transparent" />
            </div>
            <p className="text-[#A8A0AC] font-medium leading-relaxed">
              Empowering educational institutions globally with cutting-edge cloud management technology.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-[#F5F5F7] mb-6 uppercase tracking-wider text-sm">Product</h4>
            <ul className="space-y-4 text-[#A8A0AC] font-medium">
              <li><button onClick={() => scrollToSection('services')} className="hover:text-primary-400 transition-colors">Features</button></li>
              <li><button onClick={() => scrollToSection('pricing')} className="hover:text-primary-400 transition-colors">Pricing</button></li>
              <li><a href="#" className="hover:text-primary-400 transition-colors">Security</a></li>
              <li><a href="#" className="hover:text-primary-400 transition-colors">Updates</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-[#F5F5F7] mb-6 uppercase tracking-wider text-sm">Company</h4>
            <ul className="space-y-4 text-[#A8A0AC] font-medium">
              <li><a href="#" className="hover:text-primary-400 transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-primary-400 transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-primary-400 transition-colors">Blog</a></li>
              <li><button onClick={() => scrollToSection('contact')} className="hover:text-primary-400 transition-colors">Contact</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-[#F5F5F7] mb-6 uppercase tracking-wider text-sm">Stay Updated</h4>
            <p className="text-[#A8A0AC] font-medium mb-4">Subscribe to our newsletter for the latest updates and features.</p>
            <form className="flex flex-col gap-2" onSubmit={(e) => e.preventDefault()}>
              <input type="email" placeholder="Your email address" aria-label="Email address" className="w-full px-4 py-3 rounded-xl bg-[#12101A] border border-primary-900/50 text-[#F5F5F7] outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400" required />
              <button type="submit" className="w-full px-4 py-3 bg-[#3D2A4A] text-white font-bold rounded-xl hover:bg-[#6B4A73] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#12101A] focus:ring-primary-400">Subscribe</button>
            </form>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-primary-900/20 flex flex-col md:flex-row justify-between items-center gap-4 text-[#A8A0AC] text-sm font-medium">
          <p>&copy; {currentYear} School. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary-400 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
