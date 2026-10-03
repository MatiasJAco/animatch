<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  MoreOrLessPuzzleData,
  MoreOrLessAnswer,
  MoreOrLessOutcome,
} from '~~/server/game/moreOrLess'
import { useLocale } from '~/composables/useLocale'

const props = defineProps<{
  puzzle: MoreOrLessPuzzleData
  initialRound?: number
  initialAttempts?: number
}>()

const emit = defineEmits<{
  outcome: [outcome: MoreOrLessOutcome & { attempts: number; round: number }]
}>()

const { t } = useLocale()

const attempts = ref(props.initialAttempts ?? 0)
const round = ref(props.initialRound ?? 0)
const revealed = ref(false)
const lastOutcome = ref<MoreOrLessOutcome | null>(null)
const busy = ref(false)

// The right-hand count must survive the transition into the next round: the payload only
// carries the opening count, and each later value arrives from the previous outcome.
const givenCount = ref(props.puzzle.initialVisible.roleCount)

const ordered = computed(() => {
  const chain = Array.isArray(props.puzzle.chain) ? props.puzzle.chain : []
  return [props.puzzle.initialVisible, ...chain]
})

const left = computed(() => ordered.value[round.value + 1] ?? { name: '' })
const right = computed(() => ordered.value[round.value] ?? { name: '' })
const given = computed(() => givenCount.value)
const isGameOver = computed(() => {
  const state = lastOutcome.value?.state
  return state === 'lost' || state === 'won'
})

const submit = async (answer: MoreOrLessAnswer) => {
  if (busy.value || isGameOver.value) return
  busy.value = true
  try {
    const res = await fetch('/api/daily/more_or_less/attempt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ round: round.value, answer }),
    })
    if (!res.ok) {
      return
    }
    const outcome = (await res.json()) as MoreOrLessOutcome
    lastOutcome.value = outcome
    attempts.value += 1
    revealed.value = true

    if (outcome.result === 'miss') {
      emit('outcome', { ...outcome, attempts: attempts.value, round: round.value })
      return
    }

    if (outcome.state === 'won') {
      emit('outcome', { ...outcome, attempts: attempts.value, round: round.value })
      return
    }

    // Carry this round's counts forward so the next comparison has a valid right side.
    givenCount.value = outcome.counts.hidden
    round.value = outcome.round + 1
    revealed.value = false
    emit('outcome', { ...outcome, attempts: attempts.value, round: round.value })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card">
    <p class="badge">{{ t('more_or_less.round', { current: round + 1, total: puzzle.rounds }) }}</p>
    <p class="muted">{{ t('more_or_less.question') }}</p>

    <div class="comparison">
      <div>
        <strong>{{ left.name }}</strong>
      </div>
      <div aria-hidden="true">&mdash;</div>
      <div>
        <strong>{{ right.name }}</strong>
        <span class="badge">{{ given }}</span>
      </div>
    </div>

    <div v-if="!isGameOver" class="row">
      <button type="button" :disabled="busy" @click="submit('more')">
        {{ t('more_or_less.answer.more') }}
      </button>
      <button type="button" :disabled="busy" @click="submit('less')">
        {{ t('more_or_less.answer.less') }}
      </button>
    </div>

    <div v-if="revealed && lastOutcome" class="stack">
      <p :class="lastOutcome.result === 'hit' ? 'feedback--correct' : 'feedback--wrong'">
        {{ lastOutcome.result === 'hit' ? t('more_or_less.correct') : t('more_or_less.wrong') }}
      </p>
      <p>{{ t('more_or_less.reveal', { count: lastOutcome.counts.hidden }) }}</p>
      <p>
        {{ lastOutcome.counts.hidden }}
        <span aria-hidden="true">/</span>
        {{ lastOutcome.counts.visible }}
      </p>
    </div>
  </section>
</template>