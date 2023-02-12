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
    if (!this.modelValue.executableIf) {
      this.executableIf = this.proposal.choices[0].text;
      this.$emit('update:modelValue', this.executableIf);
    }
  },
  methods: {
    handleExecutableIfChange(executableIf) {
      this.executableIf = executableIf;
      this.$emit('update:modelValue', executableIf);
    }
  }
};
</script>

<template>
  <UiSelect
    :disabled="config.preview"
    :model-value="executableIf"
    @update:modelValue="handleExecutableIfChange($event)"
  >
    <template #label>{{ $t('Executable if') }}</template>
    <option v-for="choice in choices" :key="choice" :value="choice">
      {{ choice }}
    </option>
  </UiSelect>
</template>
