Auth.requireAuth();

const user = Auth.user();
if (user) {
  document.getElementById('user-name').textContent  = user.full_name;
  document.getElementById('user-role').textContent  = user.role;
  document.getElementById('user-avatar').textContent =
    user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  // Only admins see the Add Equipment button
  if (user.role === 'admin') {
    document.getElementById('add-btn').style.display = 'inline-flex';
  }
}

const statusBadge = (status) => {
  const map = {
    operational:       '<span style="color:#1D9E75;font-weight:600;">Operational</span>',
    under_maintenance: '<span style="color:#BA7517;font-weight:600;">Under Maintenance</span>',
    decommissioned:    '<span style="color:#A32D2D;font-weight:600;">Decommissioned</span>',
  };
  return map[status] || status;
};

const formatDate = (d) => d
  ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
  : '—';

async function loadEquipment() {
  const res   = await api.get('/equipment');
  const tbody = document.getElementById('equip-tbody');

  if (!res.success) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:red;">Failed to load equipment.</td></tr>`;
    return;
  }

  document.getElementById('equip-count').textContent = `${res.count} machines registered`;

  tbody.innerHTML = res.data.map((e, i) => `
    <tr>
      <td style="color:#9E9E9E;">${i + 1}</td>
      <td>
        <strong>${e.name}</strong>
        ${e.serial_number ? `<br><span style="font-size:11px;color:#9E9E9E;">${e.serial_number}</span>` : ''}
      </td>
      <td>${e.model || '—'}</td>
      <td>${e.location || '—'}</td>
      <td>${e.responsible_person || '—'}</td>
      <td>${statusBadge(e.status)}</td>
      <td>${formatDate(e.purchase_date)}</td>
    </tr>
  `).join('');
}

async function loadUsersDropdown() {
  const res    = await api.get('/users');
  const select = document.getElementById('f-user');
  if (!res.success) return;
  select.innerHTML = res.data.map(u =>
    `<option value="${u.id}">${u.full_name} (${u.role})</option>`
  ).join('');
}

function openModal() {
  document.getElementById('modal').classList.add('open');
  loadUsersDropdown();
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  document.getElementById('modal-error').style.display = 'none';
}

async function addEquipment() {
  const name      = document.getElementById('f-name').value.trim();
  const model     = document.getElementById('f-model').value.trim();
  const serial    = document.getElementById('f-serial').value.trim();
  const location  = document.getElementById('f-location').value.trim();
  const date      = document.getElementById('f-date').value;
  const userId    = document.getElementById('f-user').value;
  const notes     = document.getElementById('f-notes').value.trim();
  const errorDiv  = document.getElementById('modal-error');

  if (!name || !location) {
    errorDiv.textContent   = 'Equipment name and location are required.';
    errorDiv.style.display = 'flex';
    return;
  }

  const res = await api.post('/equipment', {
    name,
    model,
    serial_number:       serial,
    location,
    purchase_date:       date || null,
    responsible_user_id: userId || null,
    notes,
  });

  if (res.success) {
    closeModal();
    loadEquipment();
  } else {
    errorDiv.textContent   = res.message;
    errorDiv.style.display = 'flex';
  }
}

loadEquipment();