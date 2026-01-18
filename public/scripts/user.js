import { getRequestHeaders } from '../script.js';
import { POPUP_RESULT, POPUP_TYPE, callGenericPopup } from './popup.js';
import { renderTemplateAsync } from './templates.js';
import { ensureImageFormatSupported, getBase64Async, humanFileSize } from './utils.js';

/**
 * @type {import('../../src/users.js').UserViewModel} Logged in user
 */
export let currentUser = null;
export let accountsEnabled = false;

// Extend the session every 10 minutes
const SESSION_EXTEND_INTERVAL = 10 * 60 * 1000;
const DEFAULT_INACTIVE_DAYS = 60;
const INACTIVE_USER_DAY_OPTIONS = [
    { label: '1 week (7 days)', value: 7 },
    { label: 'Half month (15 days)', value: 15 },
    { label: '1 month (30 days)', value: 30 },
    { label: '2 months (60 days)', value: 60 },
];

// Lightweight online presence indicator
// Note: window.isUserOnline and window.userHeartbeat are defined in user-heartbeat.js
window.isUserOnline = false;

/**
 * Enable or disable user account controls in the UI.
 * @param {boolean} isEnabled User account controls enabled
 * @returns {Promise<void>}
 */
export async function setUserControls(isEnabled) {
    accountsEnabled = isEnabled;

    if (!isEnabled) {
        $('#logout_button').hide();
        $('#admin_button').hide();
        return;
    }

    $('#logout_button').show();
    await getCurrentUser();
}

/**
 * Check if the current user is an admin.
 * @returns {boolean} True if the current user is an admin
 */
export function isAdmin() {
    if (!accountsEnabled) {
        return true;
    }

    if (!currentUser) {
        return false;
    }

    return Boolean(currentUser.admin);
}

/**
 * Gets the handle string of the current user.
 * @returns {string} User handle
 */
export function getCurrentUserHandle() {
    return currentUser?.handle || 'default-user';
}

/**
 * Get the current user.
 * @returns {Promise<void>}
 */
async function getCurrentUser() {
    try {
        const response = await fetch('/api/users/me', {
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to get current user');
        }

        currentUser = await response.json();
        $('#admin_button').toggle(accountsEnabled && isAdmin());

        // Start user heartbeat.
        if (typeof window.userHeartbeat !== 'undefined' && window.userHeartbeat.forceStart) {
            setTimeout(() => {
                // Check whether a CSRF token is available.
                const hasToken = window.token || window.csrfToken;
                if (hasToken) {
                    window.userHeartbeat.forceStart();
                    console.log('User heartbeat force started after getCurrentUser with token');
                } else {
                    console.warn('CSRF token not available, delaying heartbeat start');
                    // Delay once more.
                    setTimeout(() => {
                        window.userHeartbeat.forceStart();
                        console.log('User heartbeat force started after token delay');
                    }, 2000);
                }
            }, 1000);
        }


    } catch (error) {
        console.error('Error getting current user:', error);
    }
}

/**
 * Get a list of all users.
 * @param {boolean} includeStorageSize - Whether to include storage size info (default false for performance)
 * @returns {Promise<import('../../src/users.js').UserViewModel[]>} Users
 */
async function getUsers(includeStorageSize = false) {
    try {
        const response = await fetch('/api/users/get', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ includeStorageSize }),
        });

        if (!response.ok) {
            throw new Error('Failed to get users');
        }

        return response.json();
    } catch (error) {
        console.error('Error getting users:', error);
    }
}

/**
 * Fetch storage usage for multiple users.
 * @param {string[]} handles - User handles
 * @returns {Promise<Object.<string, {storageSize?: number, error?: string}>>} Storage size map
 */
async function getUsersStorageSize(handles) {
    try {
        const response = await fetch('/api/users/storage-size', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handles }),
        });

        if (!response.ok) {
            throw new Error('Failed to get users storage size');
        }

        return response.json();
    } catch (error) {
        console.error('Error getting users storage size:', error);
        return {};
    }
}

/**
 * Enable a user account.
 * @param {string} handle User handle
 * @param {function} callback Success callback
 * @returns {Promise<void>}
 */
async function enableUser(handle, callback) {
    try {
        const response = await fetch('/api/users/enable', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to enable user');
            throw new Error('Failed to enable user');
        }

        callback();
    } catch (error) {
        console.error('Error enabling user:', error);
    }
}

async function disableUser(handle, callback) {
    try {
        const response = await fetch('/api/users/disable', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data?.error || 'Unknown error', 'Failed to disable user');
            throw new Error('Failed to disable user');
        }

        callback();
    } catch (error) {
        console.error('Error disabling user:', error);
    }
}

/**
 * Promote a user to admin.
 * @param {string} handle User handle
 * @param {function} callback Success callback
 * @returns {Promise<void>}
 */
async function promoteUser(handle, callback) {
    try {
        const response = await fetch('/api/users/promote', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to promote user');
            throw new Error('Failed to promote user');
        }

        callback();
    } catch (error) {
        console.error('Error promoting user:', error);
    }
}

/**
 * Demote a user from admin.
 * @param {string} handle User handle
 * @param {function} callback Success callback
 */
async function demoteUser(handle, callback) {
    try {
        const response = await fetch('/api/users/demote', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to demote user');
            throw new Error('Failed to demote user');
        }

        callback();
    } catch (error) {
        console.error('Error demoting user:', error);
    }
}

/**
 * Create a new user.
 * @param {HTMLFormElement} form Form element
 */
async function createUser(form, callback) {
    const errors = [];
    const formData = new FormData(form);

    if (!formData.get('handle')) {
        errors.push('Handle is required');
    }

    if (formData.get('password') !== formData.get('confirm')) {
        errors.push('Passwords do not match');
    }

    if (errors.length) {
        toastr.error(errors.join(', '), 'Failed to create user');
        return;
    }

    const body = {};
    formData.forEach(function (value, key) {
        if (key === 'confirm') {
            return;
        }
        if (key.startsWith('_')) {
            key = key.substring(1);
        }
        body[key] = value;
    });

    try {
        const response = await fetch('/api/users/create', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to create user');
            throw new Error('Failed to create user');
        }

        form.reset();
        callback();
    } catch (error) {
        console.error('Error creating user:', error);
    }
}

/**
 * Backup a user's data.
 * @param {string} handle Handle of the user to backup
 * @param {function} callback Success callback
 * @returns {Promise<void>}
 */
async function backupUserData(handle, callback) {
    try {
        toastr.info('Please wait for the download to start.', 'Backup Requested');
        const response = await fetch('/api/users/backup', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to backup user data');
            throw new Error('Failed to backup user data');
        }

        const blob = await response.blob();
        const header = response.headers.get('Content-Disposition');
        const parts = header.split(';');
        const filename = parts[1].split('=')[1].replaceAll('"', '');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        callback();
    } catch (error) {
        console.error('Error backing up user data:', error);
    }
}

