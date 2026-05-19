/**
 * alerts.js
 * Fetches live alert data from get_alerts.php and acknowledge_alert.php
 */




function fmtDateTime(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
        + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function badgeClass(type) {
    return { CRITICAL: 'critical', WARNING: 'warning', INFO: 'info', FLOW_HIGH: 'critical', SENSOR_OFFLINE: 'warning' }[type] || 'info';
}

function renderSummaryCards(summary) {
    const els = {
        crit: document.getElementById('count-critical'),
        warn: document.getElementById('count-warning'),
        info: document.getElementById('count-info'),
        flow: document.getElementById('count-flow')
    };
    if (els.crit) els.crit.textContent = summary.CRITICAL    || 0;
    if (els.warn) els.warn.textContent = summary.WARNING     || 0;
    if (els.info) els.info.textContent = summary.INFO        || 0;
    if (els.flow) els.flow.textContent = summary.FLOW_HIGH   || 0;
}

function renderSMSPanel(alerts) {
    const phoneBody = document.getElementById('smsPhoneBody');
    if (!phoneBody) return;

    // Show the 3 most recent alerts in the phone mockup
    const recent = alerts.filter(a => a.alert_type !== 'INFO').slice(0, 4);
    if (recent.length === 0) {
        phoneBody.innerHTML = '<div class="sms-bubble received" style="opacity:0.5;">No critical alerts yet.</div>';
        return;
    }

    phoneBody.innerHTML = recent.map(a => {
        const isCrit = a.alert_type === 'CRITICAL' || a.alert_type === 'FLOW_HIGH';
        const isWarn = a.alert_type === 'WARNING';
        const bubbleStyle = isCrit
            ? 'background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.3);color:#fecaca;'
            : isWarn
            ? 'background:rgba(245,158,11,0.18);border:1px solid rgba(245,158,11,0.3);color:#fcd34d;'
            : '';
        return `
            <div class="sms-bubble received alert" style="${bubbleStyle}">
                ${a.message}
                <div class="sms-time">${fmtDateTime(a.alert_time)}</div>
            </div>`;
    }).join('');
}

function renderAlertsTable(alerts, filter) {
    const tbody = document.getElementById('alertsTableBody');
    if (!tbody) return;

    let rows = alerts;
    if (filter && filter !== 'all') {
        rows = alerts.filter(a => a.alert_type === filter || a.status === filter);
    }

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);padding:32px;">No alerts found.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map(a => {
        const canAck = a.status === 'Logged' || a.status === 'Sent';
        return `
        <tr>
            <td>${fmtDateTime(a.alert_time)}</td>
            <td><span class="badge ${badgeClass(a.alert_type)}">${a.alert_type}</span></td>
            <td style="max-width:320px">${a.message}</td>
            <td>${a.water_level != null ? parseFloat(a.water_level).toFixed(1) + '%' : '—'}</td>
            <td><span style="color:var(--${a.status === 'Logged' ? 'text-secondary' : a.status === 'Resolved' ? 'success-color' : 'primary-color'})">${a.status}</span></td>
            <td>
                ${canAck ? `
                <button class="btn-ack" data-id="${a.id}" data-action="Acknowledged"
                    style="font-size:0.78rem;padding:4px 10px;background:var(--primary-color);color:#fff;border:none;border-radius:6px;cursor:pointer;margin-right:4px;">
                    Acknowledge
                </button>
                <button class="btn-ack" data-id="${a.id}" data-action="Resolved"
                    style="font-size:0.78rem;padding:4px 10px;background:var(--success-color);color:#fff;border:none;border-radius:6px;cursor:pointer;">
                    Resolve
                </button>` : '—' }
            </td>
        </tr>`;
    }).join('');

    // Bind acknowledge buttons
    tbody.querySelectorAll('.btn-ack').forEach(btn => {
        btn.addEventListener('click', async function () {
            const alertId = parseInt(this.dataset.id);
            const action  = this.dataset.action;
            try {
                const res  = await fetch(API_BASE + 'acknowledge_alert.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ alert_id: alertId, action })
                });
                const json = await res.json();
                if (json.status === 'success') {
                    loadAlerts(); // refresh
                    showToast(`Alert marked as ${action}`, 'success');
                } else {
                    showToast(json.message || 'Error', 'error');
                }
            } catch(e) {
                showToast('Network error', 'error');
            }
        });
    });
}

// Toast notification
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
    toast.style.background = type === 'success' ? 'var(--success-color)' : '#ef4444';
    toast.style.color  = '#fff';
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

let allAlerts = [];

async function loadAlerts() {
    try {
        const res  = await fetch(API_BASE + 'get_alerts.php?limit=100');
        const data = await res.json();
        if (data.status === 'success') {
            allAlerts = data.alerts;
            renderSummaryCards(data.summary || {});
            renderAlertsTable(allAlerts, document.getElementById('alertFilter')?.value || 'all');
            renderSMSPanel(allAlerts);
            if (typeof feather !== 'undefined') feather.replace();
        }
    } catch(e) {
        console.warn('Alerts fetch error:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadAlerts();
    setInterval(loadAlerts, 30000); // auto-refresh every 30s

    // Filter dropdown
    const filterEl = document.getElementById('alertFilter');
    if (filterEl) {
        filterEl.addEventListener('change', () => {
            renderAlertsTable(allAlerts, filterEl.value);
        });
    }

    // Test SMS button
    const testBtn = document.getElementById('sendTestSMS');
    if (testBtn) {
        testBtn.addEventListener('click', () => {
            showToast('Simulation: Test SMS sent to registered numbers.', 'success');
        });
    }
});
