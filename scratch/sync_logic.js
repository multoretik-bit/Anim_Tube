
window.forceSync = async function() {
    const icon = document.getElementById('sync-icon');
    if (icon) icon.style.animation = 'spin 1s linear infinite';
    
    logStatus("🔄 Принудительная синхронизация...", "info");
    
    try {
        await detectIP();
        cloudDB = getDB();
        await loadState();
        logStatus("✅ Соединение восстановлено и данные обновлены.", "success");
    } catch (err) {
        logStatus("❌ Ошибка при переподключении: " + err.message, "error");
    } finally {
        if (icon) icon.style.animation = 'none';
    }
};

// Add spinning animation to style.css if missing
if (!document.getElementById('sync-anim-style')) {
    const s = document.createElement('style');
    s.id = 'sync-anim-style';
    s.innerHTML = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    document.head.appendChild(s);
}
