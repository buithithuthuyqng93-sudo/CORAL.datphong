import type { Request, Response } from 'express';
import { verifySignedSessionToken, checkRolePermission } from '../lib/authService.js';
import {
  isValidContentType,
  listCmsContent,
  saveCmsContent,
  uploadCmsImage,
} from '../lib/cmsContentService.js';

/**
 * Generic CMS API endpoint: /api/cms
 * Designed generically for contentType = 'room' | 'service' so Step 2+ services
 * reuse the exact same endpoint, auth boundary, and storage pipeline.
 */
export default async function cmsHandler(req: Request, res: Response) {
  const { method } = req;
  const reqPath = (req.path || req.url || '').split('?')[0];

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const origin = req.headers.origin;
  if (origin && typeof origin === 'string') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. PUBLIC READ: GET /api/cms?type=room|service
    if (method === 'GET') {
      const rawType = String(req.query?.type || req.query?.contentType || 'room').trim().toLowerCase();
      if (!isValidContentType(rawType)) {
        return res.status(400).json({
          success: false,
          error: 'Tham số type không hợp lệ (hỗ trợ room hoặc service).',
        });
      }

      const wantInactive = String(req.query?.includeInactive || '') === 'true';
      let includeInactive = false;
      if (wantInactive) {
        const authResult = verifySignedSessionToken(req.headers.authorization);
        if (authResult.valid && authResult.session) {
          includeInactive = true;
        }
      }

      const data = await listCmsContent(rawType, { includeInactive });
      return res.status(200).json({
        success: true,
        isDemo: data.isDemo,
        contentType: data.contentType,
        items: data.items,
        ...(data.roomTypes ? { roomTypes: data.roomTypes } : {}),
      });
    }

    // 2. AUTHENTICATED ADMIN WRITE: POST /api/cms
    if (method === 'POST') {
      const authResult = verifySignedSessionToken(req.headers.authorization);
      if (!authResult.valid || !authResult.session) {
        return res.status(401).json({
          success: false,
          error: authResult.error || 'Yêu cầu đăng nhập quản trị để chỉnh sửa nội dung CMS.',
        });
      }

      const session = authResult.session;
      const perm = checkRolePermission(session.role, 'mutate_pricing');
      if (!perm.allowed) {
        return res.status(403).json({
          success: false,
          error:
            perm.reason ||
            'Chỉ tài khoản Chủ cơ sở (Owner) mới có quyền chỉnh sửa thông tin, ảnh và giá phòng.',
        });
      }

      const action = String(req.body?.action || '').trim().toLowerCase();

      // 2A. UPLOAD IMAGE
      if (action === 'upload-image' || reqPath.endsWith('/upload-image')) {
        const rawType = String(req.body?.contentType || 'room').trim().toLowerCase();
        if (!isValidContentType(rawType)) {
          return res.status(400).json({ success: false, error: 'contentType không hợp lệ.' });
        }

        const result = await uploadCmsImage(
          {
            contentType: rawType,
            itemId: String(req.body?.itemId || 'general'),
            fileBase64: req.body?.fileBase64,
            filename: req.body?.filename,
            mimeType: req.body?.mimeType,
            altText: req.body?.altText,
          },
          session
        );

        return res.status(200).json({
          success: true,
          ...result,
        });
      }

      // 2B. SAVE / UPDATE CMS CONTENT ITEM
      if (action === 'save' || !action) {
        const payload = req.body?.item || req.body;
        const rawType = String(payload?.contentType || 'room').trim().toLowerCase();
        if (!isValidContentType(rawType)) {
          return res.status(400).json({ success: false, error: 'contentType không hợp lệ.' });
        }

        const result = await saveCmsContent(
          {
            id: payload?.id,
            contentType: rawType,
            title: payload?.title ?? payload?.name,
            slug: payload?.slug,
            description: payload?.description ?? '',
            price: payload?.price ?? payload?.basePrice ?? 0,
            images: Array.isArray(payload?.images)
              ? payload.images
              : [payload?.image, ...(Array.isArray(payload?.galleryImages) ? payload.galleryImages : [])].filter(
                  Boolean
                ),
            attributes: payload?.attributes || {},
            sortOrder: payload?.sortOrder,
            active: payload?.active,
          },
          session
        );

        return res.status(200).json({
          success: true,
          isDemo: result.isDemo,
          item: result.item,
          ...(result.roomType ? { roomType: result.roomType } : {}),
        });
      }

      return res.status(400).json({ success: false, error: `Action CMS không được hỗ trợ: ${action}` });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[CMS API Error]:', err);
    return res.status(400).json({
      success: false,
      error: err?.message || 'Lỗi xử lý yêu cầu CMS.',
    });
  }
}
