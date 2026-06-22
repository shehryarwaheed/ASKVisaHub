import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ApplicantDashboard from './pages/ApplicantDashboard';
import NewApplication from './pages/NewApplication';
import AgentDashboard from './pages/AgentDashboard';
import AdminDashboard from './pages/AdminDashboard';


function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Applicant Routes */}
          <Route element={<ProtectedRoute allowedRoles={['applicant']} />}>
            <Route path="/applicant" element={<ApplicantDashboard />} />
            <Route path="/applicant/new" element={<NewApplication />} />
            <Route path="/applicant/history" element={<ApplicantDashboard />} />
            <Route path="/applicant/payments" element={<ApplicantDashboard />} />
          </Route>

          {/* Agent Routes */}
          <Route element={<ProtectedRoute allowedRoles={['agent']} />}>
            <Route path="/agent" element={<AgentDashboard />} />
            <Route path="/agent/requests" element={<AgentDashboard />} />
            <Route path="/agent/active" element={<AgentDashboard />} />
            <Route path="/agent/history" element={<AgentDashboard />} />
            <Route path="/agent/profile" element={<AgentDashboard />} />
          </Route>

          {/* Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/feed" element={<AdminDashboard />} />
            <Route path="/admin/applicants" element={<AdminDashboard />} />
            <Route path="/admin/agents" element={<AdminDashboard />} />
            <Route path="/admin/blacklisted" element={<AdminDashboard />} />
            <Route path="/admin/complaints" element={<AdminDashboard />} />
            <Route path="/admin/reports" element={<AdminDashboard />} />
          </Route>

          {/* Fallback */}
          <Route path="/unauthorized" element={<div className="min-h-screen flex items-center justify-center text-white">Unauthorized Access</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
