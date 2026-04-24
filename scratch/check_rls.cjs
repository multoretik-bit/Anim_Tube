
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://qyumcgwotdzalbsfdumh.supabase.co";
const SUPABASE_KEY = "sb_publishable_rMHUQggerdk7ixtXGSCvgA_0_SGQA8e";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkRLS() {
    console.log("Checking RLS and permissions...");
    
    // 1. Get a folder
    const { data: folders } = await supabase.from('folders').select('*').limit(1);
    if (!folders || folders.length === 0) return console.log("No folders found");
    
    const folder = folders[0];
    console.log(`Testing update on folder: ${folder.name} (Owned by: ${folder.ownedBy || folder.ownedby})`);
    
    // 2. Try update
    const testViews = (folder.views || 0) + 1;
    const { data, error } = await supabase.from('folders')
        .update({ views: testViews })
        .eq('id', folder.id)
        .select();
        
    if (error) {
        console.error("❌ Update failed:", error);
    } else if (data && data.length > 0) {
        console.log("✅ Update successful!", data[0].views);
    } else {
        console.log("⚠️ Update returned NO DATA (likely RLS blocked or ID mismatch)");
    }
}

checkRLS();
