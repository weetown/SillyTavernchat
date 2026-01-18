/**
 * User heartbeat mechanism.
 * Periodically send heartbeat signals to keep online status accurate.
 */

class UserHeartbeat {
    constructor() {
        this.heartbeatInterval = null;
        this.isActive = false;
        this.lastActivity = Date.now();
        this.heartbeatIntervalMs = 2 * 60 * 1000; // 2 minutes (page visible).
        this.hiddenHeartbeatIntervalMs = 5 * 60 * 1000; // 5 minutes (page hidden).
        this.inactivityThreshold = 5 * 60 * 1000; // Pause after 5 minutes of inactivity.

        // Bind activity listeners.
        this.bindActivityListeners();

        // Bind visibility listeners.
        this.bindVisibilityListeners();

        // Bind page close listener.
        this.bindBeforeUnloadListener();
    }

    /**
     * Start heartbeat.
     */
    start() {
        if (this.heartbeatInterval) {
            // If already running, send a heartbeat immediately to refresh status.
            this.sendHeartbeat();
            return;
        }

        console.log('User heartbeat started');
        this.isActive = true;
        this.lastActivity = Date.now();

        // Send the first heartbeat quickly to refresh status (especially after reload).
        setTimeout(() => {
            this.sendHeartbeat();
        }, 500);

        // Schedule periodic heartbeat.
        this.scheduleHeartbeat();
    }

    /**
     * Schedule heartbeat based on page visibility.
     */
    scheduleHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        const interval = document.hidden ? this.hiddenHeartbeatIntervalMs : this.heartbeatIntervalMs;
        this.heartbeatInterval = setInterval(() => {
            this.checkAndSendHeartbeat();
        }, interval);
    }

    /**
     * Stop heartbeat.
     */
    stop() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('User heartbeat stopped');
        }
        this.isActive = false;
    }

    /**
     * Check whether a heartbeat should be sent.
     */
    checkAndSendHeartbeat() {
        const now = Date.now();
        const timeSinceLastActivity = now - this.lastActivity;

        // If inactive for too long, skip heartbeat (still send when hidden; user may just switch apps).
        if (!document.hidden && timeSinceLastActivity > this.inactivityThreshold) {
            console.log('User inactive, skipping heartbeat');
            return;
        }

        // When hidden, still send heartbeats at a lower frequency (handled in scheduleHeartbeat).
        // This ensures heartbeats keep going even if the page is force-closed.
        this.sendHeartbeat();
    }

    /**
     * Send heartbeat to server.
     */
    async sendHeartbeat() {
        try {
            const response = await fetch('/api/users/heartbeat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getRequestHeaders()
                },
                body: JSON.stringify({
                    timestamp: Date.now(),
                    userAgent: navigator.userAgent
                })
            });

            if (response.ok) {
                // Heartbeat sent successfully.
            } else if (response.status === 401 || response.status === 403) {
                // User not authenticated or unauthorized; stop heartbeat.
                console.log('User session ended, stopping heartbeat');
                this.stop();
            }
        } catch (error) {
            // Network error; continue trying.
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                // Network connection issue; pause heartbeat.
                this.stop();
            }
        }
    }

    /**
     * Build request headers.
     */
    getRequestHeaders() {
        // Prefer global getRequestHeaders if available.
        if (window.getRequestHeaders && typeof window.getRequestHeaders === 'function') {
            try {
                return window.getRequestHeaders();
            } catch (e) {
                // Fall back to manual headers.
            }
        }

        // Fallback: build headers manually.
        const headers = { 'Content-Type': 'application/json' };
        let csrfToken = null;

        // Try multiple ways to get a CSRF token.
        if (window.csrfToken) {
            csrfToken = window.csrfToken;
        } else if (window.token) {
            csrfToken = window.token;
        } else {
            // Get from meta tag.
            const metaTag = document.querySelector('meta[name="csrf-token"]');
            if (metaTag) {
                csrfToken = metaTag.getAttribute('content');
            }
        }

        if (csrfToken) {
            headers['x-csrf-token'] = csrfToken;
            headers['X-CSRF-Token'] = csrfToken;
        }

        return headers;
    }

    /**
     * Record user activity.
     */
    recordActivity() {
        this.lastActivity = Date.now();

        // Restart if heartbeat was stopped and activity resumes.
        if (!this.isActive && !this.heartbeatInterval) {
            this.start();
        }
    }

    /**
     * Bind user activity listeners.
     */
    bindActivityListeners() {
        const activityEvents = [
            'click', 'keydown', 'keyup', 'mousemove', 'mousedown',
            'mouseup', 'scroll', 'touchstart', 'touchend'
        ];

        // Throttle to avoid excessive activity recording.
        const throttledRecordActivity = this.throttle(() => {
            this.recordActivity();
        }, 1000); // At most once per second.

        activityEvents.forEach(event => {
            document.addEventListener(event, throttledRecordActivity, { passive: true });
        });
    }

    /**
     * Bind page visibility listeners.
     */
    bindVisibilityListeners() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Adjust frequency when hidden without stopping.
                this.scheduleHeartbeat();
            } else {
                // Restore activity when visible again.
                this.recordActivity();

                // Send a heartbeat immediately and adjust frequency when visible again.
                if (this.isActive) {
                    this.sendHeartbeat();
                    this.scheduleHeartbeat();
                } else {
                    // Restart if heartbeat was stopped.
                    this.start();
                }
            }
        });
    }

    /**
     * Bind page close listener.
     */
    bindBeforeUnloadListener() {
        window.addEventListener('beforeunload', () => {
            // Stop heartbeat on page close.
            this.stop();
        });
    }

    /**
     * Throttle helper.
     */
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Global heartbeat instance.
let userHeartbeat = null;

