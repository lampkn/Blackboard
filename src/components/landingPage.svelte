<script lang="ts">
  import { mkdir, readDir } from "@tauri-apps/plugin-fs";
  import { appDataDir } from "@tauri-apps/api/path";
  import NameModal from "./nameModal.svelte";
  import Explorermodal from "./explorermodal.svelte";

  const { changePage } = $props<{
    changePage: (fileName: string) => void;
  }>();

  let modalOpen = $state(false);
  let explorerModal = $state(false);

  async function listProjects() {
    // Todo
    explorerModal = true;
  }

  async function createProject() {
    console.log("Ran");
    modalOpen = true;
    console.log(modalOpen);
  }

  const closeModal = () => {
    modalOpen = false;
  };

  const closeExplorerModal = () => {
    explorerModal = false;
  };
</script>

<div class="landingCard">
  <div class="buttonContainer">
    <button onclick={createProject}> New Project </button>
    <button onclick={listProjects}> Open Project </button>
    <NameModal modalVisible={modalOpen} onClose={closeModal} />
    <Explorermodal modalVisible={explorerModal} onClose={closeExplorerModal} changePage={changePage}/>
  </div>
  <div>Recently Opened</div>
</div>

<style>
  .landingCard {
    margin-top: 5rem;
    margin-right: 8px;
    display: flex;
    width: 36rem;
    height: 15rem;
    justify-content: center;
    flex-direction: column;
    align-items: center;
    background-color: rgba(38, 37, 37, 0.87);
  }

  .landingCard button {
    font-size: 24px;
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 600;
    height: 5rem;
    width: 8rem;
  }
</style>
