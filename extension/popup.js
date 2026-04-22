function updateStatus() {
    chrome.tabs.query({ url: "https://gemini.google.com/*" }, (tabs) => {
        const status = document.getElementById('gemini-status');
        if (tabs.length > 0) {
            status.textContent = "🟢 Gemini Tab: CONNECTED";
            status.className = "status online";
        } else {
            status.textContent = "🔴 Gemini Tab: NOT FOUND";
            status.className = "status offline";
        }
    });

    chrome.tabs.query({ url: ["http://localhost/*", "https://*.vercel.app/*"] }, (tabs) => {
        const status = document.getElementById('studio-status');
        if (tabs.length > 0) {
            status.textContent = "🟢 Studio Tab: CONNECTED";
            status.className = "status online";
        } else {
            status.textContent = "🔴 Studio Tab: NOT FOUND";
            status.className = "status offline";
        }
    });
}

// Update status every 2 seconds when popup is open
setInterval(updateStatus, 2000);
updateStatus();
