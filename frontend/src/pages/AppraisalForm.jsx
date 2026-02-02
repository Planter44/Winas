import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { appraisalAPI, userAPI } from '../services/api';
import { Save, ArrowLeft } from 'lucide-react';

const AppraisalForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    userId: '',
    periodType: 'Quarterly',
    periodYear: new Date().getFullYear(),
    periodQuarter: 1,
    supervisorComment: '',
    scores: []
  });

  const [staff, setStaff] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
    if (isEdit) {
      fetchAppraisal();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      const [staffRes, criteriaRes] = await Promise.all([
        userAPI.getAll({ role: 'Staff' }),
        appraisalAPI.getCriteria()
      ]);

      setStaff(staffRes.data);
      setCriteria(criteriaRes.data);

      if (!isEdit) {
        setFormData(prev => ({
          ...prev,
          scores: criteriaRes.data.map(c => ({
            criteria: c.name,
            score: 3,
            comment: ''
          }))
        }));
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const fetchAppraisal = async () => {
    try {
      const response = await appraisalAPI.getById(id);
      const appraisal = response.data;

      setFormData({
        userId: appraisal.user_id,
        periodType: appraisal.period_type,
        periodYear: appraisal.period_year,
        periodQuarter: appraisal.period_quarter || 1,
        supervisorComment: appraisal.supervisor_comment || '',
        scores: appraisal.scores || []
      });
    } catch (error) {
      setError('Failed to load appraisal data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (isEdit) {
        await appraisalAPI.update(id, formData);
      } else {
        await appraisalAPI.create(formData);
      }
      navigate('/appraisals');
    } catch (error) {
      setError(error.response?.data?.error || `Failed to ${isEdit ? 'update' : 'create'} appraisal`);
      setSaving(false);
    }
  };

  const handleScoreChange = (index, field, value) => {
    const newScores = [...formData.scores];
    newScores[index] = { ...newScores[index], [field]: value };
    setFormData({ ...formData, scores: newScores });
  };

  const calculateOverallScore = () => {
    if (formData.scores.length === 0) return 0;
    const sum = formData.scores.reduce((acc, s) => acc + (parseInt(s.score) || 0), 0);
    return (sum / formData.scores.length).toFixed(2);
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
          <button onClick={() => navigate('/appraisals')} className="mr-4 text-gray-600 hover:text-gray-900">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isEdit ? 'Edit Appraisal' : 'New Performance Appraisal'}
            </h1>
            <p className="text-gray-600">
              {isEdit ? 'Update appraisal information' : 'Create a new performance appraisal'}
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Appraisal Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employee <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  className="input-field"
                  required
                  disabled={isEdit}
                >
                  <option value="">Select Employee</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} - {s.employee_number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Period Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.periodType}
                  onChange={(e) => setFormData({ ...formData, periodType: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="Quarterly">Quarterly</option>
                  <option value="Annual">Annual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.periodYear}
                  onChange={(e) => setFormData({ ...formData, periodYear: parseInt(e.target.value) })}
                  className="input-field"
                  required
                  min={2020}
                  max={2050}
                />
              </div>

              {formData.periodType === 'Quarterly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quarter <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.periodQuarter}
                    onChange={(e) => setFormData({ ...formData, periodQuarter: parseInt(e.target.value) })}
                    className="input-field"
                    required
                  >
                    <option value={1}>Q1 (Jan-Mar)</option>
                    <option value={2}>Q2 (Apr-Jun)</option>
                    <option value={3}>Q3 (Jul-Sep)</option>
                    <option value={4}>Q4 (Oct-Dec)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Performance Scores</h3>
              <div className="text-sm">
                <span className="text-gray-600">Overall Score: </span>
                <span className="text-2xl font-bold text-primary-600">{calculateOverallScore()}</span>
                <span className="text-gray-600"> / 5.00</span>
              </div>
            </div>

            <div className="space-y-6">
              {formData.scores.map((score, index) => (
                <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    {score.criteria}
                  </label>
                  
                  <div className="flex items-center space-x-4 mb-2">
                    <div className="flex space-x-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => handleScoreChange(index, 'score', rating)}
                          className={`w-12 h-12 rounded-lg border-2 font-semibold transition-colors ${
                            parseInt(score.score) === rating
                              ? 'border-primary-600 bg-primary-600 text-white'
                              : 'border-gray-300 text-gray-600 hover:border-primary-400'
                          }`}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Poor</span>
                        <span>Excellent</span>
                      </div>
                    </div>
                  </div>

                  <textarea
                    value={score.comment}
                    onChange={(e) => handleScoreChange(index, 'comment', e.target.value)}
                    placeholder="Add comments about this criteria..."
                    rows={2}
                    className="input-field"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="card mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Supervisor Comments</h3>
            <textarea
              value={formData.supervisorComment}
              onChange={(e) => setFormData({ ...formData, supervisorComment: e.target.value })}
              rows={4}
              className="input-field"
              placeholder="Overall comments about employee performance..."
            />
          </div>

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => navigate('/appraisals')}
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
              {saving ? 'Saving...' : isEdit ? 'Update Appraisal' : 'Create Appraisal'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default AppraisalForm;
