import React, { createContext, useState, useContext, useEffect } from 'react';
import { settingsAPI } from '../services/api';

const SettingsContext = createContext(null);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

const defaultSettings = {
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
  leaves_title: 'Leave Management',
  users_title: 'Users',
  departments_title: 'Departments',
  login_welcome_text: 'Welcome to HRMS',
  login_subtitle: 'Sign in to your account',
  company_name: 'Winas Sacco',
  company_logo_url: '',
  company_email: '',
  company_phone: '',
  company_address: '',
  footer_enabled: 'true',
  footer_content: '© 2024 Winas Sacco. All rights reserved.',
  theme_mode: 'light',
  hamburger_style: 'classic',
  hamburger_color: '#2563eb'
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await settingsAPI.getPublic();
      const settingsMap = {};
      response.data.forEach(s => {
        settingsMap[s.setting_key] = s.setting_value;
      });
      
      setSettings({
        ...defaultSettings,
        ...settingsMap
      });

      // Apply CSS custom properties for colors
      applyTheme(settingsMap);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (settingsMap) => {
    const root = document.documentElement;
    const themeMode = settingsMap.theme_mode || defaultSettings.theme_mode;
    const isDark = String(themeMode).toLowerCase() === 'dark';
    root.classList.toggle('theme-dark', isDark);
    
    // Apply primary color
    const primaryColor = settingsMap.primary_color || defaultSettings.primary_color;
    root.style.setProperty('--color-primary', primaryColor);
    // Convert hex to RGB for Tailwind
    const hex = primaryColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    root.style.setProperty('--color-primary-rgb', `${r}, ${g}, ${b}`);
    
    // Apply secondary color
    const secondaryColor = settingsMap.secondary_color || defaultSettings.secondary_color;
    root.style.setProperty('--color-secondary', secondaryColor);
    const hex2 = secondaryColor.replace('#', '');
    const r2 = parseInt(hex2.substring(0, 2), 16);
    const g2 = parseInt(hex2.substring(2, 4), 16);
    const b2 = parseInt(hex2.substring(4, 6), 16);
    root.style.setProperty('--color-secondary-rgb', `${r2}, ${g2}, ${b2}`);
    
    // Apply background colors
    if (isDark) {
      root.style.setProperty('--color-sidebar-bg', '#111827');
      root.style.setProperty('--color-header-bg', '#0f172a');
      root.style.setProperty('--color-page-bg', '#0b1120');
    } else {
      root.style.setProperty('--color-sidebar-bg', settingsMap.sidebar_bg_color || defaultSettings.sidebar_bg_color);
      root.style.setProperty('--color-header-bg', settingsMap.header_bg_color || defaultSettings.header_bg_color);
      root.style.setProperty('--color-page-bg', settingsMap.page_bg_color || defaultSettings.page_bg_color);
    }
    
    // Apply font family
    const fontFamily = settingsMap.font_family || defaultSettings.font_family;
    root.style.setProperty('--font-family', fontFamily);
    document.body.style.fontFamily = `${fontFamily}, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif`;
    
    // Apply sidebar width
    const sidebarWidth = settingsMap.sidebar_width || defaultSettings.sidebar_width;
    const widthMap = { compact: '200px', normal: '256px', wide: '300px' };
    root.style.setProperty('--sidebar-width', widthMap[sidebarWidth] || '256px');
    
    // Apply card style
    const cardStyle = settingsMap.card_style || defaultSettings.card_style;
    const borderRadiusMap = { rounded: '0.5rem', sharp: '0', pill: '1.5rem' };
    root.style.setProperty('--card-border-radius', borderRadiusMap[cardStyle] || '0.5rem');

    // Apply dashboard card gradient opacity
    const rawOpacity = parseFloat(settingsMap.dashboard_card_gradient_opacity || defaultSettings.dashboard_card_gradient_opacity);
    const safeOpacity = Number.isFinite(rawOpacity) ? Math.min(Math.max(rawOpacity, 0), 100) : 65;
    root.style.setProperty('--dashboard-card-gradient-opacity', (safeOpacity / 100).toString());

    // Apply hamburger menu color
    const hamburgerColor = settingsMap.hamburger_color || defaultSettings.hamburger_color;
    root.style.setProperty('--hamburger-color', hamburgerColor);
  };

  const refreshSettings = () => {
    fetchSettings();
  };

  const getSetting = (key, fallback = '') => {
    return settings[key] || fallback;
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        refreshSettings,
        getSetting
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
