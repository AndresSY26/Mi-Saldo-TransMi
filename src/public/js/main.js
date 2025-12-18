import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, collection, serverTimestamp, writeBatch, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN ---
// IMPORTANTE: REEMPLAZA ESTO CON TU CONFIG REAL
const firebaseConfig = {
    apiKey: "AIzaSyCxs_nPcuB1-BlVqzLfxhnd2OrxN0uPJZU",
    authDomain: "mi-saldo-transmi.firebaseapp.com",
    projectId: "mi-saldo-transmi",
    storageBucket: "mi-saldo-transmi.firebasestorage.app",
    messagingSenderId: "521513048272",
    appId: "1:521513048272:web:4661fd387a8194ddc626d5"
};

const PRECIO_PASAJE_2025 = 3200;
const appId = 'transmi-app-v1'; // Identificador para la ruta de firestore

const THEMES = {
    verde: {
        name: 'verde',
        label: 'Clásico',
        gradientCard: 'from-[#009c3b] to-[#004d26]',
        accentColor: 'text-emerald-600',
        ringColor: 'focus:outline-none focus:ring-0',
        buttonGradient: 'from-emerald-600 to-emerald-700',
        textColor: 'text-emerald-800',
        bgIcon: 'bg-emerald-50',
        selection: 'selection:bg-emerald-200',
        shadow: 'shadow-emerald-500/40',
        svgStop1: '#009c3b',
        svgStop2: '#004d26',
        inputBorder: 'focus:border-emerald-600',
        inputLabel: 'peer-focus:text-emerald-600'
    },
    cielo: {
        name: 'cielo',
        label: 'Cielo',
        gradientCard: 'from-cyan-500 to-blue-800',
        accentColor: 'text-blue-600',
        ringColor: 'focus:outline-none focus:ring-0',
        buttonGradient: 'from-cyan-500 to-blue-600',
        textColor: 'text-blue-800',
        bgIcon: 'bg-blue-50',
        selection: 'selection:bg-blue-200',
        shadow: 'shadow-blue-500/40',
        svgStop1: '#06b6d4',
        svgStop2: '#1e40af',
        inputBorder: 'focus:border-blue-600',
        inputLabel: 'peer-focus:text-blue-600'
    },
    neon: {
        name: 'neon',
        label: 'Neón',
        gradientCard: 'from-fuchsia-500 via-purple-600 to-indigo-900',
        accentColor: 'text-fuchsia-600',
        ringColor: 'focus:outline-none focus:ring-0',
        buttonGradient: 'from-fuchsia-500 to-indigo-600',
        textColor: 'text-purple-900',
        bgIcon: 'bg-purple-50',
        selection: 'selection:bg-purple-200',
        shadow: 'shadow-purple-500/40',
        svgStop1: '#d946ef',
        svgStop2: '#312e81',
        inputBorder: 'focus:border-fuchsia-600',
        inputLabel: 'peer-focus:text-fuchsia-600'
    }
};

// --- ESTADO GLOBAL ---
const state = {
    currentUser: null,
    userId: '', // Local alias
    activeTheme: 'verde',
    activeMode: 'system', // 'light' | 'dark' | 'system'
    saldo: 0,
    viajesDiarios: 2,
    historial: [],
    plannerDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0], // Last day of month
    rotation: { x: 0, y: 0 }
};

let app, auth, db;
let unsubscribeConfig = null;
let unsubscribeHistory = null;
let systemDarkModeListener = null;

// --- INICIALIZACIÓN ---
async function init() {
    // 1. Cargar config local
    const savedId = localStorage.getItem('transmi_user_id');
    const savedTheme = localStorage.getItem('transmi_theme');
    const savedMode = localStorage.getItem('transmi_mode');
    
    if (savedTheme && THEMES[savedTheme]) {
        applyTheme(savedTheme);
    } else {
        applyTheme('verde');
    }

    if (savedMode && ['light', 'dark', 'system'].includes(savedMode)) {
        applyThemeMode(savedMode);
    } else {
        applyThemeMode('system');
    }

    // System changes listener
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemDarkModeListener = (e) => {
        if (state.activeMode === 'system') {
            applyThemeMode('system'); // Re-evaluate
        }
    };
    mediaQuery.addEventListener('change', systemDarkModeListener);

    if (savedId) {
        state.userId = savedId;
        showApp();
    } else {
        showLogin();
    }

    // 2. Inicializar Firebase
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        
        // Auth listener
        onAuthStateChanged(auth, (user) => {
            state.currentUser = user;
            if (user && state.userId) {
                subscribeToData();
            }
        });

        // Login anónimo
        await signInAnonymously(auth);

    } catch (e) {
        console.error("Error inicializando Firebase:", e);
        showToast("Error de conexión (Configura firebaseConfig en main.js)", "error");
    }

    // 3. Setup Listeners UI
    setupEventListeners();
    
    // 4. Render inicial
    updatePlanner();
    renderDOM();
}

