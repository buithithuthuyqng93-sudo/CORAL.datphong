-- ============================================================================
-- SEAGULL LÝ SƠN — CONTACT MESSAGES TABLE (Trang Liên hệ /lien-he -> /admin)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'contacted', 'done')),
    source VARCHAR(50) NOT NULL DEFAULT 'website_contact_page',
    handled_by VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
    ON public.contact_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created_at
    ON public.contact_messages (status, created_at DESC);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Restrict direct anon access; backend API uses service_role key with validation & RBAC
DROP POLICY IF EXISTS "Service role full access on contact_messages" ON public.contact_messages;
CREATE POLICY "Service role full access on contact_messages"
    ON public.contact_messages
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
