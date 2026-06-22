import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { motion } from 'framer-motion';
import { 
  User, Globe, Mail, Lock, Phone, MapPin, 
  Loader2, AlertCircle, CreditCard, ArrowLeft, 
  Calendar, Eye, EyeOff 
} from 'lucide-react';
import Toast from '../components/Toast';
import IOSSelect from '../components/IOSSelect';

const Register = () => {
  const [role, setRole] = useState('applicant');
  const [formData, setFormData] = useState({
    username: '', email: '', password: '',
    first_name: '', last_name: '', cnic: '', passport_no: '',
    phone: '', address: '', assigned_country: '',
    date_of_birth: '', gender: ''
  });
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await api.get('/lookup/countries');
        setCountries(res.data.map(c => ({ value: c.country_id, label: c.country_name })));
      } catch (err) { console.error(err); }
    };
    fetchCountries();
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSelectChange = (name, value) => setFormData({ ...formData, [name]: value });

  const handleCnicChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 5) {
      value = value.slice(0, 5) + '-' + value.slice(5, 13);
    }
    setFormData({ ...formData, cnic: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const { email, cnic, passport_no, address, date_of_birth, password } = formData;

    // 1. Email Check
    if (!email.includes('@')) {
      setError('Invalid email address. Must contain @');
      setLoading(false);
      return;
    }

    // 2. CNIC Check (13 digits, format XXXXX-XXXXXXXX)
    const cnicRegex = /^\d{5}-\d{8}$/;
    if (!cnicRegex.test(cnic)) {
      setError('Invalid CNIC format. Use XXXXX-XXXXXXXX (13 digits total)');
      setLoading(false);
      return;
    }

    // 3. Passport Check (2 letters + 7 digits = 9 chars)
    const passportRegex = /^[a-zA-Z]{2}\d{7}$/;
    if (!passportRegex.test(passport_no)) {
      setError('Invalid Passport. Format: 2 letters followed by 7 digits (9 chars total)');
      setLoading(false);
      return;
    }

    // 4. DOB Check (Not today/future)
    const dob = new Date(date_of_birth);
    const today = new Date();
    today.setHours(0,0,0,0);
    dob.setHours(0,0,0,0);
    if (dob.getTime() >= today.getTime()) {
      setError('Invalid Date of Birth. It cannot be today or in the future.');
      setLoading(false);
      return;
    }

    // 5. Address Check (>= 15 chars)
    if (address.length < 15) {
      setError('Kindly Enter Detailed Address');
      setLoading(false);
      return;
    }

    // 6. Password length check (8-12 chars as per placeholder)
    if (password.length < 8 || password.length > 12) {
      setError('Password must be between 8 and 12 characters.');
      setLoading(false);
      return;
    }

    try {
      const { username, email, password, ...profileData } = formData;
      const res = await api.post('/auth/register', { 
        username: email, email, password, role, profileData 
      });
      
      if (res.data.pending) {
        setSuccess('Registration request submitted! Please wait for admin approval.');
        setTimeout(() => navigate('/login'), 3000);
      } else {
        navigate('/login');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6">
      {/* Premium Notifications */}
      <Toast message={error} type="error" onClose={() => setError('')} />
      <Toast message={success} type="success" onClose={() => setSuccess('')} />

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
        className="glass-card w-full max-w-[500px] text-center animate-float"
      >
        <h2 className="text-3xl font-black mb-8 tracking-[0.2em] text-white">REGISTER</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4 mb-6">
            <button 
              type="button"
              onClick={() => setRole('applicant')}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${role === 'applicant' ? 'bg-blue-500 text-white shadow-lg' : 'bg-white/10 text-blue-200/50 hover:bg-white/20'}`}
            >
              Applicant
            </button>
            <button 
              type="button"
              onClick={() => setRole('agent')}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${role === 'agent' ? 'bg-blue-500 text-white shadow-lg' : 'bg-white/10 text-blue-200/50 hover:bg-white/20'}`}
            >
              Officer
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/50" size={16} />
              <input name="first_name" placeholder="First Name" className="pl-11 py-2 text-sm" onChange={handleChange} required />
            </div>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/50" size={16} />
              <input name="last_name" placeholder="Last Name" className="pl-11 py-2 text-sm" onChange={handleChange} required />
            </div>
          </div>

          <div className="relative">
            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/50" size={16} />
            <input 
              name="cnic" 
              placeholder="CNIC (XXXXX-XXXXXXXX)" 
              className="pl-11 py-2 text-sm" 
              value={formData.cnic}
              onChange={handleCnicChange} 
              required 
            />
          </div>

          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/50" size={16} />
            <input name="passport_no" placeholder="Passport (e.g. AB1234567)" className="pl-11 py-2 text-sm" onChange={handleChange} required />
          </div>

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/50" size={16} />
            <input name="email" type="email" placeholder="Email" className="pl-11 py-2 text-sm" onChange={handleChange} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/50" size={16} />
              <input name="date_of_birth" type="date" className="pl-11 py-2 text-sm" onChange={handleChange} required />
            </div>
            <div className="relative">
              <IOSSelect 
                placeholder="Gender"
                value={formData.gender}
                onChange={(val) => handleSelectChange('gender', val)}
                options={[
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                  { value: 'Other', label: 'Other' }
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/50" size={16} />
              <input name="phone" placeholder="Phone" className="pl-11 py-2 text-sm" onChange={handleChange} required />
            </div>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/50" size={16} />
              <input name="address" placeholder="Address" className="pl-11 py-2 text-sm" onChange={handleChange} required />
            </div>
          </div>

          {role === 'agent' && (
            <div className="relative">
              <IOSSelect 
                placeholder="Select Country"
                value={formData.assigned_country}
                onChange={(val) => handleSelectChange('assigned_country', val)}
                options={countries}
                icon={Globe}
              />
            </div>
          )}

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/50" size={16} />
            <input 
              name="password" 
              type={showPassword ? 'text' : 'password'} 
              placeholder="Password (8-12 chars)" 
              className="pl-11 pr-12 py-2 text-sm" 
              onChange={handleChange} 
              required 
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-200/30 hover:text-blue-400 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button 
            type="submit" 
            disabled={loading || success}
            className={`btn btn-primary w-full text-blue-950 mt-4 py-4 transition-all ${success ? 'opacity-50 cursor-not-allowed scale-95' : ''}`}
          >
            {loading ? <Loader2 className="animate-spin" /> : success ? 'Request Sent' : 'Register'}
          </button>
        </form>

        <p className="mt-8 text-blue-100/60 text-sm">
          Already have an account? {' '}
          <Link to="/login" className="text-blue-300 font-bold hover:underline">Login</Link>
        </p>
      </motion.div>

      {/* Decorative */}
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
    </div>
  );
};

export default Register;

