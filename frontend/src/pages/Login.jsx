import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import Toast from '../components/Toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === 'applicant') navigate('/applicant');
      else if (user.role === 'agent') navigate('/agent');
      else if (user.role === 'admin') navigate('/admin');
    } catch (err) {
      const backendError = err.response?.data;
      setError(backendError?.message || backendError?.error || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Premium Notification */}
      <Toast 
        message={error} 
        type="error" 
        onClose={() => setError('')} 
      />

      {/* Back Button */}
      <Link 
        to="/" 
        className="absolute top-8 left-8 z-50 flex items-center gap-2 px-4 py-2 bg-blue-500 text-blue-950 font-bold rounded-xl hover:scale-105 transition-all shadow-lg"
      >
        <ArrowLeft size={20} />
        <span>BACK</span>
      </Link>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="glass-card w-full max-w-[360px] text-center animate-float"
      >
        <h2 className="text-3xl font-black mb-8 tracking-[0.2em] text-white">LOGIN</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/50" size={18} />
            <input 
              type="email" 
              placeholder="Email"
              className="pl-12"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/50" size={18} />
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password"
              className="px-12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-200/50 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary w-full text-blue-950 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Login'}
          </button>
        </form>

        <p className="mt-8 text-blue-100/60 text-sm">
          Don't have an account? {' '}
          <Link to="/register" className="text-blue-300 font-bold hover:underline">Register</Link>
        </p>
      </motion.div>

      {/* Decorative */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
    </div>
  );
};

export default Login;

