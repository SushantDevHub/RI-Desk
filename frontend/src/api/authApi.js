const API_BASE = 'http://localhost:4000/api/auth';
const TOKEN_KEY = 'auth_token';

async function request(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error ||
      data.message ||
      (res.status === 404 ? 'Service endpoint not found (404).' : `Request failed with status ${res.status}`)
    );
  }

  return data;
}

// Step 1: Mobile number + password
export const loginUser = ({ mobileNumber, password, remember = true }) =>
  request('/login', {
    mobileNumber,
    password,
    remember,
  });

// Step 2: Forgot password with Email ID
export const resetPassword = ({ email, newPassword }) =>
  request('/forgot-password', {
    email,
    newPassword,
  });

// Step 3: Change password for authenticated user
export const changePassword = async ({ currentPassword, newPassword }) => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error ||
      data.message ||
      (res.status === 404 ? 'Service endpoint not found (404).' : `Request failed with status ${res.status}`)
    );
  }

  return data;
};

// Token functions
export const getToken = () =>
  localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

export const setToken = (token, remember = true) => {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};