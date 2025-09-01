// Environment variable injection for Netlify build
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL || 'https://ewpfujqymfzrwocaskxh.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3cGZ1anF5bWZ6cndvY2Fza3hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzNTczNjMsImV4cCI6MjA3MTkzMzM2M30.I5tmgljBFsA2waa8Y1cfPtHKAYLo9tPYBGydu0FRrAc';

// Create environment config file
const envScript = `
// Environment configuration - injected at build time
window.SUPABASE_URL = '${supabaseUrl}';
window.SUPABASE_ANON_KEY = '${supabaseKey}';
`;

// Write to env.js
fs.writeFileSync('env.js', envScript);

console.log('Environment variables injected successfully');