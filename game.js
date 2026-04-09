/* ============================================
   ZIP THE LEAK — 8 Leaks Engine
   Smooth drag, exact labels, full dashboard
   ============================================ */

(() => {
    'use strict';

    const SIZE = 5;
    const TOTAL = SIZE * SIZE;
    const NUM_LEAKS = 8;
    const LAUNCH_DATE = '2026-04-09';
    const STORAGE_KEY = 'zip-the-leak-stats-v2';

    // Exact labels as specified — these appear on the grid and in the legend
    const LEAK_LABELS = [
        { id: 'copays',       label: 'High copays' },
        { id: 'deductibles',  label: 'Deductibles' },
        { id: 'coinsurance',  label: 'Coinsurance' },
        { id: 'pbm',          label: 'PBM rebates' },
        { id: 'accumulators', label: 'Copay accumulators' },
        { id: 'design',       label: 'Broken insurance design' },
        { id: 'pricecontrol', label: 'Price controls that weaken innovation' },
        { id: 'generics',     label: 'Delayed genericization' },
    ];

    // =========================================================================
    // SEEDED RNG (Mulberry32)
    // =========================================================================
    function mulberry32(seed) {
        return function() {
            seed |= 0;
            seed = seed + 0x6D2B79F5 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    function hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    // =========================================================================
    // PUZZLE GENERATOR (Backtracking + Warnsdorff)
    // =========================================================================
    function getNeighbors(r, c) {
        return [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]
            .filter(([nr,nc]) => nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE);
    }

    function generatePuzzle(seed) {
        const rng = mulberry32(seed);
        const visited = Array.from({length: SIZE}, () => Array(SIZE).fill(false));
        const path = [];

        const startR = Math.floor(rng() * SIZE);
        const startC = Math.floor(rng() * SIZE);

        function backtrack(r, c) {
            visited[r][c] = true;
            path.push([r, c]);
            if (path.length === TOTAL) return true;

            const neighbors = getNeighbors(r, c).filter(([nr, nc]) => !visited[nr][nc]);
            neighbors.sort((a, b) => {
                const cA = getNeighbors(a[0], a[1]).filter(([nr, nc]) => !visited[nr][nc]).length;
                const cB = getNeighbors(b[0], b[1]).filter(([nr, nc]) => !visited[nr][nc]).length;
                return cA !== cB ? cA - cB : rng() - 0.5;
            });

            for (const [nr, nc] of neighbors) {
                if (backtrack(nr, nc)) return true;
            }
            visited[r][c] = false;
            path.pop();
            return false;
        }

        if (!backtrack(startR, startC)) {
            for (let r = 0; r < SIZE && path.length < TOTAL; r++)
                for (let c = 0; c < SIZE && path.length < TOTAL; c++) {
                    path.length = 0;
                    visited.forEach(row => row.fill(false));
                    if (backtrack(r, c)) break;
                }
        }

        // 8 leaks spread across the 25-cell path
        const leakPositions = [0, 3, 6, 9, 12, 15, 18, 24];
        return { path: path.slice(), leakPositions };
    }

    // =========================================================================
    // DAILY SYSTEM
    // =========================================================================
    function getToday() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function getDayNumber(dateStr) {
        const launch = new Date(LAUNCH_DATE + 'T00:00:00');
        const current = new Date(dateStr + 'T00:00:00');
        return Math.max(1, Math.floor((current - launch) / 86400000) + 1);
    }

    function getDailyPuzzle() {
        const today = getToday();
        const seed = hashString('nplb-zip-v2-' + today);
        return { puzzle: generatePuzzle(seed), dayNum: getDayNumber(today), date: today };
    }

    function getPracticePuzzle() {
        const seed = Date.now() ^ (Math.random() * 0xFFFFFFFF);
        return { puzzle: generatePuzzle(seed), dayNum: 0, date: null };
    }

    // =========================================================================
    // STATS
    // =========================================================================
    function loadStats() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultStats(); }
        catch { return defaultStats(); }
    }
    function defaultStats() {
        return { best: null, times: [], games: 0, streak: 0, maxStreak: 0, lastDailyDate: null, todayTime: null, todayDate: null };
    }
    function saveStats(stats) { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); }

    // =========================================================================
    // STATE
    // =========================================================================
    let state = {};
    const $ = s => document.querySelector(s);
    const gridEl = $('#game-grid');
    const screens = { title: $('#screen-title'), legend: $('#screen-legend'), game: $('#screen-game'), dashboard: $('#screen-dashboard') };

    function key(r, c) { return `${r},${c}`; }
    function adj(a, b) { return (Math.abs(a.row - b.row) + Math.abs(a.col - b.col)) === 1; }
    function getCell(r, c) { return gridEl.querySelector(`[data-row="${r}"][data-col="${c}"]`); }
    function showScreen(name) {
        Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name));
    }

    // =========================================================================
    // COORDINATE-BASED CELL LOOKUP (for smooth drag)
    // =========================================================================
    function cellFromPoint(x, y) {
        // Use elementFromPoint and walk up to find .grid-cell
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        const cellEl = el.closest('.grid-cell');
        if (!cellEl) return null;
        return { row: +cellEl.dataset.row, col: +cellEl.dataset.col };
    }

    // =========================================================================
    // TITLE
    // =========================================================================
    function setupTitle() {
        const stats = loadStats();
        const daily = getDailyPuzzle();

        $('#daily-number').textContent = `DAILY PUZZLE #${daily.dayNum}`;
        const dateObj = new Date(daily.date + 'T00:00:00');
        $('#daily-date').textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        if (stats.best !== null || stats.todayTime !== null) {
            $('#title-stats').style.display = '';
            $('#title-best-time').textContent = stats.best !== null ? stats.best.toFixed(1) + 's' : '--';
            const avg = stats.times.length > 0
                ? (stats.times.reduce((a, b) => a + b, 0) / stats.times.length).toFixed(1) + 's' : '--';
            $('#title-avg-time').textContent = avg;
            $('#title-played').textContent = stats.games;
            $('#title-today-time').textContent = (stats.todayDate === getToday() && stats.todayTime !== null)
                ? stats.todayTime.toFixed(1) + 's' : '--';
        } else {
            $('#title-stats').style.display = 'none';
        }

        if (stats.lastDailyDate === getToday()) {
            $('#btn-daily').querySelector('.btn-text').textContent = 'COMPLETED ✓';
            $('#btn-daily').classList.add('btn-completed');
        } else {
            $('#btn-daily').querySelector('.btn-text').textContent = 'PLAY';
            $('#btn-daily').classList.remove('btn-completed');
        }
    }

    function showTodayResults() {
        const stats = loadStats();
        showDashboard(stats.todayTime || 0, false, stats);
    }

    // =========================================================================
    // GRID
    // =========================================================================
    function buildGrid() {
        gridEl.innerHTML = '';

        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;

                const k = key(r, c);
                if (state.leakCells[k]) {
                    const leak = state.leakCells[k];
                    cell.classList.add('leak-node');
                    if (leak.num === 1) cell.classList.add('next-target');
                    cell.innerHTML = `<div class="leak-marker"><div class="leak-number">${leak.num}</div></div>`;
                }

                gridEl.appendChild(cell);
            }
        }

        // =====================================================================
        // SMOOTH DRAG SYSTEM — works on both mouse and touch
        // Instead of per-cell listeners, we use document-level move tracking
        // =====================================================================

        // MOUSE: mousedown on grid starts drag
        gridEl.addEventListener('mousedown', e => {
            e.preventDefault();
            state.isDragging = true;
            const c = cellFromPoint(e.clientX, e.clientY);
            if (c) handleCell(c.row, c.col);
        });

        // MOUSE: track movement across cells during drag
        document.addEventListener('mousemove', e => {
            if (!state.isDragging || state.gameOver) return;
            const c = cellFromPoint(e.clientX, e.clientY);
            if (c) handleCellDrag(c.row, c.col);
        });

        // TOUCH: touchstart on grid
        gridEl.addEventListener('touchstart', e => {
            e.preventDefault();
            state.isDragging = true;
            const t = e.touches[0];
            const c = cellFromPoint(t.clientX, t.clientY);
            if (c) handleCell(c.row, c.col);
        }, { passive: false });

        // TOUCH: smooth drag via touchmove — no per-cell listeners needed
        gridEl.addEventListener('touchmove', e => {
            e.preventDefault();
            if (!state.isDragging || state.gameOver) return;
            const t = e.touches[0];
            const c = cellFromPoint(t.clientX, t.clientY);
            if (c) handleCellDrag(c.row, c.col);
        }, { passive: false });
    }

    // =========================================================================
    // INPUT
    // =========================================================================
    function handleCell(r, c) {
        if (state.gameOver) return;
        const k = key(r, c);

        if (state.path.length === 0) {
            const l1 = Object.entries(state.leakCells).find(([, v]) => v.num === 1);
            if (l1 && l1[0] === k) addToPath(r, c);
            return;
        }

        const last = state.path[state.path.length - 1];
        if (last.row === r && last.col === c && state.path.length > 1) { undoLast(); return; }
        if (state.pathSet.has(k)) {
            const idx = state.path.findIndex(p => p.row === r && p.col === c);
            if (idx >= 0 && idx < state.path.length - 1) undoTo(idx);
            return;
        }
        if (adj(last, { row: r, col: c })) addToPath(r, c);
    }

    function handleCellDrag(r, c) {
        if (state.gameOver || state.path.length === 0) return;
        const k = key(r, c);

        // Last cell we're on — skip (prevents flicker)
        const last = state.path[state.path.length - 1];
        if (last.row === r && last.col === c) return;

        // Drag backward = smooth undo (key UX from LinkedIn Zip)
        if (state.path.length > 1) {
            const prev = state.path[state.path.length - 2];
            if (prev.row === r && prev.col === c) { undoLast(); return; }
        }

        // Already in path — undo to it
        if (state.pathSet.has(k)) {
            const idx = state.path.findIndex(p => p.row === r && p.col === c);
            if (idx >= 0) { undoTo(idx); return; }
        }

        // Adjacent — extend
        if (adj(last, { row: r, col: c })) addToPath(r, c);
    }

    // =========================================================================
    // PATH OPS
    // =========================================================================
    function addToPath(r, c) {
        const k = key(r, c);
        state.path.push({ row: r, col: c });
        state.pathSet.add(k);

        const cell = getCell(r, c);
        cell.classList.add('path');

        if (state.leakCells[k]) {
            const leak = state.leakCells[k];
            if (leak.num === state.nextLeakNum) {
                cell.classList.add('sealed');
                cell.classList.remove('next-target');
                state.sealedCount++;
                state.nextLeakNum++;
                if (state.nextLeakNum <= NUM_LEAKS) {
                    const nx = Object.entries(state.leakCells).find(([, v]) => v.num === state.nextLeakNum);
                    if (nx) { const [nr, nc] = nx[0].split(',').map(Number); getCell(nr, nc).classList.add('next-target'); }
                }
            }
        }

        updateConnections();
        updateCurrent();
        updateHUD();

        if (state.path.length === TOTAL && state.sealedCount === NUM_LEAKS) endGame();
    }

    function undoLast() {
        if (state.path.length <= 1) return;
        const removed = state.path.pop();
        const k = key(removed.row, removed.col);
        state.pathSet.delete(k);

        const cell = getCell(removed.row, removed.col);
        cell.classList.remove('path', 'current', 'conn-up', 'conn-down', 'conn-left', 'conn-right');

        if (state.leakCells[k] && cell.classList.contains('sealed')) {
            cell.classList.remove('sealed');
            state.sealedCount--;
            state.nextLeakNum = state.leakCells[k].num;
            gridEl.querySelectorAll('.next-target').forEach(el => el.classList.remove('next-target'));
            cell.classList.add('next-target');
        }

        updateConnections();
        updateCurrent();
        updateHUD();
    }

    function undoTo(idx) { while (state.path.length > idx + 1) undoLast(); }

    function resetPath() {
        while (state.path.length > 0) {
            const removed = state.path.pop();
            const k = key(removed.row, removed.col);
            state.pathSet.delete(k);
            const cell = getCell(removed.row, removed.col);
            cell.classList.remove('path', 'current', 'sealed', 'conn-up', 'conn-down', 'conn-left', 'conn-right', 'next-target');
        }
        state.sealedCount = 0;
        state.nextLeakNum = 1;
        const l1 = Object.entries(state.leakCells).find(([, v]) => v.num === 1);
        if (l1) { const [r, c] = l1[0].split(',').map(Number); getCell(r, c).classList.add('next-target'); }
        updateHUD();
    }

    function updateCurrent() {
        gridEl.querySelectorAll('.current').forEach(el => el.classList.remove('current'));
        if (state.path.length > 0) {
            const last = state.path[state.path.length - 1];
            getCell(last.row, last.col).classList.add('current');
        }
    }

    function updateConnections() {
        gridEl.querySelectorAll('.conn-up,.conn-down,.conn-left,.conn-right').forEach(el => {
            el.classList.remove('conn-up', 'conn-down', 'conn-left', 'conn-right');
        });
        for (let i = 0; i < state.path.length - 1; i++) {
            const curr = state.path[i], next = state.path[i + 1];
            const cc = getCell(curr.row, curr.col), nc = getCell(next.row, next.col);
            if (next.col > curr.col) { cc.classList.add('conn-right'); nc.classList.add('conn-left'); }
            else if (next.col < curr.col) { cc.classList.add('conn-left'); nc.classList.add('conn-right'); }
            else if (next.row > curr.row) { cc.classList.add('conn-down'); nc.classList.add('conn-up'); }
            else { cc.classList.add('conn-up'); nc.classList.add('conn-down'); }
        }
    }

    // =========================================================================
    // HUD & TIMER
    // =========================================================================
    function updateHUD() {
        $('#hud-cells').textContent = `${state.path.length}/${TOTAL}`;
        $('#hud-leaks').textContent = `${state.sealedCount}/${NUM_LEAKS}`;
    }

    function updateTimer() {
        if (state.gameOver) return;
        const elapsed = (performance.now() - state.startTime) / 1000;
        $('#hud-timer').textContent = elapsed.toFixed(1);
        state.timerId = requestAnimationFrame(updateTimer);
    }

    // =========================================================================
    // END GAME
    // =========================================================================
    function endGame() {
        state.gameOver = true;
        const elapsed = (performance.now() - state.startTime) / 1000;
        state.finalTime = elapsed;
        cancelAnimationFrame(state.timerId);

        const cells = gridEl.querySelectorAll('.grid-cell.path');
        cells.forEach((cell, i) => setTimeout(() => cell.classList.add('celebrate'), i * 20));

        const stats = loadStats();
        stats.games++;
        stats.times.push(elapsed);
        if (stats.times.length > 50) stats.times = stats.times.slice(-50);

        const isNewBest = stats.best === null || elapsed < stats.best;
        if (isNewBest) stats.best = elapsed;

        const today = getToday();
        if (state.mode === 'daily') {
            stats.todayTime = elapsed;
            stats.todayDate = today;
            if (stats.lastDailyDate !== today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
                stats.streak = (stats.lastDailyDate === yStr || stats.lastDailyDate === null) ? (stats.streak || 0) + 1 : 1;
                if (stats.streak > (stats.maxStreak || 0)) stats.maxStreak = stats.streak;
                stats.lastDailyDate = today;
            }
        }

        saveStats(stats);
        setTimeout(() => showDashboard(elapsed, isNewBest, stats), cells.length * 20 + 400);
    }

    function showDashboard(time, isNewBest, stats) {
        $('#dash-time').textContent = time.toFixed(1);
        $('#dash-new-best').style.display = isNewBest ? '' : 'none';
        $('#dash-best').textContent = stats.best !== null ? stats.best.toFixed(1) + 's' : '--';

        const avg = stats.times.length > 0
            ? (stats.times.reduce((a, b) => a + b, 0) / stats.times.length).toFixed(1) + 's' : '--';
        $('#dash-avg').textContent = avg;
        $('#dash-games').textContent = stats.games;
        $('#dash-streak').textContent = stats.streak || 0;

        if (state.mode === 'daily') {
            $('#dash-daily-done').style.display = '';
            $('#dash-daily-label').textContent = `DAILY PUZZLE #${state.dayNum}`;
        } else {
            $('#dash-daily-done').style.display = 'none';
        }

        showScreen('dashboard');
    }

    // =========================================================================
    // START GAME
    // =========================================================================
    function startGame(mode) {
        const data = mode === 'daily' ? getDailyPuzzle() : getPracticePuzzle();
        const puzzle = data.puzzle;

        const leakCells = {};
        puzzle.leakPositions.forEach((pathIdx, i) => {
            const [r, c] = puzzle.path[pathIdx];
            leakCells[key(r, c)] = { num: i + 1, label: LEAK_LABELS[i].label };
        });

        const stats = loadStats();

        state = {
            mode,
            dayNum: data.dayNum,
            path: [],
            pathSet: new Set(),
            leakCells,
            nextLeakNum: 1,
            sealedCount: 0,
            gameOver: false,
            startTime: performance.now(),
            timerId: null,
            finalTime: 0,
            isDragging: false,
        };

        $('#game-mode-label').textContent = mode === 'daily' ? `DAILY PUZZLE #${data.dayNum}` : 'PRACTICE MODE';

        if (stats.best !== null) {
            $('#hud-best-container').style.display = '';
            $('#hud-best').textContent = stats.best.toFixed(1) + 's';
        } else {
            $('#hud-best-container').style.display = 'none';
        }

        // Build the legend sidebar showing what each number means
        updateLeakLegendBar();

        buildGrid();
        updateHUD();
        showScreen('game');
        state.timerId = requestAnimationFrame(updateTimer);
    }

    function updateLeakLegendBar() {
        const el = $('#leak-legend-bar');
        if (!el) return;
        el.innerHTML = Object.values(state.leakCells)
            .sort((a, b) => a.num - b.num)
            .map(l => `<div class="legend-bar-item${l.num <= state.sealedCount ? ' sealed' : ''}"><span class="legend-bar-num">${l.num}</span><span class="legend-bar-label">${l.label}</span></div>`)
            .join('');
    }

    // =========================================================================
    // SHARE
    // =========================================================================
    function shareToLinkedIn() {
        const time = state.finalTime.toFixed(1);
        const stats = loadStats();
        const dayInfo = state.mode === 'daily' ? `Daily Puzzle #${state.dayNum}` : 'Practice';
        const leakList = LEAK_LABELS.map(l => l.label.toLowerCase()).join(' · ');

        const text = `🩹 Zip the Leak — ${dayInfo}\n\nI sealed all 8 insurance leaks in ${time} seconds.\n\n${leakList}\n\n"Patients don't need more skin in the game. They need the leaks fixed."\n\n🔥 Streak: ${stats.streak || 0} days | Best: ${stats.best.toFixed(1)}s\n\n#NoPatientLeftBehind #FixInsurance`;

        navigator.clipboard.writeText(text).catch(() => {});
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`, '_blank');
    }

    // =========================================================================
    // INIT
    // =========================================================================
    function init() {
        setupTitle();

        $('#btn-daily').addEventListener('click', () => {
            const stats = loadStats();
            if (stats.lastDailyDate === getToday()) {
                showTodayResults();
            } else {
                startGame('daily');
            }
        });
        $('#btn-legend').addEventListener('click', () => showScreen('legend'));
        $('#btn-legend-close').addEventListener('click', () => showScreen('title'));

        $('#btn-share').addEventListener('click', shareToLinkedIn);
        $('#btn-home').addEventListener('click', () => { setupTitle(); showScreen('title'); });

        $('#btn-undo').addEventListener('click', undoLast);
        $('#btn-reset').addEventListener('click', resetPath);

        // Global drag end
        document.addEventListener('mouseup', () => { if (state) state.isDragging = false; });
        document.addEventListener('touchend', () => { if (state) state.isDragging = false; });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
