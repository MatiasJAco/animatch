<script setup lang="ts">
import { computed } from 'vue'
import { NuxtLink } from '#components'
import type { GameId } from '~~/server/game/ids'
import type { MessageKey } from '~/i18n'
import { useLocale } from '~/composables/useLocale'
import type { LocalGameState } from '~/composables/useLocalProgress'
import type { GameStatus } from '~~/server/game/listing'
import { gameCardPresentation } from '~/utils/gameCardState'

const props = defineProps<{
  game: GameId
  status: GameStatus
  state?: LocalGameState
}>()

const { t } = useLocale()

const name = computed(() => t(`game.${props.game}` as MessageKey))
const summary = computed(() => t(`game.${props.game}.summary` as MessageKey))
const to = computed(() => `/game/${props.game.replace(/_/g, '-')}`)
const presentation = computed(() => gameCardPresentation(props.status, props.state))
const stateMessage = computed(() =>
  presentation.value.messageKey ? t(presentation.value.messageKey) : null,
)
const rootTag = computed(() => (presentation.value.playable ? NuxtLink : 'article'))

// Native links activate with Enter but not Space. Keep Space working for keyboard players.
const activateOnSpace = (event: KeyboardEvent) => {
  if (event.key !== ' ' || !presentation.value.playable) {
    return
  }
  event.preventDefault()
  ;(event.currentTarget as HTMLElement | null)?.click()
}
</script>

<template>
  <component
    :is="rootTag"
    class="game-card"
    :class="`game-card--${presentation.tone}`"
    data-game-card
    :data-game="game"
    :data-state="presentation.tone"
    :to="presentation.playable ? to : undefined"
    @keydown="activateOnSpace"
  >
    <GameArt :game="game" />
    <div class="game-card__body">
      <h3 class="game-card__name" data-card-name>{{ name }}</h3>
      <p class="game-card__summary" data-card-summary>{{ summary }}</p>
      <p
        v-if="stateMessage"
        class="game-card__state"
        :class="presentation.tone === 'finished' ? 'badge' : 'feedback--wrong'"
        data-card-state
      >
        {{ stateMessage }}
      </p>
    </div>
  </component>
</template>
