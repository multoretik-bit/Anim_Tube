// === AnimTube Studio v2.0 - Configuration & State ===
export const SUPABASE_URL = "https://qyumcgwotdzalbsfdumh.supabase.co";
export const SUPABASE_KEY = "sb_publishable_rMHUQggerdk7ixtXGSCvgA_0_SGQA8e";


export const WHITELIST = [
    { login: "Denis", pass: "8888", code: "X-777-X", role: "owner", ip: "*" },
    { login: "Alex", pass: "1234", code: "A-123-A", role: "partner", ip: "*" },
    { login: "Maria", pass: "4321", code: "M-432-M", role: "manager", ip: "*" },
    { login: "Test", pass: "0000", code: "T-000-T", role: "partner", ip: "*" }
];

export const DEFAULT_PREFIX = "Create an image that closely resembles the style of the Peppa Pig cartoon, using the settings and art style of the Peppa Pig animated series: No text and a 1920×1080 frame. ";

// Global Application State
export let state = {
    folders: [],
    projects: [],
    activePage: 'account',
    activeProjectId: null,
    activeProjectTab: 'script',
    currentFolderId: null,
    userAvatars: {},
    deletedIds: new Set(JSON.parse(localStorage.getItem('animtube_deleted_ids') || '[]')),
    
    assembly: {
        isRunning: false,
        queue: [],
        currentIdx: 0,
        timerId: null,
        lockedProjectId: null,
        superAuto: {
            active: false,
            count: 0,
            phase: 'idle',
            splittingIdx: 0
        }
    }
};

// Persistence for deleted IDs
export function saveDeletedIds() {
    localStorage.setItem('animtube_deleted_ids', JSON.stringify(Array.from(state.deletedIds)));
}
