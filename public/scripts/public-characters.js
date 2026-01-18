// Public character cards page JavaScript.

let characters = [];
let filteredCharacters = [];
let publicCharactersCurrentPage = 0;
const itemsPerPage = 12;
let isLoading = false;
let isLoggedIn = false;
let publicCharactersCurrentUser = null;
let currentCharacterId = null;
let comments = [];
let autoNameRequestId = 0;

// CSRF token helper (no longer needed).
async function getCsrfToken() {
    return null; // CSRF token no longer required.
}

// Check user login status.
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/users/me', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const userData = await response.json();
            isLoggedIn = true;
            publicCharactersCurrentUser = userData;
            console.log('User logged in:', userData);
            return true;
        } else {
            isLoggedIn = false;
            publicCharactersCurrentUser = null;
            console.log('User not logged in, status:', response.status);
            return false;
        }
    } catch (error) {
        console.error('Failed to check login status:', error);
        isLoggedIn = false;
        publicCharactersCurrentUser = null;
        return false;
    }
}

// Update UI based on login status.
function updateUIForLoginStatus() {
    if (isLoggedIn) {
        // Logged-in users: show upload button and user info.
        $('#uploadButton').show();
        $('#userInfo').show();
        $('#loginPrompt').hide();

        // Update user info.
        if (publicCharactersCurrentUser) {
            $('#userName').text(publicCharactersCurrentUser.name || publicCharactersCurrentUser.handle);
        }
    } else {
        // Guests: hide upload button and show login prompt.
        $('#uploadButton').hide();
        $('#userInfo').hide();
        $('#loginPrompt').show();
    }
}

// Build request headers.
function getRequestHeaders(additionalHeaders = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...additionalHeaders
    };

    return headers;
}

// Show loading indicator.
function showLoading() {
    isLoading = true;
    $('#loadingIndicator').show();
}

// Hide loading indicator.
function hideLoading() {
    isLoading = false;
    $('#loadingIndicator').hide();
}

// Show error message.
function showError(message) {
    // Could use toastr or another notification library here.
    alert(message);
}

// Show success message.
function showSuccess(message) {
    // Could use toastr or another notification library here.
    alert(message);
}

