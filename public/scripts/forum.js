// Forum page JavaScript.
let currentUser = null;
let articles = [];
let currentPage = 1;
let articlesPerPage = 12;
let currentArticle = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeForum();
});

async function initializeForum() {
    try {
        // Check user login status with retries.
        await checkUserStatus();

        // Load posts.
        await loadArticles();

        // Bind events.
        bindEvents();

    } catch (error) {
        console.error('Forum initialization error:', error);
    }
}

async function checkUserStatus(retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 500; // Milliseconds.

    try {
        const response = await fetch('/api/users/me', {
            credentials: 'include',
            cache: 'no-cache'
        });

        if (response.ok) {
            const user = await response.json();
            currentUser = user;
            updateUserInterface(user);
            console.log('User logged in:', user.handle);
        } else {
            // Retry on 401 if we still have attempts left.
            if (response.status === 401 && retryCount < maxRetries) {
                console.log(`User status check failed (attempt ${retryCount + 1}/${maxRetries + 1}), retrying...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return await checkUserStatus(retryCount + 1);
            }
            currentUser = null;
            updateUserInterface(null);
        }
    } catch (error) {
        console.error('Error checking user status:', error);
        // Retry on network error if we still have attempts left.
        if (retryCount < maxRetries) {
            console.log(`Network error (attempt ${retryCount + 1}/${maxRetries + 1}), retrying...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return await checkUserStatus(retryCount + 1);
        }
        currentUser = null;
        updateUserInterface(null);
    }
}

function updateUserInterface(user) {
    const userInfo = document.getElementById('userInfo');
    const loginPrompt = document.getElementById('loginPrompt');
    const userName = document.getElementById('userName');

    if (user) {
        // currentUser is set in checkUserStatus; only update UI here.
        userInfo.style.display = 'flex';
        loginPrompt.style.display = 'none';
        userName.textContent = user.name || user.handle;
        console.log('UI updated for logged-in user:', user.handle);
    } else {
        // currentUser is set to null in checkUserStatus; only update UI here.
        userInfo.style.display = 'none';
        loginPrompt.style.display = 'block';
        console.log('UI updated for logged-out state');
    }
}

async function loadArticles() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const articlesGrid = document.getElementById('articlesGrid');
    const noArticles = document.getElementById('noArticles');

    try {
        loadingIndicator.style.display = 'block';
        noArticles.style.display = 'none';

        const response = await fetch('/api/forum/articles', {
            credentials: 'include'
        });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                // Not logged in or unauthorized: show login prompt without throwing.
                updateUserInterface(null);
                articlesGrid.innerHTML = '<div class="error-message">Please log in to access the forum.</div>';
                return;
            }
            throw new Error('Failed to load articles');
        }

        articles = await response.json();
        renderArticles();

    } catch (error) {
        console.error('Error loading articles:', error);
        if (String(error && error.message || '').includes('401') || String(error && error.message || '').includes('403')) {
            articlesGrid.innerHTML = '<div class="error-message">Please log in to access the forum.</div>';
        } else {
            articlesGrid.innerHTML = '<div class="error-message">Failed to load posts. Please refresh and try again.</div>';
        }
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

function renderArticles() {
    const articlesGrid = document.getElementById('articlesGrid');
    const noArticles = document.getElementById('noArticles');

    if (articles.length === 0) {
        articlesGrid.innerHTML = '';
        noArticles.style.display = 'block';
        return;
    }

    noArticles.style.display = 'none';

    const startIndex = (currentPage - 1) * articlesPerPage;
    const endIndex = startIndex + articlesPerPage;
    const pageArticles = articles.slice(startIndex, endIndex);

    articlesGrid.innerHTML = pageArticles.map(article => createArticleCard(article)).join('');

    updatePagination();
}

function createArticleCard(article) {
    const excerpt = stripHtml(article.content).substring(0, 150) + '...';
    const tags = article.tags ? article.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : '';
    const categoryName = getCategoryName(article.category);

    return `
        <div class="article-card" onclick="openArticleDetail('${article.id}')">
            <div class="article-header">
                <h3 class="article-title">${escapeHtml(article.title)}</h3>
                <div class="article-meta">
                    <span><i class="fa-solid fa-user"></i> ${escapeHtml(article.author.name)}</span>
                    <span><i class="fa-solid fa-calendar"></i> ${formatDate(article.created_at)}</span>
                    <span><i class="fa-solid fa-eye"></i> ${article.views || 0}</span>
                </div>
            </div>
            <div class="article-content">
                <p class="article-excerpt">${escapeHtml(excerpt)}</p>
                <div class="article-tags">${tags}</div>
            </div>
            <div class="article-footer">
                <div class="article-stats">
                    <span><i class="fa-solid fa-heart"></i> ${article.likes || 0}</span>
                    <span><i class="fa-solid fa-comment"></i> ${article.comments_count || 0}</span>
                </div>
                <span class="article-category">${categoryName}</span>
            </div>
        </div>
    `;
}

function bindEvents() {
    // Search.
    const searchInput = /** @type {HTMLInputElement} */ (document.getElementById('searchInput'));
    searchInput.addEventListener('input', debounce(handleSearch, 300));

    // Filters.
    const categoryFilter = /** @type {HTMLSelectElement} */ (document.getElementById('categoryFilter'));
    const sortFilter = /** @type {HTMLSelectElement} */ (document.getElementById('sortFilter'));
    categoryFilter.addEventListener('change', handleFilter);
    sortFilter.addEventListener('change', handleFilter);

    // Publish button: remove inline onclick and bind event.
    const publishButton = /** @type {HTMLButtonElement|null} */ (document.querySelector('button[onclick="createArticle()"]'));
    if (publishButton) {
        publishButton.removeAttribute('onclick');
        publishButton.addEventListener('click', createArticle);
    }

    // Post form submission.
    const articleForm = /** @type {HTMLFormElement} */ (document.getElementById('articleForm'));
    articleForm.addEventListener('submit', handleArticleSubmit);
}

function handleSearch() {
    const searchTerm = /** @type {HTMLInputElement} */ (document.getElementById('searchInput')).value.toLowerCase();

    if (!searchTerm) {
        renderArticles();
        return;
    }

    const filteredArticles = articles.filter(article =>
        article.title.toLowerCase().includes(searchTerm) ||
        article.content.toLowerCase().includes(searchTerm) ||
        (article.tags && article.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
    );

    renderFilteredArticles(filteredArticles);
}

function handleFilter() {
    const category = /** @type {HTMLSelectElement} */ (document.getElementById('categoryFilter')).value;
    const sort = /** @type {HTMLSelectElement} */ (document.getElementById('sortFilter')).value;

    let filteredArticles = [...articles];

    // Filter by category.
    if (category) {
        filteredArticles = filteredArticles.filter(article => article.category === category);
    }

    // Sort.
    switch (sort) {
        case 'popular':
            filteredArticles.sort((a, b) => (b.likes || 0) - (a.likes || 0));
            break;
        case 'views':
            filteredArticles.sort((a, b) => (b.views || 0) - (a.views || 0));
            break;
        default: // latest
            filteredArticles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    renderFilteredArticles(filteredArticles);
}

function renderFilteredArticles(filteredArticles) {
    const articlesGrid = document.getElementById('articlesGrid');
    const noArticles = document.getElementById('noArticles');

    if (filteredArticles.length === 0) {
        articlesGrid.innerHTML = '';
        noArticles.style.display = 'block';
        return;
    }

    noArticles.style.display = 'none';
    articlesGrid.innerHTML = filteredArticles.map(article => createArticleCard(article)).join('');
}

function createArticle() {
    if (!currentUser) {
        alert('Please log in first.');
        return;
    }

    (/** @type {HTMLElement} */ (document.getElementById('articleModal'))).style.display = 'flex';
    (/** @type {HTMLFormElement} */ (document.getElementById('articleForm'))).reset();
    document.getElementById('articleModalTitle').textContent = 'Publish new post';
}

function closeArticleModal() {
    document.getElementById('articleModal').style.display = 'none';
}

async function handleArticleSubmit(e) {
    e.preventDefault();

    if (!currentUser) {
        alert('Please log in first.');
        return;
    }

    const titleInput = /** @type {HTMLInputElement} */ (document.getElementById('articleTitle'));
    const contentEl = /** @type {HTMLElement} */ (document.getElementById('articleContent'));
    const categorySelect = /** @type {HTMLSelectElement} */ (document.getElementById('articleCategory'));
    const tagsInput = /** @type {HTMLInputElement} */ (document.getElementById('articleTags'));

    const formData = {
        title: titleInput.value.trim(),
        content: contentEl.innerHTML.trim(),
        category: categorySelect.value,
        tags: tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag)
    };

    if (!formData.title || !formData.content) {
        alert('Please enter both a title and content.');
        return;
    }

    try {
        // Get CSRF token.
        const csrfToken = await getCsrfToken();

        const headers = /** @type {HeadersInit} */ ({
            'Content-Type': 'application/json',
        });

        if (csrfToken) {
            headers['x-csrf-token'] = csrfToken;
        }

        const response = await fetch('/api/forum/articles', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(formData),
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to publish post.');
        }

        const newArticle = await response.json();
        articles.unshift(newArticle);
        renderArticles();
        closeArticleModal();

        alert('Post published successfully!');

    } catch (error) {
        console.error('Error creating article:', error);
        alert(error.message || 'Failed to publish post. Please try again.');
    }
}

// Get CSRF token.
async function getCsrfToken() {
    try {
        const response = await fetch('/csrf-token', {
            credentials: 'include'
        });
        if (response.ok) {
            const data = await response.json();
            return data.token;
        }
    } catch (error) {
        console.error('Error getting CSRF token:', error);
    }
    return null;
}

async function openArticleDetail(articleId) {
    try {
        const response = await fetch(`/api/forum/articles/${articleId}`, { credentials: 'include' });
        if (!response.ok) {
            throw new Error('Failed to load article');
        }

        currentArticle = await response.json();
        renderArticleDetail();
        document.getElementById('articleDetailModal').style.display = 'flex';

    } catch (error) {
        console.error('Error loading article detail:', error);
        alert('Failed to load post details.');
    }
}

function renderArticleDetail() {
    if (!currentArticle) return;

    document.getElementById('articleDetailTitle').textContent = currentArticle.title;
    document.getElementById('articleDetailAuthor').textContent = currentArticle.author.name;
    document.getElementById('articleDetailDate').textContent = formatDate(currentArticle.created_at);
    document.getElementById('articleDetailCategory').textContent = getCategoryName(currentArticle.category);
    document.getElementById('articleDetailViews').textContent = currentArticle.views || 0;
    document.getElementById('articleDetailContent').innerHTML = currentArticle.content;
    document.getElementById('articleLikes').textContent = currentArticle.likes || 0;
    document.getElementById('commentsCount').textContent = currentArticle.comments_count || 0;

    // Render tags.
    const tagsContainer = document.getElementById('articleDetailTags');
    if (currentArticle.tags && currentArticle.tags.length > 0) {
        tagsContainer.innerHTML = currentArticle.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
    } else {
        tagsContainer.innerHTML = '';
    }

    // Render comments.
    renderComments();

    // Show/hide delete button.
    const deleteBtn = /** @type {HTMLButtonElement} */ (document.getElementById('deleteArticleBtn'));
    if (currentUser && (currentUser.handle === currentArticle.author.handle || currentUser.admin)) {
        deleteBtn.style.display = 'inline-flex';
        // Bind delete event.
        deleteBtn.onclick = () => deleteArticle(currentArticle.id);
    } else {
        deleteBtn.style.display = 'none';
    }

    // Update like button state.
    updateLikeButtonState();
}

function renderComments() {
    const commentsList = /** @type {HTMLElement} */ (document.getElementById('commentsList'));
    const commentForm = /** @type {HTMLElement} */ (document.getElementById('commentForm'));

    if (!currentUser) {
        commentForm.style.display = 'none';
    } else {
        commentForm.style.display = 'block';
    }

    if (!currentArticle.comments || currentArticle.comments.length === 0) {
        commentsList.innerHTML = '<p style="text-align: center; color: #666;">No comments yet.</p>';
        return;
    }

    // Build nested comments.
    const commentsHtml = buildNestedComments(currentArticle.comments);
    commentsList.innerHTML = commentsHtml;
}

function buildNestedComments(comments, parentId = null, level = 0) {
    // Filter comments at the current level.
    const currentLevelComments = comments.filter(comment => comment.parent_id === parentId);

    if (currentLevelComments.length === 0) {
        return '';
    }

    let html = '';

    for (const comment of currentLevelComments) {
        html += createCommentHtml(comment, level);

        // Recursively append child comments.
        const childComments = buildNestedComments(comments, comment.id, level + 1);
        if (childComments) {
            html += childComments;
        }
    }

    return html;
}

function createCommentHtml(comment, level = 0) {
    const canDelete = currentUser && (
        currentUser.handle === comment.author.handle ||
        currentUser.admin
    );

    const deleteButton = canDelete ?
        `<button class="comment-delete-btn" onclick="deleteComment('${comment.id}')">
            <i class="fa-solid fa-trash"></i>
        </button>` : '';

    const replyButton = currentUser ?
        `<button class="comment-reply-btn" onclick="showReplyForm('${comment.id}')">
            <i class="fa-solid fa-reply"></i> Reply
        </button>` : '';

    const marginLeft = level * 30; // Indent 30px per level.

    return `
        <div class="comment" style="margin-left: ${marginLeft}px;" data-comment-id="${comment.id}">
            <div class="comment-header">
                <span class="comment-author">${escapeHtml(comment.author.name)}</span>
                <span class="comment-date">${formatDate(comment.created_at)}</span>
                <div class="comment-actions">
                    ${replyButton}
                    ${deleteButton}
                </div>
            </div>
            <div class="comment-content">${escapeHtml(comment.content)}</div>

            <!-- Reply form -->
            <div class="reply-form" id="replyForm_${comment.id}" style="display: none;">
                <textarea placeholder="Write your reply..." rows="2"></textarea>
                <div class="reply-actions">
                    <button class="btn btn-primary btn-sm" onclick="submitReply('${comment.id}')">
                        <i class="fa-solid fa-paper-plane"></i> Reply
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="hideReplyForm('${comment.id}')">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
}

function closeArticleDetailModal() {
    document.getElementById('articleDetailModal').style.display = 'none';
    currentArticle = null;
}

async function submitComment() {
    // Re-check user login status.
    if (!currentUser) {
        console.warn('submitComment: currentUser is null, checking user status...');
        await checkUserStatus();

        // Check again.
        if (!currentUser) {
            alert('Please log in to post a comment.');
            window.location.href = '/login';
            return;
        }
    }

    if (!currentArticle) {
        alert('Failed to load post details. Please refresh.');
        return;
    }

    const contentTextarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('commentContent'));
    const content = contentTextarea.value.trim();
    if (!content) {
        alert('Please enter a comment.');
        return;
    }

    try {
        // Get CSRF token.
        const csrfToken = await getCsrfToken();

        const headers = /** @type {HeadersInit} */ ({
            'Content-Type': 'application/json',
        });

        if (csrfToken) {
            headers['x-csrf-token'] = csrfToken;
        }

        const response = await fetch(`/api/forum/articles/${currentArticle.id}/comments`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ content }),
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Your login has expired. Please log in again.');
                window.location.href = '/login';
                return;
            }
            const error = await response.json();
            throw new Error(error.error || 'Failed to post comment.');
        }

        const newComment = await response.json();
        currentArticle.comments = currentArticle.comments || [];
        currentArticle.comments.push(newComment);
        currentArticle.comments_count = (currentArticle.comments_count || 0) + 1;

        renderComments();
        contentTextarea.value = '';
        document.getElementById('commentsCount').textContent = currentArticle.comments_count;

        // Show success indicator.
        console.log('Comment submitted successfully');

    } catch (error) {
        console.error('Error submitting comment:', error);
        alert(error.message || 'Failed to post comment. Please try again.');
    }
}

// Delete post.
async function deleteArticle(articleId) {
    if (!currentUser) {
        alert('Please log in first.');
        return;
    }

    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        return;
    }

    try {
        // Get CSRF token.
        const csrfToken = await getCsrfToken();

        /** @type {HeadersInit} */
        const headers = csrfToken ? { 'x-csrf-token': csrfToken } : {};

        const response = await fetch(`/api/forum/articles/${articleId}`, {
            method: 'DELETE',
            headers: headers,
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Delete failed.');
        }

        // On success, close modal and reload list.
        closeArticleDetailModal();
        await loadArticles();
        alert('Post deleted successfully!');

    } catch (error) {
        console.error('Error deleting article:', error);
        alert(error.message || 'Delete failed. Please try again.');
    }
}

// Show reply form.
function showReplyForm(commentId) {
    // Hide other reply forms.
    document.querySelectorAll('.reply-form').forEach(form => {
        (/** @type {HTMLElement} */ (form)).style.display = 'none';
    });

    // Show reply form for current comment.
    const replyForm = /** @type {HTMLElement} */ (document.getElementById(`replyForm_${commentId}`));
    if (replyForm) {
        replyForm.style.display = 'block';
        const textarea = /** @type {HTMLTextAreaElement} */ (replyForm.querySelector('textarea'));
        textarea.focus();
    }
}

// Hide reply form.
function hideReplyForm(commentId) {
    const replyForm = /** @type {HTMLElement} */ (document.getElementById(`replyForm_${commentId}`));
    if (replyForm) {
        replyForm.style.display = 'none';
        const textarea = /** @type {HTMLTextAreaElement} */ (replyForm.querySelector('textarea'));
        textarea.value = '';
    }
}

// Submit reply.
async function submitReply(parentCommentId) {
    // Re-check user login status.
    if (!currentUser) {
        console.warn('submitReply: currentUser is null, checking user status...');
        await checkUserStatus();

        // Check again.
        if (!currentUser) {
            alert('Please log in to reply.');
            window.location.href = '/login';
            return;
        }
    }

    if (!currentArticle) {
        alert('Failed to load post details. Please refresh.');
        return;
    }

    const replyForm = document.getElementById(`replyForm_${parentCommentId}`);
    const textarea = replyForm.querySelector('textarea');
    const content = textarea.value.trim();

    if (!content) {
        alert('Please enter a reply.');
        return;
    }

    try {
        // Get CSRF token.
        const csrfToken = await getCsrfToken();

        const headers = {
            'Content-Type': 'application/json',
        };

        if (csrfToken) {
            headers['x-csrf-token'] = csrfToken;
        }

        const response = await fetch(`/api/forum/articles/${currentArticle.id}/comments`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                content: content,
                parent_id: parentCommentId
            }),
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Your login has expired. Please log in again.');
                window.location.href = '/login';
                return;
            }
            const error = await response.json();
            throw new Error(error.error || 'Reply failed.');
        }

        const newReply = await response.json();
        currentArticle.comments = currentArticle.comments || [];
        currentArticle.comments.push(newReply);
        currentArticle.comments_count = (currentArticle.comments_count || 0) + 1;

        renderComments();
        hideReplyForm(parentCommentId);
        document.getElementById('commentsCount').textContent = currentArticle.comments_count;

        // Show success indicator.
        console.log('Reply submitted successfully');

    } catch (error) {
        console.error('Error submitting reply:', error);
        alert(error.message || 'Reply failed. Please try again.');
    }
}

/**
 * Recursively collect comment IDs, including replies.
 * @param {string} commentId Comment ID
 * @param {Array} comments Full comment list
 * @returns {Array<string>} Comment IDs
 */
function getCommentAndChildrenIds(commentId, comments) {
    const ids = [commentId];
    const children = comments.filter(c => c.parent_id === commentId);

    for (const child of children) {
        ids.push(...getCommentAndChildrenIds(child.id, comments));
    }

    return ids;
}

// Delete comment.
async function deleteComment(commentId) {
    if (!currentUser) {
        alert('Please log in first.');
        return;
    }

    if (!confirm('Are you sure you want to delete this comment? This action cannot be undone.\nNote: This will also remove all replies.')) {
        return;
    }

    try {
        // Get CSRF token.
        const csrfToken = await getCsrfToken();

        /** @type {HeadersInit} */
        const headers = csrfToken ? { 'x-csrf-token': csrfToken } : {};

        const response = await fetch(`/api/forum/comments/${commentId}`, {
            method: 'DELETE',
            headers: headers,
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Delete failed.');
        }

        const result = await response.json();
        const deletedCount = result.deletedCount || 1;

        // Collect all IDs to remove (including replies).
        const idsToDelete = getCommentAndChildrenIds(commentId, currentArticle.comments);

        // Remove deleted comments from the list.
        currentArticle.comments = currentArticle.comments.filter(comment => !idsToDelete.includes(comment.id));
        currentArticle.comments_count = Math.max(0, (currentArticle.comments_count || 0) - deletedCount);

        renderComments();
        document.getElementById('commentsCount').textContent = currentArticle.comments_count;

        if (deletedCount > 1) {
            alert(`Deleted ${deletedCount} comments (including replies).`);
        } else {
            alert('Comment deleted successfully.');
        }

    } catch (error) {
        console.error('Error deleting comment:', error);
        alert(error.message || 'Delete failed. Please try again.');
    }
}

// Like post.
async function likeArticle() {
    if (!currentUser) {
        alert('Please log in to like this post.');
        return;
    }

    if (!currentArticle) {
        alert('Failed to load post details.');
        return;
    }

    try {
        // Get CSRF token.
        const csrfToken = await getCsrfToken();

        const headers = {
            'Content-Type': 'application/json',
        };

        if (csrfToken) {
            headers['x-csrf-token'] = csrfToken;
        }

        const response = await fetch(`/api/forum/articles/${currentArticle.id}/like`, {
            method: 'POST',
            headers: headers,
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Like failed.');
        }

        const result = await response.json();

        // Update article data.
        currentArticle.likes = result.likes;
        currentArticle.user_liked = result.liked;

        // Update like count display.
        const likesElement = document.getElementById('articleLikes');
        likesElement.textContent = result.likes;

        // Update like button state.
        updateLikeButtonState();

        // Add a small animation to the like count.
        if (likesElement) {
            likesElement.style.color = result.liked ? '#ff6b6b' : '#4CAF50';
            likesElement.style.transform = 'scale(1.2)';
            likesElement.style.fontWeight = 'bold';

            setTimeout(() => {
                likesElement.style.color = '';
                likesElement.style.transform = '';
                likesElement.style.fontWeight = '';
            }, 500);
        }

    } catch (error) {
        console.error('Error liking article:', error);
        alert(error.message || 'Like failed. Please try again.');
    }
}

// Update like button state.
function updateLikeButtonState() {
    const likeButton = /** @type {HTMLButtonElement|null} */ (document.querySelector('button[onclick="likeArticle()"]'));
    if (!likeButton || !currentArticle) return;

    const heartIcon = /** @type {HTMLElement|null} */ (likeButton.querySelector('i'));

    if (currentArticle.user_liked) {
        // Liked state.
        likeButton.classList.add('liked');
        if (heartIcon) {
            heartIcon.className = 'fa-solid fa-heart'; // Solid heart.
        }
        likeButton.title = 'Unlike';
    } else {
        // Not liked state.
        likeButton.classList.remove('liked');
        if (heartIcon) {
            heartIcon.className = 'fa-regular fa-heart'; // Outline heart.
        }
        likeButton.title = 'Like';
    }
}

// Share post.
async function shareArticle() {
    if (!currentArticle) {
        alert('Failed to load post details.');
        return;
    }

    const shareUrl = `${window.location.origin}/forum#article-${currentArticle.id}`;
    const shareText = `${currentArticle.title} - ${currentArticle.author.name}`;

    // Check Web Share API support.
    if (navigator.share) {
        try {
            await navigator.share({
                title: currentArticle.title,
                text: shareText,
                url: shareUrl
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error sharing:', error);
                fallbackShare(shareUrl, shareText);
            }
        }
    } else {
        fallbackShare(shareUrl, shareText);
    }
}

// Fallback share.
function fallbackShare(url, text) {
    // Attempt to copy to clipboard.
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            alert('Post link copied to clipboard!\n\n' + text + '\n' + url);
        }).catch(() => {
            showShareDialog(url, text);
        });
    } else {
        showShareDialog(url, text);
    }
}

