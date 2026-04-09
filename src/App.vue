<script setup>
import { ref, onMounted } from 'vue'
import TimeSheet from './components/Timesheet.vue'
import WorkTodo from './components/WorkTodo.vue'

const timesheetRef = ref(null)
const todayStr = new Date().toLocaleDateString('en-CA')

// ฟังก์ชันส่งงานไปลงปฏิทิน
const handleSendToTimesheet = (todoItem) => {
  if (timesheetRef.value) {
    timesheetRef.value.addExternalTask({
      title: todoItem.title,
      date: todoItem.date,
      description: todoItem.description
    })
  }
}

// ฟังก์ชันส่งรายการ Deadline ไปแสดงจุดบนปฏิทิน
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
      
      <div class="mt-auto pt-6 text-center">
        <p class="text-[10px] font-black text-slate-300 uppercase tracking-widest">© 2026 My Work Schedule</p>
      </div>
    </aside>

    <main class="flex-1 h-screen overflow-y-auto bg-slate-50/50">
      <TimeSheet ref="timesheetRef" />
    </main>

  </div>
</template>