// Format dates.
function formatDate(timestamp) {
    const date = parseDateInput(timestamp);
    if (!date) {
        return String(timestamp || 'Unknown');
    }
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function parseDateInput(value) {
    if (!value) {
        return null;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
    }
    if (typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'string') {
        const parsed = parseHumanizedDateTime(value);
        if (parsed) {
            return parsed;
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function parseHumanizedDateTime(value) {
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2}) @(\d{2})h (\d{2})m (\d{2})s (\d{1,3})ms$/.exec(value);
    if (!match) {
        return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);
    const millisecond = Number(match[7]);
    const date = new Date(year, month, day, hour, minute, second, millisecond);
    return Number.isNaN(date.getTime()) ? null : date;
}

async function getCharacterNameFromFile(file) {
    const fileName = String(file?.name || '').toLowerCase();
    const extension = fileName.split('.').pop() || '';
    if (extension === 'json') {
        const text = await readFileAsText(file);
        return extractNameFromCharacterData(parseJsonSafe(text));
    }
    if (extension === 'yaml' || extension === 'yml') {
        const text = await readFileAsText(file);
        return extractNameFromYaml(text);
    }
    if (extension === 'png') {
        const buffer = await readFileAsArrayBuffer(file);
        return extractNameFromPng(buffer);
    }
    return null;
}

function parseJsonSafe(text) {
    try {
        return JSON.parse(text);
    } catch (error) {
        console.debug('Failed to parse JSON character card:', error);
        return null;
    }
}

function extractNameFromCharacterData(data) {
    const name = data?.data?.name || data?.name || data?.char_name;
    if (typeof name !== 'string') {
        return null;
    }
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function extractNameFromYaml(text) {
    const lines = String(text || '').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        if (!/^\s*name\s*:/.test(line)) {
            continue;
        }
        const indent = line.match(/^\s*/)?.[0]?.length || 0;
        if (indent > 0) {
            break;
        }
        const value = extractYamlValue(line);
        if (value) {
            return value;
        }
    }

    let dataIndent = null;
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        const indent = line.match(/^\s*/)?.[0]?.length || 0;
        if (dataIndent === null) {
            if (/^\s*data\s*:\s*$/.test(line)) {
                dataIndent = indent;
            }
            continue;
        }
        if (indent <= dataIndent) {
            dataIndent = null;
            continue;
        }
        if (/^\s*name\s*:/.test(line)) {
            const value = extractYamlValue(line);
            if (value) {
                return value;
            }
        }
    }

    return null;
}

function extractYamlValue(line) {
    const match = /^\s*name\s*:\s*(.*)\s*$/.exec(line);
    if (!match) {
        return null;
    }
    let value = match[1].replace(/\s+#.*$/, '').trim();
    if (!value || value === '|' || value === '>') {
        return null;
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
    }
    return value.trim() || null;
}

function extractNameFromPng(buffer) {
    const data = new Uint8Array(buffer);
    if (data.length < 8) {
        return null;
    }
    if (data[0] !== 137 || data[1] !== 80 || data[2] !== 78 || data[3] !== 71) {
        return null;
    }
    let offset = 8;
    let charaText = null;
    while (offset + 8 <= data.length) {
        const length = readUint32(data, offset);
        const type = decodeLatin1(data.slice(offset + 4, offset + 8));
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        if (dataEnd > data.length) {
            break;
        }
        if (type === 'tEXt') {
            const chunkData = data.slice(dataStart, dataEnd);
            const nullIndex = chunkData.indexOf(0);
            if (nullIndex > -1) {
                const keyword = decodeLatin1(chunkData.slice(0, nullIndex)).toLowerCase();
                const text = decodeLatin1(chunkData.slice(nullIndex + 1));
                if (keyword === 'ccv3') {
                    const name = parseNameFromBase64Card(text);
                    if (name) {
                        return name;
                    }
                } else if (keyword === 'chara' && !charaText) {
                    charaText = text;
                }
            }
        }
        offset = dataEnd + 4;
        if (type === 'IEND') {
            break;
        }
    }
    return charaText ? parseNameFromBase64Card(charaText) : null;
}

function parseNameFromBase64Card(base64Text) {
    try {
        const jsonText = decodeBase64ToUtf8(base64Text);
        return extractNameFromCharacterData(JSON.parse(jsonText));
    } catch (error) {
        console.debug('Failed to parse PNG character metadata:', error);
        return null;
    }
}

function decodeBase64ToUtf8(base64Text) {
    const binary = atob(base64Text.replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
}

function readUint32(data, offset) {
    return ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0;
}

function decodeLatin1(bytes) {
    return new TextDecoder('latin1').decode(bytes);
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

// Load character cards.
async function loadCharacters() {
    try {
        showLoading();

        const response = await fetch('/api/public-characters/', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                // Not logged in or unauthorized: show login prompt.
                console.log('Not authorized to load public characters. Status:', response.status);
                isLoggedIn = false;
                updateUIForLoginStatus();
                showError('Please log in to access public character cards.');
                // Optional: short delay before redirecting to login.
                // setTimeout(() => { window.location.href = '/login'; }, 1500);
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        characters = data;
        filteredCharacters = [...characters];

        renderCharacters();
    } catch (error) {
        console.error('Failed to load characters:', error);
        if (String(error && error.message || '').includes('status: 401') || String(error && error.message || '').includes('status: 403')) {
            showError('Please log in to access public character cards.');
        } else {
            showError('Failed to load character cards.');
        }
    } finally {
        hideLoading();
    }
}

// Render character cards (initial load or after filtering).
function renderCharacters() {
    const grid = $('#charactersGrid');
    grid.empty();

    // Reset page index.
    publicCharactersCurrentPage = 0;

    const startIndex = 0;
    const endIndex = itemsPerPage;
    const pageCharacters = filteredCharacters.slice(startIndex, endIndex);

    if (pageCharacters.length === 0) {
        grid.html(`
            <div class="no-characters">
                <i class="fa-solid fa-search" style="font-size: 3rem; color: rgba(255,255,255,0.5); margin-bottom: 1rem;"></i>
                <h3>No character cards yet</h3>
                <p>No one has uploaded a character card yet. Be the first!</p>
            </div>
        `);
        $('#loadMoreButton').hide();
        return;
    }

    pageCharacters.forEach(character => {
        const card = createCharacterCard(character);
        grid.append(card);
    });

    // Show/hide load more button.
    updateLoadMoreButton();
}

// Append more character cards (load more).
function appendMoreCharacters() {
    const grid = $('#charactersGrid');

    const startIndex = (publicCharactersCurrentPage + 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageCharacters = filteredCharacters.slice(startIndex, endIndex);

    if (pageCharacters.length === 0) {
        $('#loadMoreButton').hide();
        return;
    }

    pageCharacters.forEach(character => {
        const card = createCharacterCard(character);
        grid.append(card);
    });

    // Update page index.
    publicCharactersCurrentPage++;

    // Show/hide load more button.
    updateLoadMoreButton();
}

// Update load-more button state.
function updateLoadMoreButton() {
    const totalLoaded = (publicCharactersCurrentPage + 1) * itemsPerPage;
    if (totalLoaded < filteredCharacters.length) {
        $('#loadMoreButton').show();
    } else {
        $('#loadMoreButton').hide();
    }
}

function getAvatarUrl(character) {
    const avatarName = String(character?.avatar || '');
    const lowerName = avatarName.toLowerCase();
    const isImage = lowerName.endsWith('.png')
        || lowerName.endsWith('.jpg')
        || lowerName.endsWith('.jpeg')
        || lowerName.endsWith('.gif')
        || lowerName.endsWith('.webp');
    if (avatarName && isImage) {
        const encodedAvatar = encodeURIComponent(avatarName);
        return `/api/public-characters/avatar/${encodedAvatar}`;
    }
    return '/img/default-expressions/neutral.png';
}

// Create character card element.
function createCharacterCard(character) {
    // Determine avatar URL based on file type.
    const avatarUrl = getAvatarUrl(character);

    const tags = character.tags || [];
    const tagsHtml = tags.map(tag => `<span class="character-tag">${tag}</span>`).join('');

    // Check delete permissions for current user.
    const canDelete = isLoggedIn && (
        publicCharactersCurrentUser?.admin ||
        character.uploader?.handle === publicCharactersCurrentUser?.handle
    );

    // Render buttons based on login state.
    const importButton = isLoggedIn ?
        `<button class="btn btn-primary import-btn" onclick="importCharacter('${character.id}')">
            <i class="fa-solid fa-download"></i>
            Import
        </button>` :
        `<button class="btn btn-secondary import-btn" onclick="showLoginPrompt()" disabled>
            <i class="fa-solid fa-lock"></i>
            Log in to import
        </button>`;

    // Delete button (only for authorized users).
    const deleteButton = canDelete ?
        `<button class="btn btn-danger delete-btn" onclick="deleteCharacter('${character.id}', '${character.name}')">
            <i class="fa-solid fa-trash"></i>
            Delete
        </button>` : '';

    return `
        <div class="character-card" data-character="${character.id}">
            <div class="character-avatar">
                <img src="${avatarUrl}" alt="${character.name}" onerror="this.src='/img/default-expressions/neutral.png'">
            </div>
            <div class="character-info">
                <div class="character-content">
                    <h3 class="character-name">${character.name}</h3>
                    <p class="character-description">${character.description || 'No description yet.'}</p>
                </div>
                <div class="character-footer">
                    <div class="character-meta">
                        <span class="character-uploader">
                            <i class="fa-solid fa-user"></i>
                            ${character.uploader?.name || character.uploader || 'Unknown'}
                        </span>
                        <span class="character-date">
                            <i class="fa-solid fa-calendar"></i>
                            ${formatDate(character.uploaded_at || character.date_added)}
                        </span>
                    </div>
                    ${tagsHtml ? `<div class="character-tags">${tagsHtml}</div>` : ''}
                </div>
            </div>
            <div class="character-actions">
                ${importButton}
                <button class="btn btn-secondary view-btn" onclick="viewCharacter('${character.id}')">
                    <i class="fa-solid fa-eye"></i>
                    View
                </button>
                ${deleteButton}
            </div>
        </div>
    `;
}

// Search and filter character cards.
function filterCharacters() {
    const searchTerm = String($('#searchInput').val() || '').toLowerCase();
    const sortBy = String($('#sortSelect').val() || '');

    filteredCharacters = characters.filter(character => {
        const nameMatch = character.name.toLowerCase().includes(searchTerm);
        const descriptionMatch = (character.description || '').toLowerCase().includes(searchTerm);
        const uploaderMatch = String(character.uploader?.name || character.uploader || '').toLowerCase().includes(searchTerm);
        const tagsMatch = (character.tags || []).some(tag => tag.toLowerCase().includes(searchTerm));

        return nameMatch || descriptionMatch || uploaderMatch || tagsMatch;
    });

    // Sort.
    filteredCharacters.sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'uploader':
                const uploaderA = a.uploader?.name || a.uploader || '';
                const uploaderB = b.uploader?.name || b.uploader || '';
                return uploaderA.localeCompare(uploaderB);
            case 'date':
            default:
                const dateA = parseDateInput(a.uploaded_at || a.date_added);
                const dateB = parseDateInput(b.uploaded_at || b.date_added);
                return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
        }
    });

    publicCharactersCurrentPage = 0;
    renderCharacters();
}

// Import character card.
async function importCharacter(characterId) {
    if (!isLoggedIn) {
        showError('Please log in to import character cards.');
        return;
    }

    try {
        const response = await fetch(`/api/public-characters/${characterId}/import`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Import failed.');
        }

        const data = await response.json();
        showSuccess(data.message || 'Character card imported to your library.');

        // Optionally redirect to the library page.
        // window.location.href = '/';

    } catch (error) {
        console.error('Failed to import character:', error);
        showError(`Import failed: ${error.message}`);
    }
}

// Delete character card.
async function deleteCharacter(characterId, characterDisplayName) {
    if (!isLoggedIn) {
        showError('Please log in to delete character cards.');
        return;
    }

    // Confirm deletion.
    if (!confirm(`Are you sure you want to delete character card "${characterDisplayName}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/public-characters/${characterId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Delete failed.');
        }

        const result = await response.json();
        showSuccess(`Character card "${characterDisplayName}" deleted successfully.`);

        // Refresh list.
        await loadCharacters();
    } catch (error) {
        console.error('Failed to delete character:', error);
        showError(`Delete failed: ${error.message}`);
    }
}

// View character card details.
async function viewCharacter(characterId) {
    try {
        const response = await fetch(`/api/public-characters/${characterId}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch character card details.');
        }

        const character = await response.json();
        showCharacterModal(character);

    } catch (error) {
        console.error('Failed to get character details:', error);
        showError('Failed to fetch character card details.');
    }
}

// Show login prompt.
function showLoginPrompt() {
    showError('Please log in to import character cards.');
}

// Show character card detail modal.
function showCharacterModal(character) {
    // Set current character ID.
    currentCharacterId = character.id;

    // Determine avatar URL based on file type.
    const avatarUrl = getAvatarUrl(character);

    const tags = character.tags || [];
    const tagsHtml = tags.map(tag => `<span class="character-tag">${tag}</span>`).join('');

    $('#characterModalTitle').text(character.name);
    $('#characterModalAvatar').attr('src', avatarUrl);
    $('#characterModalName').text(character.name);
    $('#characterModalDescription').text(character.description || 'No description yet.');
    $('#characterModalUploader').text(character.uploader?.name || character.uploader || 'Unknown');
    $('#characterModalDate').text(formatDate(character.uploaded_at || character.date_added));
    $('#characterModalTags').html(tagsHtml);

    // Set import button based on login state.
    if (isLoggedIn) {
        $('#importCharacterButton').off('click').on('click', () => {
            importCharacter(character.id);
            $('#characterModal').hide();
        });
        $('#importCharacterButton').prop('disabled', false).html('<i class="fa-solid fa-download"></i> Import to my library');
    } else {
        $('#importCharacterButton').off('click').on('click', () => {
            showLoginPrompt();
            $('#characterModal').hide();
        });
        $('#importCharacterButton').prop('disabled', true).html('<i class="fa-solid fa-lock"></i> Log in to import');
    }

    // Bind view button.
    $('#viewCharacterButton').off('click').on('click', () => {
        // Could navigate to a detail page or show more info.
        $('#characterModal').hide();
    });

    // Update comment section visibility.
    updateCommentsSection();

    // Load comments.
    loadComments(character.id);

    $('#characterModal').show();
}

// Upload character card.
async function uploadCharacter(formData) {
    try {
        const response = await fetch('/api/public-characters/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload failed.');
        }

        const data = await response.json();
        showSuccess(`Character card "${data.name}" uploaded successfully.`);

        // Reload list.
        await loadCharacters();

        // Close upload modal.
        $('#uploadModal').hide();
        /** @type {HTMLFormElement} */ ($('#uploadForm')[0]).reset();

    } catch (error) {
        console.error('Failed to upload character:', error);
        showError(`Upload failed: ${error.message}`);
    }
}

// Load more character cards.
function loadMore() {
    const button = $('#loadMoreButton');
    const originalText = button.html();

    // Show loading state.
    button.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> Loading...');

    // Simulate async loading for feedback.
    setTimeout(() => {
        appendMoreCharacters();

        // Restore button state.
        button.prop('disabled', false).html(originalText);
    }, 300);
}

// Event listeners.
$(document).ready(async function() {
    try {
        // Check login status.
        await checkLoginStatus();

        // Update UI based on login state.
        updateUIForLoginStatus();

        // Load character cards.
        await loadCharacters();

        // Search input.
        $('#searchInput').on('input', filterCharacters);

        // Sort selection.
        $('#sortSelect').on('change', filterCharacters);

        // Load more button.
        $('#loadMoreButton').on('click', loadMore);

        // Upload button (only visible to logged-in users).
        $('#uploadButton').on('click', () => {
            if (!isLoggedIn) {
                showError('Please log in to upload character cards.');
                return;
            }
            $('#uploadModal').show();
        });

        // Close upload modal.
        $('#closeUploadModal, #cancelUpload').on('click', () => {
            $('#uploadModal').hide();
            /** @type {HTMLFormElement} */ ($('#uploadForm')[0]).reset();
        });

        // Close detail modal.
        $('#closeCharacterModal').on('click', () => {
            $('#characterModal').hide();
        });

        // Close when clicking outside modal.
        $('.modal').on('click', function(e) {
            if (e.target === this) {
                $(this).hide();
            }
        });

        // Upload form submit.
        $('#uploadForm').on('submit', async function(e) {
            e.preventDefault();

            if (!isLoggedIn) {
                showError('Please log in to upload character cards.');
                return;
            }

            const fileInput = $('#characterFile')[0];
            const nameInput = String($('#characterName').val() || '');
            const descriptionInput = String($('#characterDescription').val() || '');
            const tagsInput = String($('#characterTags').val() || '');

            if (!/** @type {HTMLInputElement} */ (fileInput).files || !/** @type {HTMLInputElement} */ (fileInput).files[0]) {
                showError('Please choose a character card file.');
                return;
            }

            if (!nameInput.trim()) {
                showError('Please enter a character name.');
                return;
            }

            const formData = new FormData();
            formData.append('avatar', /** @type {HTMLInputElement} */ (fileInput).files[0]);

            // Get file extension.
            const fileName = /** @type {HTMLInputElement} */ (fileInput).files[0].name;
            const extension = fileName.split('.').pop()?.toLowerCase() || '';
            formData.append('file_type', extension);

            // Add additional metadata.
            if (nameInput.trim()) {
                formData.append('name', nameInput.trim());
            }
            if (descriptionInput.trim()) {
                formData.append('description', descriptionInput.trim());
            }
            if (tagsInput.trim()) {
                const tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);
                formData.append('tags', JSON.stringify(tags));
            }

            await uploadCharacter(formData);
        });

        // Auto-fill name when selecting file.
        $('#characterFile').on('change', async function() {
            const file = /** @type {HTMLInputElement} */ (this).files?.[0];
            if (!file) {
                return;
            }
            const fileName = file.name;
            const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
            $('#characterName').val(nameWithoutExt);
            const requestId = ++autoNameRequestId;
            try {
                const extractedName = await getCharacterNameFromFile(file);
                if (!extractedName || requestId !== autoNameRequestId) {
                    return;
                }
                $('#characterName').val(extractedName);
            } catch (error) {
                console.debug('Failed to extract character name:', error);
            }
        });

        // Comment-related events.
        $('#submitCommentButton').on('click', submitComment);

        // Submit comment with Ctrl + Enter.
        $('#commentInput').on('keydown', function(e) {
            if (e.ctrlKey && e.keyCode === 13) { // Ctrl + Enter
                submitComment();
            }
        });

    } catch (error) {
        console.error('Failed to initialize page:', error);
        showError('Page initialization failed. Please refresh and try again.');
    }
});

// Add styles to the page.
$('<style>').text(`
    .no-characters {
        grid-column: 1 / -1;
        text-align: center;
        padding: 3rem;
        color: rgba(255,255,255,0.7);
    }

    .no-characters h3 {
        margin: 1rem 0 0.5rem 0;
        color: #ffffff;
    }

    .no-characters p {
        margin: 0;
        font-size: 1rem;
    }
`).appendTo('head');

// Comment functionality.

// Load character comments.
async function loadComments(characterId) {
    try {
        const response = await fetch(`/api/public-characters/${characterId}/comments`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        comments = await response.json();
        renderComments();
        updateCommentsCount();
    } catch (error) {
        console.error('Failed to load comments:', error);
        showError('Failed to load comments.');
    }
}

// Render comment list.
function renderComments() {
    const commentsList = $('#commentsList');
    commentsList.empty();

    if (comments.length === 0) {
        commentsList.html(`
            <div class="no-comments">
                <i class="fa-solid fa-comment" style="font-size: 2rem; color: rgba(255,255,255,0.3); margin-bottom: 1rem;"></i>
                <p>No comments yet. Be the first to comment!</p>
            </div>
        `);
        return;
    }

    comments.forEach(comment => {
        const commentElement = createCommentElement(comment, 0);
        commentsList.append(commentElement);
    });
}

// Create comment element.
function createCommentElement(comment, depth = 0) {
    const isAuthor = isLoggedIn && publicCharactersCurrentUser && comment.author.handle === publicCharactersCurrentUser.handle;
    const isAdmin = isLoggedIn && publicCharactersCurrentUser && publicCharactersCurrentUser.admin;
    const canDelete = isAuthor || isAdmin;

    const deleteButton = canDelete ?
        `<button class="comment-delete" onclick="deleteComment('${comment.id}')" title="Delete comment">
            <i class="fa-solid fa-trash"></i>
        </button>` : '';

    const replyButton = isLoggedIn ?
        `<button class="comment-reply" onclick="showReplyInput('${comment.id}')" title="Reply">
            <i class="fa-solid fa-reply"></i>
            Reply
        </button>` : '';

    let repliesHtml = '';
    if (comment.replies && comment.replies.length > 0) {
        repliesHtml = '<div class="comment-replies">';
        comment.replies.forEach(reply => {
            repliesHtml += createCommentElement(reply, depth + 1);
        });
        repliesHtml += '</div>';
    }

    return `
        <div class="comment-item" data-comment-id="${comment.id}" style="margin-left: ${depth * 20}px;">
            <div class="comment-header">
                <div class="comment-author">
                    <i class="fa-solid fa-user"></i>
                    <span class="author-name">${comment.author.name || comment.author.handle}</span>
                    <span class="comment-date">${formatDate(comment.created_at)}</span>
                </div>
                <div class="comment-actions">
                    ${replyButton}
                    ${deleteButton}
                </div>
            </div>
            <div class="comment-content">
                ${escapeHtml(comment.content)}
            </div>
            <div class="comment-reply-input" id="replyInput_${comment.id}" style="display: none;">
                <textarea class="reply-textarea" placeholder="Write your reply..." rows="2"></textarea>
                <div class="reply-actions">
                    <button class="btn btn-primary btn-small" onclick="submitReply('${comment.id}')">
                        <i class="fa-solid fa-paper-plane"></i>
                        Reply
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="cancelReply('${comment.id}')">
                        Cancel
                    </button>
                </div>
            </div>
            ${repliesHtml}
        </div>
    `;
}

// HTML escaping helper.
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

// Update comment count.
function updateCommentsCount() {
    const totalComments = countTotalComments(comments);
    $('#commentsCount').text(`${totalComments} comments`);
}

// Recursively count comments.
function countTotalComments(commentsList) {
    let count = commentsList.length;
    commentsList.forEach(comment => {
        if (comment.replies && comment.replies.length > 0) {
            count += countTotalComments(comment.replies);
        }
    });
    return count;
}

// Submit comment.
async function submitComment() {
    if (!isLoggedIn) {
        showError('Please log in to post a comment.');
        return;
    }

    const content = String($('#commentInput').val() || '').trim();
    if (!content) {
        showError('Please enter a comment.');
        return;
    }

    try {
        const response = await fetch(`/api/public-characters/${currentCharacterId}/comments`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: content
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Comment failed.');
        }

        const newComment = await response.json();
        comments.push(newComment);

        // Clear input.
        $('#commentInput').val('');

        // Re-render comments.
        renderComments();
        updateCommentsCount();

        showSuccess('Comment posted successfully!');
    } catch (error) {
        console.error('Failed to submit comment:', error);
        showError(`Comment failed: ${error.message}`);
    }
}

// Show reply input.
function showReplyInput(commentId) {
    if (!isLoggedIn) {
        showError('Please log in to reply to comments.');
        return;
    }

    // Hide other reply inputs.
    $('.comment-reply-input').hide();

    // Show reply input for the selected comment.
    $(`#replyInput_${commentId}`).show();
    $(`#replyInput_${commentId} .reply-textarea`).focus();
}

// Cancel reply.
function cancelReply(commentId) {
    $(`#replyInput_${commentId}`).hide();
    $(`#replyInput_${commentId} .reply-textarea`).val('');
}

// Submit reply.
async function submitReply(parentId) {
    if (!isLoggedIn) {
        showError('Please log in to reply to comments.');
        return;
    }

    const content = String($(`#replyInput_${parentId} .reply-textarea`).val() || '').trim();
    if (!content) {
        showError('Please enter a reply.');
        return;
    }

    try {
        const response = await fetch(`/api/public-characters/${currentCharacterId}/comments`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: content,
                parentId: parentId
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Reply failed.');
        }

        // Reload comments.
        await loadComments(currentCharacterId);

        // Hide reply input.
        cancelReply(parentId);

        showSuccess('Reply posted successfully!');
    } catch (error) {
        console.error('Failed to submit reply:', error);
        showError(`Reply failed: ${error.message}`);
    }
}

// Delete comment.
async function deleteComment(commentId) {
    if (!isLoggedIn) {
        showError('Please log in to delete comments.');
        return;
    }

    if (!confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/api/public-characters/${currentCharacterId}/comments/${commentId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Delete failed.');
        }

        // Reload comments.
        await loadComments(currentCharacterId);

        showSuccess('Comment deleted successfully!');
    } catch (error) {
        console.error('Failed to delete comment:', error);
        showError(`Delete failed: ${error.message}`);
    }
}

// Update comment section visibility.
function updateCommentsSection() {
    if (isLoggedIn) {
        $('#commentInputSection').show();
        $('#commentLoginPrompt').hide();
    } else {
        $('#commentInputSection').hide();
        $('#commentLoginPrompt').show();
    }
}
