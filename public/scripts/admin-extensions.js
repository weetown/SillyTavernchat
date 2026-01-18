// @ts-nocheck
let systemLoadInterval;
let systemLoadAutoPaused = false;
let currentSystemData = null;
let currentInvitationCodes = [];
let csrfToken = null;

function initializeAdminExtensions() {
    getCsrfToken().then(() => {
        bindTabEvents();

        bindSystemLoadEvents();

        bindInvitationCodeEvents();

        bindAnnouncementEvents();

        bindDefaultConfigEvents();

        initializeEmailConfig();

        checkAndLoadCurrentTab();
    });
}

function checkAndLoadCurrentTab() {
    setTimeout(() => {
        const systemLoadBlock = document.querySelector('.systemLoadBlock');
        if (systemLoadBlock && isElementVisible(systemLoadBlock)) {
            console.log('System load tab is visible, loading data...');
            loadSystemLoadData();
            startSystemLoadAutoRefresh();
        }

        const invitationCodesBlock = document.querySelector('.invitationCodesBlock');
        if (invitationCodesBlock && isElementVisible(invitationCodesBlock)) {
            console.log('Invitation codes tab is visible, loading data...');
            loadInvitationCodes();
        }

        const announcementsBlock = document.querySelector('.announcementsBlock');
        if (announcementsBlock && isElementVisible(announcementsBlock)) {
            console.log('Announcements tab is visible, loading data...');
            loadAnnouncements();
        }

        const defaultConfigBlock = document.querySelector('.defaultConfigBlock');
        if (defaultConfigBlock && isElementVisible(defaultConfigBlock)) {
            console.log('Default config tab is visible, loading data...');
            loadDefaultConfigStatus();
            loadDefaultConfigUsers();
        }
    }, 100);
}

function isElementVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none') return false;

    return element.offsetParent !== null;
}

function bindTabEvents() {
    const systemLoadButton = document.querySelector('.systemLoadButton');
    if (systemLoadButton) {
        systemLoadButton.addEventListener('click', function() {
            showSystemLoadTab();
        });
    }

    const invitationCodesButton = document.querySelector('.invitationCodesButton');
    if (invitationCodesButton) {
        invitationCodesButton.addEventListener('click', function() {
            showInvitationCodesTab();
        });
    }

    const announcementsButton = document.querySelector('.announcementsButton');
    if (announcementsButton) {
        announcementsButton.addEventListener('click', function() {
            showAnnouncementsTab();
        });
    }

    const emailConfigButton = document.querySelector('.emailConfigButton');
    if (emailConfigButton) {
        emailConfigButton.addEventListener('click', function() {
            showEmailConfigTab();
        });
    }

    const oauthConfigButton = document.querySelector('.oauthConfigButton');
    if (oauthConfigButton) {
        oauthConfigButton.addEventListener('click', function() {
            showOAuthConfigTab();
        });
    }

    const defaultConfigButton = document.querySelector('.defaultConfigButton');
    if (defaultConfigButton) {
        defaultConfigButton.addEventListener('click', function() {
            showDefaultConfigTab();
        });
    }
}

function showSystemLoadTab() {
    hideAllTabs();

    currentUserPage = 1;
    userSearchTerm = '';

    const systemLoadBlock = document.querySelector('.systemLoadBlock');
    if (systemLoadBlock) {
        systemLoadBlock.style.display = 'block';
        loadSystemLoadData();
        startSystemLoadAutoRefresh();
    }
}

function showInvitationCodesTab() {
    hideAllTabs();

    currentCodePage = 1;
    codeSearchTerm = '';

    const invitationCodesBlock = document.querySelector('.invitationCodesBlock');
    if (invitationCodesBlock) {
        invitationCodesBlock.style.display = 'block';
        loadInvitationCodes();
    }
}

function showAnnouncementsTab() {
    hideAllTabs();

    const announcementsBlock = document.querySelector('.announcementsBlock');
    if (announcementsBlock) {
        announcementsBlock.style.display = 'block';
        bindAnnouncementEvents();
        loadAnnouncements();
    }
}

function showEmailConfigTab() {
    hideAllTabs();

    const emailConfigBlock = document.querySelector('.emailConfigBlock');
    if (emailConfigBlock) {
        emailConfigBlock.style.display = 'block';
        loadEmailConfig();
    }
}

function hideAllTabs() {
    stopSystemLoadAutoRefresh();

    const tabs = document.querySelectorAll('.navTab');
    tabs.forEach(tab => {
        tab.style.display = 'none';
    });
}

function bindSystemLoadEvents() {
    const refreshButton = document.getElementById('refreshSystemLoad');
    if (refreshButton) {
        refreshButton.addEventListener('click', function() {
            loadSystemLoadData();
        });
    }

    const clearStatsButton = document.getElementById('clearSystemStats');
    if (clearStatsButton) {
        clearStatsButton.addEventListener('click', function() {
            clearSystemStats();
        });
    }

	const userActivityList = document.getElementById('userActivityList');
	if (userActivityList) {
		userActivityList.addEventListener('mouseenter', function() {
			pauseSystemLoadAutoRefresh();
		});
		userActivityList.addEventListener('mouseleave', function() {
			resumeSystemLoadAutoRefresh();
		});
	}

	document.addEventListener('visibilitychange', function() {
		if (document.hidden) {
			pauseSystemLoadAutoRefresh();
		} else {
			resumeSystemLoadAutoRefresh();
		}
	});
}

async function loadSystemLoadData() {
    try {
        showLoadingState('userActivityList');

        const response = await fetch('/api/system-load/', {
            method: 'GET',
            headers: getRequestHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load system data');
        }

        currentSystemData = await response.json();
        renderSystemLoadData();

    } catch (error) {
        console.error('Error loading system load data:', error);
        showErrorState('userActivityList', 'Failed to load system data');
    }
}

function renderSystemLoadData() {
    if (!currentSystemData) return;

    updateSystemOverview(currentSystemData.system);

    updateUserActivity(currentSystemData.users);
}

function updateSystemOverview(systemData) {
    const cpuUsage = document.getElementById('cpuUsage');
    const cpuProgress = document.getElementById('cpuProgress');
    if (cpuUsage && cpuProgress && systemData.cpu) {
        const cpuPercent = Math.round(systemData.cpu.percent || 0);
        cpuUsage.textContent = cpuPercent;
        cpuProgress.style.width = `${cpuPercent}%`;

        if (cpuPercent > 80) {
            cpuProgress.style.background = 'linear-gradient(90deg, #ff6b6b 0%, #ee5a24 100%)';
        } else if (cpuPercent > 60) {
            cpuProgress.style.background = 'linear-gradient(90deg, #feca57 0%, #ff9ff3 100%)';
        } else {
            cpuProgress.style.background = 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';
        }
    }

    const memoryUsage = document.getElementById('memoryUsage');
    const memoryProgress = document.getElementById('memoryProgress');
    if (memoryUsage && memoryProgress && systemData.memory) {
        const memoryPercent = Math.round(systemData.memory.percent || 0);
        memoryUsage.textContent = memoryPercent;
        memoryProgress.style.width = `${memoryPercent}%`;

        if (memoryPercent > 80) {
            memoryProgress.style.background = 'linear-gradient(90deg, #ff6b6b 0%, #ee5a24 100%)';
        } else if (memoryPercent > 60) {
            memoryProgress.style.background = 'linear-gradient(90deg, #feca57 0%, #ff9ff3 100%)';
        } else {
            memoryProgress.style.background = 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';
        }
    }

    const userSummary = getUserSummaryFromList(currentSystemData.users || []);
    const activeCount = typeof systemData?.activeUsers === 'number' ? systemData.activeUsers : userSummary.active;
    const onlineCount = typeof systemData?.onlineUsers === 'number' ? systemData.onlineUsers : userSummary.online;
    const totalUsers = typeof systemData?.totalTrackedUsers === 'number' ? systemData.totalTrackedUsers : userSummary.total;

    const activeUsers = document.getElementById('activeUsers');
    if (activeUsers) {
        activeUsers.textContent = activeCount;
    }

    const activeUsersSummary = document.getElementById('activeUsersSummary');
    if (activeUsersSummary) {
        if (totalUsers === 0) {
            activeUsersSummary.textContent = 'No users';
        } else {
            activeUsersSummary.textContent = `Online ${onlineCount} · Total ${totalUsers}`;
        }
    }

    const uptime = document.getElementById('uptime');
    if (uptime && systemData.uptime) {
        uptime.textContent = systemData.uptime.processFormatted || '--';
    }
}

let currentUserPage = 1;
const usersPerPage = 20;
let filteredUsers = [];
let userSearchTerm = '';

function getUserSummaryFromList(users) {
    if (!Array.isArray(users) || users.length === 0) {
        return { total: 0, online: 0, active: 0 };
    }

    const now = Date.now();
    const activeThreshold = 10 * 60 * 1000;
    const heartbeatTimeout = 5 * 60 * 1000;
    const inactiveTimeout = 15 * 60 * 1000;

    let active = 0;
    let online = 0;

    users.forEach(user => {
        if (!user) {
            return;
        }

        const lastActivity = user.lastActivity || 0;
        const lastHeartbeat = user.lastHeartbeat || 0;
        const timeSinceLastActivity = now - lastActivity;
        const timeSinceLastHeartbeat = lastHeartbeat ? now - lastHeartbeat : null;

        if (timeSinceLastActivity <= activeThreshold) {
            active++;
        }

        const heartbeatValid = timeSinceLastHeartbeat !== null && timeSinceLastHeartbeat <= heartbeatTimeout;
        const activityValid = timeSinceLastActivity <= inactiveTimeout;
        if (user.isOnline && (heartbeatValid || activityValid)) {
            online++;
        }
    });

    return {
        total: users.length,
        active,
        online,
    };
}

function updateUserActivity(usersData) {
    const userActivityList = document.getElementById('userActivityList');
    if (!userActivityList) return;

    if (!usersData || usersData.length === 0) {
        userActivityList.innerHTML = createEmptyState('fa-users', 'No user data', 'No user statistics available');
        return;
    }

    filteredUsers = userSearchTerm ? usersData.filter(user =>
        (user.userName && user.userName.toLowerCase().includes(userSearchTerm.toLowerCase())) ||
        (user.userHandle && user.userHandle.toLowerCase().includes(userSearchTerm.toLowerCase()))
    ) : usersData;

    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    const startIndex = (currentUserPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    const pageUsers = filteredUsers.slice(startIndex, endIndex);

    const userActivityHtml = pageUsers.map(user => createUserActivityItem(user)).join('');

    const paginationHtml = createPaginationControls(currentUserPage, totalPages, filteredUsers.length);

    userActivityList.innerHTML = `
        <div class="userActivityControls">
            <input type="text" id="userSearchInput" placeholder="Search username or handle..."
                   value="${userSearchTerm}" class="text_pole" style="flex: 1; margin-right: 10px;">
            <span class="userCount" style="white-space: nowrap; opacity: 0.7;">
                Showing ${startIndex + 1}-${Math.min(endIndex, filteredUsers.length)} / ${filteredUsers.length} users
            </span>
        </div>
        ${paginationHtml}
        <div class="userActivityListContent">${userActivityHtml}</div>
        ${paginationHtml}
    `;

    const searchInput = document.getElementById('userSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounceSearch(function(e) {
            userSearchTerm = e.target.value.trim();
            currentUserPage = 1;
            updateUserActivity(currentSystemData.users);
        }, 300));
    }

    bindPaginationEvents();
}

