import { createClient } from "@supabase/supabase-js";
import { normalizeWorkspace } from "./storage";
import type { WorkspaceState } from "../types";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && key
  ? createClient(url, key, { auth: { flowType: "pkce", autoRefreshToken: true, persistSession: true } })
  : null;

export async function loadCloudWorkspace(userId: string): Promise<WorkspaceState | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("repository_workspaces")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeWorkspace(data.state) : null;
}

export async function saveCloudWorkspace(userId: string, workspace: WorkspaceState): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("repository_workspaces")
    .upsert({ user_id: userId, state: workspace, updated_at: new Date().toISOString() });
  if (error) throw error;
}
