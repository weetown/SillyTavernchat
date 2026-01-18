import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs';
import storage from 'node-persist';
import fetch from 'node-fetch';
import { getConfigValue } from '../util.js';
import {
    toKey,
    getUserAvatar,
    normalizeHandle,
    KEY_PREFIX,
    getUserDirectories,
    ensurePublicDirectoriesExist,
    toAvatarKey
} from '../users.js';
import {
    validateInvitationCode,
    useInvitationCode,
    isInvitationCodesEnabled
} from '../invitation-codes.js';
import { checkForNewContent, CONTENT_TYPES } from './content-manager.js';
import { applyDefaultTemplateToUser } from '../default-template.js';

export const router = express.Router();


function processDiscourseAvatarTemplate(template, baseUrl = 'https://connect.linux.do') {
    if (!template) return null;

    if (template.startsWith('http://') || template.startsWith('https://')) {
        return template.replace('{size}', '96');
    }

    const path = template.replace('{size}', '96');
    return `${baseUrl}${path}`;
}



function decodeJWT(token) {
    try {
        if (!token || typeof token !== 'string') {
            return null;
        }

        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }

        const payload = parts[1];
        const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);

        const base64Payload = paddedPayload.replace(/-/g, '+').replace(/_/g, '/');

        const decoded = Buffer.from(base64Payload, 'base64').toString('utf-8');
        const parsedPayload = JSON.parse(decoded);

        return parsedPayload;
    } catch (error) {
        console.error('Error decoding JWT:', error.message);
        return null;
    }
}


function buildCallbackUrl(request, provider) {
    let protocol = request.protocol;

    if (!protocol || protocol === 'http' || protocol === 'https') {
        const forwardedProto = request.get('x-forwarded-proto');
        if (forwardedProto) {
            protocol = forwardedProto.split(',')[0].trim();
        }
    }

    if (!protocol || (protocol !== 'http' && protocol !== 'https')) {
        protocol = 'http';
    }

    let host = request.get('host') || request.get('x-forwarded-host');

    if (!host) {
        host = 'localhost';
    }

    let hostname = host;
    if (!host.includes(':')) {
        const port = getConfigValue('port', 8000, 'number');
        if ((protocol === 'http' && port !== 80) || (protocol === 'https' && port !== 443)) {
            hostname = `${host}:${port}`;
        }
    }

    const sslEnabled = getConfigValue('ssl.enabled', false, 'boolean');
    const finalProtocol = sslEnabled ? 'https' : protocol;

    return `${finalProtocol}://${hostname}/api/oauth/${provider}/callback`;
}

const oidcConfigCache = new Map();
const OIDC_CACHE_TTL = 60 * 60 * 1000;
const OIDC_FAILURE_TTL = 5 * 60 * 1000;
const OIDC_REQUEST_TIMEOUT = 3000;


async function fetchOIDCConfig(wellKnownEndpoint) {
    try {
        const cached = oidcConfigCache.get(wellKnownEndpoint);
        if (cached) {
            if (cached.failed && (Date.now() - cached.timestamp < OIDC_FAILURE_TTL)) {
                return null;
            }
            if (cached.config && (Date.now() - cached.timestamp < OIDC_CACHE_TTL)) {
                return cached.config;
            }
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), OIDC_REQUEST_TIMEOUT);
        const response = await fetch(wellKnownEndpoint, {
            headers: {
                'Accept': 'application/json',
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`Failed to fetch OIDC config from ${wellKnownEndpoint}: ${response.status}`);
            oidcConfigCache.set(wellKnownEndpoint, { failed: true, timestamp: Date.now() });
            return null;
        }

        /** @type {any} */
        const config = await response.json();

        if (!config.authorization_endpoint || !config.token_endpoint) {
            console.error('Invalid OIDC config: missing required endpoints');
            oidcConfigCache.set(wellKnownEndpoint, { failed: true, timestamp: Date.now() });
            return null;
        }

        oidcConfigCache.set(wellKnownEndpoint, {
            config: config,
            timestamp: Date.now(),
        });
        return config;
    } catch (error) {
        const errorMessage = error && error.name === 'AbortError'
            ? `timeout after ${OIDC_REQUEST_TIMEOUT}ms`
            : error?.message;
        console.error(`Error fetching OIDC config from ${wellKnownEndpoint}:`, errorMessage);
        oidcConfigCache.set(wellKnownEndpoint, { failed: true, timestamp: Date.now() });
        return null;
    }
}


