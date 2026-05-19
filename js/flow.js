/**
 * flow.js
 * Real-time flow rate monitoring — polls get_data.php + get_history.php
 */

const POLL_MS  = 10000;
let flowChart  = null;
let fLabels    = [];
let fData      = [];
const MAX_PTS  = 60;

function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ── Stat cards ─────────────────────────────────────────────── */
function updateCards(data) {
    const { reading, flow_status, thresholds, stats_24h } = data;
    const flow  = parseFloat(reading.flow);
    const level = parseFloat(reading.level);

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    // Hero flow value
    set('fl-hero-value', flow.toFixed(1));

    // Hero card colour
    const heroCard = document.getElementById('fl-hero-card');
    if (heroCard) {
        heroCard.className = 'stat-card glass-panel ' + (flow_status === 'HIGH' ? 'critical' : 'info');
    }

    // Flow status text
    const statusEl = document.getElementById('fl-status-text');
    if (statusEl) {
        statusEl.textContent = flow_status === 'HIGH'
            ? `⚠ High — exceeds max (${thresholds.max_flow_rate} L/min). Possible leak!`
            : '✔ Normal flow';
        statusEl.style.color = flow_status === 'HIGH' ? '#ef4444' : 'var(--success-color)';
    }

    // 24h stats
    set('fl-avg',  (stats_24h?.avg_flow ?? '—') + ' L/m');

    // Estimated daily volume (avg_flow L/min × 1440 min/day)
    const dailyVol = stats_24h?.avg_flow
        ? Math.round(parseFloat(stats_24h.avg_flow) * 1440).toLocaleString()
        : '—';
    set('fl-daily-vol', dailyVol + ' L');

    // Leak events (FLOW_HIGH alerts today — fetch separately)
    fetch(API_BASE + 'get_alerts.php?type=FLOW_HIGH&limit=50')
        .then(r => r.json())
        .then(a => {
            const today = new Date().toDateString();
            const todayLeaks = (a.alerts || []).filter(al =>
                new Date(al.alert_time).toDateString() === today
            ).length;
            set('fl-leaks', todayLeaks + ' today');
        }).catch(() => {});

    // Max threshold badge
    set('fl-max-thresh', thresholds.max_flow_rate + ' L/min');

    // Last updated
    set('fl-last-updated', 'Updated ' + new Date(reading.timestamp).toLocaleTimeString());
}

/* ── Rolling bar chart ──────────────────────────────────────── */
function pushFlow(ts, flow) {
    fLabels.push(fmtTime(ts));
    fData.push(flow);
    if (fLabels.length > MAX_PTS) { fLabels.shift(); fData.shift(); }
    if (flowChart) flowChart.update('none');
}

function initFlowChart(historyRows) {
    const ctx = document.getElementById('fl-flow-chart');
    if (!ctx) return;

    // Use last 6h
    const sixH = historyRows.slice(-72);
    fLabels = sixH.map(r => fmtTime(r.timestamp));
    fData   = sixH.map(r => parseFloat(r.flow));

    flowChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: fLabels,
            datasets: [{
                label: 'Flow Rate (L/min)',
                data: fData,
                backgroundColor: fData.map(v =>
                    v >= 30 ? 'rgba(239,68,68,0.75)' : 'rgba(59,130,246,0.75)'
                ),
                borderColor: fData.map(v =>
                    v >= 30 ? '#ef4444' : '#3b82f6'
                ),
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    borderWidth: 1,
                    callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(1)} L/min` }
                }
            },
            scales: {
                x: {
                    ticks: { color:'#94a3b8', maxTicksLimit:12, font:{family:'Inter'} },
                    grid:  { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color:'#3b82f6', callback: v => v+' L', font:{family:'Inter'} },
                    grid:  { color:'rgba(255,255,255,0.05)' }
                }
            }
        }
    });
}

/* ── Poll ───────────────────────────────────────────────────── */
let chartInitialised = false;

async function poll() {
    try {
        const [dataRes, histRes] = await Promise.all([
            fetch(API_BASE + 'get_data.php'),
            chartInitialised
                ? Promise.resolve(null)
                : fetch(API_BASE + 'get_history.php?hours=6&limit=200')
        ]);

        const data = await dataRes.json();
        if (data.status === 'success') {
            updateCards(data);

            if (!chartInitialised && histRes) {
                const hist = await histRes.json();
                if (hist.status === 'success') {
                    initFlowChart(hist.data);
                    chartInitialised = true;
                }
            } else if (chartInitialised) {
                pushFlow(data.reading.timestamp, parseFloat(data.reading.flow));
                // Recolour bars after push
                if (flowChart) {
                    flowChart.data.datasets[0].backgroundColor = fData.map(v =>
                        v >= 30 ? 'rgba(239,68,68,0.75)' : 'rgba(59,130,246,0.75)'
                    );
                }
            }
        }
    } catch(e) { console.warn('Flow rate poll error:', e); }
}

document.addEventListener('DOMContentLoaded', () => {
    poll();
    setInterval(poll, POLL_MS);
});
