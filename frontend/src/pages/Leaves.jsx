import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { leaveAPI, authAPI } from '../services/api';
import { Plus, Eye, Calendar, Bell, User, History } from 'lucide-react';
import LeaveStatusIndicator from '../components/LeaveStatusIndicator';

const Leaves = () => {
  const { user, hasRole, hasMinLevel } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [userGender, setUserGender] = useState('');

  useEffect(() => {
    fetchUserProfile();
    fetchData();
  }, [statusFilter]);

  const fetchUserProfile = async () => {
    try {
      const response = await authAPI.getProfile();
      setUserGender(response.data.gender?.toLowerCase() || '');
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  };

  const getFilteredBalance = () => {
    if (!balance?.balance) return [];
    return balance.balance.filter(item => {
      const typeName = item.leaveTypeName?.toLowerCase() || '';
      if (userGender === 'male' && typeName.includes('maternity')) {
        return false;
      }
      if (userGender === 'female' && typeName.includes('paternity')) {
        return false;
      }
      return true;
    });
  };

  const fetchData = async () => {
    try {
      const [leavesRes, balanceRes] = await Promise.all([
        leaveAPI.getAll({ status: statusFilter }),
        leaveAPI.getBalance()
      ]);

      setLeaves(leavesRes.data);
      setBalance(balanceRes.data);
      
      // Calculate pending approvals for current user
      if (user?.role === 'Supervisor') {
        const pending = leavesRes.data.filter(l => 
          l.supervisor_status === 'Pending' && l.user_id !== user.id
        );
        setPendingCount(pending.length);
      } else if (user?.role === 'HOD') {
        // HOD sees Supervisor leaves that need first approval
        const pending = leavesRes.data.filter(l => 
          l.supervisor_status === 'Pending' && l.applicant_role === 'Supervisor'
        );
        setPendingCount(pending.length);
      } else if (user?.role === 'HR') {
        const pending = leavesRes.data.filter(l => 
          l.supervisor_status === 'Approved' && (l.hr_status === 'Pending' || l.hr_status === null)
        );
        setPendingCount(pending.length);
      } else if (user?.role === 'CEO') {
        const pending = leavesRes.data.filter(l => 
          l.status === 'Pending' && l.requires_ceo_approval
        );
        setPendingCount(pending.length);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      Pending: 'badge-warning',
      Approved: 'badge-success',
      Rejected: 'badge-danger',
      'Supervisor Approved': 'badge-info'
    };
    return badges[status] || 'badge-info';
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

  return (
    <Layout>
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Leave Management</h1>
            {pendingCount > 0 && hasMinLevel(5) && (
              <div className="relative">
                <Bell className="text-orange-500" size={24} />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingCount}
                </span>
              </div>
            )}
          </div>
          <p className="text-gray-600 mt-1">Manage leave requests and balances</p>
        </div>
        {user?.role !== 'CEO' && (
          <Link to="/leaves/new" className="btn-primary flex items-center whitespace-nowrap">
            <Plus className="mr-2" size={18} />
            Apply for Leave
          </Link>
        )}
      </div>

      {/* Leave Balance Cards */}
      {balance && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {getFilteredBalance().map((item, index) => {
            const gradients = [
              'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200',
              'bg-gradient-to-br from-green-50 to-green-100 border-green-200',
              'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200',
              'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200',
              'bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200',
              'bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200',
              'bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200',
              'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200'
            ];
            const gradient = gradients[index % gradients.length];
            const textColors = ['text-blue-700', 'text-green-700', 'text-purple-700', 'text-orange-700', 'text-pink-700', 'text-indigo-700', 'text-teal-700', 'text-yellow-700'];
            const iconColors = ['text-blue-500', 'text-green-500', 'text-purple-500', 'text-orange-500', 'text-pink-500', 'text-indigo-500', 'text-teal-500', 'text-yellow-500'];
            const textColor = textColors[index % textColors.length];
            const iconColor = iconColors[index % iconColors.length];
            
            return (
              <div key={item.leaveTypeId} className={`card ${gradient}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-sm font-semibold ${textColor}`}>{item.leaveTypeName}</h3>
                  <Calendar size={22} className={iconColor} />
                </div>
                <p className={`text-3xl font-bold ${textColor}`}>{item.daysRemaining}</p>
                <p className={`text-xs ${textColor} opacity-75 mt-1`}>
                  of {item.totalAllowed} days remaining
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* My Leave History */}
      {['HOD', 'HR', 'Supervisor', 'Staff'].includes(user?.role) && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
            <History className="mr-2" size={20} />
            My Leave History
          </h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {leaves.filter(l => l.user_id === user?.id).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No leave history found</p>
            ) : (
              leaves.filter(l => l.user_id === user?.id).map((leave) => (
                <div key={leave.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-800">{leave.leave_type_name}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">({leave.days_requested} days)</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    leave.status === 'Approved' ? 'bg-green-100 text-green-700' :
                    leave.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {leave.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="card mb-6">
        <div className="flex items-center space-x-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field"
          >
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <button
            onClick={() => setStatusFilter('')}
            className="btn-secondary"
          >
            Clear Filter
          </button>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Leave Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Days
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaves.map((leave) => {
                // Check if this leave needs current user's approval
                const isOwnLeave = leave.user_id === user?.id;
                const needsMyApproval = (
                  // Supervisor can approve staff leaves (not their own, not other supervisors)
                  (hasRole('Supervisor') && leave.supervisor_status === 'Pending' && !leave.requires_ceo_approval && 
                   !isOwnLeave && leave.applicant_role !== 'Supervisor') ||
                  // HOD can approve Supervisor leaves
                  (hasRole('HOD') && leave.supervisor_status === 'Pending' && leave.applicant_role === 'Supervisor' && !isOwnLeave) ||
                  (hasRole('CEO') && leave.requires_ceo_approval && (!leave.ceo_status || leave.ceo_status === 'Pending')) ||
                  (hasRole(['HR', 'Super Admin']) && leave.supervisor_status === 'Approved' && 
                   (!leave.hr_status || leave.hr_status === 'Pending') && !leave.requires_ceo_approval)
                );
                
                return (
                <tr key={leave.id} className={`hover:bg-gray-50 ${needsMyApproval ? 'bg-amber-50 border-l-4 border-l-amber-400' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {leave.first_name} {leave.last_name}
                    </div>
                    <div className="text-sm text-gray-500">{leave.employee_number}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="badge badge-info">{leave.leave_type_name}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{new Date(leave.start_date).toLocaleDateString()}</div>
                    <div>to {new Date(leave.end_date).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {leave.days_requested}
                  </td>
                  <td className="px-6 py-4">
                    <LeaveStatusIndicator 
                      status={leave.status}
                      supervisorStatus={leave.supervisor_status}
                      hrStatus={leave.hr_status}
                      ceoApproval={leave.requires_ceo_approval}
                      applicantRole={leave.applicant_role}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/leaves/${leave.id}`}
                      className="text-primary-600 hover:text-primary-900 inline-flex items-center"
                    >
                      <Eye size={18} className="mr-1" />
                      View
                    </Link>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>

          {leaves.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No leave requests found
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Leaves;
