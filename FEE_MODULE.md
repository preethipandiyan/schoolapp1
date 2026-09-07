# Fee Module & Financial Management Specification

The Fee Management Module inside ZUNA handles tuition collection, real-time status tracking, automated reminders, and digital receipt generation.

---

## 📊 Overview & Financial Metrics
* **Total Collected Fees**: $142,500 (displayed live on Admin Dashboard).
* **Payment Statuses**:
  * 🟢 **Paid**: Complete tuition settled.
  * 🔴 **Unpaid**: Outstanding fee balance.
  * 🟡 **Pending Verification**: Bank/Online transaction under review.

---

## 🛠 Features & Capabilities

### 1. Admin Fee Management (`Admin Portal`)
* **Student Fee Directory**: Filter students by Paid / Unpaid status.
* **Status Toggle**: Admin can manually update fee payment records upon receiving cash, cheque, or bank transfer.
* **Send Payment Reminders**: Trigger push notifications / SMS alerts to parents with pending dues.
* **Financial Export**: Export summary reports via native share dialogs.

### 2. Parent & Student Fee View (`Student / Parent Portal`)
* **Fee Breakdown**: Tuition fees, lab fees, transport fees, and library deposits.
* **Due Date Alerts**: Visual highlight for upcoming due dates.
* **Receipt Download**: One-tap trigger to download digital fee receipts for completed transactions.
