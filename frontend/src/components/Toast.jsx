import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';

const Toast = ({ message, type = 'info', onClose, duration = 5000 }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  if (!message) return null;

  const styles = {
    success: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
      text: 'text-green-400',
      icon: <CheckCircle className="text-green-400" size={18} />,
      bar: 'bg-green-500'
    },
    error: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      text: 'text-red-400',
      icon: <AlertCircle className="text-red-400" size={18} />,
      bar: 'bg-red-500'
    },
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      text: 'text-blue-400',
      icon: <Info className="text-blue-400" size={18} />,
      bar: 'bg-blue-500'
    }
  };

  const current = styles[type] || styles.info;

  return (
    <div className="fixed top-8 right-8 z-[1000] pointer-events-none">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, x: 50, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.95 }}
          className={`pointer-events-auto flex items-start gap-4 p-4 rounded-2xl border backdrop-blur-xl shadow-2xl min-w-[300px] max-w-md ${current.bg} ${current.border}`}
        >
          <div className="mt-0.5">{current.icon}</div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">
              System Notification
            </p>
            <p className={`text-xs font-bold leading-relaxed ${current.text}`}>
              {message}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-white/20 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
          
          {/* Progress Bar */}
          <motion.div 
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
            className={`absolute bottom-0 left-0 h-1 rounded-full opacity-30 ${current.bar}`}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Toast;
