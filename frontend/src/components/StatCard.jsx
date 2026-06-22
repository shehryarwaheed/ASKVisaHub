import React from 'react';
import { motion } from 'framer-motion';

const StatCard = ({ title, value, icon, color }) => {
  const themes = {
    blue: { 
      bg: 'from-blue-600/20 to-transparent', 
      border: 'border-blue-500/30', 
      icon: 'bg-blue-600 text-white shadow-blue-600/40',
      accent: 'bg-blue-500',
      text: 'text-blue-400'
    },
    green: { 
      bg: 'from-green-600/20 to-transparent', 
      border: 'border-green-500/30', 
      icon: 'bg-green-600 text-white shadow-green-600/40',
      accent: 'bg-green-500',
      text: 'text-green-400'
    },
    red: { 
      bg: 'from-red-600/20 to-transparent', 
      border: 'border-red-500/30', 
      icon: 'bg-red-600 text-white shadow-red-600/40',
      accent: 'bg-red-500',
      text: 'text-red-400'
    },
    yellow: { 
      bg: 'from-yellow-600/20 to-transparent', 
      border: 'border-yellow-500/30', 
      icon: 'bg-yellow-600 text-white shadow-yellow-600/40',
      accent: 'bg-yellow-500',
      text: 'text-yellow-400'
    },
    purple: {
      bg: 'from-purple-600/20 to-transparent',
      border: 'border-purple-500/30',
      icon: 'bg-purple-600 text-white shadow-purple-600/40',
      accent: 'bg-purple-500',
      text: 'text-purple-400'
    }
  };

  const theme = themes[color] || themes.blue;

  return (
    <motion.div 
      whileHover={{ y: -5, scale: 1.02 }}
      className={`relative overflow-hidden p-5 rounded-3xl border ${theme.border} bg-gradient-to-br ${theme.bg} backdrop-blur-xl transition-all duration-300 shadow-2xl group cursor-default`}
    >
      {/* Decorative large icon in background */}
      <div className={`absolute -right-6 -bottom-6 opacity-[0.05] group-hover:opacity-[0.1] transition-all duration-500 group-hover:scale-110 group-hover:-rotate-12`}>
        {React.cloneElement(icon, { size: 100 })}
      </div>

      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${theme.icon}`}>
          {React.cloneElement(icon, { size: 20 })}
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-white italic tracking-tighter drop-shadow-xl">
            {value || 0}
          </p>
        </div>
      </div>
      
      <div className="relative z-10">
        <p className={`text-[9px] font-black uppercase tracking-[0.25em] ${theme.text}`}>
          {title}
        </p>
        <div className={`h-1 w-6 rounded-full mt-3 bg-white/10 group-hover:w-full transition-all duration-700 ease-out`} />
      </div>
    </motion.div>
  );
};

export default StatCard;
