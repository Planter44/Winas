import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { settingsAPI, leaveAPI } from '../services/api';
import { Save, Plus, Edit, Trash2, Settings as SettingsIcon, Palette, Type, Layout as LayoutIcon, Image } from 'lucide-react';

const Settings = () => {
  const { user } = useAuth();
  const { refreshSettings } = useSettings();
  const [activeTab, setActiveTab] = useState('company');
  const [settings, setSettings] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState(null);

  const [companySettings, setCompanySettings] = useState({
    company_name: '',
    company_email: '',
    company_phone: '',
    company_address: ''
  });

  const [siteCustomization, setSiteCustomization] = useState({
    primary_color: '#2563eb',
    secondary_color: '#10b981',
    sidebar_bg_color: '#ffffff',
    header_bg_color: '#ffffff',
    page_bg_color: '#f9fafb',
    font_family: 'Inter',
    sidebar_width: 'normal',
    card_style: 'rounded',
    dashboard_title: 'Dashboard',
    leaves_title: 'Leave Management',
    users_title: 'Users',
    departments_title: 'Departments',
    login_welcome_text: 'Welcome to HRMS',
    login_subtitle: 'Sign in to your account'
  });

  const [leaveTypeForm, setLeaveTypeForm] = useState({
    name: '',
    description: '',
    daysAllowed: 0,
    requiresDocument: false,
    isPaid: true,
    carryForward: false
  });

  const [showLeaveTypeModal, setShowLeaveTypeModal] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
  const API_ORIGIN = API_BASE.replace(/\/?api$/, '');
  const resolvedCompanyLogoUrl = companyLogoUrl?.startsWith('/') ? `${API_ORIGIN}${companyLogoUrl}` : companyLogoUrl;

  const fetchData = async () => {
    try {
      const [settingsRes, leaveTypesRes] = await Promise.all([
        settingsAPI.getAll(),
        leaveAPI.getTypes()
      ]);

      setSettings(settingsRes.data);
      setLeaveTypes(leaveTypesRes.data);

      const settingsMap = {};
      settingsRes.data.forEach(s => {
        settingsMap[s.setting_key] = s.setting_value;
      });

      setCompanySettings({
        company_name: settingsMap.company_name || '',
        company_email: settingsMap.company_email || '',
        company_phone: settingsMap.company_phone || '',
        company_address: settingsMap.company_address || ''
      });

      setSiteCustomization({
        primary_color: settingsMap.primary_color || '#2563eb',
        secondary_color: settingsMap.secondary_color || '#10b981',
        sidebar_bg_color: settingsMap.sidebar_bg_color || '#ffffff',
        header_bg_color: settingsMap.header_bg_color || '#ffffff',
        page_bg_color: settingsMap.page_bg_color || '#f9fafb',
        font_family: settingsMap.font_family || 'Inter',
        sidebar_width: settingsMap.sidebar_width || 'normal',
        card_style: settingsMap.card_style || 'rounded',
        dashboard_title: settingsMap.dashboard_title || 'Dashboard',
        leaves_title: settingsMap.leaves_title || 'Leave Management',
        users_title: settingsMap.users_title || 'Users',
        departments_title: settingsMap.departments_title || 'Departments',
        login_welcome_text: settingsMap.login_welcome_text || 'Welcome to HRMS',
        login_subtitle: settingsMap.login_subtitle || 'Sign in to your account'
      });

      setCompanyLogoUrl(settingsMap.company_logo_url || '');
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCompanyLogo = async () => {
    const ok = window.confirm('Remove the current company logo and revert to the default?');
    if (!ok) return;

    setLogoUploading(true);
    setMessage({ type: '', text: '' });

    try {
      await settingsAPI.deleteCompanyLogo();
      setCompanyLogoUrl('');
      setLogoFile(null);
      refreshSettings();
      fetchData();
      setMessage({ type: 'success', text: 'Company logo reset successfully!' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to reset company logo'
      });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleUploadCompanyLogo = async () => {
    if (!logoFile) {
      setMessage({ type: 'error', text: 'Please select a logo file to upload' });
      return;
    }

    setLogoUploading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await settingsAPI.uploadCompanyLogo(logoFile);
      setCompanyLogoUrl(res.data?.logoUrl || '');
      setLogoFile(null);
      refreshSettings();
      fetchData();
      setMessage({ type: 'success', text: 'Company logo updated successfully!' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to upload company logo'
      });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSaveCompanySettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const settingsArray = Object.entries(companySettings).map(([key, value]) => ({
        key,
        value
      }));

      await settingsAPI.bulkUpdate({ settings: settingsArray });
      refreshSettings(); // Refresh settings context to apply changes immediately
      setMessage({ type: 'success', text: 'Company settings saved successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSiteCustomization = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const settingsArray = Object.entries(siteCustomization).map(([key, value]) => ({
        key,
        value
      }));

      await settingsAPI.bulkUpdate({ settings: settingsArray });
      refreshSettings(); // Refresh settings context to apply changes immediately
      setMessage({ type: 'success', text: 'Site customization saved successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save site customization' });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenLeaveTypeModal = (leaveType = null) => {
    if (leaveType) {
      setEditingLeaveType(leaveType);
      setLeaveTypeForm({
        name: leaveType.name,
        description: leaveType.description || '',
        daysAllowed: leaveType.days_allowed,
        requiresDocument: leaveType.requires_document,
        isPaid: leaveType.is_paid,
        carryForward: leaveType.carry_forward
      });
    } else {
      setEditingLeaveType(null);
      setLeaveTypeForm({
        name: '',
        description: '',
        daysAllowed: 0,
        requiresDocument: false,
        isPaid: true,
        carryForward: false
      });
    }
    setShowLeaveTypeModal(true);
  };

  const handleSaveLeaveType = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingLeaveType) {
        await leaveAPI.updateType(editingLeaveType.id, leaveTypeForm);
      } else {
        await leaveAPI.createType(leaveTypeForm);
      }
      setShowLeaveTypeModal(false);
      fetchData();
      setMessage({ type: 'success', text: 'Leave type saved successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save leave type' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLeaveType = async (id) => {
    if (!window.confirm('Are you sure you want to delete this leave type?')) return;

    try {
      await leaveAPI.deleteType(id);
      fetchData();
      setMessage({ type: 'success', text: 'Leave type deleted successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete leave type' });
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
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">System Settings</h1>
          <p className="text-gray-600">Manage system configuration and preferences</p>
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

        <div className="card mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('company')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'company'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Company Info
              </button>
              <button
                onClick={() => setActiveTab('leave')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'leave'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Leave Types
              </button>
              {user?.role === 'Super Admin' && (
                <button
                  onClick={() => setActiveTab('customization')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'customization'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Site Customization
                </button>
              )}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'company' && (
              <form onSubmit={handleSaveCompanySettings}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={companySettings.company_name}
                      onChange={(e) =>
                        setCompanySettings({ ...companySettings, company_name: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={companySettings.company_email}
                      onChange={(e) =>
                        setCompanySettings({ ...companySettings, company_email: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={companySettings.company_phone}
                      onChange={(e) =>
                        setCompanySettings({ ...companySettings, company_phone: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address
                    </label>
                    <textarea
                      value={companySettings.company_address}
                      onChange={(e) =>
                        setCompanySettings({ ...companySettings, company_address: e.target.value })
                      }
                      rows={3}
                      className="input-field"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-6 btn-primary flex items-center disabled:opacity-50"
                >
                  <Save className="mr-2" size={18} />
                  {saving ? 'Saving...' : 'Save Company Settings'}
                </button>
              </form>
            )}

            {activeTab === 'leave' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Leave Types</h3>
                  <button
                    onClick={() => handleOpenLeaveTypeModal()}
                    className="btn-primary flex items-center"
                  >
                    <Plus className="mr-2" size={18} />
                    Add Leave Type
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Days Allowed
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Properties
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {leaveTypes.map((type) => (
                        <tr key={type.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{type.name}</div>
                            {type.description && (
                              <div className="text-sm text-gray-500">{type.description}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {type.days_allowed} days
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-wrap gap-1">
                              {type.is_paid && <span className="badge badge-success">Paid</span>}
                              {type.requires_document && (
                                <span className="badge badge-info">Requires Doc</span>
                              )}
                              {type.carry_forward && (
                                <span className="badge badge-warning">Carry Forward</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleOpenLeaveTypeModal(type)}
                                className="text-primary-600 hover:text-primary-900"
                              >
                                <Edit size={18} />
                              </button>
                              <button
                                onClick={() => handleDeleteLeaveType(type.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {leaveTypes.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No leave types found
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'customization' && user?.role === 'Super Admin' && (
              <form onSubmit={handleSaveSiteCustomization}>
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Image className="mr-2" size={20} />
                      Company Logo
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="card bg-gray-50 border border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-3">Current Logo</p>
                        {resolvedCompanyLogoUrl ? (
                          <div className="h-28 flex items-center justify-center bg-white border border-gray-200 rounded-lg">
                            <img
                              src={resolvedCompanyLogoUrl}
                              alt="Company Logo"
                              className="max-h-20 max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="h-28 flex items-center justify-center bg-white border border-dashed border-gray-300 rounded-lg">
                            <p className="text-sm text-gray-500">No logo uploaded</p>
                          </div>
                        )}

                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={handleDeleteCompanyLogo}
                            disabled={logoUploading || !resolvedCompanyLogoUrl}
                            className="btn-secondary w-full flex items-center justify-center disabled:opacity-50"
                          >
                            <Trash2 className="mr-2" size={18} />
                            Remove Logo
                          </button>
                        </div>
                      </div>

                      <div className="card bg-gray-50 border border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-3">Upload New Logo</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                          className="block w-full text-sm text-gray-700"
                          disabled={logoUploading}
                        />
                        <button
                          type="button"
                          onClick={handleUploadCompanyLogo}
                          disabled={logoUploading || !logoFile}
                          className="mt-4 btn-primary flex items-center disabled:opacity-50"
                        >
                          <Image className="mr-2" size={18} />
                          {logoUploading ? 'Uploading...' : 'Upload Logo'}
                        </button>
                        <p className="text-xs text-gray-500 mt-2">Max 5MB. JPG/PNG/GIF/WEBP/SVG.</p>
                      </div>
                    </div>
                  </div>

                  {/* Colors Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Palette className="mr-2" size={20} />
                      Color Scheme
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="color"
                            value={siteCustomization.primary_color}
                            onChange={(e) => setSiteCustomization({ ...siteCustomization, primary_color: e.target.value })}
                            className="h-10 w-16 rounded border cursor-pointer"
                          />
                          <input
                            type="text"
                            value={siteCustomization.primary_color}
                            onChange={(e) => setSiteCustomization({ ...siteCustomization, primary_color: e.target.value })}
                            className="input-field flex-1"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="color"
                            value={siteCustomization.secondary_color}
                            onChange={(e) => setSiteCustomization({ ...siteCustomization, secondary_color: e.target.value })}
                            className="h-10 w-16 rounded border cursor-pointer"
                          />
                          <input
                            type="text"
                            value={siteCustomization.secondary_color}
                            onChange={(e) => setSiteCustomization({ ...siteCustomization, secondary_color: e.target.value })}
                            className="input-field flex-1"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Sidebar Background</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="color"
                            value={siteCustomization.sidebar_bg_color}
                            onChange={(e) => setSiteCustomization({ ...siteCustomization, sidebar_bg_color: e.target.value })}
                            className="h-10 w-16 rounded border cursor-pointer"
                          />
                          <input
                            type="text"
                            value={siteCustomization.sidebar_bg_color}
                            onChange={(e) => setSiteCustomization({ ...siteCustomization, sidebar_bg_color: e.target.value })}
                            className="input-field flex-1"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Header Background</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="color"
                            value={siteCustomization.header_bg_color}
                            onChange={(e) => setSiteCustomization({ ...siteCustomization, header_bg_color: e.target.value })}
                            className="h-10 w-16 rounded border cursor-pointer"
                          />
                          <input
                            type="text"
                            value={siteCustomization.header_bg_color}
                            onChange={(e) => setSiteCustomization({ ...siteCustomization, header_bg_color: e.target.value })}
                            className="input-field flex-1"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Page Background</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="color"
                            value={siteCustomization.page_bg_color}
                            onChange={(e) => setSiteCustomization({ ...siteCustomization, page_bg_color: e.target.value })}
                            className="h-10 w-16 rounded border cursor-pointer"
                          />
                          <input
                            type="text"
                            value={siteCustomization.page_bg_color}
                            onChange={(e) => setSiteCustomization({ ...siteCustomization, page_bg_color: e.target.value })}
                            className="input-field flex-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Layout Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <LayoutIcon className="mr-2" size={20} />
                      Layout & Style
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Font Family</label>
                        <select
                          value={siteCustomization.font_family}
                          onChange={(e) => setSiteCustomization({ ...siteCustomization, font_family: e.target.value })}
                          className="input-field"
                        >
                          <option value="Inter">Inter</option>
                          <option value="Roboto">Roboto</option>
                          <option value="Open Sans">Open Sans</option>
                          <option value="Poppins">Poppins</option>
                          <option value="Lato">Lato</option>
                          <option value="Montserrat">Montserrat</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Sidebar Width</label>
                        <select
                          value={siteCustomization.sidebar_width}
                          onChange={(e) => setSiteCustomization({ ...siteCustomization, sidebar_width: e.target.value })}
                          className="input-field"
                        >
                          <option value="compact">Compact</option>
                          <option value="normal">Normal</option>
                          <option value="wide">Wide</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Card Style</label>
                        <select
                          value={siteCustomization.card_style}
                          onChange={(e) => setSiteCustomization({ ...siteCustomization, card_style: e.target.value })}
                          className="input-field"
                        >
                          <option value="rounded">Rounded</option>
                          <option value="sharp">Sharp Corners</option>
                          <option value="pill">Pill Style</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Page Titles Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Type className="mr-2" size={20} />
                      Page Titles & Text
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Dashboard Title</label>
                        <input
                          type="text"
                          value={siteCustomization.dashboard_title}
                          onChange={(e) => setSiteCustomization({ ...siteCustomization, dashboard_title: e.target.value })}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Leave Management Title</label>
                        <input
                          type="text"
                          value={siteCustomization.leaves_title}
                          onChange={(e) => setSiteCustomization({ ...siteCustomization, leaves_title: e.target.value })}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Users Page Title</label>
                        <input
                          type="text"
                          value={siteCustomization.users_title}
                          onChange={(e) => setSiteCustomization({ ...siteCustomization, users_title: e.target.value })}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Departments Page Title</label>
                        <input
                          type="text"
                          value={siteCustomization.departments_title}
                          onChange={(e) => setSiteCustomization({ ...siteCustomization, departments_title: e.target.value })}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Login Welcome Text</label>
                        <input
                          type="text"
                          value={siteCustomization.login_welcome_text}
                          onChange={(e) => setSiteCustomization({ ...siteCustomization, login_welcome_text: e.target.value })}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Login Subtitle</label>
                        <input
                          type="text"
                          value={siteCustomization.login_subtitle}
                          onChange={(e) => setSiteCustomization({ ...siteCustomization, login_subtitle: e.target.value })}
                          className="input-field"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-6 btn-primary flex items-center disabled:opacity-50"
                >
                  <Save className="mr-2" size={18} />
                  {saving ? 'Saving...' : 'Save Site Customization'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {showLeaveTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingLeaveType ? 'Edit Leave Type' : 'Add Leave Type'}
            </h2>

            <form onSubmit={handleSaveLeaveType}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={leaveTypeForm.name}
                    onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, name: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={leaveTypeForm.description}
                    onChange={(e) =>
                      setLeaveTypeForm({ ...leaveTypeForm, description: e.target.value })
                    }
                    rows={2}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Days Allowed <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={leaveTypeForm.daysAllowed}
                    onChange={(e) =>
                      setLeaveTypeForm({ ...leaveTypeForm, daysAllowed: parseInt(e.target.value) })
                    }
                    className="input-field"
                    required
                    min={0}
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={leaveTypeForm.isPaid}
                      onChange={(e) =>
                        setLeaveTypeForm({ ...leaveTypeForm, isPaid: e.target.checked })
                      }
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">Paid Leave</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={leaveTypeForm.requiresDocument}
                      onChange={(e) =>
                        setLeaveTypeForm({ ...leaveTypeForm, requiresDocument: e.target.checked })
                      }
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">Requires Document</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={leaveTypeForm.carryForward}
                      onChange={(e) =>
                        setLeaveTypeForm({ ...leaveTypeForm, carryForward: e.target.checked })
                      }
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">Can Carry Forward</span>
                  </label>
                </div>
              </div>

              <div className="flex space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowLeaveTypeModal(false)}
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
                  {saving ? 'Saving...' : editingLeaveType ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Settings;