function createPaginationControls(currentPage, totalPages, totalUsers) {
    if (totalPages <= 1) return '';

    let html = '<div class="paginationControls" style="display: flex; align-items: center; justify-content: center; gap: 10px; margin: 15px 0;">';

    if (currentPage > 1) {
        html += `<button class="menu_button pagination-btn" data-page="${currentPage - 1}">
            <i class="fa-solid fa-chevron-left"></i> Previous
        </button>`;
    } else {
        html += `<button class="menu_button" disabled style="opacity: 0.5;">
            <i class="fa-solid fa-chevron-left"></i> Previous
        </button>`;
    }

    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    if (startPage > 1) {
        html += `<button class="menu_button pagination-btn" data-page="1">1</button>`;
        if (startPage > 2) {
            html += `<span style="opacity: 0.5;">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<button class="menu_button" disabled style="background: var(--SmartThemeBlurTintColor);">${i}</button>`;
        } else {
            html += `<button class="menu_button pagination-btn" data-page="${i}">${i}</button>`;
        }
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span style="opacity: 0.5;">...</span>`;
        }
        html += `<button class="menu_button pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    if (currentPage < totalPages) {
        html += `<button class="menu_button pagination-btn" data-page="${currentPage + 1}">
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

function bindPaginationEvents() {
    const paginationBtns = document.querySelectorAll('.pagination-btn');
    paginationBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            currentUserPage = parseInt(this.dataset.page);
            updateUserActivity(currentSystemData.users);

            const userActivityList = document.getElementById('userActivityList');
            if (userActivityList) {
                userActivityList.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

function debounceSearch(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function createUserActivityItem(user) {
    const onlineStatus = user.onlineStatusText || (user.isOnline ? 'Online' : 'Offline');
    let statusColor = '#95a5a6';

    if (user.isOnline) {
        if (user.onlineStatusText === 'Online') {
            statusColor = '#27ae60';
        } else if (user.onlineStatusText === 'Possibly offline') {
            statusColor = '#f39c12';
        } else {
            statusColor = '#3498db';
        }
    }

    return `
        <div class="userActivityItem">
            <div class="userActivityInfo">
                <div class="userActivityName">${escapeHtml(user.userName || user.userHandle)}</div>
                <div class="userActivityHandle">
                    <span style="color: ${statusColor}; font-weight: bold;">${onlineStatus}</span>
                    <span style="color: #666; margin-left: 10px;">${user.userHandle}</span>
                </div>
                <div class="userActivityDetails">
                    <div class="userActivityDetail">Last chat: ${user.lastChatTimeFormatted}</div>
                    <div class="userActivityDetail">Last session: ${user.lastSessionTimeFormatted}</div>
                    ${user.onlineDurationFormatted ? `<div class="userActivityDetail">Online duration: ${user.onlineDurationFormatted}</div>` : ''}
                    ${user.lastHeartbeatFormatted && user.lastHeartbeatFormatted !== 'None' ? `<div class="userActivityDetail">Last heartbeat: ${user.lastHeartbeatFormatted}</div>` : ''}
                </div>
            </div>
            <div class="userActivityStats">
                <div class="userActivityStat">
                    <div class="userActivityStatValue">${user.totalMessages || 0}</div>
                    <div class="userActivityStatLabel">Total messages</div>
                </div>
                <div class="userActivityStat">
                    <div class="userActivityStatValue">${user.todayMessages || 0}</div>
                    <div class="userActivityStatLabel">Messages today</div>
                </div>
                <div class="userActivityStat">
                    <div class="userActivityStatValue">${user.sessionCount || 0}</div>
                    <div class="userActivityStatLabel">Sessions</div>
                </div>
            </div>
        </div>
    `;
}

function getActivityLevelText(level) {
    const levelMap = {
        'very_high': 'Very active',
        'high': 'Highly active',
        'medium': 'Moderately active',
        'low': 'Low activity',
        'minimal': 'Minimal activity'
    };
    return levelMap[level] || 'Unknown';
}

function getActivityLevelColor(level) {
    const colorMap = {
        'very_high': '#e74c3c',
        'high': '#e67e22',
        'medium': '#f39c12',
        'low': '#27ae60',
        'minimal': '#95a5a6'
    };
    return colorMap[level] || '#666';
}

function startSystemLoadAutoRefresh() {
    stopSystemLoadAutoRefresh();
    systemLoadInterval = setInterval(() => {
        if (!systemLoadAutoPaused) {
            loadSystemLoadData();
        }
    }, 60000);
}

function stopSystemLoadAutoRefresh() {
    if (systemLoadInterval) {
        clearInterval(systemLoadInterval);
        systemLoadInterval = null;
    }
}

function pauseSystemLoadAutoRefresh() {
    systemLoadAutoPaused = true;
}

function resumeSystemLoadAutoRefresh() {
    systemLoadAutoPaused = false;
}

async function clearSystemStats() {
    if (!confirm('Are you sure you want to clear all system statistics? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch('/api/system-load/clear', {
            method: 'POST',
            headers: getRequestHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to clear system stats');
        }

        alert('System statistics cleared.');
        loadSystemLoadData();

    } catch (error) {
        console.error('Error clearing system stats:', error);
        alert('Failed to clear system statistics.');
    }
}

let currentCodePage = 1;
const codesPerPage = 50;
let codeSearchTerm = '';

function bindInvitationCodeEvents() {
    bindPurchaseLinkForm();

    loadPurchaseLink();

    bindCreationModeToggle();

    const createInvitationForm = document.querySelector('.createInvitationForm');
    if (createInvitationForm) {
        const newForm = createInvitationForm.cloneNode(true);
        createInvitationForm.parentNode.replaceChild(newForm, createInvitationForm);

        newForm.addEventListener('submit', function(e) {
            e.preventDefault();
            createInvitationCode();
        });
    }

    const createBatchInvitationForm = document.querySelector('.createBatchInvitationForm');
    if (createBatchInvitationForm) {
        const newBatchForm = createBatchInvitationForm.cloneNode(true);
        createBatchInvitationForm.parentNode.replaceChild(newBatchForm, createBatchInvitationForm);

        newBatchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            createBatchInvitationCodes();
        });
    }

    const refreshInvitationCodes = document.getElementById('refreshInvitationCodes');
    if (refreshInvitationCodes) {
        refreshInvitationCodes.addEventListener('click', function() {
            loadInvitationCodes();
        });
    }

    const cleanupExpiredCodes = document.getElementById('cleanupExpiredCodes');
    if (cleanupExpiredCodes) {
        cleanupExpiredCodes.addEventListener('click', function() {
            cleanupExpiredInvitationCodes();
        });
    }

    const typeFilter = document.getElementById('invitationTypeFilter');
    const statusFilter = document.getElementById('invitationStatusFilter');
    if (typeFilter) {
        typeFilter.addEventListener('change', function() {
            renderInvitationCodes();
        });
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            renderInvitationCodes();
        });
    }

    bindBatchOperationEvents();
}

function bindPurchaseLinkForm() {
    const purchaseLinkForm = document.querySelector('.purchaseLinkForm');
    if (purchaseLinkForm) {
        const newForm = purchaseLinkForm.cloneNode(true);
        purchaseLinkForm.parentNode.replaceChild(newForm, purchaseLinkForm);

        newForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await savePurchaseLink();
        });
    }
}

async function loadPurchaseLink() {
    try {
        const response = await fetch('/api/invitation-codes/purchase-link', {
            method: 'GET',
            headers: getRequestHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            const input = document.getElementById('purchaseLinkInput');
            if (input) {
                input.value = data.purchaseLink || '';
            }
        }
    } catch (error) {
        console.error('Error loading purchase link:', error);
    }
}

async function savePurchaseLink() {
    const input = document.getElementById('purchaseLinkInput');
    const statusDiv = document.querySelector('.purchaseLinkStatus');

    if (!input || !statusDiv) return;

    const purchaseLink = input.value.trim();

    try {
        const response = await fetch('/api/invitation-codes/purchase-link', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ purchaseLink })
        });

        if (!response.ok) {
            throw new Error('Save failed');
        }

        statusDiv.textContent = '✓ Purchase link saved';
        statusDiv.style.color = 'green';
        statusDiv.style.display = 'block';

        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    } catch (error) {
        console.error('Error saving purchase link:', error);
        statusDiv.textContent = '✗ Save failed：' + error.message;
        statusDiv.style.color = 'red';
        statusDiv.style.display = 'block';
    }
}

function bindCreationModeToggle() {
    const toggleButtons = document.querySelectorAll('.creation-toggle-btn');
    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const mode = this.dataset.mode;
            switchCreationMode(mode);
        });
    });
}

function switchCreationMode(mode) {
    const toggleButtons = document.querySelectorAll('.creation-toggle-btn');
    toggleButtons.forEach(btn => {
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const singleMode = document.getElementById('singleCreationMode');
    const batchMode = document.getElementById('batchCreationMode');

    if (mode === 'single') {
        singleMode.style.display = 'block';
        batchMode.style.display = 'none';
    } else {
        singleMode.style.display = 'none';
        batchMode.style.display = 'block';
    }
}

function bindBatchOperationEvents() {
    const selectAllBtn = document.getElementById('selectAllCodes');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', toggleSelectAll);
    }

    const downloadSelectedBtn = document.getElementById('downloadSelectedCodes');
    if (downloadSelectedBtn) {
        downloadSelectedBtn.addEventListener('click', downloadSelectedCodes);
    }

    const downloadAllBtn = document.getElementById('downloadAllCodes');
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', downloadAllCodes);
    }

    const deleteSelectedBtn = document.getElementById('deleteSelectedCodes');
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', deleteSelectedCodes);
    }
}

async function loadInvitationCodes() {
    try {
        showLoadingState('invitationCodesContainer');

        const response = await fetch('/api/invitation-codes/', {
            method: 'GET',
            headers: getRequestHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load invitation codes');
        }

        const data = await response.json();
        currentInvitationCodes = (data.codes || []).filter(code => code && code.code && typeof code.code === 'string');

        const totalCodes = data.codes ? data.codes.length : 0;
        if (totalCodes > currentInvitationCodes.length) {
            console.warn(`Filtered out ${totalCodes - currentInvitationCodes.length} invalid invitation codes`);
        }

        renderInvitationCodes();

    } catch (error) {
        console.error('Error loading invitation codes:', error);
        showErrorState('invitationCodesContainer', 'Failed to load invitation codes');
    }
}

function renderInvitationCodes() {
    const container = document.getElementById('invitationCodesContainer');
    if (!container) return;

    if (currentInvitationCodes.length === 0) {
        container.innerHTML = createEmptyState('fa-ticket', 'No invitation codes', 'Click the button above to create new invitation codes');
        return;
    }

    const typeFilter = document.getElementById('invitationTypeFilter');
    const statusFilter = document.getElementById('invitationStatusFilter');
    const selectedType = typeFilter ? typeFilter.value : 'all';
    const selectedStatus = statusFilter ? statusFilter.value : 'all';

    let filteredCodes = currentInvitationCodes.filter(code => code && code.code && typeof code.code === 'string');

    if (selectedType !== 'all') {
        filteredCodes = filteredCodes.filter(code => code.durationType === selectedType);
    }

    if (selectedStatus !== 'all') {
        if (selectedStatus === 'used') {
            filteredCodes = filteredCodes.filter(code => code.used === true);
        } else if (selectedStatus === 'unused') {
            filteredCodes = filteredCodes.filter(code => code.used === false);
        }
    }

    if (codeSearchTerm) {
        filteredCodes = filteredCodes.filter(code =>
            code.code.toLowerCase().includes(codeSearchTerm.toLowerCase()) ||
            (code.createdBy && code.createdBy.toLowerCase().includes(codeSearchTerm.toLowerCase())) ||
            (code.usedBy && code.usedBy.toLowerCase().includes(codeSearchTerm.toLowerCase()))
        );
    }

    if (filteredCodes.length === 0) {
        container.innerHTML = createEmptyState('fa-filter', 'No invitation codes match the filters', 'Adjust the filters or search term');
        return;
    }

    const totalPages = Math.ceil(filteredCodes.length / codesPerPage);

    if (currentCodePage > totalPages) {
        currentCodePage = Math.max(1, totalPages);
    }

    const startIndex = (currentCodePage - 1) * codesPerPage;
    const endIndex = startIndex + codesPerPage;
    const pageCodes = filteredCodes.slice(startIndex, endIndex);

    const controlsHtml = `
        <div class="invitationCodeControls" style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding: 10px; background: var(--SmartThemeBlurTintColor); border-radius: 10px;">
            <input type="text" id="codeSearchInput" placeholder="Search invitation codes, creators, or users..."
                   value="${escapeHtml(codeSearchTerm)}" class="text_pole" style="flex: 1;">
            <span class="codeCount" style="white-space: nowrap; opacity: 0.7; font-size: 0.9em; padding: 5px 10px; background: var(--black30a); border-radius: 5px;">
                Showing ${startIndex + 1}-${Math.min(endIndex, filteredCodes.length)} / ${filteredCodes.length} invitation codes
            </span>
        </div>
    `;

    const paginationHtml = createCodePaginationControls(currentCodePage, totalPages, filteredCodes.length);

    const codesHtml = pageCodes.map(code => createInvitationCodeItem(code)).join('');

    container.innerHTML = `
        ${controlsHtml}
        ${paginationHtml}
        <div class="invitationCodeListContent" style="display: flex; flex-direction: column; gap: 10px;">
            ${codesHtml}
        </div>
        ${paginationHtml}
    `;

    const searchInput = document.getElementById('codeSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounceSearch(function(e) {
            codeSearchTerm = e.target.value.trim();
            currentCodePage = 1;
            renderInvitationCodes();
        }, 300));
    }

    bindInvitationCodeDeleteEvents();

    bindCodePaginationEvents();

    updateSelectAllButton();
}

function createCodePaginationControls(currentPage, totalPages, totalCodes) {
    if (totalPages <= 1) return '';

    let html = '<div class="paginationControls" style="display: flex; align-items: center; justify-content: center; gap: 10px; margin: 15px 0; flex-wrap: wrap;">';

    if (currentPage > 1) {
        html += `<button class="menu_button code-pagination-btn" data-page="${currentPage - 1}">
            <i class="fa-solid fa-chevron-left"></i> Previous
        </button>`;
    } else {
        html += `<button class="menu_button" disabled style="opacity: 0.5;">
            <i class="fa-solid fa-chevron-left"></i> Previous
        </button>`;
    }

    const maxButtons = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    if (startPage > 1) {
        html += `<button class="menu_button code-pagination-btn" data-page="1">1</button>`;
        if (startPage > 2) {
            html += `<span style="opacity: 0.5;">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<button class="menu_button" disabled style="background: var(--SmartThemeBlurTintColor);">${i}</button>`;
        } else {
            html += `<button class="menu_button code-pagination-btn" data-page="${i}">${i}</button>`;
        }
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span style="opacity: 0.5;">...</span>`;
        }
        html += `<button class="menu_button code-pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    if (currentPage < totalPages) {
        html += `<button class="menu_button code-pagination-btn" data-page="${currentPage + 1}">
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

function bindCodePaginationEvents() {
    const paginationBtns = document.querySelectorAll('.code-pagination-btn');
    paginationBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            currentCodePage = parseInt(this.dataset.page);
            renderInvitationCodes();

            const container = document.getElementById('invitationCodesContainer');
            if (container) {
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

function createInvitationCodeItem(code) {
    const status = getInvitationCodeStatus(code);
    const statusClass = status.class;
    const statusText = status.text;
    const createdDate = new Date(code.createdAt).toLocaleString('en-US');

    const durationTypeText = {
        '1day': '1 day',
        '1week': '1 week',
        '1month': '1 month',
        '1quarter': '1 quarter',
        '6months': '6 months',
        '1year': '1 year',
        'permanent': 'Permanent'
    }[code.durationType] || code.durationType || 'Unknown';

    let userExpiresText = '';
    if (code.used && code.userExpiresAt) {
        userExpiresText = new Date(code.userExpiresAt).toLocaleString('en-US');
    } else if (code.used && !code.userExpiresAt) {
        userExpiresText = 'Permanent';
    }

    const createdBy = code.createdBy || 'Unknown';
    const usedBy = code.usedBy || 'Unknown';

    return `
        <div class="invitationCodeItem" data-code="${code.code}">
            <input type="checkbox" class="invitationCodeCheckbox" data-code="${code.code}" onchange="toggleCodeSelection('${code.code}')">
            <div class="invitationCodeInfo">
                <div class="invitationCodeValue" title="Click to copy" onclick="copyToClipboard('${code.code}')">${code.code}</div>
                <div class="invitationCodeMeta">
                    <span>Created by: ${escapeHtml(createdBy)}</span>
                    <span>Created at: ${createdDate}</span>
                    <span>Type: ${durationTypeText}</span>
                    ${code.used ? `<span>Used by: ${escapeHtml(usedBy)}</span>` : ''}
                    ${code.used ? `<span>Used at: ${new Date(code.usedAt).toLocaleString('en-US')}</span>` : ''}
                    ${code.used && userExpiresText ? `<span>User expires: ${userExpiresText}</span>` : ''}
                </div>
            </div>
            <div class="invitationCodeActions">
                <span class="invitationCodeStatus ${statusClass}">${statusText}</span>
                <button class="menu_button warning" onclick="deleteInvitationCode('${code.code}')" title="Delete invitation code">
                    <i class="fa-fw fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

function getInvitationCodeStatus(code) {
    if (code.used) {
        return { class: 'used', text: 'Used' };
    }

    return { class: 'unused', text: 'Unused' };
}

async function createInvitationCode() {
    const form = document.querySelector('.createInvitationForm');
    const submitButton = form.querySelector('button[type="submit"]');

    if (submitButton.disabled) {
        return;
    }

    const durationType = form.querySelector('select[name="durationType"]').value;

    const requestData = {
        durationType: durationType || 'permanent'
    };

    submitButton.disabled = true;
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fa-fw fa-solid fa-spinner fa-spin"></i><span>Creating...</span>';

    try {
        const response = await fetch('/api/invitation-codes/create', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create invitation code');
        }

        const newCode = await response.json();
        const durationText = {
            '1day': '1 day',
            '1week': '1 week',
            '1month': '1 month',
            '1quarter': '1 quarter',
            '6months': '6 months',
            '1year': '1 year',
            'permanent': 'Permanent'
        }[durationType] || 'Unknown';
        alert(`Invitation code created: ${newCode.code}\nDuration type: ${durationText}`);

        form.reset();

        currentCodePage = 1;

        loadInvitationCodes();

    } catch (error) {
        console.error('Error creating invitation code:', error);
        alert(error.message || 'Failed to create invitation code');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

async function deleteInvitationCode(code) {
    if (!confirm(`Are you sure you want to delete invitation code ${code}?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/invitation-codes/${code}`, {
            method: 'DELETE',
            headers: getRequestHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete invitation code');
        }

        alert('Invitation code deleted.');
        loadInvitationCodes();

    } catch (error) {
        console.error('Error deleting invitation code:', error);
        alert(error.message || 'Failed to delete invitation code');
    }
}

async function createBatchInvitationCodes() {
    const form = document.querySelector('.createBatchInvitationForm');
    const submitButton = form.querySelector('button[type="submit"]');

    if (submitButton.disabled) {
        return;
    }

    const count = parseInt(form.querySelector('input[name="batchCount"]').value);
    const durationType = form.querySelector('select[name="batchDurationType"]').value;

    if (!count || count < 1 || count > 100) {
        alert('Quantity must be between 1 and 100');
        return;
    }

    const requestData = {
        count,
        durationType: durationType || 'permanent'
    };

    submitButton.disabled = true;
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fa-fw fa-solid fa-spinner fa-spin"></i><span>Creating...</span>';

    try {
        const response = await fetch('/api/invitation-codes/batch-create', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to batch create invitation codes');
        }

        const result = await response.json();
        const durationText = {
            '1day': '1 day',
            '1week': '1 week',
            '1month': '1 month',
            '1quarter': '1 quarter',
            '6months': '6 months',
            '1year': '1 year',
            'permanent': 'Permanent'
        }[durationType] || 'Unknown';
        alert(`Successfully created ${result.count} invitation codes\nDuration type: ${durationText}`);

        form.reset();
        form.querySelector('input[name="batchCount"]').value = '10';

        currentCodePage = 1;

        loadInvitationCodes();

    } catch (error) {
        console.error('Error batch creating invitation codes:', error);
        alert(error.message || 'Failed to batch create invitation codes');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

function toggleCodeSelection(code) {
    const item = document.querySelector(`[data-code="${code}"]`);
    const checkbox = document.querySelector(`input[data-code="${code}"]`);

    if (checkbox.checked) {
        item.classList.add('selected');
    } else {
        item.classList.remove('selected');
    }

    updateSelectAllButton();
}

function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.invitationCodeCheckbox');
    const selectAllBtn = document.getElementById('selectAllCodes');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);

    checkboxes.forEach(checkbox => {
        checkbox.checked = !allChecked;
        const code = checkbox.dataset.code;
        const item = document.querySelector(`[data-code="${code}"]`);

        if (checkbox.checked) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });

    updateSelectAllButton();
}

function updateSelectAllButton() {
    const checkboxes = document.querySelectorAll('.invitationCodeCheckbox');
    const selectAllBtn = document.getElementById('selectAllCodes');

    if (!selectAllBtn || checkboxes.length === 0) return;

    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const allChecked = checkedCount === checkboxes.length;

    if (allChecked) {
        selectAllBtn.innerHTML = '<i class="fa-fw fa-solid fa-square"></i><span>Clear selection</span>';
    } else {
        selectAllBtn.innerHTML = '<i class="fa-fw fa-solid fa-check-square"></i><span>Select all</span>';
    }
}

function getSelectedCodes() {
    const selectedCheckboxes = document.querySelectorAll('.invitationCodeCheckbox:checked');
    return Array.from(selectedCheckboxes).map(cb => cb.dataset.code);
}

function downloadSelectedCodes() {
    const selectedCodes = getSelectedCodes();

    if (selectedCodes.length === 0) {
        alert('Please select invitation codes to download.');
        return;
    }

    const selectedCodeObjects = currentInvitationCodes.filter(code => selectedCodes.includes(code.code));
    downloadCodes(selectedCodeObjects, 'Selected invitation codes');
}

function downloadAllCodes() {
    if (currentInvitationCodes.length === 0) {
        alert('No invitation codes to download');
        return;
    }

    const typeFilter = document.getElementById('invitationTypeFilter');
    const statusFilter = document.getElementById('invitationStatusFilter');
    const selectedType = typeFilter ? typeFilter.value : 'all';
    const selectedStatus = statusFilter ? statusFilter.value : 'all';

    let filteredCodes = currentInvitationCodes;

    if (selectedType !== 'all') {
        filteredCodes = filteredCodes.filter(code => code.durationType === selectedType);
    }

    if (selectedStatus !== 'all') {
        if (selectedStatus === 'used') {
            filteredCodes = filteredCodes.filter(code => code.used === true);
        } else if (selectedStatus === 'unused') {
            filteredCodes = filteredCodes.filter(code => code.used === false);
        }
    }

    if (filteredCodes.length === 0) {
        alert('No matching invitation codes to download');
        return;
    }

    downloadCodes(filteredCodes, 'All invitation codes');
}

function downloadCodes(codeObjects, filename) {
    const durationTypeText = {
        '1day': '1 day',
        '1week': '1 week',
        '1month': '1 month',
        '1quarter': '1 quarter',
        '6months': '6 months',
        '1year': '1 year',
        'permanent': 'Permanent'
    };

    const lines = codeObjects.map(codeObj => {
        const typeText = durationTypeText[codeObj.durationType] || codeObj.durationType || 'Unknown';
        const statusText = codeObj.used ? 'Used' : 'Unused';
        return `${codeObj.code} - Type:${typeText} - Status:${statusText}`;
    });

    const textContent = lines.join('\n');

    const timestamp = new Date().toISOString().slice(0, 10);
    const finalFilename = `${filename}_${timestamp}.txt`;

    downloadFile(textContent, finalFilename, 'text/plain');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType + ';charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

async function deleteSelectedCodes() {
    const selectedCodes = getSelectedCodes();

    if (selectedCodes.length === 0) {
        alert('Please select invitation codes to delete.');
        return;
    }

    if (!confirm(`Are you sure you want to delete the selected ${selectedCodes.length} invitation codes? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch('/api/invitation-codes/batch-delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ codes: selectedCodes })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete invitation codes in bulk');
        }

        const result = await response.json();
        let message = `Successfully deleted ${result.deletedCount}/${result.totalRequested} invitation codes`;

        if (result.errors && result.errors.length > 0) {
            message += `\n\nError details:\n${result.errors.join('\n')}`;
        }

        alert(message);
        loadInvitationCodes();

    } catch (error) {
        console.error('Error batch deleting invitation codes:', error);
        alert(error.message || 'Failed to delete invitation codes in bulk');
    }
}

function bindInvitationCodeDeleteEvents() {
}

async function cleanupExpiredInvitationCodes() {
    if (!confirm('Are you sure you want to clean up all expired invitation codes?')) {
        return;
    }

    try {
        const response = await fetch('/api/invitation-codes/cleanup', {
            method: 'POST',
            headers: getRequestHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to clean up expired invitation codes');
        }

        const result = await response.json();
        alert(`Cleanup complete. Removed ${result.cleanedCount} expired invitation codes`);

        loadInvitationCodes();

    } catch (error) {
        console.error('Error cleaning up expired codes:', error);
        alert(error.message || 'Failed to clean up expired invitation codes');
    }
}

async function getCsrfToken() {
    try {
        const response = await fetch('/csrf-token');
        const data = await response.json();
        csrfToken = data.token;
        return csrfToken;
    } catch (error) {
        console.error('Error getting CSRF token:', error);
        return null;
    }
}

function getRequestHeaders() {
    const headers = {
        'Content-Type': 'application/json',
    };

    if (window.getRequestHeaders && typeof window.getRequestHeaders === 'function') {
        try {
            return window.getRequestHeaders();
        } catch (e) {
            console.warn('Failed to get headers from global function:', e);
        }
    }

    if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
    }

    return headers;
}

function showLoadingState(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="loadingState">
                <div class="loadingSpinner"></div>
                <p>Loading...</p>
            </div>
        `;
    }
}

function showErrorState(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="emptyState">
                <i class="fa-solid fa-exclamation-triangle"></i>
                <h4>Load failed</h4>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
    }
}

function createEmptyState(iconClass, title, description) {
    return `
        <div class="emptyState">
            <i class="fa-solid ${iconClass}"></i>
            <h4>${escapeHtml(title)}</h4>
            <p>${escapeHtml(description)}</p>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Invitation code copied to clipboard');
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Invitation code copied to clipboard');
    });
}

