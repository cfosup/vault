// Keyboard Shortcuts System
(function() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'shortcutsOverlay';
    overlay.className = 'shortcuts-overlay';
    overlay.innerHTML = `
        <div class="shortcuts-modal">
            <div class="shortcuts-header">
                <h3>Keyboard Shortcuts</h3>
                <button class="shortcuts-close" onclick="toggleShortcuts()">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="shortcuts-grid">
                <div class="shortcut-group">
                    <div class="shortcut-group-title">Navigation</div>
                    <div class="shortcut-item"><kbd>D</kbd><span>Dashboard</span></div>
                    <div class="shortcut-item"><kbd>E</kbd><span>Add Expense</span></div>
                    <div class="shortcut-item"><kbd>I</kbd><span>Add Income</span></div>
                    <div class="shortcut-item"><kbd>V</kbd><span>View Expenses</span></div>
                </div>
                <div class="shortcut-group">
                    <div class="shortcut-group-title">Actions</div>
                    <div class="shortcut-item"><kbd>N</kbd><span>New Entry</span></div>
                    <div class="shortcut-item"><kbd>T</kbd><span>Toggle Theme</span></div>
                    <div class="shortcut-item"><kbd>C</kbd><span>Toggle Chat</span></div>
                    <div class="shortcut-item"><kbd>?</kbd><span>Show Shortcuts</span></div>
                </div>
                <div class="shortcut-group">
                    <div class="shortcut-group-title">General</div>
                    <div class="shortcut-item"><kbd>Esc</kbd><span>Close Overlay</span></div>
                    <div class="shortcut-item"><kbd>/</kbd><span>Focus Search</span></div>
                </div>
            </div>
            <div class="shortcuts-footer">
                Press <kbd>?</kbd> anytime to show this help
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    window.toggleShortcuts = function() {
        overlay.classList.toggle('visible');
    };

    document.addEventListener('keydown', function(e) {
        // Don't trigger if typing in input/textarea/select
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
            if (e.key === 'Escape') {
                e.target.blur();
                overlay.classList.remove('visible');
            }
            return;
        }

        switch(e.key) {
            case '?':
                e.preventDefault();
                toggleShortcuts();
                break;
            case 'Escape':
                overlay.classList.remove('visible');
                // Also close chat if open
                const chatPanel = document.getElementById('chatPanel');
                if (chatPanel && chatPanel.classList.contains('visible')) {
                    if (typeof toggleChat === 'function') toggleChat();
                }
                break;
            case 'd': case 'D':
                if (!e.ctrlKey && !e.metaKey) window.location.href = 'dashboard.html';
                break;
            case 'e': case 'E':
                if (!e.ctrlKey && !e.metaKey) window.location.href = 'index.html';
                break;
            case 'i': case 'I':
                if (!e.ctrlKey && !e.metaKey) window.location.href = 'income.html';
                break;
            case 'v': case 'V':
                if (!e.ctrlKey && !e.metaKey) window.location.href = 'expenses.html';
                break;
            case 'n': case 'N':
                if (!e.ctrlKey && !e.metaKey) {
                    const addBtn = document.getElementById('addRowBtn');
                    if (addBtn) addBtn.click();
                }
                break;
            case 't': case 'T':
                if (!e.ctrlKey && !e.metaKey && typeof toggleTheme === 'function') toggleTheme();
                break;
            case 'c': case 'C':
                if (!e.ctrlKey && !e.metaKey && typeof toggleChat === 'function') toggleChat();
                break;
            case '/':
                e.preventDefault();
                const search = document.getElementById('searchInput');
                if (search) search.focus();
                break;
        }
    });
})();
