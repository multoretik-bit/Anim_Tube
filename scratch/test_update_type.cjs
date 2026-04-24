
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://qyumcgwotdzalbsfdumh.supabase.co";
const SUPABASE_KEY = "sb_publishable_rMHUQggerdk7ixtXGSCvgA_0_SGQA8e";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testUpdate() {
    // 1. Get a folder ID
    const { data: folders } = await supabase.from('folders').select('id, views').limit(1);
    if (!folders || folders.length === 0) return console.log("No folders found");
    
    const folderId = folders[0].id;
    const currentViews = folders[0].views;
    console.log(`Current ID: ${folderId} (type: ${typeof folderId}), Views: ${currentViews}`);
    
    // 2. Try update with Number
    console.log(`Trying update with Number: ${Number(folderId)}`);
    const { data: dNum, error: eNum } = await supabase.from('folders').update({ views: currentViews }).eq('id', Number(folderId)).select();
    console.log(`Update with Number result: rows updated = ${dNum ? dNum.length : 0}`);
    
    // 3. Try update with String
    console.log(`Trying update with String: "${String(folderId)}"`);
    const { data: dStr, error: eStr } = await supabase.from('folders').update({ views: currentViews }).eq('id', String(folderId)).select();
    console.log(`Update with String result: rows updated = ${dStr ? dStr.length : 0}`);
}

testUpdate();
