import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { appraisalAPI } from '../services/api';
import { ArrowLeft, Award, User, Calendar, Edit } from 'lucide-react';

const AppraisalDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasMinLevel } = useAuth();
  
  const [appraisal, setAppraisal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppraisal();
  }, [id]);

  const fetchAppraisal = async () => {
    try {
      const response = await appraisalAPI.getById(id);
      setAppraisal(response.data);
    } catch (error) {
      console.error('Failed to fetch appraisal:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 4.5) return 'text-green-600';
    if (score >= 3.5) return 'text-blue-600';
    if (score >= 2.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score) => {
    if (score >= 4.5) return 'Excellent';
    if (score >= 3.5) return 'Good';
    if (score >= 2.5) return 'Average';
    return 'Needs Improvement';
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

  if (!appraisal) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600">Appraisal not found</p>
        </div>
      </Layout>
    );
  }

  const canEdit = hasMinLevel(5) && appraisal.status !== 'Finalized';

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate('/appraisals')} className="mr-4 text-gray-600 hover:text-gray-900">
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Performance Appraisal</h1>
              <p className="text-gray-600">Appraisal ID: #{appraisal.id}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className={`badge ${
              appraisal.status === 'Finalized' ? 'badge-success' :
              appraisal.status === 'Reviewed' ? 'badge-info' : 'badge-warning'
            }`}>
              {appraisal.status}
            </span>
            {canEdit && (
              <Link to={`/appraisals/${id}/edit`} className="btn-primary flex items-center">
                <Edit className="mr-2" size={18} />
                Edit
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Employee Information</h3>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <User className="mr-3 text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Employee</p>
                    <p className="text-gray-900">
                      {appraisal.first_name} {appraisal.last_name}
                    </p>
                    <p className="text-sm text-gray-500">{appraisal.employee_number}</p>
                    <p className="text-sm text-gray-500">{appraisal.job_title}</p>
                    <p className="text-sm text-gray-500">{appraisal.department_name}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Calendar className="mr-3 text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Appraisal Period</p>
                    <p className="text-gray-900">
                      {appraisal.period_type} {appraisal.period_year}
                      {appraisal.period_quarter && ` - Q${appraisal.period_quarter}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <User className="mr-3 text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Supervisor</p>
                    <p className="text-gray-900">
                      {appraisal.supervisor_first_name} {appraisal.supervisor_last_name}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Scores</h3>
              
              <div className="space-y-4">
                {appraisal.scores && appraisal.scores.map((score, index) => (
                  <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900">{score.criteria}</h4>
                      <div className="flex items-center">
                        <span className="text-2xl font-bold text-primary-600 mr-2">
                          {score.score}
                        </span>
                        <span className="text-sm text-gray-500">/ 5</span>
                      </div>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full"
                        style={{ width: `${(score.score / 5) * 100}%` }}
                      />
                    </div>

                    {score.comment && (
                      <p className="text-sm text-gray-600 mt-2">{score.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {appraisal.supervisor_comment && (
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Supervisor Comments</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{appraisal.supervisor_comment}</p>
              </div>
            )}

            {appraisal.hr_comment && (
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">HR Comments</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{appraisal.hr_comment}</p>
                {appraisal.hr_first_name && (
                  <p className="text-sm text-gray-500 mt-2">
                    - {appraisal.hr_first_name} {appraisal.hr_last_name}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="card">
              <div className="text-center">
                <Award className="mx-auto mb-2 text-yellow-500" size={48} />
                <p className="text-sm font-medium text-gray-600 mb-2">Overall Score</p>
                <p className={`text-5xl font-bold ${getScoreColor(appraisal.overall_score)}`}>
                  {appraisal.overall_score ? parseFloat(appraisal.overall_score).toFixed(2) : 'N/A'}
                </p>
                <p className="text-sm text-gray-500 mt-1">out of 5.00</p>
                {appraisal.overall_score && (
                  <p className="text-sm font-medium text-gray-700 mt-3">
                    {getScoreLabel(appraisal.overall_score)}
                  </p>
                )}
              </div>
            </div>

            <div className="card bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Score Breakdown</h3>
              {appraisal.scores && appraisal.scores.length > 0 ? (
                <div className="space-y-2">
                  {appraisal.scores.map((score, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{score.criteria}</span>
                      <span className="font-semibold text-gray-900">{score.score}/5</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No scores available</p>
              )}
            </div>

            {appraisal.finalized_at && (
              <div className="card bg-green-50 border-green-200">
                <p className="text-sm font-medium text-green-900 mb-1">Finalized</p>
                <p className="text-xs text-green-700">
                  {new Date(appraisal.finalized_at).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AppraisalDetails;
