import type { CmsContentItem } from '../types.js';

export interface UtilityServiceItem {
  id: string;
  iconKey: 'shuttle' | 'bike' | 'wifi';
  title: string;
  subtitle: string;
  description: string;
}

/**
 * 5 Experience Services managed via the unified CMS (`content_type = 'service'`).
 * Each item starts with 1–2 themed demo/real photos (max 3 displayed on /dich-vu)
 * until the homestay owner replaces them with real photos via Admin > Quản lý Dịch vụ.
 */
export const EXPERIENCE_SERVICES_SEED: CmsContentItem[] = [
  {
    id: 'svc-island-tour',
    contentType: 'service',
    title: 'Tour tham quan đảo trọn gói',
    slug: 'tour-tham-quan-dao-tron-goi',
    description:
      'Khám phá trọn vẹn đảo Lớn & đảo Bé Lý Sơn cùng người bản địa: Cổng Tò Vò, Chùa Hang, Đỉnh Thới Lới, Hang Câu và cung đường ven biển đẹp nhất trong ngày.',
    price: 0,
    images: [
      '/assets/services/tour-tham-quan-dao.jpg',
      '/assets/lyson-harbor-real.jpg',
    ],
    attributes: {
      subtitle: 'Đảo Lớn & Đảo Bé · Lịch trình trọn gói',
      highlights: [
        'Lịch trình linh hoạt theo giờ tàu cao tốc & điều kiện thời tiết',
        'Kết hợp tham quan Đảo Bé bằng cano siêu tốc',
        'Hướng dẫn viên địa phương am hiểu văn hóa và ẩm thực Lý Sơn',
      ],
    },
    sortOrder: 1,
    active: true,
  },
  {
    id: 'svc-night-seafood',
    contentType: 'service',
    title: 'Tour soi đêm bắt hải sản',
    slug: 'tour-soi-dem-bat-hai-san',
    description:
      'Trải nghiệm đời sống ngư dân về đêm khi thủy triều rút: cầm đèn pin đi dọc bãi đá núi lửa bắt ốc, cua đá, nhum biển và thưởng thức ngay thành quả tươi sống.',
    price: 0,
    images: [
      '/assets/services/tour-soi-dem-hai-san.jpg',
    ],
    attributes: {
      subtitle: 'Trải nghiệm bản địa theo con nước thủy triều',
      highlights: [
        'Trang bị đèn pin đội đầu, dép đi rạn đá và giỏ đựng hải sản',
        'Có người dân bản địa đi cùng dẫn đường an toàn',
        'Hỗ trợ chế biến thưởng thức ngay sau chuyến đi',
      ],
    },
    sortOrder: 2,
    active: true,
  },
  {
    id: 'svc-sup-paddling',
    contentType: 'service',
    title: 'Chèo SUP',
    slug: 'cheo-sup',
    description:
      'Chèo ván đứng SUP ngay dưới chân đồi Seagull vào sáng sớm đón bình minh hoặc chiều mát, tận hưởng làn nước biển san hô trong xanh quanh vịnh An Vĩnh.',
    price: 0,
    images: [
      '/assets/lyson-beach-sup-real.jpg',
      '/assets/services/cheo-sup-vinh-bien.jpg',
    ],
    attributes: {
      subtitle: 'Bãi biển san hô ngay dưới chân đồi Seagull',
      highlights: [
        'Ván SUP, mái chèo và áo phao đầy đủ cho cả người mới bắt đầu',
        'Tư vấn khung giờ gió êm và hỗ trợ hướng dẫn kỹ thuật cơ bản',
        'Hỗ trợ chụp ảnh lưu niệm giữa vịnh biển Lý Sơn',
      ],
    },
    sortOrder: 3,
    active: true,
  },
  {
    id: 'svc-coral-snorkeling',
    contentType: 'service',
    title: 'Lặn ngắm san hô',
    slug: 'lan-ngam-san-ho',
    description:
      'Đắm mình giữa làn nước trong xanh của rạn san hô tự nhiên Lý Sơn bằng kính lặn ống thở hoặc thuyền thúng, ngắm đàn cá nhỏ và hệ sinh thái biển nguyên sơ.',
    price: 0,
    images: [
      '/assets/services/lan-ngam-san-ho.jpg',
      '/assets/services/tour-tham-quan-dao.jpg',
    ],
    attributes: {
      subtitle: 'Rạn san hô tự nhiên · Nước biển trong xanh',
      highlights: [
        'Trang bị kính lặn, ống thở và áo phao tiêu chuẩn an toàn',
        'Lựa chọn điểm lặn êm sóng phù hợp từng độ tuổi và nhóm khách',
        'Di chuyển bằng thuyền thúng hoặc cano có người hỗ trợ trực tiếp',
      ],
    },
    sortOrder: 4,
    active: true,
  },
  {
    id: 'svc-ocean-balcony-dinner',
    contentType: 'service',
    title: 'Setup tiệc tối / Bữa ăn ban công biển',
    slug: 'setup-tiec-toi-bua-an-ban-cong-bien',
    description:
      'Không gian bàn tiệc riêng tư bên ban công hướng biển lúc hoàng hôn với nến ấm, hải sản Lý Sơn nướng tươi và thực đơn đặt riêng cho cặp đôi, gia đình hoặc nhóm bạn.',
    price: 0,
    images: [
      '/assets/services/tiec-toi-ban-cong-bien.jpg',
      '/assets/seagull-hero.jpg',
    ],
    attributes: {
      subtitle: 'Tiệc riêng tư hoàng hôn · Hải sản Lý Sơn tươi',
      highlights: [
        'Trang trí nến, hoa và bàn ăn hướng biển theo yêu cầu riêng',
        'Thực đơn hải sản tươi đánh bắt trong ngày (nhum, ốc, cá, tôm)',
        'Phù hợp dịp kỷ niệm, cầu hôn hoặc bữa tối ấm cúng bên gia đình',
      ],
    },
    sortOrder: 5,
    active: true,
  },
];

/**
 * 3 Utility Services rendered cleanly with minimalist icons (no images).
 */
export const UTILITY_SERVICES: UtilityServiceItem[] = [
  {
    id: 'util-port-shuttle',
    iconKey: 'shuttle',
    title: 'Đưa đón miễn phí cảng Bến Đình',
    subtitle: 'Miễn phí cho khách lưu trú',
    description:
      'Hỗ trợ xe đón khách tại cảng Bến Đình theo giờ tàu cao tốc cập bến để bạn di chuyển về homestay thuận tiện ngay khi vừa đặt chân lên đảo.',
  },
  {
    id: 'util-motorbike',
    iconKey: 'bike',
    title: 'Cho thuê xe máy',
    subtitle: 'Nhận xe ngay tại homestay',
    description:
      'Sẵn xe số và xe tay ga được bảo dưỡng kỹ lưỡng cùng mũ bảo hiểm để bạn chủ động khám phá các cung đường ven biển trên đảo Lớn.',
  },
  {
    id: 'util-wifi',
    iconKey: 'wifi',
    title: 'Wifi miễn phí',
    subtitle: 'Phủ sóng toàn khuôn viên',
    description:
      'Đường truyền internet tốc độ cao ổn định tại toàn bộ phòng nghỉ bungalow và khu vực Seagull Coffee nhìn ra biển.',
  },
];
