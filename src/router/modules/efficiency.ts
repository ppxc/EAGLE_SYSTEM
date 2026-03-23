import { AppRouteRecord } from '@/types/router'

export const efficiencyRoutes: AppRouteRecord = {
  name: 'Efficiency',
  path: '/efficiency',
  component: '/index/index',
  meta: {
    title: 'menus.efficiency.title',
    icon: 'ri:time-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    {
      path: 'index',
      name: 'EfficiencyIndex',
      component: '/dashboard/console',
      meta: {
        title: 'menus.efficiency.title',
        keepAlive: false
      }
    }
  ]
}