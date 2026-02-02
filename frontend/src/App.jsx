import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Users = lazy(() => import('./pages/Users'));
const UserForm = lazy(() => import('./pages/UserForm'));
const MyTeam = lazy(() => import('./pages/MyTeam'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Leaves = lazy(() => import('./pages/Leaves'));
const LeaveForm = lazy(() => import('./pages/LeaveForm'));
const LeaveEdit = lazy(() => import('./pages/LeaveEdit'));
const LeaveDetails = lazy(() => import('./pages/LeaveDetails'));
const Appraisals = lazy(() => import('./pages/Appraisals'));
const AppraisalForm = lazy(() => import('./pages/AppraisalForm'));
const AppraisalDetails = lazy(() => import('./pages/AppraisalDetails'));
const PerformanceAppraisals = lazy(() => import('./pages/PerformanceAppraisals'));
const PerformanceAppraisalForm = lazy(() => import('./pages/PerformanceAppraisalForm'));
const PerformanceAppraisalDetails = lazy(() => import('./pages/PerformanceAppraisalDetails'));
const Departments = lazy(() => import('./pages/Departments'));
const Settings = lazy(() => import('./pages/Settings'));

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
  </div>
);

function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
              <Route path="/login" element={<Login />} />
              
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              
              <Route path="/users" element={<ProtectedRoute minLevel={4}><Users /></ProtectedRoute>} />
              <Route path="/users/new" element={<ProtectedRoute minLevel={4}><UserForm /></ProtectedRoute>} />
              <Route path="/users/:id/edit" element={<ProtectedRoute minLevel={4}><UserForm /></ProtectedRoute>} />
              
              <Route path="/my-team" element={<ProtectedRoute minLevel={5}><MyTeam /></ProtectedRoute>} />
              <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
              
              <Route path="/leaves" element={<ProtectedRoute><Leaves /></ProtectedRoute>} />
              <Route path="/leaves/new" element={<ProtectedRoute><LeaveForm /></ProtectedRoute>} />
              <Route path="/leaves/:id/edit" element={<ProtectedRoute><LeaveEdit /></ProtectedRoute>} />
              <Route path="/leaves/:id" element={<ProtectedRoute><LeaveDetails /></ProtectedRoute>} />
              
              <Route path="/appraisals" element={<ProtectedRoute><Appraisals /></ProtectedRoute>} />
              <Route path="/appraisals/new" element={<ProtectedRoute minLevel={5}><AppraisalForm /></ProtectedRoute>} />
              <Route path="/appraisals/:id" element={<ProtectedRoute><AppraisalDetails /></ProtectedRoute>} />
              <Route path="/appraisals/:id/edit" element={<ProtectedRoute minLevel={5}><AppraisalForm /></ProtectedRoute>} />
              
              <Route path="/performance-appraisals" element={<ProtectedRoute><PerformanceAppraisals /></ProtectedRoute>} />
              <Route path="/performance-appraisals/new" element={<ProtectedRoute roles={['Supervisor', 'HOD', 'HR', 'CEO', 'Super Admin']}><PerformanceAppraisalForm /></ProtectedRoute>} />
              <Route path="/performance-appraisals/:id" element={<ProtectedRoute><PerformanceAppraisalDetails /></ProtectedRoute>} />
              <Route path="/performance-appraisals/:id/edit" element={<ProtectedRoute roles={['Supervisor', 'HOD', 'HR', 'CEO', 'Super Admin']}><PerformanceAppraisalForm /></ProtectedRoute>} />
              
              <Route path="/departments" element={<ProtectedRoute minLevel={4}><Departments /></ProtectedRoute>} />
              
              <Route path="/settings" element={<ProtectedRoute minLevel={2}><Settings /></ProtectedRoute>} />
              
              <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}

export default App;
