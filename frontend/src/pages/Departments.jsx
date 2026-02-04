import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { departmentAPI } from '../services/api';
import { Plus, Edit, Trash2, Building2, Users } from 'lucide-react';

const Departments = () => {
  const { hasMinLevel } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', isActive: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getAll();
      setDepartments(response.data);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (dept = null) => {
    if (dept) {
      setEditingDept(dept);
      setFormData({
        name: dept.name,
        description: dept.description || '',
        isActive: dept.is_active
      });
    } else {
      setEditingDept(null);
      setFormData({ name: '', description: '', isActive: true });
    }
    setShowModal(true);
    setError('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDept(null);
    setFormData({ name: '', description: '', isActive: true });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editingDept) {
        await departmentAPI.update(editingDept.id, formData);
      } else {
        await departmentAPI.create(formData);
      }
      handleCloseModal();
      fetchDepartments();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this department?')) return;

    try {
      await departmentAPI.delete(id);
      fetchDepartments();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete department');
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

  return (
    <Layout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Departments</h1>
          <p className="text-gray-600">Manage organizational departments</p>
        </div>
        {hasMinLevel(2) && (
          <button onClick={() => handleOpenModal()} className="btn-primary flex items-center">
            <Plus className="mr-2" size={20} />
            Add Department
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => (
          <div key={dept.id} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="p-3 bg-primary-100 rounded-lg mr-3">
                  <Building2 className="text-primary-600" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{dept.name}</h3>
                  <span className={`badge ${dept.is_active ? 'badge-success' : 'badge-danger'}`}>
                    {dept.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              {hasMinLevel(2) && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleOpenModal(dept)}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    <Edit size={18} />
                  </button>
                  {hasMinLevel(2) && (
                    <button
                      onClick={() => handleDelete(dept.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {dept.description && (
              <p className="text-sm text-gray-600 mb-4">{dept.description}</p>
            )}

            <div className="flex items-center text-sm text-gray-500 pt-4 border-t border-gray-200">
              <Users className="mr-2" size={16} />
              <span>{dept.staffCount || 0} staff member{dept.staffCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        ))}

        {departments.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No departments found
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingDept ? 'Edit Department' : 'Add Department'}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="input-field"
                    placeholder="Department description..."
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="mr-2"
                  />
                  <label className="text-sm font-medium text-gray-700">Active Department</label>
                </div>
              </div>

              <div className="flex space-x-4 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingDept ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Departments;