/**
 * Initialize user heartbeat.
 */
function initUserHeartbeat() {
    if (!userHeartbeat) {
        userHeartbeat = new UserHeartbeat();
    }
    return userHeartbeat;
}

/**
 * Start user heartbeat (only when logged in).
 */
function startUserHeartbeat() {
    // Check login status using multiple signals.
    const checkLoginStatus = () => {
        return (typeof window !== 'undefined' &&
            (window.currentUser ||
             document.querySelector('#logout_button') ||
             document.querySelector('#account_controls') ||
             document.querySelector('#admin_button')));
    };

    const attemptStart = (attempt = 1) => {
        const isLoggedIn = checkLoginStatus();

        if (isLoggedIn) {
            const heartbeat = initUserHeartbeat();
            heartbeat.start();
            // Send a heartbeat shortly after load to refresh status.
            setTimeout(() => {
                heartbeat.sendHeartbeat();
            }, 1000);
            return true;
        } else if (attempt < 5) {
            // Retry up to 5 times with increasing delay.
            setTimeout(() => attemptStart(attempt + 1), attempt * 1000);
        }
        return false;
    };

    attemptStart();
}

/**
 * Stop user heartbeat.
 */
function stopUserHeartbeat() {
    if (userHeartbeat) {
        userHeartbeat.stop();
    }
}

// Auto-start heartbeat after page load.
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Delay start to ensure other scripts and CSRF token are ready.
            setTimeout(startUserHeartbeat, 3000);
        });
    } else {
        // Page already loaded; delay longer to ensure initialization completes.
        setTimeout(startUserHeartbeat, 5000);
    }
}

// Export helpers for other scripts.
if (typeof window !== 'undefined') {
    window.userHeartbeat = {
        init: initUserHeartbeat,
        start: startUserHeartbeat,
        stop: stopUserHeartbeat,
        instance: () => userHeartbeat,
        forceStart: () => {
            console.log('Force starting user heartbeat...');
            const heartbeat = initUserHeartbeat();
            heartbeat.start();
            // Send a heartbeat immediately on force start.
            setTimeout(() => {
                heartbeat.sendHeartbeat();
            }, 500);
            return heartbeat;
        },
    };
}
