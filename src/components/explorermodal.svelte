<script lang="ts">
  import { exists, readDir, remove, writeTextFile } from "@tauri-apps/plugin-fs";
  import { appDataDir } from "@tauri-apps/api/path";
  import { fileNameFor, fileTypeForName, fileTypes } from "../lib/fileTypes";
  let projects = $state<any[]>([]);
  let files = $state<any[]>([]);
  let selectedProject = $state("");
  let loading = $state(false);
  let newFileName = $state("");
  let selectedFileTypeId = $state(fileTypes[0]?.id ?? "");
  let error = $state("");
  let creating = $state(false);
  let deleting = $state(false);
  let deleteTarget = $state<{ kind: "file" | "project"; name: string } | null>(null);
  let search = $state("");
  let {
    modalVisible,
    onClose,
    openDocument,
    projectToOpen = "",
    onProjectViewed = () => {},
    onProjectDeleted = () => {},
  } = $props<{
    modalVisible: boolean;
    onClose: () => void;
    openDocument: (fileName: string, projectName: string) => void;
    projectToOpen?: string;
    onProjectViewed?: (projectName: string) => void;
    onProjectDeleted?: (projectName: string) => void;
  }>();
  let filteredProjects = $derived(
    projects.filter((project) => project.name.toLowerCase().includes(search.trim().toLowerCase())),
  );
  async function getProjects() {
    loading = true;
    try {
      const path = await appDataDir();
      projects = await readDir(`${path}/filetree`);
    } catch {
      projects = [];
    } finally {
      loading = false;
    }
  }
  async function loadProject(project: any) {
    onProjectViewed(project.name);
    selectedProject = project.name;
    newFileName = "";
    error = "";
    loading = true;
    try {
      const path = await appDataDir();
      files = (await readDir(`${path}/filetree/${project.name}`)).filter(
        (file) => !file.isDirectory,
      );
    } finally {
      loading = false;
    }
  }
  function chooseFile(name: string) {
    openDocument(name, selectedProject);
    onClose();
  }
  function back() {
    selectedProject = "";
    files = [];
    newFileName = "";
    error = "";
  }
  function filePath(name: string, path: string) {
    return `${path}/filetree/${selectedProject}/${name}`;
  }
  async function createFile() {
    const type = fileTypes.find((entry) => entry.id === selectedFileTypeId);
    const rawName = newFileName.trim() || type?.defaultBaseName;
    if (!type || !rawName || /[\\/:*?"<>|]/.test(rawName)) {
      error = "Use a file name without path characters.";
      return;
    }
    const name = fileNameFor(type, rawName);
    creating = true;
    try {
      const path = await appDataDir();
      if (await exists(filePath(name, path))) {
        error = `“${name}” already exists.`;
        return;
      }
      await writeTextFile(filePath(name, path), type.initialContent);
      newFileName = "";
      error = "";
      chooseFile(name);
    } catch {
      error = `Couldn’t create “${name}”. Please try again.`;
    } finally {
      creating = false;
    }
  }
  async function removeFile(name: string) {
    const path = await appDataDir();
    await remove(filePath(name, path));
    await loadProject({ name: selectedProject });
  }
  function requestDeleteFile(name: string) {
    deleteTarget = { kind: "file", name };
  }
  function requestDeleteProject() {
    if (selectedProject) deleteTarget = { kind: "project", name: selectedProject };
  }
  async function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    deleteTarget = null;
    if (target.kind === "file") {
      try {
        await removeFile(target.name);
      } catch {
        error = `Couldn’t delete “${target.name}”. Please try again.`;
      }
      return;
    }
    await removeProject(target.name);
  }
  async function removeProject(projectName: string) {
    deleting = true;
    error = "";
    try {
      const path = await appDataDir();
      await remove(`${path}/filetree/${projectName}`, { recursive: true });
      onProjectDeleted(projectName);
      back();
      await getProjects();
    } catch {
      error = `Couldn’t delete “${projectName}”. Please try again.`;
    } finally {
      deleting = false;
    }
  }
  async function initialize() {
    back();
    search = "";
    await getProjects();
    const requestedProject = projects.find((project) => project.name === projectToOpen);
    if (requestedProject) await loadProject(requestedProject);
  }
  $effect(() => {
    if (modalVisible) {
      initialize();
    }
  });
</script>

