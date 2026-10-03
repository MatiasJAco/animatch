<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  MatchTheSeriesOutcome,
  MatchTheSeriesPayloadData,
} from '~~/server/game/matchTheSeries'
import { useLocale } from '~/composables/useLocale'

const props = defineProps<{
  puzzle: MatchTheSeriesPayloadData
  initialMatched?: string[]
  initialMatchedTiles?: string[]
  initialWrongPairs?: number
  initialAttempts?: number
}>()

// Board position travels back to the page so it can persist progress on every accepted answer
// (FR-043a). Storage never holds puzzle content, only which pairs are already locked.
const emit = defineEmits<{
  outcome: [
    outcome: MatchTheSeriesOutcome & {
      attempts: number
      wrongPairs: number
      matched: string[]
      matchedTiles: string[]
    },
  ]
}>()

const { t } = useLocale()

const selectedTile = ref<string | null>(null)
const selectedSeries = ref<string | null>(null)
const matchedTiles = ref<string[]>(props.initialMatchedTiles ?? [])
const matchedSeries = ref<string[]>(props.initialMatched ?? [])
const wrongPairs = ref(props.initialWrongPairs ?? 0)
const attempts = ref(props.initialAttempts ?? 0)
const busy = ref(false)
const finished = ref(false)
const solution = ref<Record<string, string> | null>(null)
const revealedPairs = ref<Record<string, string>>({})
const lastFeedback = ref<'hit' | 'miss' | null>(null)

const matchedTileSet = computed(() => new Set(matchedTiles.value))
const matchedSeriesSet = computed(() => new Set(matchedSeries.value))
const isLocked = (key: string) => matchedTileSet.value.has(key)

const pickTile = (key: string) => {
  if (busy.value || finished.value || isLocked(key)) return
  selectedTile.value = selectedTile.value === key ? null : key
}

const pickSeries = (key: string) => {
  if (busy.value || finished.value || matchedSeriesSet.value.has(key)) return
  selectedSeries.value = selectedSeries.value === key ? null : key
}

const submit = async () => {
  if (busy.value || finished.value || !selectedTile.value || !selectedSeries.value) return
  const tileKey = selectedTile.value
  const seriesKey = selectedSeries.value
  busy.value = true
  try {
    const res = await fetch('/api/daily/match_the_series/attempt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tileKey,
        seriesKey,
        matched: matchedSeries.value,
      }),
    })
    if (!res.ok) {
      selectedTile.value = null
      selectedSeries.value = null
      return
    }
    const outcome = (await res.json()) as MatchTheSeriesOutcome

    attempts.value += 1
    lastFeedback.value = outcome.result
    if (outcome.result === 'hit') {
      matchedTiles.value = [...matchedTiles.value, tileKey]
      matchedSeries.value = [...matchedSeries.value, seriesKey]
      revealedPairs.value = { ...revealedPairs.value, [tileKey]: seriesKey }
      if (outcome.state === 'won') {
        finished.value = true
      }
    } else {
      wrongPairs.value += 1
      if (outcome.state === 'lost') {
        finished.value = true
        solution.value = 'answers' in outcome ? outcome.answers : null
      }
    }

    emit('outcome', {
      ...outcome,
      attempts: attempts.value,
      wrongPairs: wrongPairs.value,
      matched: matchedSeries.value,
      matchedTiles: matchedTiles.value,
    })

    // FR-027a: a wrong pair below the limit returns both tiles to unselected.
    selectedTile.value = null
    selectedSeries.value = null
  } finally {
    busy.value = false
  }
}

// FR-029: one identical neutral placeholder for every tile, no external image.
// Once the game is over the board shows each pairing in full, so a tile carries its series
// title and a series carries the tile it belongs to.
const partnerLabel = (key: string): string => {
  if (solution.value) {
    const tileKey = key.startsWith('a:')
      ? Object.keys(solution.value).find((tile) => solution.value?.[tile] === key)
      : key
    const seriesKey = solution.value[tileKey as string]
    if (!tileKey || !seriesKey) {
      return ''
    }
    const tile = props.puzzle.tiles.find((candidate) => candidate.key === tileKey)
    const series = props.puzzle.series.find((candidate) => candidate.key === seriesKey)
    return (key.startsWith('a:') ? tile?.name : series?.title) ?? ''
  }

  const revealed = revealedPairs.value[key]
  if (!revealed) {
    return ''
  }
  const series = props.puzzle.series.find((candidate) => candidate.key === revealed)
  return series?.title ?? ''
}
</script>

<template>
  <section class="stack">
    <p class="badge">
      {{ t('match.mistakes', { current: wrongPairs, max: puzzle.wrongLimit }) }}
      &middot;
      {{ t('result.attempts', { count: attempts }) }}
    </p>

    <div v-if="solution" class="feedback--wrong">
      {{ t('match.game_over') }}
    </div>
    <div v-else-if="lastFeedback" class="feedback--wrong">
      {{ t('match.wrong_pair') }}
    </div>

    <div class="match-board">
      <div>
        <h3>{{ t('match.grid.left') }}</h3>
        <div class="grid-4x4">
          <button
            v-for="tile in puzzle.tiles"
            :key="tile.key"
            type="button"
            class="tile"
            :aria-pressed="selectedTile === tile.key"
            :disabled="isLocked(tile.key) || finished"
            @click="pickTile(tile.key)"
          >
            <span class="tile__art" aria-hidden="true" />
            <span class="tile__label">{{ tile.name }}</span>
            <span v-if="isLocked(tile.key)" class="tile__label">{{ partnerLabel(tile.key) }}</span>
          </button>
        </div>
      </div>

      <div>
        <h3>{{ t('match.grid.right') }}</h3>
        <div class="grid-4x4">
          <button
            v-for="series in puzzle.series"
            :key="series.key"
            type="button"
            class="tile"
            :aria-pressed="selectedSeries === series.key"
            :disabled="matchedSeriesSet.has(series.key) || finished"
            @click="pickSeries(series.key)"
          >
            <span class="tile__art" aria-hidden="true" />
            <span class="tile__label">{{ series.title }}</span>
            <span v-if="solution" class="tile__label">{{ partnerLabel(series.key) }}</span>
          </button>
        </div>
      </div>
    </div>

    <button
      class="button"
      type="button"
      :disabled="busy || finished || !selectedTile || !selectedSeries"
      @click="submit"
    >
      {{ t('match.submit') }}
    </button>
  </section>
</template>