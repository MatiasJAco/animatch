<script setup lang="ts">
// Feature 007: the one page frame shared by the three games. It fixes the header (title + Home/Reset
// on one row) and hands the rest to the game body, which the board component renders in the fixed
// order `game-board → game-actions → game-meta` (see main.css). No game state lives here.
defineProps<{ title: string }>()
</script>

<template>
  <main class="game-shell">
    <header class="game-header">
      <h1 class="game-header__title">{{ title }}</h1>
      <div class="game-header__actions">
        <slot name="header-actions" />
      </div>
    </header>
    <slot />
  </main>
</template>
