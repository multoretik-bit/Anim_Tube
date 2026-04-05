console.log("🛰️ AnimTube Bridge (SUPER AUTO) Ready.");

window.addEventListener("message", (event) => {
    if (!event.data) return;
    
    // Only handle AUTO commands
    if (event.data.type === "TO_GEMINI") {
        chrome.runtime.sendMessage({
            type: "TO_GEMINI",
            prompt: event.data.prompt || "",
            assets: event.data.assets || [],
            assetIds: event.data.assetIds || []
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

    if (event.data.type === "ANIMTUBE_AUTO_CMD") {
        chrome.runtime.sendMessage({
            type: "TO_GEMINI", // Super Auto primarily uses Gemini for frames now
            prompt: event.data.prompt || "",
            assets: event.data.assets || [],
            assetIds: event.data.assetIds || []
        });
    }
    
    if (event.data.type === "ANIMTUBE_AUTO_CMD_SCRIPT") {
        chrome.runtime.sendMessage({
            type: "ANIMTUBE_CMD_SCRIPT",
            prefix: event.data.prefix || ""
        });
    }

    if (event.data.type === "ANIMTUBE_AUTO_CMD_SPLIT") {
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
