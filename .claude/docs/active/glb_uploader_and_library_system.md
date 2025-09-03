# GLB Uploader and Model Library System

## Overview

The GLB Uploader and Model Library system provides a complete workflow for uploading, inspecting, scaling, and managing 3D models in TigerBuilder. The system enables admins to upload GLB files to Supabase storage, configure real-world dimensions through an interactive inspector, and allows all users to browse and load models from the library into their 3D scenes.

## System Architecture

### Core Components

1. **Model Uploader** (`model-uploader.js`)
   - `ModelUploader`: Handles file uploads to Supabase storage
   - `ModelInspector`: Analyzes model dimensions and properties
   - `ScaleCalculator`: Converts units and validates scale factors
   - `ScaleVisualizer`: Provides visual references for scale validation
   - `InspectorWorkflow`: Orchestrates the complete upload→inspect→save workflow

2. **Model Library** (`model-library.js`)
   - `ModelLibrary`: Manages database queries and model filtering
   - `ModelLibraryBrowser`: Handles UI interactions and model loading

3. **Database Integration**
   - Supabase storage buckets for GLB files and images
   - Assets table with scale factors and dimensional metadata
   - Row Level Security for user permissions

## File Structure

```
BuilderProto/
├── model-uploader.js              # Upload and inspector system
├── model-library.js               # Library browser system
├── supabase_create_storage_buckets.sql  # Storage configuration
├── SETUP_UPLOADER.md              # Setup instructions
├── index.html                     # UI panels and integration
├── main.js                        # System initialization
└── ui-controls.js                 # Event handlers and UI logic
```

## User Interface

### Admin Panel Upload Section
- **Location**: Admin Tools panel (admin users only)
- **Upload Button**: "Upload GLB Model to Database"
- **Progress Indicator**: Shows upload status
- **Auto-launch**: Inspector opens automatically after upload

### Model Inspector Panel
- **Trigger**: Automatic after GLB upload
- **Features**:
  - Current model dimensions display
  - Real-world dimension input (inches, feet, cm, meters)
  - Live scale factor calculation and validation
  - Visual aids (reference human figure, bounding boxes)
  - Preview and reset functionality
  - Database save with complete metadata

### Model Library Panel
- **Location**: Floating panel beside controls (left: 310px)
- **Trigger**: "+ Add Model" button in 3D Scene Controls
- **Features**:
  - Search and filter functionality
  - Model list with dimensions and material info
  - Selected model details panel
  - Load model with saved scale factors

## Technical Implementation

### Upload Workflow

1. **File Selection**: Admin selects GLB file via upload input
2. **Storage Upload**: File uploaded to Supabase 'assets' bucket with unique filename
3. **Model Loading**: GLB loaded into Three.js scene for inspection
4. **Inspector Launch**: Model inspector panel opens automatically
5. **Scale Configuration**: User inputs known dimension and unit
6. **Preview**: Scale factor applied to model with visual feedback
7. **Database Save**: Complete metadata saved to assets table

### Library Workflow

1. **Library Access**: User clicks "+ Add Model" button
2. **Database Query**: Fetch all public models with metadata
3. **Model Display**: List models with search/filter capability
4. **Model Selection**: User clicks model to see details
5. **Model Loading**: Load GLB with saved scale factor applied
6. **Scene Integration**: Model placed using existing placement system

### Scale System Integration

- **Unit Convention**: 1 Three.js unit = 1 foot
- **Scale Factors**: Stored as multipliers in database (0.001 - 1000 range)
- **Automatic Application**: Saved scale factors applied during model loading
- **Visual Validation**: Human figure reference (6 feet tall) for scale confirmation

## Database Schema Integration

### Assets Table Extensions
```sql
-- Real-world dimensions
width_inches DECIMAL(8,2),
height_inches DECIMAL(8,2), 
depth_inches DECIMAL(8,2),

-- Scale information
model_scale_factor DECIMAL(10,6),
bounding_box_json JSONB,

-- Model metadata
material_count INTEGER,
triangle_count INTEGER,
editable_materials JSONB
```

### Storage Buckets
- **assets**: Public bucket for GLB files (50MB limit)
- **user-images**: Private bucket for texture uploads (10MB limit)

## Security and Permissions

### Upload Permissions
- **Admin/Superuser Only**: GLB uploads restricted to admin users
- **Authentication Required**: All operations require valid session
- **File Validation**: GLB file type validation and size limits

### Library Access
- **All Authenticated Users**: Can browse and load public models
- **Public Models Only**: Library shows only `is_public = true` assets
- **RLS Protection**: Database policies enforce access controls

## Performance Considerations

### Upload Optimization
- **Unique Filenames**: Timestamp-based naming prevents conflicts
- **Progress Feedback**: Visual upload progress indicators
- **Error Handling**: Comprehensive error reporting and recovery

### Library Performance
- **Lazy Loading**: Models fetched only when library opened
- **Search Debouncing**: 300ms delay on search input
- **Efficient Rendering**: Virtual scrolling for large model lists
- **Caching**: Model list cached after initial load

## Error Handling

### Upload Errors
- **Storage Failures**: Clear error messages for upload issues
- **File Size Limits**: 50MB limit with user notification
- **Invalid Files**: GLB validation with helpful feedback

### Library Errors
- **Network Issues**: Graceful degradation with retry options
- **Missing Models**: Clear messaging for empty library
- **Load Failures**: Detailed error reporting for model loading

## Integration Points

### Existing Systems
- **Model Loader**: Uses existing `placeModelOnFloor` function
- **Scene Management**: Integrates with current scene state
- **UI Controls**: Leverages existing control system patterns
- **Authentication**: Built on existing auth manager

### Three.js Integration
- **GLTFLoader**: Standard Three.js loader for GLB files
- **Scene Placement**: Consistent with existing model handling
- **Scale Application**: Proper Three.js scale transformations
- **Material Detection**: Compatible with existing material system

## Usage Workflow

### For Admins (Upload)
1. Log in with admin credentials
2. Navigate to Admin Tools panel
3. Click "Upload GLB Model to Database" 
4. Select GLB file
5. Wait for upload completion
6. Use inspector to set real-world scale
7. Save to database

### For All Users (Library)
1. Click "+ Add Model" in 3D Scene Controls
2. Browse available models in library panel
3. Use search to filter models
4. Click model to select and view details
5. Click "Load Model" to add to scene
6. Model appears with correct scale

## Maintenance and Updates

### Adding New Features
- **Category System**: Models can be categorized for better organization
- **Thumbnail Generation**: Automatic preview generation for models
- **Advanced Filtering**: Filter by dimensions, materials, date
- **Batch Operations**: Multiple model upload and management

### Performance Monitoring
- **Upload Metrics**: Track upload success rates and performance
- **Library Usage**: Monitor most accessed models
- **Error Tracking**: Log and analyze common failure points
- **Storage Management**: Monitor bucket usage and cleanup

## Troubleshooting

### Common Issues
1. **"Supabase client not available"**: Wait for auth system initialization
2. **Upload failures**: Check storage bucket configuration and permissions
3. **Inspector not opening**: Verify admin permissions and file upload success
4. **Library empty**: Ensure models are marked `is_public = true`
5. **Models loading incorrectly**: Check saved scale factors in database

### Debug Tools
- **Console Logging**: Comprehensive logging throughout system
- **Global Objects**: `window.uploaderWorkflow` and `window.libraryBrowser`
- **Network Tab**: Monitor Supabase API calls
- **Browser Storage**: Check authentication tokens

This system provides a complete solution for 3D model management in TigerBuilder, from admin upload and configuration to user browsing and scene integration.