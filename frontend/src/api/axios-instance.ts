import Axios, { type AxiosRequestConfig } from "axios";
import { env } from "../../env";

const instance = Axios.create({
  baseURL: env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
});

export const axiosInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> =>
  instance({
    ...config,
    headers: { ...config.headers, ...options?.headers },
  }).then(({ data }) => data as T);