function setupEventListeners() {
    // Login
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('userIdInput').value.trim();
        if (input.length > 2) {
            const cleanId = input.toLowerCase().replace(/\s+/g, '-');
            state.userId = cleanId;
            localStorage.setItem('transmi_user_id', cleanId);
            showApp();
            if (state.currentUser) subscribeToData();
        } else {
            showToast('Ingresa un nombre válido', 'error');
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        if(confirm('¿Salir?')) {
            localStorage.removeItem('transmi_user_id');
            state.userId = '';
            if (unsubscribeConfig) unsubscribeConfig();
            if (unsubscribeHistory) unsubscribeHistory();
            state.saldo = 0;
            state.historial = [];
            showLogin();
        }
    });

    // Tabs
    document.getElementById('btn-tab-saldo').addEventListener('click', () => switchTab('saldo'));
    document.getElementById('btn-tab-planner').addEventListener('click', () => switchTab('planner'));

    // Viajes Logic
    document.getElementById('btn-inc-viajes').addEventListener('click', () => updateViajes(state.viajesDiarios + 1));
    document.getElementById('btn-dec-viajes').addEventListener('click', () => updateViajes(state.viajesDiarios - 1));
    
    // Planner Logic
    document.getElementById('planner-date-input').addEventListener('change', (e) => {
        state.plannerDate = e.target.value;
        updatePlanner();
    });
    document.getElementById('btn-planner-inc').addEventListener('click', () => updateViajes(state.viajesDiarios + 1));
    document.getElementById('btn-planner-dec').addEventListener('click', () => updateViajes(state.viajesDiarios - 1));

    // Actions
    document.getElementById('btn-action-day').addEventListener('click', registrarDiaCompleto);
    document.getElementById('btn-action-single').addEventListener('click', registrarPasaje);
    document.getElementById('btn-action-recharge').addEventListener('click', actualizarSaldo);
    document.getElementById('btn-clear-history').addEventListener('click', limpiarTodo);

    // Theme Menu
    const themeBtn = document.getElementById('theme-menu-btn');
    const themeMenu = document.getElementById('theme-menu');
    themeBtn.addEventListener('click', () => themeMenu.classList.toggle('hidden'));

    // Mode Toggle
    const modeBtn = document.getElementById('mode-toggle-btn');
    if(modeBtn) {
        modeBtn.addEventListener('click', toggleMode);
    }
    
    // Build Theme Menu
    Object.values(THEMES).forEach(t => {
        const div = document.createElement('div');
        div.className = "flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors";
        div.innerHTML = `<div class="w-5 h-5 rounded-full bg-gradient-to-tr shadow-sm ${t.gradientCard}"></div><span class="text-sm font-medium text-gray-700 dark:text-gray-200">${t.label}</span>`;
        div.onclick = () => {
            applyTheme(t.name);
            localStorage.setItem('transmi_theme', t.name);
            themeMenu.classList.add('hidden');
        };
        themeMenu.appendChild(div);
    });

    // 3D Tilt
    const cardContainer = document.getElementById('card-container');
    const cardElement = document.getElementById('card-element');
    
    cardContainer.addEventListener('mousemove', (e) => handleTilt(e, cardContainer));
    cardContainer.addEventListener('mouseleave', () => resetTilt());
    cardContainer.addEventListener('touchmove', (e) => handleTilt(e, cardContainer));
    cardContainer.addEventListener('touchend', () => resetTilt());
}

// --- LOGICA DE VISTAS ---

function showLogin() {
    document.getElementById('login-overlay').classList.remove('hidden');
    document.getElementById('main-interface').classList.add('hidden');
}

function showApp() {
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('main-interface').classList.remove('hidden');
    document.getElementById('card-user').textContent = state.userId;
    renderDOM();
}

