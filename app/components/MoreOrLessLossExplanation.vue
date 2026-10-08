<script setup lang="ts">
import type { MoreOrLessLossView } from '~/utils/moreOrLessLoss'
import { useLocale } from '~/composables/useLocale'

defineProps<{ view: MoreOrLessLossView }>()

const { t } = useLocale()
</script>

<template>
  <section class="loss-explanation" aria-labelledby="loss-explanation-heading">
    <h3 id="loss-explanation-heading" class="feedback--wrong">{{ t('more_or_less.wrong') }}</h3>
    <p class="badge">{{ t('more_or_less.round', { current: view.round + 1, total: view.totalRounds }) }}</p>
    <div class="comparison">
      <div class="comparison__card">
        <div class="loss-explanation__tile">
          <EntityImage class="tile__art" kind="person" :id="view.personId" :name="view.personName" />
        </div>
        <strong>{{ view.personName }}</strong>
        <span class="feedback--wrong">{{ t('more_or_less.reveal', { count: view.hidden }) }}</span>
      </div>
      <div aria-hidden="true">&mdash;</div>
      <div class="comparison__card">
        <!-- The failed side is framed in the error red; wrapping the compared side in the same
             padded frame (transparent) keeps both images the same width and therefore height. -->
        <div class="loss-explanation__tile loss-explanation__tile--neutral">
          <EntityImage class="tile__art" kind="person" :id="view.visibleId" :name="view.visibleName" />
        </div>
        <strong>{{ view.visibleName }}</strong>
        <span class="badge">{{ view.visible }}</span>
      </div>
    </div>
  </section>
</template>