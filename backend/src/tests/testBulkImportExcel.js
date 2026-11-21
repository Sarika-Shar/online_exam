const xlsx = require('xlsx');

async function testBulkImport() {
  console.log('====================================================');
  console.log('🧪 TESTING EXCEL BULK STUDENT IMPORT ENDPOINT');
  console.log('====================================================');

  const API_URL = 'http://localhost:5000/api';

  try {
    // 1. Authenticate as Institution Admin
    console.log('1. Authenticating as Institution Admin (admin@apex.edu)...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernameOrEmail: 'admin@apex.edu',
        password: 'Admin@123'
      })
    });
    const loginData = await loginRes.json();
    if (!loginData.success) {
      throw new Error('Login failed: ' + JSON.stringify(loginData));
    }
    const token = loginData.token;
    console.log('✓ Authenticated successfully. Token acquired.');

    // 2. Test Downloading the Import Template
    console.log('2. Testing GET /api/students/import-template...');
    const templateRes = await fetch(`${API_URL}/students/import-template`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const templateBuf = await templateRes.arrayBuffer();
    console.log(`✓ Template downloaded successfully (${templateBuf.byteLength} bytes).`);

    // 3. Create a test Excel workbook in memory with 3 candidate rows
    console.log('3. Generating test Excel spreadsheet with 3 candidate rows...');
    const randomSeed = Math.floor(1000 + Math.random() * 9000);
    const testRoster = [
      {
        'Full Name': `Candidate Test ${randomSeed}_A`,
        'Email Address': `cand_${randomSeed}_a@apex.edu`,
        'Roll Number': `ROLL-${randomSeed}-01`,
        'Class': '1',
        'Batch': '1',
        'Gender': 'male',
        'Phone Number': '+91-9876500001',
        'Password': 'Student@123'
      },
      {
        'Full Name': `Candidate Test ${randomSeed}_B`,
        'Email Address': `cand_${randomSeed}_b@apex.edu`,
        'Roll Number': `ROLL-${randomSeed}-02`,
        'Class': '1',
        'Batch': '1',
        'Gender': 'female',
        'Phone Number': '+91-9876500002',
        'Password': 'Student@123'
      },
      {
        'Full Name': `Candidate Test ${randomSeed}_C`,
        'Email Address': `cand_${randomSeed}_c@apex.edu`,
        'Roll Number': `ROLL-${randomSeed}-03`,
        'Class': '1',
        'Batch': '1',
        'Gender': 'male',
        'Phone Number': '+91-9876500003',
        'Password': 'Student@123'
      }
    ];

    const ws = xlsx.utils.json_to_sheet(testRoster);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Roster');
    const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 4. Send multipart/form-data request to POST /api/students/bulk-import
    console.log('4. Uploading Excel file to POST /api/students/bulk-import...');
    const formData = new FormData();
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('file', blob, 'bulk_students_test.xlsx');

    const uploadRes = await fetch(`${API_URL}/students/bulk-import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const uploadData = await uploadRes.json();
    console.log('✓ Bulk import response received:');
    console.log(`  - Status: ${uploadRes.status}`);
    console.log(`  - Message: ${uploadData.message}`);
    console.log(`  - Total Rows: ${uploadData.data?.totalRows}`);
    console.log(`  - Imported Count: ${uploadData.data?.importedCount}`);
    console.log(`  - Skipped Count: ${uploadData.data?.skippedCount}`);

    if (uploadData.data?.importedCount === 3) {
      console.log('====================================================');
      console.log('🎉 EXCEL BULK STUDENT IMPORT TEST PASSED 100%!');
      console.log('====================================================');
      process.exit(0);
    } else {
      console.error('❌ Expected 3 imported students, received:', uploadData);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

testBulkImport();
