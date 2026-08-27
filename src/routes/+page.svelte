<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import LandingPage from "../components/landingPage.svelte";
  import Document from "../components/document.svelte";

  let visiblePage = $state(0);
  let selectedPage = $state("");

  const changePage = (fileName: string) => {
    visiblePage = 1;
    selectedPage = fileName;
  };

  const returnHome = () => {
    visiblePage = 0;
    console.log(visiblePage)
  }
</script>

<main class="container">
  <!-- <Document /> -->
  {#if visiblePage == 0}
    <LandingPage {changePage} />
  {/if}
  {#if visiblePage == 1 && selectedPage !== ""}
    <Document selectedFile={selectedPage} returnHome={returnHome}/>
  {/if}
</main>

<style>
  .container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 500px;
    padding: 40px;
    background: #181818;
    overflow: auto;
  }
</style>
