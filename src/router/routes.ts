import type { RouteRecordRaw } from "vue-router";

/**
 * Application route table.
 *
 * Heavy views (HomeView with the full dock, DemoView with isolated panels) are
 * lazy-imported so the initial bundle stays under budget. AboutView is small
 * enough to ship eagerly.
 *
 * Routes under `/dev/*` are gated behind `import.meta.env.DEV` and never ship
 * in production builds — they're reference pages for individual UI primitives.
 */
const devRoutes: RouteRecordRaw[] = import.meta.env.DEV
  ? [
      {
        path: "/dev/datatable",
        name: "dev-datatable",
        component: () => import("@/views/dev/DataTableDemoView.vue"),
        meta: { title: "DataTable demo" },
      },
    ]
  : [];

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: () => import("@/views/HomeView.vue"),
    meta: { title: "CommandVue" },
  },
  {
    path: "/demo",
    name: "demo",
    component: () => import("@/views/DemoView.vue"),
    meta: { title: "Demo" },
  },
  {
    path: "/about",
    name: "about",
    component: () => import("@/views/AboutView.vue"),
    meta: { title: "About" },
  },
  ...devRoutes,
  {
    path: "/:pathMatch(.*)*",
    redirect: { name: "home" },
  },
];
