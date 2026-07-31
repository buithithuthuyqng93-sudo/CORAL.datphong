import { Request, Response } from 'express';
import { getSupabaseServerClient, isSupabaseConfigured } from './lib/supabaseServer';

/**
 * Express handler for media API: /api/media
 */
export default async function mediaHandler(req: Request, res: Response) {
  const { method } = req;
  const action = (req.query.action as string) || req.body?.action;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!isSupabaseConfigured()) {
    return res.status(200).json({
      success: true,
      isDemo: true,
      message: 'Supabase storage is not configured. Running in Demo mode.',
      contentMap: {},
    });
  }

  const supabase = getSupabaseServerClient();

  try {
    // 1. GET ALL SITE CONTENT MAP
    if (method === 'GET' || action === 'get-all') {
      const { data: contents, error: contentError } = await supabase
        .from('site_content')
        .select(`
          id,
          content_key,
          content_type,
          media_asset_id,
          text_value,
          metadata,
          updated_by,
          updated_at,
          media_assets (
            id,
            public_url,
            storage_path,
            alt_text,
            original_filename,
            mime_type,
            file_size
          )
        `);

      if (contentError) {
        console.error('[Media API Error]:', contentError);
        return res.status(500).json({ success: false, error: contentError.message });
      }

      const contentMap: Record<string, any> = {};
      if (contents) {
        contents.forEach((item: any) => {
          const media = item.media_assets;
          contentMap[item.content_key] = {
            id: item.id,
            contentKey: item.content_key,
            contentType: item.content_type,
            mediaAssetId: item.media_asset_id,
            textValue: media?.public_url || item.text_value,
            metadata: item.metadata || {},
            updatedBy: item.updated_by,
            updatedAt: item.updated_at,
            mediaAsset: media ? {
              id: media.id,
              publicUrl: media.public_url,
              storagePath: media.storage_path,
              altText: media.alt_text,
              originalFilename: media.original_filename,
              mimeType: media.mime_type,
              fileSize: media.file_size,
            } : null,
          };
        });
      }

      return res.status(200).json({ success: true, contentMap });
    }

    // 2. UPLOAD MEDIA VIA BASE64 PAYLOAD
    if (method === 'POST' && (action === 'upload' || req.path.endsWith('/upload'))) {
      const {
        contentKey,
        category = 'general',
        altText = '',
        metadata = {},
        updatedBy = 'admin',
        fileBase64,
        filename,
        mimeType,
        fileSize,
      } = req.body;

      if (!contentKey || !fileBase64 || !filename) {
        return res.status(400).json({
          success: false,
          error: 'Thiếu thông tin bắt buộc: contentKey, fileBase64, hoặc filename.',
        });
      }

      // Validate MIME type
      const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(mimeType?.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: 'Chỉ chấp nhận các tệp hình ảnh định dạng JPG, JPEG, PNG hoặc WebP.',
        });
      }

      // Convert base64 to Buffer
      const base64Data = fileBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Sanitize storage path: e.g. site-media/hero/coral-hero-123456.jpg
      const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
      const cleanName = filename.substring(0, filename.lastIndexOf('.'))
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .toLowerCase();
      const timestamp = Date.now();
      const storagePath = `${category}/${cleanName}-${timestamp}${ext}`;

      // Upload to Supabase Storage Bucket 'site-media'
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('site-media')
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        console.error('[Supabase Storage Upload Error]:', uploadError);
        return res.status(500).json({
          success: false,
          error: `Lỗi tải ảnh lên Supabase Storage: ${uploadError.message}`,
        });
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('site-media')
        .getPublicUrl(storagePath);

      const publicUrl = publicUrlData.publicUrl;

      // Insert record into media_assets table
      const { data: assetRecord, error: assetError } = await supabase
        .from('media_assets')
        .insert({
          storage_bucket: 'site-media',
          storage_path: storagePath,
          public_url: publicUrl,
          original_filename: filename,
          mime_type: mimeType,
          file_size: fileSize || buffer.length,
          alt_text: altText,
          category,
          entity_type: 'site_content',
          entity_id: contentKey,
          uploaded_by: updatedBy,
          active: true,
        })
        .select()
        .single();

      if (assetError) {
        console.error('[Media Asset Insert Error]:', assetError);
        return res.status(500).json({ success: false, error: assetError.message });
      }

      // Get previous site_content for history logging
      const { data: previousContent } = await supabase
        .from('site_content')
        .select('media_asset_id')
        .eq('content_key', contentKey)
        .single();

      const previousAssetId = previousContent?.media_asset_id || null;

      // Upsert site_content record
      const { data: siteContentRecord, error: siteContentError } = await supabase
        .from('site_content')
        .upsert(
          {
            content_key: contentKey,
            content_type: 'image',
            media_asset_id: assetRecord.id,
            text_value: publicUrl,
            metadata: {
              ...metadata,
              altText,
            },
            updated_by: updatedBy,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'content_key' }
        )
        .select()
        .single();

      if (siteContentError) {
        console.error('[Site Content Upsert Error]:', siteContentError);
        return res.status(500).json({ success: false, error: siteContentError.message });
      }

      // Record in media_history table
      await supabase.from('media_history').insert({
        content_key: contentKey,
        previous_media_asset_id: previousAssetId,
        new_media_asset_id: assetRecord.id,
        changed_by: updatedBy,
        changed_at: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        publicUrl,
        siteContent: siteContentRecord,
        asset: assetRecord,
      });
    }

    // 3. RESTORE PREVIOUS MEDIA
    if (method === 'POST' && (action === 'restore' || req.path.endsWith('/restore'))) {
      const { contentKey, updatedBy = 'admin' } = req.body;

      if (!contentKey) {
        return res.status(400).json({ success: false, error: 'Thiếu contentKey' });
      }

      // Find latest media_history record for this contentKey
      const { data: history, error: historyError } = await supabase
        .from('media_history')
        .select('previous_media_asset_id, new_media_asset_id')
        .eq('content_key', contentKey)
        .order('changed_at', { ascending: false })
        .limit(1);

      if (historyError || !history || history.length === 0 || !history[0].previous_media_asset_id) {
        return res.status(400).json({
          success: false,
          error: 'Không tìm thấy lịch sử tệp ảnh cũ hơn để khôi phục.',
        });
      }

      const prevAssetId = history[0].previous_media_asset_id;

      // Get previous asset public URL
      const { data: prevAsset, error: prevAssetError } = await supabase
        .from('media_assets')
        .select('public_url')
        .eq('id', prevAssetId)
        .single();

      if (prevAssetError || !prevAsset) {
        return res.status(400).json({
          success: false,
          error: 'Không tìm thấy thông tin tệp ảnh cũ trong cơ sở dữ liệu.',
        });
      }

      // Update site_content with previous asset
      await supabase
        .from('site_content')
        .update({
          media_asset_id: prevAssetId,
          text_value: prevAsset.public_url,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        })
        .eq('content_key', contentKey);

      return res.status(200).json({
        success: true,
        restoredUrl: prevAsset.public_url,
      });
    }

    return res.status(400).json({ success: false, error: 'Thao tác không hợp lệ.' });
  } catch (err: any) {
    console.error('[Media API Internal Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Lỗi hệ thống máy chủ' });
  }
}
