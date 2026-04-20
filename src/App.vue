<script setup>
import { ref } from 'vue'
import TimeSheet from './components/Timesheet.vue'
import WorkTodo from './components/WorkTodo.vue'

// สร้าง Reference เพื่อเข้าถึงฟังก์ชันภายใน Timesheet.vue
const timesheetRef = ref(null)
const todayStr = new Date().toLocaleDateString('en-CA')

// ฟังก์ชันเมื่อกดปุ่ม "ส่งไปปฏิทิน" ใน WorkTodo
const handleSendToTimesheet = async (todoItem) => {
  if (timesheetRef.value) {
    // เรียกใช้ฟังก์ชัน addExternalTask ที่เรา defineExpose ไว้ใน Timesheet
    await timesheetRef.value.addExternalTask({
      title: todoItem.title,
      date: todoItem.deadline || todayStr, // ถ้าไม่มี Deadline ให้ใช้วันนี้
      description: todoItem.description || ''
    })
  }
}

// ฟังก์ชันแสดงจุด Deadline สีแดงบนปฏิทินแบบ Real-time
const handleListUpdated = (newList) => {
  if (timesheetRef.value) {
    timesheetRef.value.updateDeadlines(newList)
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#f8fafc] font-sans text-slate-900 antialiased flex flex-col lg:flex-row">
    
    <aside class="w-full lg:w-96 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-6 flex flex-col shrink-0 h-screen overflow-y-auto sticky top-0">
      <div class="mb-8 px-2">
        <h1 class="text-4xl font-black text-slate-800 tracking-tighter leading-none italic">
          WORKER<span class="text-blue-600">.</span>
        </h1>
        <p class="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-3">Planner & Productivity</p>
      </div>

      <WorkTodo 
        :todayStr="todayStr" 
        @sendToTimesheet="handleSendToTimesheet"
        @listUpdated="handleListUpdated"
      />
    </aside>

    <main class="flex-1 h-screen overflow-y-auto bg-slate-50/50 p-4 lg:p-10">
      <TimeSheet ref="timesheetRef" />
    </main>

  </div>
</template>