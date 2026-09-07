<script lang="ts">
  import { appDataDir } from "@tauri-apps/api/path";
  import { readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
  import Explorermodal from "./explorermodal.svelte";

  type EditorTab = { id: number; fileName: string; text: string; saved: boolean; loading: boolean };
  type EditorGroup = { tabs: EditorTab[]; activeId: number | null };
  const { selectedFile, projectName, returnHome, openDocument } = $props<{ selectedFile: string; projectName: string; returnHome: () => void; openDocument: (fileName: string, projectName: string) => void }>();
  let projectFiles = $state<any[]>([]);
  let projectBrowserOpen = $state(false);
  let groups = $state<EditorGroup[]>([{ tabs: [], activeId: null }]);
  let activeGroup = $state(0);
  let nextTabId = 0;
  let lastRequestedFile = "";
  let loadedProject = "";

  const activeTab = (group: EditorGroup) => group.tabs.find((tab) => tab.id === group.activeId);
  async function loadProjectFiles() { try { const path = await appDataDir(); projectFiles = await readDir(`${path}/filetree/${projectName}`); } catch { projectFiles = []; } }
  async function loadTab(tab: EditorTab) { tab.loading = true; try { const path = await appDataDir(); tab.text = await readTextFile(`${path}/filetree/${projectName}/${tab.fileName}`); tab.saved = true; } finally { tab.loading = false; } }
  function openInGroup(fileName: string, groupIndex = activeGroup) {
    const group = groups[groupIndex]; const existing = group.tabs.find((tab) => tab.fileName === fileName);
    if (existing) { group.activeId = existing.id; activeGroup = groupIndex; return; }
    const tab: EditorTab = { id: nextTabId++, fileName, text: "", saved: true, loading: true };
    group.tabs.push(tab); group.activeId = tab.id; activeGroup = groupIndex; loadTab(tab);
  }
  function selectDocument(fileName: string) { openInGroup(fileName); openDocument(fileName, projectName); }
  async function save(tab: EditorTab) { const path = await appDataDir(); await writeTextFile(`${path}/filetree/${projectName}/${tab.fileName}`, tab.text); tab.saved = true; }
  function closeTab(groupIndex: number, tabId: number) { const group = groups[groupIndex]; const index = group.tabs.findIndex((tab) => tab.id === tabId); if (index < 0) return; group.tabs.splice(index, 1); group.activeId = group.tabs[Math.max(0, index - 1)]?.id ?? null; if (!group.tabs.length && groups.length > 1) { groups.splice(groupIndex, 1); activeGroup = 0; } }
  function addSplit() { if (groups.length === 2) return; groups.push({ tabs: [], activeId: null }); activeGroup = 1; const current = activeTab(groups[0]); if (current) openInGroup(current.fileName, 1); }
  function closeSplit() { if (groups.length > 1) { groups.splice(1, 1); activeGroup = 0; } }
  function keydown(event: KeyboardEvent, tab: EditorTab) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); save(tab); } }
  $effect(() => {
    if (projectName !== loadedProject) {
      loadedProject = projectName;
      groups = [{ tabs: [], activeId: null }];
      activeGroup = 0;
      lastRequestedFile = "";
    }
    loadProjectFiles();
  });
  $effect(() => { if (selectedFile && selectedFile !== lastRequestedFile) { lastRequestedFile = selectedFile; openInGroup(selectedFile); } });
</script>

