/**
 * Public page configuration.
 * Dynamically control page links based on server config.
 */

let publicPagesConfig = {
    enablePublicCharacters: true,
    enableForum: true
};

/**
 * Fetch public page configuration.
 */
async function fetchPublicPagesConfig() {
    try {
        const response = await fetch('/api/public-config/public-pages', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const config = await response.json();
            publicPagesConfig = config;
            return config;
        } else {
            console.warn('Failed to fetch public pages config, using defaults');
            return publicPagesConfig;
        }
    } catch (error) {
        console.warn('Error fetching public pages config:', error);
        return publicPagesConfig;
    }
}

/**
 * Show or hide page links based on configuration.
 */
function updatePageLinks() {
    // Update public character links.
    const publicCharactersLinks = document.querySelectorAll('a[href="/public-characters"], #publicCharactersLink');
    publicCharactersLinks.forEach(link => {
        if (!publicPagesConfig.enablePublicCharacters) {
            link.style.display = 'none';
        } else {
            link.style.display = '';
        }
    });

    // Update forum links.
    const forumLinks = document.querySelectorAll('a[href="/forum"], #forumLink');
    forumLinks.forEach(link => {
        if (!publicPagesConfig.enableForum) {
            link.style.display = 'none';
        } else {
            link.style.display = '';
        }
    });
}

/**
 * Initialize public page configuration.
 */
async function initPublicPagesConfig() {
    await fetchPublicPagesConfig();
    updatePageLinks();
}

// Initialize after DOM is ready.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPublicPagesConfig);
} else {
    initPublicPagesConfig();
}

// Export helpers for other scripts.
window.publicPagesConfig = {
    fetch: fetchPublicPagesConfig,
    update: updatePageLinks,
    init: initPublicPagesConfig,
    getConfig: () => publicPagesConfig
};
