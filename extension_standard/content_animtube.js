console.log("🛰️ AnimTube Bridge (STANDARD) Ready.");

window.addEventListener("message", (event) => {
    if (!event.data || !event.data.type) return;
    console.log("🛰️ [BRIDGE] Message received in Content Script (Standard):", event.data.type);
    
    // Standard extension version ONLY handles non-AUTO commands
    // This prevents double actions when both extensions are installed
    if (event.data.type.includes("AUTO") && !event.data.type.includes("CMD_SPLIT") && !event.data.type.includes("CMD_SCRIPT")) return;
    
    if (event.data.type === "TO_GEMINI" || event.data.type === "AUTO_TO_GEMINI") {
        chrome.runtime.sendMessage({
            type: "TO_GEMINI",
            prompt: event.data.prompt || "",
            assets: event.data.assets || [],
            assetIds: event.data.assetIds || [],
            prevFrame: event.data.prevFrame || null
        });
    }

    if (event.data.type === "FEEDBACK_TO_GEMINI") {
        chrome.runtime.sendMessage({
            type: "FEEDBACK_TO_GEMINI",
            image: event.data.image || null
        });
    }

    if (event.data.type === "TO_CHATGPT") {
        chrome.runtime.sendMessage({
            type: "TO_CHATGPT",
            prompt: event.data.prompt || "",
            assets: event.data.assets || [],
            assetIds: event.data.assetIds || []
        });
    }
    
    if (event.data.type === "ANIMTUBE_CMD_SCRIPT" || event.data.type === "ANIMTUBE_AUTO_CMD_SCRIPT") {
        chrome.runtime.sendMessage({
            type: "ANIMTUBE_CMD_SCRIPT",
            prefix: event.data.prefix || ""
        });
    }

    if (event.data.type === "ANIMTUBE_CMD_SPLIT" || event.data.type === "ANIMTUBE_AUTO_CMD_SPLIT") {
        chrome.runtime.sendMessage({
            type: "ANIMTUBE_CMD_SPLIT",
            script: event.data.script || "",
            prefix: event.data.prefix || ""
        });
    }

    if (event.data.type === "TO_GROK") {
        chrome.runtime.sendMessage({
            type: "TO_GROK",
            prompt: event.data.prompt || "",
            assets: event.data.assets || [],
            assetIds: event.data.assetIds || []
        });
    }
});

chrome.runtime.onMessage.addListener((msg) => {
    window.postMessage(msg, "*");
});
