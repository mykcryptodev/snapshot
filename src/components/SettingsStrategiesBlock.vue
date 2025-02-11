<script setup lang="ts">
import { SpaceStrategy } from '@/helpers/interfaces';
import { clone } from '@snapshot-labs/snapshot.js/src/utils';
import schemas from '@snapshot-labs/snapshot.js/src/schemas';

const props = defineProps<{
  context: 'setup' | 'settings';
  title?: string;
  isViewOnly?: boolean;
}>();

const { form, validationErrors } = useFormSpaceSettings(props.context);

const strategies = computed(() => form.value.strategies);

const strategyObj = {
  name: '',
  network: '',
  params: {}
};

const modalStrategyOpen = ref(false);
const currentStrategyIndex = ref<number | null>(null);
const currentStrategy = ref<SpaceStrategy>(clone(strategyObj));

function handleRemoveStrategy(i) {
  form.value.strategies = strategies.value.filter(
    (strategy, index) => index !== i
  );
}

function handleEditStrategy(i) {
  currentStrategyIndex.value = i;
  currentStrategy.value = clone(strategies.value[i]);
  modalStrategyOpen.value = true;
}

function handleAddStrategy() {
  if (props.isViewOnly) return;
  currentStrategyIndex.value = null;
  currentStrategy.value = strategyObj;
  modalStrategyOpen.value = true;
}

function handleSubmitStrategy(strategy) {
  if (currentStrategyIndex.value !== null) {
    const strategiesClone = clone(strategies.value);
    strategiesClone[currentStrategyIndex.value] = strategy;
    form.value.strategies = strategiesClone;
  } else {
    form.value.strategies = strategies.value.concat(strategy);
  }
}
</script>

<template>
  <BaseBlock :title="title || $t('settings.strategies.label')">
    <ContainerParallelInput class="mb-4 w-full">
      <ComboboxNetwork
        :network="form.network"
        :hint="$t('settings.network.information')"
        :disabled="isViewOnly"
        @select="value => (form.network = value)"
      />
      <TuneInput
        v-model="form.symbol"
        :label="$t(`settings.symbol.label`)"
        :hint="$t(`settings.symbol.information`)"
        placeholder="e.g. BAL"
        :error="validationErrors?.symbol"
        :max-length="schemas.space.properties.symbol.maxLength"
        :disabled="isViewOnly"
      />
    </ContainerParallelInput>

    <div class="flex justify-between">
      <div>
        <div class="flex items-center gap-1">
          <h4>{{ $t('settings.strategiesList') }}</h4>
          <IconInformationTooltip
            class="text-sm"
            :information="$t('settings.strategies.information')"
          />
        </div>
        <div class="-mt-[3px] text-sm">
          ({{ $t('settings.votingPowerIsCumulative') }})
        </div>
      </div>
      <div>
        <BaseButton
          class="flex w-full items-center gap-1"
          :disabled="isViewOnly"
          @click="handleAddStrategy"
        >
          <i-ho-plus class="text-sm" />
          {{ $t('add') }}
        </BaseButton>
      </div>
    </div>
    <div class="mt-3">
      <StrategiesListItem
        v-for="(strategy, i) in strategies"
        :key="i"
        :strategy="strategy"
        class="rounded-md !border last:!mb-0"
        :show-delete="!isViewOnly"
        :show-edit="!isViewOnly"
        @edit="handleEditStrategy(i)"
        @delete="handleRemoveStrategy(i)"
      />
    </div>

    <StrategiesBlockWarning
      v-if="context === 'settings'"
      :error="validationErrors?.strategies"
    />
  </BaseBlock>

  <teleport to="#modal">
    <ModalStrategy
      :open="modalStrategyOpen"
      :strategy="currentStrategy"
      :default-network="form.network"
      @close="modalStrategyOpen = false"
      @add="handleSubmitStrategy"
    />
  </teleport>
</template>