function switchTab(tab) {
    const slider = document.getElementById('tab-slider');
    const contentSaldo = document.getElementById('tab-content-saldo');
    const contentPlanner = document.getElementById('tab-content-planner');
    
    if (tab === 'saldo') {
        slider.style.left = '1.5%';
        contentSaldo.classList.remove('hidden');
        contentPlanner.classList.add('hidden');
        document.getElementById('btn-tab-saldo').className = "flex-1 relative z-10 py-2.5 text-sm font-bold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-gray-900";
        document.getElementById('btn-tab-planner').className = "flex-1 relative z-10 py-2.5 text-sm font-bold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-gray-400 hover:text-gray-600";
    } else {
        slider.style.left = '50.5%';
        contentSaldo.classList.add('hidden');
        contentPlanner.classList.remove('hidden');
        document.getElementById('btn-tab-planner').className = "flex-1 relative z-10 py-2.5 text-sm font-bold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-gray-900";
        document.getElementById('btn-tab-saldo').className = "flex-1 relative z-10 py-2.5 text-sm font-bold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-gray-400 hover:text-gray-600";
        updatePlanner(); // refresh calculation
    }
}

// --- LOGICA DE NEGOCIO ---

function subscribeToData() {
    if (!state.userId) return;
    
    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'transmi_users', state.userId);
    const historyColRef = collection(db, 'artifacts', appId, 'public', 'data', `transmi_history_${state.userId}`);
    const qHistory = query(historyColRef, orderBy('fecha', 'desc'));

    unsubscribeConfig = onSnapshot(userDocRef, (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            state.saldo = data.saldo || 0;
            state.viajesDiarios = data.viajesDiarios || 2;
        } else {
            setDoc(userDocRef, { saldo: 0, viajesDiarios: 2 });
        }
        renderDOM();
        updatePlanner();
    });

    unsubscribeHistory = onSnapshot(qHistory, (snap) => {
        const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        state.historial = txs;
        renderHistory();
    });
}

function renderDOM() {
    // Saldo
    const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    const saldoFmt = fmt.format(state.saldo);
    
    document.getElementById('card-balance').textContent = saldoFmt;
    document.getElementById('label-viajes').textContent = state.viajesDiarios;
    document.getElementById('label-planner-viajes').textContent = state.viajesDiarios;
    
    // Proyección
    const gastoDiario = state.viajesDiarios * PRECIO_PASAJE_2025;
    const dias = state.saldo > 0 ? Math.floor(state.saldo / gastoDiario) : 0;
    const date = new Date();
    date.setDate(date.getDate() + dias);
    const fechaFin = state.saldo <= 0 ? 'Hoy' : date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
    
    document.getElementById('projection-date').textContent = fechaFin;
    document.getElementById('projection-days').textContent = `${dias} días restantes`;
    document.getElementById('projection-days').className = `text-[11px] font-medium block mt-0.5 ${dias < 3 ? 'text-red-500' : 'text-gray-400'}`;
    
    // Icono proyeccion color check
    const projIcon = document.getElementById('projection-icon-bg');
    const theme = THEMES[state.activeTheme];
    if (dias < 3) {
        projIcon.className = "w-12 h-12 flex items-center justify-center rounded-full transition-colors shrink-0 bg-red-50 text-red-600";
    } else {
        // Restaurar tema
        projIcon.className = `w-12 h-12 flex items-center justify-center rounded-full transition-colors shrink-0 ${theme.bgIcon} ${theme.accentColor}`;
    }

    // Costo Dia
    document.getElementById('label-cost-day').textContent = `-${fmt.format(gastoDiario)}`;
}

function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    const template = document.getElementById('history-item-template');
    const theme = THEMES[state.activeTheme];
    const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

    if (state.historial.length === 0) {
        list.innerHTML = `<div class="text-center py-10 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700"><p class="text-gray-400 dark:text-gray-500 text-xs font-medium">Sin movimientos aún</p></div>`;
        return;
    }

    state.historial.forEach(item => {
        const clone = template.content.cloneNode(true);
        const isGasto = item.tipo === 'gasto';
        
        const iconContainer = clone.querySelector('.icon-container');
        if (isGasto) {
            iconContainer.className = `icon-container w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm bg-red-50 text-red-500`;
            iconContainer.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>`;
        } else {
            iconContainer.className = `icon-container w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm ${theme.bgIcon} ${theme.accentColor}`;
            iconContainer.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`;
        }

        clone.querySelector('.item-desc').textContent = item.description || (isGasto ? 'Pasaje SITP/TM' : 'Recarga');
        
        let dateStr = '...';
        if (item.fecha && item.fecha.seconds) {
            dateStr = new Date(item.fecha.seconds * 1000).toLocaleDateString('es-CO', {day: 'numeric', month: 'short', hour:'2-digit', minute:'2-digit'});
        }
        clone.querySelector('.item-date').textContent = dateStr;
        
        const amountEl = clone.querySelector('.item-amount');
        amountEl.textContent = `${isGasto ? '-' : '+'}${fmt.format(Math.abs(item.monto))}`;
        amountEl.className = `item-amount font-mono font-bold text-sm ${isGasto ? 'text-gray-800' : theme.accentColor}`;

        list.appendChild(clone);
    });
}

