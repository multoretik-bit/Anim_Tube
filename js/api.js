import { state, saveDeletedIds, SUPABASE_URL, SUPABASE_KEY } from './config.js';

let db = null;
let cloudDB = null;

export function getDB() {
    if (cloudDB) return cloudDB;
    if (typeof supabase === 'undefined') {
        console.error("Supabase library not loaded!");
        return null;
    }
    const { createClient } = supabase;
    cloudDB = createClient(SUPABASE_URL, SUPABASE_KEY);
    return cloudDB;
}

export async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("AnimTubeDB", 3);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("images")) db.createObjectStore("images", { keyPath: "id" });
            if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets", { keyPath: "id" });
            if (!db.objectStoreNames.contains("animations")) db.createObjectStore("animations", { keyPath: "id" });
            if (!db.objectStoreNames.contains("audio")) db.createObjectStore("audio", { keyPath: "id" });
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve();
        };
        request.onerror = (e) => reject(e);
    });
}

// Local persistence functions
export async function saveImageToDB(id, base64) {
    if (!db) return;
    const transaction = db.transaction(["images"], "readwrite");
    const store = transaction.objectStore("images");
    store.put({ id, base64 });
}

export async function getImageFromDB(id) {
    return new Promise(async (resolve, reject) => {
        if (!db) return resolve(null);
        const transaction = db.transaction(["images"], "readonly");
        const store = transaction.objectStore("images");
        const request = store.get(id);
        request.onsuccess = async () => {
            if (request.result) resolve(request.result.base64);
            else {
                const cloudImg = await getImageFromCloud(id);
                if (cloudImg) {
                    await saveImageToDB(id, cloudImg);
                    resolve(cloudImg);
                } else resolve(null);
            }
        };
        request.onerror = (e) => reject(e);
    });
}

export async function getImageFromCloud(id) {
    const client = getDB();
    if (!client) return null;
    try {
        const { data, error } = await client.from('project_images').select('base64').eq('id', id).single();
        return (error || !data) ? null : data.base64;
    } catch (e) { return null; }
}

export async function saveAnimationToDB(id, base64) {
    if (!db) return;
    const transaction = db.transaction(["animations"], "readwrite");
    const store = transaction.objectStore("animations");
    store.put({ id, base64 });
}

export async function getAnimationFromDB(id) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve(null);
        const transaction = db.transaction(["animations"], "readonly");
        const store = transaction.objectStore("animations");
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result?.base64);
        request.onerror = (e) => reject(e);
    });
}

// Cloud State Sync (The Core)
export async function saveState(isBackground = false) {
    if (!isBackground) console.log("💾 Saving State to Cloud...");
    const client = getDB();
    if (!client) return;

    try {
        const authRaw = localStorage.getItem('animtube_auth');
        if (!authRaw) return;
        const auth = JSON.parse(authRaw);
        if (!auth || !auth.isLoggedIn) return;

        // Save Folders
        for (const folder of state.folders) {
            if (state.deletedIds.has(folder.id)) continue;
            await client.from('folders').upsert([{
                id: folder.id,
                name: folder.name,
                ownedBy: folder.ownedBy || auth.user.login,
                assignedTo: folder.assignedTo,
                views: folder.views,
                revenue: folder.revenue,
                niche: folder.niche,
                avatar: folder.avatar,
                color: folder.color,
                prefix: folder.prefix,
                scriptPrefix: folder.scriptPrefix,
                splitPrefix: folder.splitPrefix,
                uploadLink: folder.uploadLink
            }]);
        }

        // Save Projects
        for (const project of state.projects) {
            if (state.deletedIds.has(project.id)) continue;
            const dbPayload = {
                id: project.id,
                folderId: project.folderId,
                name: project.name,
                status: project.status,
                data: {
                    scripts: project.scripts || [],
                    promptsList: project.promptsList || [],
                    results: project.results || [],
                    assets: project.assets || [],
                    audioId: project.audioId || null,
                    prefix: project.prefix || ""
                }
            };
            await client.from('projects').upsert([dbPayload]);
        }

        localStorage.setItem('animtube_state', JSON.stringify({
            folders: state.folders,
            projects: state.projects,
            userAvatars: state.userAvatars
        }));
    } catch (err) {
        console.error("Cloud Sync Failed:", err);
    }
}

export async function loadState() {
    const client = getDB();
    if (!client) return;

    try {
        const { data: cloudFolders } = await client.from('folders').select('*');
        const { data: cloudProjects } = await client.from('projects').select('*');
        const { data: aData } = await client.from('user_avatars').select('*');

        if (cloudFolders) {
            state.folders = cloudFolders.filter(f => !state.deletedIds.has(f.id));
        }

        if (cloudProjects) {
            state.projects = cloudProjects
                .filter(p => !state.deletedIds.has(p.id))
                .map(p => p.data ? { ...p, ...p.data } : p);
        }

        if (aData) {
            aData.forEach(row => {
                state.userAvatars[row.login] = row.avatar;
            });
        }

        localStorage.setItem('animtube_state', JSON.stringify({
            folders: state.folders,
            projects: state.projects,
            userAvatars: state.userAvatars
        }));
    } catch (err) {
        console.error("Load State Failed:", err);
    }
}

export function setupRealtimeSync(refreshCallbacks = {}) {
    const client = getDB();
    if (!client) return;

    console.log("📡 Initializing Full Realtime Sync...");

    client.channel('folders-all-events')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, payload => {
        if (payload.eventType === 'INSERT') {
            if (!state.folders.find(f => f.id == payload.new.id)) state.folders.push(payload.new);
        } else if (payload.eventType === 'UPDATE') {
            const idx = state.folders.findIndex(f => f.id == payload.new.id);
            if (idx !== -1) state.folders[idx] = { ...state.folders[idx], ...payload.new };
        } else if (payload.eventType === 'DELETE') {
            state.folders = state.folders.filter(f => f.id != payload.old.id);
        }
        if (refreshCallbacks.onFoldersChange) refreshCallbacks.onFoldersChange();
    })
    .subscribe();

    client.channel('projects-all-events')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const unpacked = payload.new.data ? { ...payload.new, ...payload.new.data } : payload.new;
            const idx = state.projects.findIndex(p => p.id == unpacked.id);
            if (idx === -1) state.projects.push(unpacked);
            else state.projects[idx] = { ...state.projects[idx], ...unpacked };
        } else if (payload.eventType === 'DELETE') {
            state.projects = state.projects.filter(p => p.id != payload.old.id);
        }
        if (refreshCallbacks.onProjectsChange) refreshCallbacks.onProjectsChange();
    })
    .subscribe();
}
