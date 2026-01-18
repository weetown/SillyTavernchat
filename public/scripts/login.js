import { initAccessibility } from './a11y.js';

/**
 * CRSF token for requests.
 */
let csrfToken = '';
let discreetLogin = false;

/**
 * Gets a CSRF token from the server.
 * @returns {Promise<string>} CSRF token
 */
async function getCsrfToken() {
    const response = await fetch('/csrf-token');
    const data = await response.json();
    return data.token;
}

/**
 * Gets a list of users from the server.
 * @returns {Promise<object>} List of users
 */
async function getUserList() {
    const response = await fetch('/api/users/list', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
    });

    if (!response.ok) {
        const errorData = await response.json();
        return displayError(errorData.error || 'An error occurred');
    }

    if (response.status === 204) {
        discreetLogin = true;
        return [];
    }

    const userListObj = await response.json();
    console.log(userListObj);
    return userListObj;
}

/**
 * Requests a recovery code for the user.
 * @param {string} handle User handle
 * @returns {Promise<void>}
 */
async function sendRecoveryPart1(handle) {
    const response = await fetch('/api/users/recover-step1', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ handle }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        return displayError(errorData.error || 'An error occurred');
    }

    const data = await response.json();
    showRecoveryBlock();

    // Show how the recovery code is delivered.
    if (data.method === 'email') {
        displayError(data.message || 'A password recovery code has been sent to your email.', true);
    } else {
        displayError(data.message || 'The recovery code has been printed to the server console. Contact an administrator to retrieve it.', true);
    }
}

/**
 * Sets a new password for the user using the recovery code.
 * @param {string} handle User handle
 * @param {string} code Recovery code
 * @param {string} newPassword New password
 * @returns {Promise<void>}
 */
async function sendRecoveryPart2(handle, code, newPassword) {
    const recoveryData = {
        handle,
        code,
        newPassword,
    };

    const response = await fetch('/api/users/recover-step2', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(recoveryData),
    });

    if (!response.ok) {
        const errorData = await response.json();
        return displayError(errorData.error || 'An error occurred');
    }

    console.log(`Successfully recovered password for ${handle}!`);
    await performLogin(handle, newPassword);
}

// Store current login attempt details (used for renewal).
let currentLoginAttempt = {
    handle: '',
    password: ''
};

// Logging-in flag to prevent duplicate submissions.
let isLoggingIn = false;

/**
 * Attempts to log in the user.
 * @param {string} handle User's handle
 * @param {string} password User's password
 * @returns {Promise<void>}
 */
async function performLogin(handle, password) {
    // Validate input.
    if (!handle || typeof handle !== 'string' || handle.trim() === '') {
        return displayError('Please enter a username.');
    }

    // Prevent duplicate login attempts.
    if (isLoggingIn) {
        return;
    }

    isLoggingIn = true;

    const userInfo = {
        handle: handle,
        password: password || '',
    };

    // Save login details (for renewal).
    currentLoginAttempt.handle = handle;
    currentLoginAttempt.password = password || '';

    try {
        const response = await fetch('/api/users/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify(userInfo),
        });

        if (!response.ok) {
            const errorData = await response.json();

            // If the account is expired, show the renewal modal.
            if (errorData.expired) {
                showRenewalBlock(errorData.purchaseLink);
                isLoggingIn = false;
                return;
            }

            let errorMessage = errorData.error || 'An error occurred';
            isLoggingIn = false;
            return displayError(errorMessage);
        }

        const data = await response.json();

        if (data.handle) {
            console.log(`Successfully logged in as ${handle}!`);
            // Login succeeded; do not reset the flag because we redirect.
            redirectToHome();
        } else {
            isLoggingIn = false;
        }
    } catch (error) {
        console.error('Error logging in:', error);
        isLoggingIn = false;
        displayError(String(error));
    }
}

/**
 * Handles the user selection event.
 * @param {object} user User object
 * @returns {Promise<void>}
 */
