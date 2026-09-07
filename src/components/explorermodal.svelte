<script lang="ts">
  import {
    exists,
    readDir,
    remove,
    writeTextFile,
  } from "@tauri-apps/plugin-fs";
  import { appDataDir } from "@tauri-apps/api/path";
  import { fileNameFor, fileTypeForName, fileTypes } from "../lib/fileTypes";
  let projects = $state<any[]>([]);
  let files = $state<any[]>([]);
  let selectedProject = $state("");
  let loading = $state(false);
  let newFileName = $state("");
  let selectedFileTypeId = $state(fileTypes[0]?.id ?? "");
  let error = $state("");
  let { modalVisible, onClose, openDocument } = $props<{
    modalVisible: boolean;
    onClose: () => void;
    openDocument: (fileName: string, projectName: string) => void;
  }>();
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
    const path = await appDataDir();
    if (await exists(filePath(name, path))) {
      error = `“${name}” already exists.`;
      return;
    }
    await writeTextFile(filePath(name, path), type.initialContent);
    newFileName = "";
    error = "";
    await loadProject({ name: selectedProject });
  }
  async function removeFile(name: string) {
    if (!confirm(`Remove “${name}”? This cannot be undone.`)) return;
    const path = await appDataDir();
    await remove(filePath(name, path));
    await loadProject({ name: selectedProject });
  }
  $effect(() => {
    if (modalVisible) {
      back();
      getProjects();
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
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="browser-title"
    >
      <div class="dialog-header">
        <div>
          {#if selectedProject}<button class="back" onclick={back}>←</button
            >{/if}
          <div>
            <p class="eyebrow">YOUR LIBRARY</p>
            <h2 id="browser-title">{selectedProject || "Projects"}</h2>
          </div>
        </div>
        <button class="close" aria-label="Close" onclick={onClose}>×</button>
      </div>
      {#if selectedProject}
        <form
          class="new-file"
          onsubmit={(event) => {
            event.preventDefault();
            createFile();
          }}
        >
          <select aria-label="File type" bind:value={selectedFileTypeId}
            >{#each fileTypes as type}<option value={type.id}
                >{type.label}</option
              >{/each}</select
          >
          <input
            bind:value={newFileName}
            aria-label="Document name"
            placeholder="Untitled document"
          />
          <button type="submit">+ Create</button>
        </form>
        {#if error}<p class="error" role="alert">{error}</p>{/if}
      {/if}
      <div class="list">
        {#if loading}<p class="helper">Loading your workspace…</p>
        {:else if selectedProject && files.length === 0}<div class="blank">
            <span>⌁</span><strong>No documents yet</strong>
            <p>This project is ready for its first note.</p>
          </div>
        {:else if selectedProject}{#each files as file (file.name)}{@const type =
              fileTypeForName(file.name)}
            <div class="row">
              <button class="open-file" onclick={() => chooseFile(file.name)}
                ><span class="file-icon">{type.icon}</span><span
                  >{file.name}</span
                ><span class="chevron">→</span></button
              ><button
                class="remove"
                aria-label={`Remove ${file.name}`}
                title={`Remove ${file.name}`}
                onclick={() => removeFile(file.name)}>×</button
              >
            </div>{/each}
        {:else if projects.length === 0}<div class="blank">
            <span>◇</span><strong>No projects yet</strong>
            <p>Create a project to begin building your library.</p>
          </div>
        {:else}{#each projects as project}<button
              class="row"
              onclick={() => loadProject(project)}
              ><span class="folder-icon">□</span><span>{project.name}</span
              ><span class="chevron">→</span></button
            >{/each}{/if}
      </div>
      <div class="dialog-footer">
        {selectedProject
          ? `${files.length} document${files.length === 1 ? "" : "s"}`
          : `${projects.length} project${projects.length === 1 ? "" : "s"}`}
      </div>
    </div>
  </div>
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
</style>