async function getOAuthConfig(request) {
    const githubCallbackUrl = getConfigValue('oauth.github.callbackUrl', '', null) || buildCallbackUrl(request, 'github');
    const discordCallbackUrl = getConfigValue('oauth.discord.callbackUrl', '', null) || buildCallbackUrl(request, 'discord');
    const linuxdoCallbackUrl = getConfigValue('oauth.linuxdo.callbackUrl', '', null) || buildCallbackUrl(request, 'linuxdo');

    const linuxdoEnabled = getConfigValue('oauth.linuxdo.enabled', false, 'boolean');
    let linuxdoAuthUrl = String(getConfigValue('oauth.linuxdo.authUrl', 'https://connect.linux.do/oauth2/authorize') || 'https://connect.linux.do/oauth2/authorize');
    let linuxdoTokenUrl = String(getConfigValue('oauth.linuxdo.tokenUrl', 'https://connect.linux.do/oauth2/token') || 'https://connect.linux.do/oauth2/token');
    let linuxdoUserInfoUrl = String(getConfigValue('oauth.linuxdo.userInfoUrl', 'https://connect.linux.do/api/user') || 'https://connect.linux.do/api/user');

    const wellKnownEndpoint = getConfigValue('oauth.linuxdo.wellKnownEndpoint', '', null);
    if (linuxdoEnabled && wellKnownEndpoint && wellKnownEndpoint.trim()) {
        const oidcConfig = await fetchOIDCConfig(wellKnownEndpoint.trim());
        if (oidcConfig) {
            linuxdoAuthUrl = oidcConfig.authorization_endpoint || linuxdoAuthUrl;
            linuxdoTokenUrl = oidcConfig.token_endpoint || linuxdoTokenUrl;
            linuxdoUserInfoUrl = oidcConfig.userinfo_endpoint || linuxdoUserInfoUrl;
        }
    }

    return {
        github: {
            enabled: getConfigValue('oauth.github.enabled', false, 'boolean'),
            clientId: String(getConfigValue('oauth.github.clientId', '') || ''),
            clientSecret: String(getConfigValue('oauth.github.clientSecret', '') || ''),
            callbackUrl: githubCallbackUrl,
            authUrl: 'https://github.com/login/oauth/authorize',
            tokenUrl: 'https://github.com/login/oauth/access_token',
            userInfoUrl: 'https://api.github.com/user',
        },
        discord: {
            enabled: getConfigValue('oauth.discord.enabled', false, 'boolean'),
            clientId: String(getConfigValue('oauth.discord.clientId', '') || ''),
            clientSecret: String(getConfigValue('oauth.discord.clientSecret', '') || ''),
            callbackUrl: discordCallbackUrl,
            authUrl: 'https://discord.com/api/oauth2/authorize',
            tokenUrl: 'https://discord.com/api/oauth2/token',
            userInfoUrl: 'https://discord.com/api/users/@me',
        },
        linuxdo: {
            enabled: linuxdoEnabled,
            clientId: String(getConfigValue('oauth.linuxdo.clientId', '') || ''),
            clientSecret: String(getConfigValue('oauth.linuxdo.clientSecret', '') || ''),
            callbackUrl: linuxdoCallbackUrl,
            authUrl: linuxdoAuthUrl,
            tokenUrl: linuxdoTokenUrl,
            userInfoUrl: linuxdoUserInfoUrl,
        },
    };
}

const oauthStateCache = new Map();


function generateState() {
    return crypto.randomBytes(32).toString('hex');
}


router.get('/config', async (request, response) => {
    try {
        const oauthConfig = await getOAuthConfig(request);
        const config = {
            github: {
                enabled: oauthConfig.github.enabled && !!oauthConfig.github.clientId,
            },
            discord: {
                enabled: oauthConfig.discord.enabled && !!oauthConfig.discord.clientId,
            },
            linuxdo: {
                enabled: oauthConfig.linuxdo.enabled && !!oauthConfig.linuxdo.clientId,
            },
        };
        return response.json(config);
    } catch (error) {
        console.error('Error getting OAuth config:', error);
        return response.status(500).json({ error: 'Failed to fetch OAuth configuration' });
    }
});


router.get('/github', async (request, response) => {
    try {
        const oauthConfig = await getOAuthConfig(request);
        if (!oauthConfig.github.enabled || !oauthConfig.github.clientId) {
            return response.status(400).json({ error: 'GitHub OAuth is not enabled' });
        }

        const state = generateState();
        oauthStateCache.set(state, { provider: 'github', timestamp: Date.now() });

        for (const [key, value] of oauthStateCache.entries()) {
            if (Date.now() - value.timestamp > 10 * 60 * 1000) {
                oauthStateCache.delete(key);
            }
        }

        const params = new URLSearchParams({
            client_id: oauthConfig.github.clientId,
            redirect_uri: oauthConfig.github.callbackUrl,
            scope: 'read:user user:email',
            state: state,
        });

        const authUrl = `${oauthConfig.github.authUrl}?${params.toString()}`;
        return response.redirect(authUrl);
    } catch (error) {
        console.error('Error initiating GitHub OAuth:', error);
        return response.status(500).json({ error: 'Failed to initialize GitHub OAuth' });
    }
});


