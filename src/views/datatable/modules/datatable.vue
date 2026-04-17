<template>
  <div class="py-5">
    <h1 class="page-title">报表</h1>
    
    <!-- 表格头部区域，包含搜索和筛选功能 -->
    <el-card class="mb-4">
      <el-form :inline="true" :model="formFilters" class="demo-form-inline">
        <el-form-item label="姓名">
          <el-input
            v-model="formFilters.name"
            placeholder="请输入姓名"
            clearable
            @input="handleFilterChange"
          />
        </el-form-item>
        <el-form-item label="性别">
          <el-select
            v-model="formFilters.gender"
            placeholder="请选择性别"
            clearable
            @change="handleFilterChange"
          >
            <el-option label="男" value="男"></el-option>
            <el-option label="女" value="女"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="年龄">
          <el-input
            v-model="formFilters.age"
            placeholder="请输入年龄"
            type="number"
            clearable
            @input="handleFilterChange"
          />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input
            v-model="formFilters.phone"
            placeholder="请输入手机号"
            clearable
            @input="handleFilterChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleFilterChange">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    
    <!-- 表格主体 -->
    <el-card>
      <ArtTable
        :columns="tableColumns"
        :data="filteredTableData"
        :loading="loading"
        :row-key="'id'"
        :border="true"
        :stripe="true"
        height="500px"
      />
      
      <!-- 分页 -->
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="filteredTableData.length"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
        class="mt-4"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import ArtTable from '@/components/core/tables/art-table/index.vue'
import { ElMessage } from 'element-plus'

// 定义组件选项
defineOptions({ name: 'DataTable' })

// 表格列定义
const tableColumns = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'age', label: '年龄', width: 80 },
  { prop: 'gender', label: '性别', width: 80 },
  { prop: 'phone', label: '手机号', width: 150 },
  { prop: 'email', label: '邮箱', width: 200 },
  { prop: 'address', label: '地址', minWidth: 200 },
  { prop: 'remark', label: '备注', minWidth: 150 }
]

// 原始数据
const originalData = ref([
  {
    id: 1,
    name: "张三",
    age: 25,
    gender: "男",
    phone: "13800000000",
    email: "zhangsan@example.com",
    address: "北京市海淀区",
    remark: "这是一个备注",
  },
  {
    id: 2,
    name: "李四",
    age: 30,
    gender: "女",
    phone: "13900000000",
    email: "lisi@example.com",
    address: "北京市朝阳区",
    remark: "这是一个备注",
  },
  {
    id: 3,
    name: "王五",
    age: 35,
    gender: "男",
    phone: "13800000001",
    email: "wangwu@example.com",
    address: "上海市浦东新区",
    remark: "这是一个备注",
  },
  {
    id: 4,
    name: "赵六",
    age: 40,
    gender: "女",
    phone: "13900000001",
    email: "zhaoliu@example.com",
    address: "广州市天河区",
    remark: "这是一个备注",
  },
  {
    id: 5,
    name: "王二",
    age: 45,
    gender: "男",
    phone: "13800000002",
    email: "wanger@example.com",
    address: "深圳市南山区",
    remark: "这是一个备注",
  },
  {
    id: 6,
    name: "陈七",
    age: 28,
    gender: "女",
    phone: "13900000002",
    email: "chenqi@example.com",
    address: "杭州市西湖区",
    remark: "这是一个备注",
  },
  {
    id: 7,
    name: "刘八",
    age: 32,
    gender: "男",
    phone: "13800000003",
    email: "liuba@example.com",
    address: "成都市锦江区",
    remark: "这是一个备注",
  },
  {
    id: 8,
    name: "周九",
    age: 38,
    gender: "女",
    phone: "13900000003",
    email: "zhoujiu@example.com",
    address: "西安市雁塔区",
    remark: "这是一个备注",
  },
])

// 筛选条件
const formFilters = reactive({
  name: '',
  gender: '',
  age: '',
  phone: ''
})

// 分页参数
const currentPage = ref(1)
const pageSize = ref(10)
const loading = ref(false)

// 计算过滤后的数据
const filteredTableData = computed(() => {
  let result = originalData.value
  
  // 根据筛选条件过滤数据
  if (formFilters.name) {
    result = result.filter(item => 
      item.name.toLowerCase().includes(formFilters.name.toLowerCase())
    )
  }
  
  if (formFilters.gender) {
    result = result.filter(item => item.gender === formFilters.gender)
  }
  
  if (formFilters.age) {
    result = result.filter(item => item.age.toString() === formFilters.age)
  }
  
  if (formFilters.phone) {
    result = result.filter(item => 
      item.phone.includes(formFilters.phone)
    )
  }
  
  // 计算当前页的数据
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return result.slice(start, end)
})

// 处理筛选条件变化
const handleFilterChange = () => {
  currentPage.value = 1 // 重置到第一页
}

// 重置筛选条件
const resetFilters = () => {
  formFilters.name = ''
  formFilters.gender = ''
  formFilters.age = ''
  formFilters.phone = ''
  currentPage.value = 1
  ElMessage.success('筛选条件已重置')
}

// 处理分页大小变化
const handleSizeChange = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
}

// 处理当前页变化
const handleCurrentChange = (page: number) => {
  currentPage.value = page
}
</script>

<style scoped>
.page-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  padding-left: 10px;
}

.mb-4 {
  margin-bottom: 1rem;
}

.mt-4 {
  margin-top: 1rem;
}

.demo-form-inline .el-input {
  width: 200px;
}
</style>