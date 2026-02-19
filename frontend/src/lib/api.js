import axios from "axios";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

export const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let queue = [];

const flushQueue = (token = null) => {
  queue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(new Error("Token refresh failed"));
  });
  queue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) throw error;

    const refresh = getRefreshToken();
    if (!refresh) {
      clearTokens();
      throw error;
    }

    if (isRefreshing) {
      const token = await new Promise((resolve, reject) => queue.push({ resolve, reject }));
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    }

    original._retry = true;
    isRefreshing = true;
    try {
      const resp = await axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh });
      setTokens({ access: resp.data.access });
      flushQueue(resp.data.access);
      original.headers.Authorization = `Bearer ${resp.data.access}`;
      return api(original);
    } catch (refreshErr) {
      flushQueue(null);
      clearTokens();
      throw refreshErr;
    } finally {
      isRefreshing = false;
    }
  }
);

export async function downloadWithAuth(path, filename, mimeType) {
  const resp = await api.get(path, { responseType: "blob" });
  const blob = new Blob([resp.data], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
