<script lang="ts">
  import { mkdir, readDir } from "@tauri-apps/plugin-fs";
  import { appDataDir } from "@tauri-apps/api/path";

  let list = $state<any[]>([]);
  let selectedProject = $state({});
  let modalPage = $state(1);
  let projectFiles = $state<any[]>([]);

  let { modalVisible, onClose, changePage } = $props<{
    modalVisible: boolean;
    onClose: () => void;
    changePage: (fileName: string) => void;
  }>();

  async function getList() {
    const path = await appDataDir();
    const tempList = await readDir(`${path}/filetree`);
    list = tempList;
  }

  const loadProject = async (project: any) => {
    // add functionality to click into a project
    // Load project get project name load list #1
    selectedProject = project.name;
    loadProjectList();
  };

  const loadProjectList = async () => {
    // get path and list of files in project #2
    const path = await appDataDir();
    const projectDirList = await readDir(`${path}/filetree/${selectedProject}`);
    projectFiles = projectDirList;
    modalPage = 2;
  };

  const loadFile = async (fileName: String) => {
    changePage(fileName)
  } 

  const back = () => {
    modalPage = 1;
  };

  getList();
</script>

{#if modalVisible}
  <div class="modalBackdrop">
    <div class="nameModalContainer">
      {#if modalPage == 1}
        <div class="projectNames">
          {#each list as project}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="projectName" onclick={() => loadProject(project)}>
              {project.name}
            </div>
          {/each}
        </div>
      {/if}
      {#if modalPage == 2}
        <div class="projectNames">
          {#each projectFiles as files}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="projectName" onclick={() => loadFile(files.name)}>
              {files.name}
            </div>
          {/each}
          <button onclick={back}>back</button>
        </div>
      {/if}
      <button onclick={onClose}>cancel</button>
    </div>
  </div>
{/if}

<style>
  .modalBackdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
  }

  .nameModalContainer {
    position: fixed;
    background: orange;
    padding: 1rem;
  }

  .projectNames {
    display: flex;
    justify-content: center;
    flex-direction: column;
  }

  .projectName:hover {
    text-decoration: underline;
  }
</style>
