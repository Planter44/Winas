import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { userAPI, departmentAPI } from '../services/api';
import { Save, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const UserForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    roleId: '',
    departmentId: '',
    supervisorId: '',
    firstName: '',
    lastName: '',
    middleName: '',
    employeeNumber: '',
    nationalId: '',
    phone: '',
    secondaryPhone: '',
    kraPin: '',
    educationLevel: '',
    dateOfBirth: '',
    gender: '',
    maritalStatus: '',
    address: '',
    city: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    nextOfKinName: '',
    nextOfKinPhone: '',
    nextOfKinIdNumber: '',
    nextOfKinRelationship: '',
    dateJoined: '',
    jobTitle: '',
    isActive: true
  });

  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchData();
    if (isEdit) {
      fetchUser();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      const [rolesRes, deptsRes, supervisorsRes] = await Promise.all([
        departmentAPI.getRoles(),
        departmentAPI.getAll(),
        userAPI.getAll({ role: 'Supervisor' })
      ]);

      setRoles(rolesRes.data);
      setDepartments(deptsRes.data);
      setSupervisors(supervisorsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const fetchUser = async () => {
    try {
      const response = await userAPI.getById(id);
      const user = response.data;

      setFormData({
        email: user.email || '',
        password: '',
        roleId: user.role_id || '',
        departmentId: user.department_id || '',
        supervisorId: user.supervisor_id || '',
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        middleName: user.middle_name || '',
        employeeNumber: user.employee_number || '',
        nationalId: user.national_id || '',
        phone: user.phone || '',
        secondaryPhone: user.secondary_phone || '',
        kraPin: user.kra_pin || '',
        educationLevel: user.education_level || '',
        dateOfBirth: formatDateForInput(user.date_of_birth),
        gender: user.gender || '',
        maritalStatus: user.marital_status || '',
        address: user.address || '',
        city: user.city || '',
        emergencyContactName: user.emergency_contact_name || '',
        emergencyContactPhone: user.emergency_contact_phone || '',
        nextOfKinName: user.next_of_kin_name || '',
        nextOfKinPhone: user.next_of_kin_phone || '',
        nextOfKinIdNumber: user.next_of_kin_id_number || '',
        nextOfKinRelationship: user.next_of_kin_relationship || '',
        dateJoined: formatDateForInput(user.date_joined),
        jobTitle: user.job_title || '',
        isActive: user.is_active !== false
      });
    } catch (error) {
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      // Clean up form data - convert empty strings to null for optional fields
      const cleanedData = {
        ...formData,
        departmentId: formData.departmentId || null,
        supervisorId: formData.supervisorId || null,
        middleName: formData.middleName || null,
        employeeNumber: formData.employeeNumber || null,
        nationalId: formData.nationalId || null,
        phone: formData.phone || null,
        secondaryPhone: formData.secondaryPhone || null,
        kraPin: formData.kraPin || null,
        educationLevel: formData.educationLevel || null,
        dateOfBirth: formData.dateOfBirth || null,
        gender: formData.gender || null,
        maritalStatus: formData.maritalStatus || null,
        address: formData.address || null,
        city: formData.city || null,
        emergencyContactName: formData.emergencyContactName || null,
        emergencyContactPhone: formData.emergencyContactPhone || null,
        nextOfKinName: formData.nextOfKinName || null,
        nextOfKinPhone: formData.nextOfKinPhone || null,
        nextOfKinIdNumber: formData.nextOfKinIdNumber || null,
        nextOfKinRelationship: formData.nextOfKinRelationship || null,
        dateJoined: formData.dateJoined || null,
        jobTitle: formData.jobTitle || null
      };

      if (isEdit) {
        await userAPI.update(id, cleanedData);
        alert('User updated successfully!');
      } else {
        await userAPI.create(cleanedData);
        alert('User created successfully!');
      }
      navigate('/users');
    } catch (error) {
      setError(error.response?.data?.error || `Failed to ${isEdit ? 'update' : 'create'} user`);
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center">
          <button onClick={() => navigate('/users')} className="mr-4 text-gray-600 hover:text-gray-900">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isEdit ? 'Edit User' : 'Add New User'}
            </h1>
            <p className="text-gray-600">
              {isEdit ? 'Update user information' : 'Create a new user account'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="card mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input-field"
                  required
                />
              </div>

              {!isEdit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="input-field pr-10"
                      required={!isEdit}
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  name="roleId"
                  value={formData.roleId}
                  onChange={handleChange}
                  className="input-field"
                  required
                >
                  <option value="">Select Role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>
                <select
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supervisor
                </label>
                <select
                  name="supervisorId"
                  value={formData.supervisorId}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="">Select Supervisor</option>
                  {supervisors.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.first_name} {sup.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Active User</span>
                </label>
              </div>
            </div>
          </div>

          <div className="card mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Middle Name
                </label>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employee Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="employeeNumber"
                  value={formData.employeeNumber}
                  onChange={handleChange}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  National ID
                </label>
                <input
                  type="text"
                  name="nationalId"
                  value={formData.nationalId}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="+254700000000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Marital Status
                </label>
                <select
                  name="maritalStatus"
                  value={formData.maritalStatus}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="">Select Status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Title
                </label>
                <input
                  type="text"
                  name="jobTitle"
                  value={formData.jobTitle}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Joined
                </label>
                <input
                  type="date"
                  name="dateJoined"
                  value={formData.dateJoined}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  name="emergencyContactName"
                  value={formData.emergencyContactName}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emergency Contact Phone
                </label>
                <input
                  type="tel"
                  name="emergencyContactPhone"
                  value={formData.emergencyContactPhone}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="+254700000000"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Next of Kin Information (Optional - can be filled later)
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This information will be used in case of emergency. The user can update this later from their profile.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Next of Kin Name
                </label>
                <input
                  type="text"
                  name="nextOfKinName"
                  value={formData.nextOfKinName}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Next of Kin Phone
                </label>
                <input
                  type="tel"
                  name="nextOfKinPhone"
                  value={formData.nextOfKinPhone}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Next of Kin ID Number
                </label>
                <input
                  type="text"
                  name="nextOfKinIdNumber"
                  value={formData.nextOfKinIdNumber}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Relationship
                </label>
                <select
                  name="nextOfKinRelationship"
                  value={formData.nextOfKinRelationship}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="">Select Relationship</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Parent">Parent</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Child">Child</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex space-x-4 mt-6">
            <button
              type="button"
              onClick={() => navigate('/users')}
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
              {saving ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default UserForm;