window.addEventListener('beforeunload', function() {
    stopSystemLoadAutoRefresh();
});

let currentAnnouncements = [];
let currentLoginAnnouncements = [];

function bindAnnouncementEvents() {
    const typeTabButtons = document.querySelectorAll('.announcement-type-tab');
    typeTabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const type = this.dataset.type;
            switchAnnouncementType(type);
        });
    });

    const refreshButton = document.getElementById('refreshAnnouncements');
    if (refreshButton) {
        refreshButton.addEventListener('click', function() {
            loadAnnouncements();
        });
    }

    const refreshLoginButton = document.getElementById('refreshLoginAnnouncements');
    if (refreshLoginButton) {
        refreshLoginButton.addEventListener('click', function() {
            loadLoginAnnouncements();
        });
    }

    const createAnnouncementForm = document.querySelector('.createAnnouncementForm');
    if (createAnnouncementForm) {
        const newForm = createAnnouncementForm.cloneNode(true);
        createAnnouncementForm.parentNode.replaceChild(newForm, createAnnouncementForm);

        newForm.addEventListener('submit', function(e) {
            e.preventDefault();
            createAnnouncement();
        });
    }

    const createLoginAnnouncementForm = document.querySelector('.createLoginAnnouncementForm');
    if (createLoginAnnouncementForm) {
        const newLoginForm = createLoginAnnouncementForm.cloneNode(true);
        createLoginAnnouncementForm.parentNode.replaceChild(newLoginForm, createLoginAnnouncementForm);

        newLoginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            createLoginAnnouncement(e.target);
        });
    }
}

