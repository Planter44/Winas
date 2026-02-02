import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { leaveAPI, messageAPI } from '../services/api';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Award,
  Building2,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  ChevronDown,
  Mail
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout, hasMinLevel } = useAuth();
  const { getSetting, settings } = useSettings();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  
  const companyName = getSetting('company_name', 'Winas Sacco');
  const sidebarBgColor = getSetting('sidebar_bg_color', '#ffffff');
  const headerBgColor = getSetting('header_bg_color', '#ffffff');
  const pageBgColor = getSetting('page_bg_color', '#f3f4f6');
  const primaryColor = getSetting('primary_color', '#2563eb');

  useEffect(() => {
    if (user && hasMinLevel(5)) {
      fetchPendingLeaves();
    }
    if (user && user.role !== 'Super Admin') {
      fetchUnreadMessages();
    }
  }, [user, location.pathname]);

  const fetchPendingLeaves = async () => {
    try {
      const response = await leaveAPI.getAll({});
      const leaves = response.data;
      
      let pending = 0;
      if (user?.role === 'Supervisor') {
        // Supervisors see leaves assigned to them (not their own)
        pending = leaves.filter(l => 
          l.supervisor_status === 'Pending' && l.user_id !== user.id
        ).length;
      } else if (user?.role === 'HOD') {
        // HOD sees Supervisor leaves in their department that need first approval
        pending = leaves.filter(l => 
          l.supervisor_status === 'Pending' && l.applicant_role === 'Supervisor'
        ).length;
      } else if (user?.role === 'HR') {
        pending = leaves.filter(l => l.supervisor_status === 'Approved' && (l.hr_status === 'Pending' || l.hr_status === null)).length;
      } else if (user?.role === 'CEO') {
        pending = leaves.filter(l => l.status === 'Pending' && l.requires_ceo_approval).length;
      }
      
      setPendingLeaveCount(pending);
    } catch (error) {
      console.error('Failed to fetch pending leaves:', error);
    }
  };

  const fetchUnreadMessages = async () => {
    try {
      const response = await messageAPI.getUnreadCount();
      setUnreadMessageCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch unread messages:', error);
    }
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, show: true },
    { name: 'Users', href: '/users', icon: Users, show: ['Super Admin', 'CEO', 'HR'].includes(user?.role) },
    { name: 'My Team', href: '/my-team', icon: Users, show: ['HOD', 'Supervisor', 'HR', 'CEO'].includes(user?.role) },
    { name: 'Leave Management', href: '/leaves', icon: Calendar, show: true, badge: pendingLeaveCount },
    { name: 'Performance Appraisals', href: '/performance-appraisals', icon: Award, show: true },
    { name: 'Departments', href: '/departments', icon: Building2, show: ['Super Admin', 'CEO', 'HR'].includes(user?.role) },
    { name: 'Inbox', href: '/inbox', icon: Mail, show: user?.role !== 'Super Admin', badge: unreadMessageCount },
    { name: 'Settings', href: '/settings', icon: Settings, show: hasMinLevel(2) }
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen" style={{ backgroundColor: pageBgColor }}>
      <div className="md:hidden fixed top-0 left-0 right-0 border-b border-gray-200 z-50" style={{ backgroundColor: headerBgColor }}>
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-primary-600">{companyName}</h1>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 relative"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            {pendingLeaveCount > 0 && !sidebarOpen && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {pendingLeaveCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-40 border-r border-gray-200 transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
        style={{ backgroundColor: sidebarBgColor, width: 'var(--sidebar-width)' }}
      >
        <div className="flex flex-col h-full">
          <Link to="/dashboard" className="flex items-center justify-center h-16 border-b border-gray-200 hover:bg-gray-50 transition-colors">
            <h1 className="text-2xl font-bold text-primary-600">{companyName}</h1>
          </Link>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map(
              (item) =>
                item.show && (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors relative ${
                      isActive(item.href)
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                    {item.badge > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
            )}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="mt-3 w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="md:pl-[var(--sidebar-width)]">
        <header className="border-b border-gray-200 sticky top-0 z-20 px-4 py-3" style={{ backgroundColor: headerBgColor }}>
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              <Building2 size={28} className="text-primary-600" />
              <h2 className="text-lg font-bold text-gray-900">{companyName}</h2>
            </Link>

            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <User size={20} className="text-gray-600" />
                <span className="text-sm font-medium text-gray-700 hidden md:block">
                  {user?.firstName}
                </span>
                <ChevronDown size={16} className="text-gray-600" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                  <Link
                    to="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    My Profile
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-4 md:p-8 mt-16 md:mt-0">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
