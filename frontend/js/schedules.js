Auth.requireAuth();

const user = Auth.user();
let allSchedules = [];

if (user) {
  document.getElementById('user-name').textContent  = user.full_name;
  document.getElementById('user-role').textContent  = user.role;
  document.getElementById('user-avatar').textContent =
    user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  if (user.role === 'admin') {
    document.getElementById('add-schedule-btn').style.display = 'inline-flex';
  }
}

const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric'
});

const badge = (status) =>
  `<span class="badge badge-${status}">${status.replace('_', ' ')}</span>`;

function showAlert(message, type = 'success') {
  const el      = document.getElementById('alert-msg');
  el.className  = `alert alert-${type}`;
  el.textContent = message;
  el.style.display = 'flex';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ─────────────────────────────────────────
//  Load all schedules
// ─────────────────────────────────────────
async function loadSchedules() {
  const res   = await api.get('/schedules');
  const tbody = document.getElementById('sched-tbody');

  if (!res.success) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:red;">Failed to load schedules.</td></tr>`;
    return;
  }

  allSchedules = res.data;
  renderSchedules(allSchedules);
}

function renderSchedules(data) {
  const tbody = document.getElementById('sched-tbody');
  document.getElementById('sched-count').textContent = `${data.length} tasks`;

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state"><p>No tasks found.</p></div>
      </td></tr>`;
    return;
  }

  // Determine what action button to show based on status and role
  const actionBtn = (t) => {
    if (t.status === 'completed') {
      return `<span style="color:#9E9E9E;font-size:12px;">Completed</span>`;
    }
    if (user.role === 'admin' || user.role === 'manager' ||
        (user.role === 'technician' && t.technician_id === user.id)) {
      return `<button class="btn btn-outline" style="padding:5px 10px;font-size:12px;"
                onclick="openStatusModal(${t.id})">Update Status</button>`;
    }
    return '—';
  };

  tbody.innerHTML = data.map(t => `
    <tr>
      <td><strong>${t.title}</strong></td>
      <td>
        ${t.equipment_name}
        <br><span style="font-size:11px;color:#9E9E9E;">${t.equipment_location || ''}</span>
      </td>
      <td style="text-transform:capitalize;">${t.maintenance_type}</td>
      <td>${formatDate(t.scheduled_date)}</td>
      <td>${t.technician_name || '<span style="color:#9E9E9E;">Unassigned</span>'}</td>
      <td>${badge(t.status)}</td>
      <td>${actionBtn(t)}</td>
    </tr>
  `).join('');
}

// ─────────────────────────────────────────
//  Filter by status
// ─────────────────────────────────────────
function filterSchedules() {
  const status = document.getElementById('filter-status').value;
  const filtered = status === 'all'
    ? allSchedules
    : allSchedules.filter(t => t.status === status);
  renderSchedules(filtered);
}

// ─────────────────────────────────────────
//  Add Schedule Modal
// ─────────────────────────────────────────
async function openAddModal() {
  document.getElementById('add-modal').classList.add('open');

  const [equip, techs] = await Promise.all([
    api.get('/equipment'),
    api.get('/users/technicians'),
  ]);

  document.getElementById('s-equipment').innerHTML =
    equip.data.map(e => `<option value="${e.id}">${e.name}</option>`).join('');

  document.getElementById('s-technician').innerHTML =
    techs.data.map(u => `<option value="${u.id}">${u.full_name}</option>`).join('');
}

function closeAddModal() {
  document.getElementById('add-modal').classList.remove('open');
  document.getElementById('add-error').style.display = 'none';
}

async function createSchedule() {
  const title       = document.getElementById('s-title').value.trim();
  const equipmentId = document.getElementById('s-equipment').value;
  const techId      = document.getElementById('s-technician').value;
  const type        = document.getElementById('s-type').value;
  const date        = document.getElementById('s-date').value;
  const duration    = document.getElementById('s-duration').value;
  const desc        = document.getElementById('s-desc').value.trim();
  const errorDiv    = document.getElementById('add-error');

  if (!title || !date) {
    errorDiv.textContent   = 'Task title and scheduled date are required.';
    errorDiv.style.display = 'flex';
    return;
  }

  const res = await api.post('/schedules', {
    equipment_id:       parseInt(equipmentId),
    assigned_to:        parseInt(techId),
    maintenance_type:   type,
    title,
    description:        desc,
    scheduled_date:     date,
    estimated_duration: duration ? parseInt(duration) : null,
  });

  if (res.success) {
    closeAddModal();
    showAlert('Maintenance task created successfully.');
    loadSchedules();
  } else {
    errorDiv.textContent   = res.message;
    errorDiv.style.display = 'flex';
  }
}

// ─────────────────────────────────────────
//  Update Status Modal
// ─────────────────────────────────────────
function openStatusModal(taskId) {
  document.getElementById('status-task-id').value = taskId;
  document.getElementById('status-notes').value   = '';
  document.getElementById('status-modal').classList.add('open');
}

function closeStatusModal() {
  document.getElementById('status-modal').classList.remove('open');
}

async function updateStatus() {
  const taskId = document.getElementById('status-task-id').value;
  const status = document.getElementById('new-status').value;
  const notes  = document.getElementById('status-notes').value.trim();

  const res = await api.patch(`/schedules/${taskId}/status`, {
    status,
    completion_notes: notes,
  });

  if (res.success) {
    closeStatusModal();
    showAlert(`Task status updated to ${status.replace('_', ' ')} successfully.`);
    loadSchedules();
  } else {
    showAlert(res.message, 'danger');
  }
}

// Load on startup
loadSchedules();