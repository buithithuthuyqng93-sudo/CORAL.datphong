import { runStagingDatabaseAudit } from './staging_db_audit_test';

async function main() {
  console.log('========================================================================');
  console.log('BỘ KIỂM THỬ AUDIT CƠ SỞ DỮ LIỆU & CHUẨN BỊ SUPABASE STAGING (BƯỚC 3B)');
  console.log('========================================================================\n');

  const results = await runStagingDatabaseAudit();
  let passCount = 0;
  let failCount = 0;

  results.forEach(r => {
    const icon = r.verdict === 'PASS' ? '✅ PASS' : '❌ FAIL';
    if (r.verdict === 'PASS') passCount++;
    else failCount++;

    console.log(`[${r.testId}] ${icon} [${r.severity || 'INFO'}]: ${r.title}`);
    console.log(`  - Nhóm: ${r.category}`);
    console.log(`  - Kỳ vọng: ${r.expected}`);
    console.log(`  - Thực tế: ${r.actual}`);
    console.log(`  - Bằng chứng: ${r.evidence}\n`);
  });

  console.log('------------------------------------------------------------------------');
  console.log(`TỔNG KẾT: ${passCount}/${results.length} BÀI KIỂM THỬ ĐẠT CHUẨN (${failCount === 0 ? '100% PASS' : 'CÓ LỖI'})`);
  console.log('========================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
