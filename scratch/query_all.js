
const SUPABASE_URL = "https://qyumcgwotdzalbsfdumh.supabase.co";
const SUPABASE_KEY = "sb_publishable_rMHUQggerdk7ixtXGSCvgA_0_SGQA8e";

async function listAll() {
    try {
        const fRes = await fetch(`${SUPABASE_URL}/rest/v1/folders?select=id,name`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const folders = await fRes.json();
        
        const pRes = await fetch(`${SUPABASE_URL}/rest/v1/projects?select=id,name,folderId`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const projects = await pRes.json();
        
        console.log('--- FOLDERS ---');
        folders.forEach(f => console.log(`[${f.id}] ${f.name}`));
        
        console.log('\n--- PROJECTS ---');
        projects.forEach(p => console.log(`[${p.id}] ${p.name} (Folder: ${p.folderId})`));
        
    } catch (err) {
        console.error(err);
    }
}

listAll();
