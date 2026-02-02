import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { appraisalAPI } from '../services/api';
import { Plus, Eye, Award } from 'lucide-react';

const Appraisals = () => {
  const { user, hasMinLevel } = useAuth();
  const [appraisals, setAppraisals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    fetchAppraisals();
  }, [statusFilter, yearFilter]);

  const fetchAppraisals = async () => {
    try {
      const response = await appraisalAPI.getAll({
        status: statusFilter,
        periodYear: yearFilter
      });
      setAppraisals(response.data);
    } catch (error) {
      console.error('Failed to fetch appraisals:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      Draft: 'badge-warning',
      Submitted: 'badge-info',
      Reviewed: 'badge-info',
      Finalized: 'badge-success'
    };
    return badges[status] || 'badge-info';
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Appraisals</h1>
          <p className="text-gray-600">Manage employee performance appraisals</p>
        </div>
        {(user?.role === 'HR' || user?.role === 'CEO' || user?.role === 'Super Admin') && (
          <Link to="/appraisals/new" className="btn-primary flex items-center">
            <Plus className="mr-2" size={20} />
            New Appraisal
          </Link>
        )}
      </div>

      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field"
          >
            <option value="">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Submitted">Submitted</option>
            <option value="Reviewed">Reviewed</option>
            <option value="Finalized">Finalized</option>
          </select>

          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="input-field"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setStatusFilter('');
              setYearFilter(new Date().getFullYear().toString());
            }}
            className="btn-secondary"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supervisor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
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
              {appraisals.map((appraisal) => (
                <tr key={appraisal.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {appraisal.first_name} {appraisal.last_name}
                    </div>
                    <div className="text-sm text-gray-500">{appraisal.job_title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {appraisal.period_type} {appraisal.period_year}
                    {appraisal.period_quarter && ` Q${appraisal.period_quarter}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {appraisal.supervisor_first_name} {appraisal.supervisor_last_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Award className="mr-2 text-yellow-500" size={18} />
                      <span className="text-sm font-medium text-gray-900">
                        {appraisal.overall_score ? parseFloat(appraisal.overall_score).toFixed(2) : 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`badge ${getStatusBadge(appraisal.status)}`}>
                      {appraisal.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/appraisals/${appraisal.id}`}
                      className="text-primary-600 hover:text-primary-900 inline-flex items-center"
                    >
                      <Eye size={18} className="mr-1" />
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {appraisals.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No appraisals found
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Appraisals;
