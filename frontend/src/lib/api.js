import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("zi_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function saveToken(token) {
  localStorage.setItem("zi_token", token);
}
export function clearToken() {
  localStorage.removeItem("zi_token");
}
export function getToken() {
  return localStorage.getItem("zi_token");
}

export function saveInternToken(token) {
  localStorage.setItem("zi_intern_token", token);
}

export function getInternToken() {
  return localStorage.getItem("zi_intern_token");
}

export function clearInternToken() {
  localStorage.removeItem("zi_intern_token");
}
