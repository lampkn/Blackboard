<script lang="ts">
  import { appDataDir } from "@tauri-apps/api/path";
  import { exists, readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
  import Explorermodal from "./explorermodal.svelte";
  import DrawingDocument from "./drawingDocument.svelte";
  import { fileNameFor, fileTypeForName, fileTypes } from "../lib/fileTypes";

  type EditorTab = {
    id: number;
    fileName: string;
    text: string;
    saved: boolean;
    loading: boolean;
    saving: boolean;
    pendingSave: boolean;
    saveError: boolean;
  };
  type EditorGroup = { tabs: EditorTab[]; activeId: number | null };
  const { selectedFile, projectName, returnHome, openDocument } = $props<{
    selectedFile: string;
    projectName: string;
    returnHome: () => void;
    openDocument: (fileName: string, projectName: string) => void;
  }>();
  let projectFiles = $state<any[]>([]);
  let projectBrowserOpen = $state(false);
  let newFileOpen = $state(false);
  let newFileName = $state("");
  let newFileTypeId = $state(fileTypes[0]?.id ?? "");
  let newFileError = $state("");
  let newFileInput = $state<HTMLInputElement>();
  let groups = $state<EditorGroup[]>([{ tabs: [], activeId: null }]);
  let activeGroup = $state(0);
  let nextTabId = 0;
  let lastRequestedFile = "";
  let loadedProject = "";

  const activeTab = (group: EditorGroup) => group.tabs.find((tab) => tab.id === group.activeId);
  async function loadProjectFiles() {
    try {
      const path = await appDataDir();
      projectFiles = await readDir(`${path}/filetree/${projectName}`);
    } catch {
      projectFiles = [];
    }
  }
  async function loadTab(tab: EditorTab) {
    tab.loading = true;
    try {
      const path = await appDataDir();
      tab.text = await readTextFile(`${path}/filetree/${projectName}/${tab.fileName}`);
      tab.saved = true;
    } finally {
      tab.loading = false;
    }
  }
  function openInGroup(fileName: string, groupIndex = activeGroup) {
    const group = groups[groupIndex];
    const existing = group.tabs.find((tab) => tab.fileName === fileName);
    if (existing) {
      group.activeId = existing.id;
      activeGroup = groupIndex;
      return;
    }
    const tab: EditorTab = {
      id: nextTabId++,
      fileName,
      text: "",
      saved: true,
      loading: true,
      saving: false,
      pendingSave: false,
      saveError: false,
    };
    group.tabs.push(tab);
    group.activeId = tab.id;
    activeGroup = groupIndex;
    loadTab(tab);
  }
  function selectDocument(fileName: string) {
    openInGroup(fileName);
    openDocument(fileName, projectName);
  }
  async function flushSave(tab: EditorTab) {
    if (tab.saving) return;
    tab.saving = true;
    tab.saveError = false;
    try {
      const path = await appDataDir();
      const target = `${path}/filetree/${projectName}/${tab.fileName}`;
      while (tab.pendingSave) {
        tab.pendingSave = false;
        const snapshot = tab.text;
        await writeTextFile(target, snapshot);
        if (!tab.pendingSave && tab.text === snapshot) tab.saved = true;
      }
    } catch {
      tab.saveError = true;
      tab.saved = false;
    } finally {
      tab.saving = false;
    }
  }
  function save(tab: EditorTab) {
    tab.saved = false;
    tab.pendingSave = true;
    void flushSave(tab);
  }
  function saveStatus(tab: EditorTab) {
    if (tab.saveError) return "Couldn’t save";
    if (tab.saving || tab.pendingSave) return "Saving…";
    return tab.saved ? "Saved" : "Unsaved changes";
  }
  function closeTab(groupIndex: number, tabId: number) {
    const group = groups[groupIndex];
    const index = group.tabs.findIndex((tab) => tab.id === tabId);
    if (index < 0) return;
    group.tabs.splice(index, 1);
    group.activeId = group.tabs[Math.max(0, index - 1)]?.id ?? null;
  }
  function addSplit() {
    if (groups.length === 4) return;
    const current = activeTab(groups[activeGroup]);
    groups.push({ tabs: [], activeId: null });
    activeGroup = groups.length - 1;
    if (current) openInGroup(current.fileName, activeGroup);
  }
  function closeSplit() {
    if (groups.length <= 1) return;
    const removed = groups.pop();
    const target = groups[groups.length - 1];
    for (const tab of removed?.tabs ?? [])
      if (!target.tabs.some((item) => item.fileName === tab.fileName)) target.tabs.push(tab);
    if (!target.activeId && target.tabs.length) target.activeId = target.tabs[0].id;
    activeGroup = Math.min(activeGroup, groups.length - 1);
  }
  function dragStart(event: DragEvent, groupIndex: number, tabId: number) {
    const payload = JSON.stringify({ groupIndex, tabId });
    event.dataTransfer?.setData("application/x-blackboard-tab", payload);
    // text/plain keeps the drag payload available in browsers that restrict custom types.
    event.dataTransfer?.setData("text/plain", payload);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }
  function dropTab(event: DragEvent, targetGroupIndex: number, targetTabId?: number) {
    event.preventDefault();
    const value =
      event.dataTransfer?.getData("application/x-blackboard-tab") ||
      event.dataTransfer?.getData("text/plain");
    if (!value) return;
    try {
      const { groupIndex, tabId } = JSON.parse(value);
      const source = groups[groupIndex];
      const index = source?.tabs.findIndex((tab) => tab.id === tabId) ?? -1;
      if (index < 0) return;
      const [tab] = source.tabs.splice(index, 1);
      source.activeId = source.tabs[Math.max(0, index - 1)]?.id ?? null;
      const target = groups[targetGroupIndex];
      const duplicate = target.tabs.findIndex((item) => item.fileName === tab.fileName);
      if (duplicate >= 0) {
        target.activeId = target.tabs[duplicate].id;
        activeGroup = targetGroupIndex;
        return;
      }
      const position =
        targetTabId === undefined
          ? target.tabs.length
          : Math.max(
              0,
              target.tabs.findIndex((item) => item.id === targetTabId),
            );
      target.tabs.splice(position, 0, tab);
      target.activeId = tab.id;
      activeGroup = targetGroupIndex;
    } catch {}
  }
  function showNewFile() {
    newFileOpen = true;
    newFileName = "";
    newFileError = "";
    setTimeout(() => newFileInput?.focus());
  }
  async function createFile() {
    const type = fileTypes.find((entry) => entry.id === newFileTypeId);
    const rawName = newFileName.trim() || type?.defaultBaseName;
    if (!type || !rawName || /[\\/:*?\"<>|]/.test(rawName)) {
      newFileError = "Use a name without path characters.";
      return;
    }
    const name = fileNameFor(type, rawName);
    const path = await appDataDir();
    const target = `${path}/filetree/${projectName}/${name}`;
    if (await exists(target)) {
      newFileError = "A file with that name already exists.";
      return;
    }
    try {
      await writeTextFile(target, type.initialContent);
      await loadProjectFiles();
      newFileOpen = false;
      openInGroup(name);
      openDocument(name, projectName);
    } catch {
      newFileError = `Couldn’t create “${name}”. Please try again.`;
    }
  }
  function keydown(event: KeyboardEvent, tab: EditorTab) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save(tab);
    }
  }
  $effect(() => {
    if (projectName !== loadedProject) {
      loadedProject = projectName;
      groups = [{ tabs: [], activeId: null }];
      activeGroup = 0;
      lastRequestedFile = "";
    }
    loadProjectFiles();
  });
  $effect(() => {
    if (selectedFile && selectedFile !== lastRequestedFile) {
      lastRequestedFile = selectedFile;
      openInGroup(selectedFile);
    }
  });
