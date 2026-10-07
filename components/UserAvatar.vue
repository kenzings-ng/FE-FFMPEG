<template>
  <span
    :class="['grid shrink-0 place-items-center rounded-full font-semibold text-white', sizes[size]]"
    :style="{ background: `hsl(${hue} 55% 45%)` }"
    aria-hidden="true"
  >
    {{ initial }}
  </span>
</template>

<script setup lang="ts">
/** Avatar chữ cái đầu, màu cố định theo id (chưa có ảnh đại diện). */
const props = withDefaults(defineProps<{ user: { id: string; name: string }; size?: 'xs' | 'sm' | 'md' | 'xl' }>(), { size: 'md' })

const sizes = {
  xs: 'h-7 w-7 text-xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  xl: 'h-20 w-20 text-3xl sm:h-28 sm:w-28 sm:text-4xl',
}
const initial = computed(() => props.user.name.trim().charAt(0).toUpperCase() || '?')
const hue = computed(() => (Number(props.user.id) * 47) % 360)
</script>
