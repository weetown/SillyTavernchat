import crypto from 'node:crypto';

import storage from 'node-persist';
import express from 'express';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { getIpFromRequest, getRealIpFromHeader } from '../express-common.js';
import { color, Cache, getConfigValue } from '../util.js';
import { KEY_PREFIX, getUserAvatar, toKey, getPasswordHash, getPasswordSalt, getAllUserHandles, getUserDirectories, ensurePublicDirectoriesExist, normalizeHandle } from '../users.js';
import { validateInvitationCode, useInvitationCode, getPurchaseLink, isInvitationCodesEnabled } from '../invitation-codes.js';
import { checkForNewContent, CONTENT_TYPES } from './content-manager.js';
import { applyDefaultTemplateToUser } from '../default-template.js';
import systemMonitor from '../system-monitor.js';
import { isEmailServiceAvailable, sendVerificationCode, sendPasswordRecoveryCode } from '../email-service.js';

const DISCREET_LOGIN = getConfigValue('enableDiscreetLogin', false, 'boolean');
const PREFER_REAL_IP_HEADER = getConfigValue('rateLimiting.preferRealIpHeader', false, 'boolean');
const MFA_CACHE = new Cache(5 * 60 * 1000);
const VERIFICATION_CODE_CACHE = new Cache(5 * 60 * 1000);

const getIpAddress = (request) => PREFER_REAL_IP_HEADER ? getRealIpFromHeader(request) : getIpFromRequest(request);

export const router = express.Router();
const loginLimiter = new RateLimiterMemory({
    points: 5,
    duration: 60,
});
const recoverLimiter = new RateLimiterMemory({
    points: 5,
    duration: 300,
});
const registerLimiter = new RateLimiterMemory({
    points: 3,
    duration: 300,
});
const sendVerificationLimiter = new RateLimiterMemory({
    points: 3,
    duration: 300,
});


function isTrivialHandle(handle) {
    if (!handle) return true;
    const h = String(handle).toLowerCase().replace(/-/g, '');

    if (h.length < 3) return true;

    if (/^\d{3,}$/.test(h)) return true;

    if (/^(.)\1{2,}$/.test(h)) return true;

    const banned = new Set([
        '123', '1234', '12345', '123456', '000', '0000', '111', '1111',
        'qwe', 'qwer', 'qwert', 'qwerty', 'asdf', 'zxc', 'zxcv', 'zxcvb', 'qaz', 'qazwsx',
        'test', 'tester', 'testing', 'guest', 'user', 'username', 'admin', 'root', 'null', 'void',
        'abc', 'abcd', 'abcdef',
    ]);
    if (banned.has(h)) return true;
    return false;
}

