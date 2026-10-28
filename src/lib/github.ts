import type { Repository } from "../types";

const GITHUB_API = "https://api.github.com";
const MAX_PAGES = 20;

export async function fetchGitHubRepositories(username: string, temporaryToken?: string): Promise<Repository[]> {
  const normalized = username.trim().replace(/^@/, "");
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(normalized)) {
    throw new Error("Digite um usuário GitHub válido.");
  }

  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (temporaryToken) headers.Authorization = "Bearer " + temporaryToken;

  const all: Repository[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const path = temporaryToken
      ? "/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=100&page=" + page
      : "/users/" + encodeURIComponent(normalized) + "/repos?sort=updated&type=owner&per_page=100&page=" + page;
    const response = await fetch(GITHUB_API + path, { headers, cache: "no-store" });

    if (!response.ok) {
      if (response.status === 401) throw new Error("Token GitHub inválido ou expirado.");
      if (response.status === 404) throw new Error("Usuário GitHub não encontrado.");
      if (response.status === 403 || response.status === 429) {
        throw new Error("Limite de requisições do GitHub atingido. Tente mais tarde ou use um token temporário.");
      }
      throw new Error("Não foi possível acessar o GitHub (HTTP " + response.status + ").");
    }

    const json: unknown = await response.json();
    if (!Array.isArray(json)) throw new Error("Resposta inesperada da API do GitHub.");
    const batch = json.filter((item): item is Repository => (
      typeof item === "object" && item !== null &&
      typeof (item as Repository).id === "number" &&
      typeof (item as Repository).full_name === "string" &&
      typeof (item as Repository).html_url === "string"
    ));
    all.push(...batch);
    if (json.length < 100) break;
    if (page === MAX_PAGES) {
      throw new Error("O GitHub retornou mais de 2.000 repositórios. A importação completa ainda não é suportada.");
    }
  }
  return Array.from(new Map(all.map(repo => [repo.id, repo])).values());
}