/**
 * Shows a popup to change a user's password.
 * @param {string} handle User handle
 * @param {function} callback Success callback
 */
async function changePassword(handle, callback) {
    try {
        await getCurrentUser();
        const template = $(await renderTemplateAsync('changePassword'));

        // If admin or user has no password (first-time OAuth password set), hide current password input.
        const hasPassword = currentUser && currentUser.password;
        const needOldPassword = !isAdmin() && hasPassword;
        template.find('.currentPasswordBlock').toggle(needOldPassword);

        // Show a hint when an OAuth user sets a password for the first time.
        if (!hasPassword && currentUser.oauthProvider) {
            const hint = $('<div class="oauth-password-hint" style="margin-bottom: 10px; padding: 10px; background: #e8f4f8; border-radius: 5px; font-size: 0.9em;">');
            hint.html(`<i class="fa-solid fa-info-circle"></i> You registered with <strong>${currentUser.oauthProvider}</strong> and currently have no password. After setting one, you can sign in with a username/password or continue using ${currentUser.oauthProvider}.`);
            template.prepend(hint);
        }

        let newPassword = '';
        let confirmPassword = '';
        let oldPassword = '';
        template.find('input[name="current"]').on('input', function () {
            oldPassword = String($(this).val());
        });
        template.find('input[name="password"]').on('input', function () {
            newPassword = String($(this).val());
        });
        template.find('input[name="confirm"]').on('input', function () {
            confirmPassword = String($(this).val());
        });
        const result = await callGenericPopup(template, POPUP_TYPE.CONFIRM, '', { okButton: 'Change', cancelButton: 'Cancel', wide: false, large: false });
        if (result === POPUP_RESULT.CANCELLED || result === POPUP_RESULT.NEGATIVE) {
            throw new Error('Change password cancelled');
        }

        if (newPassword !== confirmPassword) {
            toastr.error('Passwords do not match', 'Failed to change password');
            throw new Error('Passwords do not match');
        }

        const response = await fetch('/api/users/change-password', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle, newPassword, oldPassword }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to change password');
            throw new Error('Failed to change password');
        }

        if (!hasPassword) {
            toastr.success('Password set successfully. You can now sign in with a username and password.', 'Password Set');
        } else {
            toastr.success('Password changed successfully', 'Password Changed');
        }
        callback();
    }
    catch (error) {
        console.error('Error changing password:', error);
    }
}

/**
 * Clear backups for a user.
 * @param {string} handle User handle
 * @param {function} callback Success callback
 */
async function clearUserBackups(handle, callback) {
    try {
        const template = $(await renderTemplateAsync('clearUserBackups'));
        template.find('#clearUserName').text(handle);

        const result = await callGenericPopup(template, POPUP_TYPE.CONFIRM, '', { okButton: 'Clear', cancelButton: 'Cancel', wide: false, large: false });

        if (result !== POPUP_RESULT.AFFIRMATIVE) {
            throw new Error('Clear backups cancelled');
        }

        toastr.info('Clearing backup files, please wait...', 'Clearing');

        const response = await fetch('/api/users/clear-backups', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Clear failed');
            throw new Error('Failed to clear backups');
        }

        const data = await response.json();
        toastr.success(data.message, 'Cleared');
        callback();
    } catch (error) {
        console.error('Error clearing backups:', error);
    }
}

/**
 * Clear backups for all users.
 * @param {function} callback Success callback
 */
async function clearAllBackups(callback) {
    try {
        const confirm = await callGenericPopup(
            'Are you sure you want to clear backups for all users? This action cannot be undone.',
            POPUP_TYPE.CONFIRM,
            '',
            { okButton: 'Confirm clear', cancelButton: 'Cancel', wide: false, large: false },
        );

        if (confirm !== POPUP_RESULT.AFFIRMATIVE) {
            throw new Error('Clear all backups cancelled');
        }

        toastr.info('Clearing all user backups, please wait...', 'Clearing');

        const response = await fetch('/api/users/clear-all-backups', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Clear failed');
            throw new Error('Failed to clear all backups');
        }

        const data = await response.json();
        toastr.success(data.message, 'Cleared');
        callback();
    } catch (error) {
        console.error('Error clearing all backups:', error);
    }
}

