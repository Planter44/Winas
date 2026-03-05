import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { settingsAPI } from '../services/api';
import { Save, Trash2, Settings as SettingsIcon, Palette, Type, Layout as LayoutIcon, Image } from 'lucide-react';

const Settings = () => {
  const { user } = useAuth();
  const { refreshSettings } = useSettings();
  const [activeTab, setActiveTab] = useState('company');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [resettingDefaults, setResettingDefaults] = useState(false);
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
    dashboard_card_gradient_opacity: '65',
    dashboard_title: 'Dashboard',
    users_title: 'Users',
    departments_title: 'Departments',
    login_welcome_text: 'Welcome to HRMS',
    login_subtitle: 'Sign in to your account',
    footer_enabled: 'true',
    footer_content: '© 2024 Winas Sacco. All rights reserved.',
    footer_font_family: 'Inter',
    footer_bg_color: '#ffffff',
    theme_mode: 'light',
    hamburger_style: 'classic',
    hamburger_color: '#2563eb'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
  const API_ORIGIN = API_BASE.replace(/\/?api$/, '');
  const resolvedCompanyLogoUrl = companyLogoUrl?.startsWith('/') ? `${API_ORIGIN}${companyLogoUrl}` : companyLogoUrl;

  const fetchData = async () => {
    try {
      const settingsRes = await settingsAPI.getAll();

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
        dashboard_card_gradient_opacity: settingsMap.dashboard_card_gradient_opacity || '65',
        dashboard_title: settingsMap.dashboard_title || 'Dashboard',
        users_title: settingsMap.users_title || 'Users',
        departments_title: settingsMap.departments_title || 'Departments',
        login_welcome_text: settingsMap.login_welcome_text || 'Welcome to HRMS',
        login_subtitle: settingsMap.login_subtitle || 'Sign in to your account',
        footer_enabled: settingsMap.footer_enabled || 'true',
        footer_content: settingsMap.footer_content || '© 2024 Winas Sacco. All rights reserved.',
        footer_font_family: settingsMap.footer_font_family || 'Inter',
        footer_bg_color: settingsMap.footer_bg_color || '#ffffff',
        theme_mode: settingsMap.theme_mode || 'light',
        hamburger_style: settingsMap.hamburger_style || 'classic',
        hamburger_color: settingsMap.hamburger_color || '#2563eb'
      });

      setCompanyLogoUrl(settingsMap.company_logo_url || '');
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDefaults = async () => {
    const ok = window.confirm('Reset all settings to default values? This will also remove the uploaded company logo.');
    if (!ok) return;

    setResettingDefaults(true);
    setMessage({ type: '', text: '' });

    try {
      await settingsAPI.resetDefaults();
      refreshSettings();
      fetchData();
      setMessage({ type: 'success', text: 'Settings reset to defaults successfully!' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to reset settings to defaults'
      });
    } finally {
      setResettingDefaults(false);
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

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={handleResetDefaults}
                        disabled={resettingDefaults}
                        className="btn-secondary w-full flex items-center justify-center disabled:opacity-50"
                      >
                        <Trash2 className="mr-2" size={18} />
                        {resettingDefaults ? 'Resetting...' : 'Reset All Settings To Default'}
                      </button>
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

                  {/* Theme & Footer Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <SettingsIcon className="mr-2" size={20} />
                      Theme & Footer
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Theme Mode</label>
                        <select
                          value={siteCustomization.theme_mode}
                          onChange={(e) => setSiteCustomization({ ...siteCustomization, theme_mode: e.target.value })}
                          className="input-field"
                        >
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Footer</label>
                        <select
                          value={siteCustomization.footer_enabled}
                          onChange={(e) => setSiteCustomization({ ...siteCustomization, footer_enabled: e.target.value })}
                          className="input-field"
                        >
                          <option value="true">Enabled</option>
                          <option value="false">Disabled</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Footer Font</label>
                        <select
                          value={siteCustomization.footer_font_family}
                          onChange={(e) => setSiteCustomization({ ...siteCustomization, footer_font_family: e.target.value })}
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">Footer Background</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="color"
                            value={siteCustomization.footer_bg_color}
                            onChange={(e) => setSiteCustomization({ ...siteCustomization, footer_bg_color: e.target.value })}
                            className="h-10 w-16 rounded border cursor-pointer"
                          />
                          <input
                            type="text"
                            value={siteCustomization.footer_bg_color}
                            onChange={(e) => setSiteCustomization({ ...siteCustomization, footer_bg_color: e.target.value })}
                            className="input-field flex-1"
                          />
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Footer Content</label>
                        <textarea
                          value={siteCustomization.footer_content}
                          onChange={(e) => setSiteCustomization({ ...siteCustomization, footer_content: e.target.value })}
                          rows={3}
                          className="input-field"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Navigation Menu Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <LayoutIcon className="mr-2" size={20} />
                      Navigation Menu
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Hamburger Style</label>
                        <select
                          value={siteCustomization.hamburger_style}
                          onChange={(e) => setSiteCustomization({ ...siteCustomization, hamburger_style: e.target.value })}
                          className="input-field"
                        >
                          <option value="classic">Classic</option>
                          <option value="stacked">Stacked</option>
                          <option value="drop">Drop</option>
                          <option value="minimal">Minimal</option>
                          <option value="bold">Bold</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Hamburger Color</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="color"
                            value={siteCustomization.hamburger_color}
                            onChange={(e) => setSiteCustomization({ ...siteCustomization, hamburger_color: e.target.value })}
                            className="h-10 w-16 rounded border cursor-pointer"
                          />
                          <input
                            type="text"
                            value={siteCustomization.hamburger_color}
                            onChange={(e) => setSiteCustomization({ ...siteCustomization, hamburger_color: e.target.value })}
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
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Dashboard Card Gradient Opacity
                        </label>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={siteCustomization.dashboard_card_gradient_opacity}
                            onChange={(e) =>
                              setSiteCustomization({
                                ...siteCustomization,
                                dashboard_card_gradient_opacity: e.target.value
                              })
                            }
                            className="w-full sm:flex-1 accent-primary-600"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={siteCustomization.dashboard_card_gradient_opacity}
                              onChange={(e) =>
                                setSiteCustomization({
                                  ...siteCustomization,
                                  dashboard_card_gradient_opacity: e.target.value
                                })
                              }
                              className="input-field w-24"
                            />
                            <span className="text-sm text-gray-500">%</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Higher values make dashboard gradients more intense.
                        </p>
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

    </Layout>
  );
};

export default Settings;