router.get('/discord', async (request, response) => {
    try {
        const oauthConfig = await getOAuthConfig(request);
        if (!oauthConfig.discord.enabled || !oauthConfig.discord.clientId) {
            return response.status(400).json({ error: 'Discord OAuth is not enabled' });
        }

        const state = generateState();
        oauthStateCache.set(state, { provider: 'discord', timestamp: Date.now() });

        for (const [key, value] of oauthStateCache.entries()) {
            if (Date.now() - value.timestamp > 10 * 60 * 1000) {
                oauthStateCache.delete(key);
            }
        }

        const params = new URLSearchParams({
            client_id: oauthConfig.discord.clientId,
            redirect_uri: oauthConfig.discord.callbackUrl,
            response_type: 'code',
            scope: 'identify email',
            state: state,
        });

        const authUrl = `${oauthConfig.discord.authUrl}?${params.toString()}`;
        return response.redirect(authUrl);
    } catch (error) {
        console.error('Error initiating Discord OAuth:', error);
        return response.status(500).json({ error: 'Failed to initialize Discord OAuth' });
    }
});


router.get('/linuxdo', async (request, response) => {
    try {
        const oauthConfig = await getOAuthConfig(request);
        if (!oauthConfig.linuxdo.enabled || !oauthConfig.linuxdo.clientId) {
            return response.status(400).json({ error: 'Linux.do OAuth is not enabled' });
        }

        const state = generateState();
        oauthStateCache.set(state, { provider: 'linuxdo', timestamp: Date.now() });

        for (const [key, value] of oauthStateCache.entries()) {
            if (Date.now() - value.timestamp > 10 * 60 * 1000) {
                oauthStateCache.delete(key);
            }
        }

        const params = new URLSearchParams({
            client_id: oauthConfig.linuxdo.clientId,
            redirect_uri: oauthConfig.linuxdo.callbackUrl,
            response_type: 'code',
            state: state,
        });

        const authUrl = `${oauthConfig.linuxdo.authUrl}?${params.toString()}`;
        return response.redirect(authUrl);
    } catch (error) {
        console.error('Error initiating Linux.do OAuth:', error);
        return response.status(500).json({ error: 'Failed to initialize Linux.do OAuth' });
    }
});


router.get('/github/callback', async (request, response) => {
    try {
        const { code, state } = request.query;
        const oauthConfig = await getOAuthConfig(request);

        const cachedState = oauthStateCache.get(state);
        if (!cachedState || cachedState.provider !== 'github') {
            return response.status(400).send('Invalid state parameter');
        }
        oauthStateCache.delete(state);

        const tokenResponse = await fetch(oauthConfig.github.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                client_id: oauthConfig.github.clientId,
                client_secret: oauthConfig.github.clientSecret,
                code: code,
                redirect_uri: oauthConfig.github.callbackUrl,
            }),
        });

        /** @type {any} */
        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) {
            console.error('GitHub OAuth token error:', tokenData);
            return response.status(400).send('Failed to get access token');
        }

        const userResponse = await fetch(oauthConfig.github.userInfoUrl, {
            headers: {
                'Authorization': `Bearer ${String(tokenData.access_token)}`,
                'Accept': 'application/json',
            },
        });

        const userData = await userResponse.json();
        console.log('GitHub user data:', userData);

        await handleOAuthLogin(request, response, 'github', userData);
    } catch (error) {
        console.error('Error in GitHub OAuth callback:', error);
        return response.status(500).send('GitHub OAuth callback failed');
    }
});


