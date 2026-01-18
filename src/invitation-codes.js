import storage from 'node-persist';
import crypto from 'node:crypto';
import { getConfigValue } from './util.js';

const INVITATION_PREFIX = 'invitation:';
const PURCHASE_LINK_KEY = 'invitation:purchaseLink';
const ENABLE_INVITATION_CODES = getConfigValue('enableInvitationCodes', false, 'boolean');




function toInvitationKey(code) {
    return `${INVITATION_PREFIX}${code}`;
}


function generateInvitationCode() {
    return crypto.randomBytes(8).toString('hex').toUpperCase();
}


function getDurationDays(durationType) {
    const durationMap = {
        '1day': 1,
        '1week': 7,
        '1month': 30,
        '1quarter': 90,
        '6months': 180,
        '1year': 365,
        'permanent': null,
    };
    return durationMap[durationType] ?? null;
}


export async function createInvitationCode(createdBy, durationType = 'permanent') {
    if (!ENABLE_INVITATION_CODES) {
        throw new Error('Invitation codes are not enabled');
    }

    const code = generateInvitationCode();
    const now = Date.now();
    const durationDays = getDurationDays(durationType);

    const invitation = {
        code,
        createdBy,
        createdAt: now,
        used: false,
        usedBy: null,
        usedAt: null,
        durationType: durationType || 'permanent',
        durationDays,
        userExpiresAt: null,
    };

    await storage.setItem(toInvitationKey(code), invitation);
    console.log(`Invitation code created: ${code} by ${createdBy}, duration: ${durationType}`);

    return invitation;
}


export async function validateInvitationCode(code) {
    if (!ENABLE_INVITATION_CODES) {
        return { valid: true };
    }

    if (!code || typeof code !== 'string') {
        return { valid: false, reason: 'Invitation code format is invalid' };
    }

    const invitation = await storage.getItem(toInvitationKey(code.toUpperCase()));

    if (!invitation) {
        return { valid: false, reason: 'Invitation code does not exist' };
    }

    if (invitation.used) {
        return { valid: false, reason: 'Invitation code has already been used' };
    }


    return { valid: true, invitation };
}


export async function useInvitationCode(code, usedBy, userExpiresAt = null) {
    if (!ENABLE_INVITATION_CODES) {
        return { success: true };
    }

    const validation = await validateInvitationCode(code);
    if (!validation.valid) {
        return { success: false };
    }

    const invitation = validation.invitation;
    if (!invitation) {
        return { success: false };
    }
    invitation.used = true;
    invitation.usedBy = usedBy;
    invitation.usedAt = Date.now();
    invitation.userExpiresAt = userExpiresAt;

    await storage.setItem(toInvitationKey(code.toUpperCase()), invitation);
    console.log(`Invitation code used: ${code} by ${usedBy}, duration: ${invitation.durationType}, user expires: ${userExpiresAt ? new Date(userExpiresAt).toLocaleString() : 'permanent'}`);

    return { success: true, invitation };
}


export async function getAllInvitationCodes() {
    if (!ENABLE_INVITATION_CODES) {
        return [];
    }

    const keys = await storage.keys();
    const invitationKeys = keys.filter(key => key.startsWith(INVITATION_PREFIX) && key !== PURCHASE_LINK_KEY);

    const invitations = [];
    for (const key of invitationKeys) {
        const invitation = await storage.getItem(key);
        if (invitation && invitation.code && typeof invitation.code === 'string') {
            invitations.push(invitation);
        } else if (invitation) {
            await storage.removeItem(key);
        }
    }

    return invitations.sort((a, b) => b.createdAt - a.createdAt);
}


export async function deleteInvitationCode(code) {
    if (!ENABLE_INVITATION_CODES) {
        return false;
    }

    const key = toInvitationKey(code.toUpperCase());
    const invitation = await storage.getItem(key);

    if (!invitation) {
        return false;
    }

    await storage.removeItem(key);
    console.log(`Invitation code deleted: ${code}`);

    return true;
}


export function isInvitationCodesEnabled() {
    return ENABLE_INVITATION_CODES;
}


export async function cleanupExpiredInvitationCodes() {
    if (!ENABLE_INVITATION_CODES) {
        return 0;
    }

    let cleanedCount = 0;

    /*
    const invitations = await getAllInvitationCodes();
    for (const invitation of invitations) {
        if (invitation.used) {
            await deleteInvitationCode(invitation.code);
            cleanedCount++;
        }
    }
    */

    if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} used invitation codes`);
    }

    return cleanedCount;
}


export async function setPurchaseLink(purchaseLink) {
    await storage.setItem(PURCHASE_LINK_KEY, purchaseLink || '');
    console.log('Purchase link updated:', purchaseLink || '(cleared)');
}


export async function getPurchaseLink() {
    const link = await storage.getItem(PURCHASE_LINK_KEY);
    return link || '';
}
