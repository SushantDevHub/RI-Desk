const API_BASE = 'http://localhost:4000/api/auth';
const TOKEN_KEY = 'auth_token';

async function request(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

export const loginUser    = ({ username, password })        => request('/login',    { username, password });
export const registerUser = ({ name, username, password })  => request('/register', { name, username, password });
export const getToken     = ()      => localStorage.getItem(TOKEN_KEY);
export const setToken     = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken   = ()      => localStorage.removeItem(TOKEN_KEY);