// Show share dialog.
function showShareDialog(url, text) {
    const shareContent = `${text}\n\n${url}`;

    // Create a temporary textarea for copy.
    const textArea = document.createElement('textarea');
    textArea.value = shareContent;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        document.execCommand('copy');
        alert('Post info copied to clipboard!');
    } catch (err) {
        // If copy fails, show the content for manual copy.
        alert('Please copy the following info manually:\n\n' + shareContent);
    }

    document.body.removeChild(textArea);
}

function updatePagination() {
    const totalPages = Math.ceil(articles.length / articlesPerPage);
    const pagination = document.getElementById('pagination');
    const pageInfo = document.getElementById('pageInfo');
    const prevPage = /** @type {HTMLButtonElement} */ (document.getElementById('prevPage'));
    const nextPage = /** @type {HTMLButtonElement} */ (document.getElementById('nextPage'));

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    prevPage.disabled = currentPage <= 1;
    nextPage.disabled = currentPage >= totalPages;
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderArticles();
        window.scrollTo(0, 0);
    }
}

function nextPage() {
    const totalPages = Math.ceil(articles.length / articlesPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderArticles();
        window.scrollTo(0, 0);
    }
}

// Utility helpers.
function debounce(func, wait) {
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

function formatDate(dateString) {
    if (!dateString) return 'Invalid Date';

    let date;

    // Handle custom backend format: "2024-1-15 @14h 30m 45s 123ms"
    if (dateString.includes('@') && dateString.includes('h ') && dateString.includes('m ')) {
        try {
            // Parse custom format.
            const parts = dateString.split(' @');
            const datePart = parts[0]; // "2024-1-15"
            const timePart = parts[1]; // "14h 30m 45s 123ms"

            const dateComponents = datePart.split('-');
            const year = parseInt(dateComponents[0]);
            const month = parseInt(dateComponents[1]) - 1; // JS months are 0-based.
            const day = parseInt(dateComponents[2]);

            const timeComponents = timePart.match(/(\d+)h (\d+)m (\d+)s (\d+)ms/);
            if (timeComponents) {
                const hour = parseInt(timeComponents[1]);
                const minute = parseInt(timeComponents[2]);
                const second = parseInt(timeComponents[3]);
                const millisecond = parseInt(timeComponents[4]);

                date = new Date(year, month, day, hour, minute, second, millisecond);
            } else {
                // If time parsing fails, use date only.
                date = new Date(year, month, day);
            }
        } catch (error) {
            console.error('Error parsing custom date format:', error);
            date = new Date(dateString);
        }
    } else {
        // Try standard date format.
        date = new Date(dateString);
    }

    // Ensure date is valid.
    if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateString);
        return 'Invalid Date';
    }

    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function getCategoryName(category) {
    const categoryMap = {
        'tutorial': 'Tutorial',
        'discussion': 'Discussion',
        'announcement': 'Announcement',
        'question': 'Q&A',
        'showcase': 'Showcase'
    };
    return categoryMap[category] || 'Other';
}
