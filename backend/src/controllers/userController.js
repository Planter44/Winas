const bcrypt = require('bcrypt');
const db = require('../database/db');
const { logAudit } = require('../middleware/audit');

const getAllUsers = async (req, res) => {
    try {
        const { role, department, status, search } = req.query;
        const requestingUserRole = req.user.role;
        
        let query = `
            SELECT u.id, u.email, u.role_id, u.department_id, u.is_active, u.last_login,
                   r.name as role_name, r.level as role_level,
                   d.name as department_name,
                   sp.first_name, sp.last_name, sp.employee_number, sp.job_title, sp.phone
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN staff_profiles sp ON u.id = sp.user_id
            WHERE u.deleted_at IS NULL
        `;
        
        if (requestingUserRole !== 'Super Admin') {
            query += ` AND r.name != 'Super Admin'`;
        }
        
        const params = [];
        let paramCount = 1;

        if (role) {
            query += ` AND r.name = $${paramCount}`;
            params.push(role);
            paramCount++;
        }

        if (department) {
            query += ` AND u.department_id = $${paramCount}`;
            params.push(department);
            paramCount++;
        }

        if (status) {
            query += ` AND u.is_active = $${paramCount}`;
            params.push(status === 'active');
            paramCount++;
        }

        query += ' ORDER BY r.level, sp.first_name';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `SELECT u.*, r.name as role_name, r.level as role_level,
                    d.name as department_name, sp.*,
                    s.first_name as supervisor_first_name,
                    s.last_name as supervisor_last_name
             FROM users u
             JOIN roles r ON u.role_id = r.id
             LEFT JOIN departments d ON u.department_id = d.id
             LEFT JOIN staff_profiles sp ON u.id = sp.user_id
             LEFT JOIN staff_profiles s ON u.supervisor_id = s.user_id
             WHERE u.id = $1 AND u.deleted_at IS NULL`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        delete user.password_hash;

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
};

const createUser = async (req, res) => {
    const client = await db.pool.connect();
    
    try {
        const {
            email, password, roleId, departmentId, supervisorId,
            firstName, lastName, middleName, employeeNumber, nationalId,
            phone, secondaryPhone, kraPin, educationLevel,
            dateOfBirth, gender, maritalStatus, address, city,
            emergencyContactName, emergencyContactPhone,
            nextOfKinName, nextOfKinPhone, nextOfKinIdNumber, nextOfKinRelationship,
            dateJoined, jobTitle
        } = req.body;

        if (!email || !password || !roleId || !firstName || !lastName) {
            return res.status(400).json({ 
                error: 'Email, password, role, first name, and last name are required' 
            });
        }

        await client.query('BEGIN');

        const existingUser = await client.query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userResult = await client.query(
            `INSERT INTO users (email, password_hash, role_id, department_id, supervisor_id)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [email.toLowerCase(), hashedPassword, roleId, departmentId || null, supervisorId || null]
        );

        const userId = userResult.rows[0].id;

        const profileResult = await client.query(
            `INSERT INTO staff_profiles 
             (user_id, first_name, last_name, middle_name, employee_number, national_id, 
              phone, secondary_phone, kra_pin, education_level, date_of_birth, gender, marital_status, 
              address, city, emergency_contact_name, emergency_contact_phone, 
              next_of_kin_name, next_of_kin_phone, next_of_kin_id_number, next_of_kin_relationship,
              date_joined, job_title)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
             RETURNING id`,
            [
                userId, firstName, lastName, middleName, employeeNumber, nationalId,
                phone, secondaryPhone, kraPin, educationLevel,
                dateOfBirth, gender, maritalStatus, address, city,
                emergencyContactName, emergencyContactPhone,
                nextOfKinName, nextOfKinPhone, nextOfKinIdNumber, nextOfKinRelationship,
                dateJoined, jobTitle
            ]
        );

        await client.query('COMMIT');

        await logAudit(req.user.id, 'CREATE_USER', 'User', userId, { email, roleId }, req);

        res.status(201).json({ 
            message: 'User created successfully', 
            id: userId 
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create user error:', error);
        
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Duplicate entry detected' });
        }
        
        res.status(500).json({ error: 'Failed to create user' });
    } finally {
        client.release();
    }
};

const updateUser = async (req, res) => {
    const client = await db.pool.connect();
    
    try {
        const { id } = req.params;
        const {
            email, roleId, departmentId, supervisorId, isActive,
            firstName, lastName, middleName, employeeNumber, nationalId,
            phone, secondaryPhone, kraPin, educationLevel,
            dateOfBirth, gender, maritalStatus, address, city,
            emergencyContactName, emergencyContactPhone,
            nextOfKinName, nextOfKinPhone, nextOfKinIdNumber, nextOfKinRelationship,
            dateJoined, jobTitle
        } = req.body;

        await client.query('BEGIN');

        const normalizedEmail = email !== undefined && email !== null
            ? String(email).trim().toLowerCase()
            : undefined;

        if (normalizedEmail !== undefined) {
            if (!normalizedEmail) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Email is required' });
            }

            const existingEmail = await client.query(
                'SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 AND id <> $2 AND deleted_at IS NULL',
                [normalizedEmail, id]
            );

            if (existingEmail.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Email is already in use' });
            }
        }

        if (normalizedEmail !== undefined || roleId !== undefined || departmentId !== undefined || 
            supervisorId !== undefined || isActive !== undefined) {
            
            const updateFields = [];
            const updateValues = [];
            let paramCount = 1;

            if (normalizedEmail !== undefined) {
                updateFields.push(`email = $${paramCount++}`);
                updateValues.push(normalizedEmail);
            }
            if (roleId !== undefined) {
                updateFields.push(`role_id = $${paramCount++}`);
                updateValues.push(roleId);
            }
            if (departmentId !== undefined) {
                updateFields.push(`department_id = $${paramCount++}`);
                updateValues.push(departmentId);
            }
            if (supervisorId !== undefined) {
                updateFields.push(`supervisor_id = $${paramCount++}`);
                updateValues.push(supervisorId);
            }
            if (isActive !== undefined) {
                updateFields.push(`is_active = $${paramCount++}`);
                updateValues.push(isActive);
            }

            updateValues.push(id);

            if (updateFields.length > 0) {
                await client.query(
                    `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
                     WHERE id = $${paramCount}`,
                    updateValues
                );
            }
        }

        const profileFields = [];
        const profileValues = [];
        let profileParamCount = 1;

        if (firstName !== undefined) {
            profileFields.push(`first_name = $${profileParamCount++}`);
            profileValues.push(firstName);
        }
        if (lastName !== undefined) {
            profileFields.push(`last_name = $${profileParamCount++}`);
            profileValues.push(lastName);
        }
        if (middleName !== undefined) {
            profileFields.push(`middle_name = $${profileParamCount++}`);
            profileValues.push(middleName);
        }
        if (employeeNumber !== undefined) {
            profileFields.push(`employee_number = $${profileParamCount++}`);
            profileValues.push(employeeNumber);
        }
        if (nationalId !== undefined) {
            profileFields.push(`national_id = $${profileParamCount++}`);
            profileValues.push(nationalId);
        }
        if (phone !== undefined) {
            profileFields.push(`phone = $${profileParamCount++}`);
            profileValues.push(phone);
        }
        if (dateOfBirth !== undefined) {
            profileFields.push(`date_of_birth = $${profileParamCount++}`);
            profileValues.push(dateOfBirth);
        }
        if (gender !== undefined) {
            profileFields.push(`gender = $${profileParamCount++}`);
            profileValues.push(gender);
        }
        if (maritalStatus !== undefined) {
            profileFields.push(`marital_status = $${profileParamCount++}`);
            profileValues.push(maritalStatus);
        }
        if (address !== undefined) {
            profileFields.push(`address = $${profileParamCount++}`);
            profileValues.push(address);
        }
        if (city !== undefined) {
            profileFields.push(`city = $${profileParamCount++}`);
            profileValues.push(city);
        }
        if (emergencyContactName !== undefined) {
            profileFields.push(`emergency_contact_name = $${profileParamCount++}`);
            profileValues.push(emergencyContactName);
        }
        if (emergencyContactPhone !== undefined) {
            profileFields.push(`emergency_contact_phone = $${profileParamCount++}`);
            profileValues.push(emergencyContactPhone);
        }
        if (secondaryPhone !== undefined) {
            profileFields.push(`secondary_phone = $${profileParamCount++}`);
            profileValues.push(secondaryPhone);
        }
        if (kraPin !== undefined) {
            profileFields.push(`kra_pin = $${profileParamCount++}`);
            profileValues.push(kraPin);
        }
        if (educationLevel !== undefined) {
            profileFields.push(`education_level = $${profileParamCount++}`);
            profileValues.push(educationLevel);
        }
        if (nextOfKinName !== undefined) {
            profileFields.push(`next_of_kin_name = $${profileParamCount++}`);
            profileValues.push(nextOfKinName);
        }
        if (nextOfKinPhone !== undefined) {
            profileFields.push(`next_of_kin_phone = $${profileParamCount++}`);
            profileValues.push(nextOfKinPhone);
        }
        if (nextOfKinIdNumber !== undefined) {
            profileFields.push(`next_of_kin_id_number = $${profileParamCount++}`);
            profileValues.push(nextOfKinIdNumber);
        }
        if (nextOfKinRelationship !== undefined) {
            profileFields.push(`next_of_kin_relationship = $${profileParamCount++}`);
            profileValues.push(nextOfKinRelationship);
        }
        if (dateJoined !== undefined) {
            profileFields.push(`date_joined = $${profileParamCount++}`);
            profileValues.push(dateJoined);
        }
        if (jobTitle !== undefined) {
            profileFields.push(`job_title = $${profileParamCount++}`);
            profileValues.push(jobTitle);
        }

        profileValues.push(id);

        if (profileFields.length > 0) {
            await client.query(
                `UPDATE staff_profiles SET ${profileFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
                 WHERE user_id = $${profileParamCount}`,
                profileValues
            );
        }

        await client.query('COMMIT');

        await logAudit(req.user.id, 'UPDATE_USER', 'User', id, req.body, req);

        res.json({ message: 'User updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    } finally {
        client.release();
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const requestingRole = req.user?.role_name;
        const isSuperAdmin = requestingRole === 'Super Admin';
        const isCeo = requestingRole === 'CEO';
        const isHr = requestingRole === 'HR';

        if (!isSuperAdmin && !isCeo && !isHr) {
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }

        const targetUserRes = await db.query(
            `SELECT u.id, r.name as role_name
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.id = $1 AND u.deleted_at IS NULL`,
            [id]
        );

        if (targetUserRes.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const targetUser = targetUserRes.rows[0];

        if (targetUser.role_name === 'Super Admin') {
            return res.status(403).json({ error: 'Cannot delete Super Admin account' });
        }

        if (targetUser.role_name === 'CEO' && !isSuperAdmin) {
            return res.status(403).json({ error: 'Only Super Admin can delete CEO accounts' });
        }

        await db.query(
            'UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
            [id]
        );

        await logAudit(req.user.id, 'DELETE_USER', 'User', id, {}, req);

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ 
                error: 'New password is required and must be at least 8 characters' 
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [hashedPassword, id]
        );

        await logAudit(req.user.id, 'RESET_PASSWORD', 'User', id, {}, req);

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    resetPassword
};
