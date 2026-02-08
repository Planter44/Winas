import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { performanceAppraisalAPI, userAPI, teamAPI } from '../services/api';
import { 
  Save, ArrowLeft, User, Calendar, Target, Award, 
  BookOpen, TrendingUp, MessageSquare, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle, Plus, Trash2, Download, Upload, 
  ZoomIn, ZoomOut, Printer, Search, Check
} from 'lucide-react';
import * as XLSX from 'xlsx';

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const normalizeSpecialType = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'par') return 'PAR';
  if (v === 'kpi') return 'KPI';
  return '';
};

const normalizeKpiCalcType = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (['percentage', 'percentage-based', 'percentage-based weighted', 'percentage weighted', 'percentage-weighted', 'weighted', '1'].includes(v)) {
    return 'percentage-weighted';
  }
  if (['target', 'target-ratio', 'ratio', '2'].includes(v)) return 'target-ratio';
  if (['compliance', 'compliant', '3'].includes(v)) return 'compliance';
  return '';
};

const formatKpiCalcType = (value) => {
  switch (normalizeKpiCalcType(value)) {
    case 'percentage-weighted':
      return 'Percentage-based weighted';
    case 'target-ratio':
      return 'Target-ratio';
    case 'compliance':
      return 'Compliance';
    default:
      return '';
  }
};

const getNumericInputWidth = (value, minWidth = 64) => {
  const length = String(value ?? '').length;
  const width = Math.max(minWidth, (length + 1) * 10 + 16);
  return `${width}px`;
};

// Helper function to create empty performance row with all months
const createEmptyRow = () => ({
  id: Date.now() + Math.random(),
  selected: false,
  specialType: '',
  kpiCalcType: '',
  parWeight: '',
  pillar: '',
  keyResultArea: '',
  target: '',
  janTarget: '', janActual: '', janPercent: 0,
  febTarget: '', febActual: '', febPercent: 0,
  marTarget: '', marActual: '', marPercent: 0,
  aprTarget: '', aprActual: '', aprPercent: 0,
  mayTarget: '', mayActual: '', mayPercent: 0,
  junTarget: '', junActual: '', junPercent: 0,
  julTarget: '', julActual: '', julPercent: 0,
  augTarget: '', augActual: '', augPercent: 0,
  sepTarget: '', sepActual: '', sepPercent: 0,
  octTarget: '', octActual: '', octPercent: 0,
  novTarget: '', novActual: '', novPercent: 0,
  decTarget: '', decActual: '', decPercent: 0,
  targetTotal: 0,
  actualTotal: 0,
  percentAchieved: 0,
  weight: 0,
  actualRating: 0,
  weightedAverage: 0
});