router.get('/discord/callback', async (request, response) => {
    try {
        const { code, state } = request.query;
        const oauthConfig = await getOAuthConfig(request);

        const cachedState = oauthStateCache.get(state);
        if (!cachedState || cachedState.provider !== 'discord') {
            return response.status(400).send('Invalid state parameter');
        }
        oauthStateCache.delete(state);

        const codeStr = String(code || '');
        const params = new URLSearchParams({
            client_id: oauthConfig.discord.clientId,
            client_secret: oauthConfig.discord.clientSecret,
            grant_type: 'authorization_code',
            code: codeStr,
            redirect_uri: oauthConfig.discord.callbackUrl,
        });

        const tokenResponse = await fetch(oauthConfig.discord.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        /** @type {any} */
        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) {
            console.error('Discord OAuth token error:', tokenData);
            return response.status(400).send('Failed to get access token');
        }

        const userResponse = await fetch(oauthConfig.discord.userInfoUrl, {
            headers: {
                'Authorization': `Bearer ${String(tokenData.access_token)}`,
            },
        });

        const userData = await userResponse.json();
        console.log('Discord user data:', userData);

        await handleOAuthLogin(request, response, 'discord', userData);
    } catch (error) {
        console.error('Error in Discord OAuth callback:', error);
        return response.status(500).send('Discord OAuth callback failed');
    }
});


