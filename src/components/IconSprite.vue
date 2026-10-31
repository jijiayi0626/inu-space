<template>
<svg aria-hidden="true" class="icon-sprite" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">
  <defs>
    <symbol id="i-orbit" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
        <circle cx="12" cy="12" r="3.2"/>
        <ellipse cx="12" cy="12" rx="9.5" ry="4.2" transform="rotate(-24 12 12)"/>
      </g>
      <circle cx="18.6" cy="7.8" r="1.3" fill="currentColor"/>
    </symbol>
    <symbol id="i-grid" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round">
        <rect x="3.5" y="3.5" width="7.2" height="7.2" rx="2"/>
        <rect x="13.3" y="3.5" width="7.2" height="7.2" rx="2"/>
        <rect x="3.5" y="13.3" width="7.2" height="7.2" rx="2"/>
        <rect x="13.3" y="13.3" width="7.2" height="7.2" rx="2"/>
      </g>
    </symbol>
    <symbol id="i-user" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="8.2" r="3.6"/>
        <path d="M4.8 20.2c.8-3.5 3.7-5.4 7.2-5.4s6.4 1.9 7.2 5.4"/>
      </g>
    </symbol>
    <symbol id="i-shield" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3.2l7 2.6v5.4c0 4.6-3 7.7-7 9.6-4-1.9-7-5-7-9.6V5.8l7-2.6z"/>
        <path d="M9.2 11.8l2 2 3.6-4"/>
      </g>
    </symbol>
    <symbol id="i-device" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4.6" width="18" height="12.2" rx="2.2"/>
        <path d="M9 20.4h6M12 16.8v3.6"/>
      </g>
    </symbol>
    <symbol id="i-bell" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18.4 9.8a6.4 6.4 0 1 0-12.8 0c0 2.8-.9 4.9-1.8 6.2h16.4c-.9-1.3-1.8-3.4-1.8-6.2z"/>
        <path d="M9.8 19.4a2.4 2.4 0 0 0 4.4 0"/>
      </g>
    </symbol>
    <symbol id="i-box" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3.6 7.6L12 3.4l8.4 4.2v8.8L12 20.6l-8.4-4.2V7.6z"/>
        <path d="M3.6 7.6L12 11.8l8.4-4.2M12 11.8v8.8M7.8 5.5l8.4 4.2"/>
      </g>
    </symbol>
    <symbol id="i-file" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 3.5h7.4L19 9v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1-1.5z"/>
        <path d="M13.2 3.8v5.4H19M8.8 13h6.4M8.8 16.6h4.4"/>
      </g>
    </symbol>
    <symbol id="i-moon" viewBox="0 0 24 24">
      <path d="M20 14.4A8.4 8.4 0 0 1 9.6 4a8.4 8.4 0 1 0 10.4 10.4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </symbol>
    <symbol id="i-sun" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
        <circle cx="12" cy="12" r="4.2"/>
        <path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5"/>
      </g>
    </symbol>
    <symbol id="i-menu" viewBox="0 0 24 24">
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </symbol>
    <symbol id="i-spark" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3.6l1.8 5.1 5.1 1.8-5.1 1.8-1.8 5.1-1.8-5.1L5.1 10.5l5.1-1.8L12 3.6z"/>
        <path d="M19 16.6l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z"/>
      </g>
    </symbol>
    <symbol id="i-star" viewBox="0 0 24 24">
      <path d="M12 3.4l2.5 5.1 5.6.8-4 3.9.9 5.5-5-2.6-5 2.6.9-5.5-4-3.9 5.6-.8L12 3.4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
    </symbol>
    <symbol id="i-chevron" viewBox="0 0 24 24">
      <path d="M9 5.5l6.5 6.5L9 18.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </symbol>
    <symbol id="i-check" viewBox="0 0 24 24">
      <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </symbol>
    <symbol id="i-x" viewBox="0 0 24 24">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </symbol>
    <symbol id="i-pen" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 20l1-4L16.6 4.4a2.2 2.2 0 0 1 3.1 3.1L8 19l-4 1z"/>
        <path d="M14.8 6.2l3 3"/>
      </g>
    </symbol>
    <symbol id="i-lock" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4.6" y="10.2" width="14.8" height="10.4" rx="2.4"/>
        <path d="M8.2 10.2V7.6a3.8 3.8 0 0 1 7.6 0v2.6"/>
        <circle cx="12" cy="15.2" r="1.4"/>
      </g>
    </symbol>
    <symbol id="i-laptop" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4.4" y="5.4" width="15.2" height="10" rx="1.8"/>
        <path d="M2.8 19h18.4"/>
      </g>
    </symbol>
    <symbol id="i-phone" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="7" y="3" width="10" height="18" rx="2.6"/>
        <path d="M10.8 18.2h2.4"/>
      </g>
    </symbol>
    <symbol id="i-tablet" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4.6" y="3.4" width="14.8" height="17.2" rx="2.4"/>
        <path d="M10.8 17.8h2.4"/>
      </g>
    </symbol>
    <symbol id="i-idcard" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2.4"/>
        <circle cx="8.6" cy="10.6" r="1.8"/>
        <path d="M5.8 15.8c.5-1.5 1.6-2.2 2.8-2.2s2.3.7 2.8 2.2M14.2 9.6h4M14.2 12.8h4M14.2 16h2.6"/>
      </g>
    </symbol>
    <symbol id="i-clock" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="8.4"/>
        <path d="M12 7.6V12l3 2"/>
      </g>
    </symbol>
  
    <symbol id="i-plus" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </symbol>
    <symbol id="i-mail" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2.4"/>
        <path d="M3.8 6.2L12 12.6l8.2-6.4"/>
      </g>
    </symbol>
    <symbol id="i-message" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.4 11.6a8.4 8.4 0 0 1-12.3 7.5L3.6 20.4l1.3-4.3a8.4 8.4 0 1 1 15.5-4.5z"/>
        <path d="M8.4 11.8h.01M12 11.8h.01M15.6 11.8h.01"/>
      </g>
    </symbol>
    <symbol id="i-globe" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="8.6"/>
        <path d="M3.4 12h17.2M12 3.4c2.4 2.3 3.6 5.2 3.6 8.6s-1.2 6.3-3.6 8.6c-2.4-2.3-3.6-5.2-3.6-8.6s1.2-6.3 3.6-8.6z"/>
      </g>
    </symbol>
    <symbol id="i-map" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 21s-6.6-5.4-6.6-10.2A6.6 6.6 0 0 1 12 4.2a6.6 6.6 0 0 1 6.6 6.6C18.6 15.6 12 21 12 21z"/>
        <circle cx="12" cy="10.6" r="2.3"/>
      </g>
    </symbol>

    <symbol id="i-eye" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2.4 12S5.9 5.8 12 5.8 21.6 12 21.6 12 18.1 18.2 12 18.2 2.4 12 2.4 12z"/>
        <circle cx="12" cy="12" r="3.1"/>
      </g>
    </symbol>
    <symbol id="i-eye-off" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6.1 0 9.6 6 9.6 6a17.8 17.8 0 0 1-3 3.7M6.4 7.2C3.9 9 2.4 12 2.4 12S5.9 18 12 18c1.8 0 3.3-.5 4.6-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2"/>
      </g>
    </symbol>
    <symbol id="i-github" viewBox="0 0 24 24">
      <path fill="currentColor" d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z"/>
    </symbol>
    <symbol id="i-google" viewBox="0 0 24 24">
      <path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.19-1.79 4.13-1.15 1.15-2.93 2.4-6.05 2.4-4.83 0-8.6-3.89-8.6-8.72s3.77-8.72 8.6-8.72c2.6 0 4.51 1.03 5.91 2.35l2.31-2.31C18.75 1.44 16.13 0 12.48 0 5.87 0 .31 5.39.31 12s5.56 12 12.17 12c3.57 0 6.27-1.17 8.37-3.36 2.16-2.16 2.84-5.21 2.84-7.67 0-.76-.05-1.47-.17-2.05H12.48z"/>
    </symbol>
  </defs>
</svg>
</template>
