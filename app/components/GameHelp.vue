<script setup lang="ts">
import { computed } from 'vue'
import type { GameId } from '~~/server/game/ids'
import type { MessageKey } from '~/i18n'
import { useLocale } from '~/composables/useLocale'

const props = defineProps<{ game: GameId }>()

const { t } = useLocale()

const heading = computed(() => t(`game.${props.game}` as MessageKey))
const help = computed(() => t(`game.${props.game}.help` as MessageKey))
</script>

<template>
  <section class="card">
    <h2>{{ heading }}</h2>
    <p>{{ help }}</p>
  </section>
</template>