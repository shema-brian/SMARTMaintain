// Protect this page
Auth.requireAuth();

// Set current date in topbar
document.getElementById('current-date').textContent =
  new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

// Load user info into sidebar
const user = Auth.user();
if (user) {
  document.getElementById('user-name').textContent  = user.full_name;
  document.getElementById('user-role').textContent  = user.role;
  document.getElementById('user-avatar').textContent =
    user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// Format date helper
const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

// Badge helper
const badge = (status) =>
  `<span class="badge badge-${status}">${status.replace('_', ' ')}</span>`;

// ─────────────────────────────────────────
//  Load KPI Summary Cards
// ─────────────────────────────────────────
async function loadSummary() {
  const res = await api.get('/schedules/summary');
  if (!res.success) return;
  const d = res.data;
  document.getElementById('kpi-overdue').textContent    = d.overdue;
  document.getElementById('kpi-inprogress').textContent = d.in_progress;
  document.getElementById('kpi-scheduled').textContent  = d.scheduled;
  document.getElementById('kpi-completed').textContent  = d.completed_this_month;
}

// ─────────────────────────────────────────
//  Load Total Equipment Count
// ─────────────────────────────────────────
async function loadEquipmentCount() {
  const res = await api.get('/equipment');
  if (res.success) {
    document.getElementById('kpi-equipment').textContent = res.count;
  }
}

// ─────────────────────────────────────────
//  Load Overdue Tasks Table
// ─────────────────────────────────────────
async function loadOverdueTasks() {
  const res    = await api.get('/schedules/overdue');
  const tbody  = document.getElementById('overdue-tbody');

  if (!res.success || res.data.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <p>No overdue tasks. All maintenance is on track.</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = res.data.map(t => `
    <tr>
      <td><strong>${t.title}</strong></td>
      <td>${t.equipment_name}</td>
      <td>${t.technician_name || 'Unassigned'}</td>
      <td>${formatDate(t.scheduled_date)}</td>
      <td style="color:var(--danger);font-weight:600;">${t.days_overdue} day(s)</td>
      <td>${badge('overdue')}</td>
    </tr>
  `).join('');
}

// ─────────────────────────────────────────
//  Load Upcoming Tasks Table
// ─────────────────────────────────────────
async function loadUpcomingTasks() {
  const res   = await api.get('/schedules/upcoming');
  const tbody = document.getElementById('upcoming-tbody');

  if (!res.success || res.data.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <p>No maintenance tasks due in the next 7 days.</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = res.data.map(t => `
    <tr>
      <td><strong>${t.title}</strong></td>
      <td>${t.equipment_name}</td>
      <td>${t.technician_name || 'Unassigned'}</td>
      <td>${formatDate(t.scheduled_date)}</td>
      <td style="color:var(--warning);font-weight:600;">${t.days_until_due} day(s)</td>
      <td>${badge(t.status)}</td>
    </tr>
  `).join('');
}

// ─────────────────────────────────────────
//  Load Recent Activity Table
// ─────────────────────────────────────────
async function loadRecentActivity() {
  const res   = await api.get('/schedules');
  const tbody = document.getElementById('recent-tbody');

  if (!res.success) return;

  // Show the 10 most recent tasks
  const recent = res.data.slice(0, 10);

  tbody.innerHTML = recent.map(t => `
    <tr>
      <td><strong>${t.title}</strong></td>
      <td>${t.equipment_name}</td>
      <td style="text-transform:capitalize;">${t.maintenance_type}</td>
      <td>${formatDate(t.scheduled_date)}</td>
      <td>${t.technician_name || 'Unassigned'}</td>
      <td>${badge(t.status)}</td>
    </tr>
  `).join('');
}

// ─────────────────────────────────────────
//  Load Everything on Page Load
// ─────────────────────────────────────────
(async () => {
  await Promise.all([
    loadSummary(),
    loadEquipmentCount(),
    loadOverdueTasks(),
    loadUpcomingTasks(),
    loadRecentActivity(),
  ]);
})();