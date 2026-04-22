import { WHITELIST, state } from './config.js';
import { loadState, setupRealtimeSync } from './api.js';

export let authState = JSON.parse(localStorage.getItem('animtube_auth') || '{"isLoggedIn": false, "user": null, "sessionStart": null, "lastActivity": null}');
export let userIP = "detecting...";

export async function detectIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        userIP = data.ip;
        console.log("📍 Current IP:", userIP);
    } catch (err) {
        console.error("Failed to detect IP:", err);
        userIP = "127.0.0.1";
    }
}

export function checkSecurity(callbacks = {}) {
    const overlay = document.getElementById('auth-overlay');
    if (!authState.isLoggedIn) {
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.style.opacity = '1';
        }
    } else {
        if (overlay) overlay.style.display = 'none';
        applySecurityUI(callbacks);
    }
}

export async function handleLogin(callbacks = {}) {
    const login = document.getElementById('auth-login').value;
    const pass = document.getElementById('auth-pass').value;
    const code = document.getElementById('auth-code').value;
    const errorEl = document.getElementById('auth-error');

    const user = WHITELIST.find(u => u.login === login && u.pass === pass && u.code === code);

    if (user) {
        if (user.ip !== "*" && user.ip !== userIP) {
            if (errorEl) {
                errorEl.innerText = `❌ Ошибка IP: Ваш IP (${userIP}) не совпадает с разрешенным.`;
                errorEl.style.display = 'block';
            }
            return;
        }

        authState = {
            isLoggedIn: true,
            user: { login: user.login, role: user.role },
            sessionStart: Date.now(),
            lastActivity: Date.now(),
            dateEntered: new Date().toLocaleDateString()
        };
        localStorage.setItem('animtube_auth', JSON.stringify(authState));
        
        await loadState();
        setupRealtimeSync(callbacks);
        
        applySecurityUI(callbacks);
        if (callbacks.renderAccountPage) callbacks.renderAccountPage();
        if (callbacks.renderSidebarProfile) callbacks.renderSidebarProfile();
        
        const overlay = document.getElementById('auth-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', 500);
        }
    } else {
        if (errorEl) {
            errorEl.innerText = "❌ Неверные данные доступа.";
            errorEl.style.display = 'block';
        }
    }
}

export function logout() {
    if (!confirm("Выйти из системы?")) return;
    localStorage.removeItem('animtube_auth');
    location.reload();
}

export function applySecurityUI(callbacks = {}) {
    if (!authState.isLoggedIn) return;
    
    document.body.classList.remove('role-owner', 'role-partner', 'role-manager');
    document.body.classList.add(`role-${authState.user.role}`);
    
    if (callbacks.renderSidebarProfile) callbacks.renderSidebarProfile();
    
    const hud = document.getElementById('partner-hud');
    if (hud) {
        hud.style.display = (authState.user.role === 'partner' || authState.user.role === 'manager') ? 'flex' : 'none';
    }
}
