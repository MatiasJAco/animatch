<script setup lang="ts">
import { ref } from 'vue'
import type { GameId } from '~~/server/game/ids'
import { useLocale } from '~/composables/useLocale'

const props = defineProps<{
  game: GameId
  state: 'won' | 'lost'
  attempts: number
}>()

const { t } = useLocale()

// FR-044 / FR-045 / FR-046: the text names only the game, the outcome, and the attempt count.
// It is always visible so it can be copied by hand, whether or not a share sheet exists.
const shareText = () =>
  t('share.template', {
    game: t(`game.${props.game}`),
    outcome: t(props.state === 'won' ? 'result.won' : 'result.lost'),
    attempts: props.attempts,
  })

const copied = ref(false)

const share = async () => {
  const text = shareText()
  const sheet = navigator as Navigator & {
    share?: (data: { title?: string; text: string }) => Promise<void>
  }
  if (typeof sheet.share === 'function') {
    try {
      await sheet.share({ text })
      return
    } catch {
      // A cancelled or unavailable sheet falls through to the manual path below.
    }
  }
  await copy(text)
}

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <div class="stack">
    <p class="share-text">{{ shareText() }}</p>
    <div class="row">
      <button type="button" class="button" @click="share">
        {{ t('common.share') }}
      </button>
      <button type="button" class="button button--ghost" @click="copy(shareText())">
        {{ t('common.copy') }}
      </button>
    </div>
    <p v-if="copied" class="feedback--correct">{{ t('common.copied') }}</p>
  </div>
</template>