async function onUserSelected(user) {
    // No password, just log in
    if (!user.password) {
        return await performLogin(user.handle, '');
    }

    $('#passwordRecoveryBlock').hide();
    $('#passwordEntryBlock').show();
    $('#loginButton').off('click').on('click', async () => {
        const password = String($('#userPassword').val());
        await performLogin(user.handle, password);
    });

    $('#recoverPassword').off('click').on('click', async () => {
        await sendRecoveryPart1(user.handle);
    });

    $('#sendRecovery').off('click').on('click', async () => {
        const code = String($('#recoveryCode').val());
        const newPassword = String($('#newPassword').val());
        await sendRecoveryPart2(user.handle, code, newPassword);
    });

    displayError('');
}


/**
 * Redirects the user to the home page.
 * Preserves the query string.
 */
function redirectToHome() {
    // Create a URL object based on the current location
    const currentUrl = new URL(window.location.href);

    // After a login there's no need to preserve the
    // noauto parameter (if present)
    currentUrl.searchParams.delete('noauto');

    // Set the pathname to root and keep the updated query string
    currentUrl.pathname = '/';

    // Redirect to the new URL
    window.location.href = currentUrl.toString();
}

/**
 * Hides the password entry block and shows the password recovery block.
 */
function showRecoveryBlock() {
    $('#passwordEntryBlock').hide();
    $('#passwordRecoveryBlock').show();
    displayError('');
}

/**
 * Hides the password recovery block and shows the password entry block.
 */
function onCancelRecoveryClick() {
    $('#passwordRecoveryBlock').hide();
    $('#passwordEntryBlock').show();
    displayError('');
}


function onRegisterClick() {
    // Navigate to the registration page.
    window.location.href = '/register';
}
/**
 * Configures the login page for normal login.
 * @param {import('../../src/users').UserViewModel[]} userList List of users
 */
function configureNormalLogin(userList) {
    console.log('Discreet login is disabled');
    $('#handleEntryBlock').hide();
    $('#normalLoginPrompt').show();
    $('#discreetLoginPrompt').hide();
    console.log(userList);
    for (const user of userList) {
        const userBlock = $('<div></div>').addClass('userSelect');
        const avatarBlock = $('<div></div>').addClass('avatar');
        avatarBlock.append($('<img>').attr('src', user.avatar));
        userBlock.append(avatarBlock);
        userBlock.append($('<span></span>').addClass('userName').text(user.name));
        userBlock.append($('<small></small>').addClass('userHandle').text(user.handle));
        userBlock.on('click', () => onUserSelected(user));
        $('#userList').append(userBlock);
    }
}

/**
 * Configures the login page for discreet login.
 */
function configureDiscreetLogin() {
    console.log('Discreet login is enabled');
    $('#handleEntryBlock').show();
    $('#normalLoginPrompt').hide();
    $('#discreetLoginPrompt').show();
    $('#userList').hide();
    $('#passwordRecoveryBlock').hide();
    $('#passwordEntryBlock').show();
    $('#loginButton').off('click').on('click', async () => {
        const rawHandle = String($('#userHandle').val() || '').trim();

        if (!rawHandle) {
            displayError('Please enter a username.');
            return;
        }

        // Normalize the handle: letters, numbers, and hyphens.
        const handle = normalizeHandleFrontend(rawHandle);

        if (!handle) {
            displayError('Invalid username format. Use only letters, numbers, and hyphens.');
            return;
        }

        const password = String($('#userPassword').val() || '');
        await performLogin(handle, password);
    });

    $('#recoverPassword').off('click').on('click', async () => {
        const rawHandle = String($('#userHandle').val());
        // Normalize the handle.
        const handle = normalizeHandleFrontend(rawHandle);
        await sendRecoveryPart1(handle);
    });

    $('#sendRecovery').off('click').on('click', async () => {
        const rawHandle = String($('#userHandle').val());
        // Normalize the handle.
        const handle = normalizeHandleFrontend(rawHandle);
        const code = String($('#recoveryCode').val());
        const newPassword = String($('#newPassword').val());
        await sendRecoveryPart2(handle, code, newPassword);
    });
}

