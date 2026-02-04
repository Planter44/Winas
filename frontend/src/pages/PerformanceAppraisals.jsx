import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { performanceAppraisalAPI } from '../services/api';
import { 
  Plus, Eye, Edit2, Trash2, Search, Filter, 
  Calendar, User, Award, CheckCircle, Clock, AlertCircle, ArrowLeft 
} from 'lucide-react';

const PerformanceAppraisals = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasRole } = useAuth();
  const [appraisals, setAppraisals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterStatus, setFilterStatus] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');

  const isPendingReviewStatus = (status) => {
    return ['Draft', 'Submitted', 'Supervisor_Review', 'HOD_Review', 'HR_Review', 'CEO_Approved'].includes(status);
  };

  const isFinalizedGroupStatus = (status) => {
    return ['Finalized'].includes(status);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const group = params.get('group');
    const scope = params.get('scope');
    if (group === 'pending_review' || group === 'finalized') {
      setFilterStatus('');
      setQuickFilter(group);
    } else {
      setQuickFilter('');
    }
    setScopeFilter(scope === 'mine' ? 'mine' : '');
  }, [location.search]);

  useEffect(() => {
    fetchAppraisals();
  }, [filterYear, filterStatus, scopeFilter, user?.id]);

  const fetchAppraisals = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterYear) params.periodYear = filterYear;
      if (filterStatus) params.status = filterStatus;
      if (scopeFilter === 'mine' && user?.id) params.userId = user.id;
      
      const response = await performanceAppraisalAPI.getAll(params);
      setAppraisals(response.data);
    } catch (error) {
      console.error('Error fetching appraisals:', error);
      setError('Failed to load appraisals');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this appraisal?')) return;
    
    try {
      await performanceAppraisalAPI.delete(id);
      fetchAppraisals();
    } catch (error) {
      setError('Failed to delete appraisal');
    }
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
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status?.replace('_', ' ')}
      </span>
    );
  };

  const getRatingBadge = (rating) => {
    if (!rating) return null;
    
    let color = 'bg-gray-100 text-gray-700';
    if (rating >= 90) color = 'bg-green-100 text-green-700';
    else if (rating >= 80) color = 'bg-blue-100 text-blue-700';
    else if (rating >= 70) color = 'bg-yellow-100 text-yellow-700';
    else color = 'bg-red-100 text-red-700';
    
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        {parseFloat(rating).toFixed(1)}%
      </span>
    );
  };

  const filteredAppraisals = appraisals.filter(appraisal => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${appraisal.first_name} ${appraisal.last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(searchLower) || 
      appraisal.employee_number?.toLowerCase().includes(searchLower) ||
      appraisal.department_name?.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    if (quickFilter === 'pending_review') return isPendingReviewStatus(appraisal.status);
    if (quickFilter === 'finalized') return isFinalizedGroupStatus(appraisal.status);
    return true;
  });

  const canCreate = hasRole('HOD') || hasRole('HR') || hasRole('Super Admin') || hasRole('CEO');

  const canEditAppraisal = (appraisal) => {
    const appraisalUserId = appraisal?.user_id;
    const isOwn = user?.id && appraisalUserId && String(user.id) === String(appraisalUserId);

    if (hasRole('CEO') || hasRole('Super Admin')) return true;
    if (hasRole('HR')) return true;
    if (hasRole('HOD') || hasRole('Supervisor')) return true;
    if (isOwn) return true;
    return false;
  };

  const canDeleteAppraisal = (appraisal) => {
    const appraisalUserId = appraisal?.user_id;
    const isOwn = user?.id && appraisalUserId && String(user.id) === String(appraisalUserId);

    if (isOwn && !(hasRole('CEO') || hasRole('Super Admin'))) return false;

    return hasRole('CEO') || hasRole('HR') || hasRole('Super Admin');
  };

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(y);
  }

  const groupTitle = quickFilter === 'pending_review'
    ? 'Pending Review'
    : quickFilter === 'finalized'
      ? 'Finalized'
      : '';

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            {(quickFilter === 'pending_review' || quickFilter === 'finalized') && (
              <button
                type="button"
                onClick={() => {
                  setQuickFilter('');
                  navigate(scopeFilter === 'mine' ? '/performance-appraisals?scope=mine' : '/performance-appraisals');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Performance Appraisals{groupTitle ? ` - ${groupTitle}` : ''}
              </h1>
              <p className="text-gray-600 mt-1">WINAS SACCO Staff Performance Evaluation</p>
            </div>
          </div>
          {canCreate && (
            <Link
              to="/performance-appraisals/new"
              className="btn-primary inline-flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Appraisal
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by name, employee number, or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="input-field w-32"
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-field w-40"
              >
                <option value="">All Status</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="Finalized">Finalized</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        {/* Appraisals Table */}
        <div className="card overflow-hidden p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredAppraisals.length === 0 ? (
            <div className="text-center py-12">
              <Award className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No appraisals found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {canCreate ? 'Get started by creating a new performance appraisal.' : 'No appraisals available for your view.'}
              </p>
            </div>
          ) : (
            <>
              <div className="md:hidden">
                <div className="grid grid-cols-2 gap-3">
                  {filteredAppraisals.map((appraisal) => (
                    <div key={appraisal.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {appraisal.first_name} {appraisal.last_name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{appraisal.department_name || 'N/A'}</p>
                        </div>
                        <div className="shrink-0">{getStatusBadge(appraisal.status)}</div>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>
                            {appraisal.period_type === 'Quarterly' ? `Q${appraisal.period_quarter} ` : ''}
                            {appraisal.period_year}
                          </span>
                        </div>
                        <div className="text-gray-500">{appraisal.employee_number}</div>
                      </div>
                      <div className="mt-2">
                        {getRatingBadge(appraisal.total_performance_rating) || (
                          <span className="text-xs text-gray-400">No rating</span>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <Link
                          to={`/performance-appraisals/${appraisal.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Link>
                        <div className="flex items-center gap-2">
                          {canEditAppraisal(appraisal) && (
                            <Link
                              to={`/performance-appraisals/${appraisal.id}/edit`}
                              className="text-gray-500 hover:text-gray-800"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Link>
                          )}
                          {canDeleteAppraisal(appraisal) && (
                            <button
                              onClick={() => handleDelete(appraisal.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employee
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Department
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Period
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rating
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAppraisals.map((appraisal) => (
                      <tr key={appraisal.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                              <User className="h-5 w-5 text-primary-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {appraisal.first_name} {appraisal.last_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {appraisal.employee_number}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{appraisal.department_name}</div>
                          <div className="text-sm text-gray-500">{appraisal.job_title}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                            {appraisal.period_type === 'Quarterly' ? `Q${appraisal.period_quarter} ` : ''}
                            {appraisal.period_year}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getRatingBadge(appraisal.total_performance_rating)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(appraisal.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <Link
                              to={`/performance-appraisals/${appraisal.id}`}
                              className="text-primary-600 hover:text-primary-900 p-1"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            {canEditAppraisal(appraisal) && (
                              <Link
                                to={`/performance-appraisals/${appraisal.id}/edit`}
                                className="text-gray-600 hover:text-gray-900 p-1"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Link>
                            )}
                            {canDeleteAppraisal(appraisal) && (
                              <button
                                onClick={() => handleDelete(appraisal.id)}
                                className="text-red-600 hover:text-red-900 p-1"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Summary Stats */}
        {!loading && filteredAppraisals.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-700">{filteredAppraisals.length}</div>
              <div className="text-sm text-blue-600">Total Appraisals</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFilterStatus('');
                setQuickFilter('pending_review');
                navigate('/performance-appraisals?group=pending_review');
              }}
              className="bg-yellow-50 rounded-lg p-4 text-left hover:bg-yellow-100 transition-colors"
            >
              <div className="text-2xl font-bold text-yellow-700">
                {filteredAppraisals.filter(a => isPendingReviewStatus(a.status)).length}
              </div>
              <div className="text-sm text-yellow-600">Pending Review</div>
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterStatus('');
                setQuickFilter('finalized');
                navigate('/performance-appraisals?group=finalized');
              }}
              className="bg-green-50 rounded-lg p-4 text-left hover:bg-green-100 transition-colors"
            >
              <div className="text-2xl font-bold text-green-700">
                {filteredAppraisals.filter(a => isFinalizedGroupStatus(a.status)).length}
              </div>
              <div className="text-sm text-green-600">Finalized</div>
            </button>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-700">
                {filteredAppraisals.length > 0 
                  ? (filteredAppraisals.reduce((sum, a) => sum + (parseFloat(a.total_performance_rating) || 0), 0) / filteredAppraisals.length).toFixed(1)
                  : 0}%
              </div>
              <div className="text-sm text-purple-600">Avg. Rating</div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PerformanceAppraisals;
