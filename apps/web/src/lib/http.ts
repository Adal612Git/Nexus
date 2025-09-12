import axios from "axios";

export const http = axios.create({ baseURL: "/api" });

http.interceptors.request.use((config) => {
  try {
    const access = localStorage.getItem("accessToken");
    if (access) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${access}`;
    }
  } catch {}
  return config;
});

export default http;

