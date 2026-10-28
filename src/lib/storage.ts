import { EMPTY_STATE } from "../types";
import type { WorkspaceState, Collection, Repository } from "../types";

const KEY = "repository-graph:v0.1:workspace";

function validRepo(value: unknown): value is Repository {
  return typeof value === "object" && value !== null &&
    typeof (value as Repository).id === "number" &&
    typeof (value as Repository).full_name === "string";
}

function validCollection(value: unknown): value is Collection {
  return typeof value === "object" && value !== null &&
    typeof (value as Collection).id === "string" &&
    typeof (value as Collection).name === "string" &&
    Array.isArray((value as Collection).repoIds);
}

export function normalizeWorkspace(input: unknown): WorkspaceState {
  if (!input || typeof input !== "object") return { ...EMPTY_STATE };
  const s = input as Partial<WorkspaceState>;
  return {
    repositories: Array.isArray(s.repositories) ? s.repositories.filter(validRepo) : [],
    collections: Array.isArray(s.collections) ? s.collections.filter(validCollection) : [],
    favorites: Array.isArray(s.favorites) ? s.favorites.filter(x => typeof x === "number") : [],
    username: typeof s.username === "string" ? s.username : EMPTY_STATE.username,
    lastSync: typeof s.lastSync === "string" ? s.lastSync : null,
  };
}

export function readLocalWorkspace(): WorkspaceState {
  try {
    const value = localStorage.getItem(KEY);
    return value ? normalizeWorkspace(JSON.parse(value)) : { ...EMPTY_STATE };
  } catch {
    return { ...EMPTY_STATE };
  }
}

export function writeLocalWorkspace(workspace: WorkspaceState): void {
  try {
    // Private metadata must not survive unauthenticated browser sessions.
    localStorage.setItem(KEY, JSON.stringify({
      ...workspace,
      repositories: workspace.repositories.filter(repo => !repo.private),
    }));
  } catch {
    // Storage might be disabled: the current in-memory session still works.
  }
}
