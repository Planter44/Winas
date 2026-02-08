import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { performanceAppraisalAPI } from '../services/api';
import * as XLSX from 'xlsx';
import { 
  ArrowLeft, Edit2, Printer, User, Calendar, Target, Award,
  BookOpen, TrendingUp, MessageSquare, CheckCircle, Clock,
  AlertCircle, FileText
} from 'lucide-react';

const createEmptyRow = () => ({
  id: Date.now() + Math.random(),
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
  }

  if (periodType === 'Semi-annually') {
    const semiMonths = {
      1: ['jan', 'feb', 'mar', 'apr', 'may', 'jun'],
      2: ['jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    };
    return (semiMonths[periodSemi] || allMonths.slice(0, 6)).map(m => ({ key: m, label: monthLabels[m] }));
  }

  return allMonths.map(m => ({ key: m, label: monthLabels[m] }));
};

const chunkMonthsForPrint = (months) => {
  if (!Array.isArray(months) || months.length === 0) return [];
  const chunkSize = months.length <= 2 ? months.length : 2;
  const chunks = [];
  for (let i = 0; i < months.length; i += chunkSize) {
    chunks.push(months.slice(i, i + chunkSize));
  }
  return chunks;
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
  const name = (skill?.skill_name || skill?.name || '').trim().toLowerCase();
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

const normalize = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

const sectionBTemplates = [
  { id: 'membership', name: 'Membership & Customer Satisfaction' },
  { id: 'finance', name: 'Finance & Credit' },
  { id: 'operations', name: 'Business Operations, Audit, ICT & HR' }
];

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

const normalizeSectionBToTemplates = (sections) => {
  if (!Array.isArray(sections) || sections.length === 0) return null;

  const templateNames = new Set(sectionBTemplates.map(s => normalize(s.name)));
  const byTemplate = new Map(sectionBTemplates.map(t => [normalize(t.name), { name: t.name, rows: [] }]));

  sections.forEach((section) => {
    const sectionName = section?.name || section?.sectionName || section?.section_name || '';
    const rows = Array.isArray(section?.rows) ? section.rows : [];
    rows.forEach((r) => {
      const row = {
        ...createEmptyRow(),
        ...(r || {})
      };

      const explicit = templateNames.has(normalize(sectionName)) ? sectionName : null;
      const inferred = categorizePillarToSectionName(row.pillar);
      const chosen = explicit || inferred || 'Business Operations, Audit, ICT & HR';
      const key = normalize(chosen);
      const bucket = byTemplate.get(key) || byTemplate.get(normalize('Business Operations, Audit, ICT & HR'));
      bucket.rows.push(row);
    });
  });

  const normalizedSections = sectionBTemplates.map((t) => {
    const entry = byTemplate.get(normalize(t.name)) || { name: t.name, rows: [] };
    const rows = entry.rows.length > 0 ? entry.rows : [createEmptyRow()];
    const subtotalWeight = rows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);
    const subtotalWeightedAverage = rows.reduce((sum, r) => sum + (parseFloat(r.weightedAverage) || 0), 0);
    return {
      id: t.id,
      name: t.name,
      rows,
      subtotalWeight,
      subtotalWeightedAverage
    };
  });

  return normalizedSections;
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
      merged.pillar = merged.pillar ?? '';
      merged.keyResultArea = merged.keyResultArea ?? '';
      merged.target = merged.target ?? '';

      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      months.forEach((m) => {
        merged[`${m}Target`] = merged[`${m}Target`] ?? '';
        merged[`${m}Actual`] = merged[`${m}Actual`] ?? '';
        merged[`${m}Percent`] = merged[`${m}Percent`] ?? 0;
      });

      merged.targetTotal = merged.targetTotal ?? 0;
      merged.actualTotal = merged.actualTotal ?? 0;
      merged.percentAchieved = merged.percentAchieved ?? 0;
      merged.weight = merged.weight ?? 0;
      merged.actualRating = merged.actualRating ?? 0;
      merged.weightedAverage = merged.weightedAverage ?? 0;
      return merged;
    };

    return parsed.map((section, idx) => {
      const rows = Array.isArray(section?.rows) ? section.rows : [];
      const normalizedRows = rows.length > 0 ? rows.map(ensureRow) : [];
      const subtotalWeight = normalizedRows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);
      const subtotalWeightedAverage = normalizedRows.reduce((sum, r) => sum + (parseFloat(r.weightedAverage) || 0), 0);
      return {
        id: section?.id || `section_${idx}`,
        name: section?.name || section?.sectionName || `Section ${idx + 1}`,
        rows: normalizedRows,
        subtotalWeight,
        subtotalWeightedAverage
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

  return Array.from(bySection.values()).map((section, idx) => {
    const subtotalWeight = section.rows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);
    const subtotalWeightedAverage = section.rows.reduce((sum, r) => sum + (parseFloat(r.weightedAverage) || 0), 0);
    return {
      id: `section_${idx}`,
      name: section.name,
      rows: section.rows,
      subtotalWeight,
      subtotalWeightedAverage
    };
  });
};

const PerformanceAppraisalDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, hasRole } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appraisal, setAppraisal] = useState(null);
  const [ratingKey, setRatingKey] = useState([]);

  useEffect(() => {
    fetchAppraisal();
  }, [id]);

  const fetchAppraisal = async () => {
    try {
      setLoading(true);
      const [appraisalRes, ratingKeyRes] = await Promise.all([
        performanceAppraisalAPI.getById(id),
        performanceAppraisalAPI.getRatingKey()
      ]);
      setAppraisal(appraisalRes.data);
      setRatingKey(ratingKeyRes.data);
    } catch (error) {
      console.error('Error fetching appraisal:', error);
      setError('Failed to load appraisal details');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!appraisal) return;

    const activeMonths = getMonthsForPeriod(appraisal.period_type, appraisal.period_quarter, appraisal.period_semi);
    const monthHeaders = activeMonths.flatMap(m => [`${m.label} Target`, `${m.label} Actual`, `${m.label} %`]);
    const sectionBHeaders = [
      'Pillar',
      'Key Result Area',
      'Target',
      ...monthHeaders,
      'Total Target',
      'Total Actual',
      '% Achieved',
      'Weight',
      'Rating',
      'Wtd Avg'
    ];
    const maxColumns = Math.max(sectionBHeaders.length, 6);

    const styles = {
      sectionTitle: {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '2F5597' } },
        alignment: { vertical: 'center', horizontal: 'left' }
      },
      tableHeader: {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1F4E78' } },
        alignment: { vertical: 'center', horizontal: 'center', wrapText: true }
      },
      subHeader: {
        font: { bold: true },
        fill: { fgColor: { rgb: 'D9E1F2' } },
        alignment: { vertical: 'center', horizontal: 'left' }
      },
      label: {
        font: { bold: true },
        fill: { fgColor: { rgb: 'F2F2F2' } }
      },
      total: {
        font: { bold: true },
        fill: { fgColor: { rgb: 'FFF2CC' } }
      }
    };

    const rows = [];
    const merges = [];
    const rowStyles = new Map();
    const cellStyles = [];

    const addRow = (row = [], style) => {
      const rowIndex = rows.length;
      rows.push(row);
      if (style) rowStyles.set(rowIndex, style);
      return rowIndex;
    };

    const addSectionTitle = (title) => {
      const rowIndex = addRow([title], styles.sectionTitle);
      merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: maxColumns - 1 } });
    };

    const formatNumber = (value, digits = 2) => {
      const num = parseFloat(value);
      if (!Number.isFinite(num)) return value ?? '';
      return num.toFixed(digits);
    };

    const formatPercent = (value) => {
      if (value === null || value === undefined || value === '') return '';
      const num = parseFloat(value);
      if (Number.isFinite(num)) {
        return `${num}%`;
      }
      const str = String(value).trim();
      return str.includes('%') ? str : `${str}%`;
    };

    const applyRowStyle = (sheet, rowIndex, style) => {
      for (let c = 0; c < maxColumns; c += 1) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c });
        if (!sheet[cellRef]) sheet[cellRef] = { t: 's', v: '' };
        sheet[cellRef].s = { ...(sheet[cellRef].s || {}), ...style };
      }
    };

    const applyCellStyle = (sheet, rowIndex, colIndex, style) => {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      if (!sheet[cellRef]) sheet[cellRef] = { t: 's', v: '' };
      sheet[cellRef].s = { ...(sheet[cellRef].s || {}), ...style };
    };

    addSectionTitle('Section A: Employee Details');
    const sectionADetails = [
      ['Name', `${appraisal.first_name || ''} ${appraisal.last_name || ''}`.trim()],
      ['PF Number', appraisal.pf_number || appraisal.employee_number || ''],
      ['Branch/Department', appraisal.branch_department || appraisal.department_name || ''],
      ['Position', appraisal.position || appraisal.job_title || ''],
      ['Supervisor', appraisal.supervisor_first_name ? `${appraisal.supervisor_first_name} ${appraisal.supervisor_last_name}`.trim() : 'N/A'],
      ['Period', `${appraisal.period_type === 'Quarterly' ? `Q${appraisal.period_quarter} ` : ''}${appraisal.period_year || ''}`.trim()],
      ['Appraisal Date', appraisal.appraisal_date ? new Date(appraisal.appraisal_date).toLocaleDateString() : 'N/A']
    ];
    sectionADetails.forEach(([label, value]) => {
      const rowIndex = addRow([label, value]);
      cellStyles.push({ rowIndex, colIndex: 0, style: styles.label });
    });
    addRow([]);

    const performanceSectionsData = normalizePerformanceSectionsData(appraisal.performanceSectionsData);
    const performanceSectionsScores = buildPerformanceSectionsFromScores(appraisal.performanceSectionScores);
    const kraSections = Object.entries(krasByPillar).map(([pillarName, kras], idx) => {
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const rows = kras.map((kra) => {
        const base = createEmptyRow();
        const row = {
          ...base,
          id: kra.id || base.id,
          pillar: pillarName,
          keyResultArea: kra.kra_name || '',
          target: kra.target_description || kra.target || ''
        };
        months.forEach((m) => {
          row[`${m}Target`] = kra?.[`${m}_target`] ?? '';
          row[`${m}Actual`] = kra?.[`${m}_actual`] ?? '';
          row[`${m}Percent`] = kra?.[`${m}_percent`] ?? 0;
        });
        row.targetTotal = kra.target_total ?? 0;
        row.actualTotal = kra.actual_total ?? 0;
        row.percentAchieved = kra.percent_achieved ?? 0;
        row.weight = kra.kra_weight ?? 0;
        row.actualRating = kra.actual_rating ?? kra.percent_achieved ?? 0;
        row.weightedAverage = kra.weighted_average ?? 0;
        return row;
      });
      const subtotalWeight = rows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);
      const subtotalWeightedAverage = rows.reduce((sum, r) => sum + (parseFloat(r.weightedAverage) || 0), 0);
      return { id: `kra_${idx}`, name: pillarName, rows, subtotalWeight, subtotalWeightedAverage };
    });

    const rawSections = (performanceSectionsData && performanceSectionsData.length > 0)
      ? performanceSectionsData
      : ((performanceSectionsScores && performanceSectionsScores.length > 0)
        ? performanceSectionsScores
        : (kraSections.length > 0 ? kraSections : null));

    const sectionBSections = rawSections ? normalizeSectionBToTemplates(rawSections) : [];
    const sectionBTotals = Array.isArray(sectionBSections)
      ? sectionBSections.reduce(
        (acc, s) => {
          acc.totalWeight += parseFloat(s.subtotalWeight) || 0;
          acc.totalWeightedAverage += parseFloat(s.subtotalWeightedAverage) || 0;
          return acc;
        },
        { totalWeight: 0, totalWeightedAverage: 0 }
      )
      : { totalWeight: 0, totalWeightedAverage: 0 };
    const computedSectionBTotal = sectionBTotals.totalWeight > 0
      ? Math.round((sectionBTotals.totalWeightedAverage / sectionBTotals.totalWeight) * 0.7)
      : 0;
    const totalPerformanceRating = Math.round((parseFloat(computedSectionBTotal) || 0) + (parseFloat(computedSectionCTotal) || 0));

    addSectionTitle('Section B: Performance Targets (Strategic Objectives - 70%)');
    if (!sectionBSections || sectionBSections.length === 0) {
      const rowIndex = addRow(['No performance targets recorded']);
      merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: maxColumns - 1 } });
    } else {
      sectionBSections.forEach((section) => {
        const sectionHeaderIndex = addRow([`${section.name} Section`], styles.subHeader);
        merges.push({ s: { r: sectionHeaderIndex, c: 0 }, e: { r: sectionHeaderIndex, c: maxColumns - 1 } });

        addRow(sectionBHeaders, styles.tableHeader);

        section.rows.forEach((row) => {
          const rowData = [row.pillar, row.keyResultArea, row.target];
          activeMonths.forEach((m) => {
            rowData.push(row[`${m.key}Target`] ?? '');
            rowData.push(row[`${m.key}Actual`] ?? '');
            rowData.push(formatPercent(row[`${m.key}Percent`]) || '');
          });
          rowData.push(row.targetTotal ?? '');
          rowData.push(row.actualTotal ?? '');
          rowData.push(formatPercent(row.percentAchieved));
          rowData.push(row.weight ?? '');
          rowData.push(row.actualRating ?? '');
          rowData.push(formatNumber(row.weightedAverage, 2));
          addRow(rowData);
        });

        const subtotalWeight = section.subtotalWeight ?? section.rows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);
        const subtotalWeightedAverage = section.subtotalWeightedAverage ?? section.rows.reduce((sum, r) => sum + (parseFloat(r.weightedAverage) || 0), 0);
        const subtotalRow = new Array(maxColumns).fill('');
        subtotalRow[0] = `Sub-Total ${String(section.name || '').toUpperCase()}:`;
        subtotalRow[maxColumns - 3] = subtotalWeight;
        subtotalRow[maxColumns - 1] = formatNumber(subtotalWeightedAverage, 2);
        const subtotalIndex = addRow(subtotalRow, styles.total);
        merges.push({ s: { r: subtotalIndex, c: 0 }, e: { r: subtotalIndex, c: maxColumns - 4 } });

        addRow([]);
      });

      const totalRow = new Array(maxColumns).fill('');
      totalRow[0] = 'Section B Total (Strategic Objectives - 70%)';
      totalRow[maxColumns - 1] = computedSectionBTotal;
      const totalIndex = addRow(totalRow, styles.total);
      merges.push({ s: { r: totalIndex, c: 0 }, e: { r: totalIndex, c: maxColumns - 2 } });
      addRow([]);
    }

    addSectionTitle('Section C: Soft Skills / Behavior Traits (30%)');
    if (visibleSoftSkillScores.length === 0) {
      const rowIndex = addRow(['No soft skills recorded']);
      merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: Math.max(4, maxColumns - 1) } });
    } else {
      addRow(['Soft Skill', 'Weight', 'Rating', 'Weighted Score', 'Comments'], styles.tableHeader);
      visibleSoftSkillScores.forEach((skill) => {
        const rating = parseFloat(skill?.rating) || 0;
        const weight = getSoftSkillWeightFromRating(rating);
        const weightedScore = weight * rating;
        addRow([
          skill.skill_name || skill.name || '',
          weight,
          rating,
          formatNumber(weightedScore, 2),
          skill.comments || '-'
        ]);
      });
      const totalRow = new Array(maxColumns).fill('');
      totalRow[0] = 'Section C Total (Soft Skills - 30%)';
      totalRow[maxColumns - 1] = computedSectionCTotal;
      const totalIndex = addRow(totalRow, styles.total);
      merges.push({ s: { r: totalIndex, c: 0 }, e: { r: totalIndex, c: maxColumns - 2 } });
    }
    addRow([]);

    addSectionTitle('Part E: Overall Performance Rating');
    addRow(['Strategic Objectives (70%)', 'Soft Skills (30%)', 'Total Performance Rating'], styles.tableHeader);
    addRow([computedSectionBTotal, computedSectionCTotal, `${totalPerformanceRating}%`]);
    addRow([]);

    addSectionTitle('Part F: Courses/Training Attended');
    if (appraisal.courses?.length > 0) {
      addRow(['#', 'Course/Training', 'Comments'], styles.tableHeader);
      appraisal.courses.forEach((course, index) => {
        addRow([index + 1, course.course_name || '', course.comments || '-']);
      });
    } else {
      const rowIndex = addRow(['No courses recorded']);
      merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: maxColumns - 1 } });
    }
    addRow([]);

    addSectionTitle('Part F: Development Plans');
    if (appraisal.developmentPlans?.length > 0) {
      addRow(['#', 'Area for Development', 'Manager Actions', 'Target Date'], styles.tableHeader);
      appraisal.developmentPlans.forEach((plan, index) => {
        addRow([
          index + 1,
          plan.plan_description || '',
          plan.manager_actions || '-',
          plan.target_completion_date ? new Date(plan.target_completion_date).toLocaleDateString() : '-'
        ]);
      });
    } else {
      const rowIndex = addRow(['No development plans recorded']);
      merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: maxColumns - 1 } });
    }
    addRow([]);

    addSectionTitle('Part F: Comments & Signatures');
    const commentsRows = [
      ['Appraisee Comments', appraisal.appraisee_comments || ''],
      ['Appraiser/Supervisor Comments', appraisal.appraiser_comments || ''],
      ['HOD Comments', appraisal.hod_comments || ''],
      ['HR Comments', appraisal.hr_comments || ''],
      ['CEO Comments', appraisal.ceo_comments || '']
    ];
    commentsRows.forEach(([label, value]) => {
      const rowIndex = addRow([label, value || '-']);
      cellStyles.push({ rowIndex, colIndex: 0, style: styles.label });
    });

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!merges'] = merges;
    sheet['!cols'] = Array.from({ length: maxColumns }, (_, idx) => {
      if (idx === 0) return { wch: 28 };
      if (idx === 1) return { wch: 26 };
      if (idx === 2) return { wch: 24 };
      return { wch: 14 };
    });

    rowStyles.forEach((style, rowIndex) => {
      applyRowStyle(sheet, rowIndex, style);
    });
    cellStyles.forEach(({ rowIndex, colIndex, style }) => {
      applyCellStyle(sheet, rowIndex, colIndex, style);
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Appraisal Report');

    const namePart = `${appraisal.first_name || ''}_${appraisal.last_name || ''}`.trim().replace(/\s+/g, '_') || 'Employee';
    const periodPart = `${appraisal.period_type === 'Quarterly' ? `Q${appraisal.period_quarter}_` : ''}${appraisal.period_year || ''}`.trim();
    const filename = `Performance_Appraisal_${namePart}${periodPart ? `_${periodPart}` : ''}.xlsx`;
    XLSX.writeFile(wb, filename, { bookType: 'xlsx', cellStyles: true });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'Draft': { color: 'bg-gray-100 text-gray-700', icon: Edit2 },
      'Submitted': { color: 'bg-blue-100 text-blue-700', icon: Clock },
      'Supervisor_Review': { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
      'HOD_Review': { color: 'bg-orange-100 text-orange-700', icon: Clock },
      'HR_Review': { color: 'bg-purple-100 text-purple-700', icon: Clock },
      'CEO_Approved': { color: 'bg-green-100 text-green-700', icon: CheckCircle },
      'Finalized': { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle }
    };
    
    const config = statusConfig[status] || statusConfig['Draft'];
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="w-4 h-4 mr-1" />
        {status?.replace('_', ' ')}
      </span>
    );
  };

  const getRatingColor = (rating) => {
    if (!rating) return 'text-gray-500';
    const value = parseFloat(rating);
    if (value >= 90) return 'text-green-600';
    if (value >= 80) return 'text-blue-600';
    if (value >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Group KRA scores by pillar
  const normalizedKraScores = (appraisal?.kraScores?.length
    ? appraisal.kraScores
    : (Array.isArray(appraisal?.performanceSectionScores)
      ? appraisal.performanceSectionScores.map(r => ({
        id: r.id,
        pillar_name: r.pillar || '',
        kra_name: r.key_result_area || r.keyResultArea || '',
        target_description: r.target_description ?? r.target ?? '',
        kra_weight: r.weight ?? null,
        jan_target: r.jan_target ?? null,
        feb_target: r.feb_target ?? null,
        mar_target: r.mar_target ?? null,
        apr_target: r.apr_target ?? null,
        may_target: r.may_target ?? null,
        jun_target: r.jun_target ?? null,
        jul_target: r.jul_target ?? null,
        aug_target: r.aug_target ?? null,
        sep_target: r.sep_target ?? null,
        oct_target: r.oct_target ?? null,
        nov_target: r.nov_target ?? null,
        dec_target: r.dec_target ?? null,
        jan_actual: r.jan_actual ?? null,
        feb_actual: r.feb_actual ?? null,
        mar_actual: r.mar_actual ?? null,
        apr_actual: r.apr_actual ?? null,
        may_actual: r.may_actual ?? null,
        jun_actual: r.jun_actual ?? null,
        jul_actual: r.jul_actual ?? null,
        aug_actual: r.aug_actual ?? null,
        sep_actual: r.sep_actual ?? null,
        oct_actual: r.oct_actual ?? null,
        nov_actual: r.nov_actual ?? null,
        dec_actual: r.dec_actual ?? null,
        target_total: r.target_total ?? null,
        actual_total: r.actual_total ?? null,
        percent_achieved: r.percent_achieved ?? null,
        weighted_average: r.weighted_average ?? null
      }))
      : []));

  const visibleSoftSkillScores = (Array.isArray(appraisal?.softSkillScores)
    ? appraisal.softSkillScores.filter(s => !shouldHideSoftSkill(s))
    : []);

  const softSkillsTotals = visibleSoftSkillScores.reduce(
    (acc, s) => {
      const rating = parseFloat(s?.rating) || 0;
      const weight = getSoftSkillWeightFromRating(rating);
      const weightedScore = weight * rating;
      acc.totalWeight += weight;
      acc.totalWeightedScore += weightedScore;
      return acc;
    },
    { totalWeight: 0, totalWeightedScore: 0 }
  );

  const computedSectionCTotal = softSkillsTotals.totalWeight > 0
    ? Math.round((softSkillsTotals.totalWeightedScore / softSkillsTotals.totalWeight) * 0.3)
    : 0;

  const krasByPillar = normalizedKraScores.reduce((acc, kra) => {
    const pillar = kra.pillar_name || 'Other';
    if (!acc[pillar]) acc[pillar] = [];
    acc[pillar].push(kra);
    return acc;
  }, {}) || {};

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  if (error || !appraisal) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">{error || 'Appraisal not found'}</h3>
          <button onClick={() => navigate('/performance-appraisals')} className="mt-4 btn-primary">
            Back to Appraisals
          </button>
        </div>
      </Layout>
    );
  }

  const canEdit = (() => {
    const appraisalUserId = appraisal?.user_id;
    const isOwn = user?.id && appraisalUserId && String(user.id) === String(appraisalUserId);

    if (hasRole('CEO') || hasRole('Super Admin')) return true;
    if (hasRole('HR')) return true;
    if (hasRole('HOD') || hasRole('Supervisor')) return true;
    if (isOwn) return true;
    return false;
  })();

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 print:space-y-4">
        {/* Header - Hidden on print */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between print:hidden gap-3 sm:gap-0">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/performance-appraisals')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Performance Appraisal</h1>
              <p className="text-gray-600">
                {appraisal.first_name} {appraisal.last_name} - {appraisal.period_type === 'Quarterly' ? `Q${appraisal.period_quarter} ` : ''}{appraisal.period_year}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center items-stretch gap-2 sm:gap-3">
            {getStatusBadge(appraisal.status)}
            <button onClick={handlePrint} className="btn-secondary inline-flex items-center text-sm sm:text-base">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </button>
            <button onClick={handleExportExcel} className="btn-secondary inline-flex items-center text-sm sm:text-base">
              <FileText className="w-4 h-4 mr-2" />
              Export to Excel
            </button>
            {canEdit && (
              <Link to={`/performance-appraisals/${id}/edit`} className="btn-primary inline-flex items-center text-sm sm:text-base">
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Link>
            )}
          </div>
        </div>

        {/* Print Header */}
        <div className="hidden print:block text-center mb-6">
          <h1 className="text-xl font-bold">WINAS SACCO</h1>
          <h2 className="text-lg font-semibold">STAFF PERFORMANCE APPRAISAL TOOL</h2>
          <p className="text-sm">{appraisal.period_type === 'Quarterly' ? `Q${appraisal.period_quarter} ` : ''}{appraisal.period_year}</p>
        </div>

        {/* Section A: Employee Details */}
        <div className="card print:border print:shadow-none">
          <div className="flex items-center space-x-3 mb-4">
            <User className="w-5 h-5 text-primary-600 print:text-black" />
            <h2 className="text-lg font-semibold">Section A: Employee Details</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Name:</span>
              <p className="font-medium">{appraisal.first_name} {appraisal.last_name}</p>
            </div>
            <div>
              <span className="text-gray-500">PF Number:</span>
              <p className="font-medium">{appraisal.pf_number || appraisal.employee_number}</p>
            </div>
            <div>
              <span className="text-gray-500">Branch/Department:</span>
              <p className="font-medium">{appraisal.branch_department || appraisal.department_name}</p>
            </div>
            <div>
              <span className="text-gray-500">Position:</span>
              <p className="font-medium">{appraisal.position || appraisal.job_title}</p>
            </div>
            <div>
              <span className="text-gray-500">Supervisor:</span>
              <p className="font-medium">
                {appraisal.supervisor_first_name ? 
                  `${appraisal.supervisor_first_name} ${appraisal.supervisor_last_name}` : 
                  'N/A'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Period:</span>
              <p className="font-medium">
                {appraisal.period_type === 'Quarterly' ? `Q${appraisal.period_quarter} ` : ''}{appraisal.period_year}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Appraisal Date:</span>
              <p className="font-medium">
                {appraisal.appraisal_date ? new Date(appraisal.appraisal_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Section B: Performance Targets */}
        <div className="card print:border print:shadow-none print:break-before-page">
          <div className="flex items-center space-x-3 mb-4">
            <Target className="w-5 h-5 text-primary-600 print:text-black" />
            <h2 className="text-lg font-semibold">Section B: Performance Targets (Strategic Objectives - 70%)</h2>
          </div>

          {(() => {
            const activeMonths = getMonthsForPeriod(appraisal.period_type, appraisal.period_quarter, appraisal.period_semi);

            const performanceSectionsData = normalizePerformanceSectionsData(appraisal.performanceSectionsData);
            const performanceSectionsScores = buildPerformanceSectionsFromScores(appraisal.performanceSectionScores);
            const kraSections = Object.entries(krasByPillar).map(([pillarName, kras], idx) => {
              const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
              const rows = kras.map((kra) => {
                const base = createEmptyRow();
                const row = {
                  ...base,
                  id: kra.id || base.id,
                  pillar: pillarName,
                  keyResultArea: kra.kra_name || '',
                  target: kra.target_description || kra.target || ''
                };

                months.forEach((m) => {
                  const t = kra?.[`${m}_target`];
                  const a = kra?.[`${m}_actual`];
                  row[`${m}Target`] = t ?? '';
                  row[`${m}Actual`] = a ?? '';
                  const pctRaw = kra?.[`${m}_percent`];
                  if (pctRaw !== undefined && pctRaw !== null) {
                    row[`${m}Percent`] = pctRaw;
                  } else {
                    const tn = Number(t);
                    const an = Number(a);
                    row[`${m}Percent`] = Number.isFinite(tn) && tn !== 0 && Number.isFinite(an) ? Math.round((an / tn) * 100) : 0;
                  }
                });

                row.targetTotal = kra.target_total ?? 0;
                row.actualTotal = kra.actual_total ?? 0;
                row.percentAchieved = kra.percent_achieved ?? 0;
                row.weight = kra.kra_weight ?? 0;
                row.actualRating = kra.actual_rating ?? kra.percent_achieved ?? 0;
                row.weightedAverage = kra.weighted_average ?? 0;
                return row;
              });

              const subtotalWeight = rows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);
              const subtotalWeightedAverage = rows.reduce((sum, r) => sum + (parseFloat(r.weightedAverage) || 0), 0);
              return {
                id: `kra_${idx}`,
                name: pillarName,
                rows,
                subtotalWeight,
                subtotalWeightedAverage
              };
            });

            const rawSections = (performanceSectionsData && performanceSectionsData.length > 0)
              ? performanceSectionsData
              : ((performanceSectionsScores && performanceSectionsScores.length > 0)
                ? performanceSectionsScores
                : (kraSections.length > 0 ? kraSections : null));

            const sections = rawSections ? normalizeSectionBToTemplates(rawSections) : null;
            const monthChunks = chunkMonthsForPrint(activeMonths);
            const printChunks = monthChunks.length > 0
              ? [
                ...monthChunks.map(chunk => ({ type: 'months', months: chunk })),
                { type: 'totals' }
              ]
              : [{ type: 'totals' }];

            const sectionBTotals = Array.isArray(sections)
              ? sections.reduce(
                (acc, s) => {
                  acc.totalWeight += parseFloat(s.subtotalWeight) || 0;
                  acc.totalWeightedAverage += parseFloat(s.subtotalWeightedAverage) || 0;
                  return acc;
                },
                { totalWeight: 0, totalWeightedAverage: 0 }
              )
              : { totalWeight: 0, totalWeightedAverage: 0 };

            const computedSectionBTotal = sectionBTotals.totalWeight > 0
              ? Math.round((sectionBTotals.totalWeightedAverage / sectionBTotals.totalWeight) * 0.7)
              : 0;

            const displayValue = (v) => {
              if (v === 0) return 0;
              if (v === null || v === undefined) return '-';
              if (typeof v === 'string' && v.trim() === '') return '-';
              return v;
            };

            if (!sections || sections.length === 0) {
              return <p className="text-gray-500">No performance targets recorded</p>;
            }

            return (
              <div className="space-y-8">
                {sections.map((section) => {
                  const subtotalWeight = section.subtotalWeight ?? section.rows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);
                  const subtotalWeightedAverage = section.subtotalWeightedAverage ?? section.rows.reduce((sum, r) => sum + (parseFloat(r.weightedAverage) || 0), 0);

                  return (
                    <div key={section.id} className="border-2 border-gray-200 rounded-xl overflow-hidden print:overflow-visible shadow-sm">
                      <div className="bg-primary-50 px-4 py-2 font-semibold text-primary-700 print:bg-gray-100 print:text-black">
                        {section.name} Section
                      </div>

                      <div className="overflow-x-auto p-2 print-table-wrapper print:hidden">
                        <table className="w-full text-xs border-collapse print-table">
                          <thead>
                            <tr className="bg-gray-100">
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
                            {section.rows.map((row) => (
                              <tr key={row.id} className="hover:bg-gray-50">
                                <td className="border border-gray-300 p-2 align-top">{displayValue(row.pillar)}</td>
                                <td className="border border-gray-300 p-2 align-top">{displayValue(row.keyResultArea)}</td>
                                <td className="border border-gray-300 p-2 align-top">{displayValue(row.target)}</td>
                                {activeMonths.map(m => (
                                  <React.Fragment key={m.key}>
                                    <td className="border border-gray-300 p-2 bg-blue-50 text-center align-top">{displayValue(row[`${m.key}Target`])}</td>
                                    <td className="border border-gray-300 p-2 bg-yellow-50 text-center align-top">{displayValue(row[`${m.key}Actual`])}</td>
                                    <td className="border border-gray-300 p-2 bg-green-50 text-center font-medium align-top">
                                      {(() => {
                                        const dv = displayValue(row[`${m.key}Percent`]);
                                        return dv === '-' ? '-' : `${dv}%`;
                                      })()}
                                    </td>
                                  </React.Fragment>
                                ))}
                                <td className="border border-gray-300 p-2 bg-indigo-100 text-center font-bold align-top">{displayValue(row.targetTotal)}</td>
                                <td className="border border-gray-300 p-2 bg-indigo-100 text-center font-bold align-top">{displayValue(row.actualTotal)}</td>
                                <td className={`border border-gray-300 p-2 bg-purple-100 text-center font-bold align-top ${getRatingColor(row.percentAchieved)}`}>
                                  {(() => {
                                    const dv = displayValue(row.percentAchieved);
                                    return dv === '-' ? '-' : `${dv}%`;
                                  })()}
                                </td>
                                <td className="border border-gray-300 p-2 bg-orange-100 text-center font-bold align-top">{displayValue(row.weight)}</td>
                                <td className="border border-gray-300 p-2 bg-pink-100 text-center font-bold align-top">{displayValue(row.actualRating)}</td>
                                <td className="border border-gray-300 p-2 bg-emerald-100 text-center font-bold text-emerald-700 align-top">{parseFloat(row.weightedAverage || 0).toFixed(2)}</td>
                              </tr>
                            ))}

                            <tr className="bg-gray-200 font-bold">
                              <td colSpan={3} className="border border-gray-300 p-2 text-left">
                                Sub-Total {String(section.name || '').toUpperCase()}:
                              </td>
                              <td colSpan={activeMonths.length * 3 + 3} className="border border-gray-300 p-2"></td>
                              <td className="border border-gray-300 p-2 text-center bg-orange-200">{subtotalWeight}</td>
                              <td className="border border-gray-300 p-2 text-center bg-pink-200"></td>
                              <td className="border border-gray-300 p-2 text-center bg-emerald-200 text-emerald-800">{subtotalWeightedAverage.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="hidden print:block space-y-4 p-2">
                        {printChunks.map((chunk, chunkIndex) => {
                          const isTotalsChunk = chunk.type === 'totals';
                          const monthChunk = isTotalsChunk ? [] : chunk.months;
                          const subtotalColSpan = isTotalsChunk ? 3 : (monthChunk.length * 3 + 3);
                          const chunkKey = isTotalsChunk
                            ? `${section.id}-chunk-totals`
                            : `${section.id}-chunk-${chunkIndex}`;

                          return (
                            <div key={chunkKey} className="print-table-wrapper print-avoid-break">
                              <table className="w-full text-[10px] border-collapse print-table print-avoid-break">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="border border-gray-300 p-1 min-w-[120px] text-left font-bold">Pillar</th>
                                    <th className="border border-gray-300 p-1 min-w-[160px] text-left font-bold">Key Result Area</th>
                                    <th className="border border-gray-300 p-1 min-w-[110px] text-left font-bold">Target</th>
                                    {!isTotalsChunk && monthChunk.map(m => (
                                      <React.Fragment key={m.key}>
                                        <th className="border border-gray-300 p-1 bg-blue-50 font-bold min-w-[60px]">{m.label} Target</th>
                                        <th className="border border-gray-300 p-1 bg-yellow-50 font-bold min-w-[60px]">{m.label} Actual</th>
                                        <th className="border border-gray-300 p-1 bg-green-50 font-bold min-w-[55px]">{m.label} %</th>
                                      </React.Fragment>
                                    ))}
                                    {isTotalsChunk && (
                                      <>
                                        <th className="border border-gray-300 p-1 bg-indigo-100 font-bold min-w-[75px]">Total Target</th>
                                        <th className="border border-gray-300 p-1 bg-indigo-100 font-bold min-w-[75px]">Total Actual</th>
                                        <th className="border border-gray-300 p-1 bg-purple-100 font-bold min-w-[70px]">% Achieved</th>
                                        <th className="border border-gray-300 p-1 bg-orange-100 font-bold min-w-[60px]">Weight</th>
                                        <th className="border border-gray-300 p-1 bg-pink-100 font-bold min-w-[60px]">Rating</th>
                                        <th className="border border-gray-300 p-1 bg-emerald-100 font-bold min-w-[70px]">Wtd Avg</th>
                                      </>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {section.rows.map((row) => (
                                    <tr key={`${row.id}-${chunkKey}`} className="hover:bg-gray-50">
                                      <td className="border border-gray-300 p-1 align-top">{displayValue(row.pillar)}</td>
                                      <td className="border border-gray-300 p-1 align-top">{displayValue(row.keyResultArea)}</td>
                                      <td className="border border-gray-300 p-1 align-top">{displayValue(row.target)}</td>
                                      {!isTotalsChunk && monthChunk.map(m => (
                                        <React.Fragment key={m.key}>
                                          <td className="border border-gray-300 p-1 bg-blue-50 text-center align-top">{displayValue(row[`${m.key}Target`])}</td>
                                          <td className="border border-gray-300 p-1 bg-yellow-50 text-center align-top">{displayValue(row[`${m.key}Actual`])}</td>
                                          <td className="border border-gray-300 p-1 bg-green-50 text-center font-medium align-top">
                                            {(() => {
                                              const dv = displayValue(row[`${m.key}Percent`]);
                                              return dv === '-' ? '-' : `${dv}%`;
                                            })()}
                                          </td>
                                        </React.Fragment>
                                      ))}
                                      {isTotalsChunk && (
                                        <>
                                          <td className="border border-gray-300 p-1 bg-indigo-100 text-center font-bold align-top">{displayValue(row.targetTotal)}</td>
                                          <td className="border border-gray-300 p-1 bg-indigo-100 text-center font-bold align-top">{displayValue(row.actualTotal)}</td>
                                          <td className={`border border-gray-300 p-1 bg-purple-100 text-center font-bold align-top ${getRatingColor(row.percentAchieved)}`}>
                                            {(() => {
                                              const dv = displayValue(row.percentAchieved);
                                              return dv === '-' ? '-' : `${dv}%`;
                                            })()}
                                          </td>
                                          <td className="border border-gray-300 p-1 bg-orange-100 text-center font-bold align-top">{displayValue(row.weight)}</td>
                                          <td className="border border-gray-300 p-1 bg-pink-100 text-center font-bold align-top">{displayValue(row.actualRating)}</td>
                                          <td className="border border-gray-300 p-1 bg-emerald-100 text-center font-bold text-emerald-700 align-top">
                                            {parseFloat(row.weightedAverage || 0).toFixed(2)}
                                          </td>
                                        </>
                                      )}
                                    </tr>
                                  ))}

                                  {isTotalsChunk && (
                                    <tr className="bg-gray-200 font-bold">
                                      <td colSpan={3} className="border border-gray-300 p-1 text-left">
                                        Sub-Total {String(section.name || '').toUpperCase()}:
                                      </td>
                                      <td colSpan={subtotalColSpan} className="border border-gray-300 p-1"></td>
                                      <td className="border border-gray-300 p-1 text-center bg-orange-200">{subtotalWeight}</td>
                                      <td className="border border-gray-300 p-1 text-center bg-pink-200"></td>
                                      <td className="border border-gray-300 p-1 text-center bg-emerald-200 text-emerald-800">{subtotalWeightedAverage.toFixed(2)}</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="bg-primary-100 rounded-lg p-4 flex justify-between items-center print:bg-gray-100">
                  <span className="font-semibold">Section B Total (Strategic Objectives - 70%)</span>
                  <span className="text-2xl font-bold text-primary-700 print:text-black">
                    {computedSectionBTotal}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Section C: Soft Skills */}
        <div className="card print:border print:shadow-none">
          <div className="flex items-center space-x-3 mb-4">
            <Award className="w-5 h-5 text-primary-600 print:text-black" />
            <h2 className="text-lg font-semibold">Section C: Soft Skills / Behavior Traits (30%)</h2>
          </div>
          
          {/* Rating Key */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4 print:border">
            <h4 className="font-medium text-gray-700 mb-2 text-sm">Rating Key</h4>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
              {ratingKey.map((item, index) => (
                <div key={index} className="bg-white rounded p-2 text-center border">
                  <div className="font-bold text-primary-600 print:text-black">{item.point}</div>
                  <div className="text-gray-500">{item.range}</div>
                  <div className="text-gray-700 text-xs">{item.description}</div>
                </div>
              ))}
            </div>
          </div>
          
          {visibleSoftSkillScores.length === 0 ? (
            <p className="text-gray-500">No soft skills recorded</p>
          ) : (
            <>
              <div className="overflow-x-auto print-table-wrapper">
                <table className="min-w-full text-sm print-table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Soft Skill</th>
                      <th className="px-4 py-2 text-center w-20">Weight</th>
                      <th className="px-4 py-2 text-center w-20">Rating</th>
                      <th className="px-4 py-2 text-center w-24">Weighted Score</th>
                      <th className="px-4 py-2 text-left">Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSoftSkillScores.map((skill, index) => {
                      const rating = parseFloat(skill?.rating) || 0;
                      const weight = getSoftSkillWeightFromRating(rating);
                      const weightedScore = weight * rating;
                      return (
                      <tr key={skill.id || index} className="border-t">
                        <td className="px-4 py-2">
                          <div className="font-medium">{skill.skill_name}</div>
                          <div className="text-xs text-gray-500">{skill.description}</div>
                        </td>
                        <td className="px-4 py-2 text-center">{weight}</td>
                        <td className="px-4 py-2 text-center font-medium">{skill.rating}</td>
                        <td className="px-4 py-2 text-center bg-green-50 font-medium">
                          {weightedScore.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-gray-600">{skill.comments || '-'}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="bg-secondary-100 rounded-lg p-4 flex justify-between items-center mt-4 print:bg-gray-100">
                <span className="font-semibold">Section C Total (Soft Skills - 30%)</span>
                <span className="text-2xl font-bold text-secondary-700 print:text-black">
                  {computedSectionCTotal}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Part E: Overall Performance */}
        <div className="card bg-gradient-to-r from-primary-50 to-secondary-50 print:bg-gray-50 print:border">
          <div className="flex items-center space-x-3 mb-4">
            <TrendingUp className="w-5 h-5 text-primary-600 print:text-black" />
            <h2 className="text-lg font-semibold">Part E: Overall Performance Rating</h2>
          </div>
          
          {(() => {
            const performanceSectionsData = normalizePerformanceSectionsData(appraisal.performanceSectionsData);
            const performanceSectionsScores = buildPerformanceSectionsFromScores(appraisal.performanceSectionScores);

            const kraSections = Object.entries(krasByPillar).map(([pillarName, kras], idx) => {
              const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
              const rows = kras.map((kra) => {
                const base = createEmptyRow();
                const row = {
                  ...base,
                  id: kra.id || base.id,
                  pillar: pillarName,
                  keyResultArea: kra.kra_name || '',
                  target: kra.target_description || kra.target || ''
                };
                months.forEach((m) => {
                  row[`${m}Target`] = kra?.[`${m}_target`] ?? '';
                  row[`${m}Actual`] = kra?.[`${m}_actual`] ?? '';
                  row[`${m}Percent`] = kra?.[`${m}_percent`] ?? 0;
                });
                row.targetTotal = kra.target_total ?? 0;
                row.actualTotal = kra.actual_total ?? 0;
                row.percentAchieved = kra.percent_achieved ?? 0;
                row.weight = kra.kra_weight ?? 0;
                row.actualRating = kra.actual_rating ?? kra.percent_achieved ?? 0;
                row.weightedAverage = kra.weighted_average ?? 0;
                return row;
              });
              const subtotalWeight = rows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);
              const subtotalWeightedAverage = rows.reduce((sum, r) => sum + (parseFloat(r.weightedAverage) || 0), 0);
              return { id: `kra_${idx}`, name: pillarName, rows, subtotalWeight, subtotalWeightedAverage };
            });

            const rawSections = (performanceSectionsData && performanceSectionsData.length > 0)
              ? performanceSectionsData
              : ((performanceSectionsScores && performanceSectionsScores.length > 0)
                ? performanceSectionsScores
                : (kraSections.length > 0 ? kraSections : null));

            const sections = rawSections ? normalizeSectionBToTemplates(rawSections) : null;
            const sectionBTotals = Array.isArray(sections)
              ? sections.reduce(
                (acc, s) => {
                  acc.totalWeight += parseFloat(s.subtotalWeight) || 0;
                  acc.totalWeightedAverage += parseFloat(s.subtotalWeightedAverage) || 0;
                  return acc;
                },
                { totalWeight: 0, totalWeightedAverage: 0 }
              )
              : { totalWeight: 0, totalWeightedAverage: 0 };

            const computedSectionBTotal = sectionBTotals.totalWeight > 0
              ? Math.round((sectionBTotals.totalWeightedAverage / sectionBTotals.totalWeight) * 0.7)
              : 0;

            const totalPerformanceRating = Math.round((parseFloat(computedSectionBTotal) || 0) + (parseFloat(computedSectionCTotal) || 0));

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 text-center shadow-sm print:border">
                  <div className="text-sm text-gray-600 mb-1">Strategic Objectives (70%)</div>
                  <div className="text-2xl font-bold text-primary-600 print:text-black">
                    {computedSectionBTotal}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center shadow-sm print:border">
                  <div className="text-sm text-gray-600 mb-1">Soft Skills (30%)</div>
                  <div className="text-2xl font-bold text-secondary-600 print:text-black">
                    {computedSectionCTotal}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center border-2 border-primary-500 shadow-sm">
                  <div className="text-sm text-gray-600 mb-1">Total Performance Rating</div>
                  <div className={`text-3xl font-bold ${getRatingColor(totalPerformanceRating)}`}>
                    {totalPerformanceRating}%
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Part F: Courses Attended */}
        {appraisal.courses?.length > 0 && (
          <div className="card print:border print:shadow-none">
            <div className="flex items-center space-x-3 mb-4">
              <BookOpen className="w-5 h-5 text-primary-600 print:text-black" />
              <h2 className="text-lg font-semibold">Part F: Courses/Training Attended</h2>
            </div>
            
            <div className="overflow-x-auto print-table-wrapper">
              <table className="min-w-full text-sm print-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Course/Training</th>
                    <th className="px-4 py-2 text-left">Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {appraisal.courses.map((course, index) => (
                    <tr key={course.id || index} className="border-t">
                      <td className="px-4 py-2">{index + 1}</td>
                      <td className="px-4 py-2 font-medium">{course.course_name}</td>
                      <td className="px-4 py-2 text-gray-600">{course.comments || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Part F: Development Plans */}
        {appraisal.developmentPlans?.length > 0 && (
          <div className="card print:border print:shadow-none">
            <div className="flex items-center space-x-3 mb-4">
              <TrendingUp className="w-5 h-5 text-primary-600 print:text-black" />
              <h2 className="text-lg font-semibold">Part F: Development Plans</h2>
            </div>
            
            <div className="overflow-x-auto print-table-wrapper">
              <table className="min-w-full text-sm print-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Area for Development</th>
                    <th className="px-4 py-2 text-left">Manager Actions</th>
                    <th className="px-4 py-2 text-left">Target Date</th>
                  </tr>
                </thead>
                <tbody>
                  {appraisal.developmentPlans.map((plan, index) => (
                    <tr key={plan.id || index} className="border-t">
                      <td className="px-4 py-2">{index + 1}</td>
                      <td className="px-4 py-2">{plan.plan_description}</td>
                      <td className="px-4 py-2">{plan.manager_actions || '-'}</td>
                      <td className="px-4 py-2">
                        {plan.target_completion_date ? 
                          new Date(plan.target_completion_date).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Part F: Comments */}
        <div className="card print:border print:shadow-none print:break-before-page">
          <div className="flex items-center space-x-3 mb-4">
            <MessageSquare className="w-5 h-5 text-primary-600 print:text-black" />
            <h2 className="text-lg font-semibold">Part F: Comments & Signatures</h2>
          </div>
          
          <div className="space-y-4">
            {appraisal.appraisee_comments && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2">Appraisee Comments</h4>
                <p className="text-gray-600">{appraisal.appraisee_comments}</p>
                {appraisal.appraisee_signature_date && (
                  <p className="text-xs text-gray-400 mt-2">
                    Signed: {new Date(appraisal.appraisee_signature_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
            
            {appraisal.appraiser_comments && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2">Appraiser/Supervisor Comments</h4>
                <p className="text-gray-600">{appraisal.appraiser_comments}</p>
                {appraisal.appraiser_signature_date && (
                  <p className="text-xs text-gray-400 mt-2">
                    Signed: {new Date(appraisal.appraiser_signature_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
            
            {appraisal.hod_comments && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2">HOD Comments</h4>
                <p className="text-gray-600">{appraisal.hod_comments}</p>
                {appraisal.hod_signature_date && (
                  <p className="text-xs text-gray-400 mt-2">
                    Signed: {new Date(appraisal.hod_signature_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
            
            {appraisal.hr_comments && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2">HR Comments</h4>
                <p className="text-gray-600">{appraisal.hr_comments}</p>
                {appraisal.hr_signature_date && (
                  <p className="text-xs text-gray-400 mt-2">
                    Signed: {new Date(appraisal.hr_signature_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
            
            {appraisal.ceo_comments && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2">CEO Comments</h4>
                <p className="text-gray-600">{appraisal.ceo_comments}</p>
                {appraisal.ceo_signature_date && (
                  <p className="text-xs text-gray-400 mt-2">
                    Signed: {new Date(appraisal.ceo_signature_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
            
            {!appraisal.appraisee_comments && !appraisal.appraiser_comments && 
             !appraisal.hod_comments && !appraisal.hr_comments && !appraisal.ceo_comments && (
              <p className="text-gray-500">No comments recorded</p>
            )}
          </div>
        </div>

        {/* Print Footer */}
        <div className="hidden print:block text-center text-xs text-gray-500 mt-8">
          <p>Generated on {new Date().toLocaleString()}</p>
          <p>WINAS SACCO - Staff Performance Appraisal System</p>
        </div>
      </div>
    </Layout>
  );
};

export default PerformanceAppraisalDetails;