function formatMaxStorageMiB(maxStorageMiB) {
    if (!Number.isFinite(maxStorageMiB)) {
        return null;
    }

    const rounded = Math.round(maxStorageMiB * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function buildInactiveUserFilterText(inactiveDays, maxStorageMiB) {
    const maxStorageLabel = formatMaxStorageMiB(maxStorageMiB);
    if (maxStorageLabel) {
        return `Inactive for over ${inactiveDays} days and storage usage under ${maxStorageLabel} MiB`;
    }

    return `Inactive for over ${inactiveDays} days`;
}

async function promptInactiveUserCleanupOptions() {
    const template = $(`
        <div class="flex-container flexFlowColumn flexGap10">
            <div class="flex-container flexFlowColumn flexGap5">
                <label>Inactive duration</label>
                <select class="text_pole inactiveUsersDaysSelect"></select>
            </div>
            <div class="flex-container flexFlowColumn flexGap5">
                <label>Max storage usage (MiB)</label>
                <input type="number" class="text_pole inactiveUsersMaxStorageInput" min="0" step="0.1" placeholder="e.g. 10">
                <small style="opacity: 0.8;">Leave blank or 0 for no limit</small>
            </div>
        </div>
    `);

    const select = template.find('.inactiveUsersDaysSelect');
    for (const option of INACTIVE_USER_DAY_OPTIONS) {
        select.append(`<option value="${option.value}">${option.label}</option>`);
    }
    select.val(String(DEFAULT_INACTIVE_DAYS));

    const result = await callGenericPopup(
        template,
        POPUP_TYPE.CONFIRM,
        'Choose deletion criteria',
        { okButton: 'Next', cancelButton: 'Cancel', wide: false, large: false },
    );

    if (result !== POPUP_RESULT.AFFIRMATIVE) {
        throw new Error('Delete inactive users cancelled');
    }

    const inactiveDays = Number.parseInt(String(select.val() ?? ''), 10) || DEFAULT_INACTIVE_DAYS;
    const maxStorageRaw = String(template.find('.inactiveUsersMaxStorageInput').val()).trim();
    const maxStorageMiBValue = Number.parseFloat(maxStorageRaw);
    const maxStorageMiB = Number.isFinite(maxStorageMiBValue) && maxStorageMiBValue > 0 ? maxStorageMiBValue : null;

    return { inactiveDays, maxStorageMiB };
}

/**
 * Delete inactive users who haven't logged in for a chosen time period.
 * @param {function} callback Success callback
 */
async function deleteInactiveUsers(callback) {
    try {
        const { inactiveDays, maxStorageMiB } = await promptInactiveUserCleanupOptions();
        const filterLabel = buildInactiveUserFilterText(inactiveDays, maxStorageMiB);

        // Step 1: preview users to delete.
        toastr.info('Scanning inactive users, please wait...', 'Scanning');

        const previewResponse = await fetch('/api/users/delete-inactive-users', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ dryRun: true, inactiveDays, maxStorageMiB }),
        });

        if (!previewResponse.ok) {
            const data = await previewResponse.json();
            toastr.error(data.error || 'Unknown error', 'Scan failed');
            throw new Error('Failed to preview inactive users');
        }

        const previewData = await previewResponse.json();

        if (previewData.totalUsers === 0) {
            toastr.info(`No users found for ${filterLabel}`, 'No cleanup needed');
            return;
        }

        // Build user list HTML.
        let userListHtml = '<div class="flex-container flexFlowColumn flexGap5" style="max-height: 800px; overflow-y: auto;">';
        userListHtml += '<p style="margin: 10px 0;">The following users will be deleted (including all data):</p>';
        userListHtml += `<p style="margin: 10px 0; font-size: 0.9em; opacity: 0.8;">Filter: ${filterLabel}</p>`;
        userListHtml += '<ul style="text-align: left; margin: 10px 0;">';

        for (const user of previewData.inactiveUsers) {
            const sizeLabel = humanFileSize(user.storageSize, false, 2);
            userListHtml += `<li style="margin: 5px 0; padding: 5px; background: rgba(255,0,0,0.1); border-radius: 3px;">`;
            userListHtml += `<strong>${user.name}</strong> (${user.handle})<br>`;
            userListHtml += `<small>Last login: ${user.lastActivityFormatted} (${user.daysSinceLastActivity} days ago)</small><br>`;
            userListHtml += `<small>Storage usage: ${sizeLabel}</small>`;
            userListHtml += `</li>`;
        }

        userListHtml += '</ul>';
        userListHtml += `<p style="margin: 10px 0; font-weight: bold; color: red;">`;
        userListHtml += `${previewData.totalUsers} users, total ${humanFileSize(previewData.totalSize, false, 2)}`;
        userListHtml += `</p>`;
        userListHtml += '<p style="margin: 10px 0; color: orange;"><strong>⚠️ Warning: this action cannot be undone.</strong></p>';
        userListHtml += '</div>';

        const confirmTemplate = $(userListHtml);

        const confirm = await callGenericPopup(
            confirmTemplate,
            POPUP_TYPE.CONFIRM,
            `Confirm deletion for users matching: ${filterLabel}`,
            { okButton: 'Confirm delete', cancelButton: 'Cancel', wide: true, large: false, allowVerticalScrolling: true },
        );

        if (confirm !== POPUP_RESULT.AFFIRMATIVE) {
            throw new Error('Delete inactive users cancelled');
        }

        // Step 2: delete after confirmation.
        toastr.info('Deleting inactive users, please wait...', 'Deleting');

        const deleteResponse = await fetch('/api/users/delete-inactive-users', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ dryRun: false, inactiveDays, maxStorageMiB }),
        });

        if (!deleteResponse.ok) {
            const data = await deleteResponse.json();
            toastr.error(data.error || 'Unknown error', 'Delete failed');
            throw new Error('Failed to delete inactive users');
        }

        const deleteData = await deleteResponse.json();

        // Show detailed results.
        let resultMessage = deleteData.message;
        if (deleteData.failedUsers && deleteData.failedUsers.length > 0) {
            resultMessage += `\nFailed to delete ${deleteData.failedUsers.length} users`;
        }

        toastr.success(resultMessage, 'Deletion complete');
        callback();
    } catch (error) {
        if (error.message !== 'Delete inactive users cancelled') {
            console.error('Error deleting inactive users:', error);
        }
    }
}

/**
 * Delete a user.
 * @param {string} handle User handle
 * @param {function} callback Success callback
 */
async function deleteUser(handle, callback) {
    try {
        if (handle === currentUser.handle) {
            toastr.error('Cannot delete yourself', 'Failed to delete user');
            throw new Error('Cannot delete yourself');
        }

        let purge = false;
        let confirmHandle = '';

        const template = $(await renderTemplateAsync('deleteUser'));
        template.find('#deleteUserName').text(handle);
        template.find('input[name="deleteUserData"]').on('input', function () {
            purge = $(this).is(':checked');
        });
        template.find('input[name="deleteUserHandle"]').on('input', function () {
            confirmHandle = String($(this).val());
        });

        const result = await callGenericPopup(template, POPUP_TYPE.CONFIRM, '', { okButton: 'Delete', cancelButton: 'Cancel', wide: false, large: false });

        if (result !== POPUP_RESULT.AFFIRMATIVE) {
            throw new Error('Delete user cancelled');
        }

        if (handle !== confirmHandle) {
            toastr.error('Handles do not match', 'Failed to delete user');
            throw new Error('Handles do not match');
        }

        const response = await fetch('/api/users/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle, purge }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to delete user');
            throw new Error('Failed to delete user');
        }

        toastr.success('User deleted successfully', 'User Deleted');
        callback();
    } catch (error) {
        console.error('Error deleting user:', error);
    }
}

/**
 * Reset a user's settings.
 * @param {string} handle User handle
 * @param {function} callback Success callback
 */
async function resetSettings(handle, callback) {
    try {
        let password = '';
        const template = $(await renderTemplateAsync('resetSettings'));
        template.find('input[name="password"]').on('input', function () {
            password = String($(this).val());
        });
        const result = await callGenericPopup(template, POPUP_TYPE.CONFIRM, '', { okButton: 'Reset', cancelButton: 'Cancel', wide: false, large: false });

        if (result !== POPUP_RESULT.AFFIRMATIVE) {
            throw new Error('Reset settings cancelled');
        }

        const response = await fetch('/api/users/reset-settings', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle, password }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to reset settings');
            throw new Error('Failed to reset settings');
        }

        toastr.success('Settings reset successfully', 'Settings Reset');
        callback();
    } catch (error) {
        console.error('Error resetting settings:', error);
    }
}

/**
 * Change a user's display name.
 * @param {string} handle User handle
 * @param {string} name Current name
 * @param {function} callback Success callback
 */
