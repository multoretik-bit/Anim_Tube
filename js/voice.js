import { state } from './config.js';
import { saveState } from './api.js';

export function handleAudioUpload(event, callbacks = {}) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log("🎙️ Uploading audio:", file.name);
    // Logic for audio storage goes here
    const project = state.projects.find(p => p.id === state.activeProjectId);
    if (project) {
        project.audioId = file.name;
        saveState();
        if (callbacks.renderProjectVoice) callbacks.renderProjectVoice();
    }
}
