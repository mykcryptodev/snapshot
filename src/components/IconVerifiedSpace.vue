<script setup lang="ts">
import verified from '@/../snapshot-spaces/spaces/verified.json';

const props = withDefaults(
  defineProps<{
    spaceId: string;
    size?: string;
  }>(),
  {
    size: '20'
  }
);

const isVerified = computed(() => verified[props.spaceId] || 0);
</script>

<template>
  <div class="cursor-help">
    <BaseIcon
      v-if="isVerified === 1"
      v-tippy="{
        content: $t('verifiedSpace'),
        placement: 'right'
      }"
      name="check"
      :size="size"
    />
    <BaseIcon
      v-if="isVerified === -1"
      v-tippy="{
        content: $t('warningSpace'),
        placement: 'right'
      }"
      name="warning"
      size="20"
      class="text-red"
    />
  </div>
</template>