(async function () {
    initAccessibility();

    try {
        // Fetch the CSRF token first.
        csrfToken = await getCsrfToken();
    } catch (error) {
        console.error('Failed to get CSRF token:', error);
        displayError('Initialization failed. Please refresh and try again.');
        return;
    }

    const userList = await getUserList();

    if (discreetLogin) {
        configureDiscreetLogin();
    } else {
        configureNormalLogin(userList);
    }

    // Load OAuth config and show buttons.
    await loadOAuthConfig();

    // Check whether an OAuth invitation code is needed.
    await checkOAuthPendingInvitation();

    document.getElementById('shadow_popup').style.opacity = '';
    $('#cancelRecovery').on('click', onCancelRecoveryClick);
    $('#registerButton').on('click', onRegisterClick);
    $('#cancelRenewal').on('click', onCancelRenewalClick);
    $('#submitRenewal').on('click', onSubmitRenewalClick);

    // Check if there is an account expired notice.
    const accountExpired = sessionStorage.getItem('accountExpired');
    const expiredPurchaseLink = sessionStorage.getItem('expiredPurchaseLink');
    if (accountExpired === 'true') {
        // Clear sessionStorage.
        sessionStorage.removeItem('accountExpired');
        sessionStorage.removeItem('expiredMessage');
        sessionStorage.removeItem('expiredPurchaseLink');

        // Show the renewal modal directly.
        showRenewalBlock(expiredPurchaseLink);
    }

    // Load and show login announcements.
    await loadLoginAnnouncements();

    $(document).on('keydown', (evt) => {
        if (evt.key === 'Enter' && document.activeElement.tagName === 'INPUT') {
            // Prevent default behavior and duplicate submissions.
            evt.preventDefault();

            if ($('#passwordRecoveryBlock').is(':visible')) {
                $('#sendRecovery').trigger('click');
            } else if ($('#renewalBlock').is(':visible')) {
                $('#submitRenewal').trigger('click');
            } else if ($('#passwordEntryBlock').is(':visible') || $('#handleEntryBlock').is(':visible')) {
                $('#loginButton').trigger('click');
            }
        }
    });
})();

/**
 * Show the renewal modal.
 * @param {string} purchaseLink Purchase link
 */
function showRenewalBlock(purchaseLink) {
    // Hide other blocks.
    $('#userListBlock').hide();
    $('#passwordRecoveryBlock').hide();
    $('#errorMessage').hide();

    // Show the renewal block.
    $('#renewalBlock').show();

    // Show the purchase link (if available).
    if (purchaseLink) {
        $('#renewalPurchaseLink').show();
        $('#renewalPurchaseLinkUrl').text(purchaseLink).attr('href', purchaseLink);
    } else {
        $('#renewalPurchaseLink').hide();
    }

    // Clear inputs.
    $('#renewalCode').val('');

    // Focus the input.
    setTimeout(() => {
        $('#renewalCode').focus();
    }, 200);
}

/**
 * Cancel renewal and return to the login screen.
 */
function onCancelRenewalClick() {
    $('#renewalBlock').hide();
    $('#userListBlock').show();
    $('#errorMessage').hide();
}

/**
 * Submit the renewal request.
 */
