<script lang="ts">
  import { appDataDir } from "@tauri-apps/api/path";
  import { readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
  let text = $state("");
  let saved = $state(true);
  let loading = $state(true);
  let projectFiles = $state<any[]>([]);
  const { selectedFile, projectName, returnHome, openDocument } = $props<{ selectedFile: string; projectName: string; returnHome: () => void; openDocument: (fileName: string, projectName: string) => void; }>();
  async function save() { const path = await appDataDir(); await writeTextFile(`${path}/filetree/${projectName}/${selectedFile}`, text); saved = true; }
  async function loadContent() { loading = true; try { const path = await appDataDir(); text = await readTextFile(`${path}/filetree/${projectName}/${selectedFile}`); projectFiles = await readDir(`${path}/filetree/${projectName}`); saved = true; } finally { loading = false; } }
  function edit() { saved = false; }
  function keydown(event: KeyboardEvent) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); save(); } }
  $effect(() => { loadContent(); });
</script>

<div class="editor-layout">
  <aside class="project-sidebar" aria-label="Project navigation">
    <button class="sidebar-brand" onclick={returnHome} aria-label="All projects"><span class="mark">B</span><span class="sidebar-label">Blackboard</span></button>
    <div class="current-project"><span class="folder">□</span><span class="sidebar-label">{projectName}</span></div>
    <nav class="file-list" aria-label={`${projectName} documents`}>
      {#each projectFiles as file}
        <button class:active={file.name === selectedFile} onclick={() => openDocument(file.name, projectName)} title={file.name}><span>▤</span><span class="sidebar-label">{file.name}</span></button>
      {/each}
    </nav>
    <button class="all-projects" onclick={returnHome} title="All projects"><span>←</span><span class="sidebar-label">All projects</span></button>
  </aside>

  <div class="editor-shell">
    <header class="toolbar">
      <div class="document-meta"><span class="project">{projectName}</span><span class="slash">/</span><span>{selectedFile}</span></div>
      <div class="save-area"><span class:saved class="save-state">{saved ? "Saved" : "Unsaved changes"}</span><button class="save" onclick={save} disabled={saved}>Save</button></div>
    </header>
    <div class="writing-area"><div class="page-wrap">{#if loading}<div class="loading">Opening document…</div>{/if}<textarea bind:value={text} class="document" spellcheck="true" oninput={edit} onkeydown={keydown} aria-label={selectedFile} placeholder="Begin writing…"></textarea><p class="word-count">{text.trim() ? text.trim().split(/\s+/).length : 0} words</p></div></div>
  </div>
</div>

<style>
  .editor-layout { display: flex; min-height: 100vh; background: #141618; }.project-sidebar { position: relative; z-index: 3; display: flex; width: 58px; flex: 0 0 58px; flex-direction: column; overflow: hidden; padding: 14px 9px; border-right: 1px solid #292c2f; background: #17191b; transition: width .2s ease, flex-basis .2s ease; }.project-sidebar:hover, .project-sidebar:focus-within { width: 230px; flex-basis: 230px; }.sidebar-brand { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 30px; padding: 0; border: 0; background: transparent; color: #f0f0ed; overflow: hidden; text-align: left; white-space: nowrap; font-size: 13px; font-weight: 650; }.mark { display: grid; width: 30px; min-width: 30px; height: 30px; place-items: center; border: 1px solid #414448; border-radius: 8px; background: #202225; font-family: Georgia, serif; font-size: 18px; font-weight: 400; }.sidebar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0; transition: opacity .15s ease .03s; }.project-sidebar:hover .sidebar-label, .project-sidebar:focus-within .sidebar-label { opacity: 1; }.current-project { display: flex; align-items: center; gap: 10px; min-height: 34px; margin-top: 28px; padding: 0 7px; border-radius: 6px; background: #25282a; color: #c8ceca; overflow: hidden; font-size: 12px; font-weight: 650; white-space: nowrap; }.folder { width: 18px; min-width: 18px; color: #9dbe9f; font-size: 18px; }.file-list { display: flex; flex-direction: column; gap: 2px; margin-top: 9px; overflow: auto; }.file-list button, .all-projects { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 33px; padding: 0 7px; border: 0; border-radius: 6px; background: transparent; color: #929699; overflow: hidden; text-align: left; font-size: 12px; white-space: nowrap; }.file-list button > span:first-child, .all-projects > span:first-child { width: 18px; min-width: 18px; color: #78868d; font-size: 15px; text-align: center; }.file-list button:hover { background: #25282a; color: #e1e2df; }.file-list button.active { background: #2b332d; color: #e2e9e2; }.file-list button.active > span:first-child { color: #a9ccae; }.all-projects { margin-top: auto; color: #aeb2b2; }.all-projects:hover { background: #25282a; color: #f0f0ed; }
  .editor-shell { display: flex; min-width: 0; flex: 1; flex-direction: column; }.toolbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; min-height: 58px; padding: 0 26px; border-bottom: 1px solid #2a2d30; background: rgba(20,22,24,.94); backdrop-filter: blur(12px); }.document-meta { overflow: hidden; max-width: 60vw; color: #d0d1ce; font-size: 13px; white-space: nowrap; text-overflow: ellipsis; }.project { color: #9fbea5; }.slash { margin: 0 7px; color: #606468; }.save-area { display: flex; align-items: center; gap: 13px; }.save-state { color: #cda982; font-size: 11px; }.save-state.saved { color: #789f80; }.save { height: 32px; padding: 0 12px; border: 1px solid #3c4043; border-radius: 6px; background: #25282b; color: #ececea; font-size: 12px; font-weight: 650; }.save:not(:disabled):hover { border-color: #94b99b; background: #2e3530; }.save:disabled { cursor: default; opacity: .48; }.writing-area { flex: 1; padding: 54px 30px 40px; background: radial-gradient(ellipse at top, #202326 0%, #17191b 52%, #141618 100%); }.page-wrap { position: relative; width: min(100%, 780px); margin: auto; }.document { display: block; width: 100%; min-height: calc(100vh - 171px); padding: clamp(36px, 8vw, 78px); border: 1px solid #383b3e; border-radius: 3px; outline: none; resize: vertical; background: #efeee9; color: #252723; box-shadow: 0 18px 48px rgba(0,0,0,.28); font-family: Georgia, "Times New Roman", serif; font-size: 18px; line-height: 1.75; }.document:focus { border-color: #9fbea5; box-shadow: 0 0 0 2px rgba(159,190,165,.16), 0 18px 48px rgba(0,0,0,.28); }.document::placeholder { color: #9fa19b; }.word-count { margin: 14px 4px 0; color: #74787b; font-size: 11px; text-align: right; }.loading { position: absolute; top: 25px; left: 50%; z-index: 1; transform: translateX(-50%); color: #717575; font-size: 12px; }
  @media (max-width: 640px) { .project-sidebar { width: 48px; flex-basis: 48px; padding: 14px 9px; }.project-sidebar:hover, .project-sidebar:focus-within { width: 190px; flex-basis: 190px; }.toolbar { padding: 0 16px; }.writing-area { padding: 24px 12px; }.document { min-height: calc(100vh - 130px); padding: 32px 25px; font-size: 17px; }.save-state { display: none; } }
</style>
