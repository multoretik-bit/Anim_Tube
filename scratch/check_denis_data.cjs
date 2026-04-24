
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://qyumcgwotdzalbsfdumh.supabase.co";
const SUPABASE_KEY = "sb_publishable_rMHUQggerdk7ixtXGSCvgA_0_SGQA8e";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkProjects() {
    console.log("Checking projects for Peppa Dark...");
    const { data: projects, error } = await supabase.from('projects').select('id, name, folderId').eq('folderId', 1776495875390);
    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${projects.length} projects for Peppa Dark (ID: 1776495875390)`);
    projects.forEach(p => console.log(`- ${p.name} (ID: ${p.id})`));
}

checkProjects();
