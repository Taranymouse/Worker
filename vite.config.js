import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/My-Work-Schedule/', // ใส่ชื่อ Repository ของคุณที่นี่
})