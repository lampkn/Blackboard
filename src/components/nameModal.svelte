<script lang="ts">
  import { mkdir } from "@tauri-apps/plugin-fs";
  import { appDataDir } from "@tauri-apps/api/path";
  let projectName = $state("");
  let { modalVisible, onClose, onCreated } = $props<{
    modalVisible: boolean;
    onClose: () => void;
    onCreated: (name: string) => void;
  }>();
  async function createNewProject() {
    const name = projectName.trim();
    if (!name) return;
    const path = await appDataDir();
    await mkdir(`${path}/filetree/${name}`, { recursive: true });
    projectName = "";
    onCreated(name);
  }
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
      aria-labelledby="new-project-title"
    >
      <button class="close" aria-label="Close" onclick={onClose}>×</button>
      <p class="eyebrow">NEW PROJECT</p>
      <h2 id="new-project-title">Name your space</h2>
      <p class="copy">
        Give this collection of writing a clear, memorable name.
      </p>
      <form
        onsubmit={(event) => {
          event.preventDefault();
          createNewProject();
        }}
      >
        <label for="project-name">Project name</label><input
          id="project-name"
          bind:value={projectName}
          placeholder="e.g. Autumn essays"
        />
        <div class="controls">
          <button type="button" class="cancel" onclick={onClose}>Cancel</button
          ><button type="submit" class="create"
            >Create project <span>→</span></button
          >
        </div>
      </form>
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
    position: relative;
    width: min(100%, 440px);
    padding: 32px;
    border: 1px solid #35383b;
    border-radius: 14px;
    background: #1a1c1e;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.48);
  }
  .close {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #94979a;
    font-size: 22px;
    line-height: 1;
  }
  .close:hover {
    background: #272a2d;
    color: #eee;
  }
  .eyebrow {
    margin: 0 0 10px;
    color: #99bd9f;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.16em;
  }
  h2 {
    margin: 0;
    color: #f0efeb;
    font-family: Georgia, serif;
    font-size: 30px;
    font-weight: 400;
    letter-spacing: -0.035em;
  }
  .copy {
    margin: 10px 0 26px;
    color: #999c9e;
    font-size: 14px;
    line-height: 1.55;
  }
  label {
    display: block;
    margin-bottom: 8px;
    color: #caccce;
    font-size: 12px;
    font-weight: 650;
  }
  input {
    width: 100%;
    height: 46px;
    padding: 0 13px;
    border: 1px solid #3b3e42;
    border-radius: 7px;
    outline: none;
    background: #111214;
    color: #f1f1ef;
    font-size: 14px;
  }
  input:focus {
    border-color: #90b998;
    box-shadow: 0 0 0 3px rgba(144, 185, 152, 0.12);
  }
  .controls {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 26px;
  }
  .controls button {
    height: 40px;
    padding: 0 14px;
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
  .create span {
    margin-left: 10px;
  }
</style>