async function changeName(handle, name, callback) {
    try {
        const template = $(await renderTemplateAsync('changeName'));
        const result = await callGenericPopup(template, POPUP_TYPE.INPUT, name, { okButton: 'Change', cancelButton: 'Cancel', wide: false, large: false });

        if (!result) {
            throw new Error('Change name cancelled');
        }

        name = String(result);

        const response = await fetch('/api/users/change-name', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle, name }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to change name');
            throw new Error('Failed to change name');
        }

        toastr.success('Name changed successfully', 'Name Changed');
        callback();

    } catch (error) {
        console.error('Error changing name:', error);
    }
}

/**
 * Restore a settings snapshot.
 * @param {string} name Snapshot name
 * @param {function} callback Success callback
 */
async function restoreSnapshot(name, callback) {
    try {
        const confirm = await callGenericPopup(
            `Are you sure you want to restore the settings from "${name}"?`,
            POPUP_TYPE.CONFIRM,
            '',
            { okButton: 'Restore', cancelButton: 'Cancel', wide: false, large: false },
        );

        if (confirm !== POPUP_RESULT.AFFIRMATIVE) {
            throw new Error('Restore snapshot cancelled');
        }

        const response = await fetch('/api/settings/restore-snapshot', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ name }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to restore snapshot');
            throw new Error('Failed to restore snapshot');
        }

        callback();
    } catch (error) {
        console.error('Error restoring snapshot:', error);
    }

}

/**
 * Load the content of a settings snapshot.
 * @param {string} name Snapshot name
 * @returns {Promise<string>} Snapshot content
 */
async function loadSnapshotContent(name) {
    try {
        const response = await fetch('/api/settings/load-snapshot', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ name }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to load snapshot content');
            throw new Error('Failed to load snapshot content');
        }

        return response.text();
    } catch (error) {
        console.error('Error loading snapshot content:', error);
    }
}

/**
 * Gets a list of settings snapshots.
 * @returns {Promise<Snapshot[]>} List of snapshots
 * @typedef {Object} Snapshot
 * @property {string} name Snapshot name
 * @property {number} date Date in milliseconds
 * @property {number} size File size in bytes
 */
async function getSnapshots() {
    try {
        const response = await fetch('/api/settings/get-snapshots', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to get settings snapshots');
            throw new Error('Failed to get settings snapshots');
        }

        const snapshots = await response.json();
        return snapshots;
    } catch (error) {
        console.error('Error getting settings snapshots:', error);
        return [];
    }
}

/**
 * Make a snapshot of the current settings.
 * @param {function} callback Success callback
 * @returns {Promise<void>}
 */
async function makeSnapshot(callback) {
    try {
        const response = await fetch('/api/settings/make-snapshot', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to make snapshot');
            throw new Error('Failed to make snapshot');
        }

        toastr.success('Snapshot created successfully', 'Snapshot Created');
        callback();
    } catch (error) {
        console.error('Error making snapshot:', error);
    }
}

/**
 * Open the settings snapshots view.
 */
async function viewSettingsSnapshots() {
    const template = $(await renderTemplateAsync('snapshotsView'));
    async function renderSnapshots() {
        const snapshots = await getSnapshots();
        template.find('.snapshotList').empty();

        for (const snapshot of snapshots.sort((a, b) => b.date - a.date)) {
            const snapshotBlock = template.find('.snapshotTemplate .snapshot').clone();
            snapshotBlock.find('.snapshotName').text(snapshot.name);
            snapshotBlock.find('.snapshotDate').text(new Date(snapshot.date).toLocaleString());
            snapshotBlock.find('.snapshotSize').text(humanFileSize(snapshot.size));
            snapshotBlock.find('.snapshotRestoreButton').on('click', async (e) => {
                e.stopPropagation();
                restoreSnapshot(snapshot.name, () => location.reload());
            });
            snapshotBlock.find('.inline-drawer-toggle').on('click', async () => {
                const contentBlock = snapshotBlock.find('.snapshotContent');
                if (!contentBlock.val()) {
                    const content = await loadSnapshotContent(snapshot.name);
                    contentBlock.val(content);
                }

            });
            template.find('.snapshotList').append(snapshotBlock);
        }
    }

    callGenericPopup(template, POPUP_TYPE.TEXT, '', { okButton: 'Close', wide: false, large: false, allowVerticalScrolling: true });
    template.find('.makeSnapshotButton').on('click', () => makeSnapshot(renderSnapshots));
    renderSnapshots();
}

/**
 * Reset everything to default.
 * @param {function} callback Success callback
 */
async function resetEverything(callback) {
    try {
        const step1Response = await fetch('/api/users/reset-step1', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (!step1Response.ok) {
            const data = await step1Response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to reset');
            throw new Error('Failed to reset everything');
        }

        let password = '';
        let code = '';

        const template = $(await renderTemplateAsync('userReset'));
        template.find('input[name="password"]').on('input', function () {
            password = String($(this).val());
        });
        template.find('input[name="code"]').on('input', function () {
            code = String($(this).val());
        });
        const confirm = await callGenericPopup(
            template,
            POPUP_TYPE.CONFIRM,
            '',
            { okButton: 'Reset', cancelButton: 'Cancel', wide: false, large: false },
        );

        if (confirm !== POPUP_RESULT.AFFIRMATIVE) {
            throw new Error('Reset everything cancelled');
        }

        const step2Response = await fetch('/api/users/reset-step2', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ password, code }),
        });

        if (!step2Response.ok) {
            const data = await step2Response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to reset');
            throw new Error('Failed to reset everything');
        }

        toastr.success('Everything reset successfully', 'Reset Everything');
        callback();
    } catch (error) {
        console.error('Error resetting everything:', error);
    }

}

