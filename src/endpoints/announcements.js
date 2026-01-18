import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { requireAdminMiddleware } from '../users.js';

const ANNOUNCEMENTS_DIR = path.join(process.cwd(), 'data', 'announcements');
const ANNOUNCEMENTS_FILE = path.join(ANNOUNCEMENTS_DIR, 'announcements.json');
const LOGIN_ANNOUNCEMENTS_FILE = path.join(ANNOUNCEMENTS_DIR, 'login_announcements.json');

export const router = express.Router();

function ensureAnnouncementsDirectory() {
    if (!fs.existsSync(ANNOUNCEMENTS_DIR)) {
        fs.mkdirSync(ANNOUNCEMENTS_DIR, { recursive: true });
    }
}

function loadAnnouncements() {
    ensureAnnouncementsDirectory();

    if (!fs.existsSync(ANNOUNCEMENTS_FILE)) {
        return [];
    }

    try {
        const data = fs.readFileSync(ANNOUNCEMENTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading announcements:', error);
        return [];
    }
}

function saveAnnouncements(announcements) {
    ensureAnnouncementsDirectory();

    try {
        fs.writeFileSync(ANNOUNCEMENTS_FILE, JSON.stringify(announcements, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving announcements:', error);
        return false;
    }
}

function loadLoginAnnouncements() {
    ensureAnnouncementsDirectory();

    if (!fs.existsSync(LOGIN_ANNOUNCEMENTS_FILE)) {
        return [];
    }

    try {
        const data = fs.readFileSync(LOGIN_ANNOUNCEMENTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading login announcements:', error);
        return [];
    }
}

function saveLoginAnnouncements(announcements) {
    ensureAnnouncementsDirectory();

    try {
        fs.writeFileSync(LOGIN_ANNOUNCEMENTS_FILE, JSON.stringify(announcements, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving login announcements:', error);
        return false;
    }
}

function generateAnnouncementId() {
    return `announcement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

router.get('/', requireAdminMiddleware, async (request, response) => {
    try {
        const announcements = loadAnnouncements();
        response.json(announcements);
    } catch (error) {
        console.error('Error getting announcements:', error);
        response.status(500).json({ error: 'Failed to get announcements' });
    }
});

router.get('/current', async (request, response) => {
    try {
        const announcements = loadAnnouncements();

        const validAnnouncements = announcements.filter(announcement => {
            return announcement.enabled;
        });

        response.json(validAnnouncements);
    } catch (error) {
        console.error('Error getting current announcements:', error);
        response.status(500).json({ error: 'Failed to get current announcements' });
    }
});

router.post('/', requireAdminMiddleware, async (request, response) => {
    try {
        const { title, content, type, enabled } = request.body;

        if (!title || !content) {
            return response.status(400).json({ error: 'Title and content are required' });
        }

        const announcements = loadAnnouncements();
        const now = Date.now();

        const newAnnouncement = {
            id: generateAnnouncementId(),
            title: title.trim(),
            content: content.trim(),
            type: type || 'info', // info, warning, success, error
            enabled: enabled !== false,
            createdAt: now,
            updatedAt: now,
            createdBy: request.user.profile.handle,
        };

        announcements.unshift(newAnnouncement);

        if (saveAnnouncements(announcements)) {
            console.log(`Announcement created: "${newAnnouncement.title}" by ${request.user.profile.handle}`);
            response.json(newAnnouncement);
        } else {
            response.status(500).json({ error: 'Failed to save announcement' });
        }
    } catch (error) {
        console.error('Error creating announcement:', error);
        response.status(500).json({ error: 'Failed to create announcement' });
    }
});

router.put('/:id', requireAdminMiddleware, async (request, response) => {
    try {
        const { id } = request.params;
        const { title, content, type, enabled } = request.body;

        const announcements = loadAnnouncements();
        const announcementIndex = announcements.findIndex(a => a.id === id);

        if (announcementIndex === -1) {
            return response.status(404).json({ error: 'Announcement not found' });
        }

        const announcement = announcements[announcementIndex];

        if (title !== undefined) announcement.title = title.trim();
        if (content !== undefined) announcement.content = content.trim();
        if (type !== undefined) announcement.type = type;
        if (enabled !== undefined) announcement.enabled = enabled;

        announcement.updatedAt = Date.now();
        announcement.updatedBy = request.user.profile.handle;

        if (saveAnnouncements(announcements)) {
            console.log(`Announcement updated: "${announcement.title}" by ${request.user.profile.handle}`);
            response.json(announcement);
        } else {
            response.status(500).json({ error: 'Failed to update announcement' });
        }
    } catch (error) {
        console.error('Error updating announcement:', error);
        response.status(500).json({ error: 'Failed to update announcement' });
    }
});

router.delete('/:id', requireAdminMiddleware, async (request, response) => {
    try {
        const { id } = request.params;

        const announcements = loadAnnouncements();
        const announcementIndex = announcements.findIndex(a => a.id === id);

        if (announcementIndex === -1) {
            return response.status(404).json({ error: 'Announcement not found' });
        }

        const announcement = announcements[announcementIndex];
        announcements.splice(announcementIndex, 1);

        if (saveAnnouncements(announcements)) {
            console.log(`Announcement deleted: "${announcement.title}" by ${request.user.profile.handle}`);
            response.json({ success: true });
        } else {
            response.status(500).json({ error: 'Failed to delete announcement' });
        }
    } catch (error) {
        console.error('Error deleting announcement:', error);
        response.status(500).json({ error: 'Failed to delete announcement' });
    }
});

router.post('/:id/toggle', requireAdminMiddleware, async (request, response) => {
    try {
        const { id } = request.params;

        const announcements = loadAnnouncements();
        const announcement = announcements.find(a => a.id === id);

        if (!announcement) {
            return response.status(404).json({ error: 'Announcement not found' });
        }

        announcement.enabled = !announcement.enabled;
        announcement.updatedAt = Date.now();
        announcement.updatedBy = request.user.profile.handle;

        if (saveAnnouncements(announcements)) {
            console.log(`Announcement ${announcement.enabled ? 'enabled' : 'disabled'}: "${announcement.title}" by ${request.user.profile.handle}`);
            response.json(announcement);
        } else {
            response.status(500).json({ error: 'Failed to toggle announcement' });
        }
    } catch (error) {
        console.error('Error toggling announcement:', error);
        response.status(500).json({ error: 'Failed to toggle announcement' });
    }
});


router.get('/login/current', async (request, response) => {
    try {
        const announcements = loadLoginAnnouncements();

        const validAnnouncements = announcements.filter(announcement => {
            return announcement.enabled;
        });

        response.json(validAnnouncements);
    } catch (error) {
        console.error('Error getting current login announcements:', error);
        response.status(500).json({ error: 'Failed to get current login announcements' });
    }
});

router.get('/login', requireAdminMiddleware, async (request, response) => {
    try {
        const announcements = loadLoginAnnouncements();
        response.json(announcements);
    } catch (error) {
        console.error('Error getting login announcements:', error);
        response.status(500).json({ error: 'Failed to get login announcements' });
    }
});

router.post('/login', requireAdminMiddleware, async (request, response) => {
    try {
        const { title, content, type, enabled } = request.body;

        if (!title || !content) {
            return response.status(400).json({ error: 'Title and content are required' });
        }

        const announcements = loadLoginAnnouncements();
        const now = Date.now();

        const newAnnouncement = {
            id: generateAnnouncementId(),
            title: title.trim(),
            content: content.trim(),
            type: type || 'info', // info, warning, success, error
            enabled: enabled !== false,
            createdAt: now,
            updatedAt: now,
            createdBy: request.user.profile.handle,
        };

        announcements.unshift(newAnnouncement);

        if (saveLoginAnnouncements(announcements)) {
            console.log(`Login announcement created: "${newAnnouncement.title}" by ${request.user.profile.handle}`);
            response.json(newAnnouncement);
        } else {
            response.status(500).json({ error: 'Failed to save login announcement' });
        }
    } catch (error) {
        console.error('Error creating login announcement:', error);
        response.status(500).json({ error: 'Failed to create login announcement' });
    }
});

router.put('/login/:id', requireAdminMiddleware, async (request, response) => {
    try {
        const { id } = request.params;
        const { title, content, type, enabled } = request.body;

        const announcements = loadLoginAnnouncements();
        const announcementIndex = announcements.findIndex(a => a.id === id);

        if (announcementIndex === -1) {
            return response.status(404).json({ error: 'Login announcement not found' });
        }

        const announcement = announcements[announcementIndex];

        if (title !== undefined) announcement.title = title.trim();
        if (content !== undefined) announcement.content = content.trim();
        if (type !== undefined) announcement.type = type;
        if (enabled !== undefined) announcement.enabled = enabled;

        announcement.updatedAt = Date.now();
        announcement.updatedBy = request.user.profile.handle;

        if (saveLoginAnnouncements(announcements)) {
            console.log(`Login announcement updated: "${announcement.title}" by ${request.user.profile.handle}`);
            response.json(announcement);
        } else {
            response.status(500).json({ error: 'Failed to update login announcement' });
        }
    } catch (error) {
        console.error('Error updating login announcement:', error);
        response.status(500).json({ error: 'Failed to update login announcement' });
    }
});

router.delete('/login/:id', requireAdminMiddleware, async (request, response) => {
    try {
        const { id } = request.params;

        const announcements = loadLoginAnnouncements();
        const announcementIndex = announcements.findIndex(a => a.id === id);

        if (announcementIndex === -1) {
            return response.status(404).json({ error: 'Login announcement not found' });
        }

        const announcement = announcements[announcementIndex];
        announcements.splice(announcementIndex, 1);

        if (saveLoginAnnouncements(announcements)) {
            console.log(`Login announcement deleted: "${announcement.title}" by ${request.user.profile.handle}`);
            response.json({ success: true });
        } else {
            response.status(500).json({ error: 'Failed to delete login announcement' });
        }
    } catch (error) {
        console.error('Error deleting login announcement:', error);
        response.status(500).json({ error: 'Failed to delete login announcement' });
    }
});

router.post('/login/:id/toggle', requireAdminMiddleware, async (request, response) => {
    try {
        const { id } = request.params;

        const announcements = loadLoginAnnouncements();
        const announcement = announcements.find(a => a.id === id);

        if (!announcement) {
            return response.status(404).json({ error: 'Login announcement not found' });
        }

        announcement.enabled = !announcement.enabled;
        announcement.updatedAt = Date.now();
        announcement.updatedBy = request.user.profile.handle;

        if (saveLoginAnnouncements(announcements)) {
            console.log(`Login announcement ${announcement.enabled ? 'enabled' : 'disabled'}: "${announcement.title}" by ${request.user.profile.handle}`);
            response.json(announcement);
        } else {
            response.status(500).json({ error: 'Failed to toggle login announcement' });
        }
    } catch (error) {
        console.error('Error toggling login announcement:', error);
        response.status(500).json({ error: 'Failed to toggle login announcement' });
    }
});
