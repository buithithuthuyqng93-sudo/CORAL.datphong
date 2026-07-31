-- ====================================================================
-- HOMESTAY & CAFE CORAL LÝ SƠN - MEDIA MANAGER SCHEMA & STORAGE BUCKET
-- Target Database: Supabase PostgreSQL
-- ====================================================================

-- 1. TABLE: media_assets (Quản lý các tệp media đã tải lên)
CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    storage_bucket VARCHAR(100) NOT NULL DEFAULT 'site-media',
    storage_path VARCHAR(500) NOT NULL,
    public_url TEXT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    width INT,
    height INT,
    alt_text TEXT DEFAULT '',
    category VARCHAR(100) NOT NULL DEFAULT 'general', -- 'hero', 'logo', 'about', 'rooms', 'room-galleries', 'amenities', 'cafe', 'locations', 'general'
    entity_type VARCHAR(100) DEFAULT 'general', -- 'room_type', 'site_content'
    entity_id VARCHAR(100) DEFAULT '',
    display_order INT DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    uploaded_by VARCHAR(255) DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast query by category/entity
CREATE INDEX IF NOT EXISTS idx_media_assets_category ON public.media_assets(category, active);
CREATE INDEX IF NOT EXISTS idx_media_assets_entity ON public.media_assets(entity_type, entity_id);

-- 2. TABLE: site_content (Lưu trữ nội dung & mapping ảnh các vị trí cố định)
CREATE TABLE IF NOT EXISTS public.site_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_key VARCHAR(150) UNIQUE NOT NULL, -- e.g. 'homepage.hero.desktop', 'homepage.hero.mobile', 'homepage.logo', 'homepage.about.image', 'homepage.cafe.image', 'homepage.location.image'
    content_type VARCHAR(50) NOT NULL DEFAULT 'image', -- 'image', 'text', 'json'
    media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    text_value TEXT,
    metadata JSONB DEFAULT '{}'::jsonb, -- e.g. {"focalPoint": {"x": 50, "y": 50}, "altText": "..."}
    updated_by VARCHAR(255) DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast key lookup
CREATE INDEX IF NOT EXISTS idx_site_content_key ON public.site_content(content_key);

-- 3. TABLE: media_history (Lưu lịch sử thay đổi để khôi phục ảnh cũ)
CREATE TABLE IF NOT EXISTS public.media_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_key VARCHAR(150) NOT NULL,
    previous_media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    new_media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    changed_by VARCHAR(255) DEFAULT 'admin',
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. SEED DEFAULT SITE CONTENT KEYS
INSERT INTO public.site_content (content_key, content_type, text_value, metadata)
VALUES 
    ('homepage.hero.desktop', 'image', '/images/coral-hero.jpg', '{"focalPoint": {"x": 50, "y": 50}, "altText": "Toàn cảnh Homestay & CAFE CORAL Lý Sơn"}'),
    ('homepage.hero.mobile', 'image', '/images/coral-hero.jpg', '{"focalPoint": {"x": 50, "y": 50}, "altText": "Toàn cảnh Homestay & CAFE CORAL Lý Sơn"}'),
    ('homepage.logo', 'image', '/images/coral-hero.jpg', '{"altText": "Logo Homestay & CAFE CORAL Lý Sơn"}'),
    ('homepage.about.image', 'image', '/images/bungalow-row-sunset.jpg', '{"altText": "Dãy Bungalow Vòm Vách Núi Hoàng Hôn"}'),
    ('homepage.cafe.image', 'image', '/images/bungalow-sunset-front.jpg', '{"altText": "Khu Cà Phê Vòm Ngắm Hoàng Hôn Đại Dương"}'),
    ('homepage.location.image', 'image', '/images/bungalow-cliff-day.jpg', '{"altText": "Vị trí vách núi ngắm hoàng hôn Lý Sơn"}')
ON CONFLICT (content_key) DO NOTHING;

-- 5. SUPABASE STORAGE BUCKET CREATION (site-media)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'site-media',
    'site-media',
    true,
    8388608, -- 8MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- 6. ROW LEVEL SECURITY (RLS) POLICIES FOR MEDIA TABLES & STORAGE

-- Enable RLS
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_history ENABLE ROW LEVEL SECURITY;

-- Public read access for active media and site content
CREATE POLICY "Public Read Active Media" ON public.media_assets
    FOR SELECT USING (active = true);

CREATE POLICY "Public Read Site Content" ON public.site_content
    FOR SELECT USING (true);

-- Admin full management policies
CREATE POLICY "Admin All Media Assets" ON public.media_assets
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Admin All Site Content" ON public.site_content
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Admin All Media History" ON public.media_history
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Storage Bucket Policies
CREATE POLICY "Public Read Site Media Storage" ON storage.objects
    FOR SELECT USING (bucket_id = 'site-media');

CREATE POLICY "Admin Insert Site Media Storage" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'site-media');

CREATE POLICY "Admin Update Site Media Storage" ON storage.objects
    FOR UPDATE USING (bucket_id = 'site-media');

CREATE POLICY "Admin Delete Site Media Storage" ON storage.objects
    FOR DELETE USING (bucket_id = 'site-media');
