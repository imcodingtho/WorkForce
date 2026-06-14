# WorkForce — Salary & Loan Management System

WorkForce is a modern, lightweight client-side Single Page Application (SPA) designed to manage employee records, calculate interval salaries, track fixed/manual loans and advances, and handle detailed repayment logs. It runs entirely in the browser using HTML5, Vanilla CSS, and modular Vanilla JavaScript, relying on `localStorage` for data persistence.

---

## Features

- **Theme Customization System**: Includes Dark (default), Light, Corporate Blue, and Minimal theme modes using HSL tailored styling palettes.
- **Employee CRUD Registry**: Complete management of employee details, salaries, phone contacts, notes, and dynamic payment intervals (Daily, Weekly, Monthly, and Custom intervals).
- **Comprehensive Salary Tracker**: Automatically projects payout cycles and monthly obligations, supports single/batch payout toggling, and calculates net payouts after automatic loan deductions.
- **Loan & Advance Ledger**: Tracks outstanding debt balances, logs custom reasoning, supports fixed-rate salary deductions or manual repayment logging, and outputs visual progress bars.
- **Interactive Notes Board**: Displays clean card-based summaries of custom employee notes and permits editing in simple dialog overlays.
- **Secure Authentication Interfaces**: Sign-in, sign-up forms, password verification warnings, session caching, and preloaded sample datasets for immediate testing.
- **Data Portability**: Allows exporting the entire workforce registry to formatted JSON files or spreadsheet-compatible CSV tables, and includes data purge features.

---

## Folder Structure

```
WorkForce/
├── css/
│   └── styles.css              # Custom themes, responsive grids, and components styling
├── js/
│   ├── auth.js                 # Authentication tabs, forms processing, and session caching
│   ├── dashboard.js            # Key metrics calculations and widgets loaders
│   ├── employees.js            # Employee list cards/tables, searches, forms, and notes board
│   ├── loans.js                # Loan calculators, repayments entries, and details logs
│   ├── payroll.js              # Payout intervals calculations and payroll list rendering
│   ├── settings.js             # Theme switcher, profile settings, and data exports
│   ├── storage.js              # Unified state variables and localStorage functions
│   └── ui.js                   # UI utilities, modal events, key listeners, and custom dialogs
├── index.html                  # Main skeleton document containing layouts and link templates
└── README.md                   # Project documentation and configuration manuals
```

---

## How to Run Locally

Since the application uses standard JavaScript files loaded sequentially, you can run the project using one of two methods:

### Method 1: Local HTTP Server (Recommended)
To run the application locally on a server, run any simple static server in the root directory:
```bash
# Using Node.js serve:
npx serve .

# Or using Python's built-in server:
python -m http.server 8000
```
Then, open the address returned in the terminal (usually `http://localhost:3000` or `http://localhost:8000`) in your web browser.

### Method 2: Direct File Execution
Since the refactored script tags operate on standard global scopes, you can double-click and open the `index.html` file directly in any browser (`file:///` path) without setting up a server, and everything will function perfectly.

---

## Future Roadmap

1. **Relational Database Integration**: Transition persistence from local cache variables to a cloud-based SQL or NoSQL database (e.g., PostgreSQL or MongoDB) for cross-device sharing.
2. **Robust Multi-Tenant Authorization**: Upgrade authentication layers to support secure JWT-based backend session tokens and distinct user roles (e.g., Owner, HR Manager, Finance Analyst).
3. **Advanced Payroll Analytics**: Integrate charts and graphs to represent monthly payroll spending trends, outstanding loan histories, and seasonal workforce expenses.
4. **Automated Notification Modules**: Trigger email notifications or SMS text alerts directly to employees upon payroll disbursements or repayment deadlines.
5. **Comprehensive SaaS Transformation**: Integrate recurring subscription billing (e.g., Stripe) to monetize the workforce planning application for small-to-medium businesses.
