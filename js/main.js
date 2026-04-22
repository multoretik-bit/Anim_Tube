import { state } from './config.js';
import { getDB, initDB, loadState, setupRealtimeSync, saveState } from './api.js';
import { authState, detectIP, checkSecurity, handleLogin, logout } from './auth.js';
import { 
    showPage, 
    renderSidebarProfile, 
    renderAccountPage, 
    renderProjects, 
    renderWorkspace,
    renderConversations,
    renderMessages
} from './ui.js';
import { openFolder, exitFolder, createNewProject, deleteProject } from './actions.js';
import { startScriptGeneration, addManualScenario } from './scripts.js';
import { startRollAssembly, stopRollAssembly } from './assembly.js';
import { handleAudioUpload } from './voice.js';
import { renderPartnersPage, openPartnerProfile, enterChannel } from './social.js';
import { startSuperAutomation, stopSuperAutomation } from './automation.js';
import { logStatus } from './utils.js';

// --- SHARED REFRESH LOGIC ---
const UI_CALLBACKS = {
    renderAccountPage,
    renderProjects,
    renderSidebarProfile,
    renderWorkspace,
    showPage: (id) => showPage(id, UI_CALLBACKS),
    onFoldersChange: () => {
        if (state.activePage === 'account') renderAccountPage();
        renderProjects();
    },
    onProjectsChange: () => {
        renderProjects();
        if (state.activePage === 'workspace') renderWorkspace();
    }
};

// --- INITIALIZATION ---
window.onload = async () => {
    console.log("🚀 AnimTube Studio Modular v2.4 Final Starting...");
    
    await detectIP();
    await initDB();
    
    if (authState.isLoggedIn) {
        await loadState();
        setupRealtimeSync(UI_CALLBACKS);
        checkSecurity(UI_CALLBACKS);
        renderSidebarProfile();
        if (state.activePage === 'account') renderAccountPage();
        else if (state.activePage === 'partners') renderPartnersPage();
        else showPage(state.activePage, UI_CALLBACKS);
    } else {
        checkSecurity(UI_CALLBACKS);
    }
};

// --- GLOBAL EXPORTS ---
window.handleLogin = () => handleLogin(UI_CALLBACKS);
window.logout = logout;
window.showPage = (id) => {
    if (id === 'partners') renderPartnersPage();
    showPage(id, UI_CALLBACKS);
};
window.openFolder = (id) => openFolder(id, UI_CALLBACKS);
window.exitFolder = () => exitFolder(UI_CALLBACKS);
window.createNewProject = () => createNewProject(UI_CALLBACKS);
window.deleteProject = (id) => deleteProject(id, UI_CALLBACKS);
window.startScriptGeneration = startScriptGeneration;
window.addManualScenario = addManualScenario;
window.handleAudioUpload = (e) => handleAudioUpload(e, UI_CALLBACKS);
window.startRollAssembly = () => startRollAssembly(UI_CALLBACKS);
window.stopRollAssembly = stopRollAssembly;
window.openPartnerProfile = openPartnerProfile;
window.enterChannel = (id) => enterChannel(id, UI_CALLBACKS);
window.startSuperAutomation = startSuperAutomation;
window.stopSuperAutomation = stopSuperAutomation;

window.forceSync = async () => {
    logStatus("🔄 Принудительная синхронизация...", "info");
    await saveState();
    await loadState();
    location.reload();
};

window.appState = state;
