import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { leaveAPI } from '../services/api';
import { ArrowLeft, CheckCircle, XCircle, Clock, User, Calendar, FileText, Edit, Trash2 } from 'lucide-react';

const LeaveDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  
  const [leave, setLeave] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionData, setActionData] = useState({ action: '', comment: '' });
  const [showActionModal, setShowActionModal] = useState(false);

  useEffect(() => {
    fetchLeave();
  }, [id]);

  const fetchLeave = async () => {
    try {
      const response = await leaveAPI.getById(id);
      setLeave(response.data);
    } catch (error) {
      console.error('Failed to fetch leave:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action) => {
    setActionData({ action, comment: '' });
    setShowActionModal(true);
  };

  const submitAction = async () => {
    setActionLoading(true);

    try {
      // HOD approves Supervisor leaves using the supervisor action endpoint
      if (hasRole('Supervisor') || hasRole('HOD')) {
        await leaveAPI.supervisorAction(id, {
          action: actionData.action,
          comment: actionData.comment
        });
      } else if (hasRole('CEO')) {
        await leaveAPI.ceoAction(id, {
          action: actionData.action,
          comment: actionData.comment
        });
      } else if (hasRole(['HR', 'Super Admin'])) {
        await leaveAPI.hrAction(id, {
          action: actionData.action,
          comment: actionData.comment
        });
      }

      setShowActionModal(false);
      alert(`Leave request ${actionData.action.toLowerCase()} successfully!`);
      fetchLeave();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to process action');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteLeave = async () => {
    if (!confirm('Are you sure you want to cancel this leave request?')) return;
    
    try {
      await leaveAPI.cancel(id);
      alert('Leave request cancelled successfully');
      navigate('/leaves');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to cancel leave request');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      Pending: { class: 'badge-warning', icon: Clock },
      Approved: { class: 'badge-success', icon: CheckCircle },
      Rejected: { class: 'badge-danger', icon: XCircle }
    };
    return badges[status] || { class: 'badge-info', icon: Clock };
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

  if (!leave) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600">Leave request not found</p>
        </div>
      </Layout>
    );
  }

  const StatusBadge = getStatusBadge(leave.status);
  const isOwnLeave = user?.id === leave.user_id;
  
  // Supervisors cannot approve their own leave - it goes to HOD then HR
  // HOD can act as supervisor for Supervisor leaves
  const canSupervisorAct = hasRole('Supervisor') && leave.supervisor_status === 'Pending' && !isOwnLeave;
  const canHODAct = hasRole('HOD') && leave.supervisor_status === 'Pending' && 
                    leave.applicant_role === 'Supervisor' && !isOwnLeave;
  const canCEOAct = hasRole('CEO') && leave.requires_ceo_approval && 
                    (!leave.ceo_status || leave.ceo_status === 'Pending');
  const canHRAct = hasRole(['HR', 'Super Admin']) && leave.supervisor_status === 'Approved' && 
                    (!leave.hr_status || leave.hr_status === 'Pending') && !leave.requires_ceo_approval;
  
  // User can delete own leave before it reaches the approver:
  // - Staff/Supervisor: before supervisor acts
  // - HR/HOD: before CEO acts
  const canDeleteOwnLeave = isOwnLeave && (
    (leave.requires_ceo_approval && leave.status === 'Pending') ||
    (!leave.requires_ceo_approval && leave.supervisor_status === 'Pending')
  );
  
  // User can edit own leave only if still pending at first level
  const canEditOwnLeave = isOwnLeave && leave.status === 'Pending' && (
    (leave.requires_ceo_approval) ||
    (!leave.requires_ceo_approval && leave.supervisor_status === 'Pending')
  );
  
  // CEO and HR can edit any leave (even approved ones)
  const canCEOOrHREdit = hasRole(['CEO', 'HR', 'Super Admin']);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate('/leaves')} className="mr-4 text-gray-600 hover:text-gray-900">
              <ArrowLeft size={24} />
            </button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Leave Request Details</h1>
              <p className="text-gray-600">Request ID: #{leave.id}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <span className={`badge ${StatusBadge.class} flex items-center text-base self-start sm:self-auto`}>
              <StatusBadge.icon className="mr-1" size={18} />
              {leave.status}
            </span>
            {canEditOwnLeave && (
              <button
                onClick={() => navigate(`/leaves/${leave.id}/edit`)}
                className="btn-secondary flex items-center justify-center text-sm py-1 px-3 w-full sm:w-auto"
              >
                <Edit size={16} className="mr-1" />
                Edit
              </button>
            )}
            {canDeleteOwnLeave && (
              <button
                onClick={handleDeleteLeave}
                className="btn-danger flex items-center justify-center text-sm py-1 px-3 w-full sm:w-auto"
              >
                <Trash2 size={16} className="mr-1" />
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Information</h3>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <User className="mr-3 text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Employee</p>
                    <p className="text-gray-900">
                      {leave.first_name} {leave.last_name} ({leave.employee_number})
                    </p>
                    <p className="text-sm text-gray-500">{leave.job_title}</p>
                    <p className="text-sm text-gray-500">{leave.department_name}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <FileText className="mr-3 text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Leave Type</p>
                    <p className="text-gray-900">{leave.leave_type_name}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Calendar className="mr-3 text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Duration</p>
                    <p className="text-gray-900">
                      {new Date(leave.start_date).toLocaleDateString()} to{' '}
                      {new Date(leave.end_date).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-500">{leave.days_requested} day(s)</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Reason</p>
                  <p className="text-gray-900 whitespace-pre-wrap">{leave.reason}</p>
                </div>

                {leave.document_url && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Supporting Document</p>
                    <a
                      href={leave.document_url.startsWith('/') ? `${apiBaseUrl}${leave.document_url}` : leave.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700 underline"
                    >
                      View Document
                    </a>
                  </div>
                )}
              </div>
            </div>

            {leave.supervisor_status && leave.supervisor_status !== 'Pending' && (
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Supervisor Review</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Reviewer</span>
                    <span className="text-gray-900">
                      {leave.supervisor_first_name} {leave.supervisor_last_name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Decision</span>
                    <span className={`badge ${leave.supervisor_status === 'Approved' ? 'badge-success' : 'badge-danger'}`}>
                      {leave.supervisor_status}
                    </span>
                  </div>
                  {leave.supervisor_comment && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Comment</p>
                      <p className="text-gray-900">{leave.supervisor_comment}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">
                      {new Date(leave.supervisor_action_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {leave.hr_status && leave.hr_status !== 'Pending' && (
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">HR Review</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Reviewer</span>
                    <span className="text-gray-900">
                      {leave.hr_first_name} {leave.hr_last_name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Decision</span>
                    <span className={`badge ${leave.hr_status === 'Approved' ? 'badge-success' : 'badge-danger'}`}>
                      {leave.hr_status}
                    </span>
                  </div>
                  {leave.hr_comment && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Comment</p>
                      <p className="text-gray-900">{leave.hr_comment}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">
                      {new Date(leave.hr_action_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Standard action for pending approvals */}
            {(canSupervisorAct || canHODAct || canHRAct || canCEOAct) && (
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Take Action</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => handleAction('Approved')}
                    className="w-full btn-primary flex items-center justify-center"
                  >
                    <CheckCircle className="mr-2" size={18} />
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction('Rejected')}
                    className="w-full btn-danger flex items-center justify-center"
                  >
                    <XCircle className="mr-2" size={18} />
                    Reject
                  </button>
                </div>
              </div>
            )}
            
            {/* CEO/HR can change decision even after approval/rejection */}
            {canCEOOrHREdit && !canSupervisorAct && !canHRAct && !canCEOAct && (leave.status === 'Approved' || leave.status === 'Rejected') && (
              <div className="card border-orange-200 bg-orange-50">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Change Decision</h3>
                <p className="text-sm text-gray-600 mb-4">Override the current decision on this leave request.</p>
                <div className="space-y-3">
                  {leave.status !== 'Approved' && (
                    <button
                      onClick={() => handleAction('Approved')}
                      className="w-full btn-primary flex items-center justify-center"
                    >
                      <CheckCircle className="mr-2" size={18} />
                      Change to Approved
                    </button>
                  )}
                  {leave.status !== 'Rejected' && (
                    <button
                      onClick={() => handleAction('Rejected')}
                      className="w-full btn-danger flex items-center justify-center"
                    >
                      <XCircle className="mr-2" size={18} />
                      Change to Rejected
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="card bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Approval Timeline</h3>
              <div className="space-y-3">
                <div className="flex items-start">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    leave.status !== 'Pending' ? 'bg-green-500' : 'bg-gray-300'
                  }`}>
                    {leave.status !== 'Pending' ? (
                      <CheckCircle size={14} className="text-white" />
                    ) : (
                      <Clock size={14} className="text-white" />
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">Submitted</p>
                    <p className="text-xs text-gray-500">
                      {new Date(leave.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    leave.supervisor_status === 'Approved' ? 'bg-green-500' :
                    leave.supervisor_status === 'Rejected' ? 'bg-red-500' : 'bg-gray-300'
                  }`}>
                    {leave.supervisor_status === 'Approved' ? (
                      <CheckCircle size={14} className="text-white" />
                    ) : leave.supervisor_status === 'Rejected' ? (
                      <XCircle size={14} className="text-white" />
                    ) : (
                      <Clock size={14} className="text-white" />
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {leave.applicant_role === 'Supervisor' ? 'HOD Review' : 'Supervisor Review'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {leave.supervisor_status === 'Pending' ? 'Pending' :
                       leave.supervisor_action_at ? new Date(leave.supervisor_action_at).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    leave.hr_status === 'Approved' ? 'bg-green-500' :
                    leave.hr_status === 'Rejected' ? 'bg-red-500' : 'bg-gray-300'
                  }`}>
                    {leave.hr_status === 'Approved' ? (
                      <CheckCircle size={14} className="text-white" />
                    ) : leave.hr_status === 'Rejected' ? (
                      <XCircle size={14} className="text-white" />
                    ) : (
                      <Clock size={14} className="text-white" />
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">HR Review</p>
                    <p className="text-xs text-gray-500">
                      {!leave.hr_status || leave.hr_status === 'Pending' ? 'Pending' :
                       leave.hr_action_at ? new Date(leave.hr_action_at).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showActionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {actionData.action} Leave Request
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comment (optional)
              </label>
              <textarea
                value={actionData.comment}
                onChange={(e) => setActionData({ ...actionData, comment: e.target.value })}
                rows={4}
                className="input-field"
                placeholder="Add a comment..."
              />
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setShowActionModal(false)}
                className="flex-1 btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={submitAction}
                disabled={actionLoading}
                className={`flex-1 ${actionData.action === 'Approved' ? 'btn-primary' : 'btn-danger'} disabled:opacity-50`}
              >
                {actionLoading ? 'Processing...' : `Confirm ${actionData.action}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default LeaveDetails;
