# Supabase Schema for 3D Asset Management

## Problem Analysis

TigerBuilder requires a database schema that efficiently stores 3D model metadata, real-world dimensions, scaling factors, and relationships between models and user designs. The schema must support asset management, design persistence, and user authentication while optimizing for web application performance.

## Recommended Database Schema

### **Core Tables Structure**

```sql
-- Users table (handled by Supabase Auth automatically)
-- Additional user metadata if needed
CREATE TABLE user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    display_name VARCHAR(255),
    company_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Asset categories for organization
CREATE TABLE asset_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_category_id INTEGER REFERENCES asset_categories(id),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3D Assets with dimensional metadata
CREATE TABLE assets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES asset_categories(id),
    
    -- File information
    file_url VARCHAR(500) NOT NULL, -- Supabase Storage URL
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) DEFAULT 'model/gltf-binary',
    
    -- Real-world dimensions (inches)
    width_inches DECIMAL(8,2),
    height_inches DECIMAL(8,2),
    depth_inches DECIMAL(8,2),
    
    -- Three.js scale information
    model_scale_factor DECIMAL(10,6), -- Multiplier to achieve real-world scale
    bounding_box_json JSONB, -- Original model bounds before scaling
    
    -- Model metadata
    material_count INTEGER,
    triangle_count INTEGER,
    editable_materials JSONB DEFAULT '[]', -- Array of material names that accept textures
    
    -- Asset management
    is_public BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User designs (saved configurations)
CREATE TABLE designs (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Design data
    asset_id INTEGER NOT NULL REFERENCES assets(id),
    model_position JSONB DEFAULT '{"x": 0, "y": 0, "z": 0}',
    model_rotation JSONB DEFAULT '{"x": 0, "y": 0, "z": 0}',
    model_scale DECIMAL(6,3) DEFAULT 1.0,
    
    -- Image overlay data
    applied_images JSONB DEFAULT '[]', -- Array of image overlay configurations
    
    -- Rendering settings
    background_color VARCHAR(7) DEFAULT '#cccccc',
    lighting_config JSONB DEFAULT '{}',
    
    -- Metadata
    thumbnail_url VARCHAR(500), -- Generated preview image
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Image uploads for texture application
CREATE TABLE image_assets (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    design_id INTEGER REFERENCES designs(id),
    
    -- File information
    file_url VARCHAR(500) NOT NULL, -- Supabase Storage URL
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100),
    
    -- Image properties
    width_pixels INTEGER,
    height_pixels INTEGER,
    
    -- Usage tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Row Level Security (RLS) Policies**

```sql
-- Enable RLS on all user-related tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_assets ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own profile" 
    ON user_profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON user_profiles FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Users can view own designs" 
    ON designs FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view public designs" 
    ON designs FOR SELECT 
    USING (is_public = true);

CREATE POLICY "Users can manage own images" 
    ON image_assets FOR ALL 
    USING (auth.uid() = user_id);

-- Public assets are viewable by all authenticated users
CREATE POLICY "Authenticated users can view public assets" 
    ON assets FOR SELECT 
    USING (is_public = true);
```

### **Indexes for Performance**

```sql
-- Primary lookup indexes
CREATE INDEX idx_assets_category ON assets(category_id);
CREATE INDEX idx_assets_public ON assets(is_public) WHERE is_public = true;
CREATE INDEX idx_designs_user ON designs(user_id);
CREATE INDEX idx_designs_asset ON designs(asset_id);
CREATE INDEX idx_designs_public ON designs(is_public) WHERE is_public = true;
CREATE INDEX idx_image_assets_user ON image_assets(user_id);
CREATE INDEX idx_image_assets_design ON image_assets(design_id);

-- Search optimization
CREATE INDEX idx_assets_search ON assets USING gin(to_tsvector('english', name || ' ' || coalesce(description, '')));
```

## Schema Design Rationale

### **Dimensional Storage Strategy**
- Store real-world dimensions in inches for precision and consistency
- Use DECIMAL type to avoid floating-point precision issues
- Include model_scale_factor for efficient runtime scaling
- Store original bounding box for reference and validation

### **JSONB Usage**
- **applied_images**: Flexible storage for image overlay configurations (position, scale, z-index, opacity)
- **editable_materials**: Array of material names that accept user textures
- **bounding_box_json**: Original model bounds for scale calculations
- **model_position/rotation**: 3D transform data with precise decimal storage

### **File Management Integration**
- Store Supabase Storage URLs directly in file_url fields
- Track file sizes for storage quota management
- Maintain file names for user-friendly displays
- Support multiple image uploads per design

### **Performance Optimizations**
- Separate images table to avoid large JSONB fields
- Strategic indexes on common query patterns
- RLS policies for security without performance impact
- Public asset caching through is_public flag

## Query Patterns and Examples

### **Asset Loading with Dimensions**
```sql
SELECT 
    a.*,
    c.name as category_name
FROM assets a
LEFT JOIN asset_categories c ON a.category_id = c.id
WHERE a.is_public = true
ORDER BY a.name;
```

### **User Design with Applied Images**
```sql
SELECT 
    d.*,
    a.name as asset_name,
    a.file_url as asset_url,
    a.model_scale_factor,
    json_agg(i.*) as images
FROM designs d
JOIN assets a ON d.asset_id = a.id
LEFT JOIN image_assets i ON i.design_id = d.id
WHERE d.user_id = $1
GROUP BY d.id, a.name, a.file_url, a.model_scale_factor;
```

## Migration Strategy

### **Initial Data Seeding**
```sql
-- Default asset categories
INSERT INTO asset_categories (name, description) VALUES
('Trade Show Displays', 'Standard booth displays and structures'),
('Furniture', 'Tables, chairs, and display furniture'),
('Signage', 'Signs, banners, and informational displays'),
('Technology', 'Screens, kiosks, and interactive elements');
```

### **Data Validation Functions**
```sql
-- Ensure scale factors are reasonable
ALTER TABLE assets ADD CONSTRAINT reasonable_scale_factor 
    CHECK (model_scale_factor BETWEEN 0.001 AND 1000.0);

-- Ensure dimensions are positive
ALTER TABLE assets ADD CONSTRAINT positive_dimensions 
    CHECK (width_inches > 0 AND height_inches > 0 AND depth_inches > 0);
```

## Integration with Supabase Features

### **Storage Buckets**
```javascript
// Create storage buckets for file organization
await supabase.storage.createBucket('assets', {
    public: true,
    fileSizeLimit: 50 * 1024 * 1024 // 50MB limit for GLB files
});

await supabase.storage.createBucket('user-images', {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024 // 10MB limit for user uploads
});
```

### **Real-time Subscriptions**
```javascript
// Listen for design updates for collaborative editing
const designSubscription = supabase
    .channel('design-changes')
    .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'designs' },
        handleDesignUpdate
    )
    .subscribe();
```

## References

- Supabase documentation on Row Level Security
- PostgreSQL JSONB performance optimization guides
- Database indexing strategies for web applications
- File storage best practices for 3D assets