function updatePlanner() {
    const plannerContainer = document.getElementById('planner-results');
    const dateStr = state.plannerDate;
    if (!dateStr) return;
    
    // Set input value manually if not triggered by event
    document.getElementById('planner-date-input').value = state.plannerDate;

    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffTime = target.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
        plannerContainer.innerHTML = `<div class="text-center py-12"><p class="text-gray-400">Fecha inválida</p></div>`;
        return;
    }

    const totalCost = daysRemaining * state.viajesDiarios * PRECIO_PASAJE_2025;
    const balanceDiff = state.saldo - totalCost;
    const status = balanceDiff >= 0 ? 'covered' : 'shortage';
    const theme = THEMES[state.activeTheme];
    const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

    let html = `
    <div class="relative overflow-hidden rounded-3xl p-6 text-white shadow-lg transition-colors duration-500 ${status === 'shortage' ? 'bg-gray-800' : 'bg-gradient-to-br ' + theme.gradientCard}">
         <div class="relative z-10">
            <div class="flex justify-between items-start mb-2">
              <p class="text-[10px] font-bold uppercase tracking-widest opacity-70">Análisis</p>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${status === 'shortage' ? 'bg-red-500/20 text-red-200' : 'bg-white/20 text-white'}">
                ${status === 'shortage' ? 'Déficit' : 'Superávit'}
              </span>
            </div>
            <h3 class="text-3xl font-bold mb-1">${status === 'shortage' ? 'Te falta saldo' : '¡Estás cubierto!'}</h3>
    `;

    if (status === 'shortage') {
        const percent = Math.min(100, (state.saldo / totalCost) * 100);
        html += `
            <div class="mt-6 bg-white/10 rounded-xl p-4 backdrop-blur-md border border-white/10">
                <div class="flex justify-between items-center mb-1">
                   <span class="text-xs opacity-70 font-medium">Recarga Sugerida</span>
                   <span class="font-mono font-bold text-xl text-red-300">${fmt.format(Math.abs(balanceDiff))}</span>
                </div>
                <div class="w-full bg-black/30 h-1.5 rounded-full overflow-hidden mt-3">
                   <div class="h-full bg-red-500 transition-all duration-1000" style="width: ${percent}%"></div>
                </div>
                <p class="text-[10px] text-right mt-1.5 opacity-60 font-mono">${percent.toFixed(0)}% cubierto</p>
            </div>
        `;
    } else {
        html += `
            <div class="mt-4">
                <p class="text-sm opacity-90 mb-4 font-medium">Tu saldo cubre perfectamente tus viajes.</p>
                <div class="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg backdrop-blur-md border border-white/20">
                   <span class="text-xs font-bold">Te sobrarán:</span>
                   <span class="font-mono font-bold">${fmt.format(Math.abs(balanceDiff))}</span>
                </div>
            </div>
        `;
    }

    html += `</div></div>`; // Close main card

    // Stats Grid
    html += `
        <div class="grid grid-cols-2 gap-4">
           <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center">
              <p class="text-[10px] text-gray-400 dark:text-gray-400 uppercase font-bold tracking-wider mb-1">Costo Total</p>
              <p class="text-lg font-bold text-gray-800 dark:text-white">${fmt.format(totalCost)}</p>
              <p class="text-[10px] text-gray-400 dark:text-gray-400">${daysRemaining} días</p>
           </div>
           <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center">
              <p class="text-[10px] text-gray-400 dark:text-gray-400 uppercase font-bold tracking-wider mb-1">Saldo Actual</p>
              <p class="text-lg font-bold ${theme.accentColor}">${fmt.format(state.saldo)}</p>
           </div>
        </div>
    `;

    plannerContainer.innerHTML = html;
}

// --- TRANSACCIONES ---

async function actualizarSaldo() {
    const input = document.getElementById('input-recharge');
    const val = parseInt(input.value);
    if (isNaN(val) || val <= 0) return;
    
    await saveTransaction('recarga', val);
    input.value = '';
    showToast('Saldo actualizado', 'success');
}

async function registrarPasaje() {
    if (state.saldo < PRECIO_PASAJE_2025) {
        showToast('Saldo insuficiente', 'error');
        return;
    }
    await saveTransaction('gasto', -PRECIO_PASAJE_2025);
    showToast('Pasaje registrado', 'success');
}

