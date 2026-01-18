// Announcement modal.
let announcementsChecked = false; // Prevent duplicate checks.

// Initialize announcement system.
function initializeAnnouncements() {
    // Return early if already checked.
    if (announcementsChecked) {
        return;
    }

    // Check login status before showing announcements.
    const checkUserAndAnnouncements = () => {
        // Check multiple login status signals.
        const isLoggedIn = document.querySelector('#logout_button') ||
                          document.querySelector('#account_controls') ||
                          window.currentUser;

        if (isLoggedIn) {
            announcementsChecked = true; // Mark as checked.
            checkDailyAnnouncements();
        } else {
            // Retry if user status is not ready yet.
            setTimeout(checkUserAndAnnouncements, 1000);
        }
    };

    // Check announcements after page load.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Delay to allow user status to load.
            setTimeout(checkUserAndAnnouncements, 1000);
        });
    } else {
        // Page already loaded; run soon.
        setTimeout(checkUserAndAnnouncements, 500);
    }
}

// Check and show announcements (every login).
async function checkDailyAnnouncements() {
    try {
        // Always fetch and show announcements.
        await fetchAndShowAnnouncements();
    } catch (error) {
        console.error('Error checking announcements:', error);
    }
}

// Fetch and show announcements.
async function fetchAndShowAnnouncements() {
    try {
        const response = await fetch('/api/announcements/current', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch announcements:', response.status);
            return;
        }

        const announcements = await response.json();

        // Filter enabled announcements only.
        const validAnnouncements = announcements.filter(announcement => {
            return announcement.enabled;
        });

        if (validAnnouncements.length > 0) {
            showAnnouncementsPopup(validAnnouncements);
        }
    } catch (error) {
        console.error('Error fetching announcements:', error);
    }
}

// Show announcement modal.
function showAnnouncementsPopup(announcements) {
    // Avoid showing multiple popups.
    const existingPopup = document.getElementById('announcementsPopup');
    if (existingPopup) {
        return;
    }

    // Create popup HTML.
    const popupHtml = createAnnouncementsPopupHtml(announcements);

    // Add to page.
    document.body.insertAdjacentHTML('beforeend', popupHtml);

    // Bind events.
    bindAnnouncementPopupEvents();

    // Show popup.
    const popup = document.getElementById('announcementsPopup');
    if (popup) {
        popup.style.display = 'flex';
        // Add animation.
        setTimeout(() => {
            popup.classList.add('show');
        }, 10);
    }
}

// Build announcement popup HTML.
function createAnnouncementsPopupHtml(announcements) {
    const announcementsHtml = announcements.map(announcement => `
        <div class="announcement-item">
            <div class="announcement-header">
                <h3 class="announcement-title">${escapeHtml(announcement.title)}</h3>
            </div>
            <div class="announcement-content">${escapeHtml(announcement.content).replace(/\n/g, '<br>')}</div>
            <div class="announcement-footer">
                <small class="announcement-time">
                    Published: ${new Date(announcement.createdAt).toLocaleString('en-US')}
                </small>
            </div>
        </div>
    `).join('');

    return `
        <div id="announcementsPopup" class="announcements-popup-overlay">
            <div class="announcements-popup">
                <div class="announcements-popup-header">
                    <h2><i class="fa-solid fa-bullhorn"></i> System announcements</h2>
                    <button type="button" class="announcements-close-btn" id="closeAnnouncementsPopup">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
                <div class="announcements-popup-content">
                    ${announcementsHtml}
                </div>
                <div class="announcements-popup-footer">
                    <button type="button" class="announcements-confirm-btn" id="confirmAnnouncementsPopup">
                        Got it
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Bind popup events.
function bindAnnouncementPopupEvents() {
    const popup = document.getElementById('announcementsPopup');
    const closeBtn = document.getElementById('closeAnnouncementsPopup');
    const confirmBtn = document.getElementById('confirmAnnouncementsPopup');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeAnnouncementsPopup);
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', closeAnnouncementsPopup);
    }

    // Close when clicking overlay.
    if (popup) {
        popup.addEventListener('click', function(e) {
            if (e.target === popup) {
                closeAnnouncementsPopup();
            }
        });
    }

    // Close on Escape.
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.getElementById('announcementsPopup')) {
            closeAnnouncementsPopup();
        }
    });
}

// Close announcement popup.
function closeAnnouncementsPopup() {
    const popup = document.getElementById('announcementsPopup');
    if (popup) {
        popup.classList.remove('show');
        setTimeout(() => {
            popup.remove();
        }, 300);
    }
}

// HTML escaping helper.
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// Export helpers to global scope.
if (typeof window !== 'undefined') {
    window.checkDailyAnnouncements = checkDailyAnnouncements;
    window.fetchAndShowAnnouncements = fetchAndShowAnnouncements;
}

// Auto-initialize.
initializeAnnouncements();
