// ─────────────────────────────────────────
//  SMARTMaintain — Auth Helper
//  Handles token storage and user session
// ─────────────────────────────────────────

const API = 'http://localhost:5000/api';

const Auth = {
  // Save token and user after login
  save: (token, user) => {
    localStorage.setItem('sm_token', token);
    localStorage.setItem('sm_user', JSON.stringify(user));
  },

  // Get the saved token
  token: () => localStorage.getItem('sm_token'),

  // Get the saved user object
  user: () => JSON.parse(localStorage.getItem('sm_user') || 'null'),

  // Check if user is logged in
  isLoggedIn: () => !!localStorage.getItem('sm_token'),

  // Clear session and redirect to login
  logout: () => {
    localStorage.removeItem('sm_token');
    localStorage.removeItem('sm_user');
    window.location.href = '../pages/login.html';
  },

  // Redirect to login if not authenticated
  requireAuth: () => {
    if (!Auth.isLoggedIn()) {
      window.location.href = '../pages/login.html';
    }
  },

  // Standard headers for all API requests
  headers: () => ({
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${Auth.token()}`,
  }),
};

// ─────────────────────────────────────────
//  API Helper — makes fetch calls cleaner
// ─────────────────────────────────────────
const api = {
  get: async (endpoint) => {
    const res = await fetch(`${API}${endpoint}`, {
      headers: Auth.headers(),
    });
    return res.json();
  },

  post: async (endpoint, body) => {
    const res = await fetch(`${API}${endpoint}`, {
      method:  'POST',
      headers: Auth.headers(),
      body:    JSON.stringify(body),
    });
    return res.json();
  },

  patch: async (endpoint, body) => {
    const res = await fetch(`${API}${endpoint}`, {
      method:  'PATCH',
      headers: Auth.headers(),
      body:    JSON.stringify(body),
    });
    return res.json();
  },

  delete: async (endpoint) => {
    const res = await fetch(`${API}${endpoint}`, {
      method:  'DELETE',
      headers: Auth.headers(),
    });
    return res.json();
  },
};