// Simple Supabase Authentication for GLB Scene Editor
// Minimal email/password authentication with login/logout functionality

class AuthManager {
    constructor() {
        // Environment variables (will be replaced at build time by Netlify)
        this.supabaseUrl = window.SUPABASE_URL || 'https://ewpfujqymfzrwocaskxh.supabase.co';
        this.supabaseKey = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3cGZ1anF5bWZ6cndvY2Fza3hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzNTczNjMsImV4cCI6MjA3MTkzMzM2M30.I5tmgljBFsA2waa8Y1cfPtHKAYLo9tPYBGydu0FRrAc';
        
        this.supabase = null;
        this.currentUser = null;
        this.userProfile = null;
        
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
            
            // Fetch user profile with user type if logged in
            if (user) {
                await this.fetchUserProfile(user.id);
            }
            
            this.updateUI();
            
            // Listen for auth changes
            this.supabase.auth.onAuthStateChange(async (event, session) => {
                this.currentUser = session?.user || null;
                
                if (this.currentUser) {
                    await this.fetchUserProfile(this.currentUser.id);
                } else {
                    this.userProfile = null;
                }
                
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

    async fetchUserProfile(userId) {
        if (!this.supabase) return;
        
        try {
            const { data, error } = await this.supabase
                .from('user_profiles')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (error) {
                console.error('Error fetching user profile:', error);
                // Create profile if it doesn't exist
                if (error.code === 'PGRST116') {
                    await this.createUserProfile(userId);
                }
            } else {
                this.userProfile = data;
            }
        } catch (error) {
            console.error('Error in fetchUserProfile:', error);
        }
    }
    
    async createUserProfile(userId) {
        if (!this.supabase || !this.currentUser) return;
        
        try {
            const { data, error } = await this.supabase
                .from('user_profiles')
                .insert({
                    id: userId,
                    display_name: this.currentUser.email?.split('@')[0],
                    user_type: 'User' // Default to User type
                })
                .select()
                .single();
            
            if (!error) {
                this.userProfile = data;
            }
        } catch (error) {
            console.error('Error creating user profile:', error);
        }
    }
    
    isAdmin() {
        return this.userProfile?.user_type === 'Admin' || this.userProfile?.user_type === 'Superuser';
    }
    
    async handleLogout() {
        if (!this.supabase) return;

        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            
            this.userProfile = null;
            
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
            
            // Show/hide admin panel based on user type
            const adminPanel = document.getElementById('admin-panel');
            
            if (adminPanel) {
                const isAdmin = this.isAdmin();
                adminPanel.style.display = isAdmin ? 'block' : 'none';
                
                // Update admin status display
                const adminUserType = document.getElementById('admin-user-type');
                const adminUserGroup = document.getElementById('admin-user-group');
                if (adminUserType) {
                    adminUserType.textContent = this.userProfile?.user_type || 'User';
                }
                if (adminUserGroup) {
                    adminUserGroup.textContent = this.userProfile?.company_name || 'No Group';
                }
            }
            
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