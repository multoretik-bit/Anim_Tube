import { state, WHITELIST } from './config.js';
import { authState } from './auth.js';

export function showPage(pageId, callbacks = {}) {
    state.activePage = pageId;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    const pageEl = document.getElementById(`page-${pageId}`);
    if (pageEl) pageEl.classList.add('active');
    
    const navItem = document.getElementById(`nav-${pageId}`);
    if (navItem) navItem.classList.add('active');
    
    const titleEl = document.getElementById('page-title-display');
    if (titleEl) {
        const titles = { 'account': 'Профиль', 'videos': 'Мои каналы', 'partners': 'Партнёры', 'workspace': 'Редактор проекта' };
        titleEl.innerText = titles[pageId] || 'Студия';
    }

    if (pageId === 'videos' && callbacks.renderProjects) callbacks.renderProjects();
    if (pageId === 'account' && callbacks.renderAccountPage) callbacks.renderAccountPage();
    if (pageId === 'workspace' && callbacks.renderWorkspace) callbacks.renderWorkspace();
}

export function renderSidebarProfile() {
    const user = authState.user;
    if (!user) return;

    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-user-avatar');
    
    if (nameEl) nameEl.innerText = user.login;
    if (roleEl) roleEl.innerHTML = `@${user.login.toLowerCase()}`;
    
    if (avatarEl) {
        const userAvatar = state.userAvatars[user.login];
        avatarEl.src = userAvatar || `https://ui-avatars.com/api/?name=${user.login}&background=6366f1&color=fff`;
    }
}

export function renderAccountPage(callbacks = {}) {
    if (!authState.isLoggedIn) return;
    const user = authState.user;
    
    // Filter folders based on role
    let myFolders = user.role === 'owner'
        ? state.folders.filter(f => !f.assignedTo || f.assignedTo.trim() === "")
        : state.folders.filter(f => {
            const assigned = (f.assignedTo || "").split(',').map(s => s.trim().toLowerCase());
            return assigned.includes(user.login.toLowerCase()) || (f.ownedBy && f.ownedBy.toLowerCase() === user.login.toLowerCase());
        });

    // Update Header
    const greetingEl = document.getElementById('greeting-name');
    if (greetingEl) greetingEl.innerText = user.login;
    
    const countEl = document.getElementById('channel-count-display');
    if (countEl) countEl.innerText = myFolders.length;

    // Update Avatar
    const mainImg = document.getElementById('main-profile-img');
    const mainInitials = document.getElementById('main-profile-initials');
    const userAvatar = state.userAvatars[user.login];
    if (mainImg && mainInitials) {
        if (userAvatar) {
            mainImg.src = userAvatar;
            mainImg.style.display = 'block';
            mainInitials.style.display = 'none';
        } else {
            mainImg.style.display = 'none';
            mainInitials.style.display = 'flex';
            mainInitials.innerText = user.login.substring(0, 2).toUpperCase();
        }
    }

    // Dashboard Stats
    let totalViews = 0, totalRevenue = 0;
    myFolders.forEach(f => {
        totalViews += Number(f.views) || 0;
        totalRevenue += Number(f.revenue) || 0;
    });

    const dashViews = document.getElementById('dashboard-views');
    const dashRev = document.getElementById('dashboard-revenue');
    if (dashViews) dashViews.innerText = totalViews.toLocaleString();
    if (dashRev) dashRev.innerText = '$' + totalRevenue.toLocaleString();

    // Render Preview Cards
    const previewContainer = document.getElementById('profile-projects-preview');
    if (previewContainer) {
        previewContainer.innerHTML = myFolders.map(f => `
            <div class="project-preview-card" style="border-color: ${f.color || '#6366f1'};">
                <div class="card-content">
                    <h4>${f.name}</h4>
                    <div class="card-stats">
                        <div>👁️ ${Number(f.views || 0).toLocaleString()}</div>
                        <div style="color: #34d399;">💰 $${Number(f.revenue || 0).toLocaleString()}</div>
                    </div>
                    <button class="btn-open-project" onclick="window.openFolder(${f.id})">ОТКРЫТЬ →</button>
                </div>
            </div>
        `).join('');
    }
}

