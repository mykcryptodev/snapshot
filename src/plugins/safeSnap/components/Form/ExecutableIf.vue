<script>
export default {
  components: {},
  props: ['modelValue', 'config', 'proposal'],
  emits: ['update:executableIf'],
  data() {
    let executableIf = this.proposal.choices[0].text;

    return {
      executableIf
    };
  },
  computed: {
    choices() {
      return this.proposal.choices.map(c => c.text);
    }
  },
  watch: {
    modelValue() {
      if (this.modelValue?.executableIf) {
        this.executableIf = this.modelValue.executableIf;
      }
    }
  },
  mounted() {
    if (this.config.preview) {
      this.executableIf = this.proposal.plugins.safeSnap.executableIf;
    }
    if (!this.modelValue.executableIf) {
      this.executableIf = this.proposal.choices[0].text;
      this.$emit('update:executableIf', this.executableIf);
    }
  },
  methods: {
    handleExecutableIfChange(executableIf) {
      this.executableIf = executableIf;
      this.$emit('update:executableIf', executableIf);
    }
  }
};
</script>

<template>
  <UiSelect
    :disabled="config.preview"
    :model-value="
      !config.preview
        ? executableIf
        : this.proposal.plugins.safeSnap.executableIf
    "
    @update:modelValue="handleExecutableIfChange($event)"
  >
    <template #label>{{ $t('Executable if') }}</template>
    <option
      v-if="config.preview"
      selected
      :value="this.proposal.plugins.safeSnap.executableIf"
    >
      {{ $t(`${this.proposal.plugins.safeSnap.executableIf}`) }}
    </option>
    <option v-for="choice in choices" :key="choice" :value="choice">
      {{ choice }}
    </option>
  </UiSelect>
</template>
