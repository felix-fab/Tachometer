import { config } from '../config.js';
import { fetchJson } from '../util.js';

/** Base URL of the Vikunja API (v1). */
function apiBase() {
  if (!config.vikunja.url) throw new Error('vikunja_not_configured');
  return `${config.vikunja.url}/api/v1`;
}

function authHeaders() {
  if (!config.vikunja.token) throw new Error('vikunja_not_configured');
  return { Authorization: `Bearer ${config.vikunja.token}` };
}

export function isConfigured() {
  return Boolean(config.vikunja.url && config.vikunja.token);
}

/**
 * Fetch all projects the token user has access to, as an id → { title, color } map.
 */
async function fetchProjects() {
  const data = await fetchJson(`${apiBase()}/projects`, { headers: authHeaders() });
  const list = Array.isArray(data) ? data : data?.items || [];
  const map = new Map();
  for (const p of list) {
    if (p && typeof p.id === 'number') {
      map.set(p.id, {
        title: p.title || '',
        color: normalizeColor(p.hex_color),
      });
    }
  }
  return map;
}

/** Normalize a Vikunja hex color (e.g. "1973ff") to a usable CSS color. */
function normalizeColor(value) {
  if (!value) return '';
  let str = String(value).trim();
  if (!/^[0-9a-fA-F]{6}$/.test(str) && !/^#[0-9a-fA-F]{6}$/.test(str)) return '';
  if (!str.startsWith('#')) str = `#${str}`;
  return str;
}

/**
 * Vikunja uses Go's zero-value timestamp (year 1, "0001-01-01") for "no date".
 * Normalize that to null so tasks without a due date are treated correctly.
 */
function normalizeDate(value) {
  if (!value) return null;
  const str = String(value);
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return null;
  // Go's zero-value / any pre-1970 date means "no date".
  if (date.getUTCFullYear() < 1970) return null;
  return str;
}

/** Strip HTML tags and collapse whitespace from the description text. */
function stripHtml(value) {
  if (!value) return '';
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract label names from a task. */
function labelsOf(t) {
  if (Array.isArray(t.labels)) return t.labels.map((l) => l.title || l.name || '').filter(Boolean);
  return [];
}

/** Extract assignee names from a task. */
function assigneesOf(t) {
  if (Array.isArray(t.assignees)) {
    return t.assignees.map((a) => a.name || a.username || '').filter(Boolean);
  }
  return [];
}

/**
 * Fetch open tasks across all accessible projects.
 * Each task is enriched with its project title ("Bereich") and detail fields.
 */
export async function getTasks() {
  const base = apiBase();
  const headers = authHeaders();

  const projectsPromise = fetchProjects();

  // Fetch tasks page by page until we have enough, up to a safe cap.
  const all = [];
  let page = 1;
  const PER_PAGE = 50;
  while (page <= 10) {
    const url = `${base}/tasks?page=${page}&per_page=${PER_PAGE}&sort_by=due_date&order_by=asc`;
    const data = await fetchJson(url, { headers });
    const items = Array.isArray(data) ? data : data?.items || [];
    if (items.length === 0) break;
    all.push(...items);
    const total = data?.total;
    if (Array.isArray(data) || (total !== undefined && page * PER_PAGE >= total)) break;
    page += 1;
  }

  const projects = await projectsPromise;

  return all
    .filter((t) => t && t.done !== true)
    .map((t) => {
      const projectId = t.project_id ?? t.project?.id ?? null;
      const projectInfo = projectId != null ? projects.get(projectId) : null;
      return {
        id: t.id,
        identifier: t.identifier || `#${t.id}`,
        title: t.title || '(Ohne Titel)',
        description: stripHtml(t.description),
        dueDate: normalizeDate(t.due_date),
        priority: t.priority ?? 0,
        percentDone: t.percent_done ?? 0,
        projectId,
        project: projectInfo?.title ?? t.project?.title ?? '',
        projectColor: projectInfo?.color ?? '',
        labels: labelsOf(t),
        assignees: assigneesOf(t),
        createdAt: normalizeDate(t.created),
      };
    });
}
