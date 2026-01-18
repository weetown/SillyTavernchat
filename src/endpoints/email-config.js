import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import express from 'express';
import { getEmailConfig, testEmailConfig, reloadEmailConfig } from '../email-service.js';
import { requireAdminMiddleware } from '../users.js';

export const router = express.Router();


router.get('/get', requireAdminMiddleware, async (request, response) => {
    try {
        const config = getEmailConfig();
        return response.json(config);
    } catch (error) {
        console.error('Get email config failed:', error);
        return response.status(500).json({ error: 'Failed to fetch email configuration' });
    }
});


router.post('/save', requireAdminMiddleware, async (request, response) => {
    try {
        const { enabled, host, port, secure, user, password, from, fromName } = request.body;

        const configPath = path.join(process.cwd(), 'config.yaml');
        let config = {};

        if (fs.existsSync(configPath)) {
            const configContent = fs.readFileSync(configPath, 'utf8');
            config = yaml.parse(configContent);
        }

        config.email = {
            enabled: enabled || false,
            smtp: {
                host: host || '',
                port: parseInt(port) || 587,
                secure: secure || false,
                user: user || '',
                password: password || '',
            },
            from: from || '',
            fromName: fromName || 'SillyTavern',
        };

        const newConfigContent = yaml.stringify(config);
        fs.writeFileSync(configPath, newConfigContent, 'utf8');

        reloadEmailConfig();

        console.info('Email config saved successfully');
        return response.json({ success: true, message: 'Email configuration saved. Some changes may require a server restart to take effect.' });
    } catch (error) {
        console.error('Save email config failed:', error);
        return response.status(500).json({ error: 'Failed to save email configuration: ' + error.message });
    }
});


router.post('/test', requireAdminMiddleware, async (request, response) => {
    try {
        const { testEmail } = request.body;

        if (!testEmail) {
            return response.status(400).json({ error: 'Please provide a test email address' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(testEmail)) {
            return response.status(400).json({ error: 'Email format is invalid' });
        }

        const result = await testEmailConfig(testEmail);

        if (result.success) {
            console.info('Email test successful for', testEmail);
            return response.json({ success: true, message: 'Test email sent. Please check your inbox.' });
        } else {
            console.error('Email test failed:', result.error);
            return response.status(500).json({ error: 'Test failed: ' + result.error });
        }
    } catch (error) {
        console.error('Test email config failed:', error);
        return response.status(500).json({ error: 'Failed to test email configuration: ' + error.message });
    }
});
