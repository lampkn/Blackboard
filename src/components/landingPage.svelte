<script lang="ts">
  import { onMount } from "svelte";
  import { readDir } from "@tauri-apps/plugin-fs";
  import { appDataDir } from "@tauri-apps/api/path";
  import NameModal from "./nameModal.svelte";
  import Explorermodal from "./explorermodal.svelte";

  const { openDocument } = $props<{
    openDocument: (fileName: string, projectName: string) => void;
  }>();
  let modalOpen = $state(false);
  let explorerModal = $state(false);
  let projectToOpen = $state("");
  let projects = $state<any[]>([]);
  let recentlyViewed = $state<string[]>([]);

  async function loadProjects() {
    try {
      const path = await appDataDir();
      projects = await readDir(`${path}/filetree`);
    } catch {
      projects = [];
    }
  }
  function closeModal() {
    modalOpen = false;
  }
  function handleProjectCreated(name: string) {
    modalOpen = false;
    loadProjects();
  }
  function rememberProject(name: string) {
    recentlyViewed = [name, ...recentlyViewed.filter((project) => project !== name)].slice(0, 6);
    localStorage.setItem("blackboard.recentlyViewed", JSON.stringify(recentlyViewed));
  }
  function viewRecentProject(name: string) {
    rememberProject(name);
    projectToOpen = name;
    explorerModal = true;
  }
  function browseProjects() {
    projectToOpen = "";
    explorerModal = true;
  }
  onMount(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("blackboard.recentlyViewed") ?? "[]");
      if (Array.isArray(saved)) recentlyViewed = saved.filter((name): name is string => typeof name === "string");
    } catch {
      recentlyViewed = [];
    }
  });
  $effect(() => {
    loadProjects();
  });
</script>