// Get months based on period type and selection
const getMonthsForPeriod = (periodType, periodQuarter, periodSemi) => {
  const allMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthLabels = {
    jan: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr', may: 'May', jun: 'Jun',
    jul: 'Jul', aug: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov', dec: 'Dec'
  };
  
  if (periodType === 'Quarterly') {
    const quarterMonths = {
      1: ['jan', 'feb', 'mar'],
      2: ['apr', 'may', 'jun'],
      3: ['jul', 'aug', 'sep'],
      4: ['oct', 'nov', 'dec']
    };
    return (quarterMonths[periodQuarter] || allMonths.slice(0, 3)).map(m => ({ key: m, label: monthLabels[m] }));
  } else if (periodType === 'Semi-annually') {
    const semiMonths = {
      1: ['jan', 'feb', 'mar', 'apr', 'may', 'jun'],
      2: ['jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    };
    return (semiMonths[periodSemi] || allMonths.slice(0, 6)).map(m => ({ key: m, label: monthLabels[m] }));
  } else {
    return allMonths.map(m => ({ key: m, label: monthLabels[m] }));
  }
};

// Helper function to get weight based on percentage
const getWeightFromPercentage = (percentage) => {
  const value = parseFloat(percentage) || 0;
  if (value <= 70) return 1;
  if (value <= 80) return 2;
  if (value <= 90) return 3;
  if (value <= 100) return 4;
  if (value <= 110) return 5;
  return 6;
};

const recalcPerformanceRow = (row, activeMonths) => {
  const next = { ...row };
  const activeMonthKeys = new Set((activeMonths || []).map((m) => m.key));

  const specialType = normalizeSpecialType(next.specialType);
  const kpiCalcType = normalizeKpiCalcType(next.kpiCalcType);
  const resolvedKpiCalcType = specialType === 'KPI' ? (kpiCalcType || 'percentage-weighted') : kpiCalcType;
  next.specialType = specialType;
  next.kpiCalcType = resolvedKpiCalcType;

  const parWeightValue = parseFloat(next.parWeight ?? next.parTarget);
  const resolvedParWeight = Number.isFinite(parWeightValue) ? parWeightValue : 0;
  if (specialType === 'PAR') {
    next.parWeight = Number.isFinite(parWeightValue) ? String(parWeightValue) : '';
  }

  const roundKpiPercent = (value) => (Number.isFinite(value) ? value.toFixed(2) : '0.00');

  let totalTarget = 0;
  let totalActual = 0;
  MONTH_KEYS.forEach((month) => {
    const target = parseFloat(next[`${month}Target`]) || 0;
    const actual = parseFloat(next[`${month}Actual`]) || 0;
    const isActive = activeMonthKeys.has(month);

    if (isActive) {
      totalTarget += target;
      totalActual += actual;
    }

    let percent = 0;
    if (specialType === 'PAR') {
      percent = target > 0 && actual > 0 ? Math.round((target / actual) * 100) : 0;
    } else if (specialType === 'KPI') {
      let kpiPercent = 0;
      if (resolvedKpiCalcType === 'target-ratio') {
        kpiPercent = target > 0 ? (actual / target) * 100 : 0;
      } else if (resolvedKpiCalcType === 'compliance') {
        if (target <= 0) {
          kpiPercent = actual >= target ? 100 : 0;
        } else if (actual >= target) {
          kpiPercent = 100;
        } else {
          kpiPercent = (actual / target) * 100;
        }
      } else {
        kpiPercent = (actual * target) / 100;
      }
      percent = roundKpiPercent(kpiPercent);
    } else {
      percent = target > 0 ? Math.round((actual / target) * 100) : 0;
    }

    next[`${month}Percent`] = percent;
  });

  let percentAchieved = 0;
  if (specialType === 'PAR') {
    const roundedTargetTotal = Math.abs(totalTarget) < 0.5 ? totalTarget : Math.round(totalTarget);
    next.targetTotal = roundedTargetTotal;
    next.actualTotal = totalActual;
    percentAchieved = roundedTargetTotal > 0 && totalActual > 0
      ? Math.round((roundedTargetTotal / totalActual) * 100 * resolvedParWeight)
      : 0;
  } else if (specialType === 'KPI') {
    const manualTargetTotal = parseFloat(next.targetTotal);
    const manualActualTotal = parseFloat(next.actualTotal);
    const resolvedTargetTotal = Number.isFinite(manualTargetTotal) ? manualTargetTotal : 0;
    const resolvedActualTotal = Number.isFinite(manualActualTotal) ? manualActualTotal : 0;
    percentAchieved = resolvedTargetTotal > 0
      ? Math.round((resolvedActualTotal / resolvedTargetTotal) * 100)
      : 0;
  } else {
    next.targetTotal = totalTarget;
    next.actualTotal = totalActual;
    percentAchieved = totalTarget > 0
      ? Math.round((totalActual / totalTarget) * 100)
      : 0;
  }

  next.percentAchieved = percentAchieved;
  next.actualRating = percentAchieved;
  next.weight = getWeightFromPercentage(percentAchieved);
  next.weightedAverage = parseFloat((percentAchieved * next.weight).toFixed(2));
  return next;
};

const getSoftSkillWeightFromRating = (rating) => {
  const value = parseFloat(rating) || 0;
  if (value <= 70) return 1;
  if (value <= 80) return 2;
  if (value <= 90) return 3;
  if (value <= 100) return 4;
  if (value <= 110) return 5;
  return 6;
};

const shouldHideSoftSkill = (skill) => {
  const name = (skill?.name || skill?.skill_name || '').trim().toLowerCase();
  const desc = (skill?.description || '').trim().toLowerCase();
  if (!name && !desc) return false;

  const blockedNames = new Set([
    'communication',
    'problem solving',
    'time management',
    'adaptability',
    'customer service'
  ]);

  if (blockedNames.has(name)) return true;
  if (name === 'teamwork' && desc.includes('ability to work collaboratively with others')) return true;
  return false;
};

const dedupeSoftSkills = (skills = []) => {
  const seen = new Set();
  return skills.filter((skill) => {
    const name = (skill?.name || skill?.skill_name || '').trim().toLowerCase();
    const desc = (skill?.description || '').trim().toLowerCase();
    const key = `${name}|${desc}`.trim();

    if (!name && !desc) {
      const idKey = `id:${skill?.id ?? ''}`;
      if (seen.has(idKey)) return false;
      seen.add(idKey);
      return true;
    }

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizePerformanceSectionsData = (data) => {
  if (!data) return null;
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (!Array.isArray(parsed)) return null;
    const ensureRow = (row) => {
      const base = createEmptyRow();
      const merged = { ...base, ...(row || {}) };
      merged.id = row?.id || merged.id;
      merged.selected = false;
      merged.pillar = merged.pillar ?? '';
      merged.keyResultArea = merged.keyResultArea ?? '';
      merged.target = merged.target ?? '';
      const normalizedSpecialType = normalizeSpecialType(merged.specialType);
      const normalizedKpiCalcType = normalizeKpiCalcType(merged.kpiCalcType);
      merged.specialType = normalizedSpecialType;
      merged.kpiCalcType = normalizedSpecialType === 'KPI'
        ? (normalizedKpiCalcType || 'percentage-weighted')
        : normalizedKpiCalcType;
      merged.parWeight = merged.parWeight ?? merged.parTarget ?? '';

      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      months.forEach((m) => {
        merged[`${m}Target`] = merged[`${m}Target`] ?? '';
        merged[`${m}Actual`] = merged[`${m}Actual`] ?? '';
        merged[`${m}Percent`] = merged[`${m}Percent`] ?? 0;
      });

      merged.targetTotal = merged.targetTotal ?? 0;
      merged.actualTotal = merged.actualTotal ?? 0;
      merged.percentAchieved = merged.percentAchieved ?? 0;
      merged.weight = parseFloat(merged.weight) || 0;
      merged.actualRating = merged.actualRating ?? 0;
      merged.weightedAverage = parseFloat(merged.weightedAverage) || 0;
      return merged;
    };

    return parsed.map((section, idx) => {
      const rows = Array.isArray(section?.rows) ? section.rows : [];
      const normalizedRows = rows.length > 0 ? rows.map(ensureRow) : [createEmptyRow()];
      const subtotalWeight = normalizedRows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);
      const subtotalWeightedAverage = normalizedRows.reduce((sum, r) => sum + (parseFloat(r.weightedAverage) || 0), 0);
      return {
        id: section?.id || `section_${idx}`,
        name: section?.name || section?.sectionName || `Section ${idx + 1}`,
        rows: normalizedRows,
        subtotalWeight,
        subtotalWeightedAverage,
        zoom: section?.zoom || 100
      };
    });
  } catch (e) {
    return null;
  }
};

const buildPerformanceSectionsFromScores = (scores) => {
  if (!Array.isArray(scores) || scores.length === 0) return null;
  const bySection = new Map();

  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const ensureRow = (score) => {
    const base = createEmptyRow();
    const row = {
      ...base,
      selected: false,
      pillar: score?.pillar || '',
      keyResultArea: score?.key_result_area || '',
      target: score?.target_description || ''
    };
    months.forEach((m) => {
      row[`${m}Target`] = score?.[`${m}_target`] ?? '';
      row[`${m}Actual`] = score?.[`${m}_actual`] ?? '';
      row[`${m}Percent`] = score?.[`${m}_percent`] ?? 0;
    });
    row.targetTotal = score?.target_total ?? 0;
    row.actualTotal = score?.actual_total ?? 0;
    row.percentAchieved = score?.percent_achieved ?? 0;
    row.weight = score?.weight ?? 0;
    row.actualRating = score?.actual_rating ?? 0;
    row.weightedAverage = score?.weighted_average ?? 0;
    return row;
  };

  scores.forEach((s) => {
    const sectionName = s?.section_name || 'Section B';
    const entry = bySection.get(sectionName) || { name: sectionName, rows: [] };
    entry.rows.push(ensureRow(s));
    bySection.set(sectionName, entry);
  });

  const sections = Array.from(bySection.values()).map((section, idx) => {
    const subtotalWeight = section.rows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);
    const subtotalWeightedAverage = section.rows.reduce((sum, r) => sum + (parseFloat(r.weightedAverage) || 0), 0);
    return {
      id: `section_${idx}`,
      name: section.name,
      rows: section.rows.length > 0 ? section.rows : [createEmptyRow()],
      subtotalWeight,
      subtotalWeightedAverage,
      zoom: 100
    };
  });

  return sections.length > 0 ? sections : null;
};

const buildPerformanceSectionsFromKraScores = (kraScores) => {
  if (!Array.isArray(kraScores) || kraScores.length === 0) return null;

  const normalize = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  const categorizePillarToSectionName = (pillarName) => {
    const p = normalize(pillarName);
    if (!p) return null;

    if (p.includes('member') || p.includes('retention') || p.includes('customer')) {
      return 'Membership & Customer Satisfaction';
    }
    if (p.includes('finance') || p.includes('credit')) {
      return 'Finance & Credit';
    }
    if (p.includes('operation') || p.includes('audit') || p.includes('ict') || p.includes('hr') || p.includes('risk') || p.includes('business')) {
      return 'Business Operations, Audit, ICT & HR';
    }
    return null;
  };

  const sectionTemplates = [
    { id: 'membership', name: 'Membership & Customer Satisfaction', zoom: 100 },
    { id: 'finance', name: 'Finance & Credit', zoom: 100 },
    { id: 'operations', name: 'Business Operations, Audit, ICT & HR', zoom: 100 }
  ];
  const templateNames = new Set(sectionTemplates.map(s => normalize(s.name)));

  const bySection = new Map();
  const ensureSection = (name) => {
    const key = normalize(name);
    const existing = bySection.get(key);
    if (existing) return existing;
    const created = { name, rows: [] };
    bySection.set(key, created);
    return created;
  };

  kraScores.forEach((s) => {
    const pillarName = (s?.pillar_name || s?.pillarName || s?.pillar || '').trim();

    const inferredSectionName = categorizePillarToSectionName(pillarName);
    const matchedTemplate = sectionTemplates.find(t => normalize(t.name) === normalize(inferredSectionName));
    const sectionName = matchedTemplate?.name || 'Business Operations, Audit, ICT & HR';
    const section = ensureSection(sectionName);

    const row = createEmptyRow();
    row.selected = false;
    row.pillar = pillarName;
    row.keyResultArea = s?.kra_name || s?.kraName || s?.key_result_area || s?.keyResultArea || '';
    row.target = s?.target_description ?? s?.target ?? '';

    months.forEach((m) => {
      row[`${m}Target`] = s?.[`${m}_target`] ?? '';
      row[`${m}Actual`] = s?.[`${m}_actual`] ?? '';
      row[`${m}Percent`] = s?.[`${m}_percent`] ?? 0;
    });

    row.targetTotal = s?.target_total ?? 0;
    row.actualTotal = s?.actual_total ?? 0;
    row.percentAchieved = s?.percent_achieved ?? 0;
    row.actualRating = row.percentAchieved;
    row.weight = getWeightFromPercentage(row.percentAchieved);
    row.weightedAverage = s?.weighted_average ?? parseFloat((row.percentAchieved * row.weight).toFixed(2));
    section.rows.push(row);
  });

  const extraSections = Array.from(bySection.values()).filter(s => !templateNames.has(normalize(s.name)));
  const finalSections = [...sectionTemplates, ...extraSections.map((s, idx) => ({ id: `extra_${idx}`, name: s.name, zoom: 100 }))]
    .map((template) => {
      const key = normalize(template.name);
      const rows = bySection.get(key)?.rows || [];
      const normalizedRows = rows.length > 0 ? rows : [createEmptyRow()];
      const subtotalWeight = normalizedRows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);
      const subtotalWeightedAverage = normalizedRows.reduce((sum, r) => sum + (parseFloat(r.weightedAverage) || 0), 0);
      return {
        id: template.id,
        name: template.name,
        rows: normalizedRows,
        subtotalWeight,
        subtotalWeightedAverage,
        zoom: template.zoom || 100
      };
    });

  return finalSections.length > 0 ? finalSections : null;
};

const PerformanceAppraisalForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, hasRole } = useAuth();
  const toast = useToast();
  const isEdit = Boolean(id) && id !== 'new';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSection, setSavingSection] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [appraisalOwnerId, setAppraisalOwnerId] = useState(null);

  const initialSnapshotRef = useRef('');
  const initializedRef = useRef(false);
  const sectionBImportRef = useRef(null);
  const [isDirty, setIsDirty] = useState(false);

  // Form data
  const [employees, setEmployees] = useState([]);
  const [pillars, setPillars] = useState([]);
  const [softSkills, setSoftSkills] = useState([]);
  const [ratingKey, setRatingKey] = useState([]);

  // Section visibility
  const [expandedSections, setExpandedSections] = useState({
    employee: true,
    targets: true,
    softSkills: true,
    courses: false,
    development: false,
    comments: false
  });

  // Employee search
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  // Employee details (Section A)
  const [employeeData, setEmployeeData] = useState({
    userId: '',
    branchDepartment: '',
    position: '',
    pfNumber: '',
    supervisorDesignation: '',
    periodType: 'Quarterly',
    periodYear: new Date().getFullYear(),
    periodQuarter: Math.ceil((new Date().getMonth() + 1) / 3),
    periodSemi: 1,
    appraisalDate: new Date().toISOString().split('T')[0]
  });

  // Performance Sections (Section B) - Multiple categories
  const [performanceSections, setPerformanceSections] = useState([
    {
      id: 'membership',
      name: 'Membership & Customer Satisfaction',
      rows: [createEmptyRow()],
      subtotalWeight: 0,
      subtotalWeightedAverage: 0,
      zoom: 100
    },
    {
      id: 'finance',
      name: 'Finance & Credit',
      rows: [createEmptyRow()],
      subtotalWeight: 0,
      subtotalWeightedAverage: 0,
      zoom: 100
    },
    {
      id: 'operations',
      name: 'Business Operations, Audit, ICT & HR',
      rows: [createEmptyRow()],
      subtotalWeight: 0,
      subtotalWeightedAverage: 0,
      zoom: 100
    }
  ]);

  // Legacy KRA Scores for backward compatibility
  const [kraScores, setKraScores] = useState([]);

  // Soft Skills Scores (Section C)
  const [softSkillScores, setSoftSkillScores] = useState([]);

  // Courses attended (Part F)
  const [courses, setCourses] = useState([{ name: '', comments: '' }]);

  // Development Plans (Part F)
  const [developmentPlans, setDevelopmentPlans] = useState([
    { description: '', managerActions: '', targetDate: '' }
  ]);

  // Comments
  const [comments, setComments] = useState({
    appraisee: '',
    appraiser: '',
    hod: '',
    hr: '',
    ceo: ''
  });
  const [appraiseeRoleName, setAppraiseeRoleName] = useState('');

  const isCeo = hasRole('CEO');
  const isSuperAdmin = hasRole('Super Admin');
  const isPrivileged = isCeo || hasRole('HR') || isSuperAdmin;
  const isHod = hasRole('HOD');
  const effectiveOwnerId = isEdit ? (appraisalOwnerId ?? employeeData.userId) : employeeData.userId;
  const isOwnAppraisal = effectiveOwnerId && user?.id && String(user.id) === String(effectiveOwnerId);
  const allowOwnEdits = !isOwnAppraisal || isCeo;

  const normalizedAppraiseeRole = String(appraiseeRoleName || '').trim().toLowerCase();
  const isHodAppraisee = normalizedAppraiseeRole === 'hod';
  const isHrAppraisee = ['hr', 'hr manager', 'human resource', 'human resources'].includes(normalizedAppraiseeRole);
  const resolvedHodComments = isHodAppraisee ? 'Not Applicable' : comments.hod;
  const resolvedHrComments = isHrAppraisee ? 'Not Applicable' : comments.hr;

  const canEditEmployeeDetails = (hasRole('HOD') || hasRole('HR') || isCeo || isSuperAdmin) && (!isEdit || allowOwnEdits);
  const canEditSectionB = (isPrivileged || isHod) && allowOwnEdits;
  const canEditSectionC = (isPrivileged || isHod || (hasRole('Supervisor') && !isOwnAppraisal)) && allowOwnEdits;
  const canEditCourses = (isPrivileged || isHod) && allowOwnEdits;
  const canEditDevelopmentPlans = (isPrivileged || isHod) && allowOwnEdits;

  const canEditAppraiseeComments = isOwnAppraisal || isCeo;
  const canEditAppraiserComments = (isPrivileged || isHod || (hasRole('Supervisor') && !isOwnAppraisal)) && allowOwnEdits;
  const canEditHodComments = (isCeo || hasRole('HOD')) && allowOwnEdits && !isHodAppraisee;
  const canEditHrComments = (isCeo || hasRole('HR')) && allowOwnEdits && !isHrAppraisee;
  const canEditCeoComments = isCeo;

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  useEffect(() => {
    if (!initializedRef.current) return;

    const activeMonths = getMonthsForPeriod(employeeData.periodType, employeeData.periodQuarter, employeeData.periodSemi);

    setPerformanceSections(prev => {
      const updated = prev.map((s) => {
        const rows = Array.isArray(s?.rows) ? s.rows : [];
        const nextRows = rows.map((r) => recalcPerformanceRow(r, activeMonths));

        return {
          ...s,
          rows: nextRows,
          subtotalWeight: nextRows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0),
          subtotalWeightedAverage: nextRows.reduce((sum, r) => sum + (parseFloat(r.weightedAverage) || 0), 0)
        };
      });

      return updated;
    });
  }, [employeeData.periodType, employeeData.periodQuarter, employeeData.periodSemi]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      // Fetch all required data in parallel
      const canListAllUsers = hasRole('HR') || hasRole('CEO') || hasRole('Super Admin');
      const canListTeam = hasRole('HOD') || hasRole('Supervisor');

      const employeesPromise = canListTeam
        ? teamAPI.getMyTeam()
        : (canListAllUsers ? userAPI.getAll({ limit: 500 }) : Promise.resolve({ data: { users: [] } }));

      const [pillarsRes, softSkillsRes, ratingKeyRes, employeesRes] = await Promise.all([
        performanceAppraisalAPI.getPillars(),
        performanceAppraisalAPI.getSoftSkills(),
        performanceAppraisalAPI.getRatingKey(),
        employeesPromise
      ]);

      setPillars(pillarsRes.data);
      const dedupedSoftSkills = dedupeSoftSkills(softSkillsRes.data || []);
      setSoftSkills(dedupedSoftSkills);
      setRatingKey(ratingKeyRes.data);
      const employeeList = canListTeam
        ? (employeesRes.data?.teamMembers || [])
        : (employeesRes.data?.users || employeesRes.data);
      setEmployees(employeeList);

      // Initialize KRA scores from pillars
      const initialKraScores = [];
      pillarsRes.data.forEach(pillar => {
        pillar.kras?.forEach(kra => {
          initialKraScores.push({
            kraId: kra.id,
            kraName: kra.name,
            pillarName: pillar.name,
            weight: kra.weight || 0,
            target: '',
            actualAchievement: '',
            janTarget: '', janActual: '', janPercent: 0,
            febTarget: '', febActual: '', febPercent: 0,
            marTarget: '', marActual: '', marPercent: 0,
            aprTarget: '', aprActual: '', aprPercent: 0,
            mayTarget: '', mayActual: '', mayPercent: 0,
            junTarget: '', junActual: '', junPercent: 0,
            targetTotal: 0,
            actualTotal: 0,
            percentAchieved: 0,
            weightedAverage: 0,
            supervisorComments: ''
          });
        });
      });
      setKraScores(initialKraScores);

      // Initialize soft skill scores
      const initialSoftSkillScores = (dedupedSoftSkills || []).filter(skill => !shouldHideSoftSkill(skill)).map(skill => ({
        softSkillId: skill.id,
        skillName: skill.name,
        description: skill.description,
        weight: 0,
        rating: '',
        weightedScore: 0,
        comments: ''
      }));
      setSoftSkillScores(initialSoftSkillScores);

      // If editing, fetch existing appraisal
      if (isEdit) {
        const appraisalRes = await performanceAppraisalAPI.getById(id);
        const appraisal = appraisalRes.data;

        setAppraisalOwnerId(appraisal?.user_id || null);
        setAppraiseeRoleName(appraisal?.role_name || '');
        
        setEmployeeData({
          userId: appraisal.user_id,
          branchDepartment: appraisal.branch_department || '',
          position: appraisal.position || '',
          pfNumber: appraisal.pf_number || '',
          supervisorDesignation: appraisal.supervisor_designation || '',
          periodType: appraisal.period_type || 'Quarterly',
          periodYear: appraisal.period_year,
          periodQuarter: appraisal.period_quarter || 1,
          periodSemi: appraisal.period_semi || 1,
          appraisalDate: appraisal.appraisal_date?.split('T')[0] || ''
        });

        const fromData = normalizePerformanceSectionsData(appraisal.performanceSectionsData);
        if (fromData) {
          setPerformanceSections(fromData);
        } else {
          const fromScores = buildPerformanceSectionsFromScores(appraisal.performanceSectionScores);
          if (fromScores) {
            setPerformanceSections(fromScores);
          } else {
            const fromKra = buildPerformanceSectionsFromKraScores(appraisal.kraScores);
            if (fromKra) {
              setPerformanceSections(fromKra);
            }
          }
        }

        // Map existing KRA scores
        if (appraisal.kraScores?.length > 0) {
          const mappedKraScores = initialKraScores.map(kra => {
            const existing = appraisal.kraScores.find(s => s.kra_id === kra.kraId);
            if (existing) {
              return {
                ...kra,
                target: existing.target || '',
                actualAchievement: existing.actual_achievement || '',
                janTarget: existing.jan_target || '',
                janActual: existing.jan_actual || '',
                janPercent: existing.jan_percent || 0,
                febTarget: existing.feb_target || '',
                febActual: existing.feb_actual || '',
                febPercent: existing.feb_percent || 0,
                marTarget: existing.mar_target || '',
                marActual: existing.mar_actual || '',
                marPercent: existing.mar_percent || 0,
                aprTarget: existing.apr_target || '',
                aprActual: existing.apr_actual || '',
                aprPercent: existing.apr_percent || 0,
                mayTarget: existing.may_target || '',
                mayActual: existing.may_actual || '',
                mayPercent: existing.may_percent || 0,
                junTarget: existing.jun_target || '',
                junActual: existing.jun_actual || '',
                junPercent: existing.jun_percent || 0,
                targetTotal: existing.target_total || 0,
                actualTotal: existing.actual_total || 0,
                percentAchieved: existing.percent_achieved || 0,
                weightedAverage: existing.weighted_average || 0,
                supervisorComments: existing.supervisor_comments || ''
              };
            }
            return kra;
          });
          setKraScores(mappedKraScores);
        }

        // Map existing soft skill scores
        if (appraisal.softSkillScores?.length > 0) {
          const mappedSoftSkillScores = initialSoftSkillScores.map(skill => {
            const existing = appraisal.softSkillScores.find(s => s.soft_skill_id === skill.softSkillId);
            if (existing) {
              const ratingNum = parseFloat(existing.rating) || 0;
              const weightNum = getSoftSkillWeightFromRating(ratingNum);
              return {
                ...skill,
                rating: existing.rating || '',
                weight: weightNum,
                weightedScore: parseFloat((weightNum * ratingNum).toFixed(2)),
                comments: existing.comments || ''
              };
            }
            return skill;
          });
          setSoftSkillScores(mappedSoftSkillScores);
        }

        // Map courses
        if (appraisal.courses?.length > 0) {
          setCourses(appraisal.courses.map(c => ({
            name: c.course_name || '',
            comments: c.comments || ''
          })));
        }

        // Map development plans
        if (appraisal.developmentPlans?.length > 0) {
          setDevelopmentPlans(appraisal.developmentPlans.map(p => ({
            description: p.plan_description || '',
            managerActions: p.manager_actions || '',
            targetDate: p.target_completion_date?.split('T')[0] || ''
          })));
        }

        // Map comments
        setComments({
          appraisee: appraisal.appraisee_comments || '',
          appraiser: appraisal.appraiser_comments || '',
          hod: appraisal.hod_comments || '',
          hr: appraisal.hr_comments || '',
          ceo: appraisal.ceo_comments || ''
        });
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load form data');
      toast.error('Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleEmployeeChange = (e) => {
    const { name, value } = e.target;
    setEmployeeData(prev => ({ ...prev, [name]: value }));

    // Auto-fill employee details when selected
    if (name === 'userId' && value) {
      const selectedEmployee = employees.find(emp => emp.id === parseInt(value));
      if (selectedEmployee) {
        setEmployeeData(prev => ({
          ...prev,
          userId: value,
          branchDepartment: selectedEmployee.department_name || '',
          position: selectedEmployee.job_title || '',
          pfNumber: selectedEmployee.employee_number || ''
        }));
        setAppraiseeRoleName(selectedEmployee.role_name || '');
      }
    } else if (name === 'userId') {
      setAppraiseeRoleName('');
    }
  };

  useEffect(() => {
    if (!employeeData.userId) {
      if (appraiseeRoleName) setAppraiseeRoleName('');
      return;
    }

    const selectedEmployee = employees.find(emp => emp.id === parseInt(employeeData.userId));
    if (selectedEmployee?.role_name && selectedEmployee.role_name !== appraiseeRoleName) {
      setAppraiseeRoleName(selectedEmployee.role_name);
    }
  }, [employeeData.userId, employees, appraiseeRoleName]);

  const handleKraScoreChange = (index, field, value) => {
    setKraScores(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Auto-calculate percentages and totals
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun'];
      let totalTarget = 0;
      let totalActual = 0;
      
      months.forEach(month => {
        const target = parseFloat(updated[index][`${month}Target`]) || 0;
        const actual = parseFloat(updated[index][`${month}Actual`]) || 0;
        totalTarget += target;
        totalActual += actual;
        
        // Calculate monthly percentage
        if (target > 0) {
          updated[index][`${month}Percent`] = ((actual / target) * 100).toFixed(1);
        }
      });
      
      updated[index].targetTotal = totalTarget;
      updated[index].actualTotal = totalActual;
      
      // Calculate overall percentage achieved
      if (totalTarget > 0) {
        updated[index].percentAchieved = ((totalActual / totalTarget) * 100).toFixed(1);
      }
      
      // Calculate weighted average (weight * percentage / 100)
      const weight = parseFloat(updated[index].weight) || 0;
      const percent = parseFloat(updated[index].percentAchieved) || 0;
      updated[index].weightedAverage = ((weight * percent) / 100).toFixed(2);
      
      return updated;
    });
  };

  const handleSoftSkillChange = (index, field, value) => {
    setSoftSkillScores(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Auto-derive weight from rating thresholds and calculate weighted score (weight * rating)
      if (field === 'rating') {
        const rating = parseFloat(value) || 0;
        const weight = getSoftSkillWeightFromRating(rating);
        updated[index].weight = weight;
        updated[index].weightedScore = (weight * rating).toFixed(2);
      }
      
      return updated;
    });
  };

  const addCourse = () => {
    setCourses(prev => [...prev, { name: '', comments: '' }]);
  };

  const removeCourse = (index) => {
    setCourses(prev => prev.filter((_, i) => i !== index));
  };

  const handleCourseChange = (index, field, value) => {
    setCourses(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addDevelopmentPlan = () => {
    setDevelopmentPlans(prev => [...prev, { description: '', managerActions: '', targetDate: '' }]);
  };

  const removeDevelopmentPlan = (index) => {
    setDevelopmentPlans(prev => prev.filter((_, i) => i !== index));
  };

  const handleDevelopmentPlanChange = (index, field, value) => {
    setDevelopmentPlans(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const promptSpecialRowConfig = (currentRow = {}) => {
    const currentType = normalizeSpecialType(currentRow.specialType);
    let specialType = '';

    while (true) {
      const input = window.prompt('Special row type (PAR or KPI):', currentType || '');
      if (input === null) return null;
      const resolved = normalizeSpecialType(input);
      if (resolved) {
        specialType = resolved;
        break;
      }
      window.alert('Please enter PAR or KPI.');
    }

    if (specialType === 'PAR') {
      while (true) {
        const input = window.prompt('Enter PAR Weight (numeric):', currentRow.parWeight ?? currentRow.parTarget ?? '');
        if (input === null) return null;
        const num = parseFloat(input);
        if (Number.isFinite(num)) {
          return { specialType: 'PAR', kpiCalcType: '', parWeight: String(num) };
        }
        window.alert('Please enter a valid numeric PAR Weight.');
      }
    }

    const defaultCalcType = formatKpiCalcType(currentRow.kpiCalcType) || 'Percentage-based weighted';
    while (true) {
      const input = window.prompt(
        'KPI calculation type: 1=Percentage-based weighted, 2=Target-ratio, 3=Compliance',
        defaultCalcType
      );
      if (input === null) return null;
      const normalized = input.trim() === '' ? 'percentage-based weighted' : normalizeKpiCalcType(input);
      if (normalized) {
        return { specialType: 'KPI', kpiCalcType: normalized, parWeight: '' };
      }
      window.alert('Please enter 1, 2, 3, or a valid KPI calculation type.');
    }
  };

  // ===== SECTION B HANDLERS =====
  
  // Handle performance row changes
  const handlePerformanceRowChange = (sectionIndex, rowIndex, field, value) => {
    setPerformanceSections(prev => {
      const updated = [...prev];
      const section = { ...updated[sectionIndex] };
      const rows = [...section.rows];
      const activeMonths = getMonthsForPeriod(employeeData.periodType, employeeData.periodQuarter, employeeData.periodSemi);
      const row = recalcPerformanceRow({ ...rows[rowIndex], [field]: value }, activeMonths);
      rows[rowIndex] = row;
      section.rows = rows;
      
      // Update section subtotals
      section.subtotalWeight = rows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);
      section.subtotalWeightedAverage = rows.reduce((sum, r) => sum + (parseFloat(r.weightedAverage) || 0), 0);
      
      updated[sectionIndex] = section;
      return updated;
    });
  };

  // Add performance row
  const addPerformanceRow = (sectionIndex) => {
    setPerformanceSections(prev => {
      const updated = [...prev];
      const section = { ...updated[sectionIndex] };
      section.rows = [...section.rows, createEmptyRow()];
      updated[sectionIndex] = section;
      return updated;
    });
  };

  const addOrConvertSpecialRow = (sectionIndex) => {
    const section = performanceSections[sectionIndex];
    if (!section) return;

    const selectedRow = (section.rows || []).find((row) => row.selected);
    const config = promptSpecialRowConfig(selectedRow || {});
    if (!config) return;

    const activeMonths = getMonthsForPeriod(employeeData.periodType, employeeData.periodQuarter, employeeData.periodSemi);

    setPerformanceSections(prev => {
      const updated = [...prev];
      const nextSection = { ...updated[sectionIndex] };
      const rows = [...nextSection.rows];
      const selectedIndexes = rows.reduce((acc, row, idx) => {
        if (row.selected) acc.push(idx);
        return acc;
      }, []);

      if (selectedIndexes.length > 0) {
        selectedIndexes.forEach((idx) => {
          rows[idx] = recalcPerformanceRow({ ...rows[idx], ...config }, activeMonths);
        });
      } else {
        rows.push(recalcPerformanceRow({ ...createEmptyRow(), ...config }, activeMonths));
      }

      nextSection.rows = rows;
      nextSection.subtotalWeight = rows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);
      nextSection.subtotalWeightedAverage = rows.reduce((sum, r) => sum + (parseFloat(r.weightedAverage) || 0), 0);

      updated[sectionIndex] = nextSection;
      return updated;
    });
  };

  // Delete selected rows
  const deleteSelectedRows = (sectionIndex) => {
    setPerformanceSections(prev => {
      const updated = [...prev];
      const section = { ...updated[sectionIndex] };
      const remainingRows = section.rows.filter(row => !row.selected);
      section.rows = remainingRows.length > 0 ? remainingRows : [createEmptyRow()];
      
      // Recalculate subtotals
      section.subtotalWeight = section.rows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);
      section.subtotalWeightedAverage = section.rows.reduce((sum, r) => sum + (parseFloat(r.weightedAverage) || 0), 0);
      
      updated[sectionIndex] = section;
      return updated;
    });
  };

  // Toggle row selection
  const toggleRowSelection = (sectionIndex, rowIndex) => {
    setPerformanceSections(prev => {
      const updated = [...prev];
      const section = { ...updated[sectionIndex] };
      const rows = [...section.rows];
      rows[rowIndex] = { ...rows[rowIndex], selected: !rows[rowIndex].selected };
      section.rows = rows;
      updated[sectionIndex] = section;
      return updated;
    });
  };

  // Toggle all rows selection
  const toggleAllRows = (sectionIndex, checked) => {
    setPerformanceSections(prev => {
      const updated = [...prev];
      const section = { ...updated[sectionIndex] };
      section.rows = section.rows.map(row => ({ ...row, selected: checked }));
      updated[sectionIndex] = section;
      return updated;
    });
  };

  // Handle zoom change
  const handleZoomChange = (sectionIndex, value) => {
    setPerformanceSections(prev => {
      const updated = [...prev];
      updated[sectionIndex] = { ...updated[sectionIndex], zoom: value };
      return updated;
    });
  };

  // Export all sections to CSV
  const exportAllSectionsToCSV = () => {
    const activeMonths = getMonthsForPeriod(employeeData.periodType, employeeData.periodQuarter, employeeData.periodSemi);
    
    // Build headers dynamically based on active months
    const monthHeaders = activeMonths.flatMap(m => [`${m.label} Target`, `${m.label} Actual`, `${m.label} %`]);
    const headers = [
      'Section',
      'Pillar',
      'Key Result Area',
      'Target',
      'Special Type',
      'KPI Calc Type',
      'PAR Weight',
      ...monthHeaders,
      'Total Target',
      'Total Actual',
      '% Achieved',
      'Weight',
      'Actual Rating',
      'Weighted Average'
    ];
    
    let allRows = [];
    performanceSections.forEach(section => {
      section.rows.forEach(row => {
        const monthData = activeMonths.flatMap(m => [
          row[`${m.key}Target`] || '',
          row[`${m.key}Actual`] || '',
          `${row[`${m.key}Percent`] || 0}%`
        ]);
        allRows.push([
          `"${section.name}"`,
          `"${row.pillar || ''}"`,
          `"${row.keyResultArea || ''}"`,
          `"${row.target || ''}"`,
          `"${row.specialType || ''}"`,
          `"${formatKpiCalcType(row.kpiCalcType) || row.kpiCalcType || ''}"`,
          `"${row.parWeight || ''}"`,
          ...monthData,
          row.targetTotal || 0,
          row.actualTotal || 0,
          `${row.percentAchieved || 0}%`,
          row.weight || 0,
          row.actualRating || 0,
          row.weightedAverage || 0
        ].join(','));
      });
      // Add subtotal row
      allRows.push([
        `"SUBTOTAL: ${section.name}"`,
        '',
        '',
        '',
        '',
        '',
        '',
        ...Array(activeMonths.length * 3).fill(''),
        '',
        '',
        '',
        section.subtotalWeight,
        '',
        (parseFloat(section.subtotalWeightedAverage) || 0).toFixed(2)
      ].join(','));
      allRows.push(''); // Empty row between sections
    });
    
    const csvContent = [headers.join(','), ...allRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Performance_Targets_${employeeData.periodYear}_${employeeData.periodType}.csv`;
    link.click();
  };

  const parseCsvTable = (csvText) => {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const c = csvText[i];
      const next = csvText[i + 1];

      if (c === '"') {
        if (inQuotes && next === '"') {
          field += '"';
          i++;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }

      if (!inQuotes && c === ',') {
        row.push(field);
        field = '';
        continue;
      }

      if (!inQuotes && (c === '\n' || c === '\r')) {
        if (c === '\r' && next === '\n') i++;
        row.push(field);
        field = '';
        const nonEmpty = row.some((v) => String(v ?? '').trim() !== '');
        if (nonEmpty) rows.push(row);
        row = [];
        continue;
      }

      field += c;
    }

    row.push(field);
    const nonEmpty = row.some((v) => String(v ?? '').trim() !== '');
    if (nonEmpty) rows.push(row);
    return rows;
  };

  const parseSectionBTable = (table) => {
    if (!Array.isArray(table) || table.length < 2) {
      return { grouped: new Map(), unknownSections: [] };
    }

    const normalize = (v) => String(v ?? '').trim().toLowerCase();

    const headers = (table[0] || []).map((h) => String(h ?? '').trim());
    const idxSection = headers.findIndex((h) => normalize(h) === 'section');
    const idxPillar = headers.findIndex((h) => normalize(h) === 'pillar');
    const idxKra = headers.findIndex((h) => normalize(h) === 'key result area');
    const idxTargetDesc = headers.findIndex((h) => normalize(h) === 'target');
    const idxSpecialType = headers.findIndex((h) => ['special type', 'special', 'row type', 'special row type'].includes(normalize(h)));
    const idxKpiCalcType = headers.findIndex((h) => ['kpi calc type', 'kpi calculation type', 'kpi type', 'kpi calculation'].includes(normalize(h)));
    const idxParWeight = headers.findIndex((h) => ['par weight', 'par target', 'par target value', 'par value'].includes(normalize(h)));
    const idxTotalTarget = headers.findIndex((h) => normalize(h) === 'total target');
    const idxTotalActual = headers.findIndex((h) => normalize(h) === 'total actual');

    const monthLabelToKey = {
      jan: 'jan', feb: 'feb', mar: 'mar', apr: 'apr', may: 'may', jun: 'jun',
      jul: 'jul', aug: 'aug', sep: 'sep', oct: 'oct', nov: 'nov', dec: 'dec'
    };

    const monthCols = [];
    headers.forEach((h, idx) => {
      const m = String(h || '').trim().match(/^([A-Za-z]{3})\s+(Target|Actual|%)$/);
      if (!m) return;
      const monthKey = monthLabelToKey[normalize(m[1])];
      if (!monthKey) return;
      monthCols.push({ idx, monthKey, kind: normalize(m[2]) });
    });

    const activeMonths = getMonthsForPeriod(employeeData.periodType, employeeData.periodQuarter, employeeData.periodSemi);
    const activeSet = new Set(activeMonths.map((m) => m.key));
    const recalcRow = (row) => recalcPerformanceRow(row, activeMonths);

    const grouped = new Map();
    const unknownSections = [];

    for (let r = 1; r < table.length; r++) {
      const raw = table[r] || [];
      const sectionName = idxSection >= 0 ? String(raw[idxSection] ?? '').trim() : '';
      if (!sectionName) continue;
      if (normalize(sectionName).startsWith('subtotal:')) continue;

      const pillar = idxPillar >= 0 ? String(raw[idxPillar] ?? '').trim() : '';
      const keyResultArea = idxKra >= 0 ? String(raw[idxKra] ?? '').trim() : '';
      const target = idxTargetDesc >= 0 ? String(raw[idxTargetDesc] ?? '').trim() : '';

      const templateNames = new Set([
        'membership & customer satisfaction',
        'finance & credit',
        'business operations, audit, ict & hr'
      ]);

      const sectionKey = normalize(sectionName);
      if (!templateNames.has(sectionKey)) {
        unknownSections.push(sectionName);
        continue;
      }

      if (!pillar && !keyResultArea && !target) continue;

      const row = createEmptyRow();
      row.pillar = pillar;
      row.keyResultArea = keyResultArea;
      row.target = target;
      if (idxSpecialType >= 0) row.specialType = String(raw[idxSpecialType] ?? '').trim();
      if (idxKpiCalcType >= 0) row.kpiCalcType = String(raw[idxKpiCalcType] ?? '').trim();
      if (idxParWeight >= 0) row.parWeight = String(raw[idxParWeight] ?? '').trim();
      const rawTotalTarget = idxTotalTarget >= 0 ? String(raw[idxTotalTarget] ?? '').trim() : '';
      const rawTotalActual = idxTotalActual >= 0 ? String(raw[idxTotalActual] ?? '').trim() : '';
      if (idxTotalTarget >= 0) row.targetTotal = rawTotalTarget;
      if (idxTotalActual >= 0) row.actualTotal = rawTotalActual;

      monthCols.forEach(({ idx, monthKey, kind }) => {
        const value = String(raw[idx] ?? '').trim();
        if (!activeSet.has(monthKey)) return;
        if (kind === 'target') row[`${monthKey}Target`] = value;
        if (kind === 'actual') row[`${monthKey}Actual`] = value;
      });

      const derivedTotals = activeMonths.reduce(
        (acc, month) => {
          const targetVal = parseFloat(row[`${month.key}Target`]) || 0;
          const actualVal = parseFloat(row[`${month.key}Actual`]) || 0;
          acc.target += targetVal;
          acc.actual += actualVal;
          return acc;
        },
        { target: 0, actual: 0 }
      );
      if (normalizeSpecialType(row.specialType) === 'KPI') {
        const parsedTarget = parseFloat(row.targetTotal);
        const parsedActual = parseFloat(row.actualTotal);
        const shouldDeriveTarget = idxTotalTarget < 0
          || rawTotalTarget === ''
          || !Number.isFinite(parsedTarget)
          || (parsedTarget === 0 && derivedTotals.target !== 0);
        const shouldDeriveActual = idxTotalActual < 0
          || rawTotalActual === ''
          || !Number.isFinite(parsedActual)
          || (parsedActual === 0 && derivedTotals.actual !== 0);
        if (shouldDeriveTarget) row.targetTotal = derivedTotals.target;
        if (shouldDeriveActual) row.actualTotal = derivedTotals.actual;
      }

      recalcRow(row);

      const rowsForSection = grouped.get(sectionKey) || [];
      rowsForSection.push(row);
      grouped.set(sectionKey, rowsForSection);
    }

    return { grouped, unknownSections: Array.from(new Set(unknownSections)) };
  };

  const importSectionBFromFile = async (file) => {
    if (!file) return;

    if (!canEditSectionB) {
      toast.error('You do not have permission to edit Section B');
      return;
    }

    const ok = window.confirm('Import will replace current Section B rows for any sections found in the file. Continue?');
    if (!ok) return;

    const fileName = String(file.name || '').toLowerCase();
    let table = [];

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheetName = wb.SheetNames?.[0];
      const ws = sheetName ? wb.Sheets[sheetName] : null;
      table = ws ? XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) : [];
    } else {
      const text = await file.text();
      table = parseCsvTable(text);
    }

    const { grouped, unknownSections } = parseSectionBTable(table);

    if (unknownSections.length > 0) {
      toast.error(`Unrecognized section(s) in import file: ${unknownSections.join(', ')}`);
    }

    const normalize = (v) => String(v ?? '').trim().toLowerCase();

    setPerformanceSections((prev) => {
      const updated = prev.map((section) => {
        const key = normalize(section.name);
        const importedRows = grouped.get(key);
        if (!importedRows) return section;
        const rows = importedRows.length > 0 ? importedRows : [createEmptyRow()];
        return {
          ...section,
          rows,
          subtotalWeight: rows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0),
          subtotalWeightedAverage: rows.reduce((sum, r) => sum + (parseFloat(r.weightedAverage) || 0), 0)
        };
      });
      return updated;
    });

    toast.success('Section B import completed');
  };

  const sanitizePerformanceSectionsForSave = (sections) => {
    return (sections || []).map((s) => {
      const { zoom, ...section } = s || {};
      const rows = (section.rows || []).map((r) => {
        const { selected, ...row } = r || {};
        return row;
      });
      return { ...section, rows };
    });
  };

  const buildSnapshot = () => ({
    employeeData,
    performanceSections: sanitizePerformanceSectionsForSave(performanceSections),
    softSkillScores,
    courses,
    developmentPlans,
    comments
  });

  useEffect(() => {
    if (loading) return;

    if (!initializedRef.current) {
      initialSnapshotRef.current = JSON.stringify(buildSnapshot());
      initializedRef.current = true;
      setIsDirty(false);
      return;
    }

    const current = JSON.stringify(buildSnapshot());
    setIsDirty(current !== initialSnapshotRef.current);
  }, [
    loading,
    employeeData,
    performanceSections,
    softSkillScores,
    courses,
    developmentPlans,
    comments
  ]);

  // Prompt handled by beforeunload listener below

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isDirty || saving) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, saving]);

  const ignorePopRef = useRef(false);

  useEffect(() => {
    const handlePopState = () => {
      if (ignorePopRef.current) return;
      if (!isDirty || saving) return;
      const ok = window.confirm('You have unsaved changes. Are you sure you want to leave this page?');
      if (!ok) {
        ignorePopRef.current = true;
        window.history.go(1);
        setTimeout(() => {
          ignorePopRef.current = false;
        }, 50);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isDirty, saving]);

  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (!isDirty || saving) return;
      const anchor = e.target?.closest?.('a[href]');
      if (!anchor) return;
      if (anchor.target === '_blank') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href) return;
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (href.startsWith('#')) return;

      let url;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      const ok = window.confirm('You have unsaved changes. Are you sure you want to leave this page?');
      if (!ok) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [isDirty, saving]);

  const confirmAndNavigate = (to) => {
    if (isDirty && !saving) {
      const ok = window.confirm('You have unsaved changes. Are you sure you want to leave this page?');
      if (!ok) return;
    }
    navigate(to);
  };

  // Save section changes (real save on edit; avoid misleading saves on create)
  const saveSection = async (sectionName) => {
    if (!employeeData.userId) {
      toast.error('Please select an employee');
      return;
    }

    const canSave = (() => {
      if (sectionName === 'sectionC') return canEditSectionC;
      if (sectionName === 'courses') return canEditCourses;
      if (sectionName === 'developmentPlans') return canEditDevelopmentPlans;
      return canEditSectionB;
    })();

    if (!canSave) {
      toast.error('You do not have permission to edit this section');
      return;
    }

    if (!isEdit) {
      toast.info('This section will be saved when you click Save Appraisal at the bottom.');
      return;
    }

    setSavingSection(sectionName);
    setError('');

    try {
      const allKraScores = performanceSections.flatMap(section =>
        section.rows.filter(row => row.pillar || row.keyResultArea).map(row => ({
          sectionName: section.name,
          pillar: row.pillar,
          keyResultArea: row.keyResultArea,
          target: row.target,
          janTarget: row.janTarget, janActual: row.janActual, janPercent: row.janPercent,
          febTarget: row.febTarget, febActual: row.febActual, febPercent: row.febPercent,
          marTarget: row.marTarget, marActual: row.marActual, marPercent: row.marPercent,
          aprTarget: row.aprTarget, aprActual: row.aprActual, aprPercent: row.aprPercent,
          mayTarget: row.mayTarget, mayActual: row.mayActual, mayPercent: row.mayPercent,
          junTarget: row.junTarget, junActual: row.junActual, junPercent: row.junPercent,
          julTarget: row.julTarget, julActual: row.julActual, julPercent: row.julPercent,
          augTarget: row.augTarget, augActual: row.augActual, augPercent: row.augPercent,
          sepTarget: row.sepTarget, sepActual: row.sepActual, sepPercent: row.sepPercent,
          octTarget: row.octTarget, octActual: row.octActual, octPercent: row.octPercent,
          novTarget: row.novTarget, novActual: row.novActual, novPercent: row.novPercent,
          decTarget: row.decTarget, decActual: row.decActual, decPercent: row.decPercent,
          targetTotal: row.targetTotal,
          actualTotal: row.actualTotal,
          percentAchieved: row.percentAchieved,
          weight: row.weight,
          actualRating: row.actualRating,
          weightedAverage: row.weightedAverage
        }))
      );

      const sectionCTotal = calculateSectionCTotal();
      const sectionBTotal = calculateSectionBTotal();
      const overall = (parseFloat(sectionBTotal) + parseFloat(sectionCTotal)).toFixed(2);

      const partial = {};
      if (sectionName === 'sectionC') {
        partial.softSkillScores = softSkillScores.filter(skill => skill.rating);
        partial.sectionCTotal = sectionCTotal;
        partial.overallRating = overall;
      } else if (sectionName === 'courses') {
        partial.courses = courses.filter(c => c.name);
      } else if (sectionName === 'developmentPlans') {
        partial.developmentPlans = developmentPlans.filter(p => p.description);
      } else {
        partial.performanceSections = sanitizePerformanceSectionsForSave(performanceSections);
        partial.kraScores = allKraScores;
        partial.sectionBTotal = sectionBTotal;
        partial.overallRating = overall;
      }

      await performanceAppraisalAPI.update(id, partial);
      initialSnapshotRef.current = JSON.stringify(buildSnapshot());
      setIsDirty(false);
      toast.success('Saved successfully');
    } catch (err) {
      console.error('Error saving section:', err);
      const apiError = err.response?.data?.error;
      const apiDetails = err.response?.data?.details;
      toast.error(apiDetails || apiError || 'Failed to save changes');
    } finally {
      setSavingSection('');
    }
  };

  // Calculate totals
  const calculateSectionBTotal = () => {
    const totalWtdAvg = performanceSections.reduce((sum, section) => sum + (parseFloat(section.subtotalWeightedAverage) || 0), 0);
    const totalWeight = performanceSections.reduce((sum, section) => sum + (parseFloat(section.subtotalWeight) || 0), 0);
    const base = totalWeight > 0 ? (totalWtdAvg / totalWeight) : 0;
    return String(Math.round(base * 0.7));
  };

  const calculateSectionCTotal = () => {
    const totalWeightedScore = softSkillScores.reduce((sum, skill) => sum + (parseFloat(skill.weightedScore) || 0), 0);
    const totalWeight = softSkillScores.reduce((sum, skill) => sum + (parseFloat(skill.weight) || 0), 0);
    const base = totalWeight > 0 ? (totalWeightedScore / totalWeight) : 0;
    return String(Math.round(base * 0.3));
  };

  const calculateOverallRating = () => {
    const sectionB = parseFloat(calculateSectionBTotal()) || 0;
    const sectionC = parseFloat(calculateSectionCTotal()) || 0;
    return String(Math.round(sectionB + sectionC));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!employeeData.userId) {
      setError('Please select an employee');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Convert performance sections to KRA scores format for backend
      const allKraScores = performanceSections.flatMap(section => 
        section.rows.filter(row => row.pillar || row.keyResultArea).map(row => ({
          sectionName: section.name,
          pillar: row.pillar,
          keyResultArea: row.keyResultArea,
          target: row.target,
          janTarget: row.janTarget, janActual: row.janActual, janPercent: row.janPercent,
          febTarget: row.febTarget, febActual: row.febActual, febPercent: row.febPercent,
          marTarget: row.marTarget, marActual: row.marActual, marPercent: row.marPercent,
          aprTarget: row.aprTarget, aprActual: row.aprActual, aprPercent: row.aprPercent,
          mayTarget: row.mayTarget, mayActual: row.mayActual, mayPercent: row.mayPercent,
          junTarget: row.junTarget, junActual: row.junActual, junPercent: row.junPercent,
          julTarget: row.julTarget, julActual: row.julActual, julPercent: row.julPercent,
          augTarget: row.augTarget, augActual: row.augActual, augPercent: row.augPercent,
          sepTarget: row.sepTarget, sepActual: row.sepActual, sepPercent: row.sepPercent,
          octTarget: row.octTarget, octActual: row.octActual, octPercent: row.octPercent,
          novTarget: row.novTarget, novActual: row.novActual, novPercent: row.novPercent,
          decTarget: row.decTarget, decActual: row.decActual, decPercent: row.decPercent,
          targetTotal: row.targetTotal,
          actualTotal: row.actualTotal,
          percentAchieved: row.percentAchieved,
          weight: row.weight,
          actualRating: row.actualRating,
          weightedAverage: row.weightedAverage
        }))
      );

      const payload = {
        userId: parseInt(employeeData.userId),
        branchDepartment: employeeData.branchDepartment,
        position: employeeData.position,
        pfNumber: employeeData.pfNumber,
        supervisorDesignation: employeeData.supervisorDesignation,
        periodType: employeeData.periodType,
        periodYear: parseInt(employeeData.periodYear),
        periodQuarter: employeeData.periodType === 'Quarterly' ? parseInt(employeeData.periodQuarter) : null,
        periodSemi: employeeData.periodType === 'Semi-annually' ? parseInt(employeeData.periodSemi) : null,
        appraisalDate: employeeData.appraisalDate,
        performanceSections: sanitizePerformanceSectionsForSave(performanceSections),
        kraScores: allKraScores,
        sectionBTotal: calculateSectionBTotal(),
        softSkillScores: softSkillScores.filter(skill => skill.rating),
        sectionCTotal: calculateSectionCTotal(),
        overallRating: calculateOverallRating(),
        courses: courses.filter(c => c.name),
        developmentPlans: developmentPlans.filter(p => p.description),
        appraiseeComments: comments.appraisee,
        appraiserComments: comments.appraiser,
        hodComments: resolvedHodComments,
        hrComments: resolvedHrComments,
        ceoComments: comments.ceo
      };

      if (isEdit) {
        await performanceAppraisalAPI.update(id, payload);
      } else {
        await performanceAppraisalAPI.create(payload);
      }

      initialSnapshotRef.current = JSON.stringify(buildSnapshot());
      setIsDirty(false);
      setSuccess(true);
      toast.success('Appraisal saved successfully');
      setTimeout(() => {
        navigate('/performance-appraisals');
      }, 800);
    } catch (error) {
      console.error('Error saving appraisal:', error);
      if (error.response?.status === 409 && error.response?.data?.existingId) {
        toast.info('This appraisal already exists for the selected period. Opening the existing record.');
        navigate(`/performance-appraisals/${error.response.data.existingId}/edit`);
      } else {
        const apiError = error.response?.data?.error;
        const apiDetails = error.response?.data?.details;
        toast.error(apiDetails || apiError || 'Failed to save appraisal');
      }
      setError(error.response?.data?.error || 'Failed to save appraisal');
    } finally {
      setSaving(false);
    }
  };

  // Group KRAs by pillar for display
  const krasByPillar = pillars.map(pillar => ({
    ...pillar,
    scores: kraScores.filter(kra => kra.pillarName === pillar.name)
  }));

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => confirmAndNavigate('/performance-appraisals')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEdit ? 'Edit Performance Appraisal' : 'New Performance Appraisal'}
              </h1>
              <p className="text-gray-600">WINAS SACCO Staff Performance Appraisal Tool</p>
            </div>
          </div>
        </div>

        {/* Employee Search */}
        <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-center space-x-3 mb-4">
            <Search className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-blue-800">Search Employee</h2>
          </div>
          <div className="relative">
            <div className="flex items-center">
              <input
                type="text"
                placeholder="Search by name, employee number, or department..."
                value={employeeSearch}
                onChange={(e) => {
                  setEmployeeSearch(e.target.value);
                  setShowEmployeeDropdown(true);
                }}
                onFocus={() => setShowEmployeeDropdown(true)}
                className="input-field pl-10 text-lg"
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-3" />
            </div>
            {showEmployeeDropdown && employeeSearch && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {employees
                  .filter(emp => {
                    const search = employeeSearch.toLowerCase();
                    return (
                      (emp.first_name?.toLowerCase() || '').includes(search) ||
                      (emp.last_name?.toLowerCase() || '').includes(search) ||
                      (emp.employee_number?.toLowerCase() || '').includes(search) ||
                      (emp.department_name?.toLowerCase() || '').includes(search)
                    );
                  })
                  .slice(0, 10)
                  .map(emp => (
                    <div
                      key={emp.id}
                      onClick={() => {
                        setEmployeeData(prev => ({
                          ...prev,
                          userId: emp.id,
                          branchDepartment: emp.department_name || '',
                          position: emp.job_title || '',
                          pfNumber: emp.employee_number || ''
                        }));
                        setEmployeeSearch(`${emp.first_name} ${emp.last_name}`);
                        setShowEmployeeDropdown(false);
                      }}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <div className="font-medium text-gray-900">{emp.first_name} {emp.last_name}</div>
                      <div className="text-sm text-gray-500">
                        {emp.employee_number} • {emp.job_title} • {emp.department_name}
                      </div>
                    </div>
                  ))}
                {employees.filter(emp => {
                  const search = employeeSearch.toLowerCase();
                  return (
                    (emp.first_name?.toLowerCase() || '').includes(search) ||
                    (emp.last_name?.toLowerCase() || '').includes(search) ||
                    (emp.employee_number?.toLowerCase() || '').includes(search)
                  );
                }).length === 0 && (
                  <div className="px-4 py-3 text-gray-500">No employees found</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Success Message */}
        {success && null}

        {/* Error Message */}
        {error && null}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section A: Employee Details */}
          <div className="card">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('employee')}
            >
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold">Section A: Employee Details</h2>
              </div>
              {expandedSections.employee ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
            
            {expandedSections.employee && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employee <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="userId"
                    value={employeeData.userId}
                    onChange={handleEmployeeChange}
                    className="input-field"
                    disabled={!canEditEmployeeDetails}
                    required
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} ({emp.employee_number})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch/Department</label>
                  <input
                    type="text"
                    name="branchDepartment"
                    value={employeeData.branchDepartment}
                    onChange={handleEmployeeChange}
                    className="input-field"
                    disabled={!canEditEmployeeDetails}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                  <input
                    type="text"
                    name="position"
                    value={employeeData.position}
                    onChange={handleEmployeeChange}
                    className="input-field"
                    disabled={!canEditEmployeeDetails}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PF Number</label>
                  <input
                    type="text"
                    name="pfNumber"
                    value={employeeData.pfNumber}
                    onChange={handleEmployeeChange}
                    className="input-field"
                    disabled={!canEditEmployeeDetails}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period Type</label>
                  <select
                    name="periodType"
                    value={employeeData.periodType}
                    onChange={handleEmployeeChange}
                    className="input-field"
                    disabled={!canEditEmployeeDetails}
                  >
                    <option value="Quarterly">Quarterly</option>
                    <option value="Semi-annually">Semi-annually</option>
                    <option value="Annual">Annual</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <select
                    name="periodYear"
                    value={employeeData.periodYear}
                    onChange={handleEmployeeChange}
                    className="input-field"
                    disabled={!canEditEmployeeDetails}
                  >
                    {[...Array(5)].map((_, i) => {
                      const year = new Date().getFullYear() - i;
                      return <option key={year} value={year}>{year}</option>;
                    })}
                  </select>
                </div>
                
                {employeeData.periodType === 'Quarterly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quarter</label>
                    <select
                      name="periodQuarter"
                      value={employeeData.periodQuarter}
                      onChange={handleEmployeeChange}
                      className="input-field"
                      disabled={!canEditEmployeeDetails}
                    >
                      <option value="1">Q1 (Jan-Mar)</option>
                      <option value="2">Q2 (Apr-Jun)</option>
                      <option value="3">Q3 (Jul-Sep)</option>
                      <option value="4">Q4 (Oct-Dec)</option>
                    </select>
                  </div>
                )}
                
                {employeeData.periodType === 'Semi-annually' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Semi-Annual Period</label>
                    <select
                      name="periodSemi"
                      value={employeeData.periodSemi}
                      onChange={handleEmployeeChange}
                      className="input-field"
                      disabled={!canEditEmployeeDetails}
                    >
                      <option value="1">1st Half (Jan-Jun)</option>
                      <option value="2">2nd Half (Jul-Dec)</option>
                    </select>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Appraisal Date</label>
                  <input
                    type="date"
                    name="appraisalDate"
                    value={employeeData.appraisalDate}
                    onChange={handleEmployeeChange}
                    className="input-field"
                    disabled={!canEditEmployeeDetails}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section B: Performance Targets - Multiple Categories */}
          <div className="card">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('targets')}
            >
              <div className="flex items-center space-x-3">
                <Target className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold">Section B: Performance Targets (Strategic Objectives - 70%)</h2>
              </div>
              {expandedSections.targets ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
            
            {expandedSections.targets && (
              <div className="mt-4 space-y-8">
                {/* Weight Scale Reference & Export Button */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 flex-1">
                    <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                      <Award className="w-4 h-4 mr-2" />
                      Weight Scale (Based on % Achieved)
                    </h4>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                      {[
                        { range: '≤70%', weight: 1, color: 'bg-red-100 text-red-700 border-red-200' },
                        { range: '71-80%', weight: 2, color: 'bg-orange-100 text-orange-700 border-orange-200' },
                        { range: '81-90%', weight: 3, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
                        { range: '91-100%', weight: 4, color: 'bg-lime-100 text-lime-700 border-lime-200' },
                        { range: '101-110%', weight: 5, color: 'bg-green-100 text-green-700 border-green-200' },
                        { range: '>110%', weight: 6, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
                      ].map((item, idx) => (
                        <div key={idx} className={`${item.color} rounded-lg p-2 text-center border`}>
                          <div className="font-bold text-lg">{item.weight}</div>
                          <div className="text-xs">{item.range}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={exportAllSectionsToCSV}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                    >
                      <Download className="w-5 h-5 mr-2" /> Export All Sections to CSV
                    </button>
                    <input
                      ref={sectionBImportRef}
                      type="file"
                      accept=".csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (sectionBImportRef.current) sectionBImportRef.current.value = '';
                        if (f && canEditSectionB) importSectionBFromFile(f);
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => sectionBImportRef.current?.click?.()}
                      disabled={!canEditSectionB}
                      className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-md disabled:opacity-50"
                    >
                      <Upload className="w-5 h-5 mr-2" /> Import from CSV/Excel
                    </button>
                  </div>
                </div>

                {/* Performance Sections */}
                {performanceSections.map((section, sectionIndex) => {
                  const activeMonths = getMonthsForPeriod(employeeData.periodType, employeeData.periodQuarter, employeeData.periodSemi);
                  return (
                  <div key={section.id} className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {/* Section Header */}
                    <div className="bg-gradient-to-r from-pink-600 to-pink-700 text-white px-4 py-3">
                      <h3 className="font-bold text-lg">{section.name} Section</h3>
                    </div>
                    
                    {/* Zoom Control & Actions */}
                    <div className="bg-gray-50 px-4 py-3 flex flex-wrap items-center justify-between gap-4 border-b">
                      <div className="flex items-center gap-3">
                        <ZoomOut className="w-4 h-4 text-gray-500" />
                        <input
                          type="range"
                          min="50"
                          max="150"
                          value={section.zoom}
                          onChange={(e) => handleZoomChange(sectionIndex, parseInt(e.target.value))}
                          className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-600"
                        />
                        <ZoomIn className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-600 min-w-[45px]">{section.zoom}%</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => addPerformanceRow(sectionIndex)}
                          className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                          disabled={!canEditSectionB}
                        >
                          <Plus className="w-4 h-4 mr-1" /> Add Row
                        </button>
                        <button
                          type="button"
                          onClick={() => addOrConvertSpecialRow(sectionIndex)}
                          className="inline-flex items-center px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                          disabled={!canEditSectionB}
                        >
                          <Plus className="w-4 h-4 mr-1" /> Special Row
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSelectedRows(sectionIndex)}
                          className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                          disabled={!canEditSectionB}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Delete Selected
                        </button>
                        <button
                          type="button"
                          onClick={() => saveSection(section.name)}
                          disabled={!canEditSectionB || savingSection === section.name}
                          className="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                          {savingSection === section.name ? (
                            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div> Saving...</>
                          ) : (
                            <><Check className="w-4 h-4 mr-1" /> Save Changes</>
                          )}
                        </button>
                      </div>
                      <div className="w-full text-xs text-gray-500">
                        Tip: select row(s) then click "Special Row" to convert to PAR or KPI.
                      </div>
                    </div>
                    
                    {/* Table Container with Zoom */}
                    <div className="overflow-x-auto p-2">
                      <div style={{ transform: `scale(${section.zoom / 100})`, transformOrigin: 'top left', minWidth: section.zoom < 100 ? `${100 / (section.zoom / 100)}%` : '100%' }}>
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border border-gray-300 p-2 w-10">
                                <input
                                  type="checkbox"
                                  onChange={(e) => toggleAllRows(sectionIndex, e.target.checked)}
                                  className="w-4 h-4 accent-pink-600"
                                  disabled={!canEditSectionB}
                                />
                              </th>
                              <th className="border border-gray-300 p-2 min-w-[150px] text-left font-bold">Pillar</th>
                              <th className="border border-gray-300 p-2 min-w-[200px] text-left font-bold">Key Result Area</th>
                              <th className="border border-gray-300 p-2 min-w-[120px] text-left font-bold">Target</th>
                              {activeMonths.map(m => (
                                <React.Fragment key={m.key}>
                                  <th className="border border-gray-300 p-2 bg-blue-50 font-bold">{m.label} Target</th>
                                  <th className="border border-gray-300 p-2 bg-yellow-50 font-bold">{m.label} Actual</th>
                                  <th className="border border-gray-300 p-2 bg-green-50 font-bold">{m.label} %</th>
                                </React.Fragment>
                              ))}
                              <th className="border border-gray-300 p-2 bg-indigo-100 font-bold">Total Target</th>
                              <th className="border border-gray-300 p-2 bg-indigo-100 font-bold">Total Actual</th>
                              <th className="border border-gray-300 p-2 bg-purple-100 font-bold">% Achieved</th>
                              <th className="border border-gray-300 p-2 bg-orange-100 font-bold">Weight</th>
                              <th className="border border-gray-300 p-2 bg-pink-100 font-bold">Rating</th>
                              <th className="border border-gray-300 p-2 bg-emerald-100 font-bold">Wtd Avg</th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.rows.map((row, rowIndex) => (
                              <tr key={row.id} className={row.selected ? 'bg-pink-50' : 'hover:bg-gray-50'}>
                                <td className="border border-gray-300 p-1 text-center align-top">
                                  <input
                                    type="checkbox"
                                    checked={row.selected}
                                    onChange={() => toggleRowSelection(sectionIndex, rowIndex)}
                                    className="w-4 h-4 accent-pink-600"
                                    disabled={!canEditSectionB}
                                  />
                                </td>
                                <td className="border border-gray-300 p-1 align-top">
                                  <textarea
                                    value={row.pillar}
                                    onChange={(e) => {
                                      e.target.style.height = 'auto';
                                      e.target.style.height = e.target.scrollHeight + 'px';
                                      handlePerformanceRowChange(sectionIndex, rowIndex, 'pillar', e.target.value);
                                    }}
                                    className="w-full min-w-[140px] p-1 border-0 resize-none focus:ring-2 focus:ring-pink-500 rounded font-semibold overflow-hidden"
                                    style={{ minHeight: '32px' }}
                                    placeholder="Pillar..."
                                    disabled={!canEditSectionB}
                                  />
                                </td>
                                <td className="border border-gray-300 p-1 align-top">
                                  <textarea
                                    value={row.keyResultArea}
                                    onChange={(e) => {
                                      e.target.style.height = 'auto';
                                      e.target.style.height = e.target.scrollHeight + 'px';
                                      handlePerformanceRowChange(sectionIndex, rowIndex, 'keyResultArea', e.target.value);
                                    }}
                                    className="w-full min-w-[180px] p-1 border-0 resize-none focus:ring-2 focus:ring-pink-500 rounded font-semibold overflow-hidden"
                                    style={{ minHeight: '32px' }}
                                    placeholder="Key Result Area..."
                                    disabled={!canEditSectionB}
                                  />
                                </td>
                                <td className="border border-gray-300 p-1 align-top">
                                  <textarea
                                    value={row.target}
                                    onChange={(e) => {
                                      e.target.style.height = 'auto';
                                      e.target.style.height = e.target.scrollHeight + 'px';
                                      handlePerformanceRowChange(sectionIndex, rowIndex, 'target', e.target.value);
                                    }}
                                    className="w-full min-w-[100px] p-1 border-0 resize-none focus:ring-2 focus:ring-pink-500 rounded overflow-hidden"
                                    style={{ minHeight: '32px' }}
                                    placeholder="Target description..."
                                    disabled={!canEditSectionB}
                                  />
                                  {row.specialType && (
                                    <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold uppercase">
                                        {row.specialType}
                                      </span>
                                      {row.specialType === 'PAR' && (
                                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                          PAR Weight: {row.parWeight || '0'}
                                        </span>
                                      )}
                                      {row.specialType === 'KPI' && (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                          {formatKpiCalcType(row.kpiCalcType) || 'Percentage-based weighted'}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                {/* Dynamic Monthly columns based on period type */}
                                {activeMonths.map(m => (
                                  <React.Fragment key={m.key}>
                                    <td className="border border-gray-300 p-1 bg-blue-50 align-top">
                                      <input
                                        type="number"
                                        value={row[`${m.key}Target`]}
                                        onChange={(e) => handlePerformanceRowChange(sectionIndex, rowIndex, `${m.key}Target`, e.target.value)}
                                        className="p-1 text-center border border-gray-200 rounded focus:ring-2 focus:ring-pink-500"
                                        style={{ width: getNumericInputWidth(row[`${m.key}Target`]) }}
                                        placeholder="0"
                                        disabled={!canEditSectionB}
                                      />
                                    </td>
                                    <td className="border border-gray-300 p-1 bg-yellow-50 align-top">
                                      <input
                                        type="number"
                                        value={row[`${m.key}Actual`]}
                                        onChange={(e) => handlePerformanceRowChange(sectionIndex, rowIndex, `${m.key}Actual`, e.target.value)}
                                        className="p-1 text-center border border-gray-200 rounded focus:ring-2 focus:ring-pink-500"
                                        style={{ width: getNumericInputWidth(row[`${m.key}Actual`]) }}
                                        placeholder="0"
                                        disabled={!canEditSectionB}
                                      />
                                    </td>
                                    <td className="border border-gray-300 p-1 bg-green-50 text-center font-medium align-top">
                                      {row[`${m.key}Percent`]}%
                                    </td>
                                  </React.Fragment>
                                ))}
                                {/* Totals */}
                                <td className="border border-gray-300 p-2 bg-indigo-100 text-center font-bold align-top">
                                  {row.specialType === 'KPI' ? (
                                    <input
                                      type="number"
                                      value={row.targetTotal}
                                      onChange={(e) => handlePerformanceRowChange(sectionIndex, rowIndex, 'targetTotal', e.target.value)}
                                      className="p-1 text-center border border-gray-200 rounded focus:ring-2 focus:ring-pink-500"
                                      style={{ width: getNumericInputWidth(row.targetTotal) }}
                                      placeholder="0"
                                      disabled={!canEditSectionB}
                                    />
                                  ) : (
                                    row.targetTotal
                                  )}
                                </td>
                                <td className="border border-gray-300 p-2 bg-indigo-100 text-center font-bold align-top">
                                  {row.specialType === 'KPI' ? (
                                    <input
                                      type="number"
                                      value={row.actualTotal}
                                      onChange={(e) => handlePerformanceRowChange(sectionIndex, rowIndex, 'actualTotal', e.target.value)}
                                      className="p-1 text-center border border-gray-200 rounded focus:ring-2 focus:ring-pink-500"
                                      style={{ width: getNumericInputWidth(row.actualTotal) }}
                                      placeholder="0"
                                      disabled={!canEditSectionB}
                                    />
                                  ) : (
                                    row.actualTotal
                                  )}
                                </td>
                                <td className="border border-gray-300 p-2 bg-purple-100 text-center font-bold align-top">{row.percentAchieved}%</td>
                                <td className="border border-gray-300 p-2 bg-orange-100 text-center font-bold align-top">{row.weight}</td>
                                <td className="border border-gray-300 p-2 bg-pink-100 text-center font-bold align-top">{row.actualRating}</td>
                                <td className="border border-gray-300 p-2 bg-emerald-100 text-center font-bold text-emerald-700 align-top">{row.weightedAverage}</td>
                              </tr>
                            ))}
                            {/* Subtotal Row */}
                            <tr className="bg-gray-200 font-bold">
                              <td colSpan={4} className="border border-gray-300 p-2 text-left">
                                Sub-Total {section.name.toUpperCase()}:
                              </td>
                              <td colSpan={activeMonths.length * 3 + 3} className="border border-gray-300 p-2"></td>
                              <td className="border border-gray-300 p-2 text-center bg-orange-200">{section.subtotalWeight}</td>
                              <td className="border border-gray-300 p-2 text-center bg-pink-200"></td>
                              <td className="border border-gray-300 p-2 text-center bg-emerald-200 text-emerald-800">{(parseFloat(section.subtotalWeightedAverage) || 0).toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  );
                })}
                
                {/* Section B Grand Total */}
                <div className="bg-gradient-to-r from-pink-600 to-pink-700 rounded-xl p-5 flex justify-between items-center text-white shadow-lg">
                  <span className="font-bold text-lg">SECTION B GRAND TOTAL (Strategic Objectives - 70%)</span>
                  <span className="text-4xl font-black">{calculateSectionBTotal()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Section C: Soft Skills */}
          <div className="card">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('softSkills')}
            >
              <div className="flex items-center space-x-3">
                <Award className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold">Section C: Soft Skills / Behavior Traits (30%)</h2>
              </div>
              {expandedSections.softSkills ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
            
            {expandedSections.softSkills && (
              <div className="mt-4 space-y-4">
                {/* Rating Key */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-medium text-gray-700 mb-2">Rating Key</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                    {ratingKey.map((item, index) => (
                      <div key={index} className="bg-white rounded p-2 text-center">
                        <div className="font-bold text-primary-600">{item.point}</div>
                        <div className="text-gray-500">{item.range}</div>
                        <div className="text-gray-700">{item.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Soft Skill</th>
                        <th className="px-4 py-2 text-center w-20">Weight</th>
                        <th className="px-4 py-2 text-center w-24">Rating</th>
                        <th className="px-4 py-2 text-center w-24">Weighted Score</th>
                        <th className="px-4 py-2 text-left">Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {softSkillScores.map((skill, index) => (
                        <tr key={skill.softSkillId} className="border-t">
                          <td className="px-4 py-2">
                            <div className="font-medium">{skill.skillName}</div>
                            <div className="text-xs text-gray-500">{skill.description}</div>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className="font-medium">{skill.weight}</span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="number"
                              value={skill.rating}
                              onChange={(e) => handleSoftSkillChange(index, 'rating', e.target.value)}
                              className="w-16 text-center border rounded px-2 py-1"
                              disabled={!canEditSectionC}
                            />
                          </td>
                          <td className="px-4 py-2 text-center bg-green-50 font-medium">
                            {skill.weightedScore}
                          </td>
                          <td className="px-4 py-2">
                            <textarea
                              value={skill.comments}
                              onChange={(e) => {
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                                handleSoftSkillChange(index, 'comments', e.target.value);
                              }}
                              className="w-full border rounded px-2 py-1 resize-none overflow-hidden"
                              style={{ minHeight: '32px' }}
                              placeholder="Comments..."
                              disabled={!canEditSectionC}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="bg-secondary-50 rounded-lg p-4 flex justify-between items-center">
                  <span className="font-semibold text-secondary-700">Section C Total (Soft Skills - 30%)</span>
                  <span className="text-2xl font-bold text-secondary-700">{calculateSectionCTotal()}</span>
                </div>
                
                {/* Save Section C Button */}
                <div className="flex justify-end pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => saveSection('sectionC')}
                    className="px-6 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors flex items-center gap-2"
                    disabled={!canEditSectionC}
                  >
                    <Save className="w-4 h-4" />
                    Save Section C Changes
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Part E: Overall Performance */}
          <div className="card bg-gradient-to-r from-primary-50 to-secondary-50">
            <div className="flex items-center space-x-3 mb-4">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold">Part E: Overall Performance Rating</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-sm text-gray-600 mb-1">Strategic Objectives (70%)</div>
                <div className="text-2xl font-bold text-primary-600">{calculateSectionBTotal()}</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-sm text-gray-600 mb-1">Soft Skills (30%)</div>
                <div className="text-2xl font-bold text-secondary-600">{calculateSectionCTotal()}</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center border-2 border-primary-500">
                <div className="text-sm text-gray-600 mb-1">Total Performance Rating</div>
                <div className="text-3xl font-bold text-primary-700">{calculateOverallRating()}%</div>
              </div>
            </div>
          </div>

          {/* Part F: Courses Attended */}
          <div className="card">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('courses')}
            >
              <div className="flex items-center space-x-3">
                <BookOpen className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold">Part F: Courses/Training Attended During Review Period</h2>
              </div>
              {expandedSections.courses ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
            
            {expandedSections.courses && (
              <div className="mt-4 space-y-3">
                {courses.map((course, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={course.name}
                        onChange={(e) => handleCourseChange(index, 'name', e.target.value)}
                        className="input-field"
                        placeholder="Course/Training Name"
                        disabled={!canEditCourses}
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={course.comments}
                        onChange={(e) => handleCourseChange(index, 'comments', e.target.value)}
                        className="input-field"
                        placeholder="Comments"
                        disabled={!canEditCourses}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCourse(index)}
                      className="text-red-500 hover:text-red-700 p-2"
                      disabled={!canEditCourses}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-4 border-t">
                  <button
                    type="button"
                    onClick={addCourse}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                    disabled={!canEditCourses}
                  >
                    + Add Course
                  </button>
                  <button
                    type="button"
                    onClick={() => saveSection('courses')}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                    disabled={!canEditCourses}
                  >
                    <Save className="w-4 h-4" />
                    Save Courses
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Part F: Development Plans */}
          <div className="card">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('development')}
            >
              <div className="flex items-center space-x-3">
                <TrendingUp className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold">Part F: Development Plans</h2>
              </div>
              {expandedSections.development ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
            
            {expandedSections.development && (
              <div className="mt-4 space-y-3">
                {developmentPlans.map((plan, index) => (
                  <div key={index} className="flex gap-3 items-start border-b pb-3">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Area for Development</label>
                      <input
                        type="text"
                        value={plan.description}
                        onChange={(e) => handleDevelopmentPlanChange(index, 'description', e.target.value)}
                        className="input-field"
                        placeholder="Skills/competencies to develop"
                        disabled={!canEditDevelopmentPlans}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Manager Actions</label>
                      <input
                        type="text"
                        value={plan.managerActions}
                        onChange={(e) => handleDevelopmentPlanChange(index, 'managerActions', e.target.value)}
                        className="input-field"
                        placeholder="What manager will do to support"
                        disabled={!canEditDevelopmentPlans}
                      />
                    </div>
                    <div className="w-40">
                      <label className="text-xs text-gray-500">Target Date</label>
                      <input
                        type="date"
                        value={plan.targetDate}
                        onChange={(e) => handleDevelopmentPlanChange(index, 'targetDate', e.target.value)}
                        className="input-field"
                        disabled={!canEditDevelopmentPlans}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDevelopmentPlan(index)}
                      className="text-red-500 hover:text-red-700 p-2 mt-5"
                      disabled={!canEditDevelopmentPlans}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-4 border-t">
                  <button
                    type="button"
                    onClick={addDevelopmentPlan}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                    disabled={!canEditDevelopmentPlans}
                  >
                    + Add Development Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => saveSection('developmentPlans')}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                    disabled={!canEditDevelopmentPlans}
                  >
                    <Save className="w-4 h-4" />
                    Save Development Plans
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="card">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('comments')}
            >
              <div className="flex items-center space-x-3">
                <MessageSquare className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold">Part F: Comments & Signatures</h2>
              </div>
              {expandedSections.comments ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
            
            {expandedSections.comments && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Appraisee Comments</label>
                  <textarea
                    value={comments.appraisee}
                    onChange={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                      setComments(prev => ({ ...prev, appraisee: e.target.value }));
                    }}
                    className="input-field"
                    rows="3"
                    placeholder="Employee's comments on their performance..."
                    disabled={!canEditAppraiseeComments}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Appraiser/Supervisor Comments</label>
                  <textarea
                    value={comments.appraiser}
                    onChange={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                      setComments(prev => ({ ...prev, appraiser: e.target.value }));
                    }}
                    className="input-field"
                    rows="3"
                    placeholder="Supervisor's comments..."
                    disabled={!canEditAppraiserComments}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HOD Comments</label>
                  <textarea
                    value={resolvedHodComments}
                    onChange={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                      setComments(prev => ({ ...prev, hod: e.target.value }));
                    }}
                    className="input-field"
                    rows="3"
                    placeholder="Head of Department's comments..."
                    disabled={!canEditHodComments}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HR Comments</label>
                  <textarea
                    value={resolvedHrComments}
                    onChange={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                      setComments(prev => ({ ...prev, hr: e.target.value }));
                    }}
                    className="input-field"
                    rows="3"
                    placeholder="HR's comments..."
                    disabled={!canEditHrComments}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CEO Comments</label>
                  <textarea
                    value={comments.ceo}
                    onChange={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                      setComments(prev => ({ ...prev, ceo: e.target.value }));
                    }}
                    className="input-field"
                    rows="3"
                    placeholder="CEO's comments..."
                    disabled={!canEditCeoComments}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => confirmAndNavigate('/performance-appraisals')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || success}
              className="btn-primary inline-flex items-center"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isEdit ? 'Update Appraisal' : 'Save Appraisal'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default PerformanceAppraisalForm;
