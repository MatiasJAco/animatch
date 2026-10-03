<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { GameId } from '~~/server/game/ids'
import type { DailyListing } from '~~/server/game/listing'
import { useLocale } from '~/composables/useLocale'
import { useLocalProgress } from '~/composables/useLocalProgress'

const { t } = useLocale()
const progress = useLocalProgress()

const { data: listing, error, pending, refresh } = await useFetch<DailyListing>('/api/daily')

// SC-009: a catalog failure is a visible, retryable state, never a blank or stuck page.
// A single unavailable game keeps its own card, so only a total failure replaces the list.
const failed = computed(() => {
  if (error.value) {
    return true
  }
  const games = listing.value?.games ?? []
  return games.length > 0 && games.every((entry) => entry.status === 'error')
})

// Finished markers come from this device only.
onMounted(() => {
  progress.load()
})

const stateFor = (game: GameId) => progress.getGameState(game)
</script>

<template>
  <main class="home">
    <header class="home__header">
      <div>
        <h1>{{ t('app.title') }}</h1>
        <p class="muted">{{ t('app.tagline') }}</p>
      </div>
      <LanguageControl />
    </header>

    <CountdownBadge />

    <ErrorPanel
      v-if="failed"
      code="DATABASE_UNAVAILABLE"
      :pending="pending"
      :retry="() => refresh()"
    />
    <template v-else-if="listing">
      <h2>{{ t('home.pick_game') }}</h2>
      <ul class="game-list">
        <li v-for="entry in listing.games" :key="entry.game">
          <GameCard
            :game="entry.game"
            :status="entry.status"
            :state="stateFor(entry.game)"
          />
        </li>
      </ul>
    </template>
    <p v-else>{{ t('common.loading') }}</p>
  </main>
</template>