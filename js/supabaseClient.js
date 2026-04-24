// script.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://owgldsfxpmzpkipgeksr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Z2xkc2Z4cG16cGtpcGdla3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDM2NTYsImV4cCI6MjA5MjM3OTY1Nn0.bD5dNHcQfjjq29DprTnVafxuZeCvt30zu0qQItq6AXY'
export const supabase = createClient(supabaseUrl, supabaseKey)

console.log("Supabase client initialized!", supabase)

async function checkConnection() {
    try {
        // This attempts to fetch the current session (auth check)
        const { data, error } = await supabase.auth.getSession();

        if (error) {
            console.error("❌ Connection error:", error.message);
        } else {
            console.log("✅ Successfully connected to Supabase!");
            console.log("Session Data:", data);
        }
    } catch (err) {
        console.error("❌ Unexpected error:", err);
    }
}

checkConnection();