async function onSubmitRenewalClick() {
    const renewalCode = String($('#renewalCode').val() || '').trim();

    if (!renewalCode) {
        displayError('Please enter a renewal code.');
        return;
    }

    if (!currentLoginAttempt.handle || !currentLoginAttempt.password) {
        displayError('Login details are missing. Please log in again.');
        onCancelRenewalClick();
        return;
    }

    try {
        const response = await fetch('/api/users/renew-expired', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify({
                handle: currentLoginAttempt.handle,
                password: currentLoginAttempt.password,
                invitationCode: renewalCode
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            displayError(errorData.error || 'Renewal failed.');
            return;
        }

        const data = await response.json();

        if (data.success) {
            displayError('Renewal successful! Logging you in...', true);
            // Auto-login after successful renewal.
            setTimeout(async () => {
                await performLogin(currentLoginAttempt.handle, currentLoginAttempt.password);
            }, 1000);
        }
    } catch (error) {
        console.error('Error renewing account:', error);
        displayError('Renewal failed: ' + String(error));
    }
}

/**
 * Show an error or success message.
 * @param {string} message Message text
 * @param {boolean} isSuccess Whether the message is a success message
 */
function displayError(message, isSuccess = false) {
    const errorBlock = $('#errorMessage');
    errorBlock.text(message);
    errorBlock.show();

    // Update styling for success messages.
    if (isSuccess) {
        errorBlock.css({
            'background': 'rgba(40, 167, 69, 0.2)',
            'border-color': 'rgba(40, 167, 69, 0.5)',
            'color': '#a8e6a1'
        });
    } else {
        errorBlock.css({
            'background': '',
            'border-color': '',
            'color': ''
        });
    }
}

/**
 * Fetch and display login announcements.
 */
async function loadLoginAnnouncements() {
    try {
        const response = await fetch('/api/announcements/login/current', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.error('Failed to load login announcements');
            return;
        }

        const announcements = await response.json();
        console.log('Login announcements loaded:', announcements);

        if (announcements && announcements.length > 0) {
            showLoginAnnouncements(announcements);
        }
    } catch (error) {
        console.error('Error loading login announcements:', error);
    }
}

/**
 * Render login announcements.
 * @param {Array} announcements Announcement list
 */
function showLoginAnnouncements(announcements) {
    const announcementArea = $('#loginAnnouncementArea');
    announcementArea.empty();

    if (!announcements || announcements.length === 0) {
        announcementArea.hide();
        return;
    }

    announcements.forEach(announcement => {
        const typeClass = announcement.type || 'info';
        const typeName = {
            info: 'Info',
            warning: 'Warning',
            success: 'Success',
            error: 'Error',
        }[typeClass] || 'Info';

        const createdDate = announcement.createdAt
            ? new Date(announcement.createdAt).toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })
            : '';

        const announcementHtml = `
            <div class="login-announcement-item">
                <div class="login-announcement-header">
                    <i class="fa-solid fa-bullhorn login-announcement-icon"></i>
                    <div class="login-announcement-title">${escapeHtml(announcement.title)}</div>
                    <span class="login-announcement-type-badge ${typeClass}">${typeName}</span>
                </div>
                <div class="login-announcement-content">${escapeHtml(announcement.content)}</div>
                ${createdDate ? `<div class="login-announcement-time"><i class="fa-solid fa-clock"></i><span>${createdDate}</span></div>` : ''}
            </div>
        `;
        announcementArea.append(announcementHtml);
    });

    announcementArea.show();
}

/**
 * Normalize handles on the frontend (keep in sync with backend).
 * @param {string} handle Raw handle
 * @returns {string} Normalized handle
 */
function normalizeHandleFrontend(handle) {
    if (!handle || typeof handle !== 'string') {
        return '';
    }

    return handle
        .toLowerCase()                    // Convert to lowercase.
        .trim()                           // Trim whitespace.
        .replace(/[^a-z0-9-]/g, '-')      // Replace non-alphanumerics with hyphens.
        .replace(/-+/g, '-')              // Collapse repeated hyphens.
        .replace(/^-+|-+$/g, '');         // Trim leading/trailing hyphens.
}

/**
 * Escape HTML to prevent XSS.
 * @param {string} text Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Load OAuth configuration and show login buttons.
 */