router.post('/list', async (_request, response) => {
    try {
        if (DISCREET_LOGIN) {
            return response.sendStatus(204);
        }

        /** @type {import('../users.js').User[]} */
        const users = await storage.values(x => x.key.startsWith(KEY_PREFIX));

        /** @type {Promise<import('../users.js').UserViewModel>[]} */
        const viewModelPromises = users
            .filter(x => x.enabled)
            .map(user => new Promise(async (resolve) => {
                getUserAvatar(user.handle).then(avatar =>
                    resolve({
                        handle: user.handle,
                        name: user.name,
                        created: user.created,
                        avatar: avatar,
                        password: !!user.password,
                    }),
                );
            }));

        const viewModels = await Promise.all(viewModelPromises);
        viewModels.sort((x, y) => (x.created ?? 0) - (y.created ?? 0));
        return response.json(viewModels);
    } catch (error) {
        console.error('User list failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/login', async (request, response) => {
    try {
        if (!request.body.handle) {
            console.warn('Login failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        const ip = getIpAddress(request);
        await loginLimiter.consume(ip);

        const normalizedHandle = normalizeHandle(request.body.handle);

        if (!normalizedHandle) {
            console.warn('Login failed: Invalid handle format');
            return response.status(400).json({ error: 'Invalid username format' });
        }

        const user = await storage.getItem(toKey(normalizedHandle));

        if (!user) {
            console.error('Login failed: User', request.body.handle, 'not found');
            return response.status(403).json({ error: 'Invalid username or password' });
        }

        if (!user.enabled) {
            console.warn('Login failed: User', user.handle, 'is disabled');
            return response.status(403).json({ error: 'User is disabled' });
        }

        if (user.expiresAt && user.expiresAt < Date.now()) {
            console.warn('Login failed: User', user.handle, 'subscription expired');
            const purchaseLink = await getPurchaseLink();
            return response.status(403).json({
                error: 'Your account has expired. Please renew before continuing.',
                expired: true,
                purchaseLink: purchaseLink || '',
            });
        }

        if (user.oauthProvider && !user.password && !user.salt) {
            const providerNames = {
                'github': 'GitHub',
                'discord': 'Discord',
                'linuxdo': 'Linux.do'
            };
            const providerName = providerNames[user.oauthProvider] || user.oauthProvider;
            console.warn('Login failed: OAuth user', user.handle, 'has no password set, must use OAuth login');
            return response.status(403).json({
                error: `This account was created via ${providerName} and does not have a password yet. Use third-party login or set a password in your profile first.`
            });
        }

        const isDefaultUser = user.handle === 'default-user';

        if (!user.password || !user.salt) {
            if (!isDefaultUser) {
                console.warn('Login failed: User', user.handle, 'has no password set');
                return response.status(403).json({ error: 'This account does not have a password. Please contact the administrator.' });
            }
            console.info('Default user login without password');
        } else if (user.password !== getPasswordHash(request.body.password, user.salt)) {
            console.warn('Login failed: Incorrect password for', user.handle);
            return response.status(403).json({ error: 'Invalid username or password' });
        }

        if (!request.session) {
            console.error('Session not available');
            return response.status(500).json({ error: 'Session not available' });
        }

        await loginLimiter.delete(ip);
        request.session.handle = user.handle;
        request.session.userId = user.id || user.handle;

        systemMonitor.recordUserLogin(user.handle, { userName: user.name });

        systemMonitor.updateUserActivity(user.handle, {
            userName: user.name,
            isHeartbeat: false,
        });

        console.info('Login successful:', user.handle, 'from', ip, 'at', new Date().toLocaleString('en-US'));
        
        return response.json({ handle: user.handle });
    } catch (error) {
        if (error instanceof RateLimiterRes) {
            console.error('Login failed: Rate limited from', getIpAddress(request));
            return response.status(429).json({ error: 'Too many attempts. Please try again later or recover your password.' });
        }

        console.error('Login failed:', error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/logout', async (request, response) => {
    try {
        if (!request.session) {
            return response.sendStatus(200);
        }

        const userHandle = request.session.handle;
        if (userHandle) {
            systemMonitor.recordUserLogout(userHandle);
            console.info('Logout successful:', userHandle, 'at', new Date().toLocaleString('en-US'));
        }

        request.session = null;
        return response.sendStatus(200);
    } catch (error) {
        console.error('Logout failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/heartbeat', async (request, response) => {
    try {
        if (!request.session || !request.session.handle) {
            return response.status(401).json({ error: 'Not authenticated' });
        }

        const userHandle = request.session.handle;
        const user = await storage.getItem(toKey(userHandle));

        if (!user) {
            return response.status(401).json({ error: 'User not found' });
        }

        systemMonitor.updateUserActivity(userHandle, {
            userName: user.name,
            isHeartbeat: true,
        });

        request.session.lastActivity = Date.now();

        return response.json({ status: 'ok', timestamp: Date.now() });
    } catch (error) {
        console.error('Heartbeat failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/send-verification', async (request, response) => {
    try {
        if (!request.body.email || !request.body.userName) {
            console.warn('Send verification failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        const ip = getIpAddress(request);
        await sendVerificationLimiter.consume(ip);

        if (!isEmailServiceAvailable()) {
            console.error('Send verification failed: Email service not available');
            return response.status(503).json({ error: 'Email service is not enabled. Please contact the administrator.' });
        }

        const email = request.body.email.toLowerCase().trim();
        const userName = request.body.userName.trim();

        const verificationCode = String(crypto.randomInt(100000, 999999));

        VERIFICATION_CODE_CACHE.set(email, verificationCode);

        const sent = await sendVerificationCode(email, verificationCode, userName);

        if (!sent) {
            console.error('Send verification failed: Failed to send email to', email);
            return response.status(500).json({ error: 'Failed to send email. Please try again later.' });
        }

        console.info('Verification code sent to', email);
        await sendVerificationLimiter.delete(ip);
        return response.json({ success: true });
    } catch (error) {
        if (error instanceof RateLimiterRes) {
            console.error('Send verification failed: Rate limited from', getIpAddress(request));
            return response.status(429).send({ error: 'Too many send attempts. Please try again later.' });
        }

        console.error('Send verification failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/recover-step1', async (request, response) => {
    try {
        if (!request.body.handle) {
            console.warn('Recover step 1 failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        const ip = getIpAddress(request);
        await recoverLimiter.consume(ip);

        const normalizedHandle = normalizeHandle(request.body.handle);

        if (!normalizedHandle) {
            console.warn('Recover step 1 failed: Invalid handle format');
            return response.status(400).json({ error: 'Invalid username format' });
        }

        /** @type {import('../users.js').User} */
        const user = await storage.getItem(toKey(normalizedHandle));

        if (!user) {
            console.error('Recover step 1 failed: User', request.body.handle, 'not found');
            return response.status(404).json({ error: 'User not found' });
        }

        if (!user.enabled) {
            console.error('Recover step 1 failed: User', user.handle, 'is disabled');
            return response.status(403).json({ error: 'User is disabled' });
        }

        if (!user.email) {
            console.error('Recover step 1 failed: User', user.handle, 'has no email');
            return response.status(400).json({ error: 'This account does not have a bound email and cannot recover via email. Please contact the administrator.' });
        }

        const mfaCode = String(crypto.randomInt(1000, 9999));

        if (isEmailServiceAvailable()) {
            const sent = await sendPasswordRecoveryCode(user.email, mfaCode, user.name);
            if (sent) {
                console.info('Password recovery code sent to email:', user.email);
                MFA_CACHE.set(user.handle, mfaCode);
                await recoverLimiter.delete(ip);
                return response.json({
                    success: true,
                    method: 'email',
                    message: 'Password recovery code sent to your email',
                });
            } else {
                console.error('Failed to send recovery code to email, falling back to console');
            }
        }

        console.log();
        console.log(color.blue(`${user.name}, your password recovery code is: `) + color.magenta(mfaCode));
        console.log();
        MFA_CACHE.set(user.handle, mfaCode);
        await recoverLimiter.delete(ip);
        return response.json({
            success: true,
            method: 'console',
            message: 'Password recovery code shown in server console. Please contact the administrator.',
        });
    } catch (error) {
        if (error instanceof RateLimiterRes) {
            console.error('Recover step 1 failed: Rate limited from', getIpAddress(request));
            return response.status(429).send({ error: 'Too many attempts. Please try again later or contact the administrator.' });
        }

        console.error('Recover step 1 failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/recover-step2', async (request, response) => {
    try {
        if (!request.body.handle || !request.body.code) {
            console.warn('Recover step 2 failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        const normalizedHandle = normalizeHandle(request.body.handle);

        if (!normalizedHandle) {
            console.warn('Recover step 2 failed: Invalid handle format');
            return response.status(400).json({ error: 'Invalid username format' });
        }

        /** @type {import('../users.js').User} */
        const user = await storage.getItem(toKey(normalizedHandle));
        const ip = getIpAddress(request);

        if (!user) {
            console.error('Recover step 2 failed: User', request.body.handle, 'not found');
            return response.status(404).json({ error: 'User not found' });
        }

        if (!user.enabled) {
            console.warn('Recover step 2 failed: User', user.handle, 'is disabled');
            return response.status(403).json({ error: 'User is disabled' });
        }

        const mfaCode = MFA_CACHE.get(user.handle);

        if (request.body.code !== mfaCode) {
            await recoverLimiter.consume(ip);
            console.warn('Recover step 2 failed: Incorrect code');
            return response.status(403).json({ error: 'Recovery code is incorrect' });
        }

        if (request.body.newPassword) {
            const salt = getPasswordSalt();
            user.password = getPasswordHash(request.body.newPassword, salt);
            user.salt = salt;
            await storage.setItem(toKey(normalizedHandle), user);
        } else {
            user.password = '';
            user.salt = '';
            await storage.setItem(toKey(normalizedHandle), user);
        }

        await recoverLimiter.delete(ip);
        MFA_CACHE.remove(user.handle);
        return response.sendStatus(204);
    } catch (error) {
        if (error instanceof RateLimiterRes) {
            console.error('Recover step 2 failed: Rate limited from', getIpAddress(request));
            return response.status(429).send({ error: 'Too many attempts. Please try again later or contact the administrator.' });
        }

        console.error('Recover step 2 failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/register', async (request, response) => {
    try {
        const { handle, name, password, confirmPassword, email, verificationCode, invitationCode } = request.body;

        if (!handle || !name || !password || !confirmPassword) {
            console.warn('Register failed: Missing required fields');
            return response.status(400).json({ error: 'Please fill in all required fields' });
        }

        let normalizedEmail = null;

        if (isEmailServiceAvailable()) {
            if (!email || !verificationCode) {
                console.warn('Register failed: Missing email or verification code');
                return response.status(400).json({ error: 'Please enter email and verification code' });
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                console.warn('Register failed: Invalid email format');
                return response.status(400).json({ error: 'Email format is invalid' });
            }

            normalizedEmail = email.toLowerCase().trim();
            const cachedCode = VERIFICATION_CODE_CACHE.get(normalizedEmail);

            if (!cachedCode) {
                console.warn('Register failed: Verification code expired or not found');
                return response.status(400).json({ error: 'Verification code has expired or does not exist. Please resend.' });
            }

            if (cachedCode !== verificationCode) {
                console.warn('Register failed: Incorrect verification code');
                return response.status(400).json({ error: 'Verification code is incorrect' });
            }
        } else if (email) {
            normalizedEmail = email.toLowerCase().trim();
        }

        if (password !== confirmPassword) {
            console.warn('Register failed: Password mismatch');
            return response.status(400).json({ error: 'Passwords do not match' });
        }

        if (password.length < 6) {
            console.warn('Register failed: Password too short');
            return response.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const ip = getIpAddress(request);
        await registerLimiter.consume(ip);

        const invitationValidation = await validateInvitationCode(invitationCode);
        if (!invitationValidation.valid) {
            console.warn('Register failed: Invalid invitation code');
            return response.status(400).json({ error: invitationValidation.reason || 'Invalid invitation code' });
        }

        const handles = await getAllUserHandles();
        const normalizedHandle = normalizeHandle(handle);

        if (!normalizedHandle) {
            console.warn('Register failed: Invalid handle');
            return response.status(400).json({ error: 'Invalid username. Only letters, numbers, and hyphens are allowed.' });
        }

        if (!/^[a-z0-9-]+$/.test(normalizedHandle)) {
            console.warn('Register failed: Handle contains invalid characters:', normalizedHandle);
            return response.status(400).json({ error: 'Username can only contain letters, numbers, and hyphens.' });
        }

        if (isTrivialHandle(normalizedHandle)) {
            console.warn('Register failed: Trivial/weak handle not allowed:', normalizedHandle);
            return response.status(400).json({ error: 'Username is too simple or blacklisted. Please choose a more distinctive username.' });
        }

        if (handles.some(x => x === normalizedHandle)) {
            console.warn('Register failed: User with that handle already exists');
            return response.status(409).json({ error: 'Username already exists' });
        }

        const salt = getPasswordSalt();
        const hashedPassword = getPasswordHash(password, salt);

        let userExpiresAt = null;
        if (isInvitationCodesEnabled() && invitationCode) {
            const invitationValidationResult = await validateInvitationCode(invitationCode);
            if (invitationValidationResult.valid && invitationValidationResult.invitation) {
                const invitation = invitationValidationResult.invitation;
                if (invitation.durationDays !== null && invitation.durationDays > 0) {
                    userExpiresAt = Date.now() + (invitation.durationDays * 24 * 60 * 60 * 1000);
                }
            }
        }

        const newUser = {
            handle: normalizedHandle,
            name: name.trim(),
            created: Date.now(),
            password: hashedPassword,
            salt: salt,
            admin: false,
            enabled: true,
            expiresAt: userExpiresAt,
        };

        if (normalizedEmail) {
            newUser.email = normalizedEmail;
        }

        await storage.setItem(toKey(normalizedHandle), newUser);

        if (normalizedEmail && isEmailServiceAvailable()) {
            VERIFICATION_CODE_CACHE.remove(normalizedEmail);
        }

        if (isInvitationCodesEnabled() && invitationCode) {
            await useInvitationCode(invitationCode, normalizedHandle, userExpiresAt);
        }

        // Create user directories
        console.info('Creating data directories for', newUser.handle);
        await ensurePublicDirectoriesExist();
        const directories = getUserDirectories(newUser.handle);
        await checkForNewContent([directories], [CONTENT_TYPES.SETTINGS]);
        applyDefaultTemplateToUser(directories, { userName: newUser.name });

        await registerLimiter.delete(ip);
        console.info('User registered successfully:', newUser.handle, 'from', ip);

        return response.json({
            handle: newUser.handle,
            message: handle !== normalizedHandle
                ? `Registration successful! Your username has been normalized to: ${normalizedHandle}`
                : 'Registration successful!'
        });
    } catch (error) {
        if (error instanceof RateLimiterRes) {
            console.error('Register failed: Rate limited from', getIpAddress(request));
            return response.status(429).send({ error: 'Too many attempts. Please try again later.' });
        }

        console.error('Register failed:', error);
        return response.sendStatus(500);
    }
});

router.get('/me', async (request, response) => {
    try {
        if (!request.session || !request.session.handle) {
            return response.status(401).json({ error: 'Not logged in' });
        }

        const userHandle = request.session.handle;
        const user = await storage.getItem(toKey(userHandle));

        if (!user) {
            return response.status(401).json({ error: 'User not found' });
        }

        const avatar = await getUserAvatar(user.handle);

        return response.json({
            handle: user.handle,
            name: user.name,
            admin: user.admin || false,
            enabled: user.enabled,
            created: user.created,
            avatar: avatar,
            password: !!user.password,
            expiresAt: user.expiresAt || null,
            email: user.email || null,
        });
    } catch (error) {
        console.error('Get current user failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/renew', async (request, response) => {
    try {
        if (!request.session || !request.session.handle) {
            return response.status(401).json({ error: 'Not logged in' });
        }

        const { invitationCode } = request.body;

        if (!invitationCode) {
            console.warn('Renew failed: Missing invitation code');
            return response.status(400).json({ error: 'Please enter a renewal code' });
        }

        const userHandle = request.session.handle;
        const user = await storage.getItem(toKey(userHandle));

        if (!user) {
            return response.status(401).json({ error: 'User not found' });
        }

        const invitationValidation = await validateInvitationCode(invitationCode);
        if (!invitationValidation.valid) {
            console.warn('Renew failed: Invalid invitation code');
            return response.status(400).json({ error: invitationValidation.reason || 'Invalid renewal code' });
        }

        const invitation = invitationValidation.invitation;
        if (!invitation) {
            return response.status(400).json({ error: 'Invalid renewal code' });
        }

        let newExpiresAt = null;
        if (invitation.durationDays !== null && invitation.durationDays > 0) {
            const baseTime = user.expiresAt && user.expiresAt > Date.now() ? user.expiresAt : Date.now();
            newExpiresAt = baseTime + (invitation.durationDays * 24 * 60 * 60 * 1000);
        }

        user.expiresAt = newExpiresAt;
        await storage.setItem(toKey(userHandle), user);

        await useInvitationCode(invitationCode, userHandle, newExpiresAt);

        console.info('User renewed successfully:', userHandle, 'new expires:', newExpiresAt ? new Date(newExpiresAt).toLocaleString('en-US') : 'Permanent');
        return response.json({
            success: true,
            expiresAt: newExpiresAt,
            message: newExpiresAt ? 'Renewal successful. Expiration time: ' + new Date(newExpiresAt).toLocaleString('en-US') : 'Renewal successful. Your account has been upgraded to a permanent account.',
        });
    } catch (error) {
        console.error('Renew failed:', error);
        return response.status(500).json({ error: 'Renewal failed. Please try again later.' });
    }
});

router.post('/renew-expired', async (request, response) => {
    try {
        const { handle, password, invitationCode } = request.body;

        if (!handle || !password) {
            return response.status(400).json({ error: 'Please provide a username and password' });
        }

        if (!invitationCode) {
            console.warn('Renew-expired failed: Missing invitation code');
            return response.status(400).json({ error: 'Please enter a renewal code' });
        }

        const normalizedHandle = normalizeHandle(handle);

        if (!normalizedHandle) {
            return response.status(400).json({ error: 'Invalid username format' });
        }

        const user = await storage.getItem(toKey(normalizedHandle));

        if (!user) {
            return response.status(401).json({ error: 'Invalid username or password' });
        }

        const passwordHash = getPasswordHash(password, user.salt);
        if (user.password !== passwordHash) {
            console.warn('Renew-expired failed: Invalid password for', normalizedHandle);
            return response.status(401).json({ error: 'Invalid username or password' });
        }

        const invitationValidation = await validateInvitationCode(invitationCode);
        if (!invitationValidation.valid) {
            console.warn('Renew-expired failed: Invalid invitation code');
            return response.status(400).json({ error: invitationValidation.reason || 'Invalid renewal code' });
        }

        const invitation = invitationValidation.invitation;
        if (!invitation) {
            return response.status(400).json({ error: 'Invalid renewal code' });
        }

        let newExpiresAt = null;
        if (invitation.durationDays !== null && invitation.durationDays > 0) {
            const baseTime = user.expiresAt && user.expiresAt > Date.now() ? user.expiresAt : Date.now();
            newExpiresAt = baseTime + (invitation.durationDays * 24 * 60 * 60 * 1000);
        }

        user.expiresAt = newExpiresAt;
        await storage.setItem(toKey(normalizedHandle), user);

        await useInvitationCode(invitationCode, normalizedHandle, newExpiresAt);

        console.info('User renewed successfully (expired account):', normalizedHandle, 'new expires:', newExpiresAt ? new Date(newExpiresAt).toLocaleString('en-US') : 'Permanent');
        return response.json({
            success: true,
            expiresAt: newExpiresAt,
            message: newExpiresAt ? 'Renewal successful. Expiration time: ' + new Date(newExpiresAt).toLocaleString('en-US') : 'Renewal successful. Your account has been upgraded to a permanent account.',
        });
    } catch (error) {
        console.error('Renew-expired failed:', error);
        return response.status(500).json({ error: 'Renewal failed. Please try again later.' });
    }
});
