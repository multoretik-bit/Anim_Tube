
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://qyumcgwotdzalbsfdumh.supabase.co";
const SUPABASE_KEY = "sb_publishable_rMHUQggerdk7ixtXGSCvgA_0_SGQA8e";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAllProjects() {
    console.log("Checking all projects in DB...");
    const { data: projects, error } = await supabase.from('projects').select('id, name, folderId');
    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Total projects in DB: ${projects.length}`);
    projects.forEach(p => console.log(`- ${p.name} (ID: ${p.id}), FolderID: ${p.folderId}`));
}

checkAllProjects();