async function openUserProfile() {
    await getCurrentUser();

    const template = $(await renderTemplateAsync('userProfile'));
    template.find('.userName').text(currentUser.name);
    template.find('.userHandle').text(currentUser.handle);
    template.find('.avatar img').attr('src', currentUser.avatar);
    template.find('.userRole').text(currentUser.admin ? 'Admin' : 'User');
    template.find('.userCreated').text(new Date(currentUser.created).toLocaleString());
    template.find('.hasPassword').toggle(currentUser.password);
    template.find('.noPassword').toggle(!currentUser.password);

    // Show OAuth provider info.
    if (currentUser.oauthProvider) {
        const providerNames = {
            'github': 'GitHub',
            'discord': 'Discord',
            'linuxdo': 'Linux.do'
        };
        const providerName = providerNames[currentUser.oauthProvider] || currentUser.oauthProvider;
        template.find('.oauthProviderBlock').show();
        template.find('.oauthProvider').text(providerName);
    } else {
        template.find('.oauthProviderBlock').hide();
    }

    // Show email (empty if not set).
    const userEmail = currentUser.email || '';
    template.find('.userEmail').text(userEmail);

    // Show expiration date.
    if (currentUser.expiresAt) {
        const expiresDate = new Date(currentUser.expiresAt);
        const now = new Date();
        const daysLeft = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        let expiresText = expiresDate.toLocaleString();
        if (daysLeft > 0) {
            expiresText += ` (${daysLeft} days remaining)`;
        } else {
            expiresText += ' (expired)';
        }
        template.find('.userExpiresAt').text(expiresText);
        if (daysLeft <= 7 && daysLeft > 0) {
            template.find('.userExpiresAt').css('color', 'orange');
        } else if (daysLeft <= 0) {
            template.find('.userExpiresAt').css('color', 'red');
        }
    } else {
        template.find('.userExpiresAt').text('Permanent');
        template.find('.userExpiresAt').css('color', 'green');
    }

    template.find('.userSettingsSnapshotsButton').on('click', () => viewSettingsSnapshots());
    template.find('.userChangeNameButton').on('click', async () => changeName(currentUser.handle, currentUser.name, async () => {
        await getCurrentUser();
        template.find('.userName').text(currentUser.name);
    }));
    template.find('.userChangePasswordButton').on('click', () => changePassword(currentUser.handle, async () => {
        await getCurrentUser();
        template.find('.hasPassword').toggle(currentUser.password);
        template.find('.noPassword').toggle(!currentUser.password);
    }));

    // Renewal button.
    template.find('.userRenewButton').on('click', async () => {
        // Fetch purchase link.
        let purchaseLink = '';
        try {
            const linkResponse = await fetch('/api/invitation-codes/purchase-link', {
                method: 'GET',
                headers: getRequestHeaders()
            });
            if (linkResponse.ok) {
                const linkData = await linkResponse.json();
                purchaseLink = linkData.purchaseLink || '';
            }
        } catch (error) {
            console.error('Failed to fetch purchase link:', error);
        }

        // Build prompt message.
        let promptMessage = 'Enter a renewal code.';
        if (purchaseLink) {
            promptMessage = `Enter a renewal code.\n\nTo purchase a renewal code, visit:\n${purchaseLink}`;
        }

        const code = await callGenericPopup(promptMessage, POPUP_TYPE.INPUT, '', { okButton: 'Confirm', cancelButton: 'Cancel' });

        if (!code) {
            return;
        }

        try {
            const response = await fetch('/api/users/renew', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ invitationCode: code })
            });

            const data = await response.json();

            if (!response.ok) {
                toastr.error(data.error || 'Renewal failed', 'Error');
                return;
            }

            toastr.success(data.message || 'Renewal successful', 'Success');

            // Refresh user info.
            await getCurrentUser();
            if (currentUser.expiresAt) {
                const expiresDate = new Date(currentUser.expiresAt);
                const now = new Date();
                const daysLeft = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                let expiresText = expiresDate.toLocaleString();
                if (daysLeft > 0) {
                    expiresText += ` (${daysLeft} days remaining)`;
                }
                template.find('.userExpiresAt').text(expiresText);
                template.find('.userExpiresAt').css('color', daysLeft <= 7 ? 'orange' : '');
            } else {
                template.find('.userExpiresAt').text('Permanent');
                template.find('.userExpiresAt').css('color', 'green');
            }
        } catch (error) {
            console.error('Renewal error:', error);
            toastr.error('Renewal failed. Please try again.', 'Error');
        }
    });

    template.find('.userBackupButton').on('click', function () {
        $(this).addClass('disabled');
        backupUserData(currentUser.handle, () => {
            $(this).removeClass('disabled');
        });
    });
    template.find('.userResetSettingsButton').on('click', () => resetSettings(currentUser.handle, () => location.reload()));
    template.find('.userResetAllButton').on('click', () => resetEverything(() => location.reload()));
    template.find('.userAvatarChange').on('click', () => template.find('.avatarUpload').trigger('click'));
    template.find('.avatarUpload').on('change', async function () {
        if (!(this instanceof HTMLInputElement)) {
            return;
        }

        const file = this.files[0];
        if (!file) {
            return;
        }

        await cropAndUploadAvatar(currentUser.handle, file);
        await getCurrentUser();
        template.find('.avatar img').attr('src', currentUser.avatar);
    });
    template.find('.userAvatarRemove').on('click', async function () {
        await changeAvatar(currentUser.handle, '');
        await getCurrentUser();
        template.find('.avatar img').attr('src', currentUser.avatar);
    });

    if (!accountsEnabled) {
        template.find('[data-require-accounts]').hide();
        template.find('.accountsDisabledHint').show();
    }

    const popupOptions = {
        okButton: 'Close',
        wide: false,
        large: false,
        allowVerticalScrolling: true,
        allowHorizontalScrolling: false,
    };
    callGenericPopup(template, POPUP_TYPE.TEXT, '', popupOptions);
}

/**
 * Crop and upload an avatar image.
 * @param {string} handle User handle
 * @param {File} file Avatar file
 * @returns {Promise<string>}
 */
async function cropAndUploadAvatar(handle, file) {
    const dataUrl = await getBase64Async(await ensureImageFormatSupported(file));
    const croppedImage = await callGenericPopup('Set the crop position of the avatar image', POPUP_TYPE.CROP, '', { cropAspect: 1, cropImage: dataUrl });
    if (!croppedImage) {
        return;
    }

    await changeAvatar(handle, String(croppedImage));

    return String(croppedImage);
}

/**
 * Change the avatar of the user.
 * @param {string} handle User handle
 * @param {string} avatar File to upload or base64 string
 * @returns {Promise<void>} Avatar URL
 */
async function changeAvatar(handle, avatar) {
    try {
        const response = await fetch('/api/users/change-avatar', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ avatar, handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to change avatar');
            return;
        }
    } catch (error) {
        console.error('Error changing avatar:', error);
    }
}

