const db = require('../database/db');
const { logAudit } = require('../middleware/audit');
const path = require('path');
const fs = require('fs');
const { cloudinary, isCloudinaryConfigured, uploadBuffer } = require('../utils/cloudinary');

const getAllSettings = async (req, res) => {
    try {
        const { isPublic } = req.query;

        let query = 'SELECT * FROM system_settings';
        const params = [];

        if (isPublic === 'true') {
            query += ' WHERE is_public = true';
        }

        query += ' ORDER BY setting_key';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};

const getPublicSettings = async (req, res) => {
    req.query.isPublic = 'true';
    return getAllSettings(req, res);
};

const uploadCompanyLogo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No logo uploaded' });
        }

        let logoUrl;
        if (isCloudinaryConfigured()) {
            const folder = process.env.CLOUDINARY_LOGO_FOLDER || process.env.CLOUDINARY_FOLDER || 'winas-hrms/company-logo';
            const uploadRes = await uploadBuffer(req.file.buffer, {
                folder,
                public_id: 'company-logo',
                overwrite: true,
                original_filename: req.file.originalname
            });
            logoUrl = uploadRes.secure_url;
        } else {
            logoUrl = `/uploads/logos/${req.file.filename}`;
        }

        const upsert = await db.query(
            `INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public, updated_by)
             VALUES ($1, $2, 'string', $3, true, $4)
             ON CONFLICT (setting_key)
             DO UPDATE SET setting_value = EXCLUDED.setting_value,
                           setting_type = EXCLUDED.setting_type,
                           description = EXCLUDED.description,
                           is_public = EXCLUDED.is_public,
                           updated_by = EXCLUDED.updated_by,
                           updated_at = CURRENT_TIMESTAMP
             RETURNING id`,
            ['company_logo_url', logoUrl, 'Company logo URL', req.user.id]
        );

        await logAudit(req.user.id, 'UPDATE_SETTING', 'SystemSettings', upsert.rows[0]?.id || null,
            { key: 'company_logo_url', value: logoUrl }, req);

        res.json({ message: 'Company logo updated successfully', logoUrl });
    } catch (error) {
        console.error('Upload company logo error:', error);
        res.status(500).json({ error: 'Failed to upload company logo' });
    }
};

const deleteCompanyLogo = async (req, res) => {
    try {
        const existing = await db.query(
            'SELECT id, setting_value FROM system_settings WHERE setting_key = $1',
            ['company_logo_url']
        );

        const settingId = existing.rows[0]?.id;
        const logoUrl = existing.rows[0]?.setting_value;

        if (logoUrl) {
            if (isCloudinaryConfigured()) {
                try {
                    const folder = process.env.CLOUDINARY_LOGO_FOLDER || process.env.CLOUDINARY_FOLDER || 'winas-hrms/company-logo';
                    await cloudinary.uploader.destroy(`${folder}/company-logo`, { invalidate: true, resource_type: 'image' });
                } catch (e) {
                    console.error('Cloudinary logo delete error:', e);
                }
            } else if (String(logoUrl).startsWith('/uploads/logos/')) {
                const fileName = path.basename(String(logoUrl));
                const filePath = path.join(__dirname, '../../uploads/logos', fileName);
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (e) {
                    console.error('Local logo delete error:', e);
                }
            }
        }

        if (settingId) {
            await db.query('DELETE FROM system_settings WHERE id = $1', [settingId]);
            await logAudit(req.user.id, 'DELETE_SETTING', 'SystemSettings', settingId,
                { key: 'company_logo_url' }, req);
        }

        res.json({ message: 'Company logo reset successfully' });
    } catch (error) {
        console.error('Delete company logo error:', error);
        res.status(500).json({ error: 'Failed to reset company logo' });
    }
};

