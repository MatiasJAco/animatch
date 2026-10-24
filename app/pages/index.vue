<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { GameId } from '~~/server/game/ids'
import { GAME_IDS } from '~~/server/game/ids'
import type { DailyGameEntry, DailyListing } from '~~/server/game/listing'
import { useLocale } from '~/composables/useLocale'
import { useLocalProgress } from '~/composables/useLocalProgress'

const { t } = useLocale()
const progress = useLocalProgress()

const { data: listing, error, pending, refresh } = await useFetch<DailyListing>('/api/daily')

// The catalog is always complete: the server order and the client order both follow GAME_IDS.
// A missing entry becomes an error card instead of silently disappearing.
const orderedGames = computed<DailyGameEntry[]>(() => {
  const byGame = new Map((listing.value?.games ?? []).map((entry) => [entry.game, entry]))
  return GAME_IDS.map((game) => {
    const entry = byGame.get(game)
    return entry ?? { game, status: 'error' as const, code: 'DATABASE_UNAVAILABLE' }
  })
})

// A listing fetch failure is a visible, retryable page state. Per-game unavailable/error
// statuses stay inside the catalog, even when every game is affected.
const failed = computed(() => Boolean(error.value))

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
      <HomeResetControls />
      <ul class="game-list" data-home-catalog>
        <li v-for="entry in orderedGames" :key="entry.game">
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
