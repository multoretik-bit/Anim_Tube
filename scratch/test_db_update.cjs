
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://qyumcgwotdzalbsfdumh.supabase.co";
const SUPABASE_KEY = "sb_publishable_rMHUQggerdk7ixtXGSCvgA_0_SGQA8e";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testUpdate() {
    console.log("Testing update for 'Hiden Pig' (ID: 1776856624235)...");
    const { data, error } = await supabase.from('folders')
        .update({ views: 113200 })
        .eq('id', 1776856624235)
        .select();

    if (error) {
        console.error("❌ Update failed:", error.message, error.details, error.hint);
    } else {
        console.log("✅ Update successful:", data);
    }
}

testUpdate();
