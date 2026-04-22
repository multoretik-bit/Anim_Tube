import { state } from './config.js';
import { logStatus } from './utils.js';
import { startScriptGeneration } from './scripts.js';

export function startSuperAutomation() {
    const countInput = document.getElementById('super-auto-count');
    const count = parseInt(countInput.value) || 1;
    
    state.assembly.superAuto.active = true;
    state.assembly.superAuto.count = count;
    state.assembly.superAuto.phase = 'scripts';
    
    logStatus(`🚀 ЗАПУСК СУПЕР-АВТОМАТИЗАЦИИ: ${count} видео.`, "success");
    startScriptGeneration();
}

export function stopSuperAutomation() {
    state.assembly.superAuto.active = false;
    state.assembly.superAuto.phase = 'idle';
    logStatus("🎊 Супер-автоматизация завершена!", "success");
}
