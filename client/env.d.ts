/// <reference types="vite/client" />

// 支持在 TS 中直接导入 .vue 文件
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}