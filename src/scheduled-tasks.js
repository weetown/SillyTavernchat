import cron from 'node-cron';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { getAllUserHandles, getUserDirectories } from './users.js';


class ScheduledTasksManager {
    constructor() {
        this.tasks = new Map();
        this.configPath = path.join(process.cwd(), 'config.yaml');
        this.loadTasks();
    }

    
    loadTasks() {
        try {
            if (!fs.existsSync(this.configPath)) {
                console.warn('Config file not found, skipping scheduled tasks load');
                return;
            }

            const configContent = fs.readFileSync(this.configPath, 'utf8');
            const config = yaml.parse(configContent);

            if (config.scheduledTasks && config.scheduledTasks.clearAllBackups) {
                const taskConfig = config.scheduledTasks.clearAllBackups;
                if (taskConfig.enabled && taskConfig.cronExpression) {
                    this.startClearAllBackupsTask(taskConfig.cronExpression);
                    console.log(`Loaded scheduled backup cleanup task: ${taskConfig.cronExpression}`);
                }
            }
        } catch (error) {
            console.error('Failed to load scheduled task configuration:', error);
        }
    }

    
    startClearAllBackupsTask(cronExpression) {
        try {
            if (!cron.validate(cronExpression)) {
                console.error('Invalid cron expression:', cronExpression);
                return false;
            }

            if (this.tasks.has('clearAllBackups')) {
                this.stopTask('clearAllBackups');
            }

            const task = cron.schedule(cronExpression, async () => {
                console.log(`[Scheduled task] Starting cleanup of all user backups - ${new Date().toLocaleString()}`);
                await this.executeClearAllBackups();
            }, {
                timezone: 'Asia/Shanghai',
            });

            this.tasks.set('clearAllBackups', {
                task: task,
                cronExpression: cronExpression,
                type: 'clearAllBackups',
                enabled: true,
            });

            console.log(`Scheduled backup cleanup task started: ${cronExpression}`);
            return true;
        } catch (error) {
            console.error('Failed to start scheduled backup cleanup task:', error);
            return false;
        }
    }

    
    async executeClearAllBackups() {
        try {
            const userHandles = await getAllUserHandles();
            let totalDeletedSize = 0;
            let totalDeletedFiles = 0;

            for (const handle of userHandles) {
                try {
                    const directories = getUserDirectories(handle);
                    let userDeletedSize = 0;
                    let userDeletedFiles = 0;

                    if (fs.existsSync(directories.backups)) {
                        const backupsSize = await this.calculateDirectorySize(directories.backups);
                        userDeletedSize += backupsSize;
                        const files = await fs.promises.readdir(directories.backups);
                        userDeletedFiles += files.length;
                        await fs.promises.rm(directories.backups, { recursive: true, force: true });
                        await fs.promises.mkdir(directories.backups, { recursive: true });
                    }

                    totalDeletedSize += userDeletedSize;
                    totalDeletedFiles += userDeletedFiles;

                    console.info(`[Scheduled task] Cleared backups for user ${handle}: ${userDeletedFiles} files, ${(userDeletedSize / 1024 / 1024).toFixed(2)} MB`);
                } catch (error) {
                    console.error(`[Scheduled task] Failed to clear backups for user ${handle}:`, error);
                }
            }

            console.log(`[Scheduled task] Cleanup complete: cleared backups for ${userHandles.length} users, ${totalDeletedFiles} files, freed ${(totalDeletedSize / 1024 / 1024).toFixed(2)} MB`);
        } catch (error) {
            console.error('[Scheduled task] Failed to clean all backup files:', error);
        }
    }

    
    async calculateDirectorySize(dirPath) {
        let totalSize = 0;

        try {
            if (!fs.existsSync(dirPath)) {
                return 0;
            }

            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    totalSize += await this.calculateDirectorySize(fullPath);
                } else {
                    const stats = await fs.promises.stat(fullPath);
                    totalSize += stats.size;
                }
            }
        } catch (error) {
            console.error(`Failed to calculate directory size ${dirPath}:`, error);
        }

        return totalSize;
    }

    
    stopTask(taskName) {
        const taskInfo = this.tasks.get(taskName);
        if (taskInfo && taskInfo.task) {
            taskInfo.task.stop();
            this.tasks.delete(taskName);
            console.log(`Scheduled task stopped: ${taskName}`);
        }
    }

    
    stopAllTasks() {
        for (const [taskName] of this.tasks) {
            this.stopTask(taskName);
        }
    }

    
    getTaskStatus(taskName) {
        const taskInfo = this.tasks.get(taskName);
        if (!taskInfo) {
            return null;
        }

        return {
            enabled: taskInfo.enabled,
            cronExpression: taskInfo.cronExpression,
            type: taskInfo.type,
            running: taskInfo.task && taskInfo.task.running !== undefined ? taskInfo.task.running : true,
        };
    }

    
    getAllTasksStatus() {
        const status = {};
        for (const [taskName] of this.tasks) {
            status[taskName] = this.getTaskStatus(taskName);
        }
        return status;
    }

    
    saveTaskConfig(taskConfig) {
        try {
            let config = {};

            if (fs.existsSync(this.configPath)) {
                const configContent = fs.readFileSync(this.configPath, 'utf8');
                config = yaml.parse(configContent);
            }

            if (!config.scheduledTasks) {
                config.scheduledTasks = {};
            }

            config.scheduledTasks.clearAllBackups = {
                enabled: taskConfig.enabled || false,
                cronExpression: taskConfig.cronExpression || '',
            };

            const newConfigContent = yaml.stringify(config);
            fs.writeFileSync(this.configPath, newConfigContent, 'utf8');

            console.log('Scheduled task configuration saved to config.yaml');
            return true;
        } catch (error) {
            console.error('Failed to save scheduled task configuration:', error);
            return false;
        }
    }

    
    getTaskConfig() {
        try {
            if (!fs.existsSync(this.configPath)) {
                return null;
            }

            const configContent = fs.readFileSync(this.configPath, 'utf8');
            const config = yaml.parse(configContent);

            if (config.scheduledTasks && config.scheduledTasks.clearAllBackups) {
                return config.scheduledTasks.clearAllBackups;
            }

            return null;
        } catch (error) {
            console.error('Failed to read scheduled task configuration:', error);
            return null;
        }
    }
}

const scheduledTasksManager = new ScheduledTasksManager();

process.on('SIGINT', () => {
    console.log('\nStopping all scheduled tasks...');
    scheduledTasksManager.stopAllTasks();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nStopping all scheduled tasks...');
    scheduledTasksManager.stopAllTasks();
    process.exit(0);
});

export default scheduledTasksManager;
export { ScheduledTasksManager };
