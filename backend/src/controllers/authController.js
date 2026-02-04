const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { logAudit } = require('../middleware/audit');

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await db.query(
            `SELECT u.id, u.email, u.password_hash, u.role_id, u.department_id, u.is_active,
                    r.name as role_name, r.level as role_level,
                    d.name as department_name,
                    sp.first_name, sp.last_name, sp.employee_number, sp.job_title
             FROM users u
             JOIN roles r ON u.role_id = r.id
             LEFT JOIN departments d ON u.department_id = d.id
             LEFT JOIN staff_profiles sp ON u.id = sp.user_id
             WHERE u.email = $1 AND u.deleted_at IS NULL`,
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is inactive. Please contact administrator.' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        await db.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email, 
                role: user.role_name,
                roleLevel: user.role_level
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        await logAudit(user.id, 'LOGIN', 'User', user.id, { email }, req);

        delete user.password_hash;

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role_name,
                roleLevel: user.role_level,
                department: user.department_name,
                firstName: user.first_name,
                lastName: user.last_name,
                employeeNumber: user.employee_number,
                jobTitle: user.job_title
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new passwords are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        const result = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );

        const isValidPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [hashedPassword, userId]
        );

        await logAudit(userId, 'CHANGE_PASSWORD', 'User', userId, {}, req);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};

const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await db.query(
            `SELECT u.id, u.email, u.role_id, u.department_id, u.supervisor_id, u.last_login,
                    r.name as role_name, r.level as role_level,
                    d.name as department_name,
                    sp.*, 
                    s.first_name as supervisor_first_name, 
                    s.last_name as supervisor_last_name
             FROM users u
             JOIN roles r ON u.role_id = r.id
             LEFT JOIN departments d ON u.department_id = d.id
             LEFT JOIN staff_profiles sp ON u.id = sp.user_id
             LEFT JOIN staff_profiles s ON u.supervisor_id = s.user_id
             WHERE u.id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};

const updateProfile = async (req, res) => {
    const client = await db.pool.connect();

    try {
        const userId = req.user.id;
        const {
            email,
            firstName,
            lastName,
            middleName,
            employeeNumber,
            jobTitle,
            dateJoined,
            phone,
            secondaryPhone,
            nationalId,
            kraPin,
            educationLevel,
            dateOfBirth,
            gender,
            maritalStatus,
            address,
            city,
            emergencyContactName,
            emergencyContactPhone,
            nextOfKinName,
            nextOfKinPhone,
            nextOfKinIdNumber,
            nextOfKinRelationship
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
                'SELECT id FROM users WHERE email = $1 AND id <> $2',
                [normalizedEmail, userId]
            );
            if (existingEmail.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Email is already in use' });
            }

            await client.query(
                'UPDATE users SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [normalizedEmail, userId]
            );
        }

        await client.query(
            `INSERT INTO staff_profiles (user_id, first_name, last_name, employee_number, job_title)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id) DO NOTHING`,
            [
                userId,
                firstName ?? req.user.first_name ?? '',
                lastName ?? req.user.last_name ?? '',
                req.user.employee_number ?? null,
                req.user.job_title ?? null
            ]
        );

        const fields = [];
        const values = [];
        let paramCount = 1;

        if (firstName !== undefined) {
            fields.push(`first_name = $${paramCount++}`);
            values.push(firstName);
        }
        if (lastName !== undefined) {
            fields.push(`last_name = $${paramCount++}`);
            values.push(lastName);
        }
        if (middleName !== undefined) {
            fields.push(`middle_name = $${paramCount++}`);
            values.push(middleName);
        }
        if (phone !== undefined) {
            fields.push(`phone = $${paramCount++}`);
            values.push(phone);
        }
        if (secondaryPhone !== undefined) {
            fields.push(`secondary_phone = $${paramCount++}`);
            values.push(secondaryPhone);
        }
        if (nationalId !== undefined) {
            fields.push(`national_id = $${paramCount++}`);
            values.push(nationalId);
        }
        if (kraPin !== undefined) {
            fields.push(`kra_pin = $${paramCount++}`);
            values.push(kraPin);
        }
        if (educationLevel !== undefined) {
            fields.push(`education_level = $${paramCount++}`);
            values.push(educationLevel);
        }
        if (dateOfBirth !== undefined) {
            fields.push(`date_of_birth = $${paramCount++}`);
            values.push(dateOfBirth);
        }
        if (gender !== undefined) {
            fields.push(`gender = $${paramCount++}`);
            values.push(gender);
        }
        if (maritalStatus !== undefined) {
            fields.push(`marital_status = $${paramCount++}`);
            values.push(maritalStatus);
        }
        if (address !== undefined) {
            fields.push(`address = $${paramCount++}`);
            values.push(address);
        }
        if (city !== undefined) {
            fields.push(`city = $${paramCount++}`);
            values.push(city);
        }
        if (emergencyContactName !== undefined) {
            fields.push(`emergency_contact_name = $${paramCount++}`);
            values.push(emergencyContactName);
        }
        if (emergencyContactPhone !== undefined) {
            fields.push(`emergency_contact_phone = $${paramCount++}`);
            values.push(emergencyContactPhone);
        }
        if (nextOfKinName !== undefined) {
            fields.push(`next_of_kin_name = $${paramCount++}`);
            values.push(nextOfKinName);
        }
        if (nextOfKinPhone !== undefined) {
            fields.push(`next_of_kin_phone = $${paramCount++}`);
            values.push(nextOfKinPhone);
        }
        if (nextOfKinIdNumber !== undefined) {
            fields.push(`next_of_kin_id_number = $${paramCount++}`);
            values.push(nextOfKinIdNumber);
        }
        if (nextOfKinRelationship !== undefined) {
            fields.push(`next_of_kin_relationship = $${paramCount++}`);
            values.push(nextOfKinRelationship);
        }

        if (fields.length > 0) {
            values.push(userId);
            await client.query(
                `UPDATE staff_profiles
                 SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $${paramCount}`,
                values
            );
        }

        await client.query('COMMIT');

        await logAudit(userId, 'UPDATE_PROFILE', 'User', userId, req.body, req);

        const updated = await db.query(
            `SELECT u.id, u.email, u.role_id, u.department_id, u.supervisor_id, u.last_login,
                    r.name as role_name, r.level as role_level,
                    d.name as department_name,
                    sp.*,
                    s.first_name as supervisor_first_name,
                    s.last_name as supervisor_last_name
             FROM users u
             JOIN roles r ON u.role_id = r.id
             LEFT JOIN departments d ON u.department_id = d.id
             LEFT JOIN staff_profiles sp ON u.id = sp.user_id
             LEFT JOIN staff_profiles s ON u.supervisor_id = s.user_id
             WHERE u.id = $1`,
            [userId]
        );

        res.json({ message: 'Profile updated successfully', profile: updated.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update profile error:', error);

        if (error?.code === '23505') {
            const constraint = String(error?.constraint || '').toLowerCase();

            if (constraint.includes('employee_number')) {
                return res.status(400).json({ error: 'Employee number is already in use' });
            }
            if (constraint.includes('national_id')) {
                return res.status(400).json({ error: 'National ID is already in use' });
            }

            return res.status(400).json({ error: 'One of the provided values is already in use' });
        }

        res.status(500).json({ error: 'Failed to update profile' });
    } finally {
        client.release();
    }
};

module.exports = {
    login,
    changePassword,
    getProfile,
    updateProfile
};
