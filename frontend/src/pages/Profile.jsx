import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { User, Mail, Phone, MapPin, Calendar, Briefcase, Lock, Save } from 'lucide-react';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [initialProfile, setInitialProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await authAPI.getProfile();
      setProfile({ ...response.data });
      setInitialProfile({ ...response.data });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelChanges = () => {
    if (initialProfile) {
      setProfile({ ...initialProfile });
    }
    setMessage({ type: '', text: '' });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const payload = {
        email: profile.email || null,
        firstName: profile.first_name || null,
        lastName: profile.last_name || null,
        middleName: profile.middle_name || null,
        nationalId: profile.national_id || null,
        secondaryPhone: profile.secondary_phone || null,
        kraPin: profile.kra_pin || null,
        educationLevel: profile.education_level || null,
        dateOfBirth: profile.date_of_birth || null,
        gender: profile.gender || null,
        maritalStatus: profile.marital_status || null,
        phone: profile.phone || null,
        address: profile.address || null,
        city: profile.city || null,
        emergencyContactName: profile.emergency_contact_name || null,
        emergencyContactPhone: profile.emergency_contact_phone || null,
        nextOfKinName: profile.next_of_kin_name || null,
        nextOfKinPhone: profile.next_of_kin_phone || null,
        nextOfKinIdNumber: profile.next_of_kin_id_number || null,
        nextOfKinRelationship: profile.next_of_kin_relationship || null
      };

      const res = await authAPI.updateProfile(payload);

      if (res.data?.profile) {
        setProfile(res.data.profile);
        setInitialProfile(res.data.profile);

        updateUser({
          ...user,
          email: res.data.profile.email,
          firstName: res.data.profile.first_name,
          lastName: res.data.profile.last_name,
          employeeNumber: res.data.profile.employee_number,
          jobTitle: res.data.profile.job_title
        });
      } else {
        fetchProfile();
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setShowPasswordModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to change password' });
    } finally {
      setSaving(false);
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Profile</h1>
          <p className="text-gray-600">Manage your personal information</p>
        </div>

        {message.text && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary-600 text-white text-3xl font-bold mb-4">
                {profile?.first_name?.[0]}{profile?.last_name?.[0]}
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {profile?.first_name} {profile?.last_name}
              </h2>
              <p className="text-gray-600 mb-1">{profile?.job_title}</p>
              <p className="text-sm text-gray-500">{profile?.employee_number}</p>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="mt-4 btn-secondary w-full flex items-center justify-center"
              >
                <Lock className="mr-2" size={16} />
                Change Password
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                    <User className="mr-2" size={16} />
                    Full Name
                  </label>
                  <p className="text-gray-900">
                    {profile?.first_name} {profile?.middle_name} {profile?.last_name}
                  </p>
                </div>

                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                    <Mail className="mr-2" size={16} />
                    Email
                  </label>
                  <input
                    type="email"
                    value={profile?.email || ''}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                    <Briefcase className="mr-2" size={16} />
                    Role
                  </label>
                  <p className="text-gray-900">{profile?.role_name}</p>
                </div>

                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="mr-2" size={16} />
                    Date Joined
                  </label>
                  <p className="text-gray-900">
                    {profile?.date_joined ? new Date(profile.date_joined).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile}>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 mt-6">Contact Information</h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={profile?.first_name || ''}
                        onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={profile?.last_name || ''}
                        onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Middle Name
                      </label>
                      <input
                        type="text"
                        value={profile?.middle_name || ''}
                        onChange={(e) => setProfile({ ...profile, middle_name: e.target.value })}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Employee Number
                      </label>
                      <input
                        type="text"
                        value={profile?.employee_number || ''}
                        readOnly
                        disabled
                        className="input-field bg-gray-100 text-gray-500 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        National ID
                      </label>
                      <input
                        type="text"
                        value={profile?.national_id || ''}
                        onChange={(e) => setProfile({ ...profile, national_id: e.target.value })}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        KRA PIN
                      </label>
                      <input
                        type="text"
                        value={profile?.kra_pin || ''}
                        onChange={(e) => setProfile({ ...profile, kra_pin: e.target.value })}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Education Level
                      </label>
                      <input
                        type="text"
                        value={profile?.education_level || ''}
                        onChange={(e) => setProfile({ ...profile, education_level: e.target.value })}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={profile?.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : ''}
                        onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gender
                      </label>
                      <select
                        value={profile?.gender || ''}
                        onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
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
                        value={profile?.marital_status || ''}
                        onChange={(e) => setProfile({ ...profile, marital_status: e.target.value })}
                        className="input-field"
                      >
                        <option value="">Select Status</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date Joined
                      </label>
                      <input
                        type="date"
                        value={profile?.date_joined ? String(profile.date_joined).slice(0, 10) : ''}
                        readOnly
                        disabled
                        className="input-field bg-gray-100 text-gray-500 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Job Title
                      </label>
                      <input
                        type="text"
                        value={profile?.job_title || ''}
                        readOnly
                        disabled
                        className="input-field bg-gray-100 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profile?.phone || ''}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="input-field"
                      placeholder="+254700000000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Secondary Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profile?.secondary_phone || ''}
                      onChange={(e) => setProfile({ ...profile, secondary_phone: e.target.value })}
                      className="input-field"
                      placeholder="+254700000000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      value={profile?.address || ''}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                      className="input-field"
                      placeholder="Street address"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={profile?.city || ''}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                      className="input-field"
                      placeholder="City"
                    />
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-4 mt-6">Emergency Contact</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={profile?.emergency_contact_name || ''}
                      onChange={(e) =>
                        setProfile({ ...profile, emergency_contact_name: e.target.value })
                      }
                      className="input-field"
                      placeholder="Emergency contact name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={profile?.emergency_contact_phone || ''}
                      onChange={(e) =>
                        setProfile({ ...profile, emergency_contact_phone: e.target.value })
                      }
                      className="input-field"
                      placeholder="+254700000000"
                    />
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-4 mt-6">Next of Kin</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Next of Kin Name
                    </label>
                    <input
                      type="text"
                      value={profile?.next_of_kin_name || ''}
                      onChange={(e) =>
                        setProfile({ ...profile, next_of_kin_name: e.target.value })
                      }
                      className="input-field"
                      placeholder="Next of kin name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Next of Kin Phone
                    </label>
                    <input
                      type="tel"
                      value={profile?.next_of_kin_phone || ''}
                      onChange={(e) =>
                        setProfile({ ...profile, next_of_kin_phone: e.target.value })
                      }
                      className="input-field"
                      placeholder="+254700000000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Next of Kin ID Number
                    </label>
                    <input
                      type="text"
                      value={profile?.next_of_kin_id_number || ''}
                      onChange={(e) =>
                        setProfile({ ...profile, next_of_kin_id_number: e.target.value })
                      }
                      className="input-field"
                      placeholder="ID Number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Relationship
                    </label>
                    <select
                      value={profile?.next_of_kin_relationship || ''}
                      onChange={(e) =>
                        setProfile({ ...profile, next_of_kin_relationship: e.target.value })
                      }
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

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleCancelChanges}
                    disabled={saving}
                    className="btn-secondary flex items-center disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary flex items-center disabled:opacity-50"
                  >
                    <Save className="mr-2" size={16} />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Change Password</h2>

            <form onSubmit={handleChangePassword}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, currentPassword: e.target.value })
                    }
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, newPassword: e.target.value })
                    }
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                    }
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 btn-primary">
                  {saving ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Profile;