async function registrarDiaCompleto() {
    const costo = state.viajesDiarios * PRECIO_PASAJE_2025;
    if (state.saldo < costo) {
        showToast('Saldo insuficiente', 'error');
        return;
    }
    await saveTransaction('gasto', -costo, `Día Completo (${state.viajesDiarios} pasajes)`);
    showToast('Día completo registrado', 'success');
}

async function updateViajes(val) {
    if (val < 1) return;
    state.viajesDiarios = val;
    // Optimistic UI
    renderDOM();
    updatePlanner();
    
    if (state.userId) {
        const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'transmi_users', state.userId);
        await setDoc(userDocRef, { viajesDiarios: val }, { merge: true });
    }
}

async function saveTransaction(tipo, monto, description = null) {
    if (!db || !state.userId) return;
    
    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'transmi_users', state.userId);
    const historyColRef = collection(db, 'artifacts', appId, 'public', 'data', `transmi_history_${state.userId}`);

    const nuevoSaldo = state.saldo + monto;
    
    const batch = writeBatch(db);
    batch.set(userDocRef, { saldo: nuevoSaldo }, { merge: true });
    
    const newTxRef = doc(historyColRef);
    batch.set(newTxRef, {
        tipo,
        monto,
        fecha: serverTimestamp(),
        saldoResultante: nuevoSaldo,
        description
    });

    await batch.commit();
}

async function limpiarTodo() {
    if (!confirm('¿Borrar historial y reiniciar saldo a $0?')) return;
    state.saldo = 0;
    
    if (db && state.userId) {
        const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'transmi_users', state.userId);
        await setDoc(userDocRef, { saldo: 0, viajesDiarios: 2 });
        
        const historyColRef = collection(db, 'artifacts', appId, 'public', 'data', `transmi_history_${state.userId}`);
        const snap = await getDocs(historyColRef);
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
    showToast('Historial eliminado', 'success');
}

// --- THEME ---

function applyTheme(name) {
    const oldTheme = THEMES[state.activeTheme];
    const newTheme = THEMES[name];
    state.activeTheme = name;
    
    const elements = document.querySelectorAll('[data-theme-key]');
    
    elements.forEach(el => {
        const key = el.dataset.themeKey;
        if (oldTheme[key]) {
            // Remove old classes (might be multiple separated by spaces)
            const oldClasses = oldTheme[key].split(' ');
            el.classList.remove(...oldClasses);
        }
        if (newTheme[key]) {
            const newClasses = newTheme[key].split(' ');
            el.classList.add(...newClasses);
        }
    });

    // Handle SVG Gradients manually
    const stop1 = document.getElementById('stop1');
    const stop2 = document.getElementById('stop2');
    if (stop1 && stop2) {
        stop1.setAttribute('stop-color', newTheme.svgStop1);
        stop2.setAttribute('stop-color', newTheme.svgStop2);
    }
    
    // Theme indicator
    const ind = document.getElementById('theme-indicator');
    if(ind && oldTheme.gradientCard) {
        ind.classList.remove(...oldTheme.gradientCard.split(' '));
        ind.classList.add(...newTheme.gradientCard.split(' '));
    }

    // Re-render history and planner to apply theme to dynamic content
    renderHistory();
    updatePlanner();
    renderDOM(); // For icon checks
}

// --- UTILS ---

function showToast(text, type) {
    const container = document.getElementById('toast-container');
    const div = document.createElement('div');
    const theme = THEMES[state.activeTheme];
    
    const bgClass = type === 'error' ? 'bg-red-500' : `bg-gradient-to-r ${theme.buttonGradient}`;
    
    div.className = `px-6 py-3 rounded-full shadow-2xl text-white text-sm font-bold flex items-center gap-2 ${bgClass} animate-fade-in-up mb-2`;
    div.innerHTML = `<span>${text}</span>`;
    
    container.appendChild(div);
    setTimeout(() => {
        div.classList.add('opacity-0', 'transition-opacity');
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

// --- 3D TILT ---
function handleTilt(e, cardContainer) {
    const rect = cardContainer.getBoundingClientRect();
    let clientX, clientY;
    
    if (e.type.includes('touch')) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Limits
    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;
    
    const cardElement = document.getElementById('card-element');
    cardElement.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    
    // Glare
    const glare = document.getElementById('glare-layer');
    const glareX = 50 + (rotateY * 2);
    const glareY = 50 + (rotateX * 2);
    glare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 60%)`;
}

function resetTilt() {
    const cardElement = document.getElementById('card-element');
    cardElement.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1.02, 1.02, 1.02)`;
    const glare = document.getElementById('glare-layer');
    glare.style.background = 'none';
}

// Start
init();

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
