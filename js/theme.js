/**
 * theme.js - Handles light and dark mode for the Smart Water Monitoring System
 */

(function() {
    // Check for saved theme preference or use default
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Function to toggle theme
    window.toggleTheme = function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Update the icon if it exists
        updateThemeIcon(newTheme);
    };

    // Update the theme icon based on the current theme
    function updateThemeIcon(theme) {
        const iconElement = document.getElementById('theme-icon');
        if (iconElement) {
            if (theme === 'dark') {
                iconElement.setAttribute('data-feather', 'sun');
            } else {
                iconElement.setAttribute('data-feather', 'moon');
            }
            // If feather is available, re-render the icon
            if (window.feather) {
                feather.replace();
            }
        }
    }

    // Run when the DOM is fully loaded to set up the icon
    document.addEventListener('DOMContentLoaded', () => {
        updateThemeIcon(document.documentElement.getAttribute('data-theme'));
    });
})();
