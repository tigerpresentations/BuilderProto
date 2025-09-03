# GLB Uploader Setup Instructions

Before using the GLB uploader and inspector system, you need to set up Supabase storage buckets.

## Step 1: Create Storage Buckets

Run the following SQL in your Supabase SQL Editor:

```sql
-- Execute the contents of supabase_create_storage_buckets.sql
```

Or manually execute:
1. Open `supabase_create_storage_buckets.sql`
2. Copy all contents
3. Paste into Supabase SQL Editor
4. Click "Run"

This will create:
- `assets` bucket for GLB files (public, 50MB limit)
- `user-images` bucket for user uploads (private, 10MB limit)
- Proper RLS policies for secure access

## Step 2: Verify Admin Access

1. Log into the application with an admin account
2. Check that you see the "🔐 Admin Tools" panel
3. Confirm the "Upload GLB Model to Database" option is visible

## Step 3: Test Upload

1. Click "Choose GLB to Upload" in the admin panel
2. Select a GLB file
3. The inspector should automatically open
4. Configure real-world dimensions
5. Click "Save to Database"

## Troubleshooting

**"Supabase client not available"**:
- Wait 2-3 seconds for auth system to initialize
- Check browser console for detailed error messages
- Verify you're logged in with admin privileges

**Upload fails**:
- Ensure storage buckets are created (Step 1)
- Check file size limits (50MB for GLB files)
- Verify admin user permissions in Supabase

**Inspector doesn't open**:
- Check browser console for JavaScript errors
- Verify all script files are loaded correctly
- Ensure you have a stable internet connection

## Console Debugging

Open browser developer tools and check for:
- "✅ Initializing uploader and inspector system..."
- "✅ Uploader workflow created successfully"

If you see retry messages, wait for initialization to complete.