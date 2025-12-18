
// --- DARK MODE ---

function applyThemeMode(mode) {
    state.activeMode = mode;
    localStorage.setItem('transmi_mode', mode);

    let isDark = false;
    if (mode === 'dark') {
        isDark = true;
    } else if (mode === 'light') {
        isDark = false;
    } else {
        // system
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    const html = document.documentElement;
    if (isDark) {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }
    
    updateModeButtonIcon();
}

function updateModeButtonIcon() {
    const btn = document.getElementById('mode-toggle-btn');
    if(!btn) return;
    
    // Icon Logic
    let iconSvg = '';
    if (state.activeMode === 'light') {
        // Sun icon
        iconSvg = `<svg class="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`;
    } else if (state.activeMode === 'dark') {
        // Moon icon
        iconSvg = `<svg class="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;
    } else {
        // System (Monitor/Computer) icon
        iconSvg = `<svg class="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>`;
    }
    
    btn.innerHTML = iconSvg;
}

function toggleMode() {
    const modes = ['system', 'light', 'dark'];
    const currentIdx = modes.indexOf(state.activeMode);
    const nextIdx = (currentIdx + 1) % modes.length;
    applyThemeMode(modes[nextIdx]);
}

window.toggleMode = toggleMode; // Expose for HTML click if needed, though we add listener
