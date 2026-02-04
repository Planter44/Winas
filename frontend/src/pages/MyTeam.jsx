import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { teamAPI, messageAPI } from '../services/api';
import { Users, Mail, Building2, User, Phone } from 'lucide-react';

const MyTeam = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teamData, setTeamData] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [departmentMembers, setDepartmentMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageData, setMessageData] = useState({
    subject: '',
    content: '',
    recipientIds: [],
    isBroadcast: false
  });
  const [selectedRecipient, setSelectedRecipient] = useState(null);

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchTeamData = async () => {
    try {
      const response = await teamAPI.getMyTeam();
      setTeamData(response.data);
    } catch (error) {
      console.error('Failed to fetch team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentMembers = async (departmentId) => {
    try {
      const response = await teamAPI.getDepartmentMembers(departmentId);
      setDepartmentMembers(response.data);
      setSelectedDepartment(departmentId);
    } catch (error) {
      console.error('Failed to fetch department members:', error);
    }
  };

  const handleSendMessage = (recipient, isBroadcast = false) => {
    if (isBroadcast) {
      // For HOD/Supervisor broadcast, collect all team member IDs
      // For HR/CEO viewing a department, use departmentId
      let recipientIds = [];
      
      if (selectedDepartment) {
        // Broadcasting to a specific department (HR/CEO drill-down view)
        setMessageData({
          subject: '',
          content: '',
          recipientIds: departmentMembers.map(m => m.id),
          isBroadcast: true,
          departmentId: selectedDepartment
        });
      } else if (teamData?.teamMembers) {
        // HOD or Supervisor broadcasting to their team
        recipientIds = teamData.teamMembers.map(m => m.id);
        setMessageData({
          subject: '',
          content: '',
          recipientIds: recipientIds,
          isBroadcast: true
        });
      } else {
        setMessageData({
          subject: '',
          content: '',
          recipientIds: [],
          isBroadcast: true
        });
      }
    } else {
      setMessageData({
        subject: '',
        content: '',
        recipientIds: [recipient.id],
        isBroadcast: false
      });
      setSelectedRecipient(recipient);
    }
    setShowMessageModal(true);
  };

  const submitMessage = async (e) => {
    e.preventDefault();
    try {
      await messageAPI.send(messageData);
      setShowMessageModal(false);
      setMessageData({ subject: '', content: '', recipientIds: [], isBroadcast: false });
      alert('Message sent successfully!');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to send message');
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Team</h1>
        <p className="text-gray-600">Manage and communicate with your team members</p>
      </div>

      {/* HOD View - Supervisors and Staff in Department */}
      {user?.role === 'HOD' && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">My Department Team</h2>
            <button
              onClick={() => handleSendMessage(null, true)}
              className="btn-primary flex items-center"
            >
              <Mail className="mr-2" size={18} />
              Broadcast to Team
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 z-10 bg-gray-50 border-l border-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teamData.teamMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold mr-3">
                          {member.first_name?.[0]}{member.last_name?.[0]}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {member.first_name} {member.last_name}
                          </div>
                          <div className="text-sm text-gray-500">{member.employee_number}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {member.role_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{member.job_title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Phone size={14} className="mr-1" />
                        {member.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        member.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium sticky right-0 z-10 bg-white border-l border-gray-200">
                      <button
                        onClick={() => handleSendMessage(member, false)}
                        className="text-primary-600 hover:text-primary-900 flex items-center"
                      >
                        <Mail className="mr-1" size={16} />
                        Message
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Supervisor View - Staff Under Supervision */}
      {user?.role === 'Supervisor' && teamData?.teamMembers && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">My Staff</h2>
            <button
              onClick={() => handleSendMessage(null, true)}
              className="btn-primary flex items-center"
            >
              <Mail className="mr-2" size={18} />
              Broadcast to Staff
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 z-10 bg-gray-50 border-l border-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teamData.teamMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold mr-3">
                          {member.first_name?.[0]}{member.last_name?.[0]}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {member.first_name} {member.last_name}
                          </div>
                          <div className="text-sm text-gray-500">{member.employee_number}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{member.job_title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Phone size={14} className="mr-1" />
                        {member.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        member.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium sticky right-0 z-10 bg-white border-l border-gray-200">
                      <button
                        onClick={() => handleSendMessage(member, false)}
                        className="text-primary-600 hover:text-primary-900 flex items-center"
                      >
                        <Mail className="mr-1" size={16} />
                        Message
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HR View - All Departments */}
      {user?.role === 'HR' && teamData?.departments && (
        <div>
          {!selectedDepartment && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {teamData.departments.map((dept) => (
              <div
                key={dept.id}
                className="card cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => fetchDepartmentMembers(dept.id)}
              >
                <div className="flex items-center mb-3">
                  <Building2 className="text-primary-500 mr-3" size={24} />
                  <div>
                    <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                    <p className="text-sm text-gray-600">{dept.member_count} members</p>
                  </div>
                </div>
                {dept.head_first_name && (
                  <p className="text-sm text-gray-600">
                    <strong>HOD:</strong> {dept.head_first_name} {dept.head_last_name}
                  </p>
                )}
              </div>
            ))}
            </div>
          )}

          {selectedDepartment && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Department Members</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedDepartment(null); setDepartmentMembers([]); }}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => handleSendMessage(null, true)}
                    className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 flex items-center"
                  >
                    <Mail className="mr-1" size={14} />
                    Broadcast
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supervisor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 z-10 bg-gray-50 border-l border-gray-200">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {departmentMembers.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold mr-3">
                              {member.first_name?.[0]}{member.last_name?.[0]}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {member.first_name} {member.last_name}
                              </div>
                              <div className="text-sm text-gray-500">{member.employee_number}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            member.role_name === 'HOD' ? 'bg-purple-100 text-purple-800' :
                            member.role_name === 'Supervisor' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {member.role_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{member.job_title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <Phone size={14} className="mr-1" />
                            {member.phone}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {member.supervisor_first_name ? (
                            `${member.supervisor_first_name} ${member.supervisor_last_name}`
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium sticky right-0 z-10 bg-white border-l border-gray-200">
                          <button
                            onClick={() => handleSendMessage(member, false)}
                            className="text-primary-600 hover:text-primary-900 flex items-center"
                          >
                            <Mail className="mr-1" size={16} />
                            Message
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CEO View - Departments and HR Staff */}
      {user?.role === 'CEO' && teamData?.departments && (
        <div>
          {/* HR Staff Section */}
          {teamData.hrStaff && teamData.hrStaff.length > 0 && (
            <div className="card mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">HR Staff</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamData.hrStaff.map((member) => (
                  <div key={member.id} className="card bg-blue-50 border border-blue-200">
                    <div className="flex items-center mb-3">
                      <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold mr-3">
                        {member.first_name?.[0]}{member.last_name?.[0]}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {member.first_name} {member.last_name}
                        </h3>
                        <p className="text-sm text-blue-700">{member.role_name}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600 mb-3">
                      <p><strong>Job:</strong> {member.job_title}</p>
                      <p><strong>Employee #:</strong> {member.employee_number}</p>
                    </div>
                    <button
                      onClick={() => handleSendMessage(member, false)}
                      className="w-full btn-secondary flex items-center justify-center text-sm"
                    >
                      <Mail className="mr-2" size={16} />
                      Send Message
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Departments Section - Show only when not viewing department */}
          {!selectedDepartment && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {teamData.departments.map((dept) => (
                <div
                  key={dept.id}
                  className="card cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => fetchDepartmentMembers(dept.id)}
                >
                  <div className="flex items-center mb-3">
                    <Building2 className="text-primary-500 mr-3" size={24} />
                    <div>
                      <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                      <p className="text-sm text-gray-600">{dept.member_count} members</p>
                    </div>
                  </div>
                  {dept.head_first_name && (
                    <p className="text-sm text-gray-600">
                      <strong>HOD:</strong> {dept.head_first_name} {dept.head_last_name}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {selectedDepartment && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Department Members</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedDepartment(null); setDepartmentMembers([]); }}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => handleSendMessage(null, true)}
                    className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 flex items-center"
                  >
                    <Mail className="mr-1" size={14} />
                    Broadcast
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supervisor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 z-10 bg-gray-50 border-l border-gray-200">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {departmentMembers.length > 0 ? departmentMembers.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold mr-3">
                              {member.first_name?.[0]}{member.last_name?.[0]}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {member.first_name} {member.last_name}
                              </div>
                              <div className="text-sm text-gray-500">{member.employee_number}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            member.role_name === 'HOD' ? 'bg-purple-100 text-purple-800' :
                            member.role_name === 'Supervisor' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {member.role_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{member.job_title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <Phone size={14} className="mr-1" />
                            {member.phone}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {member.supervisor_first_name ? (
                            `${member.supervisor_first_name} ${member.supervisor_last_name}`
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium sticky right-0 z-10 bg-white border-l border-gray-200">
                          <button
                            onClick={() => handleSendMessage(member, false)}
                            className="text-primary-600 hover:text-primary-900 flex items-center"
                          >
                            <Mail className="mr-1" size={16} />
                            Message
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                          No members found in this department
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {messageData.isBroadcast ? 'Send Broadcast Message' : 'Send Message'}
            </h2>
            
            {selectedRecipient && !messageData.isBroadcast && (
              <p className="text-sm text-gray-600 mb-4">
                To: {selectedRecipient.first_name} {selectedRecipient.last_name}
              </p>
            )}

            <form onSubmit={submitMessage}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={messageData.subject}
                  onChange={(e) => setMessageData({ ...messageData, subject: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={messageData.content}
                  onChange={(e) => setMessageData({ ...messageData, content: e.target.value })}
                  rows={6}
                  className="input-field"
                  required
                />
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowMessageModal(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default MyTeam;
