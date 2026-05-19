/**
 * dashboard.js  (v2)
 * Polls get_data.php and get_history.php, renders live gauges + Chart.js trend.
 */

const POLL_MS    = 10000;   // default; overridden by DB settings

// ── Chart instance ────────────────────────────────────────────
let trendChart = null;

// ── Helpers ───────────────────────────────────────────────────
function fmtTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDateTime(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
           + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function badgeClass(type) {
    const m = { CRITICAL: 'critical', WARNING: 'warning', INFO: 'info', FLOW_HIGH: 'critical', SENSOR_OFFLINE: 'warning' };
    return m[type] || 'info';
}

// ── Update stat cards ─────────────────────────────────────────
function updateStatCards(data) {
    const { reading, level_status, flow_status, thresholds, stats_24h } = data;
    const level = parseFloat(reading.level);
    const flow  = parseFloat(reading.flow);

    // Water level card
    const levelEl = document.getElementById('currentLevel');
    if (levelEl) {
        levelEl.textContent = level.toFixed(1) + '%';
        const card = levelEl.closest('.stat-card');
        if (card) {
            card.className = 'stat-card glass-panel ' +
                (level_status === 'CRITICAL' ? 'critical' :
                 level_status === 'WARNING'  ? 'warning'  : 'success');
        }
    }

    // Flow rate card
    const flowEl = document.getElementById('currentFlow');
    if (flowEl) {
        flowEl.textContent = flow.toFixed(1) + ' L/m';
        const card = flowEl.closest('.stat-card');
        if (card) {
            card.className = 'stat-card glass-panel ' +
                (flow_status === 'HIGH' ? 'critical' : 'info');
        }
    }

    // Tank visualization
    const tankEl   = document.getElementById('tankVisual');
    const tankTxt  = document.getElementById('tankPercentageText');
    if (tankEl) {
        tankEl.style.height = level.toFixed(0) + '%';
        tankEl.style.background =
            level_status === 'CRITICAL' ? 'linear-gradient(to top, #ef4444, #f87171)' :
            level_status === 'WARNING'  ? 'linear-gradient(to top, #f59e0b, #fcd34d)' :
                                          'linear-gradient(to top, var(--primary-color), #60a5fa)';
    }
    if (tankTxt) tankTxt.textContent = level.toFixed(0) + '%';

    // Estimated volume (assuming 5000 L full capacity)
    const volEl = document.querySelector('#tankEstVol');
    if (volEl) volEl.textContent = Math.round(level * 50).toLocaleString() + ' L';

    // 24h stats cards
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    if (stats_24h) {
        set('avg24hLevel', parseFloat(stats_24h.avg_level || 0).toFixed(1) + '%');
        set('min24h',      parseFloat(stats_24h.min_level || 0).toFixed(1) + '%');
        set('max24h',      parseFloat(stats_24h.max_level || 0).toFixed(1) + '%');
    }
    // Threshold labels on tank panel
    set('dash-crit', thresholds.critical_level + '%');
    set('dash-warn', thresholds.warning_level  + '%');

    // Notification badge — open alert count
    fetch(API_BASE + 'get_alerts.php?status=Logged&limit=5')
        .then(r => r.json())
        .then(a => {
            const badge = document.getElementById('alertBadge');
            if (badge) {
                const cnt = a.count || 0;
                badge.textContent = cnt > 0 ? cnt : '';
                badge.style.display = cnt > 0 ? 'flex' : 'none';
            }
        }).catch(() => {});

    // System Status
    const sysCard = document.getElementById('sys-card');
    const sysStatusEl = document.getElementById('sysStatus');
    if (sysCard && sysStatusEl) {
        if (data.device_status === 'OFFLINE') {
            sysStatusEl.textContent = 'Offline';
            sysCard.className = 'stat-card glass-panel critical';
            sysCard.querySelector('.trend').innerHTML = '<i data-feather="alert-triangle" style="width:14px;"></i>';
            sysCard.querySelector('.trend').className = 'trend down';
            sysCard.querySelector('.stat-footer span:last-child').textContent = 'Sensor Disconnected';
        } else {
            sysStatusEl.textContent = 'Online';
            sysCard.className = 'stat-card glass-panel warning';
            sysCard.querySelector('.trend').innerHTML = '<i data-feather="check-circle" style="width:14px;"></i>';
            sysCard.querySelector('.trend').className = 'trend up';
            sysCard.querySelector('.stat-footer span:last-child').textContent = 'ESP32 Connected';
        }
        if (typeof feather !== 'undefined') feather.replace();
    }

    // Last updated timestamp
    const tsEl = document.getElementById('lastUpdated');
    if (tsEl) tsEl.textContent = 'Updated ' + fmtDateTime(reading.timestamp);
}

// ── Draw / update trend chart ─────────────────────────────────
function drawTrendChart(history) {
    const labels = history.map(r => fmtTime(r.timestamp));
    const levels = history.map(r => parseFloat(r.level));
    const flows  = history.map(r => parseFloat(r.flow));

    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    if (trendChart) {
        trendChart.data.labels          = labels;
        trendChart.data.datasets[0].data = levels;
        trendChart.data.datasets[1].data = flows;
        trendChart.update();
        return;
    }

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Water Level (%)',
                    data: levels,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    yAxisID: 'y'
                },
                {
                    label: 'Flow Rate (L/min)',
                    data: flows,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16,185,129,0.08)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } },
                tooltip: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1 }
            },
            scales: {
                x: {
                    ticks: { color: '#94a3b8', maxTicksLimit: 12, font: { family: 'Inter' } },
                    grid:  { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    type: 'linear', position: 'left',
                    min: 0, max: 100,
                    ticks: { color: '#3b82f6', callback: v => v + '%', font: { family: 'Inter' } },
                    grid:  { color: 'rgba(255,255,255,0.05)' }
                },
                y1: {
                    type: 'linear', position: 'right',
                    min: 0,
                    ticks: { color: '#10b981', callback: v => v + ' L', font: { family: 'Inter' } },
                    grid:  { drawOnChartArea: false }
                }
            }
        }
    });
}

