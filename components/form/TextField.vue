<template>
  <div>
    <div class="flex items-baseline justify-between gap-2">
      <label :for="id" class="label">{{ label }}</label>
      <slot name="label-extra" />
    </div>
    <div class="relative">
      <input
        :id="id"
        v-model="model"
        :name="name ?? id"
        :type="type"
        :autocomplete="autocomplete"
        :inputmode="inputmode"
        :maxlength="maxlength"
        :disabled="disabled"
        :spellcheck="type === 'email' ? false : undefined"
        :class="['input', $slots.trailing && 'pr-12']"
        :aria-invalid="!!error"
        :aria-describedby="describedBy"
        v-bind="$attrs"
      />
      <slot name="trailing" />
    </div>
    <p v-if="hint && !error" :id="`${id}-hint`" class="mt-1.5 text-xs text-muted">{{ hint }}</p>
    <p v-if="error" :id="`${id}-error`" class="mt-1.5 text-sm text-danger">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    type?: string
    name?: string
    autocomplete?: string
    inputmode?: 'text' | 'email' | 'numeric' | 'search' | 'tel' | 'url' | 'none' | 'decimal'
    maxlength?: number
    disabled?: boolean
    hint?: string
    error?: string
  }>(),
  { type: 'text' },
)

const model = defineModel<string>({ default: '' })

const describedBy = computed(() => (props.error ? `${props.id}-error` : props.hint ? `${props.id}-hint` : undefined))
</script>