const getSettingByKey = async (req, res) => {
    try {
        const { key } = req.params;

        const result = await db.query(
            'SELECT * FROM system_settings WHERE setting_key = $1',
            [key]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get setting error:', error);
        res.status(500).json({ error: 'Failed to fetch setting' });
    }
};

const updateSetting = async (req, res) => {
    try {
        const { key } = req.params;
        const { value, description, isPublic } = req.body;

        const existing = await db.query(
            'SELECT id FROM system_settings WHERE setting_key = $1',
            [key]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        if (value !== undefined) {
            updateFields.push(`setting_value = $${paramCount++}`);
            updateValues.push(value);
        }

        if (description !== undefined) {
            updateFields.push(`description = $${paramCount++}`);
            updateValues.push(description);
        }

        if (isPublic !== undefined) {
            updateFields.push(`is_public = $${paramCount++}`);
            updateValues.push(isPublic);
        }

        updateFields.push(`updated_by = $${paramCount++}`);
        updateValues.push(req.user.id);

        updateValues.push(key);

        await db.query(
            `UPDATE system_settings 
             SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
             WHERE setting_key = $${paramCount}`,
            updateValues
        );

        await logAudit(req.user.id, 'UPDATE_SETTING', 'SystemSettings', existing.rows[0].id, 
            { key, value }, req);

        res.json({ message: 'Setting updated successfully' });
    } catch (error) {
        console.error('Update setting error:', error);
        res.status(500).json({ error: 'Failed to update setting' });
    }
};

const createSetting = async (req, res) => {
    try {
        const { key, value, type = 'string', description, isPublic = false } = req.body;

        if (!key) {
            return res.status(400).json({ error: 'Setting key is required' });
        }

        const existing = await db.query(
            'SELECT id FROM system_settings WHERE setting_key = $1',
            [key]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Setting already exists' });
        }

        const result = await db.query(
            `INSERT INTO system_settings 
             (setting_key, setting_value, setting_type, description, is_public, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [key, value, type, description, isPublic, req.user.id]
        );

        await logAudit(req.user.id, 'CREATE_SETTING', 'SystemSettings', result.rows[0].id, 
            { key, value }, req);

        res.status(201).json({ 
            message: 'Setting created successfully',
            id: result.rows[0].id 
        });
    } catch (error) {
        console.error('Create setting error:', error);
        res.status(500).json({ error: 'Failed to create setting' });
    }
};

const deleteSetting = async (req, res) => {
    try {
        const { key } = req.params;

        const result = await db.query(
            'DELETE FROM system_settings WHERE setting_key = $1 RETURNING id',
            [key]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        await logAudit(req.user.id, 'DELETE_SETTING', 'SystemSettings', result.rows[0].id, 
            { key }, req);

        res.json({ message: 'Setting deleted successfully' });
    } catch (error) {
        console.error('Delete setting error:', error);
        res.status(500).json({ error: 'Failed to delete setting' });
    }
};

const bulkUpdateSettings = async (req, res) => {
    const client = await db.pool.connect();
    
    try {
        const { settings } = req.body;

        if (!Array.isArray(settings)) {
            return res.status(400).json({ error: 'Settings must be an array' });
        }

        await client.query('BEGIN');

        for (const setting of settings) {
            const { key, value } = setting;
            
            const existing = await client.query(
                'SELECT id FROM system_settings WHERE setting_key = $1',
                [key]
            );

            if (existing.rows.length > 0) {
                await client.query(
                    `UPDATE system_settings 
                     SET setting_value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP 
                     WHERE setting_key = $3`,
                    [value, req.user.id, key]
                );
            } else {
                await client.query(
                    `INSERT INTO system_settings 
                     (setting_key, setting_value, setting_type, updated_by)
                     VALUES ($1, $2, 'string', $3)`,
                    [key, value, req.user.id]
                );
            }
        }

        await client.query('COMMIT');

        await logAudit(req.user.id, 'BULK_UPDATE_SETTINGS', 'SystemSettings', null, 
            { count: settings.length }, req);

        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Bulk update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    } finally {
        client.release();
    }
};

module.exports = {
    getPublicSettings,
    getAllSettings,
    getSettingByKey,
    updateSetting,
    createSetting,
    uploadCompanyLogo,
    deleteCompanyLogo,
    deleteSetting,
    bulkUpdateSettings
};
