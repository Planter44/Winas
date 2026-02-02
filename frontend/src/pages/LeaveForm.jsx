import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { leaveAPI, authAPI } from '../services/api';
import { Save, ArrowLeft, Calendar, Upload, X, FileText } from 'lucide-react';

const LeaveForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [documentFile, setDocumentFile] = useState(null);

  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState([]);
  const [userGender, setUserGender] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [daysRequested, setDaysRequested] = useState(0);

  useEffect(() => {
    fetchUserProfile();
    fetchLeaveTypes();
    fetchLeaveBalance();
  }, []);

  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      setDaysRequested(days > 0 ? days : 0);
    }
  }, [formData.startDate, formData.endDate]);

  const fetchUserProfile = async () => {
    try {
      const response = await authAPI.getProfile();
      setUserGender(response.data.gender?.toLowerCase() || '');
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const response = await leaveAPI.getTypes();
      setLeaveTypes(response.data);
    } catch (error) {
      console.error('Failed to fetch leave types:', error);
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      const response = await leaveAPI.getBalance();
      setLeaveBalance(response.data.balance || []);
    } catch (error) {
      console.error('Failed to fetch leave balance:', error);
    }
  };

  const getLeaveTypeBalance = (leaveTypeId) => {
    const balance = leaveBalance.find(b => b.leaveTypeId === parseInt(leaveTypeId));
    return balance ? balance.daysRemaining : null;
  };

  const getSelectedLeaveTypeBalance = () => {
    if (!formData.leaveTypeId) return null;
    return getLeaveTypeBalance(formData.leaveTypeId);
  };

  // Calculate the maximum allowed end date based on remaining leave days
  const getMaxEndDate = () => {
    if (!formData.startDate || !formData.leaveTypeId) return null;
    
    const remainingDays = getSelectedLeaveTypeBalance();
    if (remainingDays === null || remainingDays <= 0) return formData.startDate;
    
    const startDate = new Date(formData.startDate);
    const maxEndDate = new Date(startDate);
    maxEndDate.setDate(startDate.getDate() + remainingDays - 1); // -1 because start date counts as day 1
    
    return maxEndDate.toISOString().split('T')[0];
  };

  const getFilteredLeaveTypes = () => {
    return leaveTypes.filter(type => {
      const typeName = type.name.toLowerCase();
      if (userGender === 'male' && typeName.includes('maternity')) {
        return false;
      }
      if (userGender === 'female' && typeName.includes('paternity')) {
        return false;
      }
      return true;
    }).map(type => {
      const balance = leaveBalance.find(b => b.leaveTypeId === type.id);
      const remaining = balance ? balance.daysRemaining : type.days_allowed;
      return {
        ...type,
        daysRemaining: remaining
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate days requested against remaining balance
    const remainingDays = getSelectedLeaveTypeBalance();
    if (remainingDays !== null && daysRequested > remainingDays) {
      setError(`You can only request up to ${remainingDays} day${remainingDays !== 1 ? 's' : ''} for this leave type.`);
      return;
    }
    
    setSaving(true);
    setError('');

    try {
      await leaveAPI.create(formData, documentFile);
      setSuccess(true);
      setTimeout(() => {
        navigate('/leaves');
      }, 2000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to submit leave request');
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-center">
          <button onClick={() => navigate('/leaves')} className="mr-4 text-gray-600 hover:text-gray-900">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Apply for Leave</h1>
            <p className="text-gray-600">Submit a new leave request</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-600 font-medium">✓ Leave request submitted successfully! Redirecting...</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="card">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Leave Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="leaveTypeId"
                  value={formData.leaveTypeId}
                  onChange={handleChange}
                  className="input-field"
                  required
                >
                  <option value="">Select Leave Type</option>
                  {getFilteredLeaveTypes().map((type) => (
                    <option 
                      key={type.id} 
                      value={type.id}
                      disabled={type.daysRemaining <= 0}
                    >
                      {type.name} ({type.daysRemaining} day{type.daysRemaining !== 1 ? 's' : ''} remaining)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    className="input-field"
                    required
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleChange}
                    className="input-field"
                    required
                    min={formData.startDate || new Date().toISOString().split('T')[0]}
                    max={getMaxEndDate() || undefined}
                  />
                  {formData.leaveTypeId && getSelectedLeaveTypeBalance() !== null && (
                    <p className="mt-1 text-xs text-gray-500">
                      Max {getSelectedLeaveTypeBalance()} day{getSelectedLeaveTypeBalance() !== 1 ? 's' : ''} available
                    </p>
                  )}
                </div>
              </div>

              {daysRequested > 0 && (
                <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                  <div className="flex items-center text-primary-700">
                    <Calendar className="mr-2" size={20} />
                    <span className="font-medium">
                      Total days requested: {daysRequested} day{daysRequested !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  rows={4}
                  className="input-field"
                  placeholder="Please provide a reason for your leave request..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supporting Document (optional)
                </label>
                <div className="mt-1">
                  {!documentFile ? (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-gray-400" />
                        <p className="mb-1 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-400">PDF, DOC, DOCX, Images (Max 10MB)</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setDocumentFile(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-8 h-8 text-primary-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">{documentFile.name}</p>
                          <p className="text-xs text-gray-500">
                            {(documentFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDocumentFile(null)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Upload supporting documents (medical certificate, etc.)
                </p>
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                type="button"
                onClick={() => navigate('/leaves')}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 btn-primary flex items-center justify-center disabled:opacity-50"
              >
                <Save className="mr-2" size={20} />
                {saving ? 'Submitting...' : 'Submit Leave Request'}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-6 card bg-blue-50 border-blue-200">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Leave Approval Process</h3>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. Your supervisor will review and approve/reject your request</li>
            <li>2. If approved by supervisor, it will be forwarded to HR</li>
            <li>3. HR will make the final decision</li>
            <li>4. You'll be notified of the final status</li>
          </ol>
        </div>
      </div>
    </Layout>
  );
};

export default LeaveForm;
