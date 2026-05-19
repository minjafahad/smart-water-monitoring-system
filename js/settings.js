/**
 * settings.js
 * Loads current settings from get_settings.php on page load.
 * Saves changes via update_settings.php on form submit.
 */




function showToast(msg, type = 'success') {
    let toast = document.getElementById('toastMsg');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toastMsg';
        toast.style.cssText = `position:fixed;bottom:32px;right:32px;padding:14px 24px;border-radius:10px;
            font-weight:500;z-index:9999;opacity:0;transition:opacity 0.3s;font-family:Inter,sans-serif;`;
        document.body.appendChild(toast);
    }
    toast.textContent  = msg;
    toast.style.background = type === 'success' ? 'var(--success-color)' : type === 'error' ? '#ef4444' : 'var(--primary-color)';
    toast.style.color  = '#fff';
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3500);
}

async function loadSettings() {
    try {
        const res  = await fetch(API_BASE + 'get_settings.php');
        const data = await res.json();
        if (data.status !== 'success') return;

        const s = data.settings;

        // Threshold inputs
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        set('inp-critical',    s.critical_level);
        set('inp-warning',     s.warning_level);
        set('inp-max-flow',    s.max_flow_rate);
        set('inp-phone1',      s.primary_phone);
        set('inp-phone2',      s.secondary_phone);
        set('inp-email',       s.alert_email);
        set('inp-retention',   s.data_retention_days);
        set('inp-poll',        s.poll_interval_sec);

        // Toggle switches
        const smsEl   = document.getElementById('toggle-sms');
        const emailEl = document.getElementById('toggle-email');
        if (smsEl)   smsEl.checked   = s.sms_enabled   == 1;
        if (emailEl) emailEl.checked = s.email_enabled == 1;

    } catch(e) {
        console.warn('Settings load error:', e);
        showToast('Could not load settings from server.', 'error');
    }
}

async function saveSettings() {
    const get = id => { const el = document.getElementById(id); return el ? el.value.trim() : null; };
    const getToggle = id => { const el = document.getElementById(id); return el ? (el.checked ? 1 : 0) : 0; };

    const payload = {
        critical_level:       parseFloat(get('inp-critical'))   || 15,
        warning_level:        parseFloat(get('inp-warning'))    || 25,
        max_flow_rate:        parseFloat(get('inp-max-flow'))   || 30,
        primary_phone:        get('inp-phone1'),
        secondary_phone:      get('inp-phone2'),
        alert_email:          get('inp-email'),
        data_retention_days:  parseInt(get('inp-retention'))   || 90,
        poll_interval_sec:    parseInt(get('inp-poll'))        || 10,
        sms_enabled:          getToggle('toggle-sms'),
        email_enabled:        getToggle('toggle-email')
    };

    // Client-side validation
    if (payload.critical_level >= payload.warning_level) {
        showToast('Critical Level must be less than Warning Level.', 'error');
        return;
    }

    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

    try {
        const res  = await fetch(API_BASE + 'update_settings.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        showToast(data.message || (data.status === 'success' ? 'Settings saved!' : 'Error'), data.status);
    } catch(e) {
        showToast('Network error — could not save settings.', 'error');
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();

    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveSettings);
});
