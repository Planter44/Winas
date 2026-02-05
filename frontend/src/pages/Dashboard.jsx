import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';
import {
  Users,
  Calendar,
  Award,
  Building2,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatDate = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return currentTime.toLocaleDateString('en-US', options);
  };

  const formatTime = () => {
    return currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const cardBackgrounds = useMemo(() => {
    const themes = [
      { from: '59, 130, 246', via: '96, 165, 250', to: '16, 185, 129', border: '59, 130, 246' },
      { from: '56, 189, 248', via: '14, 116, 144', to: '6, 182, 212', border: '14, 116, 144' },
      { from: '34, 197, 94', via: '16, 185, 129', to: '20, 184, 166', border: '16, 185, 129' },
      { from: '251, 146, 60', via: '245, 158, 11', to: '234, 179, 8', border: '245, 158, 11' },
      { from: '244, 114, 182', via: '236, 72, 153', to: '248, 113, 113', border: '236, 72, 153' },
      { from: '129, 140, 248', via: '99, 102, 241', to: '217, 70, 239', border: '99, 102, 241' },
      { from: '45, 212, 191', via: '6, 182, 212', to: '59, 130, 246', border: '6, 182, 212' },
      { from: '251, 113, 133', via: '244, 63, 94', to: '249, 115, 22', border: '244, 63, 94' }
    ];

    return themes
      .map((theme) => ({ theme, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ theme }) => ({
        className: 'dashboard-gradient-card',
        style: {
          '--dashboard-gradient-from': theme.from,
          '--dashboard-gradient-via': theme.via,
          '--dashboard-gradient-to': theme.to,
          '--dashboard-gradient-border': theme.border
        }
      }));
  }, []);

  const getCardBackground = (index) => cardBackgrounds[index % cardBackgrounds.length];
  const getCardProps = (index, extraClassName = '') => {
    const card = getCardBackground(index);
    return {
      className: ['card', card.className, extraClassName].filter(Boolean).join(' '),
      style: card.style
    };
  };

  const quickActionClass = 'flex items-center p-3 sm:p-4 border-2 border-primary-200 rounded-lg shadow-sm hover:border-primary-500 hover:bg-primary-50 hover:shadow-md transition-all';

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await dashboardAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  const renderStaffDashboard = () => (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
      <Link to="/leaves" {...getCardProps(0, 'hover:shadow-md transition-shadow')}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Pending Leaves</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.myLeaveStats?.pending || 0}
            </p>
          </div>
          <Clock className="text-yellow-500" size={32} />
        </div>
      </Link>

      <Link to="/leaves" {...getCardProps(1, 'hover:shadow-md transition-shadow')}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Approved Leaves</p>
            <p className="text-2xl font-bold text-green-600">
              {stats?.myLeaveStats?.approved || 0}
            </p>
          </div>
          <CheckCircle className="text-green-500" size={32} />
        </div>
      </Link>

      <Link to="/leaves" {...getCardProps(2, 'hover:shadow-md transition-shadow')}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Rejected Leaves</p>
            <p className="text-2xl font-bold text-red-600">
              {stats?.myLeaveStats?.rejected || 0}
            </p>
          </div>
          <XCircle className="text-red-500" size={32} />
        </div>
      </Link>

      <Link
        to="/performance-appraisals?scope=mine"
        {...getCardProps(3, 'hover:shadow-md transition-shadow')}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">My Appraisals</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.myPerformanceAppraisalsCount ?? stats?.myAppraisalsCount ?? 0}
            </p>
          </div>
          <Award className="text-primary-500" size={32} />
        </div>
      </Link>
    </div>
  );

  const renderSupervisorDashboard = () => (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
      <Link to="/leaves" {...getCardProps(0, 'hover:shadow-md transition-shadow')}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Pending Approvals</p>
            <p className="text-2xl font-bold text-yellow-600">
              {stats?.pendingLeaveApprovals || 0}
            </p>
          </div>
          <Clock className="text-yellow-500" size={32} />
        </div>
      </Link>

      <Link to="/my-team" {...getCardProps(1, 'hover:shadow-md transition-shadow')}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Team Size</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.teamSize || 0}
            </p>
          </div>
          <Users className="text-primary-500" size={32} />
        </div>
      </Link>

      <div {...getCardProps(2)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Departments</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.totalDepartments || 0}
            </p>
          </div>
          <Building2 className="text-primary-500" size={32} />
        </div>
      </div>
    </div>
  );

  const renderHODDashboard = () => (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
      <Link to="/my-team" {...getCardProps(0, 'hover:shadow-md transition-shadow')}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-indigo-700 mb-1 font-medium">Department Staff</p>
            <p className="text-3xl font-bold text-indigo-900">
              {stats?.departmentStaffCount || 0}
            </p>
          </div>
          <Users className="text-indigo-500" size={36} />
        </div>
      </Link>

      <Link to="/leaves" {...getCardProps(1, 'hover:shadow-md transition-shadow')}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-yellow-700 mb-1 font-medium">Pending Leaves</p>
            <p className="text-3xl font-bold text-yellow-900">
              {stats?.departmentPendingLeaves || 0}
            </p>
          </div>
          <Calendar className="text-yellow-500" size={36} />
        </div>
      </Link>

      <div {...getCardProps(2)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-pink-700 mb-1 font-medium">Total Departments</p>
            <p className="text-3xl font-bold text-pink-900">
              {stats?.totalDepartments || 0}
            </p>
          </div>
          <Building2 className="text-pink-500" size={36} />
        </div>
      </div>
    </div>
  );

  const renderHRDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <Link to="/users" {...getCardProps(0, 'hover:shadow-md transition-shadow')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
            </div>
            <Users className="text-primary-500" size={32} />
          </div>
        </Link>

        <Link to="/leaves" {...getCardProps(1, 'hover:shadow-md transition-shadow')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pending HR Approval</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats?.leaveStats?.pending_hr || 0}
              </p>
            </div>
            <Clock className="text-yellow-500" size={32} />
          </div>
        </Link>

        <Link to="/leaves" {...getCardProps(2, 'hover:shadow-md transition-shadow')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Approved Leaves</p>
              <p className="text-2xl font-bold text-green-600">
                {stats?.leaveStats?.approved || 0}
              </p>
            </div>
            <CheckCircle className="text-green-500" size={32} />
          </div>
        </Link>

        <Link to="/leaves" {...getCardProps(3, 'hover:shadow-md transition-shadow')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Rejected Leaves</p>
              <p className="text-2xl font-bold text-red-600">
                {stats?.leaveStats?.rejected || 0}
              </p>
            </div>
            <XCircle className="text-red-500" size={32} />
          </div>
        </Link>

        <Link
          to="/performance-appraisals?group=pending_review"
          {...getCardProps(4, 'hover:shadow-md transition-shadow')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Performance Pending Review</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats?.performanceAppraisalStats?.pending_review || 0}
              </p>
            </div>
            <Clock className="text-yellow-500" size={32} />
          </div>
        </Link>

        <Link
          to="/performance-appraisals?group=finalized"
          {...getCardProps(5, 'hover:shadow-md transition-shadow')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Performance Finalized</p>
              <p className="text-2xl font-bold text-green-600">
                {stats?.performanceAppraisalStats?.finalized || 0}
              </p>
            </div>
            <CheckCircle className="text-green-500" size={32} />
          </div>
        </Link>
      </div>
    </div>
  );

  const renderAdminDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <Link to="/users" {...getCardProps(0, 'hover:shadow-md transition-shadow')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 mb-1 font-medium">Total Users</p>
              <p className="text-3xl font-bold text-blue-900">{stats?.totalUsers || 0}</p>
            </div>
            <Users className="text-blue-500" size={36} />
          </div>
        </Link>

        <Link to="/departments" {...getCardProps(1, 'hover:shadow-md transition-shadow')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 mb-1 font-medium">Departments</p>
              <p className="text-3xl font-bold text-purple-900">{stats?.totalDepartments || 0}</p>
            </div>
            <Building2 className="text-purple-500" size={36} />
          </div>
        </Link>

        <Link to="/leaves" {...getCardProps(2, 'hover:shadow-md transition-shadow')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-rose-700 mb-1 font-medium">Total Leaves</p>
              <p className="text-3xl font-bold text-rose-900">
                {stats?.leaveStats?.total || 0}
              </p>
            </div>
            <Calendar className="text-rose-500" size={36} />
          </div>
        </Link>

        <Link to="/performance-appraisals" {...getCardProps(3, 'hover:shadow-md transition-shadow')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 mb-1 font-medium">Avg Performance</p>
              <p className="text-3xl font-bold text-green-900">
                {stats?.performanceAppraisalStats?.average_rating !== null &&
                stats?.performanceAppraisalStats?.average_rating !== undefined
                  ? parseFloat(stats.performanceAppraisalStats.average_rating).toFixed(2)
                  : 'N/A'}
              </p>
            </div>
            <TrendingUp className="text-green-500" size={36} />
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <Link
          to="/performance-appraisals?group=pending_review"
          {...getCardProps(4, 'hover:shadow-md transition-shadow')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700 mb-1 font-medium">Performance Pending Review</p>
              <p className="text-3xl font-bold text-yellow-900">
                {stats?.performanceAppraisalStats?.pending_review || 0}
              </p>
            </div>
            <Clock className="text-yellow-500" size={36} />
          </div>
        </Link>

        <Link
          to="/performance-appraisals?group=finalized"
          {...getCardProps(5, 'hover:shadow-md transition-shadow')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-700 mb-1 font-medium">Performance Finalized</p>
              <p className="text-3xl font-bold text-emerald-900">
                {stats?.performanceAppraisalStats?.finalized || 0}
              </p>
            </div>
            <CheckCircle className="text-emerald-500" size={36} />
          </div>
        </Link>
      </div>

      {stats?.departmentBreakdown && stats.departmentBreakdown.length > 0 && (
        <Link to="/departments" {...getCardProps(6, 'hover:shadow-md transition-shadow')}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Overview</h3>
          <div className="space-y-3">
            {stats.departmentBreakdown.map((dept) => (
              <div key={dept.name} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{dept.name}</span>
                <span className="text-sm text-gray-600">{dept.staff_count} staff</span>
              </div>
            ))}
          </div>
        </Link>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {getGreeting()}, {user?.firstName || user?.email}!
        </h1>
        <p className="text-gray-600 mb-2">Here's what's happening with your organization today.</p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-sm text-gray-500">
          <span className="font-medium">{formatTime()}</span>
          <span className="hidden sm:inline">•</span>
          <span>{formatDate()}</span>
        </div>
      </div>

      {user?.role === 'Staff' && renderStaffDashboard()}
      {user?.role === 'Supervisor' && renderSupervisorDashboard()}
      {user?.role === 'HOD' && renderHODDashboard()}
      {user?.role === 'HR' && renderHRDashboard()}
      {(user?.role === 'CEO' || user?.role === 'Super Admin') && renderAdminDashboard()}

      <div className="mt-8">
        <div {...getCardProps(7)}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {(user?.role === 'CEO' || user?.role === 'Super Admin') ? (
              <>
                <a
                  href="/leaves"
                  className={quickActionClass}
                >
                  <Calendar className="mr-2 sm:mr-3 text-primary-600 flex-shrink-0" size={22} />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">Pending Approvals</p>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">Review leave requests</p>
                  </div>
                </a>

                <a
                  href="/users"
                  className={quickActionClass}
                >
                  <Users className="mr-2 sm:mr-3 text-primary-600 flex-shrink-0" size={22} />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">Manage Users</p>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">View & edit staff</p>
                  </div>
                </a>

                <a
                  href="/departments"
                  className={quickActionClass}
                >
                  <Building2 className="mr-2 sm:mr-3 text-primary-600 flex-shrink-0" size={22} />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">Departments</p>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">Manage departments</p>
                  </div>
                </a>

                <a
                  href="/performance-appraisals?scope=mine"
                  className={quickActionClass}
                >
                  <Award className="mr-2 sm:mr-3 text-primary-600 flex-shrink-0" size={22} />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">Performance Appraisals</p>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">Performance reviews</p>
                  </div>
                </a>

                <a
                  href="/settings"
                  className={quickActionClass}
                >
                  <TrendingUp className="mr-2 sm:mr-3 text-primary-600 flex-shrink-0" size={22} />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">System Settings</p>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">Configure system</p>
                  </div>
                </a>
              </>
            ) : (
              <>
                <a
                  href="/leaves/new"
                  className={quickActionClass}
                >
                  <Calendar className="mr-2 sm:mr-3 text-primary-600 flex-shrink-0" size={22} />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">Apply for Leave</p>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">Submit a new leave request</p>
                  </div>
                </a>

                <a
                  href="/leaves"
                  className={quickActionClass}
                >
                  <Clock className="mr-2 sm:mr-3 text-primary-600 flex-shrink-0" size={22} />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">View Leave Status</p>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">Check your leave requests</p>
                  </div>
                </a>

                <a
                  href="/performance-appraisals"
                  className={quickActionClass}
                >
                  <Award className="mr-2 sm:mr-3 text-primary-600 flex-shrink-0" size={22} />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">My Appraisals</p>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">View performance reviews</p>
                  </div>
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
