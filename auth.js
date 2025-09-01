// Simple Supabase Authentication for GLB Scene Editor
// Minimal email/password authentication with login/logout functionality

class AuthManager {
    constructor() {
        // Environment variables (will be replaced at build time by Netlify)
        this.supabaseUrl = window.SUPABASE_URL || 'https://ewpfujqymfzrwocaskxh.supabase.co';
        this.supabaseKey = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3cGZ1anF5bWZ6cndvY2Fza3hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzNTczNjMsImV4cCI6MjA3MTkzMzM2M30.I5tmgljBFsA2waa8Y1cfPtHKAYLo9tPYBGydu0FRrAc';
        
        this.supabase = null;
        this.currentUser = null;
        
        this.initializeSupabase();
        this.setupEventListeners();
        this.checkAuthState();
    }

    initializeSupabase() {
        // Initialize Supabase client
        if (typeof supabase !== 'undefined') {
            this.supabase = supabase.createClient(this.supabaseUrl, this.supabaseKey);
        } else {
            console.error('Supabase client not loaded. Make sure to include the Supabase CDN script.');
            return;
        }
    }

    setupEventListeners() {
        // Login form submission
        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Logout button
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.handleLogout();
        });
    }

    async checkAuthState() {
        if (!this.supabase) return;
        
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            this.currentUser = user;
            this.updateUI();
            
            // Listen for auth changes
            this.supabase.auth.onAuthStateChange((event, session) => {
                this.currentUser = session?.user || null;
                this.updateUI();
                
                if (event === 'SIGNED_IN') {
                    showNotification('✓ Logged in successfully', 'success', 3000);
                } else if (event === 'SIGNED_OUT') {
                    showNotification('Logged out', 'info', 2000);
                }
            });
        } catch (error) {
            console.error('Error checking auth state:', error);
        }
    }

    async handleLogin() {
        if (!this.supabase) {
            showNotification('Authentication service not available', 'error', 3000);
            return;
        }

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            showNotification('Please enter email and password', 'warning', 3000);
            return;
        }

        try {
            showNotification('Logging in...', 'info', 2000);
            
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                throw error;
            }

            // Clear form
            document.getElementById('loginForm').reset();
            
        } catch (error) {
            console.error('Login error:', error);
            showNotification('Login failed: ' + error.message, 'error', 5000);
        }
    }

    async handleLogout() {
        if (!this.supabase) return;

        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            
        } catch (error) {
            console.error('Logout error:', error);
            showNotification('Logout failed: ' + error.message, 'error', 3000);
        }
    }

    updateUI() {
        const authSection = document.getElementById('authSection');
        const loginForm = document.getElementById('loginForm');
        const userInfo = document.getElementById('userInfo');
        const sceneStatus = document.getElementById('sceneStatus');
        
        if (!authSection) return;

        if (this.currentUser) {
            // User is logged in
            loginForm.style.display = 'none';
            userInfo.style.display = 'block';
            
            document.getElementById('userEmail').textContent = this.currentUser.email;
            
            // Update scene status to show logged in state
            const currentStatus = sceneStatus ? sceneStatus.textContent : '';
            const statusElement = sceneStatus || document.getElementById('status');
            if (statusElement && !currentStatus.includes('•')) {
                statusElement.textContent = `${currentStatus} • ✓ ${this.currentUser.email}`;
                statusElement.style.color = '#28a745'; // Green color for logged in state
            }
        } else {
            // User is not logged in
            loginForm.style.display = 'block';
            userInfo.style.display = 'none';
            
            // Remove login info from scene status
            const statusElement = sceneStatus || document.getElementById('status');
            if (statusElement) {
                const statusText = statusElement.textContent;
                const cleanStatus = statusText.split(' • ')[0];
                statusElement.textContent = cleanStatus;
                statusElement.style.color = '#666'; // Reset to default color
            }
        }
    }

    // Utility method to check if user is authenticated
    isAuthenticated() {
        return !!this.currentUser;
    }

    // Get current user info
    getCurrentUser() {
        return this.currentUser;
    }
}

// Initialize auth manager when DOM is ready
let authManager;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        authManager = new AuthManager();
    });
} else {
    authManager = new AuthManager();
}