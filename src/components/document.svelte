<script lang="ts">
  import { appDataDir } from "@tauri-apps/api/path";
  import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

  let contents = $state("");
  let text = $state("");

  const { selectedFile, returnHome } = $props<{
    selectedFile: string;
    returnHome: () => void;
  }>();

  async function update(event: Event) {
    event.preventDefault();
    const path = await appDataDir();

    // await writeTextFile(`${path}/filetree/untitled/Some people.txt`, text);
    await writeTextFile(`${path}/filetree/untitled/${selectedFile}`, text);
  }

  const readFile = async () => {
    const path = await appDataDir();
    contents = await readTextFile(`${path}/filetree/untitled/${selectedFile}`);

    return contents;
  };

  const loadContent = async () => {
    text = await readFile();
  };

  loadContent();
</script>

<div class="page-container">
  <button onclick={() => returnHome()}>return</button>
  <textarea
    bind:value={text}
    class="document"
    spellcheck="true"
    onchange={update}
  ></textarea>
</div>

<style>
  .page-container {
    min-height: 100%;
    padding: 40px;
    background: #f5f5f5;
    overflow: auto;
  }

  .document {
    display: block;
    width: 8.5in;
    min-height: 11in;
    margin: 0 auto;
    padding: 1in;

    box-sizing: border-box;

    background: white;
    border: none;
    outline: none;
    resize: none;

    font-family: Arial, sans-serif;
    font-size: 16px;
    line-height: 1.6;

    color: #202124;

    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  }
</style>