{#if modalVisible}
  <div
    class="backdrop"
    role="presentation"
    onclick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="browser-title">
      <div class="dialog-header">
        <div>
          {#if selectedProject}<button class="back" onclick={back}>←</button>{/if}
          <div>
            <p class="eyebrow">YOUR LIBRARY</p>
            <h2 id="browser-title">{selectedProject || "Projects"}</h2>
          </div>
        </div>
        <button class="close" aria-label="Close" onclick={onClose}>×</button>
      </div>
      {#if selectedProject}
        <div class="project-actions">
          <button class="delete-project" onclick={requestDeleteProject} disabled={deleting}
            >{deleting ? "Deleting…" : "Delete project"}</button
          >
        </div>
        <form
          class="new-file"
          onsubmit={(event) => {
            event.preventDefault();
            createFile();
          }}
        >
          <select aria-label="File type" bind:value={selectedFileTypeId}
            >{#each fileTypes as type}<option value={type.id}>{type.label}</option>{/each}</select
          >
          <input
            bind:value={newFileName}
            aria-label="Document name"
            placeholder="Untitled document"
          />
          <button type="submit" disabled={creating}>{creating ? "Creating…" : "+ Create"}</button>
        </form>
        {#if error}<p class="error" role="alert">{error}</p>{/if}
      {/if}
      {#if !selectedProject}
        <div class="project-search">
          <span aria-hidden="true">⌕</span><input
            bind:value={search}
            placeholder="Search projects…"
            aria-label="Search projects"
          />
        </div>
      {/if}
      <div class="list">
        {#if loading}<p class="helper">Loading your workspace…</p>
        {:else if selectedProject && files.length === 0}<div class="blank">
            <span>⌁</span><strong>No documents yet</strong>
            <p>This project is ready for its first note.</p>
          </div>
        {:else if selectedProject}{#each files as file (file.name)}{@const type = fileTypeForName(
              file.name,
            )}
            <div class="row">
              <button class="open-file" onclick={() => chooseFile(file.name)}
                ><span class="file-icon">{type.icon}</span><span>{file.name}</span><span
                  class="chevron">→</span
                ></button
              ><button
                class="remove"
                aria-label={`Remove ${file.name}`}
                title={`Remove ${file.name}`}
                onclick={() => requestDeleteFile(file.name)}>×</button
              >
            </div>{/each}
        {:else if projects.length === 0}<div class="blank">
            <span>◇</span><strong>No projects yet</strong>
            <p>Create a project to begin building your library.</p>
          </div>
        {:else if filteredProjects.length}
          <p class="section-label">{search ? "SEARCH RESULTS" : "ALL PROJECTS"}</p>
          {#each filteredProjects as project}<button
              class="row"
              onclick={() => loadProject(project)}
              ><span class="folder-icon">□</span><span>{project.name}</span><span class="chevron"
                >→</span
              ></button
            >{/each}
        {:else}<div class="blank">
            <strong>No matching projects</strong>
            <p>Try a different project name.</p>
          </div>{/if}
      </div>
      <div class="dialog-footer">
        {selectedProject
          ? `${files.length} document${files.length === 1 ? "" : "s"}`
          : `${projects.length} project${projects.length === 1 ? "" : "s"}`}
      </div>
    </div>
  </div>
  {#if deleteTarget}
    <div class="confirm-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) deleteTarget = null; }}>
      <div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
        <p class="eyebrow">CONFIRM DELETION</p>
        <h2 id="delete-title">Delete {deleteTarget.kind === "project" ? "project" : "document"}?</h2>
        <p>{#if deleteTarget.kind === "project"}“{deleteTarget.name}” and all of its documents will be permanently deleted.{:else}“{deleteTarget.name}” will be permanently deleted.{/if}</p>
        <div class="confirm-actions"><button class="cancel-delete" onclick={() => (deleteTarget = null)}>Cancel</button><button class="confirm-delete" onclick={confirmDelete}>Delete</button></div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: grid;
    place-items: center;
    padding: 22px;
    background: rgba(5, 6, 7, 0.7);
    backdrop-filter: blur(8px);
  }
  .dialog {
    width: min(100%, 560px);
    overflow: hidden;
    border: 1px solid #35383b;
    border-radius: 14px;
    background: #1a1c1e;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.48);
  }
  .dialog-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 27px 28px 21px;
    border-bottom: 1px solid #303336;
  }
  .dialog-header > div {
    display: flex;
    gap: 13px;
    align-items: center;
  }
  .eyebrow {
    margin: 0 0 6px;
    color: #99bd9f;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.16em;
  }
  h2 {
    margin: 0;
    color: #f0efeb;
    font-family: Georgia, serif;
    font-size: 28px;
    font-weight: 400;
    letter-spacing: -0.035em;
  }
  .close,
  .back {
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #979a9c;
  }
  .close {
    width: 28px;
    height: 28px;
    font-size: 22px;
    line-height: 1;
  }
  .back {
    width: 30px;
    height: 30px;
    background: #25282b;
    font-size: 17px;
  }
  .close:hover,
  .back:hover {
    background: #2a2d30;
    color: #fff;
  }
  .new-file {
    display: flex;
    gap: 8px;
    padding: 12px 18px 0;
  }
  .project-actions {
    display: flex;
    justify-content: flex-end;
    padding: 12px 18px 0;
  }
  .delete-project {
    height: 30px;
    border: 1px solid #653d3a;
    border-radius: 6px;
    background: transparent;
    color: #e3aaa0;
    padding: 0 10px;
    font-size: 11px;
    font-weight: 700;
  }
  .delete-project:not(:disabled):hover {
    background: #4a2928;
    color: #ffd4cb;
  }
  .delete-project:disabled {
    cursor: default;
    opacity: 0.65;
  }
  .new-file select,
  .new-file input {
    height: 36px;
    border: 1px solid #3b3e42;
    border-radius: 6px;
    background: #111214;
    color: #ececea;
    padding: 0 10px;
    font-size: 12px;
  }
  .new-file input {
    min-width: 0;
    flex: 1;
  }
  .new-file button {
    border: 0;
    border-radius: 6px;
    padding: 0 12px;
    background: #b8d5be;
    color: #142018;
    font-size: 12px;
    font-weight: 700;
  }
  .project-search {
    display: flex;
    align-items: center;
    gap: 9px;
    margin: 16px 18px 0;
    padding: 0 11px;
    border: 1px solid #3b3e42;
    border-radius: 7px;
    background: #111214;
    color: #909598;
  }
  .project-search input {
    width: 100%;
    height: 40px;
    border: 0;
    outline: 0;
    background: transparent;
    color: #ececea;
    font-size: 13px;
  }
  .new-file button:disabled {
    cursor: default;
    opacity: 0.65;
  }
  .error {
    margin: 8px 18px 0;
    color: #e4a38d;
    font-size: 12px;
  }
  .list {
    min-height: 210px;
    max-height: 380px;
    overflow: auto;
    padding: 10px;
  }
  .section-label {
    margin: 8px 12px 6px;
    color: #818589;
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0.13em;
  }
  .row {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 52px;
    gap: 13px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #d9dad8;
    text-align: left;
    font-size: 14px;
  }
  .row:hover {
    background: #25282a;
  }
  .open-file {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    gap: 13px;
    min-height: 52px;
    margin: 0 -12px;
    padding: 0 12px;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    font-size: inherit;
  }
  .open-file > span:nth-child(2) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .remove {
    width: 30px;
    height: 30px;
    margin-right: -2px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #929698;
    font-size: 20px;
    line-height: 1;
  }
  .remove:hover {
    background: #4a2928;
    color: #f3b2a5;
  }
  .folder-icon,
  .file-icon {
    width: 25px;
    color: #b7d1bc;
    font-size: 19px;
  }
  .file-icon {
    color: #9eaeb7;
    font-size: 17px;
  }
  .chevron {
    margin-left: auto;
    color: #777b7f;
  }
  .helper {
    padding: 32px 18px;
    color: #8d9092;
    font-size: 14px;
    text-align: center;
  }
  .blank {
    display: grid;
    place-items: center;
    padding: 36px 18px;
    color: #989b9d;
    text-align: center;
  }
  .blank span {
    margin-bottom: 10px;
    color: #b7d1bc;
    font-size: 27px;
  }
  .blank strong {
    color: #d4d5d3;
    font-size: 14px;
  }
  .blank p {
    margin: 6px 0 0;
    font-size: 13px;
  }
  .dialog-footer {
    padding: 14px 28px;
    border-top: 1px solid #303336;
    color: #777b7e;
    font-size: 12px;
  }
  .confirm-backdrop { position:fixed; inset:0; z-index:11; display:grid; place-items:center; padding:22px; background:rgba(5,6,7,.58); backdrop-filter:blur(5px); }
  .confirm-dialog { width:min(100%,390px); padding:28px; border:1px solid #4a3534; border-radius:12px; background:#1e1b1b; box-shadow:0 22px 60px rgba(0,0,0,.52); }
  .confirm-dialog h2 { font-size:25px; }
  .confirm-dialog p:not(.eyebrow) { margin:10px 0 23px; color:#b6b1b0; font-size:13px; line-height:1.55; }
  .confirm-actions { display:flex; justify-content:flex-end; gap:9px; }
  .confirm-actions button { height:38px; padding:0 14px; border-radius:7px; font-size:13px; font-weight:700; }
  .cancel-delete { border:1px solid #454142; background:transparent; color:#d6d3d1; }
  .confirm-delete { border:1px solid #7c4740; background:#9d554a; color:#fff3f0; }
  .confirm-delete:hover { background:#b65f52; }
</style>
