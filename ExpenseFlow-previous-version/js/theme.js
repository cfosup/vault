// Theme Manager — Light/Dark Toggle with persistence
(function() {
    const STORAGE_KEY = 'theme';
    
    function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    function getTheme() {
        return localStorage.getItem(STORAGE_KEY) || getSystemTheme();
    }
    
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEY, theme);
        document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }
    
    // Initialize immediately (before DOM ready to prevent flash)
    setTheme(getTheme());
    
    // Toggle function (called by button)
    window.toggleTheme = function() {
        const current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
    };
    
    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(STORAGE_KEY)) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });
})();