// ── Render recent alerts table ────────────────────────────────
function renderAlerts(alerts) {
    const tbody = document.getElementById('dashAlertsTbody');
    if (!tbody) return;

    if (!alerts || alerts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary)">No alerts logged yet.</td></tr>';
        return;
    }

    tbody.innerHTML = alerts.slice(0, 6).map(a => `
        <tr>
            <td>${fmtDateTime(a.alert_time)}</td>
            <td><span class="badge ${badgeClass(a.alert_type)}">${a.alert_type}</span></td>
            <td>ESP32-001</td>
            <td>${a.message}</td>
            <td><span style="color:var(--${a.status === 'Logged' ? 'text-secondary' : 'success-color'})">${a.status}</span></td>
        </tr>
    `).join('');

    if (typeof feather !== 'undefined') feather.replace();
}

// ── Main polling loop ─────────────────────────────────────────
async function pollDashboard() {
    try {
        // Fetch latest reading + thresholds
        const dataRes = await fetch(API_BASE + 'get_data.php');
        const data    = await dataRes.json();
        if (data.status === 'success') updateStatCards(data);

        // Fetch 24-hour history for chart
        const histRes = await fetch(API_BASE + 'get_history.php?hours=24&limit=200');
        const hist    = await histRes.json();
        if (hist.status === 'success') drawTrendChart(hist.data);

        // Fetch recent alerts for the table
        const alertRes = await fetch(API_BASE + 'get_alerts.php?limit=6');
        const alertData = await alertRes.json();
        if (alertData.status === 'success') renderAlerts(alertData.alerts);

    } catch (e) {
        console.warn('Dashboard poll error:', e);
    }
}

// ── Time-range selector ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const rangeSelect = document.querySelector('.chart-card select');
    if (rangeSelect) {
        rangeSelect.addEventListener('change', async function () {
            const hoursMap = { 'Today': 24, 'Yesterday': 48, 'Last 7 Days': 168 };
            const hours    = hoursMap[this.value] || 24;
            try {
                const r = await fetch(`${API_BASE}get_history.php?hours=${hours}&limit=300`);
                const d = await r.json();
                if (d.status === 'success') drawTrendChart(d.data);
            } catch(e) {}
        });
    }

    // Refresh button
    const refreshBtn = document.querySelector('.icon-btn[title="Refresh"], .icon-btn:first-of-type');
    if (refreshBtn) refreshBtn.addEventListener('click', pollDashboard);

    // Initial load + auto-poll
    pollDashboard();
    setInterval(pollDashboard, POLL_MS);
});
