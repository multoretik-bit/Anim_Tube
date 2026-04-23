
const SUPABASE_URL = "https://qyumcgwotdzalbsfdumh.supabase.co";
const SUPABASE_KEY = "sb_publishable_rMHUQggerdk7ixtXGSCvgA_0_SGQA8e";

async function listFolders() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/folders?select=id,name,assignedTo,ownedBy`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (!response.ok) {
            const text = await response.text();
            console.error('Error fetching folders:', response.status, text);
            return;
        }
        
        const data = await response.json();
        
        console.log('--- FOLDERS ---');
        data.forEach(f => {
            console.log(`ID: ${f.id} | Name: ${f.name} | AssignedTo: ${f.assignedTo} | OwnedBy: ${f.ownedBy}`);
        });
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

listFolders();
