const { Builder } = require('selenium-webdriver');
const assert = require('assert');
const LoginPage = require('../pages/LoginPage');

describe('Login Page Tests', function () {
    let driver;
    let loginPage;

    // This runs before all tests start
    before(async function () {
        // Initializes Chrome browser. 
        // Note: Requires ChromeDriver to be installed on the machine running the tests.
        driver = await new Builder().forBrowser('chrome').build();
        loginPage = new LoginPage(driver);
    });

    // This runs after all tests are finished
    after(async function () {
        if (driver) {
            await driver.quit();
        }
    });

    it('Should successfully log in with valid credentials', async function () {
        await loginPage.navigate();
        
        // Replace with valid test credentials
        await loginPage.login('admin@school.com', 'ValidPassword123!');
        
        // Wait for page to load after login (e.g., waiting for the URL to change to dashboard)
        await driver.wait(async function() {
            const url = await driver.getCurrentUrl();
            return url.includes('/dashboard');
        }, 10000);

        const currentUrl = await driver.getCurrentUrl();
        assert.ok(currentUrl.includes('/dashboard'), 'Failed to navigate to dashboard after login');
    });

    it('Should show an error message with invalid credentials', async function () {
        await loginPage.navigate();
        
        // Use invalid credentials
        await loginPage.login('wrong@email.com', 'WrongPassword');
        
        // Assert that an error message appears
        const errorText = await loginPage.getErrorMessage();
        assert.ok(errorText.length > 0, 'Error message was not displayed');
    });
});
