import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle, Info, AlertTriangle, Clock, X, ShieldAlert, Shield } from 'lucide-react';

const NotificationBox = ({ limit = 5 }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      console.log('📡 Fetching notifications...');
      const res = await api.get('/notifications');
      console.log('📬 Received notifications:', res.data);
      setNotifications(res.data);
    } catch (err) {
      console.error('❌ Failed to fetch notifications:', err.response || err);
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.notification_id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case 'BLACKLIST_REQ':
      case 'BLOCK_REQUEST':
        return <ShieldAlert className="text-yellow-400" size={16} />;
      case 'WORK_REQUEST': return <Clock className="text-yellow-400" size={16} />;
      case 'WORK_APPROVED': return <CheckCircle className="text-green-400" size={16} />;

      case 'PAYMENT_DUE': return <AlertTriangle className="text-red-400" size={16} />;
      case 'APPROVED': 
      case 'APPLICATION_RESULT': return <CheckCircle className="text-green-400" size={16} />;
      case 'COMPLAINT': return <AlertTriangle className="text-red-500" size={16} />;
      default: return <Bell className="text-blue-200/50" size={16} />;
    }
  };

  if (loading) return (
    <div className="glass-card animate-pulse py-10 flex flex-col items-center">
       <Bell className="text-white/10 mb-2" size={24} />
       <p className="text-[10px] font-black uppercase text-white/10 tracking-widest">Checking Signals...</p>
    </div>
  );

  return (
    <div className="glass-card h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
        <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
           <Bell size={14} className="text-blue-400" /> Live Feed
        </h3>
        {notifications.filter(n => !n.is_read).length > 0 && (
           <span className="text-[8px] font-black bg-blue-500 text-white px-1.5 py-0.5 rounded-full animate-bounce">
              {notifications.filter(n => !n.is_read).length} NEW
           </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 pr-2 custom-scrollbar">
        <AnimatePresence initial={false}>
          {notifications.length > 0 ? (
            notifications.slice(0, limit).map((n) => (
              <motion.div
                key={n.notification_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-4 rounded-2xl border transition-all flex gap-4 group relative ${
                  n.is_read 
                    ? 'bg-white/5 border-white/10 opacity-60' 
                    : 'bg-white/10 border-blue-500/40 shadow-2xl shadow-black/50 backdrop-blur-md'
                }`}
              >
                <div className="mt-1">{getIcon(n.notification_type)}</div>
                <div className="flex-1">
                  <p className={`text-sm font-black uppercase tracking-tight ${n.is_read ? 'text-white/40' : 'text-white'}`}>
                    {n.title}
                  </p>
                  <div className={`text-xs mt-2 space-y-2`}>
                    {(() => {
                      if (n.notification_type === 'BLOCK_REQUEST' || n.notification_type === 'BLACKLIST_REQ') {
                        try {
                          const data = JSON.parse(n.message);
                          return (
                            <div className="space-y-3">
                              <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
                                <p className="text-[8px] font-black text-blue-200/30 uppercase mb-1">Target Applicant</p>
                                <p className="text-white font-bold">{data.applicant}</p>
                              </div>
                              <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20 shadow-inner">
                                <p className="text-[10px] font-black text-red-400 uppercase mb-2 tracking-widest flex items-center gap-2">
                                  <AlertTriangle size={12} /> Violation Reason
                                </p>
                                <p className="text-sm text-white font-medium italic leading-relaxed pl-2 border-l-2 border-red-500/30">
                                  "{data.reason}"
                                </p>
                              </div>
                            </div>
                          );
                        } catch (e) {
                          return <p className="whitespace-pre-line leading-relaxed opacity-70">{n.message}</p>;
                        }
                      }
                      return <p className="whitespace-pre-line leading-relaxed opacity-70">{n.message}</p>;
                    })()}
                  </div>
                  <p className="text-[8px] text-blue-400 font-black uppercase mt-3 tracking-widest">
                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button 
                  onClick={() => deleteNotification(n.notification_id)}
                  className="opacity-0 group-hover:opacity-100 absolute top-4 right-4 w-8 h-8 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center transition-all hover:bg-red-500 hover:text-white active:scale-90 z-10 border border-red-500/20"
                  title="Delete Notification"
                >
                  <X size={16} strokeWidth={3} />
                </button>
              </motion.div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
               <Bell size={32} className="mb-4" />
               <p className="text-[10px] font-black uppercase tracking-widest">No activity reported</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default NotificationBox;
