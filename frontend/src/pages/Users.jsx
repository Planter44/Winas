import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { userAPI, departmentAPI } from '../services/api';
import { Plus, Search, Edit, Trash2, Filter } from 'lucide-react';

const Users = () => {
  const { user, hasMinLevel } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  useEffect(() => {
    fetchData();
  }, [roleFilter, departmentFilter]);

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes, deptsRes] = await Promise.all([
        userAPI.getAll({ role: roleFilter, department: departmentFilter }),
        departmentAPI.getRoles(),
        departmentAPI.getAll()
      ]);

      setUsers(usersRes.data);
      setRoles(rolesRes.data);
      setDepartments(deptsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const canDeleteUser = (targetUser) => {
    if (!user) return false;
    const isSuperAdmin = user.role === 'Super Admin';
    const isCeo = user.role === 'CEO';
    const isHr = user.role === 'HR';

    if (!isSuperAdmin && !isCeo && !isHr) return false;
    if (targetUser.role_name === 'Super Admin') return false;
    if (targetUser.role_name === 'CEO' && !isSuperAdmin) return false;
    return true;
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await userAPI.delete(id);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const filteredUsers = users.filter((user) =>
    `${user.first_name} ${user.last_name} ${user.email} ${user.employee_number}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

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
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Users</h1>
          <p className="text-gray-600">Manage system users and staff</p>
        </div>
        {(hasMinLevel(2) || user?.role === 'HR') && (
          <Link
            to="/users/new"
            className="btn-primary inline-flex items-center justify-center gap-2 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            Add User
          </Link>
        )}
      </div>

      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input-field"
          >
            <option value="">All Roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="input-field"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setSearchTerm('');
              setRoleFilter('');
              setDepartmentFilter('');
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
                <th className="px-4 sm:px-5 lg:px-6 xl:px-7 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-4 sm:px-5 lg:px-6 xl:px-7 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 sm:px-5 lg:px-6 xl:px-7 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-4 sm:px-5 lg:px-6 xl:px-7 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 sm:px-5 lg:px-6 xl:px-7 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 sm:px-5 lg:px-6 xl:px-7 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
                        {u.first_name?.[0]}{u.last_name?.[0]}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {u.first_name} {u.last_name}
                        </div>
                        <div className="text-sm text-gray-500">{u.email}</div>
                        <div className="text-xs text-gray-400">{u.employee_number}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 sm:px-5 lg:px-6 xl:px-7 py-4 whitespace-nowrap">
                    <span className="badge badge-info">{u.role_name}</span>
                  </td>
                  <td className="px-4 sm:px-5 lg:px-6 xl:px-7 py-4 whitespace-nowrap text-sm text-gray-500">
                    {u.department_name || 'N/A'}
                  </td>
                  <td className="px-4 sm:px-5 lg:px-6 xl:px-7 py-4 whitespace-nowrap">
                    <span
                      className={`badge ${
                        u.is_active ? 'badge-success' : 'badge-danger'
                      }`}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 sm:px-5 lg:px-6 xl:px-7 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {(hasMinLevel(2) || user?.role === 'HR') && (
                      <div className="flex items-center justify-end space-x-2">
                        {/* HR cannot edit CEO - only CEO and SuperAdmin can edit CEO */}
                        {!(user?.role === 'HR' && u.role_name === 'CEO') && (
                          <Link
                            to={`/users/${u.id}/edit`}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            <Edit size={18} />
                          </Link>
                        )}
                        {canDeleteUser(u) && (
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No users found
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Users;
