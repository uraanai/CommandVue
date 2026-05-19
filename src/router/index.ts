import { createRouter, createWebHistory } from 'vue-router'

import { routes } from './routes'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

router.afterEach((to) => {
  if (typeof document !== 'undefined') {
    const title = typeof to.meta.title === 'string' ? to.meta.title : 'CommandVue'
    document.title = title === 'CommandVue' ? title : `${title} · CommandVue`
  }
})
