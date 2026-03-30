import { describe, it, expect, beforeEach } from "vitest";
import {
  slugify,
  loadProjects,
  saveProjects,
  upsertProject,
} from "../lib/projectsStore";
import type { Project } from "../types/project";

// Helper to create a valid Project fixture with all required fields
function makeProject(
  overrides: Partial<Project> & { id: string; name: string },
): Project {
  return {
    description: "Test description",
    status: "Active",
    models: 1,
    inferencesToday: "0",
    updatedText: "just now",
    createdAt: 1000000,
    ...overrides,
  } as Project;
}

// ── slugify ───────────────────────────────────────────────────────────────

describe("slugify", () => {
  it("lowercases the input", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("my project name")).toBe("my-project-name");
  });

  it("trims leading and trailing whitespace", () => {
    expect(slugify("  hello  ")).toBe("hello");
  });

  it("removes special characters", () => {
    expect(slugify("hello@world!")).toBe("helloworld");
  });

  it("preserves hyphens and numbers", () => {
    expect(slugify("project-1")).toBe("project-1");
  });

  it("collapses multiple spaces into a single hyphen", () => {
    expect(slugify("hello   world")).toBe("hello-world");
  });

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });
});

// ── loadProjects ──────────────────────────────────────────────────────────

describe("loadProjects", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array when localStorage is empty", () => {
    expect(loadProjects()).toEqual([]);
  });

  it("returns parsed projects from localStorage", () => {
    const projects: Project[] = [
      makeProject({ id: "1", name: "Test Project" }),
    ];
    localStorage.setItem("ml_platform_projects_v1", JSON.stringify(projects));
    expect(loadProjects()).toEqual(projects);
  });

  it("returns empty array when localStorage contains invalid JSON", () => {
    localStorage.setItem("ml_platform_projects_v1", "not-valid-json");
    expect(loadProjects()).toEqual([]);
  });

  it("returns empty array when localStorage contains non-array JSON", () => {
    localStorage.setItem(
      "ml_platform_projects_v1",
      JSON.stringify({ id: "1" }),
    );
    expect(loadProjects()).toEqual([]);
  });

  it("returns multiple projects correctly", () => {
    const projects: Project[] = [
      makeProject({ id: "1", name: "Project A" }),
      makeProject({ id: "2", name: "Project B" }),
    ];
    localStorage.setItem("ml_platform_projects_v1", JSON.stringify(projects));
    expect(loadProjects()).toHaveLength(2);
    expect(loadProjects()[0].name).toBe("Project A");
  });
});

// ── saveProjects ──────────────────────────────────────────────────────────

describe("saveProjects", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves projects to localStorage", () => {
    const projects: Project[] = [
      makeProject({ id: "1", name: "Test Project" }),
    ];
    saveProjects(projects);
    const raw = localStorage.getItem("ml_platform_projects_v1");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual(projects);
  });

  it("overwrites existing data in localStorage", () => {
    const original: Project[] = [makeProject({ id: "1", name: "Old" })];
    const updated: Project[] = [makeProject({ id: "2", name: "New" })];
    saveProjects(original);
    saveProjects(updated);
    expect(loadProjects()).toEqual(updated);
  });

  it("saves an empty array", () => {
    saveProjects([]);
    expect(loadProjects()).toEqual([]);
  });
});

// ── upsertProject ─────────────────────────────────────────────────────────

describe("upsertProject", () => {
  it("prepends a new project when id does not exist", () => {
    const existing: Project[] = [makeProject({ id: "1", name: "Old" })];
    const newProject: Project = makeProject({ id: "2", name: "New" });

    const result = upsertProject(existing, newProject);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(newProject);
  });

  it("updates existing project when id matches", () => {
    const existing: Project[] = [makeProject({ id: "1", name: "Old Name" })];
    const updated: Project = makeProject({ id: "1", name: "New Name" });

    const result = upsertProject(existing, updated);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("New Name");
  });

  it("does not mutate the original array", () => {
    const existing: Project[] = [makeProject({ id: "1", name: "Old" })];
    const updated: Project = makeProject({ id: "1", name: "New" });

    upsertProject(existing, updated);

    expect(existing[0].name).toBe("Old");
  });

  it("inserts into empty array", () => {
    const newProject: Project = makeProject({ id: "1", name: "First" });
    const result = upsertProject([], newProject);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(newProject);
  });

  it("preserves other projects when updating one", () => {
    const existing: Project[] = [
      makeProject({ id: "1", name: "Project A" }),
      makeProject({ id: "2", name: "Project B" }),
    ];
    const updated: Project = makeProject({ id: "1", name: "Updated A" });

    const result = upsertProject(existing, updated);

    expect(result).toHaveLength(2);
    expect(result[1].name).toBe("Project B");
  });
});