async function openAdminPanel() {
    // User list pagination variables.
    let currentUserPage = 1;
    const usersPerPage = 20; // 20 users per page.
    let userSearchTerm = '';
    let allUsers = []; // Store all user data.

    async function renderUsers() {
        // Quickly load user list (without storage sizes).
        const users = await getUsers(false);
        allUsers = users; // Save user data.

        // Apply search filtering.
        let filteredUsers = users;
        if (userSearchTerm) {
            filteredUsers = users.filter(user =>
                user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                user.handle.toLowerCase().includes(userSearchTerm.toLowerCase())
            );
        }

        // Compute pagination.
        const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

        // If current page is out of range, adjust to the last page.
        if (currentUserPage > totalPages && totalPages > 0) {
            currentUserPage = totalPages;
        } else if (totalPages === 0) {
            currentUserPage = 1;
        }

        const startIndex = (currentUserPage - 1) * usersPerPage;
        const endIndex = startIndex + usersPerPage;
        const pageUsers = filteredUsers.slice(startIndex, endIndex);

        // Clear old user cards.
        template.find('.navTab.usersList .userAccount').remove();

        // Ensure user list container exists.
        let usersListContainer = template.find('.navTab.usersList .usersListContainer');
        if (usersListContainer.length === 0) {
            usersListContainer = $('<div class="usersListContainer"></div>');
            template.find('.navTab.usersList').append(usersListContainer);
        }

        // Store user blocks for later storage size updates.
        const userBlocks = new Map();

        // Add search box and stats (ensure inside navTab).
        let controlsHtml = template.find('.navTab.usersList .usersListControls');
        if (controlsHtml.length === 0) {
            controlsHtml = $(`
                <div class="usersListControls" style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding: 10px; background: var(--SmartThemeBlurTintColor); border-radius: 10px;">
                    <input type="text" id="userSearchInput" placeholder="Search username or handle..." value="" class="text_pole" style="flex: 1;">
                    <span class="userCount" style="white-space: nowrap; opacity: 0.7; font-size: 0.9em; padding: 5px 10px; background: var(--black30a); border-radius: 5px;"></span>
                </div>
            `);
            // Insert at the start of navTab.usersList (after existing buttons).
            const navTab = template.find('.navTab.usersList');
            const existingButtons = navTab.find('.flex-container.justifyCenter').first();
            if (existingButtons.length > 0) {
                existingButtons.after(controlsHtml);
            } else {
                navTab.prepend(controlsHtml);
            }
        }

        controlsHtml.find('#userSearchInput').val(userSearchTerm);
        controlsHtml.find('.userCount').text(`Showing ${startIndex + 1}-${Math.min(endIndex, filteredUsers.length)} / ${filteredUsers.length} users`);

        // Bind search with debounce.
        controlsHtml.find('#userSearchInput').off('input').on('input', debounceSearch(function() {
            userSearchTerm = String($(this).val() ?? '').trim();
            currentUserPage = 1; // Reset to first page.
            renderUsers();
        }, 300));

        // Show empty state when no users.
        if (filteredUsers.length === 0) {
            const emptyMessage = userSearchTerm
                ? `<div style="text-align: center; padding: 40px; opacity: 0.7;">No matching users found</div>`
                : `<div style="text-align: center; padding: 40px; opacity: 0.7;">No users available</div>`;
            usersListContainer.append(emptyMessage);
            return;
        }

        for (const user of pageUsers) {
            const userBlock = template.find('.userAccountTemplate .userAccount').clone();
            userBlock.find('.userName').text(user.name);
            userBlock.find('.userHandle').text(user.handle);
            const userEmail = user.email || '';
            userBlock.find('.userEmail').text(userEmail);
            userBlock.find('.userStatus').text(user.enabled ? 'Enabled' : 'Disabled');
            userBlock.find('.userRole').text(user.admin ? 'Admin' : 'User');
            userBlock.find('.avatar img').attr('src', user.avatar);
            userBlock.find('.hasPassword').toggle(user.password);
            userBlock.find('.noPassword').toggle(!user.password);
            userBlock.find('.userCreated').text(new Date(user.created).toLocaleString());

            // Show initial "Loading..."
            userBlock.find('.userStorageSize').text('Loading...');

            // Store userBlock reference.
            userBlocks.set(user.handle, userBlock);

            // Show expiration date.
            if (user.expiresAt) {
                const expiresDate = new Date(user.expiresAt);
                const now = new Date();
                const daysLeft = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                let expiresText = expiresDate.toLocaleString();
                if (daysLeft > 0) {
                    expiresText += ` (${daysLeft} days remaining)`;
                } else {
                    expiresText += ' (expired)';
                }
                userBlock.find('.userExpiresAt').text(expiresText);
                if (daysLeft <= 7 && daysLeft > 0) {
                    userBlock.find('.userExpiresAt').css('color', 'orange');
                } else if (daysLeft <= 0) {
                    userBlock.find('.userExpiresAt').css('color', 'red');
                }
            } else {
                userBlock.find('.userExpiresAt').text('Permanent');
                userBlock.find('.userExpiresAt').css('color', 'green');
            }

            userBlock.find('.userEnableButton').toggle(!user.enabled).on('click', () => enableUser(user.handle, renderUsers));
            userBlock.find('.userDisableButton').toggle(user.enabled).on('click', () => disableUser(user.handle, renderUsers));
            userBlock.find('.userPromoteButton').toggle(!user.admin).on('click', () => promoteUser(user.handle, renderUsers));
            userBlock.find('.userDemoteButton').toggle(user.admin).on('click', () => demoteUser(user.handle, renderUsers));
            userBlock.find('.userChangePasswordButton').on('click', () => changePassword(user.handle, renderUsers));
            userBlock.find('.userClearBackupsButton').on('click', () => clearUserBackups(user.handle, renderUsers));
            userBlock.find('.userDelete').on('click', () => deleteUser(user.handle, renderUsers));
            userBlock.find('.userChangeNameButton').on('click', async () => changeName(user.handle, user.name, renderUsers));
            userBlock.find('.userBackupButton').on('click', function () {
                $(this).addClass('disabled').off('click');
                backupUserData(user.handle, renderUsers);
            });
            userBlock.find('.userAvatarChange').on('click', () => userBlock.find('.avatarUpload').trigger('click'));
            userBlock.find('.avatarUpload').on('change', async function () {
                if (!(this instanceof HTMLInputElement)) {
                    return;
                }

                const file = this.files[0];
                if (!file) {
                    return;
                }

                await cropAndUploadAvatar(user.handle, file);
                renderUsers();
            });
            userBlock.find('.userAvatarRemove').on('click', async function () {
                await changeAvatar(user.handle, '');
                renderUsers();
            });
            usersListContainer.append(userBlock);
        }

        // Add bottom pagination controls inside .navTab.usersList.
        let paginationBottom = template.find('.navTab.usersList .usersPaginationBottom');
        if (paginationBottom.length === 0) {
            paginationBottom = $('<div class="usersPaginationBottom"></div>');
            template.find('.navTab.usersList').append(paginationBottom);
        }
        paginationBottom.html(createUserPaginationControls(currentUserPage, totalPages, filteredUsers.length));

        // Bind pagination button events.
        bindUserPaginationEvents();

        // Load storage sizes for the current page in batches.
        if (pageUsers.length > 0) {
            const userHandles = pageUsers.map(u => u.handle);

            // Batch requests to avoid timeouts (max 20 users per batch).
            const batchSize = 20;
            for (let i = 0; i < userHandles.length; i += batchSize) {
                const batch = userHandles.slice(i, i + batchSize);

                // Delay briefly to allow UI to render.
                if (i === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                try {
                    const storageSizes = await getUsersStorageSize(batch);

                    // Update UI.
                    for (const handle of batch) {
                        const userBlock = userBlocks.get(handle);
                        if (userBlock && storageSizes[handle]) {
                            if (storageSizes[handle].storageSize !== undefined) {
                                userBlock.find('.userStorageSize').text(humanFileSize(storageSizes[handle].storageSize));
                            } else if (storageSizes[handle].error) {
                                userBlock.find('.userStorageSize').text('Calculation failed');
                                userBlock.find('.userStorageSize').attr('title', storageSizes[handle].error);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error loading storage size for batch ${i / batchSize + 1}:`, error);
                    // Mark as failed if batch fails.
                    for (const handle of batch) {
                        const userBlock = userBlocks.get(handle);
                        if (userBlock) {
                            userBlock.find('.userStorageSize').text('Load failed');
                        }
                    }
                }
            }
        }
    }

    // Create pagination controls.
    function createUserPaginationControls(currentPage, totalPages, totalUsers) {
        if (totalPages <= 1) return '';

        let html = '<div class="userPaginationControls" style="display: flex; align-items: center; justify-content: center; gap: 10px; margin: 15px 0; flex-wrap: wrap;">';

        // Previous button.
        if (currentPage > 1) {
            html += `<button class="menu_button user-pagination-btn" data-page="${currentPage - 1}">
                <i class="fa-solid fa-chevron-left"></i> Previous
            </button>`;
        } else {
            html += `<button class="menu_button" disabled style="opacity: 0.5;">
                <i class="fa-solid fa-chevron-left"></i> Previous
            </button>`;
        }

        // Page buttons.
        const maxButtons = 7;
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);

        // Adjust start page.
        if (endPage - startPage < maxButtons - 1) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        // First page.
        if (startPage > 1) {
            html += `<button class="menu_button user-pagination-btn" data-page="1">1</button>`;
            if (startPage > 2) {
                html += `<span style="opacity: 0.5;">...</span>`;
            }
        }

        // Middle pages.
        for (let i = startPage; i <= endPage; i++) {
            if (i === currentPage) {
                html += `<button class="menu_button" disabled style="background: var(--SmartThemeBlurTintColor);">${i}</button>`;
            } else {
                html += `<button class="menu_button user-pagination-btn" data-page="${i}">${i}</button>`;
            }
        }

        // Last page.
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<span style="opacity: 0.5;">...</span>`;
            }
            html += `<button class="menu_button user-pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
        }

        // Next button.
        if (currentPage < totalPages) {
            html += `<button class="menu_button user-pagination-btn" data-page="${currentPage + 1}">
                Next <i class="fa-solid fa-chevron-right"></i>
            </button>`;
        } else {
            html += `<button class="menu_button" disabled style="opacity: 0.5;">
                Next <i class="fa-solid fa-chevron-right"></i>
            </button>`;
        }

        html += '</div>';
        return html;
    }

    // Bind pagination events.
    function bindUserPaginationEvents() {
        template.find('.user-pagination-btn').off('click').on('click', function() {
            currentUserPage = parseInt($(this).data('page'));
            renderUsers();

            // Scroll to top.
            const usersListControls = template.find('.usersListControls');
            if (usersListControls.length > 0) {
                usersListControls[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    // Debounce helper.
    function debounceSearch(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    const template = $(await renderTemplateAsync('admin'));

    template.find('.adminNav > button').on('click', function () {
        const target = String($(this).data('target-tab'));
        template.find('.navTab').each(function () {
            $(this).toggle(this.classList.contains(target));
        });
        // Initialize admin extensions.
        if (typeof window.initializeAdminExtensions === 'function') {
            setTimeout(() => {
                window.initializeAdminExtensions();
            }, 100);
        }
    });
// Initialize admin extensions when panel opens.
if (typeof window.initializeAdminExtensions === 'function') {
    setTimeout(() => {
        window.initializeAdminExtensions();
    }, 200);
}
    template.find('.createUserDisplayName').on('input', async function () {
        const slug = await slugify(String($(this).val()));
        template.find('.createUserHandle').val(slug);
    });

    template.find('.userCreateForm').on('submit', function (event) {
        if (!(event.target instanceof HTMLFormElement)) {
            return;
        }

        event.preventDefault();
        createUser(event.target, () => {
            template.find('.manageUsersButton').trigger('click');
            currentUserPage = 1; // Reset to first page to show new user.
            userSearchTerm = ''; // Clear search term.
            renderUsers();
        });
    });

    // Bind clear-all-backups button.
    template.find('.clearAllBackupsButton').on('click', () => clearAllBackups(renderUsers));

    // Bind delete-inactive-users button.
    template.find('.deleteInactiveUsersButton').on('click', () => deleteInactiveUsers(renderUsers));

    // Bind scheduled task buttons.
    initScheduledTasksHandlers(template);

    callGenericPopup(template, POPUP_TYPE.TEXT, '', { okButton: 'Close', wide: true, large: true, allowVerticalScrolling: true, allowHorizontalScrolling: true });

    renderUsers();
}

/**
 * Initialize scheduled task handlers.
 * @param {JQuery<HTMLElement>} template - Template jQuery object
 */
function initScheduledTasksHandlers(template) {
    const enabledCheckbox = template.find('#scheduledClearBackupsEnabled');
    const configDiv = template.find('#scheduledClearBackupsConfig');
    const cronInput = template.find('#scheduledClearBackupsCron');
    const saveButton = template.find('#saveScheduledClearBackups');
    const testButton = template.find('#testScheduledClearBackups');
    const loadButton = template.find('#loadScheduledClearBackups');
    const testCronButton = template.find('#testScheduledClearBackupsCron');
    const statusDiv = template.find('#scheduledClearBackupsStatus');

    // Toggle enabled/disabled state.
    enabledCheckbox.on('change', function() {
        if ($(this).is(':checked')) {
            configDiv.slideDown();
        } else {
            configDiv.slideUp();
        }
    });

    // Validate Cron expression.
    testCronButton.on('click', async function() {
        const cronExpression = String(cronInput.val() ?? '').trim();
        if (!cronExpression) {
            showScheduledTaskStatus(statusDiv, 'Please enter a Cron expression.', 'error');
            return;
        }

        try {
            // Basic regex validation (full validation happens server-side).
            const cronPattern = /^(\*|([0-9]|[1-5][0-9])|\*\/([0-9]|[1-5][0-9]))\s+(\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3]))\s+(\*|([1-9]|[12][0-9]|3[01])|\*\/([1-9]|[12][0-9]|3[01]))\s+(\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2]))\s+(\*|([0-6])|\*\/([0-6]))$/;
            if (cronPattern.test(cronExpression)) {
                showScheduledTaskStatus(statusDiv, 'Cron expression looks valid.', 'success');
            } else {
                showScheduledTaskStatus(statusDiv, 'Cron expression may be invalid. Please double-check.', 'warning');
            }
        } catch (error) {
            console.error('Error validating cron:', error);
            showScheduledTaskStatus(statusDiv, 'Validation failed: ' + error.message, 'error');
        }
    });

    // Save configuration.
    saveButton.on('click', async function() {
        const enabled = enabledCheckbox.is(':checked');
        const cronExpression = String(cronInput.val() ?? '').trim();

        if (enabled && !cronExpression) {
            showScheduledTaskStatus(statusDiv, 'Cron expression is required when enabling the schedule.', 'error');
            return;
        }

        const button = $(this);
        const originalText = button.html();
        button.prop('disabled', true);
        button.html('<i class="fa-fw fa-solid fa-spinner fa-spin"></i><span>Saving...</span>');

        try {
            const response = await fetch('/api/scheduled-tasks/config', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    enabled: enabled,
                    cronExpression: cronExpression,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save configuration.');
            }

            const data = await response.json();
            showScheduledTaskStatus(statusDiv, data.message || 'Configuration saved.', 'success');
            toastr.success(data.message || 'Scheduled task configuration saved.', 'Success');
        } catch (error) {
            console.error('Error saving scheduled task config:', error);
            showScheduledTaskStatus(statusDiv, 'Save failed: ' + error.message, 'error');
            toastr.error('Failed to save scheduled task configuration: ' + error.message, 'Error');
        } finally {
            button.prop('disabled', false);
            button.html(originalText);
        }
    });

    // Run immediately.
    testButton.on('click', async function() {
        if (!confirm('Run the clear-all-backups task now?')) {
            return;
        }

        const button = $(this);
        const originalText = button.html();
        button.prop('disabled', true);
        button.html('<i class="fa-fw fa-solid fa-spinner fa-spin"></i><span>Running...</span>');

        try {
            const response = await fetch('/api/scheduled-tasks/execute/clear-all-backups', {
                method: 'POST',
                headers: getRequestHeaders(),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Execution failed.');
            }

            const data = await response.json();
            showScheduledTaskStatus(statusDiv, data.message || 'Task started. Check server logs.', 'success');
            toastr.info(data.message || 'Cleanup task started. Check server logs for details.', 'Running');
        } catch (error) {
            console.error('Error executing scheduled task:', error);
            showScheduledTaskStatus(statusDiv, 'Execution failed: ' + error.message, 'error');
            toastr.error('Failed to run cleanup task: ' + error.message, 'Error');
        } finally {
            button.prop('disabled', false);
            button.html(originalText);
        }
    });

    // Load config.
    loadButton.on('click', loadScheduledTaskConfig);

    // Initial config load.
    loadScheduledTaskConfig();

    /**
     * Load scheduled task configuration.
     */
    async function loadScheduledTaskConfig() {
        try {
            const response = await fetch('/api/scheduled-tasks/config', {
                method: 'GET',
                headers: getRequestHeaders(),
            });

            if (!response.ok) {
                throw new Error('Failed to load configuration.');
            }

            const data = await response.json();
            const config = data.config || {};
            const status = data.status || {};

            // Update UI.
            enabledCheckbox.prop('checked', config.enabled || false);
            cronInput.val(config.cronExpression || '');

            if (config.enabled) {
                configDiv.show();
            } else {
                configDiv.hide();
            }

            // Show status.
            if (status.enabled && status.running) {
                showScheduledTaskStatus(statusDiv, `Scheduled task enabled and running (Cron: ${config.cronExpression})`, 'success');
            } else if (config.enabled) {
                showScheduledTaskStatus(statusDiv, 'Scheduled task configured but not running.', 'warning');
            } else {
                showScheduledTaskStatus(statusDiv, 'Scheduled task is disabled.', 'info');
            }
        } catch (error) {
            console.error('Error loading scheduled task config:', error);
            showScheduledTaskStatus(statusDiv, 'Failed to load configuration: ' + error.message, 'error');
        }
    }

    /**
     * Show scheduled task status.
     */
    function showScheduledTaskStatus(container, message, type) {
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8',
        };
        const bgColors = {
            success: '#d4edda',
            error: '#f8d7da',
            warning: '#fff3cd',
            info: '#d1ecf1',
        };

        container.css({
            'background-color': bgColors[type] || bgColors.info,
            'color': colors[type] || colors.info,
            'border': `1px solid ${colors[type] || colors.info}`,
            'padding': '10px',
            'border-radius': '5px',
            'margin-top': '10px',
        }).text(message).show();

        // Auto-hide after 3 seconds (except errors).
        if (type !== 'error') {
            setTimeout(() => {
                container.fadeOut();
            }, 3000);
        }
    }
}

/**
 * Log out the current user.
 * @returns {Promise<void>}
 */
async function logout() {
    try {
        // Stop heartbeat first to avoid sending during logout.
        if (typeof window.userHeartbeat !== 'undefined' && window.userHeartbeat.stop) {
            window.userHeartbeat.stop();
        }

        // Send logout request.
    await fetch('/api/users/logout', {
        method: 'POST',
        headers: getRequestHeaders(),
    });
} catch (error) {
    console.warn('Logout request failed:', error);
    // Redirect even if logout request fails.
}
    // On an explicit logout stop auto login
    // to allow user to change username even
    // when auto auth (such as authelia or basic)
    // would be valid
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('noauto', 'true');

    window.location.search = urlParams.toString();
}

/**
 * Runs a text through the slugify API endpoint.
 * @param {string} text Text to slugify
 * @returns {Promise<string>} Slugified text
 */
async function slugify(text) {
    try {
        const response = await fetch('/api/users/slugify', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            throw new Error('Failed to slugify text');
        }

        return response.text();
    } catch (error) {
        console.error('Error slugifying text:', error);
        return text;
    }
}

/**
 * Pings the server to extend the user session.
 */
async function extendUserSession() {
    try {
        const response = await fetch('/api/ping?extend=1', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            throw new Error('Ping did not succeed', { cause: response.status });
        }
    } catch (error) {
        console.error('Failed to extend user session', error);
    }
}

jQuery(() => {
    $('#logout_button').on('click', () => {
        logout();
    });
    $('#admin_button').on('click', () => {
        openAdminPanel();
    });
    $('#account_button').on('click', () => {
        openUserProfile();
    });
    setInterval(async () => {
        if (currentUser) {
            await extendUserSession();
        }
    }, SESSION_EXTEND_INTERVAL);
});