function switchAnnouncementType(type) {
    const typeTabButtons = document.querySelectorAll('.announcement-type-tab');
    typeTabButtons.forEach(button => {
        if (button.dataset.type === type) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    const mainSection = document.getElementById('mainAnnouncementSection');
    const loginSection = document.getElementById('loginAnnouncementSection');

    if (type === 'main') {
        mainSection.style.display = 'block';
        loginSection.style.display = 'none';
        loadAnnouncements();
    } else if (type === 'login') {
        mainSection.style.display = 'none';
        loginSection.style.display = 'block';
        loadLoginAnnouncements();
    }
}

async function loadAnnouncements() {
    try {
        showLoadingState('announcementsContainer');

        const response = await fetch('/api/announcements', {
            method: 'GET',
            headers: getRequestHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load announcements');
        }

        currentAnnouncements = await response.json();
        renderAnnouncements();

    } catch (error) {
        console.error('Error loading announcements:', error);
        showErrorState('announcementsContainer', 'Failed to load announcements');
    }
}

function renderAnnouncements() {
    const container = document.getElementById('announcementsContainer');
    if (!container) return;

    if (currentAnnouncements.length === 0) {
        container.innerHTML = createEmptyState('fa-bullhorn', 'No announcements', 'No announcements created yet');
        return;
    }

    const announcementsHtml = currentAnnouncements.map(announcement => createAnnouncementItem(announcement)).join('');
    container.innerHTML = announcementsHtml;
}

function createAnnouncementItem(announcement) {
    const createdAt = new Date(announcement.createdAt).toLocaleString('en-US');
    const updatedAt = announcement.updatedAt ? new Date(announcement.updatedAt).toLocaleString('en-US') : createdAt;

    let timeInfo = `Created at: ${createdAt}`;
    if (announcement.updatedAt && announcement.updatedAt !== announcement.createdAt) {
        timeInfo += ` | Updated at: ${updatedAt}`;
    }

    let validityInfo = '';

    return `
        <div class="announcementItem" data-id="${announcement.id}">
            <div class="announcementHeader">
                <div class="announcementTitle">${escapeHtml(announcement.title)}</div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="announcementStatus ${announcement.enabled ? 'enabled' : 'disabled'}">
                        ${announcement.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
            </div>
            <div class="announcementContent">${escapeHtml(announcement.content)}</div>
            <div class="announcementMeta">
                <span>${timeInfo}${validityInfo}</span>
                <span>Created by: ${escapeHtml(announcement.createdBy)}</span>
            </div>
            <div class="announcementActions">
                <button type="button" class="menu_button menu_button_icon warning" onclick="toggleAnnouncement('${announcement.id}')">
                    <i class="fa-fw fa-solid fa-${announcement.enabled ? 'pause' : 'play'}"></i>
                    <span>${announcement.enabled ? 'Disable' : 'Enable'}</span>
                </button>
                <button type="button" class="menu_button menu_button_icon danger" onclick="deleteAnnouncement('${announcement.id}')">
                    <i class="fa-fw fa-solid fa-trash"></i>
                    <span>Delete</span>
                </button>
            </div>
        </div>
    `;
}


async function createAnnouncement() {
    const form = document.querySelector('.createAnnouncementForm');
    if (!form) {
        console.error('Form not found');
        alert('Form not found. Please refresh and try again.');
        return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) {
        console.error('Submit button not found');
        alert('Submit button not found. Please refresh and try again.');
        return;
    }

    if (submitButton.disabled) {
        return;
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    let titleInput = form.querySelector('input[name="title"]');
    let contentInput = form.querySelector('textarea[name="content"]');
    let enabledInput = form.querySelector('input[name="enabled"]');

    if (!titleInput) {
        titleInput = document.querySelector('.announcementsBlock input[name="title"]');
    }
    if (!contentInput) {
        contentInput = document.querySelector('.announcementsBlock textarea[name="content"]');
    }
    if (!enabledInput) {
        enabledInput = document.querySelector('.announcementsBlock input[name="enabled"]');
    }


    let title = '';
    let content = '';
    let enabled = false;

    if (titleInput) {
        title = titleInput.value.trim();
    } else {
        const textInputs = form.querySelectorAll('input[type="text"]');
        if (textInputs.length > 0) {
            title = textInputs[0].value.trim();
        }
    }

    if (contentInput) {
        content = contentInput.value.trim();
    } else {
        const textareas = form.querySelectorAll('textarea');
        if (textareas.length > 0) {
            content = textareas[0].value.trim();
        }
    }

    if (enabledInput) {
        enabled = enabledInput.checked;
    } else {
        const checkboxes = form.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length > 0) {
            enabled = checkboxes[0].checked;
        }
    }


    const data = {
        title: title,
        content: content,
        type: 'info',
        enabled: enabled
    };

    if (!data.title || !data.content) {
        alert('Please enter a title and content.');
        return;
    }

    submitButton.disabled = true;
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fa-fw fa-solid fa-spinner fa-spin"></i><span>Creating...</span>';

    try {
        if (!csrfToken) {
            await getCsrfToken();
        }

        const response = await fetch('/api/announcements', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create announcement');
        }

        const newAnnouncement = await response.json();
        console.log('Announcement created:', newAnnouncement);

        form.reset();

        await loadAnnouncements();

        alert('Announcement created.');

    } catch (error) {
        console.error('Error creating announcement:', error);
        alert('Failed to create announcement: ' + error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

async function toggleAnnouncement(announcementId) {
    try {
        const response = await fetch(`/api/announcements/${announcementId}/toggle`, {
            method: 'POST',
            headers: getRequestHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to toggle announcement');
        }

        const updatedAnnouncement = await response.json();
        console.log('Announcement toggled:', updatedAnnouncement);

        await loadAnnouncements();

    } catch (error) {
        console.error('Error toggling announcement:', error);
        alert('Failed to toggle announcement status: ' + error.message);
    }
}

async function deleteAnnouncement(announcementId) {
    const announcement = currentAnnouncements.find(a => a.id === announcementId);
    if (!announcement) return;

    if (!confirm(`Are you sure you want to delete the announcement "${announcement.title}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/announcements/${announcementId}`, {
            method: 'DELETE',
            headers: getRequestHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete announcement');
        }

        console.log('Announcement deleted:', announcementId);

        await loadAnnouncements();

        alert('Announcement deleted.');

    } catch (error) {
        console.error('Error deleting announcement:', error);
        alert('Failed to delete announcement: ' + error.message);
    }
}


async function loadLoginAnnouncements() {
    try {
        showLoadingState('loginAnnouncementsContainer');

        const response = await fetch('/api/announcements/login', {
            method: 'GET',
            headers: getRequestHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load login announcements');
        }

        currentLoginAnnouncements = await response.json();
        renderLoginAnnouncements();

    } catch (error) {
        console.error('Error loading login announcements:', error);
        showErrorState('loginAnnouncementsContainer', 'Failed to load login page announcements');
    }
}

function renderLoginAnnouncements() {
    const container = document.getElementById('loginAnnouncementsContainer');
    if (!container) return;

    if (currentLoginAnnouncements.length === 0) {
        container.innerHTML = createEmptyState('fa-bullhorn', 'No login page announcements', 'No login page announcements created yet');
        return;
    }

    const announcementsHtml = currentLoginAnnouncements.map(announcement => createLoginAnnouncementItem(announcement)).join('');
    container.innerHTML = announcementsHtml;
}

function createLoginAnnouncementItem(announcement) {
    const createdAt = new Date(announcement.createdAt).toLocaleString('en-US');
    const updatedAt = announcement.updatedAt ? new Date(announcement.updatedAt).toLocaleString('en-US') : createdAt;

    let timeInfo = `Created at: ${createdAt}`;
    if (announcement.updatedAt && announcement.updatedAt !== announcement.createdAt) {
        timeInfo += ` | Updated at: ${updatedAt}`;
    }

    const typeMap = {
        'info': 'Info',
        'warning': 'Warning',
        'success': 'Success',
        'error': 'Error'
    };
    const typeName = typeMap[announcement.type] || 'Info';

    return `
        <div class="announcementItem" data-id="${announcement.id}">
            <div class="announcementHeader">
                <div class="announcementTitle">${escapeHtml(announcement.title)}</div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="announcementType ${announcement.type || 'info'}">${typeName}</span>
                    <span class="announcementStatus ${announcement.enabled ? 'enabled' : 'disabled'}">
                        ${announcement.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
            </div>
            <div class="announcementContent">${escapeHtml(announcement.content)}</div>
            <div class="announcementMeta">
                <span>${timeInfo}</span>
                <span>Created by: ${escapeHtml(announcement.createdBy)}</span>
            </div>
            <div class="announcementActions">
                <button type="button" class="menu_button menu_button_icon warning" onclick="toggleLoginAnnouncement('${announcement.id}')">
                    <i class="fa-fw fa-solid fa-${announcement.enabled ? 'pause' : 'play'}"></i>
                    <span>${announcement.enabled ? 'Disable' : 'Enable'}</span>
                </button>
                <button type="button" class="menu_button menu_button_icon danger" onclick="deleteLoginAnnouncement('${announcement.id}')">
                    <i class="fa-fw fa-solid fa-trash"></i>
                    <span>Delete</span>
                </button>
            </div>
        </div>
    `;
}

async function createLoginAnnouncement(formElement) {
    const form = formElement || document.querySelector('.createLoginAnnouncementForm');
    if (!form) {
        console.error('Login announcement form not found');
        alert('Form not found. Please refresh and try again.');
        return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) {
        console.error('Submit button not found');
        alert('Submit button not found. Please refresh and try again.');
        return;
    }

    if (submitButton.disabled) {
        return;
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    let titleInput = form.querySelector('input[name="title"]');
    let contentInput = form.querySelector('textarea[name="content"]');
    let typeInput = form.querySelector('select[name="type"]');
    let enabledInput = form.querySelector('input[name="enabled"]');

    if (!titleInput) {
        titleInput = document.querySelector('#loginAnnouncementSection input[name="title"]');
    }
    if (!contentInput) {
        contentInput = document.querySelector('#loginAnnouncementSection textarea[name="content"]');
    }
    if (!typeInput) {
        typeInput = document.querySelector('#loginAnnouncementSection select[name="type"]');
    }
    if (!enabledInput) {
        enabledInput = document.querySelector('#loginAnnouncementSection input[name="enabled"]');
    }

    let title = '';
    let content = '';
    let type = 'info';
    let enabled = true;

    if (titleInput) {
        title = titleInput.value.trim();
    } else {
        const textInputs = form.querySelectorAll('input[type="text"]');
        if (textInputs.length > 0) {
            title = textInputs[0].value.trim();
        }
    }

    if (contentInput) {
        content = contentInput.value.trim();
    } else {
        const textareas = form.querySelectorAll('textarea');
        if (textareas.length > 0) {
            content = textareas[0].value.trim();
        }
    }

    if (typeInput) {
        type = typeInput.value;
    } else {
        const selects = form.querySelectorAll('select');
        if (selects.length > 0) {
            type = selects[0].value;
        }
    }

    if (enabledInput) {
        enabled = enabledInput.checked;
    } else {
        const checkboxes = form.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length > 0) {
            enabled = checkboxes[0].checked;
        }
    }

    const data = {
        title: title,
        content: content,
        type: type,
        enabled: enabled
    };

    console.log('Login announcement form data:', data);

    if (!data.title || !data.content) {
        alert('Please enter a title and content.');
        return;
    }

    submitButton.disabled = true;
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fa-fw fa-solid fa-spinner fa-spin"></i><span>Creating...</span>';

    try {
        if (!csrfToken) {
            await getCsrfToken();
        }

        const response = await fetch('/api/announcements/login', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create login announcement');
        }

        const newAnnouncement = await response.json();
        console.log('Login announcement created:', newAnnouncement);

        form.reset();

        await loadLoginAnnouncements();

        alert('Login page announcement created.');

    } catch (error) {
        console.error('Error creating login announcement:', error);
        alert('Failed to create login page announcement: ' + error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

async function toggleLoginAnnouncement(announcementId) {
    try {
        const response = await fetch(`/api/announcements/login/${announcementId}/toggle`, {
            method: 'POST',
            headers: getRequestHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to toggle login announcement');
        }

        const updatedAnnouncement = await response.json();
        console.log('Login announcement toggled:', updatedAnnouncement);

        await loadLoginAnnouncements();

    } catch (error) {
        console.error('Error toggling login announcement:', error);
        alert('Failed to toggle login page announcement status: ' + error.message);
    }
}

async function deleteLoginAnnouncement(announcementId) {
    const announcement = currentLoginAnnouncements.find(a => a.id === announcementId);
    if (!announcement) return;

    if (!confirm(`Are you sure you want to delete the login page announcement "${announcement.title}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/announcements/login/${announcementId}`, {
            method: 'DELETE',
            headers: getRequestHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete login announcement');
        }

        console.log('Login announcement deleted:', announcementId);

        await loadLoginAnnouncements();

        alert('Login page announcement deleted.');

    } catch (error) {
        console.error('Error deleting login announcement:', error);
        alert('Failed to delete login page announcement: ' + error.message);
    }
}

window.toggleLoginAnnouncement = toggleLoginAnnouncement;
window.deleteLoginAnnouncement = deleteLoginAnnouncement;

// ============================================================
// ============================================================

async function loadEmailConfig() {
    try {
        const response = await fetch('/api/email-config/get', {
            method: 'GET',
            headers: getRequestHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load email config');
        }

        const config = await response.json();

        $('#emailEnabled').prop('checked', config.enabled || false);
        $('#emailSmtpHost').val(config.host || '');
        $('#emailSmtpPort').val(config.port || 587);
        $('#emailSmtpSecure').prop('checked', config.secure || false);
        $('#emailSmtpUser').val(config.user || '');
        $('#emailSmtpPassword').val(config.password || '');
        $('#emailFrom').val(config.from || '');
        $('#emailFromName').val(config.fromName || 'SillyTavern');

    } catch (error) {
        console.error('Error loading email config:', error);
        alert('Failed to load email configuration: ' + error.message);
    }
}

async function saveEmailConfig() {
    const saveButton = $('#saveEmailConfig');
    const originalText = saveButton.html();

    try {
        saveButton.prop('disabled', true);
        saveButton.html('<i class="fa-fw fa-solid fa-spinner fa-spin"></i> Saving...');

        const config = {
            enabled: $('#emailEnabled').prop('checked'),
            host: $('#emailSmtpHost').val().trim(),
            port: parseInt($('#emailSmtpPort').val()) || 587,
            secure: $('#emailSmtpSecure').prop('checked'),
            user: $('#emailSmtpUser').val().trim(),
            password: $('#emailSmtpPassword').val() || '',
            from: $('#emailFrom').val().trim(),
            fromName: $('#emailFromName').val().trim() || 'SillyTavern'
        };

        if (config.enabled) {
            if (!config.host || !config.user || !config.password || !config.from) {
                alert('Please fill in all required fields (SMTP host, username, password, sender email).');
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(config.from)) {
                alert('Sender email format is invalid.');
                return;
            }
        }

        const response = await fetch('/api/email-config/save', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(config)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save email config');
        }

        const result = await response.json();
        console.log('Email config saved:', result);

        alert('Email configuration saved. Some changes may require a server restart to take effect.');

    } catch (error) {
        console.error('Error saving email config:', error);
        alert('Failed to save email configuration: ' + error.message);
    } finally {
        saveButton.prop('disabled', false);
        saveButton.html(originalText);
    }
}

async function testEmailConfig() {
    const testButton = $('#testEmailConfig');
    const originalText = testButton.html();

    try {
        await saveEmailConfig();

        const testEmail = prompt('Enter a test email address:', '');

        if (!testEmail) {
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(testEmail)) {
            alert('Email format is invalid.');
            return;
        }

        testButton.prop('disabled', true);
        testButton.html('<i class="fa-fw fa-solid fa-spinner fa-spin"></i> Sending...');

        const response = await fetch('/api/email-config/test', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ testEmail })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to test email config');
        }

        const result = await response.json();
        console.log('Email test result:', result);

        alert('Test email sent. Please check your inbox.');

    } catch (error) {
        console.error('Error testing email config:', error);
        alert('Failed to send test email: ' + error.message);
    } finally {
        testButton.prop('disabled', false);
        testButton.html(originalText);
    }
}

function initializeEmailConfig() {
    $('#saveEmailConfig').off('click').on('click', saveEmailConfig);

    $('#testEmailConfig').off('click').on('click', testEmailConfig);
}

// ============================================================
// ============================================================

function showOAuthConfigTab() {
    hideAllTabs();

    const oauthConfigBlock = document.querySelector('.oauthConfigBlock');
    if (oauthConfigBlock) {
        oauthConfigBlock.style.display = 'block';
        loadOAuthConfiguration();
        bindOAuthConfigEvents();
    }
}

function bindOAuthConfigEvents() {
    $('#loadOAuthConfig').off('click').on('click', loadOAuthConfiguration);

    $('#saveOAuthConfig').off('click').on('click', saveOAuthConfiguration);
}

async function loadOAuthConfiguration() {
    try {
        const response = await fetch('/api/oauth-config/get', {
            method: 'GET',
            headers: getRequestHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load OAuth config');
        }

        const config = await response.json();

        $('#oauthGithubEnabled').prop('checked', config.github?.enabled || false);
        $('#oauthGithubClientId').val(config.github?.clientId || '');
        $('#oauthGithubClientSecret').val(config.github?.clientSecret || '');
        const githubCallback = config.github?.callbackUrl || config.github?.defaultCallbackUrl || '';
        $('#oauthGithubCallback').val(githubCallback);
        if (config.github?.defaultCallbackUrl) {
            $('#oauthGithubCallback').attr('placeholder', `Leave blank to use: ${config.github.defaultCallbackUrl}`);
        }

        $('#oauthDiscordEnabled').prop('checked', config.discord?.enabled || false);
        $('#oauthDiscordClientId').val(config.discord?.clientId || '');
        $('#oauthDiscordClientSecret').val(config.discord?.clientSecret || '');
        const discordCallback = config.discord?.callbackUrl || config.discord?.defaultCallbackUrl || '';
        $('#oauthDiscordCallback').val(discordCallback);
        if (config.discord?.defaultCallbackUrl) {
            $('#oauthDiscordCallback').attr('placeholder', `Leave blank to use: ${config.discord.defaultCallbackUrl}`);
        }

        $('#oauthLinuxdoEnabled').prop('checked', config.linuxdo?.enabled || false);
        $('#oauthLinuxdoClientId').val(config.linuxdo?.clientId || '');
        $('#oauthLinuxdoClientSecret').val(config.linuxdo?.clientSecret || '');
        const linuxdoCallback = config.linuxdo?.callbackUrl || config.linuxdo?.defaultCallbackUrl || '';
        $('#oauthLinuxdoCallback').val(linuxdoCallback);
        if (config.linuxdo?.defaultCallbackUrl) {
            $('#oauthLinuxdoCallback').attr('placeholder', `Leave blank to use: ${config.linuxdo.defaultCallbackUrl}`);
        }
        $('#oauthLinuxdoAuthUrl').val(config.linuxdo?.authUrl || 'https://connect.linux.do/oauth2/authorize');
        $('#oauthLinuxdoTokenUrl').val(config.linuxdo?.tokenUrl || 'https://connect.linux.do/oauth2/token');
        $('#oauthLinuxdoUserInfoUrl').val(config.linuxdo?.userInfoUrl || 'https://connect.linux.do/oauth2/userinfo');

        console.log('OAuth configuration loaded successfully');

    } catch (error) {
        console.error('Error loading OAuth config:', error);
        alert('Failed to load OAuth configuration: ' + error.message);
    }
}

async function saveOAuthConfiguration() {
    const saveButton = $('#saveOAuthConfig');
    const originalText = saveButton.html();

    try {
        saveButton.prop('disabled', true);
        saveButton.html('<i class="fa-fw fa-solid fa-spinner fa-spin"></i> Saving...');

        const githubCallback = $('#oauthGithubCallback').val().trim();
        const discordCallback = $('#oauthDiscordCallback').val().trim();
        const linuxdoCallback = $('#oauthLinuxdoCallback').val().trim();

        const config = {
            github: {
                enabled: $('#oauthGithubEnabled').prop('checked'),
                clientId: $('#oauthGithubClientId').val().trim(),
                clientSecret: $('#oauthGithubClientSecret').val().trim(),
                callbackUrl: githubCallback,
            },
            discord: {
                enabled: $('#oauthDiscordEnabled').prop('checked'),
                clientId: $('#oauthDiscordClientId').val().trim(),
                clientSecret: $('#oauthDiscordClientSecret').val().trim(),
                callbackUrl: discordCallback,
            },
            linuxdo: {
                enabled: $('#oauthLinuxdoEnabled').prop('checked'),
                clientId: $('#oauthLinuxdoClientId').val().trim(),
                clientSecret: $('#oauthLinuxdoClientSecret').val().trim(),
                callbackUrl: linuxdoCallback,
                authUrl: $('#oauthLinuxdoAuthUrl').val().trim() || 'https://connect.linux.do/oauth2/authorize',
                tokenUrl: $('#oauthLinuxdoTokenUrl').val().trim() || 'https://connect.linux.do/oauth2/token',
                userInfoUrl: $('#oauthLinuxdoUserInfoUrl').val().trim() || 'https://connect.linux.do/oauth2/userinfo',
            },
        };

        if (config.github.enabled && (!config.github.clientId || !config.github.clientSecret)) {
            alert('GitHub OAuth is enabled, but Client ID or Client Secret is missing');
            return;
        }
        if (config.discord.enabled && (!config.discord.clientId || !config.discord.clientSecret)) {
            alert('Discord OAuth is enabled, but Client ID or Client Secret is missing');
            return;
        }
        if (config.linuxdo.enabled && (!config.linuxdo.clientId || !config.linuxdo.clientSecret)) {
            alert('Linux.do OAuth is enabled, but Client ID or Client Secret is missing');
            return;
        }

        const response = await fetch('/api/oauth-config/save', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(config)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save OAuth config');
        }

        const result = await response.json();
        console.log('OAuth config saved:', result);

        alert('OAuth configuration saved. Restart the server to apply changes.');

    } catch (error) {
        console.error('Error saving OAuth config:', error);
        alert('Failed to save OAuth configuration: ' + error.message);
    } finally {
        saveButton.prop('disabled', false);
        saveButton.html(originalText);
    }
}

// ============================================================
// ============================================================

const DEFAULT_CONFIG_LABELS = {
    settings: 'Settings',
    secrets: 'API keys',
    characters: 'Character cards',
    worlds: 'Lorebooks',
    backgrounds: 'Backgrounds',
    themes: 'Themes',
    avatars: 'User avatars',
    assets: 'Asset files',
    instruct: 'Instruction templates',
    context: 'Context templates',
    sysprompt: 'System prompts',
    reasoning: 'Reasoning templates',
    quickreplies: 'Quick replies',
    openai_settings: 'OpenAI presets',
    kobold_settings: 'KoboldAI presets',
    novel_settings: 'NovelAI presets',
    textgen_settings: 'TextGen presets',
    moving_ui: 'MovingUI layout',
};

function showDefaultConfigTab() {
    hideAllTabs();

    const defaultConfigBlock = document.querySelector('.defaultConfigBlock');
    if (defaultConfigBlock) {
        defaultConfigBlock.style.display = 'block';
        loadDefaultConfigStatus();
        loadDefaultConfigUsers();
    }
}

function bindDefaultConfigEvents() {
    $('#refreshDefaultConfigStatus').off('click').on('click', loadDefaultConfigStatus);
    $('#reloadDefaultConfigUsers').off('click').on('click', loadDefaultConfigUsers);
    $('#saveDefaultConfig').off('click').on('click', saveDefaultConfigSnapshot);
    $('#clearDefaultConfig').off('click').on('click', clearDefaultConfigTemplate);
}

function formatDefaultConfigCategories(categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
        return 'None';
    }
    return categories.map((id) => DEFAULT_CONFIG_LABELS[id] || id).join(', ');
}

async function loadDefaultConfigStatus() {
    const statusBox = document.getElementById('defaultConfigStatus');
    if (!statusBox) {
        return;
    }

    statusBox.textContent = 'Loading default configuration status...';

    try {
        const response = await fetch('/api/default-config/status', {
            method: 'GET',
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to load default config status');
        }

        const data = await response.json();

        if (!data.exists) {
            statusBox.innerHTML = `
                <div><strong>Status:</strong> Not configured</div>
                <div>New users will use the built-in defaults only.</div>
            `;
            return;
        }

        const sourceHandle = data.sourceHandle || 'Unknown';
        const updatedAt = data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'Unknown';
        const categoriesText = formatDefaultConfigCategories(data.categories);

        statusBox.innerHTML = `
            <div><strong>Status:</strong> Configured</div>
            <div><strong>Source user:</strong> ${escapeHtml(sourceHandle)}</div>
            <div><strong>Updated at:</strong> ${escapeHtml(updatedAt)}</div>
            <div><strong>Includes:</strong> ${escapeHtml(categoriesText)}</div>
        `;
    } catch (error) {
        console.error('Error loading default config status:', error);
        statusBox.textContent = 'Failed to load default configuration status. Please try again.';
    }
}

async function loadDefaultConfigUsers() {
    const select = document.getElementById('defaultConfigSourceUser');
    if (!select) {
        return;
    }

    const previousValue = select.value;
    select.innerHTML = '<option value="">Loading...</option>';

    try {
        const response = await fetch('/api/users/get', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ includeStorageSize: false }),
        });

        if (!response.ok) {
            throw new Error('Failed to load users');
        }

        const users = await response.json();
        users.sort((a, b) => String(a.handle).localeCompare(String(b.handle)));

        const options = users.map((user) => {
            const handle = escapeHtml(user.handle);
            const name = escapeHtml(user.name || '');
            const label = name ? `${handle} (${name})` : handle;
            return `<option value="${handle}">${label}</option>`;
        });

        select.innerHTML = options.join('');

        if (previousValue) {
            select.value = previousValue;
        } else if (users.length > 0) {
            select.value = users[0].handle;
        }
    } catch (error) {
        console.error('Error loading users for default config:', error);
        select.innerHTML = '<option value="">Load failed</option>';
    }
}

function getSelectedDefaultConfigCategories() {
    const selected = [];
    document.querySelectorAll('.defaultConfigCategory').forEach((input) => {
        if (input.checked) {
            selected.push(input.value);
        }
    });
    return selected;
}

async function saveDefaultConfigSnapshot() {
    const select = document.getElementById('defaultConfigSourceUser');
    if (!select || !select.value) {
        alert('Please select a source user.');
        return;
    }

    const categories = getSelectedDefaultConfigCategories();
    if (categories.length === 0) {
        alert('Please select at least one default configuration item.');
        return;
    }

    if (categories.includes('secrets')) {
        const confirmed = confirm('You chose to copy API keys (secrets.json). New users will inherit these keys. Continue?');
        if (!confirmed) {
            return;
        }
    }

    const saveButton = $('#saveDefaultConfig');
    const originalText = saveButton.html();

    try {
        saveButton.prop('disabled', true);
        saveButton.html('<i class="fa-fw fa-solid fa-spinner fa-spin"></i><span>Saving...</span>');

        const response = await fetch('/api/default-config/snapshot', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                handle: select.value,
                categories,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save default configuration');
        }

        const result = await response.json();
        console.log('Default config snapshot saved:', result);

        await loadDefaultConfigStatus();
        if (Array.isArray(result.missing) && result.missing.length > 0) {
            const missingText = formatDefaultConfigCategories(result.missing);
            alert(`Default configuration updated, but the following items were not found in the source user: ${missingText}`);
        } else {
            alert('Default configuration updated and will be applied to new users on registration.');
        }
    } catch (error) {
        console.error('Error saving default config snapshot:', error);
        alert('Failed to save default configuration: ' + error.message);
    } finally {
        saveButton.prop('disabled', false);
        saveButton.html(originalText);
    }
}

async function clearDefaultConfigTemplate() {
    if (!confirm('Are you sure you want to clear the default configuration template? New users will revert to system defaults.')) {
        return;
    }

    try {
        const response = await fetch('/api/default-config/clear', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to clear default configuration');
        }

        await loadDefaultConfigStatus();
        alert('Default configuration template cleared.');
    } catch (error) {
        console.error('Error clearing default config template:', error);
        alert('Failed to clear default configuration: ' + error.message);
    }
}

if (typeof window !== 'undefined') {
    window.initializeAdminExtensions = initializeAdminExtensions;
    window.toggleAnnouncement = toggleAnnouncement;
    window.deleteAnnouncement = deleteAnnouncement;
    window.showOAuthConfigTab = showOAuthConfigTab;
    window.loadOAuthConfiguration = loadOAuthConfiguration;
    window.saveOAuthConfiguration = saveOAuthConfiguration;
}
