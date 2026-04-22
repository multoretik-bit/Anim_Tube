import { state, DEFAULT_PREFIX } from './config.js';
import { saveState, getImageFromDB } from './api.js';
import { logStatus, copyTextToClipboard, isAssetMatch } from './utils.js';

export function sendToBridge(msg) {
    try {
        console.log("📡 [STUDIO -> BRIDGE]: Sending type =", msg.type, msg);
        window.postMessage(msg, "*");
    } catch (e) {
        console.error("📡 [BRIDGE ERROR]:", e);
        logStatus("📡 [Bridge Error]: " + e.message, "error");
    }
}

export async function startRollAssembly(callbacks = {}) {
    const project = state.projects.find(p => p.id === state.activeProjectId);
    if (!project || !project.promptsList || project.promptsList.length === 0) {
        return alert("Добавьте хотя бы один промт!");
    }

    const queue = project.promptsList
        .map((p, idx) => ({ ...p, originalIndex: idx }))
        .filter(p => !p.isGeminiDone);
    
    if (queue.length === 0) return alert("Все кадры уже готовы!");

    state.assembly.queue = queue;
    state.assembly.currentIdx = 0;
    state.assembly.isRunning = true;
    state.assembly.lockedProjectId = state.activeProjectId;
    
    const btnStart = document.getElementById('btn-start-assembly');
    const btnStop = document.getElementById('btn-stop-assembly');
    if (btnStart) btnStart.style.display = 'none';
    if (btnStop) btnStop.style.display = 'flex';
    
    logStatus(`🎬 Пакетная сборка запущена (${queue.length} кадров).`, "info");
    processNextItem(callbacks);
}

export function stopRollAssembly() {
    state.assembly.isRunning = false;
    clearTimeout(state.assembly.timerId);
    const btnStart = document.getElementById('btn-start-assembly');
    const btnStop = document.getElementById('btn-stop-assembly');
    if (btnStart) btnStart.style.display = 'flex';
    if (btnStop) btnStop.style.display = 'none';
    logStatus("🛑 Сборка остановлена.", "error");
}

export async function processNextItem(callbacks = {}) {
    if (!state.assembly.isRunning) return;

    if (state.assembly.currentIdx >= state.assembly.queue.length) {
        logStatus("✅ Пакетная сборка завершена!", "success");
        stopRollAssembly();
        return;
    }

    const item = state.assembly.queue[state.assembly.currentIdx];
    const project = state.projects.find(p => p.id === state.activeProjectId);
    const folder = state.folders.find(f => f.id === project.folderId);
    const prefix = folder?.prefix || DEFAULT_PREFIX;
    
    const fullPrompt = (prefix.trim() + "\n\n" + item.text.trim()).trim();
    copyTextToClipboard(fullPrompt);
    
    logStatus(`🛰️ [${state.assembly.currentIdx + 1}/${state.assembly.queue.length}] Анализ промта...`, "info");
    
    // Asset Scanning
    const matchingAssets = [];
    if (folder && folder.assets) {
        for (const asset of folder.assets) {
            if (isAssetMatch(item.text, asset.name)) {
                matchingAssets.push(asset.base64);
            }
        }
    }

    // Previous Frame Context
    let prevFrameData = null;
    if (project.results && project.results.length > 0) {
        prevFrameData = await getImageFromDB(project.results[0].id);
    }

    sendToBridge({ 
        type: "TO_GEMINI", 
        prompt: fullPrompt,
        assets: matchingAssets,
        prevFrame: prevFrameData 
    });
    
    state.assembly.currentIdx++;
    if (callbacks.updateProgressUI) callbacks.updateProgressUI();
}
