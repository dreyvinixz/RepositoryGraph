export type Repository = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  archived: boolean;
  fork: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  updated_at: string;
  pushed_at: string | null;
  default_branch: string;
  owner: { login: string };
};

export type Collection = {
  id: string;
  name: string;
  description: string;
  color: string;
  repoIds: number[];
};

export type WorkspaceState = {
  repositories: Repository[];
  collections: Collection[];
  favorites: number[];
  username: string;
  lastSync: string | null;
};

export type Filter = "all" | "public" | "private" | "favorites" | "archived";
export type Sort = "updated" | "name" | "stars";

export const EMPTY_STATE: WorkspaceState = {
  repositories: [],
  collections: [],
  favorites: [],
  username: "dreyvinixz",
  lastSync: null,
};
