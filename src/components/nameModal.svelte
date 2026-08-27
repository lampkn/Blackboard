<script lang="ts">
  import { mkdir, readDir } from "@tauri-apps/plugin-fs";
  import { appDataDir } from "@tauri-apps/api/path";

  let projectName = $state("");

  let { modalVisible, onClose } = $props<{
    modalVisible: boolean;
    onClose: () => void;
  }>();

  async function createNewProject() {
    const path = await appDataDir();

    await mkdir(`${path}/filetree/${projectName.trim()}`, {
      recursive: true,
    });
  }
</script>

{#if modalVisible}
  <div class="modalBackdrop">
    <div class="nameModalContainer">
      <input type="text" placeholder="Enter name..." bind:value={projectName} />
      <div class="controls">
        <button onclick={createNewProject}>submit</button>
        <button onclick={onClose}>cancel</button>
      </div>
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
    padding: 4rem;
    border: 1px solid black;
    border-radius: .25rem;
  }

  .controls {
    display: flex;
    justify-content: end;
  }

  .nameModalContainer input {
    border: 1px solid black;
    border-radius: .25rem;
    width: 24rem;
    height: 2rem;
    font-size: 18px;
    padding: 0 12px;
  }

  .controls button {
    margin: 10px 0px 0px 5px;
    border: 1px solid black;
    border-radius: .25rem;
    padding: 0.09rem 1rem;
  }
</style>
