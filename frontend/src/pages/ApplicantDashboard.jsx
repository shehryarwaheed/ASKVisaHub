import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import DashboardLayout from '../components/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, CheckCircle, XCircle,
  Globe, Plus, Zap, History,
  Loader2, TrendingUp, CreditCard,
  ShieldCheck, Trash2
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import NotificationBox from '../components/NotificationBox';
import StatCard from '../components/StatCard';

const ApplicantDashboard = () => {
  const location = useLocation();
  const path = location.pathname;

  const [data, setData] = useState({
    applications: [],
    history: [],
    stats: { total: 0, approved: 0, pending: 0, rejected: 0, active: 0 },
    loading: true
  });

  const [paymentModal, setPaymentModal] = useState(null); // application object
  const [paymentStep, setPaymentStep] = useState(1);
  const [cardData, setCardData] = useState({
    number: '',
    expiry: '',
    cvv: ''
  });
  const [paying, setPaying] = useState(false);

  const fetchData = async () => {
    try {
      const [apps, hist, pays] = await Promise.all([
        api.get('/applicant/applications'),
        api.get('/applicant/history'),
        api.get('/applicant/payments')
      ]);
      
      const paidAppIds = new Set(pays.data.map(p => p.application_id));
      
      const stats = {
        total: apps.data.length + hist.data.length,
        approved: hist.data.filter(h => h.final_status === 'APPROVED').length,
        rejected: hist.data.filter(h => h.final_status === 'REJECTED').length,
        pending: apps.data.filter(a => a.status_id === 'PENDING').length,
        active: apps.data.length
      };

      // Add paid status to applications
      const appsWithPayment = apps.data.map(a => ({
        ...a,
        is_paid: paidAppIds.has(a.application_id)
      }));

      setData({
        applications: appsWithPayment,
        history: hist.data,
        stats,
        loading: false
      });
    } catch (err) {
      console.error('Fetch failed:', err);
      setData(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => { fetchData(); }, [path]);

  const removeApplication = async (id) => {
    if (!window.confirm('Are you sure you want to remove this application? This action cannot be undone.')) return;
    try {
      await api.delete(`/applicant/application/${id}`);
      fetchData();
    } catch (err) { alert('Failed to remove application'); }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    const cardNumberRegex = /^\d{4}-\d{4}-\d{4}-\d{4}$/;
    const expiryRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;

    if (!cardNumberRegex.test(cardData.number)) {
      alert('Invalid Card Number. Must be XXXX-XXXX-XXXX-XXXX format.');
      return;
    }
    if (!expiryRegex.test(cardData.expiry)) {
      alert('Invalid Expiry Date. Must be MM/YY format.');
      return;
    }

    // Expiration Date Check
    const [expMonth, expYear] = cardData.expiry.split('/').map(Number);
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // getMonth() is 0-indexed
    const currentYear = now.getFullYear() % 100;

    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
      alert('The card has expired. Please use a valid card.');
      return;
    }

    if (cardData.cvv.length !== 3) {
      alert('Invalid CVV. Must be 3 digits.');
      return;
    }

    setPaying(true);
    try {
      const cleanAmount = typeof paymentModal.base_fee === 'string' 
        ? parseFloat(paymentModal.base_fee.replace(/[^0-9.]/g, ''))
        : paymentModal.base_fee;

      await api.post('/applicant/payment', {
        application_id: paymentModal.application_id,
        amount: cleanAmount,
        card_number: cardData.number,
        expiry_date: cardData.expiry,
        cvv: cardData.cvv
      });
      
      setTimeout(() => {
        setPaying(false);
        setPaymentModal(null);
        setCardData({ number: '', expiry: '', cvv: '' });
        fetchData();
      }, 1500);
    } catch (err) {
      alert(err.response?.data?.error || 'Payment failed. Please check card details.');
      setPaying(false);
    }
  };

  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    let formatted = value.match(/.{1,4}/g)?.join('-') || '';
    setCardData({ ...cardData, number: formatted.slice(0, 19) });
  };

  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 2) {
      value = value.slice(0, 2) + '/' + value.slice(2, 4);
    }
    setCardData({ ...cardData, expiry: value.slice(0, 5) });
  };

  const renderContent = () => {
    if (data.loading) return (
      <div className="flex flex-col items-center justify-center p-20 animate-pulse">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
        <p className="text-blue-200/50 font-black uppercase tracking-widest text-xs">Synchronizing Dashboard...</p>
      </div>
    );

    switch (path) {
      case '/applicant/history':
        return (
          <div className="space-y-6">
            <div className="glass-card overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[9px] uppercase text-blue-200/30 font-black tracking-widest border-b border-white/5">
                    <th className="px-6 py-4">Visa Type</th>
                    <th className="px-6 py-4">Destination</th>
                    <th className="px-6 py-4">Completed On</th>
                    <th className="px-6 py-4 text-right">Final Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.history.map(item => (
                    <tr key={item.application_id} className="hover:bg-white/5 transition-all group">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-white uppercase">{item.visa_name}</p>
                        <p className="text-[9px] text-blue-400/50 font-black">ID: #{item.application_id}</p>
                      </td>
                      <td className="px-6 py-4 text-xs text-blue-200/60 font-bold uppercase tracking-tight">{item.country_name}</td>
                      <td className="px-6 py-4 text-xs text-blue-200/30 font-black uppercase tracking-widest">
                        {new Date(item.recorded_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border ${
                          item.final_status === 'APPROVED' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {item.final_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {data.history.length === 0 && (
                    <tr>
                      <td colSpan="4" className="text-center py-20 opacity-20">
                        <History size={48} className="mx-auto mb-4" />
                        <p className="font-black uppercase tracking-widest text-[10px]">No finalized applications found</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case '/applicant/payments':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {data.applications.filter(a => !a.is_paid).map(app => (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} key={app.application_id} className="glass-card relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-4 flex gap-2">
                      <button onClick={() => removeApplication(app.application_id)} className="p-2 bg-red-500/10 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white">
                         <Trash2 size={12} />
                      </button>
                      <p className="text-xs font-black text-blue-400 bg-blue-500/5 px-2 py-1 rounded-lg">${app.base_fee}</p>
                   </div>
                   <h3 className="text-lg font-black text-white uppercase mb-1">{app.visa_name}</h3>
                   <p className="text-[10px] text-blue-200/40 font-black uppercase mb-6 tracking-widest">{app.country_name}</p>
                   
                   <div className="flex items-center justify-between mt-8">
                      <div className="flex items-center gap-2">
                         <Clock size={14} className="text-yellow-500" />
                         <span className="text-[10px] font-black text-yellow-500/50 uppercase">Payment Pending</span>
                      </div>
                      <button 
                        onClick={() => setPaymentModal(app)}
                        className="btn btn-primary px-6 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg group-hover:scale-105 transition-transform"
                      >
                        <CreditCard size={14} /> PAY NOW
                      </button>
                   </div>
                </motion.div>
              ))}
              {data.applications.filter(a => !a.is_paid).length === 0 && (
                <div className="col-span-2 text-center py-20 opacity-20 border-2 border-dashed border-white/10 rounded-3xl">
                   <ShieldCheck size={48} className="mx-auto mb-4" />
                   <p className="font-black uppercase tracking-widest text-[10px]">All current applications are fully paid</p>
                </div>
              )}
            </div>
          </div>
        );

      default: // Overview
        return (
          <div className="space-y-10">
            {/* Stats Panel */}
            <div className="grid grid-cols-5 gap-4">
              <StatCard title="Total Hub" value={data.stats.total} icon={<Globe />} color="blue" />
              <StatCard title="Approved" value={data.stats.approved} icon={<CheckCircle />} color="green" />
              <StatCard title="Pending" value={data.stats.pending} icon={<Clock />} color="yellow" />
              <StatCard title="Rejected" value={data.stats.rejected} icon={<XCircle />} color="red" />
              <StatCard title="In Progress" value={data.stats.active} icon={<Zap />} color="purple" />
            </div>

            {/* Active Progress & Notifications */}
            <div className="grid grid-cols-12 gap-10">
               <div className="col-span-8 space-y-6">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest border-l-4 border-blue-500 pl-4">Live Tracking</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {data.applications.map(app => (
                      <motion.div whileHover={{ y: -5 }} key={app.application_id} className="glass-card relative group">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1">{app.country_name}</p>
                            <h4 className="text-xl font-black text-white uppercase tracking-tighter italic">{app.visa_name}</h4>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {app.is_paid ? (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-[8px] font-black text-green-400 uppercase tracking-widest whitespace-nowrap">
                                <CheckCircle size={10} /> Payment Done
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-[8px] font-black text-yellow-400 uppercase tracking-widest whitespace-nowrap">
                                <Clock size={10} /> Awaiting Payment
                              </div>
                            )}
                            {!app.is_paid && (
                              <button 
                                onClick={() => removeApplication(app.application_id)}
                                className="p-2.5 bg-red-500/10 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                                title="Remove Application"
                              >
                                 <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
    
                        <div className="space-y-2">
                           <div className="flex justify-between text-[9px] font-black uppercase text-blue-200/30">
                              <span>Current Status: <span className="text-white">{app.status_id}</span></span>
                              <span>{app.progress_percentage}%</span>
                           </div>
                           <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${app.progress_percentage}%` }}
                                className="h-full bg-gradient-to-r from-blue-600 to-blue-400"
                              />
                           </div>
                        </div>
    
                        <div className="mt-6 flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-blue-200/20">
                           <p>Ref: #{app.application_id}</p>
                           <p>Assigned Agent: {app.agent_first_name || 'PENDING'}</p>
                        </div>
                      </motion.div>
                    ))}
                    {data.applications.length === 0 && (
                       <div className="col-span-2 text-center py-20 opacity-20 glass-card">
                          <TrendingUp size={48} className="mx-auto mb-4" />
                          <p className="font-black uppercase tracking-widest text-[10px]">No active applications to track</p>
                          <Link to="/applicant/new" className="text-blue-400 hover:underline mt-2 inline-block">Start your journey today</Link>
                       </div>
                    )}
                  </div>
               </div>
               
               <div className="col-span-4">
                  <NotificationBox limit={5} />
               </div>
            </div>
          </div>
        );
    }
  };

  return (
    <DashboardLayout role="applicant">
      <div className="max-w-7xl mx-auto space-y-10">
        <header className="flex justify-between items-start">
           <div>
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">
                {path === '/applicant' ? 'Overview Hub' : path === '/applicant/history' ? 'Past Applications' : 'Financial Console'}
              </h1>
              <p className="text-xs text-blue-400 font-bold uppercase tracking-[0.2em] mt-1 opacity-70">
                {path === '/applicant' ? 'Real-time Visa Journey Tracking' : path === '/applicant/history' ? 'Archived & Processed Dossiers' : 'Secure Settlement & Payment Records'}
              </p>
           </div>
           {path === '/applicant' && (
             <Link to="/applicant/new" className="btn btn-primary flex items-center gap-2 px-8 py-3.5 shadow-xl shadow-blue-500/10">
                <Plus size={18} /> NEW APPLICATION
             </Link>
           )}
        </header>

        <AnimatePresence mode="wait">
           <motion.div 
             key={path}
             initial={{ opacity: 0, x: -10 }} 
             animate={{ opacity: 1, x: 0 }} 
             exit={{ opacity: 0, x: 10 }}
             transition={{ duration: 0.2 }}
           >
              {renderContent()}
           </motion.div>
        </AnimatePresence>
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {paymentModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-blue-950/90 backdrop-blur-xl">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }} 
               animate={{ scale: 1, opacity: 1 }} 
               exit={{ scale: 0.9, opacity: 0 }} 
               className="glass-card max-w-md w-full relative border border-white/20 shadow-2xl"
             >
                <button onClick={() => {setPaymentModal(null); setPaymentStep(1);}} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
                   <XCircle size={24} />
                </button>

                 <div className="mb-6">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Secure Checkout</p>
                    <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">{paymentModal.visa_name}</h3>
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                       <span className="text-[10px] font-black text-blue-200/30 uppercase tracking-widest">Payment Amount</span>
                       <span className="text-xl font-black text-green-400 tracking-tighter">${paymentModal.base_fee}</span>
                    </div>
                 </div>

                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                   <div className="space-y-4">
                      <div>
                        <label className="text-[9px] font-black text-blue-200/30 uppercase tracking-widest ml-1 mb-2 block">Card Number</label>
                        <input 
                          type="text"
                          placeholder="0000-0000-0000-0000"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-blue-500/50 transition-colors"
                          value={cardData.number}
                          onChange={handleCardNumberChange}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-black text-blue-200/30 uppercase tracking-widest ml-1 mb-2 block">Expiry Date</label>
                           <input 
                            type="text"
                            placeholder="MM/YY"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-blue-500/50 transition-colors"
                            value={cardData.expiry}
                            onChange={handleExpiryChange}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-blue-200/30 uppercase tracking-widest ml-1 mb-2 block">CVV</label>
                          <input 
                            type="password"
                            placeholder="***"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-blue-500/50 transition-colors"
                            value={cardData.cvv}
                            onChange={(e) => setCardData({...cardData, cvv: e.target.value.replace(/\D/g, '').slice(0, 3)})}
                          />
                        </div>
                      </div>
                   </div>
                   
                   <button 
                     type="submit"
                     disabled={paying}
                     className={`w-full mt-6 py-4 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs transition-all bg-green-500 text-green-950 hover:bg-green-400 shadow-xl shadow-green-500/20 ${paying ? 'opacity-70 cursor-not-allowed' : ''}`}
                   >
                     {paying ? <Loader2 className="animate-spin" size={16} /> : <><ShieldCheck size={16} /> PAY & UNLOCK AGENT</>}
                   </button>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default ApplicantDashboard;
