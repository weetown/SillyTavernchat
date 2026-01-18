import express from 'express';
import { requireAdminMiddleware } from '../users.js';
import scheduledTasksManager from '../scheduled-tasks.js';

export const router = express.Router();


router.get('/config', requireAdminMiddleware, async (request, response) => {
    try {
        const config = scheduledTasksManager.getTaskConfig();
        const status = scheduledTasksManager.getTaskStatus('clearAllBackups');

        return response.json({
            success: true,
            config: config || {
                enabled: false,
                cronExpression: '',
            },
            status: status || {
                enabled: false,
                running: false,
            },
        });
    } catch (error) {
        console.error('Get scheduled task config failed:', error);
        return response.status(500).json({ error: 'Failed to fetch scheduled task configuration: ' + error.message });
    }
});


router.post('/config', requireAdminMiddleware, async (request, response) => {
    try {
        const { enabled, cronExpression } = request.body;

        if (enabled && !cronExpression) {
            return response.status(400).json({ error: 'A cron expression is required when enabling scheduled tasks' });
        }

        if (enabled) {
            const cron = await import('node-cron');
            if (!cron.default.validate(cronExpression)) {
                return response.status(400).json({ error: 'Invalid cron expression' });
            }
        }

        const saved = scheduledTasksManager.saveTaskConfig({
            enabled: enabled || false,
            cronExpression: cronExpression || '',
        });

        if (!saved) {
            return response.status(500).json({ error: 'Failed to save configuration' });
        }

        if (enabled) {
            const started = scheduledTasksManager.startClearAllBackupsTask(cronExpression);
            if (!started) {
                return response.status(500).json({ error: 'Failed to start scheduled task' });
            }
        } else {
            scheduledTasksManager.stopTask('clearAllBackups');
        }

        return response.json({
            success: true,
            message: enabled ? 'Scheduled task enabled' : 'Scheduled task disabled',
        });
    } catch (error) {
        console.error('Save scheduled task config failed:', error);
        return response.status(500).json({ error: 'Failed to save scheduled task configuration: ' + error.message });
    }
});


router.get('/status', requireAdminMiddleware, async (request, response) => {
    try {
        const status = scheduledTasksManager.getAllTasksStatus();
        return response.json({
            success: true,
            tasks: status,
        });
    } catch (error) {
        console.error('Get scheduled tasks status failed:', error);
        return response.status(500).json({ error: 'Failed to fetch scheduled task status: ' + error.message });
    }
});


router.post('/execute/clear-all-backups', requireAdminMiddleware, async (request, response) => {
    try {
        scheduledTasksManager.executeClearAllBackups().catch(error => {
            console.error('Manual backup cleanup task failed:', error);
        });

        return response.json({
            success: true,
            message: 'Cleanup task started. Check server logs for details.',
        });
    } catch (error) {
        console.error('Execute clear all backups task failed:', error);
        return response.status(500).json({ error: 'Failed to execute cleanup task: ' + error.message });
    }
});
