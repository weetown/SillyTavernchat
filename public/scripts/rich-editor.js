// Rich text editor helpers.
let richEditor = null;

// Initialize rich editor.
function initRichEditor() {
    const editorElement = document.getElementById('articleContent');
    if (!editorElement) return;

    // Make editor editable.
    editorElement.contentEditable = true;

    // Bind toolbar button events.
    bindToolbarEvents();

    // Bind image upload events.
    bindImageUpload();

    richEditor = {
        getContent: () => editorElement.innerHTML,
        setContent: (content) => { editorElement.innerHTML = content; },
        focus: () => editorElement.focus()
    };
}

// Bind toolbar button events.
function bindToolbarEvents() {
    const toolbarButtons = document.querySelectorAll('.toolbar-btn');

    toolbarButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const command = button.dataset.command;
            const value = button.dataset.value;

            if (command) {
                document.execCommand(command, false, value);
                editorElement.focus();
            }
        });
    });
}

// Bind image upload events.
function bindImageUpload() {
    const insertImageBtn = document.getElementById('insertImageBtn');
    const imageUpload = document.getElementById('imageUpload');

    if (insertImageBtn && imageUpload) {
        insertImageBtn.addEventListener('click', () => {
            imageUpload.click();
        });

        imageUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await uploadImage(file);
            }
        });
    }
}

// Upload image.
async function uploadImage(file) {
    try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('/api/forum/upload-image', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Image upload failed.');
        }

        const result = await response.json();

        // Insert image into editor.
        const img = document.createElement('img');
        img.src = result.url;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';

        // Insert image at cursor.
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
            range.setStartAfter(img);
            range.setEndAfter(img);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // If there is no selection, append to the end.
            const editorElement = document.getElementById('articleContent');
            editorElement.appendChild(img);
        }

        // Clear file input.
        document.getElementById('imageUpload').value = '';

    } catch (error) {
        console.error('Error uploading image:', error);
        alert('Image upload failed: ' + error.message);
    }
}

// Update article submit handling to use rich editor content.
const originalHandleArticleSubmit = window.handleArticleSubmit;
if (originalHandleArticleSubmit) {
    window.handleArticleSubmit = async function(event) {
        event.preventDefault();

        if (!window.currentUser && !currentUser) {
            alert('Please log in to publish posts.');
            return;
        }

        const formData = new FormData(event.target);
        const articleData = {
            title: formData.get('title'),
            content: richEditor ? richEditor.getContent() : formData.get('content'),
            category: formData.get('category'),
            tags: (() => {
                const tagsValue = formData.get('tags');
                return tagsValue && typeof tagsValue === 'string' ?
                       tagsValue.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
            })()
        };

        try {
            // Get CSRF token.
            const csrfToken = await getCsrfToken();

            const headers = {
                'Content-Type': 'application/json'
            };

            if (csrfToken) {
                headers['x-csrf-token'] = csrfToken;
            }

            const response = await fetch('/api/forum/articles', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(articleData),
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Publish failed.');
            }

            const result = await response.json();
            alert('Post published successfully!');
            window.closeArticleModal();
            window.loadArticles();
        } catch (error) {
            console.error('Failed to create article:', error);
            alert(`Publish failed: ${error.message}`);
        }
    };
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

// Initialize editor after page load.
document.addEventListener('DOMContentLoaded', () => {
    initRichEditor();
});
