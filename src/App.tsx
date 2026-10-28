import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity, ArrowDownUp, ArrowRight, CalendarDays, Check, ChevronRight,
  CircleAlert, Clock3, Code2, ExternalLink, FolderClosed, FolderPlus,
  GitBranch, GitFork, LayoutDashboard, LoaderCircle, LockKeyhole,
  LogIn, LogOut, Menu, Network, Plus, RefreshCw, Search, ShieldCheck,
  SlidersHorizontal, Star, X,
} from "lucide-react";
import { fetchGitHubRepositories } from "./lib/github";
import { loadCloudWorkspace, saveCloudWorkspace, supabase } from "./lib/supabase";
import { readLocalWorkspace, writeLocalWorkspace } from "./lib/storage";
import type { Collection, Filter, Repository, Sort, WorkspaceState } from "./types";

type View = "dashboard" | "repositories" | "favorites" | "collection";
const COLORS = ["#8b7cf8", "#3dba9c", "#e6b866", "#5ca6e8", "#ee8a9b"];
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

function relativeDate(value: string | null): string {
  if (!value) return "Sem atividade";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "Data indisponível";
  const days = Math.max(0, Math.floor((Date.now() - time) / 86400000));
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 30) return "Há " + days + " dias";
  return dateFormatter.format(new Date(value));
}

function countLabel(n: number): string {
  return Intl.NumberFormat("pt-BR").format(n);
}

function isRecent(repo: Repository): boolean {
  if (!repo.pushed_at) return false;
  return Date.now() - new Date(repo.pushed_at).getTime() < 30 * 86400000;
}

function uniqueLanguages(repos: Repository[]): { language: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const repo of repos) {
    if (repo.language) counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([language, count]) => ({ language, count }));
}

function IconButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return <button type="button" className={"icon-button" + (active ? " is-active" : "")} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [onClose]);
  return (
    <div className="modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-top"><h2>{title}</h2><IconButton label="Fechar" onClick={onClose}><X size={18} /></IconButton></div>
        {children}
      </section>
    </div>
  );
}

function ImportDialog({
  initialUsername, onClose, onImport, busy,
}: {
  initialUsername: string;
  onClose: () => void;
  onImport: (username: string, token?: string) => Promise<void>;
  busy: boolean;
}) {
  const [username, setUsername] = useState(initialUsername);
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const secret = token.trim();
    await onImport(username.trim(), secret || undefined);
    setToken("");
  }
  return (
    <Modal title="Importar repositórios" onClose={onClose}>
      <p className="muted modal-description">Conecte a sua conta GitHub e reúna os repositórios em um único espaço de trabalho.</p>
      <form className="form-stack" onSubmit={submit}>
        <label className="field-label" htmlFor="github-username">Usuário GitHub</label>
        <div className="input-with-icon"><GitBranch size={17} /><input id="github-username" autoFocus required maxLength={39} spellCheck={false} value={username} onChange={e => setUsername(e.target.value)} placeholder="dreyvinixz" /></div>
        <div className="token-heading"><label className="field-label" htmlFor="github-token">Token fine-grained (opcional)</label><span className="subtle-label">Acesso privado</span></div>
        <div className="input-with-icon"><LockKeyhole size={17} /><input id="github-token" autoComplete="off" type={showToken ? "text" : "password"} value={token} onChange={e => setToken(e.target.value)} placeholder="github_pat_..." /><button type="button" className="text-button" onClick={() => setShowToken(s => !s)}>{showToken ? "Ocultar" : "Exibir"}</button></div>
        <div className="security-note"><ShieldCheck size={17} /><p>Para acessar repositórios privados, use um token de permissão mínima, criado para os repositórios desejados (Metadata: Read). Ele não é salvo no navegador nem no Supabase. Sem token, apenas repositórios públicos são importados.</p></div>
        <div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" type="submit" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <RefreshCw size={17} />}{busy ? "Importando..." : "Importar do GitHub"}</button></div>
      </form>
    </Modal>
  );
}

function NewCollectionDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, description: string, color: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim()) onCreate(name.trim(), description.trim(), color);
  }
  return (
    <Modal title="Nova coleção" onClose={onClose}>
      <p className="muted modal-description">Agrupe diferentes repositórios de um mesmo projeto ou área de trabalho.</p>
      <form className="form-stack" onSubmit={submit}>
        <label className="field-label" htmlFor="collection-name">Nome da coleção</label>
        <input id="collection-name" className="field-input" required autoFocus maxLength={60} placeholder="Ex.: QuantBase, Pesquisa, Extensões" value={name} onChange={e => setName(e.target.value)} />
        <label className="field-label" htmlFor="collection-description">Descrição (opcional)</label>
        <input id="collection-description" className="field-input" maxLength={200} placeholder="Sobre esta coleção" value={description} onChange={e => setDescription(e.target.value)} />
        <span className="field-label">Cor</span>
        <div className="color-palette">{COLORS.map(c => <button type="button" className={"color-circle" + (color === c ? " picked" : "")} key={c} aria-label={"Cor " + c} title={c} style={{ backgroundColor: c }} onClick={() => setColor(c)}>{color === c && <Check size={15} />}</button>)}</div>
        <div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Cancelar</button><button type="submit" className="button primary"><Plus size={17} />Criar coleção</button></div>
      </form>
    </Modal>
  );
}