export function renderWorkspace() {
    const project = state.projects.find(p => p.id === state.activeProjectId);
    if (!project) return;
    
    document.getElementById('current-project-name').innerText = project.name;
    
    if (state.activeProjectTab === 'script') renderProjectScripts();
    if (state.activeProjectTab === 'voice') renderProjectVoice();
    if (state.activeProjectTab === 'frames') renderProjectPrompts();
}

export function renderProjectScripts() {
    const container = document.getElementById('project-scripts-container');
    const project = state.projects.find(p => p.id === state.activeProjectId);
    if (!container || !project) return;
    
    container.innerHTML = (project.scripts || []).map(s => `
        <div class="glass-panel" style="padding:15px; border-radius:12px; border: 1px solid rgba(255,255,255,0.1);">
            <div style="font-weight:700; margin-bottom:10px;">Сценарий #${s.id}</div>
            <div style="font-size:13px; color:var(--text-secondary); white-space:pre-wrap;">${s.text}</div>
        </div>
    `).join('');
}

export function renderProjectVoice() {
    const container = document.getElementById('voice-content-container');
    const project = state.projects.find(p => p.id === state.activeProjectId);
    if (!container || !project) return;
    
    if (!project.audioId) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-dim);">🎙️ Аудио еще не загружено.</div>`;
    } else {
        container.innerHTML = `<div class="glass-panel" style="padding:20px;">🔊 Файл озвучки привязан: ${project.audioId}</div>`;
    }
}

export function renderProjectPrompts() {
    const container = document.getElementById('scenarios-splitting-container');
    const project = state.projects.find(p => p.id === state.activeProjectId);
    if (!container || !project) return;
    
    container.innerHTML = (project.promptsList || []).map((p, idx) => `
        <div class="glass-panel" style="padding:15px; margin-bottom:10px;">
            <div style="font-size:12px; color:var(--text-dim);">КАДР #${idx + 1}</div>
            <div style="font-size:14px; margin-top:5px;">${p.text}</div>
        </div>
    `).join('');
}

// --- CHAT UI ---
export function renderConversations(query = "") {
    const list = document.getElementById('chat-conversations-list');
    if (!list) return;
    
    let users = WHITELIST.filter(u => u.login !== authState.user.login);
    if (query) users = users.filter(u => u.login.toLowerCase().includes(query.toLowerCase()));
    
    list.innerHTML = users.map(u => `
        <div class="conversation-item" onclick="window.selectConversation('${u.login}')">
            <div class="conv-avatar">
                <img src="${state.userAvatars[u.login] || `https://ui-avatars.com/api/?name=${u.login}`}">
            </div>
            <div class="conv-info">
                <div class="conv-name">${u.login}</div>
                <div class="conv-last-msg">Нажмите, чтобы начать чат</div>
            </div>
        </div>
    `).join('');
}

export function renderMessages(messages, recipient) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;
    
    container.innerHTML = messages.map(m => {
        const isMine = m.sender === authState.user.login;
        return `
            <div class="message ${isMine ? 'mine' : 'theirs'}">
                <div class="message-bubble">${m.text}</div>
            </div>
        `;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

export function renderProjects() {
    const container = document.getElementById('project-list-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    let visibleFolders = authState.user.role === 'owner' 
        ? state.folders.filter(f => !f.assignedTo || f.assignedTo.trim() === "")
        : state.folders.filter(f => {
            const assigned = (f.assignedTo || "").split(',').map(s => s.trim().toLowerCase());
            return assigned.includes(authState.user.login.toLowerCase()) || (f.ownedBy && f.ownedBy.toLowerCase() === authState.user.login.toLowerCase());
        });

    visibleFolders.forEach(f => {
        const card = document.createElement('div');
        card.className = "featured-channel-card";
        card.style.borderColor = f.color || 'var(--accent-primary)';
        card.onclick = () => window.openFolder(f.id);
        card.innerHTML = `
            <div class="channel-info">
                <h3>${f.name}</h3>
                <p>${f.niche || 'General'}</p>
            </div>
            <div class="channel-stats">
                <span>👁️ ${Number(f.views || 0).toLocaleString()}</span>
                <span>💰 $${Number(f.revenue || 0).toLocaleString()}</span>
            </div>
        `;
        container.appendChild(card);
    });
}
