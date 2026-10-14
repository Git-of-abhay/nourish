import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { ChatMessage, Dashboard, GuestInput, Meal, MealAnalysis, Profile, ReportAnalysis, Workout } from './types';

const TOKEN_KEY = 'dayora_guest_token';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:5055` : 'http://localhost:5055';
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, { ...options, headers });
  } catch {
    throw new ApiError('Can’t reach the server. Check your internet and try again, the first try can take a minute.', 0);
  }
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(body?.error || `Request failed (${response.status})`, response.status);
  return body as T;
}

export const guestStore = {
  get: async () => Platform.OS === 'web' ? window.localStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY),
  set: async (token: string) => { if (Platform.OS === 'web') window.localStorage.setItem(TOKEN_KEY, token); else await SecureStore.setItemAsync(TOKEN_KEY, token); },
  clear: async () => { if (Platform.OS === 'web') window.localStorage.removeItem(TOKEN_KEY); else await SecureStore.deleteItemAsync(TOKEN_KEY); },
};

export const api = {
  createGuest: (input: GuestInput) => request<{ token: string; profile: Profile }>('/api/guests', { method: 'POST', body: JSON.stringify(input) }),
  me: (token: string) => request<Profile>('/api/me', {}, token),
  updateProfile: (token: string, input: GuestInput) => request<Profile>('/api/me', { method: 'PUT', body: JSON.stringify(input) }, token),
  dashboard: (token: string, today: string) => request<Dashboard>(`/api/dashboard?today=${encodeURIComponent(today)}`, {}, token),
  addMeal: (token: string, meal: { name: string; kcal: number; portion: string; source: 'manual' | 'photo_estimate'; logged_on: string }) => request<Meal>('/api/meals', { method: 'POST', body: JSON.stringify(meal) }, token),
  deleteMeal: (token: string, id: string) => request<void>(`/api/meals/${encodeURIComponent(id)}`, { method: 'DELETE' }, token),
  addWorkout: (token: string, workout: { activity: string; minutes: number; logged_on: string }) => request<Workout>('/api/workouts', { method: 'POST', body: JSON.stringify(workout) }, token),
  deleteWorkout: (token: string, id: string) => request<void>(`/api/workouts/${encodeURIComponent(id)}`, { method: 'DELETE' }, token),
  analyzeMeal: (token: string, file: { uri: string; name: string; mimeType: string }) => upload<MealAnalysis>('/api/analyze/meal', token, file),
  analyzeReport: (token: string, file: { uri: string; name: string; mimeType: string }) => upload<ReportAnalysis>('/api/analyze/report', token, file),
  saveReport: (token: string, report: ReportAnalysis) => request<unknown>('/api/reports', { method: 'POST', body: JSON.stringify(report) }, token),
  deleteReport: (token: string, id: string) => request<void>(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' }, token),
  chatMessages: (token: string) => request<ChatMessage[]>('/api/assistant/messages', {}, token),
  askAssistant: (token: string, question: string, today: string) => request<{ answer: string }>('/api/assistant/messages', { method: 'POST', body: JSON.stringify({ question, today }) }, token),
};

// Sent as base64 JSON: multipart uploads from local file URIs are unreliable with Expo's fetch.
async function upload<T>(path: string, token: string, file: { uri: string; name: string; mimeType: string }) {
  const file_base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
  return request<T>(path, { method: 'POST', body: JSON.stringify({ file_base64, name: file.name, mime: file.mimeType }) }, token);
}
