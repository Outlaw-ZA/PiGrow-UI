<!-- src/App.vue -->
<template>
  <div style="font-family: system-ui, sans-serif; min-height: 100vh; background-color: #f8fafc">
    <!-- NAVIGATION BAR HEADER LAYER -->
    <nav
      style="
        background: #ffffff;
        border-bottom: 1px solid #e2e8f0;
        padding: 1rem 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        sticky: top;
        z-index: 100;
      "
    >
      <div style="display: flex; align-items: center; gap: 0.5rem">
        <span style="font-size: 1.5rem">⚙️</span>
        <span style="font-weight: 800; font-size: 1.25rem; color: #0f172a; letter-spacing: -0.025em"
          >PiGrow Control Center</span
        >
      </div>

      <div style="display: flex; gap: 1.5rem">
        <router-link to="/" class="nav-link" active-class="active-link"
          >📊 Live Monitor</router-link
        >
        <router-link to="/admin" class="nav-link" active-class="active-link"
          >🛠️ Administration</router-link
        >
      </div>
    </nav>

    <!-- CONTENT ELEMENT RENDER LAYER -->
    <main style="padding: 2rem; max-w-7xl: mx-auto">
      <router-view />
      <!-- This tag acts as an injector placeholder for our current view page module! -->
    </main>
  </div>
</template>

<style scoped>
.nav-link {
  text-decoration: none;
  color: #64748b;
  font-weight: 600;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  transition: all 0.2s ease;
}
.nav-link:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.active-link {
  color: #10b981 !important;
  background: #ecfdf5;
}
</style>
