import type { Project } from "@/types/project";

const STORAGE_KEY = "ml_platform_projects_v1"; // stable key

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function loadProjects(): Project[] {
  // (won't run on server during SSR because we only call it client-side)
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Project[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function upsertProject(projects: Project[], next: Project): Project[] {
  const idx = projects.findIndex((p) => p.id === next.id);
  if (idx === -1) return [next, ...projects];

  const copy = [...projects];
  copy[idx] = { ...copy[idx], ...next };
  return copy;
}