</script>

<div class="editor-layout">
  <aside class="project-sidebar" aria-label="Project navigation">
    <button class="sidebar-brand" onclick={returnHome} aria-label="All projects"
      ><span class="mark">B</span><span class="sidebar-label">Blackboard</span></button
    >
    <button
      class="current-project"
      onclick={() => (projectBrowserOpen = true)}
      title="Switch project"
      ><span class="folder">□</span><span class="sidebar-label">{projectName}</span></button
    >
    <nav class="file-list" aria-label={`${projectName} documents`}>
      {#each projectFiles as file}
        <button
          class:active={groups.some((group) => activeTab(group)?.fileName === file.name)}
          onclick={() => selectDocument(file.name)}
          title={file.name}
          ><span>{fileTypeForName(file.name).icon}</span><span class="sidebar-label"
            >{file.name}</span
          ></button
        >
      {/each}
    </nav>
    <button class="all-projects" onclick={returnHome} title="All projects"
      ><span>←</span><span class="sidebar-label">All projects</span></button
    >
  </aside>
  <div class="editor-shell">
    <header class="toolbar">
      <div class="document-meta">
        <span class="project">{projectName}</span><span class="slash">/</span><span
          >{activeTab(groups[activeGroup])?.fileName ?? "No document open"}</span
        >
      </div>
      <div class="toolbar-actions">
        <button class="new-file" onclick={showNewFile}>+ <span>New file</span></button>
        <div class="split-controls">
          <button class="split-toggle" onclick={addSplit} disabled={groups.length === 4}
            >▦ <span>{groups.length}/4</span></button
          >
          <button class="split-remove" onclick={closeSplit} disabled={groups.length === 1}>−</button
          >
        </div>
      </div>
    </header>
    <div
      class:split={groups.length > 1}
      class:four={groups.length === 4}
      class:three={groups.length === 3}
      class="editor-groups"
    >
      {#each groups as group, groupIndex}
        <section
          class:focused={activeGroup === groupIndex}
          class="editor-group"
          aria-label={`Editor ${groupIndex + 1}`}
          ondragover={(event) => event.preventDefault()}
          ondrop={(event) => dropTab(event, groupIndex)}
        >
          <div
            role="tablist"
            tabindex="0"
            class="tab-bar"
            ondragover={(event) => event.preventDefault()}
            ondrop={(event) => dropTab(event, groupIndex)}
          >
            {#if group.tabs.length === 0}<span class="empty-tabs"
                >Select a document to open it here</span
              >{/if}
            {#each group.tabs as tab}
              <button
                draggable="true"
                ondragstart={(event) => dragStart(event, groupIndex, tab.id)}
                ondragover={(event) => event.preventDefault()}
                ondrop={(event) => { event.stopPropagation(); dropTab(event, groupIndex, tab.id); }}
                class:active={tab.id === group.activeId}
                class="tab"
                onclick={() => {
                  group.activeId = tab.id;
                  activeGroup = groupIndex;
                }}
                ><span class="tab-name">{tab.fileName}</span>{#if !tab.saved}<span class="tab-dot"
                    >●</span
                  >{/if}<span
                  class="tab-close"
                  role="button"
                  tabindex="0"
                  aria-label={`Close ${tab.fileName}`}
                  onclick={(event) => {
                    event.stopPropagation();
                    closeTab(groupIndex, tab.id);
                  }}
                  onkeydown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      closeTab(groupIndex, tab.id);
                    }
                  }}>×</span
                ></button
              >
            {/each}
          </div>
          {#if activeTab(group)}
            {@const tab = activeTab(group)!}
            <div class="group-content" onfocusin={() => (activeGroup = groupIndex)}>
              <div class="save-row">
                <span class:saved={tab.saved} class:error={tab.saveError} class="save-state"
                  >{saveStatus(tab)}</span
                ><button class="save" onclick={() => save(tab)} disabled={tab.saved || tab.saving}
                  >{tab.saveError ? "Retry" : "Save now"}</button
                >
              </div>
              <div class="page-wrap">
                {#if tab.loading}<div class="loading">Opening document…</div>{/if}
                {#if fileTypeForName(tab.fileName).id === "drawing-document"}
                  <DrawingDocument
                    value={tab.text}
                    onChange={(value) => {
                      tab.text = value;
                      save(tab);
                    }}
                    onSave={() => save(tab)}
                  />
                {:else}
                  <textarea
                    bind:value={tab.text}
                    class="document"
                    spellcheck="true"
                    oninput={() => save(tab)}
                    onkeydown={(event) => keydown(event, tab)}
                    aria-label={tab.fileName}
                    placeholder="Begin writing…"></textarea>
                  <p class="word-count">
                    {tab.text.trim() ? tab.text.trim().split(/\s+/).length : 0} words
                  </p>
                {/if}
              </div>
            </div>
          {:else}<div
              class="empty-editor"
              role="button"
              tabindex="0"
              onclick={() => (activeGroup = groupIndex)}
              onkeydown={(event) => {
                if (event.key === "Enter" || event.key === " ") activeGroup = groupIndex;
              }}
            >
              Choose a document from the sidebar.
            </div>{/if}
        </section>
      {/each}
    </div>
  </div>
</div>
{#if newFileOpen}
  <div
    class="file-backdrop"
    role="presentation"
    onclick={(event) => {
      if (event.target === event.currentTarget) newFileOpen = false;
    }}
  >
    <form
      class="file-dialog"
      onsubmit={(event) => {
        event.preventDefault();
        createFile();
      }}
    >
      <button type="button" class="close" onclick={() => (newFileOpen = false)} aria-label="Close"
        >×</button
      >
      <p class="eyebrow">NEW DOCUMENT</p>
      <h2>Create a file</h2>
      <p>It will be added to {projectName} and opened in the active editor.</p>
      <label for="new-file-type">Document type</label>
      <select id="new-file-type" bind:value={newFileTypeId}>
        {#each fileTypes as type}<option value={type.id}>{type.label}</option>{/each}
      </select>
      <label for="new-file-name">Name</label><input
        bind:this={newFileInput}
        id="new-file-name"
        bind:value={newFileName}
        placeholder={fileTypes.find((type) => type.id === newFileTypeId)?.defaultBaseName}
      />
      {#if newFileError}<small class="file-error">{newFileError}</small>{/if}
      <div class="file-controls">
        <button type="button" class="cancel" onclick={() => (newFileOpen = false)}>Cancel</button
        ><button class="create" type="submit">Create file</button>
      </div>
    </form>
  </div>
{/if}
<Explorermodal
  modalVisible={projectBrowserOpen}
  onClose={() => (projectBrowserOpen = false)}
  {openDocument}
  projectToOpen={projectName}
  onProjectViewed={() => {}}
  onProjectDeleted={returnHome}
/>

<style>
  .editor-layout {
    display: flex;
    min-height: 100vh;
    background: #141618;
  }
  .project-sidebar {
    position: relative;
    z-index: 3;
    display: flex;
    width: 58px;
    flex: 0 0 58px;
    flex-direction: column;
    overflow: hidden;
    padding: 14px 9px;
    border-right: 1px solid #292c2f;
    background: #17191b;
    transition:
      width 0.2s ease,
      flex-basis 0.2s ease;
  }
  .project-sidebar:hover,
  .project-sidebar:focus-within {
    width: 230px;
    flex-basis: 230px;
  }
  .sidebar-brand,
  .current-project,
  .file-list button,
  .all-projects {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    border: 0;
    overflow: hidden;
    text-align: left;
    white-space: nowrap;
  }
  .sidebar-brand {
    min-height: 30px;
    padding: 0;
    background: transparent;
    color: #f0f0ed;
    font-size: 13px;
    font-weight: 650;
  }
  .mark {
    display: grid;
    width: 30px;
    min-width: 30px;
    height: 30px;
    place-items: center;
    border: 1px solid #414448;
    border-radius: 8px;
    background: #202225;
    font-family: Georgia, serif;
    font-size: 18px;
  }
  .sidebar-label {
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0;
    transition: opacity 0.15s ease 0.03s;
  }
  .project-sidebar:hover .sidebar-label,
  .project-sidebar:focus-within .sidebar-label {
    opacity: 1;
  }
  .current-project {
    min-height: 34px;
    margin-top: 28px;
    padding: 0 7px;
    border-radius: 6px;
    background: #25282a;
    color: #c8ceca;
    font-size: 12px;
    font-weight: 650;
  }
  .folder {
    width: 18px;
    min-width: 18px;
    color: #9dbe9f;
    font-size: 18px;
  }
  .file-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 9px;
    overflow: auto;
  }
  .file-list button,
  .all-projects {
    min-height: 33px;
    padding: 0 7px;
    border-radius: 6px;
    background: transparent;
    color: #929699;
    font-size: 12px;
  }
  .file-list button > span:first-child,
  .all-projects > span:first-child {
    width: 18px;
    min-width: 18px;
    color: #78868d;
    font-size: 15px;
    text-align: center;
  }
  .file-list button:hover,
  .all-projects:hover {
    background: #25282a;
    color: #e1e2df;
  }
  .file-list button.active {
    background: #2b332d;
    color: #e2e9e2;
  }
  .all-projects {
    margin-top: auto;
    color: #aeb2b2;
  }
  .editor-shell {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 58px;
    padding: 0 18px 0 26px;
    border-bottom: 1px solid #2a2d30;
    background: rgba(20, 22, 24, 0.94);
  }
  .document-meta {
    overflow: hidden;
    color: #d0d1ce;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .project {
    color: #9fbea5;
  }
  .slash {
    margin: 0 7px;
    color: #606468;
  }
  .split-toggle {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 32px;
    padding: 0 9px;
    border: 1px solid #3c4043;
    border-radius: 6px;
    background: #25282b;
    color: #aeb6b1;
    font-size: 14px;
  }
  .split-toggle:hover:not(:disabled) {
    border-color: #94b99b;
    color: #dce6de;
  }
  .split-toggle span {
    display: inline-block;
    transform: scaleX(0.65);
  }
  .toolbar-actions,
  .split-controls {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .new-file,
  .split-remove {
    height: 32px;
    border: 1px solid #3c4043;
    border-radius: 6px;
    background: #25282b;
    color: #cbd1cc;
    font-size: 12px;
  }
  .new-file {
    padding: 0 10px;
  }
  .split-remove {
    width: 30px;
    font-size: 18px;
  }
  .new-file:hover,
  .split-remove:hover {
    border-color: #94b99b;
    color: #e2ebe3;
  }
  .split-toggle:disabled,
  .split-remove:disabled {
    cursor: default;
    opacity: 0.45;
  }
  .editor-groups {
    display: flex;
    min-height: 0;
    flex: 1;
  }
  .editor-groups.split {
    gap: 1px;
    background: #35393c;
  }
  .editor-groups.three {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .editor-groups.four {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(2, minmax(0, 1fr));
  }
  .editor-group {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    background: #17191b;
  }
  .editor-group.focused {
    box-shadow: inset 0 2px #9fbea5;
  }
  .tab-bar {
    display: flex;
    min-height: 38px;
    overflow-x: auto;
    border-bottom: 1px solid #2a2d30;
    background: #1b1d1f;
  }
  .empty-tabs {
    padding: 11px 14px;
    color: #74787b;
    font-size: 11px;
  }
  .tab {
    display: flex;
    min-width: 0;
    max-width: 220px;
    align-items: center;
    gap: 7px;
    padding: 0 8px 0 12px;
    border: 0;
    border-right: 1px solid #303336;
    background: #202225;
    color: #aeb2b2;
    font-size: 12px;
  }
  .tab.active {
    background: #17191b;
    color: #e4e5e1;
  }
  .tab-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tab-dot {
    color: #d5b184;
    font-size: 8px;
  }
  .tab-close {
    padding: 0 2px;
    color: #858a89;
    font-size: 16px;
    line-height: 1;
  }
  .tab-close:hover {
    color: #f0f0ed;
  }
  .group-content {
    flex: 1;
    overflow: auto;
    padding: 14px 22px 40px;
    background: radial-gradient(ellipse at top, #202326 0%, #17191b 52%, #141618 100%);
  }
  .save-row {
    display: flex;
    min-height: 32px;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    margin: 0 auto 12px;
    width: min(100%, 780px);
  }
  .save-state {
    color: #cda982;
    font-size: 11px;
  }
  .save-state.saved {
    color: #789f80;
  }
  .save-state.error {
    color: #e4a38d;
  }
  .save {
    height: 30px;
    padding: 0 11px;
    border: 1px solid #3c4043;
    border-radius: 6px;
    background: #25282b;
    color: #ececea;
    font-size: 12px;
    font-weight: 650;
  }
  .save:not(:disabled):hover {
    border-color: #94b99b;
    background: #2e3530;
  }
  .save:disabled {
    cursor: default;
    opacity: 0.48;
  }
  .page-wrap {
    position: relative;
    width: min(100%, 780px);
    margin: auto;
  }
  .document {
    display: block;
    width: 100%;
    min-height: calc(100vh - 184px);
    padding: clamp(36px, 8vw, 78px);
    border: 1px solid #383b3e;
    border-radius: 3px;
    outline: none;
    resize: vertical;
    background: #efeee9;
    color: #252723;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px;
    line-height: 1.75;
  }
  .document:focus {
    border-color: #9fbea5;
    box-shadow:
      0 0 0 2px rgba(159, 190, 165, 0.16),
      0 18px 48px rgba(0, 0, 0, 0.28);
  }
  .document::placeholder {
    color: #9fa19b;
  }
  .word-count {
    margin: 14px 4px 0;
    color: #74787b;
    font-size: 11px;
    text-align: right;
  }
  .loading {
    position: absolute;
    top: 25px;
    left: 50%;
    z-index: 1;
    transform: translateX(-50%);
    color: #717575;
    font-size: 12px;
  }
  .empty-editor {
    display: grid;
    flex: 1;
    place-items: center;
    color: #74787b;
    font-size: 13px;
  }
  .file-backdrop {
    position: fixed;
    inset: 0;
    z-index: 12;
    display: grid;
    place-items: center;
    padding: 22px;
    background: rgba(5, 6, 7, 0.7);
    backdrop-filter: blur(8px);
  }
  .file-dialog {
    position: relative;
    width: min(100%, 410px);
    padding: 30px;
    border: 1px solid #35383b;
    border-radius: 14px;
    background: #1a1c1e;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.48);
  }
  .file-dialog .close {
    position: absolute;
    top: 13px;
    right: 14px;
    border: 0;
    background: transparent;
    color: #aaa;
    font-size: 22px;
  }
  .eyebrow {
    margin: 0 0 9px;
    color: #99bd9f;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.16em;
  }
  .file-dialog h2 {
    margin: 0;
    color: #f0efeb;
    font-family: Georgia, serif;
    font-size: 28px;
    font-weight: 400;
  }
  .file-dialog p {
    margin: 9px 0 23px;
    color: #999c9e;
    font-size: 13px;
    line-height: 1.5;
  }
  .file-dialog label {
    display: block;
    margin-bottom: 8px;
    color: #caccce;
    font-size: 12px;
    font-weight: 650;
  }
  .file-dialog input,
  .file-dialog select {
    width: 100%;
    height: 44px;
    padding: 0 12px;
    border: 1px solid #3b3e42;
    border-radius: 7px;
    outline: none;
    background: #111214;
    color: #f1f1ef;
  }
  .file-dialog select {
    margin-bottom: 16px;
  }
  .file-dialog input:focus,
  .file-dialog select:focus {
    border-color: #90b998;
  }
  .file-error {
    display: block;
    margin-top: 8px;
    color: #d9a57f;
  }
  .file-controls {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    margin-top: 24px;
  }
  .file-controls button {
    height: 38px;
    padding: 0 13px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 650;
  }
  .cancel {
    border: 1px solid #393c3f;
    background: transparent;
    color: #c6c8c9;
  }
  .create {
    border: 0;
    background: #b8d5be;
    color: #142018;
  }
  @media (max-width: 760px) {
    .project-sidebar {
      width: 48px;
      flex-basis: 48px;
    }
    .project-sidebar:hover,
    .project-sidebar:focus-within {
      width: 190px;
      flex-basis: 190px;
    }
    .editor-groups.split {
      flex-direction: column;
    }
    .editor-groups.three,
    .editor-groups.four {
      display: flex;
      flex-direction: column;
    }
    .new-file span {
      display: none;
    }
    .editor-group {
      min-height: 50vh;
    }
    .toolbar {
      padding: 0 14px;
    }
    .group-content {
      padding: 12px;
    }
    .document {
      min-height: calc(100vh - 170px);
      padding: 32px 25px;
      font-size: 17px;
    }
  }
</style>
