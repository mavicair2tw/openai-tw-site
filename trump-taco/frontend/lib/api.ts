export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchLatestStatements() {
  const res = await fetch(`${API_BASE_URL}/api/events/latest`);
  return res.json();
}

export async function fetchTimeline() {
  const res = await fetch(`${API_BASE_URL}/api/events/timeline`);
  return res.json();
}

export async function fetchDailyReports() {
  const res = await fetch(`${API_BASE_URL}/api/reports/daily`);
  return res.json();
}

export async function fetchAlerts() {
  const res = await fetch(`${API_BASE_URL}/api/alerts`);
  return res.json();
}

export async function fetchNarrativeRadar() {
  const res = await fetch(`${API_BASE_URL}/api/narrative`);
  return res.json();
}
