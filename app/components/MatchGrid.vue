<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  MatchTheSeriesClue,
  MatchTheSeriesOutcome,
  MatchTheSeriesPayloadData,
} from '~~/server/game/matchTheSeries'
import { useLocale } from '~/composables/useLocale'
import { entityImageId } from '~/utils/entityImage'

const props = defineProps<{
  puzzle: MatchTheSeriesPayloadData
  greenSeries: string[]
  answeredClues: string[]
  clueIndex: number
  wrongClicks: number
  attempts: number
  finished: boolean
  busy?: boolean
  /** The full mapping, present only once the game has been lost. */
  answers?: Record<string, string> | null
}>()

// Board position travels back to the page so it can persist progress on every accepted answer
// (FR-043a). Storage never holds puzzle content, only which tiles are green and which cards
// are already answered.
const emit = defineEmits<{
  answer: [seriesKey: string]
  next: []
}>()

const { t } = useLocale()

const lastFeedback = ref<'hit' | 'miss' | null>(null)

// The clue card's image availability, reported by the EntityImage it owns, decides whether
// the "Image unavailable" fallback caption shows (it must never sit under a loaded image).
const clueArt = ref<{ available: boolean } | null>(null)

const greenSet = computed(() => new Set(props.greenSeries))
const answeredSet = computed(() => new Set(props.answeredClues))
const clue = computed<MatchTheSeriesClue | null>(
  () => props.puzzle.clues[props.clueIndex] ?? null,
)

// FR-026c: Next may only offer a different card that is not already answered correctly.
const nextCandidates = computed(() =>
  props.puzzle.clues.filter((candidate, index) => index !== props.clueIndex && !answeredSet.value.has(candidate.key)),
)
const canSkip = computed(() => !props.finished && !props.busy && nextCandidates.value.length > 0)

// FR-027b: a tile that is already green is locked and changes nothing.
const isLocked = (key: string) => greenSet.value.has(key)

const clickSeries = (seriesKey: string) => {
  if (props.busy || props.finished || !clue.value || isLocked(seriesKey)) {
    return
  }
  emit('answer', seriesKey)
}

const skip = () => {
  if (!canSkip.value || !clue.value) {
    return
  }
  // FR-026b: a free skip. It advances the card on screen, changes no counter, and makes
  // no request at all (R-021).
  lastFeedback.value = null
  emit('next')
}

// FR-027: after a loss every card's series is shown, so the board can be read in full.
const seriesForClue = (clueKey: string): string | null => {
  const seriesKey = props.answers?.[clueKey]
  if (!seriesKey) {
    return null
  }
  return props.puzzle.grid.series.find((series) => series.key === seriesKey)?.title ?? null
}

// FR-027: the loss discloses the pairing of every clue, not only the one on screen, so a
// single annotated card would leave the rest of the deck unreadable.
const revealedPairings = computed(() =>
  props.answers
    ? props.puzzle.clues
        .map((clue) => ({ name: clue.name, kind: clue.kind, series: seriesForClue(clue.key) }))
        .filter((entry) => entry.series !== null)
    : [],
)
</script>

<template>
  <section class="stack">
    <p class="badge">
      {{ t('match.mistakes', { current: wrongClicks, max: puzzle.wrongLimit }) }}
      &middot;
      {{ t('result.attempts', { count: attempts }) }}
    </p>

    <!-- The clue and the Next control share one row so the board gets the freed height. -->
    <div class="match-top">
      <div v-if="clue" class="clue-card" aria-live="polite">
        <EntityImage
          ref="clueArt"
          class="clue-card__art"
          :kind="clue.kind"
          :id="entityImageId(clue.kind, clue.key)"
          :name="clue.name"
        />
        <div class="clue-card__body">
          <p class="clue-card__kind">
            {{ t(clue.kind === 'character' ? 'match.clue.character' : 'match.clue.person') }}
          </p>
          <p class="clue-card__name">{{ clue.name }}</p>
          <p v-if="answers" class="clue-card__name">{{ seriesForClue(clue.key) }}</p>
        </div>
        <p v-if="clueArt && !clueArt.available" class="muted">{{ t('match.placeholder') }}</p>
      </div>

      <div class="match-top__actions">
        <button class="button match-next" type="button" :disabled="!canSkip" @click="skip">
          {{ t('match.next') }}
        </button>
        <p v-if="finished || nextCandidates.length === 0" class="muted">
          {{ t('match.next.unavailable') }}
        </p>
      </div>
    </div>

    <div v-if="answers" class="feedback--wrong">{{ t('match.game_over') }}</div>
    <p v-else-if="lastFeedback === 'miss'" class="feedback--wrong">{{ t('match.wrong') }}</p>
    <p v-else-if="lastFeedback === 'hit'" class="feedback--correct">{{ t('match.green') }}</p>

    <div v-if="revealedPairings.length > 0" class="stack">
      <h3>{{ t('match.reveal.title') }}</h3>
      <ul class="reveal-list">
        <li v-for="entry in revealedPairings" :key="entry.name">
          <span class="muted">
            {{ entry.kind === 'character' ? t('match.clue.character') : t('match.clue.person') }}
          </span>
          <strong>{{ entry.name }}</strong>
          <span>{{ entry.series }}</span>
        </li>
      </ul>
    </div>

    <!-- FR-024: exactly one grid, three by three. No heading — the images get the room. -->
    <div class="grid-3x3">
      <button
        v-for="series in puzzle.grid.series"
        :key="series.key"
        type="button"
        class="tile"
        :class="{ 'tile--green': isLocked(series.key) }"
        :disabled="isLocked(series.key) || finished || busy"
        @click="clickSeries(series.key)"
      >
        <EntityImage
          class="tile__art"
          kind="anime"
          :id="entityImageId('anime', series.key)"
          :name="series.title"
        />
        <span class="tile__label">{{ series.title }}</span>
      </button>
    </div>
  </section>
</template>
