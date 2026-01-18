import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';


class SystemMonitor {
    constructor() {
        this.userLoadStats = new Map();
        this.systemLoadHistory = [];
        this.maxHistoryLength = 100;
        this.startTime = Date.now();
        this.lastCpuUsage = process.cpuUsage();
        this.lastNetworkStats = this.getNetworkStats();
        this.lastDurationUpdate = 0;

        this.lastCpuInfo = this.getCpuInfo();
        this.lastCpuTime = Date.now();
        this.cpuUsageHistory = [];
        this.maxCpuHistoryLength = 6;

        this.dataDir = path.join(process.cwd(), 'data', 'system-monitor');
        this.userStatsFile = path.join(this.dataDir, 'user-stats.json');
        this.loadHistoryFile = path.join(this.dataDir, 'load-history.json');
        this.systemStatsFile = path.join(this.dataDir, 'system-stats.json');

        this.ensureDataDirectory();

        this.loadPersistedData();

        this.updateInterval = setInterval(() => {
            this.updateSystemLoad();
        }, 5000);

        this.saveInterval = setInterval(() => {
            this.saveDataToDisk();
        }, 30000);

        this.userUpdateInterval = setInterval(() => {
            this.updateOnlineUsersDuration();
        }, 60000);
    }

    
    getSystemLoad() {
        const cpuUsage = this.getCpuUsage();
        const memoryUsage = this.getMemoryUsage();
        const diskUsage = this.getDiskUsage();
        const networkUsage = this.getNetworkUsage();
        const uptime = this.getUptime();
        const activeUsers = this.getActiveUserCount();
        const onlineUsers = this.getOnlineUserCount();
        const totalTrackedUsers = this.userLoadStats.size;

        return {
            timestamp: Date.now(),
            cpu: cpuUsage,
            memory: memoryUsage,
            disk: diskUsage,
            network: networkUsage,
            uptime: uptime,
            loadAverage: os.loadavg(),
            activeUsers,
            onlineUsers,
            totalTrackedUsers,
        };
    }

    
    getCpuInfo() {
        const cpus = os.cpus();
        let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;

        for (let cpu of cpus) {
            user += cpu.times.user;
            nice += cpu.times.nice;
            sys += cpu.times.sys;
            idle += cpu.times.idle;
            irq += cpu.times.irq;
        }

        const total = user + nice + sys + idle + irq;

        return {
            user,
            nice,
            sys,
            idle,
            irq,
            total,
        };
    }

    
    getCpuUsage() {
        const currentTime = Date.now();
        const currentCpuInfo = this.getCpuInfo();

        const totalDelta = currentCpuInfo.total - this.lastCpuInfo.total;
        const idleDelta = currentCpuInfo.idle - this.lastCpuInfo.idle;

        let cpuPercent = 0;
        if (totalDelta > 0) {
            cpuPercent = ((totalDelta - idleDelta) / totalDelta) * 100;
        }

        this.cpuUsageHistory.push(cpuPercent);
        if (this.cpuUsageHistory.length > this.maxCpuHistoryLength) {
            this.cpuUsageHistory.shift();
        }

        const smoothedCpuPercent = this.cpuUsageHistory.reduce((sum, val) => sum + val, 0) / this.cpuUsageHistory.length;

        this.lastCpuInfo = currentCpuInfo;
        this.lastCpuTime = currentTime;

        const cpus = os.cpus();

        return {
            percent: Math.min(100, Math.max(0, smoothedCpuPercent)),
            raw: Math.min(100, Math.max(0, cpuPercent)),
            cores: cpus.length,
            model: cpus[0]?.model || 'Unknown',
            speed: cpus[0]?.speed || 0,
            loadAverage: os.loadavg(),
            user: totalDelta > 0 ? ((currentCpuInfo.user - this.lastCpuInfo?.user || 0) / totalDelta) * 100 : 0,
            system: totalDelta > 0 ? ((currentCpuInfo.sys - this.lastCpuInfo?.sys || 0) / totalDelta) * 100 : 0,
            idle: totalDelta > 0 ? (idleDelta / totalDelta) * 100 : 0,
        };
    }

    
    getMemoryUsage() {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const processMemory = process.memoryUsage();

        return {
            total: totalMemory,
            used: usedMemory,
            free: freeMemory,
            percent: (usedMemory / totalMemory) * 100,
            process: {
                rss: processMemory.rss,
                heapTotal: processMemory.heapTotal,
                heapUsed: processMemory.heapUsed,
                external: processMemory.external,
            },
        };
    }

    
    getDiskUsage() {
        try {
            fs.statSync(process.cwd());
            return {
                available: true,
                path: process.cwd(),
                usage: 'N/A',
            };
        } catch (error) {
            return {
                available: false,
                error: error.message,
            };
        }
    }

    
    getNetworkUsage() {
        const currentStats = this.getNetworkStats();
        const deltaTime = 5;

        let bytesIn = 0;
        let bytesOut = 0;

        if (this.lastNetworkStats) {
            bytesIn = (currentStats.bytesIn - this.lastNetworkStats.bytesIn) / deltaTime;
            bytesOut = (currentStats.bytesOut - this.lastNetworkStats.bytesOut) / deltaTime;
        }

        this.lastNetworkStats = currentStats;

        return {
            interfaces: os.networkInterfaces(),
            bytesPerSecIn: Math.max(0, bytesIn),
            bytesPerSecOut: Math.max(0, bytesOut),
            totalBytesIn: currentStats.bytesIn,
            totalBytesOut: currentStats.bytesOut,
        };
    }

    
    getNetworkStats() {
        return {
            bytesIn: Math.floor(Math.random() * 1000000),
            bytesOut: Math.floor(Math.random() * 1000000),
        };
    }

    
    getUptime() {
        const systemUptime = os.uptime();
        const processUptime = (Date.now() - this.startTime) / 1000;

        return {
            system: systemUptime,
            process: processUptime,
            systemFormatted: this.formatUptime(systemUptime),
            processFormatted: this.formatUptime(processUptime),
        };
    }

    
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        return `${days}d ${hours}h ${minutes}m ${secs}s`;
    }

    
    updateSystemLoad() {
        const currentTime = Date.now();
        const activeThreshold = 10 * 60 * 1000;
        let hasActiveUsers = false;

        for (const [, stats] of this.userLoadStats) {
            if (currentTime - stats.lastActivity <= activeThreshold) {
                hasActiveUsers = true;
                break;
            }
        }

        if (hasActiveUsers) {
            const currentLoad = this.getSystemLoad();
            this.systemLoadHistory.push(currentLoad);

            if (this.systemLoadHistory.length > this.maxHistoryLength) {
                this.systemLoadHistory.shift();
            }
        }
    }

    
    getOnlineUserCount() {
        const now = Date.now();
        const heartbeatTimeout = 5 * 60 * 1000;
        const inactiveTimeout = 15 * 60 * 1000;
        const recentLoginThreshold = 5 * 60 * 1000;
        let onlineCount = 0;

        for (const [, stats] of this.userLoadStats) {
            if (!stats) continue;

            const lastActivity = stats.lastActivity || 0;
            const lastHeartbeat = stats.lastHeartbeat || 0;
            const lastSessionTime = stats.lastSessionTime || 0;
            const timeSinceLastActivity = now - lastActivity;
            const timeSinceLastHeartbeat = lastHeartbeat ? now - lastHeartbeat : null;
            const timeSinceLastSession = now - lastSessionTime;

            if (stats.isOnline) {
                const hasRecentHeartbeat = timeSinceLastHeartbeat !== null && timeSinceLastHeartbeat <= heartbeatTimeout;

                const hasRecentActivity = timeSinceLastActivity <= inactiveTimeout;

                const isRecentLogin = timeSinceLastSession <= recentLoginThreshold;

                if (hasRecentHeartbeat || hasRecentActivity || isRecentLogin) {
                    onlineCount++;
                }
            }
        }

        return onlineCount;
    }

    
    getActiveUserCount() {
        const currentTime = Date.now();
        const activeThreshold = 10 * 60 * 1000;
        let activeCount = 0;

        for (const [, stats] of this.userLoadStats) {
            if (currentTime - stats.lastActivity <= activeThreshold) {
                activeCount++;
            }
        }

        return activeCount;
    }

    
    recordUserChatActivity(userHandle, messageType, messageData = {}) {
        const now = Date.now();

        if (!this.userLoadStats.has(userHandle)) {
            this.userLoadStats.set(userHandle, {
                userHandle: userHandle,
                userName: messageData.userName || userHandle,
                totalUserMessages: 0,
                totalCharacterMessages: 0,
                totalMessages: 0,
                sessionsToday: 0,
                lastActivity: now,
                firstActivity: now,
                todayMessages: 0,
                lastChatTime: now,
                lastSessionTime: now,
                onlineDuration: 0,
                currentSessionStart: now,
                isOnline: true,
                sessionCount: 1,
                lastMessageTime: now,
                characterChats: {},
                dailyStats: {},
            });
        }

        const userStats = this.userLoadStats.get(userHandle);
        const today = new Date().toDateString();

        if (messageData.userName && messageData.userName !== userStats.userName) {
            userStats.userName = messageData.userName;
        }

        userStats.totalMessages++;
        userStats.lastActivity = now;
        userStats.lastChatTime = now;
        userStats.lastMessageTime = now;
        userStats.isOnline = true;

        if (!userStats.currentSessionStart) {
            userStats.currentSessionStart = now;
            userStats.sessionCount++;
        }

        if (messageType === 'user') {
            userStats.totalUserMessages++;
        } else if (messageType === 'character') {
            userStats.totalCharacterMessages++;
        }

        if (!userStats.dailyStats[today]) {
            userStats.dailyStats[today] = {
                messages: 0,
                userMessages: 0,
                characterMessages: 0,
                firstMessage: now,
            };
        }

        const todayStats = userStats.dailyStats[today];
        todayStats.messages++;
        if (messageType === 'user') {
            todayStats.userMessages++;
        } else if (messageType === 'character') {
            todayStats.characterMessages++;
        }

        userStats.todayMessages = todayStats.messages;

        if (messageData.characterName) {
            if (!userStats.characterChats[messageData.characterName]) {
                userStats.characterChats[messageData.characterName] = {
                    totalMessages: 0,
                    userMessages: 0,
                    characterMessages: 0,
                    lastChat: now,
                };
            }

            const charStats = userStats.characterChats[messageData.characterName];
            charStats.totalMessages++;
            charStats.lastChat = now;

            if (messageType === 'user') {
                charStats.userMessages++;
            } else if (messageType === 'character') {
                charStats.characterMessages++;
            }
        }
    }

    
    recordUserLogin(userHandle, options = {}) {
        if (!userHandle) return;

        const now = Date.now();

        if (!this.userLoadStats.has(userHandle)) {
            this.userLoadStats.set(userHandle, {
                userHandle: userHandle,
                userName: options.userName || userHandle,
                totalUserMessages: 0,
                totalCharacterMessages: 0,
                totalMessages: 0,
                sessionsToday: 0,
                lastActivity: now,
                firstActivity: now,
                todayMessages: 0,
                lastChatTime: null,
                lastSessionTime: now,
                onlineDuration: 0,
                currentSessionStart: now,
                isOnline: true,
                sessionCount: 1,
                lastMessageTime: now,
                characterChats: {},
                dailyStats: {},
                lastHeartbeat: null,
                lastHeartbeatTime: null,
            });
        } else {
            const userStats = this.userLoadStats.get(userHandle);
            userStats.lastSessionTime = now;
            userStats.currentSessionStart = now;
            userStats.isOnline = true;
            userStats.sessionCount++;

            if (!userStats.lastHeartbeat) {
                userStats.lastHeartbeat = null;
            }
            if (!userStats.lastHeartbeatTime) {
                userStats.lastHeartbeatTime = null;
            }

            if (options.userName && options.userName !== userStats.userName) {
                userStats.userName = options.userName;
            }
        }

        console.log(`User login recorded: ${userHandle} at ${new Date(now).toISOString()}`);
    }

    
    recordUserLogout(userHandle) {
        if (!userHandle || !this.userLoadStats.has(userHandle)) return;

        const userStats = this.userLoadStats.get(userHandle);
        const now = Date.now();

        if (userStats.currentSessionStart) {
            const sessionDuration = now - userStats.currentSessionStart;
            userStats.onlineDuration += sessionDuration;
            userStats.currentSessionStart = null;
        }

        userStats.isOnline = false;
        userStats.lastActivity = now;

        console.log(`User logout recorded: ${userHandle}, total online duration: ${this.formatDuration(userStats.onlineDuration)}`);
    }

    
    updateUserActivity(userHandle, options = {}) {
        if (!userHandle) return;

        const now = Date.now();

        if (!this.userLoadStats.has(userHandle)) {
            this.recordUserLogin(userHandle, {
                userName: options.userName || userHandle,
            });
        }

        const userStats = this.userLoadStats.get(userHandle);
        if (!userStats) return;

        const activityType = options.isHeartbeat ? 'heartbeat' : 'request';

        userStats.lastActivity = now;
        if (options.isHeartbeat) {
            userStats.lastHeartbeat = now;
            userStats.lastHeartbeatTime = now;
        }
        userStats.isOnline = true;

        if (!userStats.currentSessionStart) {
            userStats.currentSessionStart = now;
            userStats.sessionCount++;
            console.log(`User ${userHandle} session resumed (${activityType})`);
        }

        if (options.userName && options.userName !== userStats.userName) {
            userStats.userName = options.userName;
        }
    }

    
    updateOnlineUsersDuration() {
        const now = Date.now();
        const heartbeatTimeout = 5 * 60 * 1000;
        const inactiveTimeout = 15 * 60 * 1000;
        const recentLoginThreshold = 5 * 60 * 1000;

        for (const [userHandle, userStats] of this.userLoadStats.entries()) {
            if (userStats.isOnline && userStats.currentSessionStart) {
                const timeSinceLastActivity = now - userStats.lastActivity;
                const timeSinceLastSession = now - userStats.lastSessionTime;
                const timeSinceLastHeartbeat = userStats.lastHeartbeat ? now - userStats.lastHeartbeat : null;

                if (timeSinceLastSession <= recentLoginThreshold) {
                    continue;
                }

                let shouldMarkOffline = false;
                let reason = '';

                if (timeSinceLastHeartbeat !== null && timeSinceLastHeartbeat > heartbeatTimeout) {
                    if (timeSinceLastActivity > inactiveTimeout) {
                        shouldMarkOffline = true;
                        reason = `heartbeat timeout (${Math.floor(timeSinceLastHeartbeat / 60000)}min) and no activity`;
                    }
                }
                else if (timeSinceLastHeartbeat === null && timeSinceLastActivity > inactiveTimeout) {
                    shouldMarkOffline = true;
                    reason = `no heartbeat and activity timeout (${Math.floor(timeSinceLastActivity / 60000)}min)`;
                }
                else if (timeSinceLastActivity > inactiveTimeout) {
                    shouldMarkOffline = true;
                    reason = `extended inactivity (${Math.floor(timeSinceLastActivity / 60000)}min)`;
                }

                if (shouldMarkOffline) {
                    console.log(`User ${userHandle} marked offline due to ${reason}`);
                    this.recordUserLogout(userHandle);
                }
            }
        }
    }

    
    formatDuration(duration) {
        if (!duration || duration < 0) return '0 minutes';

        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m`;
        } else {
            return `${seconds}s`;
        }
    }

    
    getUserLoadStats(userHandle) {
        const userStats = this.userLoadStats.get(userHandle);
        if (!userStats) {
            return null;
        }

        const currentTime = Date.now();
        const activeTime = currentTime - userStats.firstActivity;
        const today = new Date().toDateString();
        const todayStats = userStats.dailyStats[today] || {};

        let currentOnlineDuration = userStats.onlineDuration;
        let currentSessionDuration = 0;

        if (userStats.isOnline && userStats.currentSessionStart) {
            currentSessionDuration = currentTime - userStats.currentSessionStart;

            currentOnlineDuration = userStats.onlineDuration + currentSessionDuration;
        }

        let onlineStatusText = 'Offline';
        if (userStats.isOnline) {
            const timeSinceLastActivity = currentTime - userStats.lastActivity;
            const timeSinceLastSession = currentTime - userStats.lastSessionTime;
            const recentLoginThreshold = 5 * 60 * 1000;
            const activityTimeout = 15 * 60 * 1000;

            if (userStats.lastHeartbeat) {
                const heartbeatAge = currentTime - userStats.lastHeartbeat;
                if (heartbeatAge < 5 * 60 * 1000) {
                    onlineStatusText = 'Online';
                } else if (timeSinceLastActivity <= activityTimeout) {
                    onlineStatusText = 'Online';
                } else {
                    onlineStatusText = 'Possibly offline';
                }
            } else {
                if (timeSinceLastActivity <= activityTimeout || timeSinceLastSession <= recentLoginThreshold) {
                    onlineStatusText = 'Online';
                } else {
                    onlineStatusText = 'Online (no heartbeat)';
                }
            }
        }

        return {
            userHandle: userHandle,
            userName: userStats.userName || userHandle,
            totalMessages: userStats.totalMessages,
            totalUserMessages: userStats.totalUserMessages,
            totalCharacterMessages: userStats.totalCharacterMessages,
            todayMessages: userStats.todayMessages,

            lastChatTime: userStats.lastChatTime,
            lastChatTimeFormatted: userStats.lastChatTime ? new Date(userStats.lastChatTime).toLocaleString('en-US') : 'Never chatted',
            lastSessionTime: userStats.lastSessionTime,
            lastSessionTimeFormatted: new Date(userStats.lastSessionTime).toLocaleString('en-US'),
            lastActivity: userStats.lastActivity,
            lastActivityFormatted: new Date(userStats.lastActivity).toLocaleString('en-US'),

            onlineDuration: currentOnlineDuration,
            onlineDurationFormatted: this.formatDuration(currentOnlineDuration),
            currentSessionDuration: currentSessionDuration,
            currentSessionDurationFormatted: this.formatDuration(currentSessionDuration),
            isOnline: userStats.isOnline,
            onlineStatusText: onlineStatusText,
            sessionCount: userStats.sessionCount,
            lastHeartbeat: userStats.lastHeartbeat,
            lastHeartbeatFormatted: userStats.lastHeartbeat ? new Date(userStats.lastHeartbeat).toLocaleString('en-US') : 'None',

            activeTime: activeTime,
            activeTimeFormatted: this.formatUptime(activeTime / 1000),
            avgMessagesPerDay: this.calculateAvgMessagesPerDay(userStats),
            lastMessageTime: userStats.lastMessageTime,
            lastMessageTimeFormatted: new Date(userStats.lastMessageTime).toLocaleString('en-US'),
            characterChats: userStats.characterChats,
            todayStats: todayStats,
            chatActivityLevel: this.calculateChatActivityLevel(userStats),
        };
    }

    
    calculateAvgMessagesPerDay(userStats) {
        const dailyStats = userStats.dailyStats;
        const days = Object.keys(dailyStats).length;
        if (days === 0) return 0;

        return Math.round(userStats.totalMessages / days);
    }

    
    calculateChatActivityLevel(userStats) {
        const todayMessages = userStats.todayMessages || 0;

        if (todayMessages >= 100) return 'very_high';
        if (todayMessages >= 50) return 'high';
        if (todayMessages >= 20) return 'medium';
        if (todayMessages >= 5) return 'low';
        return 'minimal';
    }

    
    getAllUserLoadStats() {
        const allStats = [];
        const now = Date.now();

        if (!this.lastDurationUpdate || (now - this.lastDurationUpdate) > 60000) {
            this.updateOnlineUsersDuration();
            this.lastDurationUpdate = now;
        }

        for (const [userHandle] of this.userLoadStats) {
            const userStats = this.getUserLoadStats(userHandle);
            if (userStats) {
                allStats.push(userStats);
            }
        }

        return allStats.sort((a, b) => {
            if (a.lastChatTime && b.lastChatTime) {
                return b.lastChatTime - a.lastChatTime;
            }
            if (a.lastChatTime && !b.lastChatTime) {
                return -1;
            }
            if (!a.lastChatTime && b.lastChatTime) {
                return 1;
            }
            return b.lastSessionTime - a.lastSessionTime;
        });
    }

    
    getSystemLoadHistory(limit = 20) {
        return this.systemLoadHistory.slice(-limit);
    }

    
    ensureDataDirectory() {
        try {
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
                console.log(`Created system monitor data directory: ${this.dataDir}`);
            }
        } catch (error) {
            console.error('Failed to create data directory:', error);
        }
    }

    
    loadPersistedData() {
        try {
            if (fs.existsSync(this.userStatsFile)) {
                const userData = JSON.parse(fs.readFileSync(this.userStatsFile, 'utf8'));
                this.userLoadStats = new Map(Object.entries(userData));
                this.normalizeLoadedUserStats();
                console.log(`Loaded user statistics: ${this.userLoadStats.size} users`);
            }

            if (fs.existsSync(this.loadHistoryFile)) {
                const historyData = JSON.parse(fs.readFileSync(this.loadHistoryFile, 'utf8'));
                this.systemLoadHistory = historyData;
                console.log(`Loaded system load history: ${this.systemLoadHistory.length} records`);
            }

            if (fs.existsSync(this.systemStatsFile)) {
                const systemData = JSON.parse(fs.readFileSync(this.systemStatsFile, 'utf8'));
                if (systemData.startTime) {
                    this.startTime = systemData.startTime;
                }
                console.log(`Loaded system statistics, start time: ${new Date(this.startTime).toLocaleString()}`);
            }
        } catch (error) {
            console.error('Failed to load persisted data:', error);
        }
    }

    
    normalizeLoadedUserStats() {
        const now = Date.now();
        const today = new Date().toDateString();

        for (const [handle, stats] of this.userLoadStats.entries()) {
            if (!stats || typeof stats !== 'object') {
                this.userLoadStats.delete(handle);
                continue;
            }

            stats.userHandle = stats.userHandle || handle;
            stats.userName = stats.userName || handle;
            stats.characterChats = stats.characterChats || {};
            stats.dailyStats = stats.dailyStats || {};
            stats.lastActivity = stats.lastActivity || stats.lastSessionTime || stats.lastChatTime || stats.firstActivity || now;
            stats.lastSessionTime = stats.lastSessionTime || stats.lastActivity;
            stats.firstActivity = stats.firstActivity || stats.lastActivity;
            stats.sessionCount = typeof stats.sessionCount === 'number' ? stats.sessionCount : 0;
            stats.totalMessages = stats.totalMessages || 0;
            stats.totalUserMessages = stats.totalUserMessages || 0;
            stats.totalCharacterMessages = stats.totalCharacterMessages || 0;

            if (stats.dailyStats[today]) {
                stats.todayMessages = stats.dailyStats[today].messages || 0;
            } else {
                stats.todayMessages = 0;
            }

            stats.isOnline = false;
            stats.currentSessionStart = null;
            stats.lastHeartbeat = null;
            stats.lastHeartbeatTime = null;

            this.userLoadStats.set(handle, stats);
        }
    }

    
    saveDataToDisk() {
        try {
            const userStatsObj = Object.fromEntries(this.userLoadStats);
            fs.writeFileSync(this.userStatsFile, JSON.stringify(userStatsObj, null, 2));

            const recentHistory = this.systemLoadHistory.slice(-this.maxHistoryLength);
            fs.writeFileSync(this.loadHistoryFile, JSON.stringify(recentHistory, null, 2));

            const systemStats = {
                startTime: this.startTime,
                lastSave: Date.now(),
            };
            fs.writeFileSync(this.systemStatsFile, JSON.stringify(systemStats, null, 2));

            if (process.env.NODE_ENV === 'development') {
                console.log(`Data saved: users=${this.userLoadStats.size}, history=${recentHistory.length}`);
            }
        } catch (error) {
            console.error('Failed to save data:', error);
        }
    }

    
    resetUserStats(userHandle) {
        if (this.userLoadStats.has(userHandle)) {
            this.userLoadStats.delete(userHandle);
            console.log(`Statistics reset for user ${userHandle}`);
        }
    }

    
    clearAllStats() {
        this.userLoadStats.clear();
        this.systemLoadHistory = [];

        try {
            [this.userStatsFile, this.loadHistoryFile, this.systemStatsFile].forEach(file => {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            });
            console.log('All statistics cleared');
        } catch (error) {
            console.error('Failed to clear data files:', error);
        }
    }

    
    destroy() {
        this.saveDataToDisk();

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }

        if (this.userUpdateInterval) {
            clearInterval(this.userUpdateInterval);
        }
    }
}

const systemMonitor = new SystemMonitor();

process.on('SIGINT', () => {
    console.log('\nSaving system monitor data...');
    systemMonitor.saveDataToDisk();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nSaving system monitor data...');
    systemMonitor.saveDataToDisk();
    process.exit(0);
});

process.on('beforeExit', () => {
    systemMonitor.saveDataToDisk();
});

export default systemMonitor;
export { SystemMonitor };
