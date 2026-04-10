import { AppRouteRecord } from '@/types/router'

export const dataTableRoutes: AppRouteRecord = {
    name:'DataTable',
    path:'/datatable',
    component:'/index/index',
    meta:{
        title:'menus.datatable.title',
        icon:'ri:table-line',
        roles: ['R_SUPER', 'R_ADMIN']
    },
    children:[
        {
            path:'index',
            name:'DataTableIndex',
            component:'/datatable/index',
            meta:{
                title:'menus.datatable.subtitle',
                keepAlive: false
            }
        }
    ]
}