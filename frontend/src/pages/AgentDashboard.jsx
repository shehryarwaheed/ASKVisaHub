import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import DashboardLayout from '../components/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, XCircle, Clock, 
  TrendingUp, UserPlus, Loader2,
  Zap, History as HistoryIcon, Award, Plus, Edit, Trash2, ShieldAlert,
  Copy, Check
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import NotificationBox from '../components/NotificationBox';
import StatCard from '../components/StatCard';

const AgentDashboard = () => {
  const location = useLocation();
  const path = location.pathname;

  const [data, setData] = useState({
    activeApps: [],
    requests: [],
    history: [],
    stats: {},
    profile: null,
    loading: true
  });
  
  const [updatingApp, setUpdatingApp] = useState(null);
  const [updateData, setUpdateData] = useState({ progress: 0, status: '', remarks: '' });

  const [blacklistModal, setBlacklistModal] = useState(null); // stores the req object
  const [blacklistReason, setBlacklistReason] = useState('');
  const [blacklisting, setBlacklisting] = useState(false);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    experience_years: 0,
    hourly_fee: 0,
    available_hours: '',
    bio: ''
  });

  // Structured time states
  const [startTime, setStartTime] = useState("09:00");
  const [startPeriod, setStartPeriod] = useState("AM");
  const [endTime, setEndTime] = useState("05:00");
  const [endPeriod, setEndPeriod] = useState("PM");

  // Helper to parse "9:00 AM - 5:00 PM"
  const parseOfficeHours = (str) => {
    if (!str || !str.includes(' - ')) return;
    try {
      const [start, end] = str.split(' - ');
      const [sTime, sPeriod] = start.split(' ');
      const [eTime, ePeriod] = end.split(' ');
      if (sTime) setStartTime(sTime);
      if (sPeriod) setStartPeriod(sPeriod);
      if (eTime) setEndTime(eTime);
      if (ePeriod) setEndPeriod(ePeriod);
    } catch (e) { console.error("Time parse error", e); }
  };

  const fetchData = async () => {
    try {
      const [apps, reqs, stats, prof, hist] = await Promise.all([
        api.get('/agent/applications'),
        api.get('/agent/work-requests'),
        api.get('/agent/stats'),
        api.get('/agent/profile'),
        api.get('/agent/history')
      ]);
      console.log('Agent Active Apps:', apps.data);
      setData({
        activeApps: apps.data,
        requests: reqs.data.filter(r => !r.is_approved),
        stats: stats.data,
        profile: prof.data,
        history: hist.data,
        loading: false
      });
      if (prof.data) {
        setProfileForm({
          experience_years: prof.data.experience_years || 0,
          hourly_fee: prof.data.hourly_fee || 0,
          available_hours: prof.data.available_hours || '',
          bio: prof.data.bio || ''
        });
        parseOfficeHours(prof.data.available_hours);
      }
    } catch (err) {
      console.error('Fetch failed:', err);
      setData(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => { fetchData(); }, [path]);

  const removeApplication = async (id) => {
    if (!window.confirm('Officer, are you sure you want to PERMANENTLY delete this application and its records?')) return;
    try {
      await api.delete(`/agent/application/${id}`);
      fetchData();
    } catch (err) { alert('Deletion failed'); }
  };

  const approveRequest = async (id) => {
    try {
      await api.put(`/agent/approve-connection/${id}`);
      fetchData();
    } catch (err) { alert('Approval failed'); }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    try {
      if (updateData.status === 'APPROVED' || updateData.status === 'REJECTED') {
        await api.put(`/agent/finalize/${updatingApp.application_id}`, {
          final_status: updateData.status,
          remarks: updateData.remarks
        });
      } else {
        await api.put(`/agent/update-progress/${updatingApp.application_id}`, {
          progress_percentage: updateData.progress,
          status_id: updateData.status,
          remarks: updateData.remarks
        });
      }
      setUpdatingApp(null);
      fetchData();
    } catch (err) { alert('Update/Finalize failed'); }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    // Combine structured time parts into the formal format
    const finalHours = `${startTime} ${startPeriod} - ${endTime} ${endPeriod}`;
    try {
      await api.put('/agent/profile', { ...profileForm, available_hours: finalHours });
      setEditingProfile(false);
      fetchData();
    } catch (err) { alert('Profile update failed'); }
  };

  const handleBlacklist = (req) => {
    setBlacklistModal(req);
    setBlacklistReason('');
  };

  const submitBlacklistRequest = async () => {
    if (!blacklistReason.trim()) return alert('Please provide a reason for the block request.');
    setBlacklisting(true);
    try {
      await api.post('/agent/blacklist-request', {
        applicant_name: `${blacklistModal.first_name} ${blacklistModal.last_name}`,
        applicant_id: blacklistModal.applicant_id || blacklistModal.application_id,
        reason: blacklistReason
      });
      alert('Blacklist request sent to administrator.');
      setBlacklistModal(null);
    } catch (err) { 
      const errMsg = err.response?.data?.error || err.message;
      alert(`Failed to send blacklist request: ${errMsg}`); 
    } finally {
      setBlacklisting(false);
    }
  };

  const renderContent = () => {
    if (data.loading) return (
      <div className="flex flex-col items-center justify-center p-20 animate-pulse">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
        <p className="text-blue-200/50 font-black uppercase tracking-widest text-xs">Syncing Data...</p>
      </div>
    );

    switch (path) {
      case '/agent/requests':
        return (
          <div className="space-y-6">
            <header>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Work Requests</h2>
              <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mt-1">Accept incoming connection requests from applicants</p>
            </header>
            <div className="grid grid-cols-3 gap-6">
              {data.requests.length > 0 ? data.requests.map(req => (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={req.connection_id} className="glass-card flex flex-col justify-between border-t-4 border-t-yellow-500 group relative">
                  <div>
                     <div className="flex items-center justify-between mb-6">
                       <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black text-xl italic">
                           {req.first_name[0]}
                         </div>
                         <div>
                           <h4 className="text-sm font-black text-white uppercase italic tracking-tighter">{req.first_name} {req.last_name}</h4>
                           <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-1 opacity-70">{req.passport_no || 'PASSPORT PENDING'}</p>
                         </div>
                       </div>
                       <button 
                         onClick={() => handleBlacklist(req)}
                         className="p-3 bg-white/5 text-yellow-500 rounded-xl hover:bg-yellow-500 hover:text-yellow-950 transition-all border border-white/5"
                         title="Block Request"
                       >
                          <ShieldAlert size={14} />
                       </button>
                     </div>

                     <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-3 mb-6">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                           <span className="text-blue-200/30">Visa Name:</span>
                           <span className="text-blue-400">{req.visa_name || 'Standard Visa'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                           <span className="text-blue-200/30">Request Date:</span>
                           <span className="text-white">{new Date(req.request_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest pt-2 border-t border-white/5">
                           <span className="text-blue-200/30">Email:</span>
                           <span className="text-white lowercase italic opacity-50">{req.email}</span>
                        </div>
                     </div>
                  </div>
                  <button onClick={() => approveRequest(req.connection_id)} className="w-full btn btn-primary py-3 text-[10px] flex items-center justify-center gap-2">
                    <UserPlus size={14} /> ACCEPT WORK
                  </button>
                </motion.div>
              )) : (
                <div className="col-span-3 text-center py-20 opacity-20 border-2 border-dashed border-white/10 rounded-3xl">
                  <UserPlus size={48} className="mx-auto mb-4" />
                  <p className="font-black uppercase tracking-widest text-xs">No pending requests at the moment</p>
                </div>
              )}
            </div>
          </div>
        );

      case '/agent/active':
        return (
          <div className="space-y-6">
            <header className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight italic">Active Dossiers</h2>
                <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mt-1">Manage and track progress of your accepted applications</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-blue-200/30 uppercase font-black tracking-widest">Active Cases</p>
                <p className="text-lg font-black text-white">{data.activeApps.length}</p>
              </div>
            </header>

            <div className="grid grid-cols-1 gap-6 max-w-6xl mx-auto">
              {data.activeApps.length > 0 ? data.activeApps.map(app => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  key={app.application_id} 
                  className="glass-card relative overflow-hidden"
                >
                  {/* Header: Name (Left) and Status/Payment (Right) */}
                  <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-[18px] bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white font-black text-xl italic shadow-lg shadow-blue-600/30">
                        {app.app_first[0]}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">{app.app_first} {app.app_last}</h3>
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest opacity-60 mt-0.5">Ref: #{app.application_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       {/* Payment Status Badge */}
                       <div className={`px-4 py-1.5 rounded-xl font-black text-[9px] tracking-widest uppercase border ${
                         app.is_paid > 0 ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 italic'
                       }`}>
                         {app.is_paid > 0 ? 'Settled' : 'Payment Pending'}
                       </div>

                       {/* Application Status Badge */}
                       <div className={`px-4 py-1.5 rounded-xl font-black text-[9px] tracking-widest uppercase border ${
                         app.status_id === 'IN_REVIEW' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-white/5 text-white/50 border-white/10'
                       }`}>
                         {app.status_id}
                       </div>

                       <div className="flex gap-2 ml-2">
                        <button 
                          disabled={Number(app.is_paid) === 0}
                          onClick={() => { 
                            if (Number(app.is_paid) === 0) return;
                            setUpdatingApp(app); 
                            setUpdateData({ progress: app.progress_percentage, status: app.status_id, remarks: app.remarks || '' }); 
                          }}
                          className={`p-2.5 rounded-xl transition-all ${
                            Number(app.is_paid) > 0 
                            ? 'bg-blue-600 text-white hover:bg-blue-500' 
                            : 'bg-white/5 text-white/20 cursor-not-allowed'
                          }`}
                        >
                          <Edit size={16} />
                        </button>
                        {Number(app.is_paid) === 0 && (
                          <button 
                            onClick={() => removeApplication(app.application_id)}
                            className="p-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                       </div>
                    </div>
                  </div>

                  {/* Body: Information Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <DetailItem label="Passport" value={app.passport_no || 'PENDING'} />
                    <DetailItem label="CNIC" value={app.cnic || 'PENDING'} />
                    <DetailItem label="Visa Type" value={app.visa_name} color="blue" />
                    <DetailItem label="Country" value={app.country_name} color="blue" />
                    <DetailItem label="Phone" value={app.phone || 'N/A'} />
                    <DetailItem label="Gender" value={app.gender || 'N/A'} />
                    <DetailItem label="Birth Date" value={app.date_of_birth ? new Date(app.date_of_birth).toLocaleDateString() : 'N/A'} />
                    <DetailItem label="Email" value={app.email || 'N/A'} />
                    <DetailItem label="Residential Address" value={app.address || 'N/A'} full />
                  </div>

                  {/* Footer: Prominent Progress Bar */}
                  <div className="bg-blue-600/5 p-5 rounded-2xl border border-blue-500/10 relative overflow-hidden">
                     {/* Subtle glow effect */}
                     <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[40px] pointer-events-none" />
                     
                     <div className="flex justify-between items-end mb-3 px-1 relative z-10">
                        <div>
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-1">PROGRESS</p>
                          <div className="h-1 w-12 bg-blue-500 rounded-full opacity-50" />
                        </div>
                        <div className="text-right">
                          <span className="text-3xl font-black text-white italic leading-none drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                            {app.progress_percentage}%
                          </span>
                        </div>
                     </div>
                     <div className="h-3 bg-[#0f172a] rounded-full overflow-hidden p-1 border border-white/5 shadow-inner relative z-10">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${app.progress_percentage}%` }}
                          className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.6)] relative overflow-hidden"
                        >
                           {/* Animated shine effect */}
                           <motion.div 
                             animate={{ x: ['-100%', '200%'] }}
                             transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                             className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-1/2"
                           />
                        </motion.div>
                     </div>
                  </div>
                </motion.div>
              )) : (
                <div className="col-span-3 text-center py-24 opacity-20 border-2 border-dashed border-white/10 rounded-[40px]">
                  <ShieldAlert size={64} className="mx-auto mb-6 text-blue-400" />
                  <p className="text-xl font-black uppercase tracking-tighter italic">No Active Dossiers Found</p>
                  <p className="text-[10px] font-black uppercase tracking-widest mt-2">Accepted work requests will appear here as primary dossiers</p>
                </div>
              )}
            </div>
          </div>
        );

      case '/agent/history':
        return (
          <div className="space-y-6">
            <header>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Completed History</h2>
              <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mt-1">Archive of finalized visa decisions</p>
            </header>
            <div className="glass-card">
              {data.history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[9px] uppercase text-blue-200/40 font-black tracking-widest border-b border-white/5">
                        <th className="pb-4">Applicant</th>
                        <th className="pb-4">Visa & Country</th>
                        <th className="pb-4">Result Date</th>
                        <th className="pb-4 text-right">Final Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.history.map(item => (
                        <tr key={item.application_id}>
                          <td className="py-4 text-sm font-bold text-white">{item.first_name} {item.last_name}</td>
                          <td className="py-4">
                            <p className="text-xs text-blue-200/60 font-bold">{item.visa_name}</p>
                            <p className="text-[9px] text-blue-200/30 uppercase font-black">{item.country_name}</p>
                          </td>
                          <td className="py-4 text-xs text-blue-200/40 font-bold">
                            {new Date(item.decision_date).toLocaleDateString()}
                          </td>
                          <td className="py-4 text-right">
                             <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${
                               item.final_status === 'APPROVED' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                             }`}>
                               {item.final_status}
                             </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-20 opacity-20">
                  <HistoryIcon size={48} className="mx-auto mb-4" />
                  <p className="font-black uppercase tracking-widest text-xs">No processing history found</p>
                </div>
              )}
            </div>
          </div>
        );

      case '/agent/profile':
        return (
          <div className="space-y-6 max-w-4xl">
            <header className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Agent Profile</h2>
                <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mt-1">Manage your public professional information</p>
              </div>
              <button 
                onClick={() => setEditingProfile(true)}
                className="btn btn-primary px-6 py-2.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
              >
                <Plus size={14} /> EDIT PORTFOLIO
              </button>
            </header>
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-4 space-y-6">
                <div className="glass-card text-center">
                  <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-400 mx-auto mb-4 border border-blue-500/20 shadow-xl">
                    <Award size={32} />
                  </div>
                  <h3 className="text-lg font-black text-white uppercase">{data.profile?.first_name} {data.profile?.last_name}</h3>
                  <p className="text-[10px] text-blue-200/40 font-black uppercase tracking-widest mt-1">Licensed Officer</p>
                  
                  <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                     <div className="flex justify-between items-center text-[10px] font-black uppercase">
                        <span className="text-blue-200/30">Experience</span>
                        <span className="text-white">{data.profile?.experience_years > 0 ? `${data.profile.experience_years} Years` : 'Update field'}</span>
                     </div>
                     <div className="flex justify-between items-center text-[10px] font-black uppercase">
                        <span className="text-blue-200/30">Rating</span>
                        <span className="text-yellow-400">★ {data.profile?.rating || '0.0'}</span>
                     </div>
                  </div>
                </div>
              </div>
              <div className="col-span-8">
                <div className="glass-card h-full">
                  <h4 className="text-sm font-black uppercase tracking-widest mb-6 border-b border-white/5 pb-4">Professional Bio</h4>
                  <p className="text-sm text-blue-200/70 leading-relaxed italic">
                    {data.profile?.bio ? `"${data.profile.bio}"` : '"Update field: Professional bio..."'}
                  </p>
                  <div className="mt-8 grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                       <p className="text-[9px] font-black text-blue-200/30 uppercase mb-2">Office Hours</p>
                       <p className="text-xs font-bold text-white">{data.profile?.available_hours || 'Not Set'}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                       <p className="text-[9px] font-black text-blue-200/30 uppercase mb-2">Service Fee</p>
                       <p className="text-xs font-bold text-green-400">
                          {data.profile?.hourly_fee > 0 ? `$${data.profile.hourly_fee} / Connection` : 'Update field'}
                       </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default: // /agent (Overview)
        return (
          <div className="space-y-6">
            <header className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight uppercase">Dashboard Overview</h1>
                <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mt-1">Current system status and performance</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-blue-200/30 uppercase font-black tracking-widest">Status</p>
                <div className="flex items-center gap-2 text-green-400 text-[10px] font-black">
                  <Zap size={12} className="animate-pulse" /> ONLINE
                </div>
              </div>
            </header>

            <div className="grid grid-cols-4 gap-4">
              <StatCard title="Active Work" value={data.stats.active_count} color="blue" icon={<TrendingUp />} />
              <StatCard title="Approved" value={data.stats.approved_count} color="green" icon={<CheckCircle />} />
              <StatCard title="Pending Req" value={data.requests.length} color="yellow" icon={<UserPlus />} />
              <StatCard title="Rejected" value={data.stats.rejected_count} color="red" icon={<XCircle />} />
            </div>

            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-8 glass-card">
                 <h3 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                    <TrendingUp size={16} className="text-blue-400" /> Success Metrics
                 </h3>
                 <div className="h-32 flex items-end gap-2 px-2">
                    {[40, 70, 45, 90, 65, 80, 55, 95, 75, 85, 60, 100].map((h, i) => (
                      <div key={i} className="flex-1 bg-blue-500/20 hover:bg-blue-500 transition-all rounded-t-sm" style={{ height: `${h}%` }}></div>
                    ))}
                 </div>
                 <div className="flex justify-between mt-4 text-[8px] text-blue-200/30 font-black uppercase tracking-widest">
                    <span>Performance over last 12 months</span>
                 </div>
              </div>
              <div className="col-span-4 space-y-4">
                 <NotificationBox limit={6} />
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <DashboardLayout role="agent">
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

      <AnimatePresence>
        {updatingApp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-blue-950/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-card max-w-md w-full">
              <h3 className="text-lg font-black uppercase mb-6">Update Visa Progress</h3>
              <form onSubmit={handleUpdateSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-blue-200/50 uppercase mb-2 block">Progress Percentage ({updateData.progress}%)</label>
                  <input type="range" min="0" max="100" value={updateData.progress} onChange={(e) => setUpdateData({ ...updateData, progress: e.target.value })} className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-blue-200/50 uppercase mb-2 block">Current Status</label>
                  <select value={updateData.status} onChange={(e) => setUpdateData({ ...updateData, status: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm">
                    <option value="IN_REVIEW">Under Review</option>
                    <option value="SUBMITTED">Submitted to Embassy</option>
                    <option value="ADDITIONAL_DOCS">Needs Docs</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-blue-200/50 uppercase mb-2 block">Officer Remarks</label>
                  <textarea value={updateData.remarks} onChange={(e) => setUpdateData({ ...updateData, remarks: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm" rows="3" />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setUpdatingApp(null)} className="flex-1 px-4 py-3 text-[10px] font-black uppercase border border-white/10 rounded-xl hover:bg-white/5">Cancel</button>
                  <button type="submit" className="flex-1 btn btn-primary text-[10px] py-3">Save Update</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-blue-950/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-card max-w-md w-full">
              <h3 className="text-lg font-black uppercase mb-6 italic tracking-tighter">Edit Agent Portfolio</h3>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-blue-200/50 uppercase mb-2 block">Experience (Years)</label>
                    <input 
                      type="number" 
                      value={profileForm.experience_years} 
                      onChange={(e) => setProfileForm({ ...profileForm, experience_years: e.target.value })} 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none transition-colors" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-blue-200/50 uppercase mb-2 block">Hourly Fee ($)</label>
                    <input 
                      type="number" 
                      value={profileForm.hourly_fee} 
                      onChange={(e) => setProfileForm({ ...profileForm, hourly_fee: e.target.value })} 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none transition-colors" 
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-blue-200/50 uppercase mb-3 block tracking-widest">Office Hours Configuration</label>
                  <div className="grid grid-cols-2 gap-4">
                    {/* START TIME */}
                    <div className="space-y-2">
                      <p className="text-[8px] font-black text-blue-400 uppercase">Start Time</p>
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          placeholder="09:00"
                          value={startTime} 
                          onChange={(e) => setStartTime(e.target.value)} 
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none transition-colors" 
                        />
                        <div className="flex flex-col rounded-lg overflow-hidden border border-white/10 h-[44px]">
                          <button 
                            type="button" 
                            onClick={() => setStartPeriod('AM')}
                            className={`flex-1 px-3 text-[8px] font-black transition-all ${startPeriod === 'AM' ? 'bg-blue-500 text-white' : 'bg-white/5 text-blue-200/30'}`}
                          >AM</button>
                          <button 
                            type="button" 
                            onClick={() => setStartPeriod('PM')}
                            className={`flex-1 px-3 text-[8px] font-black transition-all ${startPeriod === 'PM' ? 'bg-blue-500 text-white' : 'bg-white/5 text-blue-200/30'}`}
                          >PM</button>
                        </div>
                      </div>
                    </div>

                    {/* END TIME */}
                    <div className="space-y-2">
                      <p className="text-[8px] font-black text-blue-400 uppercase">End Time</p>
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          placeholder="05:00"
                          value={endTime} 
                          onChange={(e) => setEndTime(e.target.value)} 
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none transition-colors" 
                        />
                        <div className="flex flex-col rounded-lg overflow-hidden border border-white/10 h-[44px]">
                          <button 
                            type="button" 
                            onClick={() => setEndPeriod('AM')}
                            className={`flex-1 px-3 text-[8px] font-black transition-all ${endPeriod === 'AM' ? 'bg-blue-500 text-white' : 'bg-white/5 text-blue-200/30'}`}
                          >AM</button>
                          <button 
                            type="button" 
                            onClick={() => setEndPeriod('PM')}
                            className={`flex-1 px-3 text-[8px] font-black transition-all ${endPeriod === 'PM' ? 'bg-blue-500 text-white' : 'bg-white/5 text-blue-200/30'}`}
                          >PM</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-blue-200/50 uppercase mb-2 block">Professional Bio</label>
                  <textarea 
                    value={profileForm.bio} 
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none transition-colors" 
                    rows="4" 
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setEditingProfile(false)} className="flex-1 px-4 py-3 text-[10px] font-black uppercase border border-white/10 rounded-xl hover:bg-white/5">Cancel</button>
                  <button type="submit" className="flex-1 btn btn-primary text-[10px] py-3">Save Portfolio</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {blacklistModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-blue-950/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-card max-w-md w-full relative">
              <button onClick={() => setBlacklistModal(null)} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
                 <XCircle size={20} />
              </button>
              
              <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                <ShieldAlert size={12} /> Security Protocol
              </p>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-6">Block Applicant</h3>
              
              <div className="space-y-4 mb-6">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                   <p className="text-[9px] font-black text-blue-200/30 uppercase mb-1">Target Applicant</p>
                   <p className="text-sm font-bold text-white">{blacklistModal.first_name || blacklistModal.app_first} {blacklistModal.last_name || blacklistModal.app_last}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                   <p className="text-[9px] font-black text-blue-200/30 uppercase mb-1">Application Reference</p>
                   <p className="text-xs font-bold text-blue-400">{blacklistModal.visa_name || 'Visa Application'}</p>
                </div>
                <div>
                   <label className="text-[9px] font-black text-blue-200/30 uppercase mb-2 block">Violation Reason</label>
                   <textarea 
                     value={blacklistReason}
                     onChange={(e) => setBlacklistReason(e.target.value)}
                     className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-yellow-500/50 outline-none transition-colors" 
                     placeholder="Please explain why this applicant should be blacklisted..."
                     rows="4" 
                   />
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button type="button" onClick={() => setBlacklistModal(null)} className="flex-1 px-4 py-3 text-[10px] font-black uppercase border border-white/10 rounded-xl hover:bg-white/5">Cancel</button>
                <button 
                  disabled={blacklisting || !blacklistReason.trim()}
                  onClick={submitBlacklistRequest}
                  className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl flex items-center justify-center gap-2 transition-all ${
                    !blacklistReason.trim() || blacklisting ? 'bg-white/5 text-white/20' : 'bg-yellow-500 text-yellow-950 hover:bg-yellow-400 shadow-xl shadow-yellow-500/20'
                  }`}
                >
                  {blacklisting ? <Loader2 className="animate-spin" size={14} /> : <><ShieldAlert size={14} /> SEND REQUEST</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

const DetailItem = ({ label, value, color = 'gray', full = false }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (!value || value === 'N/A' || value === 'PENDING') return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`p-3 bg-white/5 border border-white/10 rounded-xl transition-all hover:bg-white/10 group/item relative ${full ? 'col-span-2' : ''}`}>
      <div className="flex justify-between items-start mb-0.5">
        <p className="text-[7px] font-black text-blue-200/20 uppercase tracking-widest">{label}</p>
        <button 
          onClick={handleCopy}
          className={`transition-all p-1 rounded-lg hover:bg-white/10 ${copied ? 'text-green-400' : 'text-blue-200/30'}`}
          title="Copy to Clipboard"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
        </button>
      </div>
      <p className={`text-[13px] font-bold ${full ? 'whitespace-normal' : 'truncate'} ${color === 'blue' ? 'text-blue-400' : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
};

export default AgentDashboard;
