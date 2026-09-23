// Toast Notification System — Beautiful slide-in toasts
(function() {
    // Create container
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);

    let toastCount = 0;

    window.showToast = function(message, type = 'success', duration = 4000) {
        toastCount++;
        const id = 'toast-' + toastCount;
        
        const icons = {
            success: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            warning: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        };

        const toast = document.createElement('div');
        toast.id = id;
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="dismissToast('${id}')">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div class="toast-progress">
                <div class="toast-progress-bar" style="animation-duration: ${duration}ms"></div>
            </div>
        `;

        container.appendChild(toast);
        
        // Trigger entrance animation
        requestAnimationFrame(() => toast.classList.add('toast-visible'));

        // Auto dismiss
        const timer = setTimeout(() => dismissToast(id), duration);
        toast.dataset.timer = timer;

        return id;
    };

    window.dismissToast = function(id) {
        const toast = document.getElementById(id);
        if (!toast) return;
        clearTimeout(parseInt(toast.dataset.timer));
        toast.classList.add('toast-exit');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };
})();
