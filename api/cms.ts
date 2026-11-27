import type { Request, Response } from 'express';
import { verifySignedSessionToken, checkRolePermission } from '../lib/authService.js';
import {
  isValidContentType,
  listCmsContent,
  saveCmsContent,
  uploadCmsImage,
} from '../lib/cmsContentService.js';
import {
  isValidContactStatus,
  listContactMessages,
  submitContactMessage,
  updateContactMessageStatus,
} from '../lib/contactMessageService.js';

/**
 * Generic CMS & Contact API endpoint: /api/cms
 * Handles:
 *  - GET  /api/cms?type=room|service          (Public CMS read)
 *  - GET  /api/cms?type=contact               (Authenticated Admin contact inbox read)
 *  - POST /api/cms { action: 'contact-submit' } (Public guest contact form submit)
 *  - POST /api/cms { action: 'contact-status' } (Authenticated Admin contact status update)
 *  - POST /api/cms { action: 'save' | 'upload-image' } (Authenticated Owner CMS writes)
 */
function getAdminAuthHeader(req: Request): string | undefined {
  const xToken = req.headers['x-admin-token'];
  const auth = req.headers.authorization;
  const candidate = Array.isArray(xToken) ? xToken[0] : xToken || (Array.isArray(auth) ? auth[0] : auth);
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined;
}

export default async function cmsHandler(req: Request, res: Response) {
  const { method } = req;
  const reqPath = (req.path || req.url || '').split('?')[0];

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');

  const origin = req.headers.origin;
  if (origin && typeof origin === 'string') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. READ: GET /api/cms?type=room|service|contact
    if (method === 'GET') {
      const rawType = String(req.query?.type || req.query?.contentType || 'room').trim().toLowerCase();

      // 1A. AUTHENTICATED ADMIN READ: GET /api/cms?type=contact
      if (rawType === 'contact' || rawType === 'contacts') {
        const authResult = verifySignedSessionToken(getAdminAuthHeader(req));
        if (!authResult.valid || !authResult.session) {
          return res.status(401).json({
            success: false,
            error: authResult.error || 'Yêu cầu đăng nhập quản trị để xem danh sách liên hệ khách hàng.',
          });
        }

        const data = await listContactMessages();
        return res.status(200).json({
          success: true,
          isDemo: data.isDemo,
          storageTable: data.storageTable,
          items: data.items,
          newCount: data.newCount,
        });
      }

      // 1B. PUBLIC CMS READ: GET /api/cms?type=room|service
      if (!isValidContentType(rawType)) {
        return res.status(400).json({
          success: false,
          error: 'Tham số type không hợp lệ (hỗ trợ room, service hoặc contact).',
        });
      }

      const wantInactive = String(req.query?.includeInactive || '') === 'true';
      let includeInactive = false;
      if (wantInactive) {
        const authResult = verifySignedSessionToken(getAdminAuthHeader(req));
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

    // 2. WRITE: POST /api/cms
    if (method === 'POST') {
      const action = String(req.body?.action || '').trim().toLowerCase();

      // 2A. PUBLIC GUEST CONTACT SUBMIT: POST /api/cms { action: 'contact-submit', fullName, phone, message }
      if (action === 'contact-submit') {
        const forwarded = req.headers['x-forwarded-for'];
        const ip =
          (Array.isArray(forwarded) ? forwarded[0] : typeof forwarded === 'string' ? forwarded.split(',')[0] : '') ||
          req.socket?.remoteAddress ||
          'unknown';

        const result = await submitContactMessage(
          {
            fullName: req.body?.fullName,
            phone: req.body?.phone,
            message: req.body?.message,
            source: req.body?.source,
          },
          String(ip).trim()
        );

        return res.status(201).json({
          success: true,
          isDemo: result.isDemo,
          storageTable: result.storageTable,
          item: result.item,
        });
      }

      // All other POST actions require a valid signed admin session
      const authResult = verifySignedSessionToken(getAdminAuthHeader(req));
      if (!authResult.valid || !authResult.session) {
        return res.status(401).json({
          success: false,
          error: authResult.error || 'Yêu cầu đăng nhập quản trị để thực hiện thao tác này.',
        });
      }

      const session = authResult.session;

      // 2B. AUTHENTICATED ADMIN CONTACT STATUS UPDATE: POST /api/cms { action: 'contact-status', id, status }
      if (action === 'contact-status') {
        if (session.role !== 'owner' && session.role !== 'reception') {
          return res.status(403).json({
            success: false,
            error: 'Chỉ Chủ cơ sở hoặc Lễ tân mới có quyền cập nhật trạng thái xử lý liên hệ khách hàng.',
          });
        }

        const rawStatus = String(req.body?.status || '').trim().toLowerCase();
        if (!isValidContactStatus(rawStatus)) {
          return res.status(400).json({
            success: false,
            error: 'Trạng thái không hợp lệ (hỗ trợ: new, contacted, done).',
          });
        }

        const result = await updateContactMessageStatus(
          String(req.body?.id || ''),
          rawStatus,
          session
        );

        return res.status(200).json({
          success: true,
          isDemo: result.isDemo,
          item: result.item,
        });
      }

      // 2C. OWNER-ONLY CMS MUTATIONS (Room/Service CMS)
      const perm = checkRolePermission(session.role, 'mutate_pricing');
      if (!perm.allowed) {
        return res.status(403).json({
          success: false,
          error:
            perm.reason ||
            'Chỉ tài khoản Chủ cơ sở (Owner) mới có quyền chỉnh sửa thông tin, ảnh và giá phòng.',
        });
      }

      // UPLOAD IMAGE
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

      // SAVE / UPDATE CMS CONTENT ITEM
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