<div class="workspace">
  <aside class="sidebar">
    <div class="sidebar-brand">
      <span class="mark">B</span><span>Blackboard</span>
    </div>
    <div class="project-header">
      <span>PROJECTS</span><button aria-label="New project" onclick={() => (modalOpen = true)}
        >+</button
      >
    </div>
    <nav class="project-list" aria-label="Projects">
      {#if projects.length === 0}<p class="no-projects">No projects yet</p>
      {:else}{#each projects as project}<button
            class="project-item"
            onclick={() => viewRecentProject(project.name)}><span>□</span>{project.name}</button
          >{/each}{/if}
    </nav>
    <button class="browse-link" onclick={browseProjects}
      ><span>⌕</span> Browse projects</button
    >
  </aside>

  <main class="home">
    <section class="island">
      <div class="island-title">
        <span class="mark large">B</span>
        <h1>Blackboard</h1>
      </div>
      <div class="actions">
        <button class="new-project" onclick={() => (modalOpen = true)}
          ><span>+</span> New project</button
        ><button class="browse-projects" onclick={browseProjects}
          >Browse projects <span>→</span></button
        >
      </div>
      <div class="recent">
        <p>RECENTLY VIEWED</p>
        {#if recentlyViewed.length}
          {#each recentlyViewed as project}
            <button class="recent-item" onclick={() => viewRecentProject(project)}>
              <span>□</span><strong>{project}</strong><span class="open-recent">Open →</span>
            </button>
          {/each}
        {:else}<span class="empty-recent">Projects you open will appear here.</span>{/if}
      </div>
    </section>
  </main>
</div>

<NameModal modalVisible={modalOpen} onClose={closeModal} onCreated={handleProjectCreated} />
<Explorermodal
  modalVisible={explorerModal}
  onClose={() => (explorerModal = false)}
  {openDocument}
  {projectToOpen}
  onProjectViewed={rememberProject}
/>

<style>
  .workspace {
    display: flex;
    min-height: 100vh;
    background: #121315;
  }
  .sidebar {
    display: flex;
    width: 226px;
    flex: 0 0 226px;
    flex-direction: column;
    padding: 18px 12px 14px;
    border-right: 1px solid #292c2f;
    background: #17191b;
  }
  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 8px 29px;
    color: #ededeb;
    font-size: 14px;
    font-weight: 650;
  }
  .mark {
    display: grid;
    width: 24px;
    height: 24px;
    place-items: center;
    border: 1px solid #414448;
    border-radius: 7px;
    background: #202225;
    color: #f0f0ed;
    font-family: Georgia, serif;
    font-size: 15px;
    font-weight: 400;
  }
  .project-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px 9px;
    color: #777b7f;
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0.13em;
  }
  .project-header button {
    width: 21px;
    height: 21px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: #999da0;
    font-size: 18px;
    line-height: 1;
  }
  .project-header button:hover {
    background: #292c2f;
    color: #e5e5e2;
  }
  .project-list {
    overflow: auto;
  }
  .no-projects {
    margin: 5px 8px;
    color: #707478;
    font-size: 12px;
  }
  .project-item {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 9px;
    min-height: 32px;
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #b7bab9;
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }
  .project-item span {
    color: #87a990;
    font-size: 15px;
  }
  .project-item:hover {
    background: #25282a;
    color: #f0f0ee;
  }
  .browse-link {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    margin-top: auto;
    padding: 9px 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #9a9e9f;
    text-align: left;
    font-size: 12px;
  }
  .browse-link:hover {
    background: #25282a;
    color: #efefec;
  }
  .browse-link span {
    font-size: 17px;
  }
  .home {
    display: grid;
    flex: 1;
    place-items: center;
    padding: 28px;
    background: radial-gradient(ellipse at 50% 44%, #202426 0%, #151719 54%, #121315 100%);
  }
  .island {
    width: min(100%, 480px);
    padding: 34px;
    border: 1px solid #35383b;
    border-radius: 15px;
    background: rgba(27, 29, 31, 0.94);
    box-shadow: 0 26px 80px rgba(0, 0, 0, 0.28);
  }
  .island-title {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 27px;
    border-bottom: 1px solid #333639;
  }
  .large {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    font-size: 20px;
  }
  h1 {
    margin: 0;
    color: #f1f0ec;
    font-family: Georgia, serif;
    font-size: 30px;
    font-weight: 400;
    letter-spacing: -0.04em;
  }
  .actions {
    display: flex;
    gap: 10px;
    padding: 23px 0;
  }
  .actions button {
    height: 42px;
    border-radius: 7px;
    padding: 0 13px;
    font-size: 12px;
    font-weight: 650;
  }
  .new-project {
    border: 0;
    background: #b8d5be;
    color: #142018;
  }
  .new-project span {
    margin-right: 5px;
    font-size: 16px;
    font-weight: 400;
  }
  .browse-projects {
    border: 1px solid #3d4043;
    background: #232629;
    color: #dedfdd;
  }
  .browse-projects span {
    margin-left: 10px;
  }
  .actions button:hover {
    transform: translateY(-1px);
  }
  .recent {
    padding-top: 2px;
  }
  .recent p {
    margin: 0 0 11px;
    color: #818589;
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0.13em;
  }
  .empty-recent {
    color: #727679;
    font-size: 12px;
  }
  .recent-item {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 8px;
    min-height: 36px;
    padding: 0 10px;
    border: 0;
    border-radius: 7px;
    background: #222528;
    color: #d9dad7;
    text-align: left;
    font-size: 12px;
  }
  .recent-item:hover {
    background: #2a2e30;
  }
  .recent-item > span:first-child {
    color: #91b899;
    font-size: 15px;
  }
  .open-recent {
    margin-left: auto;
    color: #797d80;
    font-size: 11px;
  }
  @media (max-width: 620px) {
    .sidebar {
      width: 54px;
      flex-basis: 54px;
      padding: 18px 8px;
    }
    .sidebar-brand {
      padding: 0 7px 29px;
    }
    .sidebar-brand > span:last-child,
    .project-header span,
    .project-header button,
    .project-list,
    .browse-link {
      display: none;
    }
    .home {
      padding: 16px;
    }
    .island {
      padding: 26px;
    }
  }
</style>
