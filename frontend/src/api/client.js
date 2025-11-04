import axios from 'axios';

export function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl;
  }
  const { protocol, hostname } = window.location;
  const defaultPort = protocol === 'https:' ? 443 : 4000;
  return `${protocol}//${hostname}:${defaultPort}`;
}

export function createApiClient(userId) {
  const baseURL = getApiBaseUrl();
  const headers = userId
    ? {
        'x-user-id': userId
      }
    : undefined;
  return axios.create({
    baseURL,
    headers
  });
}
