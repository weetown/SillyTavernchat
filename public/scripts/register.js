// Registration page JavaScript.
let regCsrfToken = '';

async function getCsrfToken() {
    try {
        const res = await fetch('/csrf-token', { method: 'GET', credentials: 'same-origin' });
        const data = await res.json();
        regCsrfToken = data.token || '';
    } catch (_) {
        // ignore; server may have CSRF disabled
        regCsrfToken = '';
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    const registerForm = /** @type {HTMLFormElement} */ (document.getElementById('registerForm'));
    const errorMessage = /** @type {HTMLElement} */ (document.getElementById('errorMessage'));
    const registerButton = /** @type {HTMLButtonElement} */ (document.getElementById('registerButton'));
    const backToLoginButton = /** @type {HTMLButtonElement} */ (document.getElementById('backToLoginButton'));
    const invitationSection = /** @type {HTMLElement} */ (document.getElementById('invitationSection'));
    const invitationCodeGroup = /** @type {HTMLElement} */ (document.getElementById('invitationCodeGroup'));

    const userHandleInput = /** @type {HTMLInputElement} */ (document.getElementById('userHandle'));
    const displayNameInput = /** @type {HTMLInputElement} */ (document.getElementById('displayName'));
    const userPasswordInput = /** @type {HTMLInputElement} */ (document.getElementById('userPassword'));
    const confirmPasswordInput = /** @type {HTMLInputElement} */ (document.getElementById('confirmPassword'));
    const userEmailInput = /** @type {HTMLInputElement} */ (document.getElementById('userEmail'));
    const verificationCodeInput = /** @type {HTMLInputElement} */ (document.getElementById('verificationCode'));
    const sendVerificationButton = /** @type {HTMLButtonElement} */ (document.getElementById('sendVerificationButton'));
    const invitationCodeInput = /** @type {HTMLInputElement} */ (document.getElementById('invitationCode'));

    let verificationCodeSent = false;
    let verificationCooldown = 0;
    let emailServiceEnabled = false;

    // Fetch CSRF token, then check invitation codes and email service status.
    await getCsrfToken();
    await checkEmailServiceStatus();
    await checkInvitationCodeStatus();

    // Back to login button.
    backToLoginButton.addEventListener('click', function() {
        window.location.href = '/login';
    });

    // Send verification code button.
    sendVerificationButton.addEventListener('click', async function() {
        const email = userEmailInput.value.trim();
        const userName = displayNameInput.value.trim() || userHandleInput.value.trim();

        if (!email) {
            showError('Please enter an email address.');
            return;
        }

        if (!userName) {
            showError('Please enter a display name or username first.');
            return;
        }

        // Validate email format.
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showError('Invalid email format.');
            return;
        }

        // Send verification code.
        await sendVerificationCodeToEmail(email, userName);
    });

    // Form submit handler.
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = {
            handle: userHandleInput.value.trim(),
            name: displayNameInput.value.trim(),
            password: userPasswordInput.value,
            confirmPassword: confirmPasswordInput.value,
            email: userEmailInput.value.trim(),
            verificationCode: verificationCodeInput.value.trim(),
            invitationCode: invitationCodeInput.value.trim()
        };

        // Basic validation.
        if (!validateForm(formData)) {
            return;
        }

        // Submit registration request.
        submitRegistration(formData);
    });

    // Live validation.
    userHandleInput.addEventListener('input', validateHandle);
    userPasswordInput.addEventListener('input', validatePassword);
    confirmPasswordInput.addEventListener('input', validateConfirmPassword);

    async function checkEmailServiceStatus() {
        try {
            const response = await fetch('/api/email/status', {
                method: 'GET',
                credentials: 'same-origin',
            });
            if (!response.ok) {
                emailServiceEnabled = false;
                return;
            }
            const data = await response.json();
            emailServiceEnabled = data.enabled || false;

            // Hide the email verification section if email service is disabled.
            const emailSection = document.getElementById('emailSection');

            if (!emailServiceEnabled) {
                if (emailSection) emailSection.style.display = 'none';
                userEmailInput.required = false;
                verificationCodeInput.required = false;
            } else {
                if (emailSection) emailSection.style.display = 'block';
                userEmailInput.required = true;
                verificationCodeInput.required = true;
            }
        } catch (error) {
            console.error('Error checking email service status:', error);
            emailServiceEnabled = false;
            // Hide the email verification section on error.
            const emailSection = document.getElementById('emailSection');
            if (emailSection) emailSection.style.display = 'none';
            userEmailInput.required = false;
            verificationCodeInput.required = false;
        }
    }

    async function checkInvitationCodeStatus() {
        try {
            const response = await fetch('/api/invitation-codes/status', {
                method: 'GET',
                headers: regCsrfToken ? { 'x-csrf-token': regCsrfToken } : {},
                credentials: 'same-origin',
            });
            if (!response.ok) {
                // Possibly blocked by middleware; exit without blocking registration.
                return;
            }
            const data = await response.json();
            if (data && data.enabled) {
                if (invitationSection) invitationSection.style.display = 'block';
                invitationCodeInput.required = true;
            }
        } catch (error) {
            console.error('Error checking invitation code status:', error);
        }
    }

    function validateForm(formData) {
        // Clear previous errors.
        hideError();

        // Check required fields.
        if (!formData.handle || !formData.name || !formData.password || !formData.confirmPassword) {
            showError('Please fill in all required fields.');
            return false;
        }

        // If email service is enabled, validate email and verification code.
        if (emailServiceEnabled) {
            if (!formData.email || !formData.verificationCode) {
                showError('Please enter both email and verification code.');
                return false;
            }

            // Validate email format.
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                showError('Invalid email format.');
                return false;
            }

            // Validate code format.
            if (!/^\d{6}$/.test(formData.verificationCode)) {
                showError('Invalid verification code format. It should be 6 digits.');
                return false;
            }
        }

        // Normalize the username: letters, numbers, and hyphens.
        const normalizedHandle = normalizeHandleFrontend(formData.handle);

        if (!normalizedHandle) {
            showError('Invalid username. Use only letters, numbers, and hyphens.');
            return false;
        }

        // Validate username format.
        if (!/^[a-z0-9-]+$/.test(normalizedHandle)) {
            showError('Username can only contain letters, numbers, and hyphens.');
            return false;
        }

        // Extra check for overly trivial usernames.
        if (isTrivialHandle(normalizedHandle)) {
            showError('Username is too simple or blocked. Please choose a more distinctive username.');
            return false;
        }

        // Validate password length.
        if (formData.password.length < 6) {
            showError('Password must be at least 6 characters.');
            return false;
        }

        // Confirm passwords match.
        if (formData.password !== formData.confirmPassword) {
            showError('Passwords do not match.');
            return false;
        }

        // If invitation is required, verify it is provided.
        const needsInvitation = invitationSection && invitationSection.style.display !== 'none';
        if (needsInvitation && !formData.invitationCode) {
            showError('Please enter an invitation code.');
            return false;
        }

        return true;
    }

    function validateHandle() {
        const handle = this.value.trim();
        const input = this;

        if (!handle) {
            input.classList.remove('valid', 'invalid');
            return;
        }

        // Normalize the username: letters, numbers, and hyphens.
        const normalizedHandle = normalizeHandleFrontend(handle);

        if (!normalizedHandle || !/^[a-z0-9-]+$/.test(normalizedHandle) || isTrivialHandle(normalizedHandle)) {
            input.classList.remove('valid');
            input.classList.add('invalid');
        } else {
            input.classList.remove('invalid');
            input.classList.add('valid');
        }
    }

    /**
     * Normalize handles on the frontend (keep in sync with backend).
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

    // Trivial/weak username check (kept in sync with backend).
    function isTrivialHandle(handle) {
        if (!handle) return true;
        const h = String(handle).toLowerCase().replace(/-/g, ''); // Check after removing hyphens.

        // Too short.
        if (h.length < 3) return true;

        if (/^\d{3,}$/.test(h)) return true; // All digits and length >= 3.
        if (/^(.)\1{2,}$/.test(h)) return true; // Same character repeated >= 3.
        const banned = new Set([
            '123', '1234', '12345', '123456', '000', '0000', '111', '1111',
            'qwe', 'qwer', 'qwert', 'qwerty', 'asdf', 'zxc', 'zxcv', 'zxcvb', 'qaz', 'qazwsx',
            'test', 'tester', 'testing', 'guest', 'user', 'username', 'admin', 'root', 'null', 'void',
            'abc', 'abcd', 'abcdef'
        ]);
        return banned.has(h);
    }

    function validatePassword() {
        const password = this.value;
        const input = this;

        if (!password) {
            input.classList.remove('valid', 'invalid');
            return;
        }

        if (password.length < 6) {
            input.classList.remove('valid');
            input.classList.add('invalid');
        } else {
            input.classList.remove('invalid');
            input.classList.add('valid');
        }

        // Validate confirmation at the same time.
        const confirmPassword = confirmPasswordInput;
        if (confirmPassword.value) {
            validateConfirmPassword.call(confirmPassword);
        }
    }

    function validateConfirmPassword() {
        const password = userPasswordInput.value;
        const confirmPassword = this.value;
        const input = this;

        if (!confirmPassword) {
            input.classList.remove('valid', 'invalid');
            return;
        }

        if (password !== confirmPassword) {
            input.classList.remove('valid');
            input.classList.add('invalid');
        } else {
            input.classList.remove('invalid');
            input.classList.add('valid');
        }
    }

    function submitRegistration(formData) {
        // Show loading state.
        setLoading(true);

        fetch('/api/users/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(regCsrfToken ? { 'x-csrf-token': regCsrfToken } : {}),
            },
            body: JSON.stringify(formData)
        })
        .then(async (response) => {
            // Read response text once.
            const text = await response.text();

            if (!response.ok) {
                // Try to parse JSON for error messages.
                try {
                    const data = JSON.parse(text);
                    throw new Error(data.error || 'Registration failed.');
                } catch (e) {
                    // If not JSON, use raw text.
                    throw new Error(text || 'Registration failed.');
                }
            }

            // Parse text as JSON on success too.
            try {
                return JSON.parse(text);
            } catch {
                return {};
            }
        })
        .then(data => {
            // Registration success: show message and redirect to login.
            const message = data.message || 'Registration successful! Redirecting to the login page...';
            showSuccess(message);

            // If the handle was normalized, log the normalized handle.
            if (data.message && (data.message.includes('normalized') || data.message.includes('\u89c4\u8303\u5316'))) {
                console.info('Username normalized to:', data.handle);
            }

            setTimeout(() => {
                window.location.href = '/login';
            }, 3000); // Delay to let the user read the message.
        })
        .catch(error => {
            console.error('Registration error:', error);
            showError(error.message || 'Registration failed. Please try again.');
        })
        .finally(() => {
            setLoading(false);
        });
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
        errorMessage.style.background = 'rgba(220, 53, 69, 0.1)';
        errorMessage.style.borderColor = 'rgba(220, 53, 69, 0.3)';
        errorMessage.style.color = '#721c24';
    }

    function showSuccess(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
        errorMessage.style.background = 'rgba(40, 167, 69, 0.1)';
        errorMessage.style.borderColor = 'rgba(40, 167, 69, 0.3)';
        errorMessage.style.color = '#155724';
    }

    function hideError() {
        errorMessage.classList.remove('show');
    }

    function setLoading(loading) {
        if (loading) {
            registerButton.classList.add('loading');
            registerButton.disabled = true;
            registerButton.textContent = 'Registering...';
        } else {
            registerButton.classList.remove('loading');
            registerButton.disabled = false;
            registerButton.textContent = 'Create account';
        }
    }

    async function sendVerificationCodeToEmail(email, userName) {
        if (verificationCooldown > 0) {
            showError(`Please wait ${verificationCooldown} seconds before resending.`);
            return;
        }

        // Disable button and show loading state.
        sendVerificationButton.disabled = true;
        sendVerificationButton.textContent = 'Sending...';

        try {
            const response = await fetch('/api/users/send-verification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(regCsrfToken ? { 'x-csrf-token': regCsrfToken } : {}),
                },
                body: JSON.stringify({ email, userName })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send verification code.');
            }

            verificationCodeSent = true;
            showSuccess('The verification code has been sent to your email.');

            // Start 60-second cooldown.
            verificationCooldown = 60;
            updateCooldownButton();

            const interval = setInterval(() => {
                verificationCooldown--;
                if (verificationCooldown <= 0) {
                    clearInterval(interval);
                    sendVerificationButton.disabled = false;
                    sendVerificationButton.textContent = 'Resend';
                } else {
                    updateCooldownButton();
                }
            }, 1000);

        } catch (error) {
            console.error('Send verification code error:', error);
            showError(error.message || 'Failed to send verification code. Please try again.');
            sendVerificationButton.disabled = false;
            sendVerificationButton.textContent = 'Send verification code';
        }
    }

    function updateCooldownButton() {
        sendVerificationButton.textContent = `Retry in ${verificationCooldown}s`;
    }
});