async function loadOAuthConfig() {
    try {
        const response = await fetch('/api/oauth/config', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.error('Failed to load OAuth config');
            return;
        }

        const config = await response.json();
        console.log('OAuth config loaded:', config);

        let hasOAuth = false;

        // Show GitHub login button.
        if (config.github?.enabled) {
            $('#githubLoginButton').show();
            $('#githubLoginButton').on('click', () => {
                window.location.href = '/api/oauth/github';
            });
            hasOAuth = true;
        }

        // Show Discord login button.
        if (config.discord?.enabled) {
            $('#discordLoginButton').show();
            $('#discordLoginButton').on('click', () => {
                window.location.href = '/api/oauth/discord';
            });
            hasOAuth = true;
        }

        // Show Linux.do login button.
        if (config.linuxdo?.enabled) {
            $('#linuxdoLoginButton').show();
            $('#linuxdoLoginButton').on('click', () => {
                window.location.href = '/api/oauth/linuxdo';
            });
            hasOAuth = true;
        }

        // If any OAuth option is available, show the divider and buttons.
        if (hasOAuth) {
            $('#oauthDivider').show();
            $('#oauthButtons').show();
        }
    } catch (error) {
        console.error('Error loading OAuth config:', error);
    }
}

/**
 * Check whether an invitation code is required (pending OAuth user).
 */
async function checkOAuthPendingInvitation() {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthPending = urlParams.get('oauth_pending');
    const error = urlParams.get('error');

    if (error) {
        displayError(decodeURIComponent(error));
        // Clear URL parameters.
        window.history.replaceState({}, document.title, '/login');
        return;
    }

    if (oauthPending === 'true') {
        // Show invitation code input.
        showOAuthInvitationPrompt();
    }
}

/**
 * Show the OAuth invitation code prompt.
 */
function showOAuthInvitationPrompt() {
    // Hide other blocks.
    $('#userListBlock').hide();
    $('#passwordRecoveryBlock').hide();
    $('#renewalBlock').hide();

    // Create invitation input UI.
    const invitationBlock = $(`
        <div id="oauthInvitationBlock" class="wide100p" style="display:block;">
            <div class="flex-container flexFlowColumn alignItemsCenter">
                <h3 style="margin-bottom: 10px;">
                    🎉 OAuth login successful
                </h3>
                <div style="text-align: center; margin-bottom: 20px; line-height: 1.6;">
                    Enter an invitation code to complete registration.
                </div>
                <input id="oauthInvitationCode" class="text_pole" type="text" placeholder="Enter invitation code" autocomplete="off" autofocus>
                <div class="flex-container flexGap10" style="margin-top: 20px;">
                    <div id="submitOAuthInvitation" class="menu_button">Submit</div>
                    <div id="cancelOAuthInvitation" class="menu_button">Cancel</div>
                </div>
            </div>
        </div>
    `);

    // Replace the user list block.
    $('#userListBlock').replaceWith(invitationBlock);

    // Bind events.
    $('#submitOAuthInvitation').on('click', submitOAuthInvitation);
    $('#cancelOAuthInvitation').on('click', () => {
        window.location.href = '/login';
    });

    // Submit on Enter.
    $('#oauthInvitationCode').on('keydown', (evt) => {
        if (evt.key === 'Enter') {
            evt.preventDefault();
            submitOAuthInvitation();
        }
    });
}

/**
 * Submit OAuth invitation code verification.
 */
async function submitOAuthInvitation() {
    const invitationCode = String($('#oauthInvitationCode').val() || '').trim();

    if (!invitationCode) {
        displayError('Please enter an invitation code.');
        return;
    }

    try {
        const response = await fetch('/api/oauth/verify-invitation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify({ invitationCode }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            displayError(errorData.error || 'Invitation code verification failed.');
            return;
        }

        const data = await response.json();
        if (data.success) {
            displayError('Registration complete! Logging you in...', true);
            setTimeout(() => {
                redirectToHome();
            }, 1000);
        }
    } catch (error) {
        console.error('Error submitting OAuth invitation code:', error);
        displayError('Invitation code verification failed: ' + String(error));
    }
}
