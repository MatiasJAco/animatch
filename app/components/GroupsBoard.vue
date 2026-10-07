<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  GroupCriterion,
  GroupsOutcome,
  GroupsPayloadData,
} from '~~/server/game/groups'
import { GROUPS_GROUP_SIZE } from '~~/server/game/groups'
import { buildBoardRows } from '~/utils/groupsBoard'
import { entityImageId } from '~/utils/entityImage'
import { useLocale } from '~/composables/useLocale'
import {
  isRetryableCode,
  readErrorCode,
  type AttemptErrorCode,
} from '~/composables/attemptFailure'

const props = defineProps<{
  puzzle: GroupsPayloadData
  initialStatus?: 'won' | 'lost' | 'in_progress'
  initialFound?: Array<{ keys: string[]; criterion: GroupCriterion }>
  initialMissLog?: string[][]
  initialMistakes?: number
  initialAttempts?: number
}>()

const emit = defineEmits<{
  outcome: [
    outcome: GroupsOutcome & {
      attempts: number
      mistakes: number
      found: Array<{ keys: string[]; criterion: GroupCriterion }>
      missLog: string[][]
    },
  ]
}>()

const { t } = useLocale()

const selection = ref<string[]>([])
const found = ref<Array<{ keys: string[]; criterion: GroupCriterion }>>(props.initialFound ?? [])
// Constitution IV: the server re-derives the mistake count from the rejected proposals it
// can verify against the stored solution, so the device keeps the proposals, not a count.
const missLog = ref<string[][]>(props.initialMissLog ?? [])
const mistakes = ref(props.initialMistakes ?? 0)
const attempts = ref(props.initialAttempts ?? 0)
const busy = ref(false)
const finished = ref(props.initialStatus === 'won' || props.initialStatus === 'lost')
const revealed = ref<Array<{ keys: string[]; criterion: GroupCriterion }> | null>(null)
const feedback = ref<GroupsOutcome | null>(null)
// Principle V: a rejected or failed attempt is a visible state with a retry.
const attemptError = ref<AttemptErrorCode | null>(null)
const lastTileKeys = ref<string[] | null>(null)

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
  attemptError.value = null
  try {
    const res = await fetch('/api/daily/groups/attempt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Constitution IV: progress travels as verifiable evidence, never as counters.
      body: JSON.stringify({
        tileKeys,
        foundGroups: found.value.map((group) => group.keys),
        missLog: missLog.value,
      }),
    })
    if (!res.ok) {
      // Principle V: the panel names the failure the server reported, and a deterministic
      // rejection gets no Retry instead of one that replays the same invalid proposal.
      lastTileKeys.value = tileKeys
      attemptError.value = await readErrorCode(res)
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
      missLog.value = [...missLog.value, tileKeys]
      mistakes.value = missLog.value.length
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
      missLog: missLog.value,
    })

    selection.value = []
  } catch {
    lastTileKeys.value = tileKeys
    attemptError.value = 'DATABASE_UNAVAILABLE'
    selection.value = []
  } finally {
    busy.value = false
  }
}

// Principle V: the retry replays the same four tiles, so it can never cost a second
// mistake count or reveal anything the original request would not have.
const retry = () => {
  const keys = lastTileKeys.value
  if (!keys || keys.length !== GROUPS_GROUP_SIZE) {
    attemptError.value = null
    return
  }
  selection.value = keys
  void submit()
}

const criterionLabel = (criterion: GroupCriterion) => t(`groups.criterion.${criterion.type}`)

// FR-034: the board presentation derives from the existing found/reveal state: found groups
// become permanent green rows, a loss adds red rows for the groups never found (feature 003).
const board = computed(() => buildBoardRows(props.puzzle.tiles, found.value, revealed.value))
const rows = computed(() => board.value.rows)
const tileByKey = (key: string) => props.puzzle.tiles.find((tile) => tile.key === key)

const visibleTiles = computed(() =>
  board.value.selectable
    .map((key) => tileByKey(key))
    .filter((tile): tile is typeof tile => Boolean(tile)),
)
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

    <ErrorPanel
      v-if="attemptError"
      :code="attemptError"
      :pending="busy"
      :retry="attemptError && isRetryableCode(attemptError) ? retry : undefined"
    />

    <div class="group-rows">
      <div
        v-for="(row, rowIndex) in rows"
        :key="rowIndex"
        class="group-row"
        :class="row.kind === 'revealed' ? 'group-row--revealed' : 'group-row--found'"
      >
        <span class="group-row__criterion">{{ criterionLabel(row.criterion) }}</span>
        <span v-for="tileKey in row.tileKeys" :key="tileKey" class="group-row__tile">
          <EntityImage
            class="tile__art"
            :kind="tileByKey(tileKey)?.kind"
            :id="tileByKey(tileKey) ? entityImageId(tileByKey(tileKey)!.kind, tileKey) : undefined"
            :name="tileByKey(tileKey)?.name ?? ''"
          />
          <span class="tile__label">{{ tileByKey(tileKey)?.name }}</span>
        </span>
      </div>
    </div>

    <div v-if="!finished" class="grid-4x4">
      <button
        v-for="tile in visibleTiles"
        :key="tile.key"
        type="button"
        class="tile"
        :aria-pressed="selection.includes(tile.key)"
        :disabled="busy || finished"
        @click="toggle(tile.key)"
      >
        <EntityImage
          class="tile__art"
          :kind="tile.kind"
          :id="entityImageId(tile.kind, tile.key)"
          :name="tile.name"
        />
        <span class="tile__label">{{ tile.name }}</span>
      </button>
    </div>

    <div v-if="!finished" class="row">
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