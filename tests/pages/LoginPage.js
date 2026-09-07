const { By, until } = require('selenium-webdriver');

class LoginPage {
    constructor(driver) {
        this.driver = driver;
        this.url = 'http://localhost:3000/login'; // Update with your actual URL
        
        // Locators (Update these to match the ID's or Names in your LoginPage.jsx)
        this.emailInput = By.name('email'); 
        this.passwordInput = By.name('password');
        this.submitButton = By.css('button[type="submit"]');
        this.errorMessage = By.className('error-message'); // Example class for error
    }

    async navigate() {
        await this.driver.get(this.url);
    }

    async enterEmail(email) {
        let input = await this.driver.findElement(this.emailInput);
        await input.clear();
        await input.sendKeys(email);
    }

    async enterPassword(password) {
        let input = await this.driver.findElement(this.passwordInput);
        await input.clear();
        await input.sendKeys(password);
    }

    async clickLogin() {
        let button = await this.driver.findElement(this.submitButton);
        await button.click();
    }

    async login(email, password) {
        await this.enterEmail(email);
        await this.enterPassword(password);
        await this.clickLogin();
    }

    async getErrorMessage() {
        let error = await this.driver.wait(until.elementLocated(this.errorMessage), 5000);
        return await error.getText();
    }
}

module.exports = LoginPage;
