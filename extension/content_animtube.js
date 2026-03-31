console.log("🛰️ AnimTube Studio Bridge v11.17 - Ultimate Resurrection Ready.");

// 1. Studio -> Background (Prompt Commands)
window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "ANIMTUBE_CMD") {
        chrome.runtime.sendMessage({
            type: "TO_GEMINI",
            prompt: event.data.prompt || "",
            assets: event.data.assets || [],
            assetIds: event.data.assetIds || [] // For visual copy phase (v11.15+)
        });
    }
    
    // NEW: Forward Script Creation commands (v12.0)
    if (event.data && event.data.type === "ANIMTUBE_CMD_SCRIPT") {
        chrome.runtime.sendMessage({
            type: "ANIMTUBE_CMD_SCRIPT",
            prefix: event.data.prefix || ""
        });
    }
});

// 2. Background -> Studio (Image Arrival & Auto-Paste Signals)
chrome.runtime.onMessage.addListener((msg) => {
    // Relay all background messages to the Studio page context
    window.postMessage(msg, "*");
});
