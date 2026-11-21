import { runCheckInFlowV2Tests } from './checkin_flow_v2_tests';

async function main() {
  console.log('========================================================================');
  console.log('KIỂM THỬ TOÀN BỘ QUY TRÌNH CHECK-IN 3 BƯỚC & KHAI BÁO LƯU TRÚ V2');
  console.log('========================================================================\n');

  const results = await runCheckInFlowV2Tests();
  let passCount = 0;
  let failCount = 0;

  results.forEach(r => {
    const icon = r.verdict === 'PASS' ? '✅ PASS' : '❌ FAIL';
    if (r.verdict === 'PASS') passCount++;
    else failCount++;

    console.log(`[Kịch Bản ${r.scenarioNumber}] ${icon}: ${r.title}`);
    console.log(`  - Phân loại: ${r.category}`);
    console.log(`  - Kỳ vọng: ${r.expected}`);
    console.log(`  - Thực tế: ${r.actual}`);
    console.log(`  - Bằng chứng: ${r.evidence}\n`);
  });

  console.log('------------------------------------------------------------------------');
  console.log(`TỔNG KẾT: ${passCount}/${results.length} KỊCH BẢN ĐẠT CHUẨN (${failCount === 0 ? '100% PASS' : 'CÓ LỖI'})`);
  console.log('========================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
