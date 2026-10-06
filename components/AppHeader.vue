<template>
  <header class="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
    <div class="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
      <AppLogo class="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />

      <nav aria-label="Chính" class="flex items-center gap-1 sm:ml-4">
        <NuxtLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          active-class="!text-fg bg-surface-2"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="ml-auto flex items-center gap-2">
        <NuxtLink to="/upload" class="btn-primary hidden sm:inline-flex">
          <ArrowUpTrayIcon class="h-4 w-4" aria-hidden="true" />
          Tải video lên
        </NuxtLink>

        <button
          type="button"
          class="grid h-11 w-11 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          :aria-label="colorMode.value === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'"
          @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
        >
          <SunIcon v-if="colorMode.value === 'dark'" class="h-5 w-5" aria-hidden="true" />
          <MoonIcon v-else class="h-5 w-5" aria-hidden="true" />
        </button>

        <Menu v-if="user" as="div" class="relative">
          <MenuButton
            class="flex h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors hover:bg-surface-2"
          >
            <span class="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-xs font-semibold uppercase" aria-hidden="true">
              {{ initials }}
            </span>
            <span class="sr-only">Mở menu tài khoản</span>
            <ChevronDownIcon class="hidden h-4 w-4 text-muted sm:block" aria-hidden="true" />
          </MenuButton>
          <transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 scale-95"
            leave-active-class="transition duration-100 ease-in"
            leave-to-class="opacity-0 scale-95"
          >
            <MenuItems
              class="absolute right-0 mt-2 w-60 origin-top-right rounded-xl border border-line bg-surface p-1 shadow-xl focus:outline-none"
            >
              <div class="px-3 py-2">
                <p class="truncate text-sm font-semibold">{{ user.name }}</p>
                <p class="truncate text-xs text-muted">{{ user.email }}</p>
              </div>
              <div class="my-1 h-px bg-line" />
              <MenuItem v-slot="{ active, close }">
                <NuxtLink
                  to="/profile"
                  :class="[active ? 'bg-surface-2' : '', 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm']"
                  @click="close"
                >
                  <UserCircleIcon class="h-4 w-4" aria-hidden="true" />
                  Tài khoản
                  <span v-if="!user.email_verified_at" class="ml-auto h-2 w-2 rounded-full bg-warning" aria-label="Chưa xác thực email" />
                </NuxtLink>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="[active ? 'bg-surface-2' : '', 'flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger']"
                  @click="logout"
                >
                  <ArrowRightStartOnRectangleIcon class="h-4 w-4" aria-hidden="true" />
                  Đăng xuất
                </button>
              </MenuItem>
            </MenuItems>
          </transition>
        </Menu>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import {
  ArrowRightStartOnRectangleIcon,
  ArrowUpTrayIcon,
  ChevronDownIcon,
  MoonIcon,
  SunIcon,
  UserCircleIcon,
} from '@heroicons/vue/24/outline'

const colorMode = useColorMode()
const { user, logout } = useAccount()

const navigation = [
  { to: '/', label: 'Thư viện' },
  { to: '/upload', label: 'Tải lên' },
]

const initials = computed(() =>
  (user.value?.name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join(''),
)
</script>
