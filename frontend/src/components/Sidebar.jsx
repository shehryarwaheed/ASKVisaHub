import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, FileText, History, 
  CreditCard, LogOut, User, Globe, ShieldAlert
} from 'lucide-react';

const Sidebar = ({ role }) => {
  const { logout, user } = useAuth();
  const location = useLocation();

  const links = {
    applicant: [
      { to: '/applicant', icon: <LayoutDashboard />, label: 'Overview' },
      { to: '/applicant/new', icon: <FileText />, label: 'New Application' },
      { to: '/applicant/history', icon: <History />, label: 'Past Applications' },
      { to: '/applicant/payments', icon: <CreditCard />, label: 'Payments' },
    ],
    agent: [
      { to: '/agent', icon: <LayoutDashboard />, label: 'Dashboard' },
      { to: '/agent/requests', icon: <User />, label: 'Work Requests' },
      { to: '/agent/active', icon: <FileText />, label: 'Active Visas' },
      { to: '/agent/history', icon: <History />, label: 'Completed' },
      { to: '/agent/profile', icon: <User />, label: 'Profile' },
    ],
    admin: [
      { to: '/admin', icon: <LayoutDashboard />, label: 'Overview' },
      { to: '/admin/feed', icon: <Globe />, label: 'Global Feed' },
      { to: '/admin/applicants', icon: <User />, label: 'Applicants' },
      { to: '/admin/agents', icon: <Globe />, label: 'Agents' },
      { to: '/admin/blacklisted', icon: <ShieldAlert />, label: 'Blacklisted' },
      { to: '/admin/reports', icon: <FileText />, label: 'Reports' },
    ]
  };

  return (
    <aside className="w-[240px] h-full glass border-r border-white/10 flex flex-col z-20">
      <div className="p-6 text-center">
        <h1 className="text-xl font-black tracking-widest text-white mb-1">ASKVisaHub</h1>
        <p className="text-[10px] text-blue-200/50 uppercase tracking-tighter font-bold">{role} Control</p>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
        {links[role]?.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end
            className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all group ${
              location.pathname === link.to 
                ? 'bg-blue-500 text-blue-950 shadow-lg' 
                : 'text-blue-200/50 hover:bg-white/5 hover:text-white'
            }`}
          >
            <div className={`${location.pathname === link.to ? 'text-blue-950' : 'text-blue-400 group-hover:scale-110'} transition-transform`}>
              {React.cloneElement(link.icon, { size: 16 })}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Identity Section */}
      <div className="px-4 mb-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-blue-950 font-black text-sm shadow-lg border border-white/20">
                 {user?.profile?.first_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase()}
              </div>
              <div className="overflow-hidden">
                 <p className="text-[9px] font-black text-blue-400 uppercase tracking-tighter mb-0.5">{role === 'agent' ? 'OFFICER' : role.toUpperCase()}</p>
                 <p className="text-[10px] font-black text-white uppercase truncate">
                    {user?.profile?.first_name ? `${user.profile.first_name} ${user.profile.last_name || ''}` : user?.username}
                 </p>
              </div>
           </div>
        </div>
      </div>

      {/* Logout */}
      <div className="px-4 pb-6">
        <button 
          onClick={logout}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all active:scale-95 group"
        >
          <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