router.get('/linuxdo/callback', async (request, response) => {
    try {
        const { code, state } = request.query;
        const oauthConfig = await getOAuthConfig(request);

        const cachedState = oauthStateCache.get(state);
        if (!cachedState || cachedState.provider !== 'linuxdo') {
            return response.status(400).send('Invalid state parameter');
        }
        oauthStateCache.delete(state);

        const codeStr = String(code || '');
        const params = new URLSearchParams({
            client_id: oauthConfig.linuxdo.clientId,
            client_secret: oauthConfig.linuxdo.clientSecret,
            grant_type: 'authorization_code',
            code: codeStr,
            redirect_uri: oauthConfig.linuxdo.callbackUrl,
        });

        const tokenResponse = await fetch(oauthConfig.linuxdo.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Linux.do OAuth token error response:', tokenResponse.status, errorText);
            return response.status(400).send(`Failed to get access token: ${tokenResponse.status}`);
        }

        /** @type {any} */
        const tokenData = await tokenResponse.json();

        let userData;

        if (tokenData.id_token) {
            const decodedToken = decodeJWT(tokenData.id_token);
            if (decodedToken) {
                userData = decodedToken;
            }
        }

        if (!userData && tokenData.access_token && tokenData.access_token.split('.').length === 3) {
            const decodedToken = decodeJWT(tokenData.access_token);
            if (decodedToken && decodedToken.sub) {
                if (decodedToken.username || decodedToken.email || decodedToken.name || decodedToken.preferred_username) {
                    userData = decodedToken;
                }
            }
        }

        if (!userData && tokenData.access_token) {
            const endpoints = [
                oauthConfig.linuxdo.userInfoUrl,
                'https://connect.linux.do/api/user'
            ];

            for (const endpoint of endpoints) {
                if (userData) break;

                try {
                    const userResponse = await fetch(endpoint, {
                        headers: {
                            'Authorization': `Bearer ${String(tokenData.access_token)}`,
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        },
                    });

                    if (userResponse.ok) {
                        const contentType = userResponse.headers.get('content-type');
                        if (contentType && contentType.includes('application/json')) {
                            /** @type {any} */
                            const data = await userResponse.json();

                            if (data && (data.username || data.id)) {
                                userData = data;
                                break;
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error fetching user info from', endpoint, ':', error.message);
                }
            }
        }

        if (!userData) {
            console.error('Linux.do OAuth error: Failed to get user information');
            return response.status(400).send('Failed to get user information');
        }

        await handleOAuthLogin(request, response, 'linuxdo', userData);
    } catch (error) {
        console.error('Error in Linux.do OAuth callback:', error);
        return response.status(500).send('Linux.do OAuth callback failed');
    }
});


async function handleOAuthLogin(request, response, provider, userData) {
    try {
        let userId, username, email, avatar;

        switch (provider) {
            case 'github':
                userId = `github_${userData.id}`;
                username = userData.login || `github_user_${userData.id}`;
                email = userData.email;
                avatar = userData.avatar_url;
                break;
            case 'discord':
                userId = `discord_${userData.id}`;
                username = userData.username || `discord_user_${userData.id}`;
                email = userData.email;
                avatar = userData.avatar
                    ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
                    : null;
                break;
            case 'linuxdo':
                const userInfo = userData.user || userData.current_user || userData;

                const rawUserId = userInfo.id || userData.id || userInfo.sub || userData.sub;
                userId = `linuxdo_${rawUserId}`;

                username = userInfo.username || userData.username ||
                          userInfo.preferred_username || userData.preferred_username ||
                          userInfo.name || userData.name ||
                          `linuxdo_user_${rawUserId}`;

                email = userInfo.email || userData.email;

                avatar = userInfo.avatar_url || userData.avatar_url ||
                        userInfo.picture || userData.picture ||
                        userInfo.avatar_template || userData.avatar_template;

                if (avatar && avatar.includes('{size}')) {
                    avatar = processDiscourseAvatarTemplate(avatar);
                }
                break;
            default:
                throw new Error('Unknown OAuth provider');
        }

        const normalizedHandle = normalizeHandle(username);
        if (!normalizedHandle) {
            return response.redirect(`/login?error=${encodeURIComponent('Invalid username format')}`);
        }

        let user = await storage.getItem(toKey(normalizedHandle));

        if (!user) {
            if (isInvitationCodesEnabled()) {
                if (request.session) {
                    request.session.oauthPendingUser = {
                        handle: normalizedHandle,
                        name: username,
                        email: email,
                        avatar: avatar,
                        provider: provider,
                        userId: userId,
                    };
                }
                return response.redirect('/login?oauth_pending=true');
            }

            user = {
                handle: normalizedHandle,
                name: username || normalizedHandle,
                email: email || '',
                created: Date.now(),
                admin: false,
                enabled: true,
                password: null,
                salt: null,
                oauthProvider: provider,
                oauthUserId: userId,
                avatar: avatar || null,
            };

            await storage.setItem(toKey(normalizedHandle), user);
            console.log(`Created new user via ${provider} OAuth:`, normalizedHandle);

            if (avatar) {
                await storage.setItem(toAvatarKey(normalizedHandle), avatar);
            }

            console.info('Creating data directories for', normalizedHandle);
            await ensurePublicDirectoriesExist();
            const directories = getUserDirectories(normalizedHandle);
            for (const dir of Object.values(directories)) {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
            }
            await checkForNewContent([directories], [CONTENT_TYPES.SETTINGS]);
            applyDefaultTemplateToUser(directories, { userName: user.name });
        } else {
            user.oauthProvider = provider;
            user.oauthUserId = userId;
            if (avatar) {
                user.avatar = avatar;
                await storage.setItem(toAvatarKey(normalizedHandle), avatar);
            }
            await storage.setItem(toKey(normalizedHandle), user);
        }

        if (request.session) {
            request.session.handle = user.handle;
            request.session.authenticated = true;
        }

        return response.redirect('/');
    } catch (error) {
        console.error('Error handling OAuth login:', error);
        return response.redirect(`/login?error=${encodeURIComponent('OAuth login failed')}`);
    }
}


router.post('/verify-invitation', async (request, response) => {
    try {
        const { invitationCode } = request.body;

        if (!invitationCode) {
            return response.status(400).json({ error: 'Please enter an invitation code' });
        }

        if (!request.session || !request.session.oauthPendingUser) {
            return response.status(400).json({ error: 'No pending OAuth user' });
        }

        const pendingUser = request.session.oauthPendingUser;

        const validation = await validateInvitationCode(invitationCode);
        if (!validation.valid) {
            return response.status(400).json({ error: validation.reason || 'Invalid invitation code' });
        }

        const user = {
            handle: pendingUser.handle,
            name: pendingUser.name || pendingUser.handle,
            email: pendingUser.email || '',
            created: Date.now(),
            admin: false,
            enabled: true,
            password: null,
            salt: null,
            oauthProvider: pendingUser.provider,
            oauthUserId: pendingUser.userId,
            avatar: pendingUser.avatar || null,
        };

        let userExpiresAt = null;
        if (validation.invitation && validation.invitation.durationDays) {
            const now = Date.now();
            const expiresAt = now + (validation.invitation.durationDays * 24 * 60 * 60 * 1000);
            userExpiresAt = expiresAt;
            user.expiresAt = expiresAt;
        }

        await storage.setItem(toKey(pendingUser.handle), user);
        console.log(`Created new user via ${pendingUser.provider} OAuth with invitation code:`, pendingUser.handle);

        if (pendingUser.avatar) {
            await storage.setItem(toAvatarKey(pendingUser.handle), pendingUser.avatar);
        }

        await useInvitationCode(invitationCode, pendingUser.handle, userExpiresAt);

        console.info('Creating data directories for', pendingUser.handle);
        await ensurePublicDirectoriesExist();
        const directories = getUserDirectories(pendingUser.handle);
        for (const dir of Object.values(directories)) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
        await checkForNewContent([directories], [CONTENT_TYPES.SETTINGS]);
        applyDefaultTemplateToUser(directories, { userName: user.name });

        if (request.session) {
            delete request.session.oauthPendingUser;

            request.session.handle = user.handle;
            request.session.authenticated = true;
        }

        return response.json({ success: true, handle: user.handle });
    } catch (error) {
        console.error('Error verifying invitation code for OAuth:', error);
        return response.status(500).json({ error: 'Invitation code verification failed' });
    }
});
