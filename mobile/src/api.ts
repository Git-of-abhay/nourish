import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as SecureStore from 'expo-secure-store';
import { Image, Platform } from 'react-native';
import { ChatMessage, Dashboard, GuestInput, Meal, MealAnalysis, MealSource, Profile, ReportAnalysis, VoiceAnalysis, Workout } from './types';

const TOKEN_KEY = 'nourish_guest_token';

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75000);
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, { ...options, headers, signal: controller.signal });
  } catch {
    clearTimeout(timer);
    throw new ApiError('Can’t reach the server. Check your internet and try again, the first try can take a minute.', 0);
  }
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  clearTimeout(timer);
  if (!response.ok) throw new ApiError(body?.error || `Request failed (${response.status})`, response.status);
  return body as T;
}

export const guestStore = {
  get: async () => Platform.OS === 'web' ? window.localStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY),
  set: async (token: string) => { if (Platform.OS === 'web') window.localStorage.setItem(TOKEN_KEY, token); else await SecureStore.setItemAsync(TOKEN_KEY, token); },
  clear: async () => { if (Platform.OS === 'web') window.localStorage.removeItem(TOKEN_KEY); else await SecureStore.deleteItemAsync(TOKEN_KEY); },
};

/** Wakes the free server while the loading screen is showing. Failures are fine to ignore. */
export async function warmServer(): Promise<void> {
  try { await fetch(`${apiBaseUrl()}/health`); } catch { /* the first real request will retry */ }
}

export const api = {
  createGuest: (input: GuestInput) => request<{ token: string; profile: Profile }>('/api/guests', { method: 'POST', body: JSON.stringify(input) }),
  me: (token: string) => request<Profile>('/api/me', {}, token),
  updateProfile: (token: string, input: GuestInput) => request<Profile>('/api/me', { method: 'PUT', body: JSON.stringify(input) }, token),
  dashboard: (token: string, today: string) => request<Dashboard>(`/api/dashboard?today=${encodeURIComponent(today)}`, {}, token),
  addMeal: (token: string, meal: { name: string; kcal: number; portion: string; source: MealSource; logged_on: string }) => request<Meal>('/api/meals', { method: 'POST', body: JSON.stringify(meal) }, token),
  deleteMeal: (token: string, id: string) => request<void>(`/api/meals/${encodeURIComponent(id)}`, { method: 'DELETE' }, token),
  addWorkout: (token: string, workout: { activity: string; minutes: number; logged_on: string }) => request<Workout>('/api/workouts', { method: 'POST', body: JSON.stringify(workout) }, token),
  deleteWorkout: (token: string, id: string) => request<void>(`/api/workouts/${encodeURIComponent(id)}`, { method: 'DELETE' }, token),
  analyzeMeal: (token: string, file: { uri: string; name: string; mimeType: string }) => upload<MealAnalysis>('/api/analyze/meal', token, file),
  analyzeVoice: (token: string, file: { uri: string }) => uploadAudio<VoiceAnalysis>('/api/analyze/voice', token, file.uri),
  analyzeReport: (token: string, file: { uri: string; name: string; mimeType: string }) => upload<ReportAnalysis>('/api/analyze/report', token, file),
  saveReport: (token: string, report: ReportAnalysis) => request<unknown>('/api/reports', { method: 'POST', body: JSON.stringify(report) }, token),
  deleteReport: (token: string, id: string) => request<void>(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' }, token),
  chatMessages: (token: string) => request<ChatMessage[]>('/api/assistant/messages', {}, token),
  askAssistant: (token: string, question: string, today: string) => request<{ answer: string }>('/api/assistant/messages', { method: 'POST', body: JSON.stringify({ question, today }) }, token),
};

// Sent as base64 JSON: multipart uploads from local file URIs are unreliable with Expo's fetch.
function blobToBase64(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Couldn’t read that file.'));
      reader.readAsDataURL(xhr.response as Blob);
    };
    xhr.onerror = () => reject(new Error('Couldn’t read that file.'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri);
    xhr.send();
  });
}

export async function readBase64(uri: string): Promise<string> {
  try { return await FileSystem.readAsStringAsync(uri, { encoding: 'base64' }); }
  catch { return blobToBase64(uri); }
}

async function upload<T>(path: string, token: string, file: { uri: string; name: string; mimeType: string }) {
  let file_base64 = '';
  let mime = file.mimeType;
  if (file.mimeType.startsWith('image/')) {
    try {
      const width = await new Promise<number>(resolve => Image.getSize(file.uri, w => resolve(w), () => resolve(0)));
      const small = await ImageManipulator.manipulateAsync(file.uri, width > 1600 ? [{ resize: { width: 1600 } }] : [], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      file_base64 = small.base64 || ''; mime = 'image/jpeg';
    } catch { /* fall back to reading the file as is */ }
  }
  if (!file_base64) file_base64 = await readBase64(file.uri);
  return request<T>(path, { method: 'POST', body: JSON.stringify({ file_base64, name: file.name, mime }) }, token);
}

async function uploadAudio<T>(path: string, token: string, uri: string) {
  const file_base64 = await readBase64(uri);
  return request<T>(path, { method: 'POST', body: JSON.stringify({ file_base64 }) }, token);
}
