import api from '../api/axios';
import { useEffect } from 'react';
import Sidebar from './Sidebar';

const DashboardLayout = ({ children, role }) => {
  useEffect(() => {
    // Heartbeat: Check account status every 15 seconds to enforce auto-logout
    const checkStatus = async () => {
      try {
        await api.get('/auth/me');
      } catch (err) {
        // Interceptor in axios.js will handle the logout if status is 401/403
      }
    };

    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden relative">
      <Sidebar role={role} />
      <main className="flex-1 p-8 pt-12 overflow-y-auto relative z-10 animate-fade-in">
        {children}
      </main>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none"></div>
    </div>
  );
};

export default DashboardLayout;

