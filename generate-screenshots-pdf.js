import { Builder, By, until } from 'selenium-webdriver';
import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const BASE_URL = 'http://localhost:5173'; // Make sure your Vite server is running here

// IMPORTANT: Replace these with your actual test credentials for each role
const CREDENTIALS = {
  superadmin: { email: 'admin@zuna.com', password: 'Cgs@001a' },
  admin: { email: 'virat@abc.com', password: 'Virat@123' },
  teacher: { email: 'pavithran@gmail.com', password: 'Pavi@123' },
  parent: { email: 'pavithran@abc.com', password: 'Pavithran@122' }
};

// Define all the routes to capture
const ROUTES = {
  public: [
    '/',
    '/login',
    '/forgot-password',
    '/register'
  ],
  superadmin: [
    '/superadmin',
    '/superadmin/tenants',
    '/superadmin/billing',
    '/superadmin/license-usage',
    '/superadmin/support-tickets',
    '/superadmin/audit-logs'
  ],
  admin: [
    '/admin',
    '/admin/setup',
    '/admin/form-builder',
    '/admin/subjects',
    '/admin/classes',
    '/admin/students',
    '/admin/attendance',
    '/admin/staff',
    '/admin/links',
    '/admin/fees',
    '/admin/timetables',
    '/admin/transport',
    '/admin/library',
    '/admin/exams',
    '/admin/notices',
    '/admin/api',
    '/admin/billing',
    '/admin/upgrade',
    '/admin/calendar',
    '/admin/inventory',
    '/admin/inventory/audit-logs',
    '/admin/hr-payroll',
    '/admin/reports',
    '/admin/roles',
    '/admin/homework'
  ],
  teacher: [
    '/teacher',
    '/teacher/profile',
    '/teacher/attendance',
    '/teacher/chat',
    '/teacher/homework',
    '/teacher/grades',
    '/teacher/notices',
    '/teacher/calendar',
    '/teacher/timetable',
    '/teacher/lesson-plans',
    '/teacher/performance',
    '/teacher/resources',
    '/teacher/ptm',
    '/teacher/salary'
  ],
  parent: [
    '/parent',
    '/parent/attendance',
    '/parent/homework',
    '/parent/grades',
    '/parent/fees',
    '/parent/notices',
    '/parent/calendar',
    '/parent/canteen'
  ]
};

async function login(driver, role) {
  console.log(`\n🔑 Logging in as ${role}...`);
  await driver.get(`${BASE_URL}/login`);
  
  // Wait for email field
  const emailInput = await driver.wait(until.elementLocated(By.name('identifier')), 5000);
  const passwordInput = await driver.findElement(By.name('password'));
  const submitButton = await driver.findElement(By.css('button[type="submit"]'));

  await emailInput.clear();
  await emailInput.sendKeys(CREDENTIALS[role].email);
  
  await passwordInput.clear();
  await passwordInput.sendKeys(CREDENTIALS[role].password, '\n');
  
  try {
    // Wait for login to complete by waiting for URL to change away from /login
    await driver.wait(async function() {
      const url = await driver.getCurrentUrl();
      return !url.includes('/login');
    }, 10000);
    console.log(`✅ Logged in successfully.`);
  } catch (err) {
    console.error(`\n❌ Timeout waiting for login to succeed for ${role}.`);
    try {
      const errorEl = await driver.findElement(By.css('.text-red-500'));
      const errText = await errorEl.getText();
      console.error(`Frontend Error Message: "${errText}"`);
    } catch (e) {}
    
    // Take a screenshot of the login page to see what's wrong
    const base64Image = await driver.takeScreenshot();
    fs.writeFileSync(`login_failed_${role}.png`, base64Image, 'base64');
    throw err;
  }
}

async function takeScreenshot(driver, urlPath, title, pdfDoc, isFirstPage) {
  console.log(`📸 Capturing: ${urlPath}`);
  await driver.get(`${BASE_URL}${urlPath}`);
  
  // Sleep to allow Suspense, loaders, and network requests to finish
  await driver.sleep(3000);
  
  const base64Image = await driver.takeScreenshot();
  
  if (!isFirstPage) {
    pdfDoc.addPage();
  }
  
  // Add title text
  pdfDoc.setFontSize(16);
  pdfDoc.text(title, 10, 15);
  
  // Add the screenshot image
  pdfDoc.addImage(base64Image, 'PNG', 10, 20, 190, 260); // A4 roughly fits this
}

async function generatePDF() {
  console.log('🚀 Starting screenshot automation...');
  
  // Create jsPDF instance (A4 Portrait)
  const pdfDoc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  let isFirstPage = true;

  try {
    // 1. Capture Public Routes
    let driver = await new Builder().forBrowser('chrome').build();
    for (const route of ROUTES.public) {
      await takeScreenshot(driver, route, `Public Route: ${route}`, pdfDoc, isFirstPage);
      isFirstPage = false;
    }
    await driver.quit();

    // 2. Capture SuperAdmin Routes
    driver = await new Builder().forBrowser('chrome').build();
    await login(driver, 'superadmin');
    for (const route of ROUTES.superadmin) {
      await takeScreenshot(driver, route, `SuperAdmin: ${route}`, pdfDoc, isFirstPage);
    }
    await driver.quit();

    // 3. Capture Admin Routes
    driver = await new Builder().forBrowser('chrome').build();
    await login(driver, 'admin');
    for (const route of ROUTES.admin) {
      await takeScreenshot(driver, route, `Admin: ${route}`, pdfDoc, isFirstPage);
    }
    await driver.quit();

    // 4. Capture Teacher Routes
    driver = await new Builder().forBrowser('chrome').build();
    await login(driver, 'teacher');
    for (const route of ROUTES.teacher) {
      await takeScreenshot(driver, route, `Teacher: ${route}`, pdfDoc, isFirstPage);
    }
    await driver.quit();

    // 5. Capture Parent Routes
    driver = await new Builder().forBrowser('chrome').build();
    await login(driver, 'parent');
    for (const route of ROUTES.parent) {
      await takeScreenshot(driver, route, `Parent: ${route}`, pdfDoc, isFirstPage);
    }
    await driver.quit();

    // Save PDF
    const outputPath = path.join(process.cwd(), 'Modules_Screenshots.pdf');
    pdfDoc.save(outputPath);
    console.log(`\n🎉 Success! PDF generated at: ${outputPath}`);

  } catch (error) {
    console.error(`\n❌ Error during execution:`, error);
  }
}

generatePDF();
