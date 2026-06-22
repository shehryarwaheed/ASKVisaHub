import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import DashboardLayout from '../components/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Globe, ShieldAlert, FileText, 
  TrendingUp, CheckCircle, Loader2,
  Activity, Award, Search, Filter,
  ArrowRight, UserCheck, XCircle, Clock
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip 
} from 'recharts';
import NotificationBox from '../components/NotificationBox';
import Toast from '../components/Toast';
import StatCard from '../components/StatCard';

const AdminDashboard = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [mainData, setMainData] = useState([]); 
  const [agentsData, setAgentsData] = useState([]); 
  const [pendingData, setPendingData] = useState([]); // New state for registration requests
  const [filter, setFilter] = useState('');
  const [ratingModal, setRatingModal] = useState(null); // { agent_id, name }
  const [newRating, setNewRating] = useState(5);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchResults, setSearchResults] = useState({ applicants: [], agents: [] });
  const [isSearching, setIsSearching] = useState(false);
  const getActiveTab = () => {
    if (location.pathname.includes('/applicants')) return 'applicants';
    if (location.pathname.includes('/agents')) return 'agents';
    if (location.pathname.includes('/blacklisted')) return 'blacklisted';
    if (location.pathname.includes('/reports')) return 'reports';
    if (location.pathname.includes('/feed')) return 'feed';
    return 'overview';
  };

  const activeTab = getActiveTab();

  const fetchData = async () => {
    setLoading(true);
    try {
      // Always fetch stats for the top cards
      const statsRes = await api.get('/admin/dashboard-stats');
      setStats(statsRes.data);

      let dataRes;
      if (activeTab === 'overview' || activeTab === 'feed') {
        const [appsRes, pendingRes] = await Promise.all([
          api.get('/admin/applications'),
          api.get('/admin/pending-registrations')
        ]);
        setMainData(appsRes.data || []);
        setPendingData(pendingRes.data || []);
        setLoading(false);
        return;
      } else if (activeTab === 'applicants') {
        dataRes = await api.get('/admin/applicants');
      } else if (activeTab === 'agents') {
        dataRes = await api.get('/admin/agents');
      } else if (activeTab === 'blacklisted') {
        dataRes = await api.get('/admin/blacklisted');
      } else if (activeTab === 'reports') {
        const [repRes, agRes] = await Promise.all([
          api.get('/admin/reports'),
          api.get('/admin/agents')
        ]);
        setMainData(repRes.data || []);
        setAgentsData(agRes.data || []);
        setLoading(false);
        return; // Skip the default setter below
      }
      
      setMainData(dataRes.data || []);
    } catch (err) {
      console.error('Admin fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (filter.length >= 2) {
      const delayDebounceFn = setTimeout(async () => {
        setIsSearching(true);
        try {
          const res = await api.get(`/admin/search?q=${filter}`);
          setSearchResults(res.data);
        } catch (err) { console.error('Search failed:', err); }
        setIsSearching(false);
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setSearchResults({ applicants: [], agents: [] });
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleRateAgent = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/rate-agent/${ratingModal.agent_id}`, { rating: newRating });
      setRatingModal(null);
      setNewRating(5);
      fetchData();
    } catch (err) { alert('Failed to rate agent'); }
  };

  const handleBlacklistApplicant = async (app) => {
    const reason = window.prompt(`Enter reason for blacklisting ${app.first_name} ${app.last_name}:`);
    if (reason === null) return;
    try {
      await api.post('/admin/blacklist', {
        user_id: app.user_id,
        applicant_id: app.applicant_id,
        blacklist_type: 'Manual Admin Action',
        reason: reason || 'Violation of terms'
      });
      alert('Applicant blacklisted successfully');
      fetchData();
    } catch (err) { alert('Failed to blacklist applicant'); }
  };

  const handleUnblock = async (blacklistId) => {
    if (!window.confirm('Are you sure you want to unblock this user?')) return;
    try {
      await api.delete(`/admin/unblock/${blacklistId}`);
      alert('User unblocked successfully');
      fetchData();
    } catch (err) { alert('Failed to unblock user'); }
  };

  const handleApproveRegistration = async (regId) => {
    setProcessingId(regId);
    try {
      await api.post(`/admin/approve-registration/${regId}`);
      setSuccess('Account approved successfully. Credentials have been activated.');
      fetchData();
    } catch (err) { 
      setError(err.response?.data?.error || 'Failed to approve registration'); 
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectRegistration = async (regId) => {
    const reason = window.prompt('Enter reason for rejection:');
    if (reason === null) return;
    setProcessingId(regId);
    try {
      await api.post(`/admin/reject-registration/${regId}`, { reason });
      setSuccess('Registration request declined.');
      fetchData();
    } catch (err) { 
      setError(err.response?.data?.error || 'Failed to reject registration'); 
    } finally {
      setProcessingId(null);
    }
  };

  const filteredData = (mainData || []).filter(item => {
    if (!filter) return true;
    const search = filter.toLowerCase();
    if (activeTab === 'overview') {
      return item.app_first?.toLowerCase().includes(search) || item.country_name?.toLowerCase().includes(search);
    }
    if (activeTab === 'applicants') {
      return item.first_name?.toLowerCase().includes(search) || item.email?.toLowerCase().includes(search);
    }
    if (activeTab === 'agents' || activeTab === 'blacklisted') {
      return item.first_name?.toLowerCase().includes(search) || item.email?.toLowerCase().includes(search) || item.username?.toLowerCase().includes(search);
    }
    return true;
  });

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Premium Notifications */}
        <Toast message={error} type="error" onClose={() => setError('')} />
        <Toast message={success} type="success" onClose={() => setSuccess('')} />

        {/* Header Section */}
        <header className="flex justify-between items-end mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <ShieldAlert className="text-blue-400" size={24} />
              <h1 className="text-3xl font-black text-white tracking-tight uppercase">
                {activeTab === 'overview' ? 'System Overview' : 
                 activeTab === 'applicants' ? 'Applicant Directory' :
                 activeTab === 'agents' ? 'Agent Registry' : 
                 activeTab === 'blacklisted' ? 'Blacklist Management' :
                 activeTab === 'feed' ? 'Global Application Feed' : 'Activity Reports'}
              </h1>
            </div>
            <p className="text-[10px] text-blue-200/40 font-black uppercase tracking-[0.2em]">
              {activeTab === 'overview' ? 'Real-time platform metrics & performance' : 
               activeTab === 'applicants' ? 'Manage registered users & their portfolios' :
               activeTab === 'agents' ? 'Monitor agent performance & approval rates' : 
               activeTab === 'blacklisted' ? 'Suspended accounts and security restrictions' :
               activeTab === 'feed' ? 'Complete history of all platform submissions' : 'Historical data and system auditing'}
            </p>
          </div>
          
          <div className="flex items-center gap-4 w-full max-w-md">
             <div className="relative w-full group">
                <div className="absolute inset-0 bg-blue-600/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity rounded-xl" />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 group-focus-within:scale-110 transition-transform z-10" size={16} />
                <input 
                  type="text"
                  placeholder="SEARCH ANY USER..."
                  className="relative w-full pl-11 pr-8 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-blue-200/20 placeholder:italic placeholder:tracking-[0.2em] focus:border-blue-500/40 focus:bg-white/10 outline-none transition-all shadow-2xl backdrop-blur-xl"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                {isSearching && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Loader2 className="animate-spin text-blue-500" size={12} />
                  </div>
                )}
             </div>
             <div className="flex items-center gap-2.5 px-4 py-2.5 bg-green-500 border border-green-400 rounded-xl h-fit shadow-lg shadow-green-500/30 group cursor-default">
                <div className="relative flex items-center justify-center">
                   <Activity size={14} className="text-white animate-[pulse_2s_infinite] relative z-10" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-white uppercase tracking-[0.3em] leading-none">
                    Live
                  </span>
                </div>
             </div>
          </div>
        </header>

        {/* Dynamic Content Area */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
              <p className="text-blue-200/30 text-[10px] font-black uppercase tracking-widest">Accessing Secure Records...</p>
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
               {filter.length >= 2 ? (
                 <SearchResultsView 
                   results={searchResults} 
                   onBlacklist={handleBlacklistApplicant}
                   onRate={setRatingModal}
                 />
               ) : (
                 <>
                   {activeTab === 'overview' && (
                     <OverviewView 
                       stats={stats} 
                       pendingRequests={pendingData} 
                       onApprove={handleApproveRegistration}
                       onReject={handleRejectRegistration}
                       processingId={processingId}
                     />
                   )}
                   {activeTab === 'feed' && <GlobalFeedView data={filteredData} />}
                   {activeTab === 'applicants' && <ApplicantsView data={filteredData} onBlacklist={(app) => handleBlacklistApplicant(app)} />}
                   {activeTab === 'agents' && <AgentsView data={filteredData} onRate={setRatingModal} />}
                   {activeTab === 'blacklisted' && <BlacklistedView data={filteredData} onUnblock={(id) => handleUnblock(id)} />}
                   {activeTab === 'reports' && <ReportsView data={filteredData} agents={agentsData} />}
                 </>
               )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {ratingModal && (
              <RatingModal 
                agent={ratingModal} 
                rating={newRating} 
                setRating={setNewRating} 
                onClose={() => setRatingModal(null)} 
                onSubmit={handleRateAgent} 
              />
            )}
          </AnimatePresence>
        </div>
    </DashboardLayout>
  );
};

const RatingModal = ({ agent, rating, setRating, onClose, onSubmit }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-blue-950/90 backdrop-blur-xl">
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card max-w-sm w-full border border-white/20 shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Performance Review</p>
          <h3 className="text-xl font-black text-white uppercase italic">Rate {agent.name}</h3>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
          <XCircle size={20} />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`p-2 transition-all ${rating >= star ? 'text-yellow-400 scale-125' : 'text-white/10'}`}
            >
              <Award size={32} fill={rating >= star ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
        
        <div className="text-center">
           <p className="text-2xl font-black text-white">{rating}.0 <span className="text-sm text-white/30">/ 5.0</span></p>
           <p className="text-[9px] text-blue-200/30 uppercase font-black tracking-widest mt-1">Select agent performance level</p>
        </div>

        <button type="submit" className="w-full py-4 bg-yellow-500 text-yellow-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-yellow-400 transition-all shadow-xl shadow-yellow-500/20">
          Submit Rating
        </button>
      </form>
    </motion.div>
  </div>
);

const SearchResultsView = ({ results, onBlacklist, onRate }) => (
  <div className="space-y-8">
    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
      <Search size={20} className="text-blue-400" />
      <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
        Global Search Results
      </h2>
      <span className="text-[10px] font-black bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20">
        {results.applicants.length + results.agents.length} matches found
      </span>
    </div>

    {/* Applicants Section */}
    {results.applicants.length > 0 && (
      <div className="glass-card">
        <h3 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2">
          <Users size={16} className="text-purple-400" /> Matching Applicants
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[9px] uppercase text-blue-200/40 font-black tracking-widest border-b border-white/5">
                <th className="pb-4">Full Name</th>
                <th className="pb-4">Contact Info</th>
                <th className="pb-4 text-center">Applications</th>
                <th className="pb-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {results.applicants.map((app, i) => (
                <tr key={i} className="hover:bg-white/5 transition-all">
                  <td className="py-4">
                    <p className="font-bold text-white text-sm">{app.first_name} {app.last_name}</p>
                    <p className="text-[10px] text-blue-200/30 uppercase font-black">@{app.username}</p>
                  </td>
                  <td className="py-4">
                    <p className="text-xs text-white">{app.email}</p>
                    <p className="text-[10px] text-blue-200/40">{app.phone || 'No Phone'}</p>
                  </td>
                  <td className="py-4 text-center">
                    <span className="text-xs font-black text-blue-400 px-3 py-1 bg-blue-500/10 border border-blue-500/10 rounded-lg">
                      {app.total_apps || 0} Apps
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <button 
                      onClick={() => onBlacklist(app)}
                      className="text-[8px] font-black uppercase tracking-widest px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                    >
                      Block User
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {/* Agents Section */}
    {results.agents.length > 0 && (
      <div className="glass-card">
        <h3 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2">
          <Award size={16} className="text-yellow-400" /> Matching Agents
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[9px] uppercase text-blue-200/40 font-black tracking-widest border-b border-white/5">
                <th className="pb-4">Agent Name</th>
                <th className="pb-4">Expertise</th>
                <th className="pb-4 text-center">Total Apps</th>
                <th className="pb-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {results.agents.map((agent, i) => (
                <tr key={i} className="hover:bg-white/5 transition-all">
                  <td className="py-4">
                    <p className="font-bold text-white text-sm">{agent.first_name} {agent.last_name}</p>
                    <p className="text-[10px] text-blue-200/30 uppercase font-black">Officer ID: #{agent.agent_id}</p>
                  </td>
                  <td className="py-4 text-xs text-white font-bold">
                    {agent.country_name || 'Global'}
                  </td>
                  <td className="py-4 text-center">
                    <span className="text-xs font-black text-yellow-400 px-3 py-1 bg-yellow-500/10 border-yellow-500/10 rounded-lg">
                      {agent.total_apps || 0} Apps
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <button 
                      onClick={() => onRate({ agent_id: agent.agent_id, name: `${agent.first_name} ${agent.last_name}` })}
                      className="text-[9px] font-black text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-lg hover:bg-yellow-500 hover:text-yellow-950 transition-all uppercase tracking-widest"
                    >
                      Rate Agent
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {results.applicants.length === 0 && results.agents.length === 0 && (
      <div className="py-20 text-center glass-card border-dashed opacity-50">
        <Search size={48} className="mx-auto mb-4 text-blue-500/20" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">No matches found for your search query</p>
      </div>
    )}
  </div>
);

/* --- Sub-Views --- */

const AgentsView = ({ data, onRate }) => (
  <div className="glass-card">
    <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
      <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
         <Award size={16} className="text-yellow-400" /> Professional Agent Registry
      </h2>
    </div>
    
    <div className="w-full">
      <div className="grid grid-cols-[20%_15%_12%_12%_18%_10%_13%] text-[9px] uppercase text-blue-200/40 font-black tracking-widest border-b border-white/5 pb-4 px-2">
        <div>Agent Name</div>
        <div>Expertise</div>
        <div className="text-center">Status</div>
        <div className="text-center">Rating</div>
        <div>Performance</div>
        <div className="text-center">Active Load</div>
        <div className="text-right">Action</div>
      </div>

      <div className="divide-y divide-white/5">
        {data.map((agent, i) => (
          <div key={i} className="grid grid-cols-[20%_15%_12%_12%_18%_10%_13%] items-center py-4 px-2 hover:bg-white/5 transition-all">
            <div>
              <p className="font-bold text-white text-sm">{agent.first_name} {agent.last_name}</p>
              <p className="text-[10px] text-blue-200/30 uppercase font-black tracking-tighter">Officer ID: #{agent.agent_id}</p>
            </div>
            <div>
              <p className="text-xs text-white font-bold">{agent.country_name || 'Global'}</p>
              <p className="text-[9px] text-blue-200/40 uppercase font-black">{agent.experience_years} Years Exp.</p>
            </div>
            <div className="text-center">
              <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${agent.is_active ? 'text-green-400 border-green-500/20 bg-green-500/5' : 'text-white/20 border-white/10 bg-white/5'}`}>
                {agent.is_active ? 'Active' : 'Offline'}
              </span>
            </div>
            <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                   <span className="text-xs font-bold text-yellow-400">{Number(agent.rating || 0).toFixed(1)}</span>
                   <span className="text-[9px] text-white/20">/ 5.0</span>
                </div>
            </div>
            <div>
               <div className="flex gap-4">
                  <div>
                     <p className="text-[8px] text-blue-200/30 uppercase font-black text-green-400">✓ {agent.approved_count || 0}</p>
                  </div>
                  <div>
                     <p className="text-[8px] text-blue-200/30 uppercase font-black text-red-400">✗ {agent.rejected_count || 0}</p>
                  </div>
               </div>
            </div>
            <div className="text-center">
               <span className="text-[10px] font-black text-white px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                  {agent.active_apps || 0} Apps
               </span>
            </div>
            <div className="text-right">
              <button 
                onClick={() => onRate({ agent_id: agent.agent_id, name: `${agent.first_name} ${agent.last_name}` })}
                className="text-[9px] font-black text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-lg hover:bg-yellow-500 hover:text-yellow-950 transition-all uppercase tracking-widest"
              >
                Rate Agent
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const OverviewView = ({ stats, pendingRequests, onApprove, onReject, processingId }) => (
  <div className="space-y-8">
    <div className="grid grid-cols-4 gap-4">
      <StatCard title="Total Apps" value={stats.total_applications} icon={<FileText />} color="blue" />
      <StatCard title="Approved" value={stats.total_approved} icon={<CheckCircle />} color="green" />
      <StatCard title="Active Agents" value={stats.total_agents} icon={<Award />} color="yellow" />
      <StatCard title="Applicants" value={stats.total_applicants} icon={<Users />} color="purple" />
    </div>

    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-8 space-y-6">
         {/* Pending Account Requests */}
         {pendingRequests.length > 0 && (
           <div className="glass-card border-blue-500/30 bg-blue-500/5">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <UserCheck size={14} className="text-blue-400" /> Account Approvals Needed
                </h3>
                <span className="text-[10px] font-black bg-blue-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                  {pendingRequests.length} URGENT
                </span>
              </div>
              
              <div className="space-y-4">
                {pendingRequests.map(req => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={req.reg_id} 
                    className="p-5 bg-blue-950/40 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-blue-500/30 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-black text-xl">
                        {req.first_name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-white text-base">
                          {req.first_name} {req.last_name} 
                          <span className="ml-2 text-[10px] font-black uppercase px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/20">
                            {req.role}
                          </span>
                        </p>
                        <p className="text-xs text-blue-200/40 mt-1">{req.email} • {req.username}</p>
                        <p className="text-[8px] text-blue-400/30 font-black uppercase mt-2 tracking-widest">
                          Request Date: {new Date(req.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => onReject(req.reg_id)}
                        disabled={processingId === req.reg_id}
                        className="px-4 py-2 text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button 
                        onClick={() => onApprove(req.reg_id)}
                        disabled={processingId === req.reg_id}
                        className="px-6 py-2 text-[9px] font-black uppercase tracking-widest bg-green-500 text-green-950 rounded-xl hover:bg-green-400 hover:scale-105 transition-all shadow-lg shadow-green-500/20 disabled:opacity-50 flex items-center gap-2"
                      >
                        {processingId === req.reg_id ? <Loader2 className="animate-spin" size={12} /> : <UserCheck size={12} />}
                        Approve Access
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
           </div>
         )}

         <NotificationBox limit={10} />
      </div>
      
      <div className="col-span-4 space-y-6">
        <div className="glass-card">
           <h3 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2">
             <Activity size={16} className="text-blue-400" /> Quick Insights
           </h3>
           <div className="space-y-4">
              <div className="p-5 bg-[#0f172a]/50 border border-white/10 rounded-3xl group hover:border-blue-500/30 transition-all shadow-xl relative overflow-hidden">
                 <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 group-hover:scale-110">
                    <Clock size={80} />
                 </div>
                 <p className="text-[8px] font-black text-blue-400 uppercase tracking-[0.25em] mb-2">Processing Speed</p>
                 <div className="flex items-center justify-between relative z-10">
                    <p className="text-2xl font-black text-white italic tracking-tighter drop-shadow-lg">4.2 Days</p>
                    <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 shadow-lg shadow-blue-500/10">
                       <Clock size={16} />
                    </div>
                 </div>
                 <p className="text-[8px] text-blue-200/20 uppercase font-black mt-3 tracking-widest">Average decision time</p>
                 <div className="h-1 w-8 bg-blue-500 rounded-full mt-4 group-hover:w-full transition-all duration-700 ease-out opacity-40" />
              </div>

              <div className="p-5 bg-[#0f172a]/50 border border-white/10 rounded-3xl group hover:border-green-500/30 transition-all shadow-xl relative overflow-hidden">
                 <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 group-hover:scale-110">
                    <Activity size={80} />
                 </div>
                 <p className="text-[8px] font-black text-green-400 uppercase tracking-[0.25em] mb-2">System Health</p>
                 <div className="flex items-center justify-between relative z-10">
                    <p className="text-2xl font-black text-white italic tracking-tighter drop-shadow-lg">Optimal</p>
                    <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 shadow-lg shadow-green-500/10">
                       <Activity size={16} />
                    </div>
                 </div>
                 <p className="text-[8px] text-blue-200/20 uppercase font-black mt-3 tracking-widest">All services online</p>
                 <div className="h-1 w-8 bg-green-500 rounded-full mt-4 group-hover:w-full transition-all duration-700 ease-out opacity-40" />
              </div>
           </div>
        </div>
      </div>
    </div>
  </div>
);

const GlobalFeedView = ({ data }) => (
  <div className="glass-card">
    <h2 className="text-sm font-black uppercase tracking-widest mb-6 border-b border-white/5 pb-4 flex items-center gap-2">
       <TrendingUp size={16} className="text-blue-400" /> Global Application Feed
    </h2>
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[9px] uppercase text-blue-200/40 font-black tracking-widest border-b border-white/5">
            <th className="pb-4 w-[30%]">Applicant</th>
            <th className="pb-4 w-[25%]">Visa / Country</th>
            <th className="pb-4 w-[25%]">Agent</th>
            <th className="pb-4 w-[20%] text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.map((app, i) => (
            <tr key={i} className="hover:bg-white/5 transition-all group">
              <td className="py-4">
                <p className="font-bold text-white text-sm">{app.app_first} {app.app_last}</p>
                <p className="text-[10px] text-blue-200/30">ID: #{app.application_id}</p>
              </td>
              <td className="py-4">
                <p className="text-xs text-white font-bold">{app.visa_name}</p>
                <p className="text-[9px] text-blue-400 uppercase font-black">{app.country_name}</p>
              </td>
              <td className="py-4">
                 <p className="text-xs text-blue-200/60 font-bold">{app.agent_first || 'Self'} {app.agent_last || ''}</p>
              </td>
              <td className="py-4 text-right">
                 <StatusBadge status={app.status_id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const ApplicantsView = ({ data, onBlacklist }) => (
  <div className="glass-card">
    <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
      <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
         <Users size={16} className="text-purple-400" /> Registered Applicants
      </h2>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[9px] uppercase text-blue-200/40 font-black tracking-widest border-b border-white/5">
            <th className="pb-4 w-[20%]">Full Name</th>
            <th className="pb-4 w-[20%]">Contact Info</th>
            <th className="pb-4 w-[15%]">Passport / CNIC</th>
            <th className="pb-4 w-[15%] text-center">Applications</th>
            <th className="pb-4 w-[15%] text-center">Status</th>
            <th className="pb-4 w-[15%] text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.map((app, i) => (
            <tr key={i} className="hover:bg-white/5 transition-all">
              <td className="py-4">
                <p className="font-bold text-white text-sm">{app.first_name} {app.last_name}</p>
                <p className="text-[10px] text-blue-200/30 uppercase font-black tracking-tighter">@{app.username}</p>
              </td>
              <td className="py-4">
                <p className="text-xs text-white">{app.email}</p>
                <p className="text-[10px] text-blue-200/40">{app.phone || 'No Phone'}</p>
              </td>
              <td className="py-4">
                <p className="text-xs text-blue-200/80 font-bold">{app.passport_no}</p>
                <p className="text-[9px] text-blue-200/30 uppercase font-black">{app.cnic}</p>
              </td>
              <td className="py-4 text-center">
                 <span className="text-xs font-black text-blue-400 px-3 py-1 bg-blue-500/10 border border-blue-500/10 rounded-lg">
                    {app.total_apps || 0} Apps
                 </span>
              </td>
              <td className="py-4 text-center">
                 <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${app.is_active ? 'text-green-400 border-green-500/20 bg-green-500/5' : 'text-white/20 border-white/10 bg-white/5'}`}>
                   {app.is_active ? 'Active' : 'Offline'}
                 </span>
              </td>
              <td className="py-4 text-right">
                <button 
                  onClick={() => onBlacklist(app)}
                  className="text-[8px] font-black uppercase tracking-widest px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                >
                  Block User
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const BlacklistedView = ({ data, onUnblock }) => (
  <div className="glass-card">
    <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
      <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-red-400">
         <ShieldAlert size={16} /> Restricted Accounts
      </h2>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[9px] uppercase text-blue-200/40 font-black tracking-widest border-b border-white/5">
            <th className="pb-4 w-[25%]">User Details</th>
            <th className="pb-4 w-[20%]">Blacklist Type</th>
            <th className="pb-4 w-[25%]">Reason</th>
            <th className="pb-4 w-[15%]">Date Blocked</th>
            <th className="pb-4 w-[15%] text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-white/5 transition-all">
              <td className="py-4">
                <p className="font-bold text-white text-sm">{row.first_name} {row.last_name}</p>
                <p className="text-xs text-blue-200/40">{row.email}</p>
                <p className="text-[9px] text-blue-400 font-black uppercase mt-1">Blocked By Admin: {row.admin_name}</p>
              </td>
              <td className="py-4">
                <span className="text-[9px] font-black uppercase px-2 py-1 bg-white/5 border border-white/10 rounded text-blue-200/60">
                  {row.agent_id ? 'Agent Reported' : 'Manual Admin'}
                </span>
              </td>
              <td className="py-4">
                <p className="text-xs text-blue-200/60 leading-relaxed italic">"{row.reason}"</p>
              </td>
              <td className="py-4">
                <p className="text-xs text-blue-200/30">{new Date(row.created_at).toLocaleDateString()}</p>
              </td>
              <td className="py-4 text-right">
                <button 
                  onClick={() => onUnblock(row.blacklist_id)}
                  className="text-[8px] font-black uppercase tracking-widest px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-xl hover:bg-green-500 hover:text-green-950 transition-all"
                >
                  Unblock Account
                </button>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan="5" className="py-20 text-center opacity-20">
                <ShieldAlert size={48} className="mx-auto mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">No blacklisted accounts found</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);



const ReportsView = ({ data, agents }) => (
  <div className="space-y-8">
    {/* Agent Performance Analytics Section */}
    <div>
      <h2 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
         <Award size={16} className="text-yellow-400" /> Agent Performance Analytics
      </h2>
      <div className="grid grid-cols-4 gap-6">
        {agents.map((agent) => (
          <AgentPerformanceCard key={agent.agent_id} agent={agent} />
        ))}
      </div>
    </div>

    {/* Table View */}
    <div className="glass-card">
      <h2 className="text-sm font-black uppercase tracking-widest mb-6 border-b border-white/5 pb-4 flex items-center gap-2">
         <FileText size={16} className="text-blue-400" /> Full History Log
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[9px] uppercase text-blue-200/40 font-black tracking-widest border-b border-white/5">
              <th className="pb-4">Applicant</th>
              <th className="pb-4">Visa Details</th>
              <th className="pb-4">Agent Assigned</th>
              <th className="pb-4">Completion Date</th>
              <th className="pb-4 text-right">Final Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-white/5 transition-all">
                <td className="py-4">
                  <p className="font-bold text-white text-sm">{row.app_first} {row.app_last}</p>
                  <p className="text-[10px] text-blue-200/30 font-black uppercase">Ref: {row.application_id}</p>
                </td>
                <td className="py-4">
                  <p className="text-xs text-white font-bold">{row.visa_name}</p>
                  <p className="text-[9px] text-blue-200/40 uppercase font-black">{row.country_name}</p>
                </td>
                <td className="py-4">
                  <p className="text-xs text-blue-200/60 font-bold">{row.agent_first} {row.agent_last}</p>
                </td>
                <td className="py-4">
                  <p className="text-xs text-blue-200/50">{new Date(row.recorded_at).toLocaleDateString()}</p>
                </td>
                <td className="py-4 text-right">
                  <StatusBadge status={row.final_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const AgentPerformanceCard = ({ agent }) => {
  const chartData = [
    { name: 'Approved', value: agent.approved_count || 0, color: '#4ade80' },
    { name: 'Rejected', value: agent.rejected_count || 0, color: '#f87171' }
  ];

  const total = (agent.approved_count || 0) + (agent.rejected_count || 0);

  return (
    <div className="glass-card text-center p-6 flex flex-col items-center group hover:scale-105 transition-all">
      <h3 className="text-xs font-black uppercase tracking-widest text-white mb-2">{agent.first_name} {agent.last_name}</h3>
      
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl font-black text-blue-400">{Number(agent.rating || 0).toFixed(1)}</span>
        <div className="text-[8px] text-blue-200/30 font-black uppercase text-left leading-none">
          <p>Global</p>
          <p>Rating</p>
        </div>
      </div>

      <div className="w-full h-32 relative">
        {total > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                innerRadius={30}
                outerRadius={45}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip 
                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', fontSize: '10px' }}
                itemStyle={{ color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-white/5 rounded-full">
            <span className="text-[8px] font-black uppercase text-white/10">No Data</span>
          </div>
        )}
        
        {total > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-xs font-black text-white">{total}</p>
            <p className="text-[7px] font-black text-blue-200/30 uppercase">Total</p>
          </div>
        )}
      </div>

      <div className="flex gap-4 mt-4">
        <div className="text-center">
          <p className="text-[7px] font-black text-green-400 uppercase">Appr</p>
          <p className="text-xs font-bold text-white">{agent.approved_count || 0}</p>
        </div>
        <div className="text-center">
          <p className="text-[7px] font-black text-red-400 uppercase">Rej</p>
          <p className="text-xs font-bold text-white">{agent.rejected_count || 0}</p>
        </div>
      </div>
    </div>
  );
};

/* --- Utility Components --- */

const StatusBadge = ({ status }) => {
  const styles = {
    APPROVED: 'bg-green-500/10 text-green-400 border-green-500/20',
    REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
    WITHDRAWN: 'bg-white/5 text-white/40 border-white/10',
    PENDING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    IN_REVIEW: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
  };
  return (
    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${styles[status] || styles.PENDING}`}>
      {status}
    </span>
  );
};

export default AdminDashboard;
