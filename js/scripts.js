import { state } from './config.js';
import { saveState } from './api.js';

export async function startScriptGeneration() {
    const countInput = document.getElementById('script-count');
    const count = countInput ? parseInt(countInput.value) : 1;
    
    const project = state.projects.find(p => p.id === state.activeProjectId);
    if (!project) return;

    const folder = state.folders.find(f => f.id === project.folderId);
    const prefix = folder?.scriptPrefix || "Расскажи интересную историю для детей про Пеппу Пиг.";

    console.log(`🚀 Generating ${count} scripts for project: ${project.name}`);
    
    // Logic for calling ChatGPT Proxy
    try {
        const response = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o',
                prompt: `Сгенерируй ${count} коротких сценариев для видео. Тема: ${prefix}. Раздели их тегом [END]`,
                apiKey: 'YOUR_API_KEY' // This should be handled more securely
            })
        });
        const data = await response.json();
        if (data.choices && data.choices[0]) {
            const texts = data.choices[0].message.content.split('[END]');
            texts.forEach(text => {
                if (text.trim()) {
                    project.scripts.push({ id: Date.now() + Math.random(), text: text.trim() });
                }
            });
            await saveState();
            alert("✅ Сценарии сгенерированы!");
        }
    } catch (err) {
        console.error("Script Gen Error:", err);
    }
}

export function addManualScenario() {
    const text = prompt("Введите текст сценария:");
    if (!text) return;
    
    const project = state.projects.find(p => p.id === state.activeProjectId);
    if (!project) return;
    
    if (!project.scripts) project.scripts = [];
    project.scripts.push({ id: Date.now(), text: text });
    saveState();
}
