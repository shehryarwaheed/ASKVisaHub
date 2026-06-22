import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleNavigation = (path) => {
    // Add page exit animation if needed, or just navigate
    navigate(path);
  };

  return (
    <div className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      {/* Background and Overlay are handled by index.css global styles */}
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="glass-card w-[430px] text-center animate-float relative z-10"
      >
        <h1 className="text-5xl font-black mb-2 tracking-tight text-white">
          ASKVisaHub
        </h1>
        
        <p className="text-blue-100/80 text-sm mb-10 font-medium">
          Visa Management System for Applicants, Agents & Admin
        </p>

        <div className="space-y-4">
          <Link 
            to="/login"
            className="btn btn-primary w-full text-lg py-4"
          >
            Login
          </Link>

          <Link 
            to="/register"
            className="btn btn-secondary w-full text-lg py-4"
          >
            Register
          </Link>
        </div>
      </motion.div>

      {/* Subtle decorative elements to enhance the premium feel */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[120px] pointer-events-none"></div>
    </div>
  );
};

export default LandingPage;

