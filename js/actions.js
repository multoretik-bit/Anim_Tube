import { state, saveDeletedIds } from './config.js';
import { authState } from './auth.js';
import { saveState, getDB } from './api.js';

export function openFolder(folderId, callbacks = {}) {
    state.currentFolderId = folderId;
    if (callbacks.showPage) callbacks.showPage('videos');
}

export function exitFolder(callbacks = {}) {
    state.currentFolderId = null;
    if (callbacks.showPage) callbacks.showPage('videos');
}

export async function createNewProject(callbacks = {}) {
    if (!state.currentFolderId) return;
    const name = prompt("Введите название проекта:");
    if (!name) return;

    const newProject = {
        id: Date.now(),
        folderId: state.currentFolderId,
        name: name,
        status: 0,
        scripts: [],
        promptsList: [],
        results: [],
        assets: []
    };

    state.projects.push(newProject);
    await saveState();
    if (callbacks.renderProjects) callbacks.renderProjects();
}

export async function deleteProject(id, callbacks = {}) {
    if (!confirm("Удалить проект навсегда?")) return;
    state.projects = state.projects.filter(p => p.id != id);
    state.deletedIds.add(id);
    saveDeletedIds();
    await saveState();
    if (callbacks.renderProjects) callbacks.renderProjects();
}

// === CHAT ACTIONS ===
export async function sendMessage(text, recipient, callbacks = {}) {
    const client = getDB();
    if (!client || !text.trim() || !recipient) return;

    try {
        const { error } = await client.from('messages').insert([{
            sender: authState.user.login,
            recipient: recipient,
            text: text
        }]);
        if (error) throw error;
    } catch (err) {
        console.error("Chat Error:", err);
    }
}