<div class="editor-layout">
  <aside class="project-sidebar" aria-label="Project navigation">
    <button class="sidebar-brand" onclick={returnHome} aria-label="All projects"><span class="mark">B</span><span class="sidebar-label">Blackboard</span></button>
    <button class="current-project" onclick={() => (projectBrowserOpen = true)} title="Switch project"><span class="folder">□</span><span class="sidebar-label">{projectName}</span></button>
    <nav class="file-list" aria-label={`${projectName} documents`}>
      {#each projectFiles as file}
        <button class:active={groups.some((group) => activeTab(group)?.fileName === file.name)} onclick={() => selectDocument(file.name)} title={file.name}><span>▤</span><span class="sidebar-label">{file.name}</span></button>
      {/each}
    </nav>
    <button class="all-projects" onclick={returnHome} title="All projects"><span>←</span><span class="sidebar-label">All projects</span></button>
  </aside>
  <div class="editor-shell">
    <header class="toolbar">
      <div class="document-meta"><span class="project">{projectName}</span><span class="slash">/</span><span>{activeTab(groups[activeGroup])?.fileName ?? "No document open"}</span></div>
      <button class="split-toggle" class:enabled={groups.length === 2} onclick={groups.length === 2 ? closeSplit : addSplit} title={groups.length === 2 ? "Close editor split" : "Split editor"} aria-label={groups.length === 2 ? "Close editor split" : "Split editor"}><span>▯</span><span>▯</span></button>
    </header>
    <div class:split={groups.length === 2} class="editor-groups">
      {#each groups as group, groupIndex}
        <section class:focused={activeGroup === groupIndex} class="editor-group" aria-label={`Editor ${groupIndex + 1}`}>
          <div class="tab-bar">
            {#if group.tabs.length === 0}<span class="empty-tabs">Select a document to open it here</span>{/if}
            {#each group.tabs as tab}
              <button class:active={tab.id === group.activeId} class="tab" onclick={() => { group.activeId = tab.id; activeGroup = groupIndex; }}><span class="tab-name">{tab.fileName}</span>{#if !tab.saved}<span class="tab-dot">●</span>{/if}<span class="tab-close" role="button" tabindex="0" aria-label={`Close ${tab.fileName}`} onclick={(event) => { event.stopPropagation(); closeTab(groupIndex, tab.id); }} onkeydown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); closeTab(groupIndex, tab.id); } }}>×</span></button>
            {/each}
          </div>
          {#if activeTab(group)}
            {@const tab = activeTab(group)!}
            <div class="group-content" onfocusin={() => (activeGroup = groupIndex)}>
              <div class="save-row"><span class:saved={tab.saved} class="save-state">{tab.saved ? "Saved" : "Unsaved changes"}</span><button class="save" onclick={() => save(tab)} disabled={tab.saved}>Save</button></div>
              <div class="page-wrap">
                {#if tab.loading}<div class="loading">Opening document…</div>{/if}
                <textarea bind:value={tab.text} class="document" spellcheck="true" oninput={() => (tab.saved = false)} onkeydown={(event) => keydown(event, tab)} aria-label={tab.fileName} placeholder="Begin writing…"></textarea>
                <p class="word-count">{tab.text.trim() ? tab.text.trim().split(/\s+/).length : 0} words</p>
              </div>
            </div>
          {:else}<div class="empty-editor" role="button" tabindex="0" onclick={() => (activeGroup = groupIndex)} onkeydown={(event) => { if (event.key === "Enter" || event.key === " ") activeGroup = groupIndex; }}>Choose a document from the sidebar.</div>{/if}
        </section>
      {/each}
    </div>
  </div>
</div>
<Explorermodal
  modalVisible={projectBrowserOpen}
  onClose={() => (projectBrowserOpen = false)}
  {openDocument}
  projectToOpen={projectName}
  onProjectViewed={() => {}}
/>

<style>
  .editor-layout{display:flex;min-height:100vh;background:#141618}.project-sidebar{position:relative;z-index:3;display:flex;width:58px;flex:0 0 58px;flex-direction:column;overflow:hidden;padding:14px 9px;border-right:1px solid #292c2f;background:#17191b;transition:width .2s ease,flex-basis .2s ease}.project-sidebar:hover,.project-sidebar:focus-within{width:230px;flex-basis:230px}.sidebar-brand,.current-project,.file-list button,.all-projects{display:flex;align-items:center;gap:10px;width:100%;border:0;overflow:hidden;text-align:left;white-space:nowrap}.sidebar-brand{min-height:30px;padding:0;background:transparent;color:#f0f0ed;font-size:13px;font-weight:650}.mark{display:grid;width:30px;min-width:30px;height:30px;place-items:center;border:1px solid #414448;border-radius:8px;background:#202225;font-family:Georgia,serif;font-size:18px}.sidebar-label{overflow:hidden;text-overflow:ellipsis;opacity:0;transition:opacity .15s ease .03s}.project-sidebar:hover .sidebar-label,.project-sidebar:focus-within .sidebar-label{opacity:1}.current-project{min-height:34px;margin-top:28px;padding:0 7px;border-radius:6px;background:#25282a;color:#c8ceca;font-size:12px;font-weight:650}.folder{width:18px;min-width:18px;color:#9dbe9f;font-size:18px}.file-list{display:flex;flex-direction:column;gap:2px;margin-top:9px;overflow:auto}.file-list button,.all-projects{min-height:33px;padding:0 7px;border-radius:6px;background:transparent;color:#929699;font-size:12px}.file-list button>span:first-child,.all-projects>span:first-child{width:18px;min-width:18px;color:#78868d;font-size:15px;text-align:center}.file-list button:hover,.all-projects:hover{background:#25282a;color:#e1e2df}.file-list button.active{background:#2b332d;color:#e2e9e2}.all-projects{margin-top:auto;color:#aeb2b2}.editor-shell{display:flex;min-width:0;flex:1;flex-direction:column}.toolbar{display:flex;align-items:center;justify-content:space-between;min-height:58px;padding:0 18px 0 26px;border-bottom:1px solid #2a2d30;background:rgba(20,22,24,.94)}.document-meta{overflow:hidden;color:#d0d1ce;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.project{color:#9fbea5}.slash{margin:0 7px;color:#606468}.split-toggle{display:flex;align-items:center;gap:2px;height:32px;padding:0 9px;border:1px solid #3c4043;border-radius:6px;background:#25282b;color:#aeb6b1;font-size:14px}.split-toggle:hover,.split-toggle.enabled{border-color:#94b99b;color:#dce6de}.split-toggle span{display:inline-block;transform:scaleX(.65)}.editor-groups{display:flex;min-height:0;flex:1}.editor-groups.split{gap:1px;background:#35393c}.editor-group{display:flex;min-width:0;flex:1;flex-direction:column;background:#17191b}.editor-group.focused{box-shadow:inset 0 2px #9fbea5}.tab-bar{display:flex;min-height:38px;overflow-x:auto;border-bottom:1px solid #2a2d30;background:#1b1d1f}.empty-tabs{padding:11px 14px;color:#74787b;font-size:11px}.tab{display:flex;min-width:0;max-width:220px;align-items:center;gap:7px;padding:0 8px 0 12px;border:0;border-right:1px solid #303336;background:#202225;color:#aeb2b2;font-size:12px}.tab.active{background:#17191b;color:#e4e5e1}.tab-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tab-dot{color:#d5b184;font-size:8px}.tab-close{padding:0 2px;color:#858a89;font-size:16px;line-height:1}.tab-close:hover{color:#f0f0ed}.group-content{flex:1;overflow:auto;padding:14px 22px 40px;background:radial-gradient(ellipse at top,#202326 0%,#17191b 52%,#141618 100%)}.save-row{display:flex;min-height:32px;align-items:center;justify-content:flex-end;gap:10px;margin:0 auto 12px;width:min(100%,780px)}.save-state{color:#cda982;font-size:11px}.save-state.saved{color:#789f80}.save{height:30px;padding:0 11px;border:1px solid #3c4043;border-radius:6px;background:#25282b;color:#ececea;font-size:12px;font-weight:650}.save:not(:disabled):hover{border-color:#94b99b;background:#2e3530}.save:disabled{cursor:default;opacity:.48}.page-wrap{position:relative;width:min(100%,780px);margin:auto}.document{display:block;width:100%;min-height:calc(100vh - 184px);padding:clamp(36px,8vw,78px);border:1px solid #383b3e;border-radius:3px;outline:none;resize:vertical;background:#efeee9;color:#252723;box-shadow:0 18px 48px rgba(0,0,0,.28);font-family:Georgia,"Times New Roman",serif;font-size:18px;line-height:1.75}.document:focus{border-color:#9fbea5;box-shadow:0 0 0 2px rgba(159,190,165,.16),0 18px 48px rgba(0,0,0,.28)}.document::placeholder{color:#9fa19b}.word-count{margin:14px 4px 0;color:#74787b;font-size:11px;text-align:right}.loading{position:absolute;top:25px;left:50%;z-index:1;transform:translateX(-50%);color:#717575;font-size:12px}.empty-editor{display:grid;flex:1;place-items:center;color:#74787b;font-size:13px}@media(max-width:760px){.project-sidebar{width:48px;flex-basis:48px}.project-sidebar:hover,.project-sidebar:focus-within{width:190px;flex-basis:190px}.editor-groups.split{flex-direction:column}.editor-group{min-height:50vh}.toolbar{padding:0 14px}.group-content{padding:12px}.document{min-height:calc(100vh - 170px);padding:32px 25px;font-size:17px}}
</style>
