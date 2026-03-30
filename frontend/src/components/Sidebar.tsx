"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import styles from "./Sidebar.module.css";
import { loadProjects, saveProjects, slugify, upsertProject } from "@/lib/projectsStore";
import type { Project, ProjectFormState } from "@/types/project";

type NavItem = {
  href?: string;
  label: string;
  imgSrc: string;
  isPinnedProject?: boolean;
  projectId?: string;
  isAction?: boolean;
};

type PinnedProjectItem = {
  id: string;
  name: string;
};

const PINNED_PROJECTS_KEY = "pinnedProjectIds";

function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function getProjectIdFromPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("projects");
  if (idx === -1) return null;

  const maybeId = parts[idx + 1];
  if (!maybeId || maybeId === "new") return null;

  return maybeId;
}

function readPinnedProjectIds() {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(PINNED_PROJECTS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function writePinnedProjectIds(ids: string[]) {
  if (typeof window === "undefined") return;

  localStorage.setItem(PINNED_PROJECTS_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent("pinned-projects-updated"));
}

function classificationRowsKey(projectId: string) {
  return `classificationRows:${projectId}`;
}

function classificationTop4Key(projectId: string) {
  return `classificationTop4:${projectId}`;
}

function classificationLoadedKey(projectId: string) {
  return `classificationLoaded:${projectId}`;
}

function classificationTotalKey(projectId: string) {
  return `classificationTotal:${projectId}`;
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(true);
  const [pinnedProjects, setPinnedProjects] = useState<PinnedProjectItem[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectFormState>({
    name: "",
    description: "",
  });

  const pathname = usePathname();
  const router = useRouter();
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!collapsed) setCollapsed(true);
  }, [pathname]);

  const hideProjectSpecificItems =
    pathname === "/projects" || pathname === "/greenComputing";

  const currentProjectId = useMemo(() => {
    return getProjectIdFromPath(pathname) ?? "current";
  }, [pathname]);

  const syncPinnedProjects = useCallback(() => {
    const pinnedIds = readPinnedProjectIds();
    const projects = loadProjects();

    const mapped = pinnedIds
      .map((id) => projects.find((project) => project.id === id))
      .filter((project): project is Project => Boolean(project))
      .map((project) => ({
        id: project.id,
        name: project.name,
      }));

    setPinnedProjects(mapped);
  }, []);

  useEffect(() => {
    syncPinnedProjects();

    window.addEventListener(
      "pinned-projects-updated",
      syncPinnedProjects as EventListener
    );
    window.addEventListener("storage", syncPinnedProjects);

    return () => {
      window.removeEventListener(
        "pinned-projects-updated",
        syncPinnedProjects as EventListener
      );
      window.removeEventListener("storage", syncPinnedProjects);
    };
  }, [syncPinnedProjects]);

  useEffect(() => {
    syncPinnedProjects();
  }, [pathname, syncPinnedProjects]);

  useEffect(() => {
    if (!open) return;

    nameInputRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setForm({ name: "", description: "" });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function handleUnpin(projectId: string) {
    const existing = readPinnedProjectIds();
    writePinnedProjectIds(existing.filter((id) => id !== projectId));
    setPinnedProjects((prev) =>
      prev.filter((project) => project.id !== projectId)
    );
  }

  function openCreateModal() {
    setOpen(true);
  }

  function closeCreateModal() {
    setOpen(false);
    setForm({ name: "", description: "" });
  }

  function onCreate() {
    const name = form.name.trim();
    const description = form.description.trim();

    const projectId = slugify(name);
    if (!projectId) return;

    const now = Date.now();
    const existingProjects = loadProjects();

    const newProject: Project = {
      id: projectId,
      name,
      description,
      status: "Active",
      models: 0,
      inferencesToday: "0",
      updatedText: String(now),
      createdAt: now,
    };

    const nextProjects = upsertProject(existingProjects, newProject);
    saveProjects(nextProjects);

    localStorage.removeItem(classificationRowsKey(projectId));
    localStorage.removeItem(classificationTop4Key(projectId));
    localStorage.removeItem(classificationLoadedKey(projectId));
    localStorage.removeItem(classificationTotalKey(projectId));

    window.dispatchEvent(
      new CustomEvent("classification-data-updated", {
        detail: { projectId },
      })
    );

    closeCreateModal();
    router.push(`/projects/${projectId}`);
  }

  const mainItems: NavItem[] = useMemo(
    () => [
      {
        href: "/projects",
        label: "All Projects",
        imgSrc: "/assets/tomra-logo.png",
      },
      {
        label: "New Project",
        imgSrc: "/assets/sidebar/new-projects.png",
        isAction: true,
      },
      {
        href: `/projects/${currentProjectId}`,
        label: "Project Dashboard",
        imgSrc: "/assets/sidebar/project-dashboard.png",
      },
      {
        href: `/projects/${currentProjectId}/models`,
        label: "Model Versions",
        imgSrc: "/assets/sidebar/model-versions.png",
      },
      {
        href: `/projects/${currentProjectId}/deployment`,
        label: "Model Deployment",
        imgSrc: "/assets/sidebar/model-deployment.png",
      },
      {
        href: `/projects/${currentProjectId}/classify`,
        label: "Image Classification",
        imgSrc: "/assets/sidebar/image-classification.png",
      },
      {
        href: `/projects/${currentProjectId}/metrics`,
        label: "Live Metrics",
        imgSrc: "/assets/sidebar/live-metrics.png",
      },
    ],
    [currentProjectId]
  );

  const pinnedItems: NavItem[] = useMemo(
    () =>
      pinnedProjects.map((project) => ({
        href: `/projects/${project.id}`,
        label: project.name,
        imgSrc: "/assets/sidebar/project.png",
        isPinnedProject: true,
        projectId: project.id,
      })),
    [pinnedProjects]
  );

  function isItemActive(item: NavItem) {
    if (item.label === "All Projects") {
      return pathname === "/projects";
    }

    if (item.isAction) {
      return false;
    }

    if (item.isPinnedProject && item.projectId) {
      return pathMatches(pathname, `/projects/${item.projectId}`);
    }

    if (item.label === "Project Dashboard") {
      return pathname === item.href;
    }

    return item.href ? pathMatches(pathname, item.href) : false;
  }

  const mainItemsToRender = hideProjectSpecificItems
    ? mainItems.slice(0, 2)
    : mainItems;

  return (
    <>
      <aside
        className={[
          styles.sidebar,
          collapsed ? styles.collapsed : styles.expanded,
        ].join(" ")}
      >
        <div className={styles.inner}>
          <div className={styles.header}>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className={styles.toggleButton}
            >
              <div className={styles.hamburger}>
                <span />
                <span />
                <span />
              </div>
            </button>
          </div>

          <nav className={styles.nav}>
            {mainItemsToRender.map((item) => (
              <NavLink
                key={item.label}
                item={item}
                collapsed={collapsed}
                isActive={isItemActive(item)}
                onClick={item.isAction ? openCreateModal : undefined}
              />
            ))}
          </nav>

          {pinnedItems.length > 0 && (
            <nav className={styles.nav}>
              {pinnedItems.map((item) => (
                <NavLink
                  key={`pinned-${item.projectId}`}
                  item={item}
                  collapsed={collapsed}
                  isActive={isItemActive(item)}
                  onUnpin={
                    item.projectId ? () => handleUnpin(item.projectId!) : undefined
                  }
                />
              ))}
            </nav>
          )}

          <div style={{ marginTop: "auto", marginBottom: "17px" }}>
            <div className={styles.divider} />

            <nav className={styles.nav}>
              <Link
                href="/greenComputing"
                className={[
                  styles.navItem,
                  collapsed ? styles.navItemCollapsed : styles.navItemExpanded,
                  pathname === "/greenComputing" ? styles.active : "",
                ].join(" ")}
                title="Green Computing"
                aria-label="Green Computing"
              >
                <span className={styles.iconSlot} aria-hidden="true">
                  <Image
                    src="/assets/sidebar/greenComputing.png"
                    alt=""
                    width={28}
                    height={28}
                    className={styles.icon}
                  />
                </span>
                <span
                  className={[
                    styles.label,
                    collapsed ? styles.labelCollapsed : styles.labelExpanded,
                  ].join(" ")}
                >
                  Green Computing
                </span>
              </Link>
            </nav>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className={styles.overlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeCreateModal();
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Create New Project</h2>
              <button className={styles.closeBtn} onClick={closeCreateModal}>
                ✕
              </button>
            </div>

            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                if (form.name.trim().length === 0) return;
                onCreate();
              }}
            >
              <label className={styles.labelField}>
                Project Name
                <input
                  ref={nameInputRef}
                  className={styles.input}
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Waste-Sorter v2"
                  maxLength={60}
                />
              </label>

              <label className={styles.labelField}>
                Project Description
                <textarea
                  className={styles.textarea}
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="What is this project for?"
                  rows={5}
                  maxLength={400}
                />
              </label>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={closeCreateModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={form.name.trim().length === 0}
                  title={
                    form.name.trim().length === 0
                      ? "Project Name is required"
                      : "Create project"
                  }
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function NavLink({
  item,
  collapsed,
  isActive,
  onUnpin,
  onClick,
}: {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
  onUnpin?: () => void;
  onClick?: () => void;
}) {
  const linkClassName = [
    styles.navItem,
    collapsed ? styles.navItemCollapsed : styles.navItemExpanded,
    !collapsed && onUnpin ? styles.pinnedNavItemExpanded : "",
    collapsed && onUnpin ? styles.pinnedNavItemCollapsed : "",
    isActive ? styles.active : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (item.isAction) {
    return (
      <button
        type="button"
        className={linkClassName}
        title={item.label}
        onClick={onClick}
      >
        <span className={styles.iconSlot}>
          <Image
            src={item.imgSrc}
            alt=""
            width={28}
            height={28}
            className={styles.icon}
          />
        </span>

        <span
          className={[
            styles.label,
            collapsed ? styles.labelCollapsed : styles.labelExpanded,
          ].join(" ")}
        >
          {item.label}
        </span>
      </button>
    );
  }

  if (!onUnpin) {
    return (
      <Link href={item.href!} className={linkClassName} title={item.label}>
        <span className={styles.iconSlot}>
          <Image
            src={item.imgSrc}
            alt=""
            width={28}
            height={28}
            className={styles.icon}
          />
        </span>

        <span
          className={[
            styles.label,
            collapsed ? styles.labelCollapsed : styles.labelExpanded,
          ].join(" ")}
        >
          {item.label}
        </span>
      </Link>
    );
  }

  return (
    <div className={styles.pinnedNavRow}>
      <Link href={item.href!} className={linkClassName} title={item.label}>
        <span className={styles.iconSlot}>
          <Image
            src={item.imgSrc}
            alt=""
            width={28}
            height={28}
            className={styles.icon}
          />
        </span>

        <span
          className={[
            styles.label,
            collapsed ? styles.labelCollapsed : styles.labelExpanded,
          ].join(" ")}
        >
          {item.label}
        </span>
      </Link>

      {!collapsed && (
        <button
          type="button"
          className={styles.pinActionBtn}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onUnpin?.();
          }}
          aria-label={`Unpin ${item.label} from sidebar`}
          title="Unpin from Sidebar"
        >
          <Image
            src="/assets/pin.png"
            alt=""
            width={15}
            height={15}
            className={styles.pinActionIcon}
          />
        </button>
      )}
    </div>
  );
}