function RepoRow({
  repo, favorite, collections, onFavorite, onToggleCollection, activeCollectionId,
}: {
  repo: Repository; favorite: boolean; collections: Collection[];
  onFavorite: (id: number) => void; onToggleCollection: (collectionId: string, repoId: number) => void;
  activeCollectionId?: string;
}) {
  const [showCollections, setShowCollections] = useState(false);
  const assigned = collections.filter(c => c.repoIds.includes(repo.id));
  return (
    <article className="repo-row">
      <div className="repo-symbol"><GitBranch size={19} /></div>
      <div className="repo-information">
        <div className="repo-title-row"><a className="repo-name" href={repo.html_url} target="_blank" rel="noopener noreferrer">{repo.name}<ExternalLink size={13} /></a>{repo.private && <span className="pill private">Privado</span>}{repo.archived && <span className="pill archived">Arquivado</span>}</div>
        <p className="repo-description">{repo.description || "Sem descrição no GitHub."}</p>
        <div className="repo-subline"><span>{repo.owner.login}</span>{repo.language && <><span className="dot" /><span>{repo.language}</span></>}{assigned.length > 0 && <><span className="dot" /><span>{assigned.map(c => c.name).join(", ")}</span></>}</div>
      </div>
      <div className="repo-numbers"><Star size={14} />{countLabel(repo.stargazers_count)}</div>
      <div className="repo-numbers"><GitFork size={14} />{countLabel(repo.forks_count)}</div>
      <span className="repo-updated">{relativeDate(repo.pushed_at || repo.updated_at)}</span>
      <div className="repo-actions">
        <IconButton label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} active={favorite} onClick={() => onFavorite(repo.id)}><Star size={17} fill={favorite ? "currentColor" : "none"} /></IconButton>
        <div className="assign-wrap">
          <IconButton label="Organizar em coleções" active={showCollections} onClick={() => setShowCollections(value => !value)}><FolderPlus size={17} /></IconButton>
          {showCollections && <div className="assign-popover"><p>Adicionar às coleções</p>{collections.length === 0 ? <span className="muted">Crie uma coleção na barra lateral.</span> : collections.map(collection => <button type="button" key={collection.id} onClick={() => onToggleCollection(collection.id, repo.id)}><span className="color-dot" style={{ backgroundColor: collection.color }} />{collection.name}{collection.repoIds.includes(repo.id) && <Check size={15} />}</button>)}{activeCollectionId && <button type="button" className="remove-from-collection" onClick={() => { onToggleCollection(activeCollectionId, repo.id); setShowCollections(false); }}>Remover desta coleção</button>}</div>}
        </div>
      </div>
    </article>
  );
}

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(readLocalWorkspace);
  const [view, setView] = useState<View>("dashboard");
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("updated");
  const [query, setQuery] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  useEffect(() => { writeLocalWorkspace(workspace); }, [workspace]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setSession(data.session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session?.user.id) {
      setCloudReady(false);
      return;
    }
    let active = true;
    setCloudReady(false);
    setCloudError(null);
    loadCloudWorkspace(session.user.id).then(remote => {
      if (!active) return;
      if (remote) setWorkspace(remote);
      setCloudReady(true);
    }).catch(error => {
      if (!active) return;
      setCloudError("A sincronização Supabase não está configurada: " + String(error?.message ?? error));
      setCloudReady(false);
    });
    return () => { active = false; };
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user.id || !cloudReady) return;
    const handle = window.setTimeout(() => {
      saveCloudWorkspace(session.user.id, workspace).then(() => setCloudError(null)).catch(error => {
        setCloudError("Não foi possível salvar na nuvem: " + String(error?.message ?? error));
      });
    }, 1100);
    return () => window.clearTimeout(handle);
  }, [workspace, session?.user.id, cloudReady]);

  const repos = workspace.repositories;
  const activeCollection = workspace.collections.find(c => c.id === collectionId) ?? null;
  const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const recentRepos = repos.filter(isRecent);
  const sorted = useMemo(() => {
    let result = repos;
    if (view === "favorites") result = result.filter(repo => workspace.favorites.includes(repo.id));
    if (view === "collection") result = result.filter(repo => activeCollection?.repoIds.includes(repo.id));
    if (filter === "public") result = result.filter(repo => !repo.private);
    if (filter === "private") result = result.filter(repo => repo.private);
    if (filter === "favorites") result = result.filter(repo => workspace.favorites.includes(repo.id));
    if (filter === "archived") result = result.filter(repo => repo.archived);
    const text = query.trim().toLocaleLowerCase("pt-BR");
    if (text) result = result.filter(repo => [repo.full_name, repo.description ?? "", repo.language ?? ""].some(value => value.toLocaleLowerCase("pt-BR").includes(text)));
    return [...result].sort((a, b) => {
      if (sort === "name") return a.full_name.localeCompare(b.full_name);
      if (sort === "stars") return b.stargazers_count - a.stargazers_count;
      return new Date(b.pushed_at || b.updated_at).getTime() - new Date(a.pushed_at || a.updated_at).getTime();
    });
  }, [repos, view, activeCollection, filter, query, sort, workspace.favorites]);

  async function importRepositories(username: string, temporaryToken?: string) {
    setImporting(true);
    setStatus(null);
    try {
      const imported = await fetchGitHubRepositories(username, temporaryToken);
      setWorkspace(current => {
        const combined = new Map(current.repositories.map(repo => [repo.id, repo]));
        imported.forEach(repo => combined.set(repo.id, repo));
        return { ...current, repositories: [...combined.values()], username, lastSync: new Date().toISOString() };
      });
      setStatus({ kind: "success", message: countLabel(imported.length) + " repositórios consultados no GitHub e incorporados ao workspace." });
      setShowImport(false);
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Falha ao importar repositórios." });
    } finally {
      setImporting(false);
    }
  }

  function toggleFavorite(id: number) {
    setWorkspace(current => ({
      ...current,
      favorites: current.favorites.includes(id) ? current.favorites.filter(value => value !== id) : [...current.favorites, id],
    }));
  }

  function toggleCollection(id: string, repoId: number) {
    setWorkspace(current => ({
      ...current,
      collections: current.collections.map(collection => collection.id !== id ? collection : {
        ...collection, repoIds: collection.repoIds.includes(repoId) ? collection.repoIds.filter(value => value !== repoId) : [...collection.repoIds, repoId],
      }),
    }));
  }

  function createCollection(name: string, description: string, color: string) {
    const id = crypto.randomUUID();
    setWorkspace(current => ({
      ...current,
      collections: [...current.collections, { id, name, description, color, repoIds: [] }],
    }));
    setCollectionId(id);
    setView("collection");
    setShowNewCollection(false);
    setFilter("all");
    setQuery("");
  }

  async function signIn() {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.origin + window.location.pathname, scopes: "read:user" },
    });
    if (error) setStatus({ kind: "error", message: error.message });
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }
    setCloudReady(false);
    setWorkspace(current => ({ ...current, repositories: current.repositories.filter(repo => !repo.private) }));
  }

  function navigate(next: View, id?: string) {
    setView(next);
    setCollectionId(id ?? null);
    setSidebarOpen(false);
    setQuery("");
    setFilter("all");
  }

  const title = view === "dashboard" ? "Visão geral" : view === "repositories" ? "Repositórios" : view === "favorites" ? "Favoritos" : activeCollection?.name ?? "Coleção";
  const subtitle = view === "dashboard" ? "Um panorama completo do seu ecossistema de desenvolvimento." : view === "repositories" ? "Todos os seus repositórios em um só lugar." : view === "favorites" ? "Seus repositórios em destaque." : activeCollection?.description || "Repositórios organizados nesta coleção.";
  const displayed = view === "dashboard" && !query && filter === "all" ? sorted.slice(0, 7) : sorted;
  const languages = uniqueLanguages(repos);

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="mobile-scrim" onClick={() => setSidebarOpen(false)} />}
      <aside className={"sidebar" + (sidebarOpen ? " open" : "")}>
        <div className="brand"><div className="brand-mark"><Network size={24} strokeWidth={2.2} /></div><div><strong>Repository<span>Graph</span></strong><small>DEVELOPER WORKSPACE</small></div></div>
        <div className="workspace-switch"><div className="workspace-avatar">RG</div><span><b>Meu workspace</b><small>{countLabel(repos.length)} repositórios</small></span><ChevronRight size={15} className="muted" /></div>
        <nav className="side-nav" aria-label="Navegação principal">
          <p className="nav-caption">WORKSPACE</p>
          <button className={"nav-item" + (view === "dashboard" ? " selected" : "")} onClick={() => navigate("dashboard")}><LayoutDashboard size={18} />Visão geral</button>
          <button className={"nav-item" + (view === "repositories" ? " selected" : "")} onClick={() => navigate("repositories")}><GitBranch size={18} />Repositórios<span className="nav-number">{repos.length}</span></button>
          <button className={"nav-item" + (view === "favorites" ? " selected" : "")} onClick={() => navigate("favorites")}><Star size={18} />Favoritos<span className="nav-number">{workspace.favorites.length}</span></button>
          <div className="nav-section-head"><p className="nav-caption">COLEÇÕES</p><IconButton label="Criar coleção" onClick={() => setShowNewCollection(true)}><Plus size={15} /></IconButton></div>
          {workspace.collections.map(collection => <button key={collection.id} className={"nav-item collection-nav" + (view === "collection" && collectionId === collection.id ? " selected" : "")} onClick={() => navigate("collection", collection.id)}><span className="collection-indicator" style={{ backgroundColor: collection.color }} />{collection.name}<span className="nav-number">{collection.repoIds.length}</span></button>)}
          {workspace.collections.length === 0 && <button className="create-hint" onClick={() => setShowNewCollection(true)}>+ Criar primeira coleção</button>}
          <p className="nav-caption tools-caption">EM BREVE</p>
          <div className="nav-item disabled"><CalendarDays size={18} />Agenda<span className="coming-tag">v0.3</span></div>
          <div className="nav-item disabled"><Network size={18} />Repository Graph<span className="coming-tag">v0.4</span></div>
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-version"><span className="version-dot" />v0.1.0 · Foundation</div><a href="https://github.com/dreyvinixz/RepositoryGraph" target="_blank" rel="noopener noreferrer" className="sidebar-github"><GitBranch size={17} />Abrir no GitHub<ExternalLink size={13} /></a></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="topbar-left"><IconButton label="Abrir menu" onClick={() => setSidebarOpen(value => !value)}><Menu size={20} /></IconButton><span className="topbar-path">Workspace <ChevronRight size={14} /> <b>{title}</b></span></div><div className="topbar-right"><span className="status-chip"><span className="status-light" />{supabase && session ? "Cloud conectado" : "Modo local"}</span>{supabase && (session ? <button className="topbar-auth" onClick={signOut}><LogOut size={15} />Sair</button> : <button className="topbar-auth" onClick={signIn}><LogIn size={15} />Entrar com GitHub</button>)}<div className="profile-avatar">{session?.user.user_metadata?.user_name?.slice(0, 2).toUpperCase() || "RG"}</div></div></header>
        <div className="content">
          {status && <div role="status" className={"toast " + status.kind}>{status.kind === "error" ? <CircleAlert size={18} /> : <Check size={18} />}<span>{status.message}</span><IconButton label="Dispensar aviso" onClick={() => setStatus(null)}><X size={15} /></IconButton></div>}
          {cloudError && <div className="toast error" role="alert"><CircleAlert size={18} /><span>{cloudError}. O modo local continua disponível.</span></div>}
          <section className="page-heading"><div><div className="eyebrow"><span />REPOSITORYGRAPH / WORKSPACE</div><h1>{title}</h1><p>{subtitle}</p></div><button className="button primary" onClick={() => setShowImport(true)}><RefreshCw size={17} />Importar repositórios</button></section>

          {view === "dashboard" && <>
            <section className="metrics" aria-label="Indicadores do workspace">
              <div className="metric-card"><div className="metric-head"><span>Total de repositórios</span><GitBranch size={18} /></div><strong>{countLabel(repos.length)}</strong><small><span className="metric-trend">GitHub</span> monitorados neste workspace</small></div>
              <div className="metric-card"><div className="metric-head"><span>Coleções</span><FolderClosed size={18} /></div><strong>{countLabel(workspace.collections.length)}</strong><small>Grupos organizados por você</small></div>
              <div className="metric-card"><div className="metric-head"><span>Ativos nos últimos 30 dias</span><Activity size={18} /></div><strong>{countLabel(recentRepos.length)}</strong><small>Com push recente no GitHub</small></div>
              <div className="metric-card"><div className="metric-head"><span>Estrelas acumuladas</span><Star size={18} /></div><strong>{countLabel(totalStars)}</strong><small>Soma dos repositórios importados</small></div>
            </section>
            {repos.length > 0 && <section className="welcome-strip"><div className="welcome-illustration"><Network size={30} /></div><div><span className="strip-kicker">SEU ECOSSISTEMA, EM UM LUGAR</span><h2>Organize seus projetos com clareza.</h2><p>Crie coleções para agrupar os repositórios de cada produto, pesquisa ou equipe.</p></div><button className="button secondary" onClick={() => setShowNewCollection(true)}>Nova coleção <ArrowRight size={16} /></button></section>}
            <section className="dashboard-columns"><div className="panel"><div className="panel-head"><div><h2>Atividade recente</h2><p>Repositórios com atualizações mais recentes</p></div><span className="panel-icon"><Clock3 size={19} /></span></div>{repos.length ? <div className="activity-list">{[...repos].sort((a,b) => new Date(b.pushed_at || b.updated_at).getTime()-new Date(a.pushed_at || a.updated_at).getTime()).slice(0,4).map(repo => <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="activity-item" key={repo.id}><span className="activity-icon"><GitBranch size={16} /></span><span><strong>{repo.name}</strong><small>{repo.owner.login} · Atualizado {relativeDate(repo.pushed_at || repo.updated_at).toLowerCase()}</small></span><ExternalLink size={14} /></a>)}</div> : <div className="compact-empty">Importe repositórios para visualizar a atividade.</div>}</div>
              <div className="panel language-panel"><div className="panel-head"><div><h2>Stack principal</h2><p>Linguagens dos seus repositórios</p></div><span className="panel-icon"><Code2 size={19} /></span></div>{languages.length ? <div className="language-list">{languages.map((entry, index) => <div className="language-item" key={entry.language}><div className="language-label"><span><i className={"language-dot lang-" + index} />{entry.language}</span><b>{entry.count}</b></div><div className="progress-rail"><span className={"progress-fill lang-" + index} style={{width: (entry.count / repos.length * 100) + "%"}} /></div></div>)}</div> : <div className="compact-empty">As linguagens aparecerão após a importação.</div>}</div>
            </section>
          </>}

          {repos.length === 0 && <section className="first-run"><div className="first-run-icon"><GitBranch size={33} /></div><h2>Seu espaço de trabalho começa aqui</h2><p>Importe os seus repositórios reais do GitHub para visualizar, pesquisar e organizá-los em coleções personalizadas.</p><button className="button primary" onClick={() => setShowImport(true)}><RefreshCw size={17} />Conectar ao GitHub</button><small>Não é necessário configurar credenciais para repositórios públicos.</small></section>}

          {repos.length > 0 && <section className="repos-panel">
            <div className="repos-heading"><div><h2>{view === "dashboard" ? "Seus repositórios" : title}</h2><p>{view === "dashboard" ? "Explore e gerencie seu portfólio" : countLabel(sorted.length) + " repositórios encontrados"}</p></div>{view === "dashboard" && <button className="view-all" onClick={() => navigate("repositories")}>Ver todos <ArrowRight size={16} /></button>}{view === "collection" && activeCollection && <span className="collection-badge" style={{borderColor: activeCollection.color, color: activeCollection.color}}>{activeCollection.repoIds.length} associados</span>}</div>
            <div className="repo-toolbar"><div className="search-box"><Search size={17} /><input aria-label="Buscar repositórios" placeholder="Buscar repositórios, linguagens..." value={query} onChange={e => setQuery(e.target.value)} /></div><div className="toolbar-select"><SlidersHorizontal size={16} /><select aria-label="Filtrar por visibilidade" value={filter} onChange={e => setFilter(e.target.value as Filter)}><option value="all">Todos</option><option value="public">Públicos</option><option value="private">Privados</option><option value="favorites">Favoritos</option><option value="archived">Arquivados</option></select></div><div className="toolbar-select"><ArrowDownUp size={16} /><select aria-label="Ordenar repositórios" value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="updated">Atividade recente</option><option value="name">Nome A–Z</option><option value="stars">Mais estrelas</option></select></div></div>
            <div className="table-header"><span>REPOSITÓRIO</span><span>STARS</span><span>FORKS</span><span>ÚLTIMA ATIVIDADE</span><span>AÇÕES</span></div>
            <div className="repo-list">{displayed.length ? displayed.map(repo => <RepoRow key={repo.id} repo={repo} favorite={workspace.favorites.includes(repo.id)} collections={workspace.collections} onFavorite={toggleFavorite} onToggleCollection={toggleCollection} activeCollectionId={view === "collection" ? activeCollection?.id : undefined} />) : <div className="empty-filter"><Search size={28} /><strong>Nenhum repositório encontrado</strong><p>Altere os filtros ou adicione repositórios a esta coleção.</p></div>}</div>
            <div className="repo-footer"><span>Exibindo {countLabel(displayed.length)} de {countLabel(sorted.length)} nesta visualização</span>{workspace.lastSync && <span>Última importação: {dateFormatter.format(new Date(workspace.lastSync))}</span>}</div>
          </section>}

          {repos.length > 0 && <footer className="page-footer"><span>RepositoryGraph v0.1.0 · Dados fornecidos pela API do GitHub</span><span>Sincronização sob demanda</span></footer>}
        </div>
      </main>
      {showImport && <ImportDialog initialUsername={workspace.username} busy={importing} onImport={importRepositories} onClose={() => { if (!importing) setShowImport(false); }} />}
      {showNewCollection && <NewCollectionDialog onClose={() => setShowNewCollection(false)} onCreate={createCollection} />}
    </div>
  );
}
