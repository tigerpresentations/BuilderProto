# Supabase Schema Implementation Guide

## Prerequisites

1. **Supabase Project**: Ensure you have a Supabase project created
2. **Database Access**: Access to the SQL Editor in your Supabase dashboard
3. **Authentication**: Supabase Auth should be enabled (it's enabled by default)

## Step-by-Step Implementation

### Step 1: Execute Main Schema
1. Open your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase_schema.sql`
4. Paste into a new query
5. Click **Run** to execute

Expected result: All tables, policies, indexes, and initial data should be created.

### Step 2: Apply User Groups Migration
1. In SQL Editor, copy the contents of `supabase_user_groups_migration.sql`
2. Paste into a new query
3. Click **Run** to execute

Expected result: User types, groups, and group-based sharing functionality added.

### Step 3: Verify Implementation
1. In SQL Editor, copy the contents of `supabase_test_queries.sql`
2. Run the verification queries section by section
3. Confirm all tables exist and have the expected structure
4. Run `supabase_user_groups_test_queries.sql` to verify group functionality

### Step 4: Test Basic Operations
Replace the placeholder UUID in the test queries with an actual user ID:

```sql
-- Get a test user ID (if you have users)
SELECT id FROM auth.users LIMIT 1;

-- Use that ID in the asset insertion test
```

## Expected Schema Structure

### Tables Created:
- ✅ `user_profiles` - Extended user metadata with user types and group associations
- ✅ `asset_categories` - Hierarchical asset organization  
- ✅ `assets` - 3D models with dimensional metadata and group sharing
- ✅ `designs` - User-saved model configurations with group sharing
- ✅ `image_assets` - User-uploaded texture images
- ✅ `user_groups` - Company/team organizations
- ✅ `user_group_memberships` - User roles within groups

### Security Features:
- ✅ Row Level Security enabled on user-related tables
- ✅ Users can only access their own designs and images
- ✅ Public assets visible to all authenticated users
- ✅ Users can view public designs but not modify them
- ✅ Group-based sharing for company collaboration
- ✅ Role-based permissions (Viewer, User, Admin, Superuser)
- ✅ Admins can manage group memberships and create groups

### Performance Features:
- ✅ Strategic indexes on common query patterns
- ✅ Full-text search on asset names and descriptions
- ✅ Optimized filtering for public/private content

### Data Validation:
- ✅ Scale factors constrained to reasonable values (0.001 - 1000.0)
- ✅ Dimensions must be positive numbers
- ✅ Foreign key constraints ensure referential integrity
- ✅ Unique constraints prevent duplicate group memberships
- ✅ User type enum ensures valid role assignments

## Testing Checklist

After implementation, verify these operations work:

- [ ] Insert asset categories (should already be seeded)
- [ ] Insert sample asset with dimensions
- [ ] Create user design referencing the asset
- [ ] Verify RLS prevents unauthorized access
- [ ] Confirm indexes improve query performance
- [ ] Test full-text search functionality
- [ ] Create a test company group
- [ ] Add users to groups with different roles
- [ ] Test group-based design sharing
- [ ] Verify admin permissions for group management
- [ ] Test helper functions (is_group_admin, get_user_groups)

## Troubleshooting

### Common Issues:

**Permission Errors:**
- Ensure you're running queries as a database administrator
- Check that authentication is properly configured

**Constraint Violations:**
- Verify test data meets the defined constraints
- Check that referenced foreign keys exist

**RLS Policy Issues:**
- Policies require authenticated users to test properly
- Use Supabase Auth to create test users if needed
- Group policies require users to be assigned to groups

**Group Permission Errors:**
- Only Admin and Superuser roles can create groups or manage memberships
- Ensure users have proper roles assigned before testing admin functions
- Group sharing requires users to belong to the same group

### Verification Queries:

```sql
-- Check table creation
SELECT count(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('user_profiles', 'asset_categories', 'assets', 'designs', 'image_assets', 'user_groups', 'user_group_memberships');
-- Should return: 7

-- Check initial data
SELECT count(*) FROM asset_categories;
-- Should return: 4

-- Check user type enum
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_type'::regtype;
-- Should return: Viewer, User, Admin, Superuser

-- Check indexes
SELECT count(*) FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('assets', 'designs', 'image_assets', 'user_group_memberships', 'user_profiles');
-- Should return: 13+ indexes
```

## User Types and Permissions

### Role Hierarchy:
- **Viewer**: Read-only access to group shared content
- **User**: Can create and share designs within their group
- **Admin**: Can manage group memberships, create groups, moderate content
- **Superuser**: Full administrative access across all groups

### Group Workflow:
1. Create a company group (Admin/Superuser only)
2. Invite users and assign appropriate roles
3. Users can share designs with their group by setting `shared_with_group = true`
4. Group members can view shared designs from other group members
5. Admins can create group-specific assets by setting `is_group_shared = true`

## Next Steps

Once the schema is verified:

1. **Storage Buckets**: Create buckets for GLB files and images
2. **Authentication Flow**: Implement user registration/login with group assignment
3. **API Integration**: Connect your TigerBuilder frontend with group context
4. **File Uploads**: Test asset and image upload workflows
5. **Real-time Features**: Add subscriptions for collaborative editing
6. **Group Management UI**: Build interfaces for group administration
7. **Permission Testing**: Verify role-based access controls work correctly

## File Structure

```
BuilderProto/
├── supabase_schema.sql                  # Main schema implementation
├── supabase_user_groups_migration.sql   # User types and groups extension
├── supabase_test_queries.sql            # Core schema verification
├── supabase_user_groups_test_queries.sql # Group functionality testing
├── supabase_implementation_guide.md     # This guide
└── [existing application files]
```