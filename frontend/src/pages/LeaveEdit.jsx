import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { leaveAPI } from '../services/api';
import { Save, ArrowLeft } from 'lucide-react';

const LeaveEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, hasRole } = useAuth();

  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    documentUrl: ''
  });

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [daysRequested, setDaysRequested] = useState(0);

  useEffect(() => {
    fetchLeave();
  }, [id]);

  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      setDaysRequested(days > 0 ? days : 0);
    }
  }, [formData.startDate, formData.endDate]);

  const fetchLeave = async () => {
    try {
      const response = await leaveAPI.getById(id);
      const leave = response.data;

      // Check if user can edit
      // HR/CEO can edit any leave, owner can edit only if still pending at first level
      const isOwner = leave.user_id === user.id;
      const isCEOorHR = hasRole(['CEO', 'HR', 'Super Admin']);
      const canOwnerEdit = isOwner && leave.status === 'Pending' && (
        leave.requires_ceo_approval || leave.supervisor_status === 'Pending'
      );
      
      if (!isCEOorHR && !canOwnerEdit) {
        alert('You cannot edit this leave request');
        navigate('/leaves');
        return;
      }

      setFormData({
        startDate: leave.start_date.split('T')[0],
        endDate: leave.end_date.split('T')[0],
        reason: leave.reason || '',
        documentUrl: leave.document_url || ''
      });
    } catch (error) {
      console.error('Failed to fetch leave:', error);
      alert('Failed to load leave request');
      navigate('/leaves');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await leaveAPI.update(id, formData);
      alert('Leave request updated successfully');
      navigate(`/leaves/${id}`);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to update leave request');
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
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-center">
          <button onClick={() => navigate(`/leaves/${id}`)} className="mr-4 text-gray-600 hover:text-gray-900">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Leave Request</h1>
            <p className="text-gray-600">Update your leave application</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="card">
            <div className="space-y-4">
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
                  />
                </div>
              </div>

              {daysRequested > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Days Requested:</strong> {daysRequested} days
                  </p>
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
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supporting Document URL (Optional)
                </label>
                <input
                  type="url"
                  name="documentUrl"
                  value={formData.documentUrl}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="https://example.com/document.pdf"
                />
              </div>
            </div>

            <div className="mt-6 flex space-x-4">
              <button
                type="button"
                onClick={() => navigate(`/leaves/${id}`)}
                className="flex-1 btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 btn-primary flex items-center justify-center"
                disabled={saving}
              >
                {saving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Save className="mr-2" size={20} />
                    Update Leave Request
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default LeaveEdit;
