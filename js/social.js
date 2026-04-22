import { state, WHITELIST } from './config.js';
import { authState } from './auth.js';
import { getDB, loadState, setupRealtimeSync } from './api.js';
import { logStatus } from './utils.js';

export async function renderPartnersPage() {
    const container = document.getElementById('partners-list-grid');
    if (!container) return;
    
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--accent-primary); font-weight: 700;">📡 Поиск партнёров...</div>`;
    
    try {
        const cloudDB = getDB();
        const { data: allFolders } = await cloudDB.from('folders').select('ownedBy, assignedTo, views');
        const viewStats = {};
        if (allFolders) {
            allFolders.forEach(f => {
                const holder = f.assignedTo || f.ownedBy;
                viewStats[holder] = (viewStats[holder] || 0) + (Number(f.views) || 0);
            });
        }

        container.innerHTML = WHITELIST.map(u => {
            const views = viewStats[u.login] || 0;
            const avatar = state.userAvatars[u.login];
            return `
                <div class="partner-card" onclick="window.openPartnerProfile('${u.login}')">
                    <div class="avatar">
                        ${avatar ? `<img src="${avatar}">` : `<div style="font-size:32px; font-weight:900; color:white;">${u.login[0]}</div>`}
                    </div>
                    <div class="name">${u.login}</div>
                    <div class="stats">👁️ ${views.toLocaleString()}</div>
                    <button class="btn btn-primary" onclick="event.stopPropagation(); window.openChat('${u.login}')">✉️ Написать</button>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<p>Ошибка загрузки.</p>`;
    }
}

export async function openPartnerProfile(login) {
    const overlay = document.getElementById('partner-profile-overlay');
    if (!overlay) return;
    overlay.classList.add('active');
    document.getElementById('partner-profile-name').innerText = login;
}

export async function enterChannel(folderId, callbacks = {}) {
    logStatus("🛰️ Вход в канал...", "info");
    state.currentFolderId = folderId;
    if (callbacks.showPage) callbacks.showPage('videos');
}
