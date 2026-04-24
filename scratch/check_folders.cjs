
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://qyumcgwotdzalbsfdumh.supabase.co";
const SUPABASE_KEY = "sb_publishable_rMHUQggerdk7ixtXGSCvgA_0_SGQA8e";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkFolders() {
    console.log("Checking folders table...");
    const { data: folders, error } = await supabase.from('folders').select('*').limit(5);
    
    if (error) {
        console.error("❌ Error fetching folders:", error);
        return;
    }

    if (folders && folders.length > 0) {
        console.log("✅ Sample folder data:");
        console.log(JSON.stringify(folders[0], null, 2));
        
        console.log("\nColumn types (inferred from first row):");
        Object.entries(folders[0]).forEach(([key, value]) => {
            console.log(`- ${key}: ${typeof value} (${value})`);
        });
    } else {
        console.log("ℹ️ No folders found.");
    }
}

checkFolders();
