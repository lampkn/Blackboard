<script lang="ts">
  import LandingPage from "../components/landingPage.svelte";
  import Document from "../components/document.svelte";

  let activeDocument = $state<{ fileName: string; projectName: string } | null>(
    null,
  );

  function openDocument(fileName: string, projectName: string) {
    activeDocument = { fileName, projectName };
  }
  function returnHome() {
    activeDocument = null;
  }
</script>

<svelte:head
  ><title>Blackboard — A quiet place to write</title><meta
    name="theme-color"
    content="#101113"
  /></svelte:head
>

<main class="app-shell">
  {#if activeDocument}
    <Document
      selectedFile={activeDocument.fileName}
      projectName={activeDocument.projectName}
      {openDocument}
      {returnHome}
    />
  {:else}
    <LandingPage {openDocument} />
  {/if}
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }
  :global(html, body) {
    margin: 0;
    min-width: 320px;
    min-height: 100%;
    background: #101113;
  }
  :global(body) {
    color: #f5f5f4;
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
  }
  :global(button),
  :global(input),
  :global(textarea) {
    font: inherit;
  }
  :global(button) {
    cursor: pointer;
  }
  .app-shell {
    min-height: 100vh;
    background: #101113;
  }
</style>
