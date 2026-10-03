<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  GroupCriterion,
  GroupsOutcome,
  GroupsPayloadData,
} from '~~/server/game/groups'
import { GROUPS_GROUP_SIZE } from '~~/server/game/groups'
import { useLocale } from '~/composables/useLocale'

const props = defineProps<{
  puzzle: GroupsPayloadData
  initialFound?: Array<{ keys: string[]; criterion: GroupCriterion }>
  initialMistakes?: number
  initialAttempts?: number
}>()

const emit = defineEmits<{
  outcome: [
    outcome: GroupsOutcome & {
      attempts: number
      mistakes: number
      found: Array<{ keys: string[]; criterion: GroupCriterion }>
    },
  ]
}>()

const { t } = useLocale()

const selection = ref<string[]>([])
const found = ref<Array<{ keys: string[]; criterion: GroupCriterion }>>(props.initialFound ?? [])
const mistakes = ref(props.initialMistakes ?? 0)
const attempts = ref(props.initialAttempts ?? 0)
const busy = ref(false)
const finished = ref(false)
const revealed = ref<Array<{ keys: string[]; criterion: GroupCriterion }> | null>(null)
const feedback = ref<GroupsOutcome | null>(null)

const consumed = computed(() => new Set(found.value.flatMap((group) => group.keys)))

// FR-033: select up to four tiles, deselecting the tile when it is picked again.
const toggle = (key: string) => {
  if (busy.value || finished.value || consumed.value.has(key)) return
  const index = selection.value.indexOf(key)
  if (index >= 0) {
    selection.value = selection.value.filter((candidate) => candidate !== key)
    return
  }
  if (selection.value.length >= GROUPS_GROUP_SIZE) {
    return
  }
  selection.value = [...selection.value, key]
}

const clear = () => {
  selection.value = []
}

const submit = async () => {
  if (busy.value || finished.value || selection.value.length !== GROUPS_GROUP_SIZE) return
  const tileKeys = selection.value
  busy.value = true
  try {
    const res = await fetch('/api/daily/groups/attempt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tileKeys, consumed: [...consumed.value], mistakes: mistakes.value }),
    })
    if (!res.ok) {
      selection.value = []
      return
    }
    const outcome = (await res.json()) as GroupsOutcome

    attempts.value += 1
    feedback.value = outcome
    if (outcome.result === 'hit') {
      // FR-034: the tiles leave the board and the shared fact is revealed.
      found.value = [
        ...found.value,
        { keys: outcome.tileKeys, criterion: outcome.criterion },
      ]
      if (outcome.state === 'won') {
        finished.value = true
      }
    } else {
      mistakes.value += 1
      if (outcome.state === 'lost') {
        finished.value = true
        revealed.value = outcome.groups ?? null
      }
    }

    emit('outcome', {
      ...outcome,
      attempts: attempts.value,
      mistakes: mistakes.value,
      found: found.value,
    })

    selection.value = []
  } finally {
    busy.value = false
  }
}

const criterionLabel = (criterion: GroupCriterion) => t(`groups.criterion.${criterion.type}`)

const groupByKey = (key: string) => {
  if (found.value.some((group) => group.keys.includes(key))) {
    return found.value.find((group) => group.keys.includes(key)) as (typeof found.value)[number]
  }
  return revealed.value?.find((group) => group.keys.includes(key)) ?? null
}

const isFound = (key: string) => Boolean(groupByKey(key))
</script>

<template>
  <section class="stack">
    <p class="badge">{{ t('groups.mistakes', { current: mistakes, max: puzzle.wrongLimit }) }}</p>
    <p class="muted">{{ t('groups.select_four') }}</p>

    <div v-if="revealed" class="feedback--wrong">
      {{ t('groups.game_over') }}
    </div>
    <div v-else-if="feedback?.result === 'miss'" class="feedback--wrong">
      {{ t('groups.overlap', { count: feedback.overlap }) }}
    </div>
    <div v-else-if="feedback?.result === 'hit'" class="feedback--correct">
      {{ t('groups.found', { criterion: criterionLabel(feedback.criterion) }) }}
    </div>

    <div class="grid-4x4">
      <button
        v-for="tile in puzzle.tiles"
        :key="tile.key"
        type="button"
        class="tile"
        :aria-pressed="selection.includes(tile.key)"
        :disabled="busy || finished || isFound(tile.key)"
        @click="toggle(tile.key)"
      >
        <span class="tile__art" aria-hidden="true" />
        <span class="tile__label">{{ tile.name }}</span>
        <span v-if="isFound(tile.key)" class="tile__label">
          {{ criterionLabel(groupByKey(tile.key)?.criterion as GroupCriterion) }}
        </span>
      </button>
    </div>

    <div class="row">
      <button type="button" class="button button--ghost" :disabled="busy" @click="clear">
        {{ t('groups.clear') }}
      </button>
      <button
        type="button"
        class="button"
        :disabled="busy || finished || selection.length !== GROUPS_GROUP_SIZE"
        @click="submit"
      >
        {{ t('groups.submit') }}
      </button>
    </div>
  </section>
</template>