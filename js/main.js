/**
 * main.js  — Global bootstrap for every dashboard page
 * - Auth session check → redirect to login.html if unauthenticated
 * - Populates sidebar user card with real session data
 * - Initialises Feather icons
 * - Auto-marks the active sidebar link
 * - Wires the Logout button
 */

const API_BASE = 'api/';

// ── Session check ─────────────────────────────────────────────
async function checkAuth() {
    if (window.location.pathname.includes('login') ||
        window.location.pathname.includes('register')) {
        return;
    }

    try {
        const res = await fetch(API_BASE + 'auth.php?action=check');
        
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
             window.location.href = 'login.html';
             return;
        }

        const data = await res.json();

        if (!res.ok || data.status !== 'authenticated') {
            window.location.href = 'login.html';
            return;
        }

        populateSidebar(data.user, data.role || '');

        // Show/Hide Admin Only UI Elements
        document.querySelectorAll('.admin-only').forEach(el => {
            if (data.role === 'admin') {
                el.style.display = 'flex';
            } else {
                el.style.display = 'none';
            }
        });

    } catch (err) {
        console.error('Session check failed:', err);
        // Only hard-redirect if we can reach the server but get a 401;
        // if the server is simply offline (dev mode) don't loop.
        if (err instanceof TypeError) {
            console.warn('Server unreachable — running in offline/dev mode.');
            populateSidebar('Dev User', 'offline');
        } else {
            window.location.href = 'login.html';
        }
    }
}

function populateSidebar(username, role) {
    const avatarEl = document.getElementById('sidebarAvatar');
    const nameEl = document.getElementById('sidebarName');
    const roleEl = document.getElementById('sidebarRole');

    if (avatarEl && username) {
        const initials = username.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        avatarEl.textContent = initials;
    }
    if (nameEl) nameEl.textContent = username || 'User';
    if (roleEl) roleEl.textContent = role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
}

// ── DOMContentLoaded ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    // Feather icons
    if (typeof feather !== 'undefined') feather.replace();

    // Active sidebar link (auto-detect current page)
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        link.classList.toggle('active', href === currentPage);
    });

    // Logout button
    const logoutBtn = document.querySelector('a[title="Logout"]');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try { await fetch(API_BASE + 'auth.php?action=logout'); } catch (_) { }
            window.location.href = 'login.html';
        });
    }
});

// Run session check immediately
checkAuth();
