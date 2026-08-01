# OptimaGodown – Billing & Inventory Management System (abe Jaldi kar Panvel Nikalna hai :) )

Welcome to the **OptimaGodown** codebase. This is a web-based monorepo application designed to manage product catalogs, track real-time inventory adjustments, execute customer sales orders, generate print-ready invoice PDFs, and control user access with role-based permissions (RBAC).

---

## 1. Codebase Architecture

The application is configured as a **PNPM Workspace Monorepo**, dividing core concerns into modular packages:

```
├── artifacts/
│   ├── api-server/         # Express.js REST API Backend
│   └── billing-app/        # Vite + React.js Single Page Frontend (SPA)
├── lib/
│   ├── api-client-react/   # Generated Axios-based React Query client hooks
│   ├── api-spec/           # OpenAPI 3.1.0 Contract Specification (openapi.yaml)
│   ├── api-zod/            # Generated Zod validators shared between client/server
│   └── db/                 # Drizzle ORM schema definitions, connections, and seeders
├── attached_assets/        # Attached product media and PRD assets
└── walkthrough.md          # Chronological list of migration and feature updates
```

---

## 2. Technical Specification

### Tech Stack
* **Frontend**: React.js 18, Vite 7, TailwindCSS (Vanilla utility styles), Lucide React (Icons), Wouter (Routing), TanStack React Query (State/Cache).
* **Backend**: Node.js, Express.js, TypeScript (esbuild compiler).
* **Database**: PostgreSQL 16 managed via **Drizzle ORM** for type-safe query building and automatic migration pushes.
* **Authentication**: Express Session store backed by PostgreSQL (`connect-pg-simple`), password hashing using `bcryptjs`.
* **API Generation**: Contract-first design using **OpenAPI 3.1.0** and **Orval** to generate server-side validation schemas and React frontend Query hooks automatically.
* **PDF Generator**: Native vector document layouts built with `pdfkit`.

---

## 3. Database Schema

The system uses **7 primary tables** managed through Drizzle:

1. **Users** (`usersTable`): Stores staff accounts with role flags (`admin` / `user`), active flags, and bcrypt-encrypted password hashes.
2. **Products** (`productsTable`): Product catalog containing names, prices, descriptions, and current warehouse stock counts.
3. **Inventory Transactions** (`inventoryTable`): Historical audit log tracking all warehouse adjustments (`add` / `reduce` / `order`), referencing the editor and products.
4. **Orders** (`ordersTable`): Customer invoices containing subtotal, tax breakdown, discounts, referral charges, grand total, amount paid, pending amount, and status.
5. **Order Items** (`orderItemsTable`): Line-item details mapping orders to products, quantity, and historical pricing.
6. **Session** (`sessionTable`): Backing PostgreSQL schema that holds Express active cookie sessions to avoid memory leakage and support clustering.

---

## 4. Product Requirements (PRD) Details

### User Roles
* **Admin Role**:
  * **Dashboard**: Full access to total products, aggregate inventory volume, total order stats, sales metrics (today's/monthly), and active user accounts.
  * **Product Catalog**: Read, create, edit, delete, and search items.
  * **Inventory Log**: View stock movement histories and manual adjustments (restocks/markdowns).
  * **Order Operations**: Create new customer orders and view all order histories.
  * **Staff Management**: Create, edit, activate/deactivate, and reset passwords for user accounts.
* **User/Staff Role**:
  * **Dashboard**: Views personalized metrics: orders created today, total orders, and total revenue.
  * **Order Operations**: Create new customer orders, view own order history, and download invoice PDFs.
  * *Blocked Areas*: Prevented from accessing product, inventory, or user management screens.

### Business Logic & Validations
* **Stock Security**: Prevent order checkout if the requested product quantity exceeds available godown stock.
* **Low Stock Warning**: Alert badges and visual warning boxes are highlighted on the dashboard when a product's available quantity drops below `10` units.
* **Invoice Layouts**: Generates structured invoice layouts including totals, discount deductions, referral charges, GST tax details, and payment statuses.
* **Mock Emailing**: Provides a visual confirmation popup signifying that mock email delivery to the customer succeeded.

### Advanced Partial Payment Features
* **Paid vs. Pending Tracking**: During order checkout, staff can input a custom "Amount Paid" value. The system dynamically computes the "Pending Balance" (`Grand Total - Paid Amount`).
* **Auto-Status**: If the pending balance is greater than `0`, the order is marked as `pending` (otherwise `completed`).
* **Outstanding Alerts**: Pending orders blink and are highlighted in a tinted orange row on the history table, allowing staff to quickly identify accounts requiring follow-ups.

---

## 5. Local Setup & Running Guide

### Prerequisites
* **Node.js**: `v20` or higher.
* **PNPM**: Installed globally (`npm install -g pnpm`).
* **Docker Desktop**: For running the local PostgreSQL container.

### Step 1: Clone and Install Dependencies
Ensure you are in the workspace root directory, then run:
```bash
pnpm install
```

### Step 2: Spin Up the Local Database
Run the PostgreSQL Docker container:
```bash
docker run --name inventory-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=inventory_masters -p 5432:5432 -d postgres:16
```

### Step 3: Configure Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/inventory_masters
SESSION_SECRET=billing-secret-key
PORT=5173
```

### Step 4: Run Migrations and Seed Data
Push the Drizzle schema to your PostgreSQL database:
```bash
pnpm --filter @workspace/db run push
```

Populate the database with default staff roles, sample products, and sample inventory movements:
```bash
pnpm --filter @workspace/db run seed
```

### Step 5: Start Development Servers
Start both the Express API server and the Vite dev server concurrently:
```bash
pnpm dev
```
* **Frontend**: `http://localhost:5173/`
* **Backend API**: `http://localhost:8080/`

---

## 6. Access Credentials

The database seeder provisions two default roles for exploring the system:

| Username | Password | Role | Access Level |
| :--- | :--- | :--- | :--- |
| **admin** | `admin123` | **Admin** | Full Management |
| **user** | `user123` | **User** | Orders & Invoices Only |


MOM on 1st Aug - 
**Task & System Updates**- Done
Removed Features / Fields

Created By

Status

Header Invoice Number (Inv no) along with created date


**⚙️ Field & Logic Changes**
Invoice Number Format: Update format to INV—YYYYMMDD-01(series) - Done & verified   

Amount Paid: Add payment method options (Cash or UPI) - Done & verified 

Side Order Details (Nikita's Feedback): Update the side order details section as requested -  renovated 

Low Stock Alert Threshold: Lower threshold from 5 to 2- Done 

Bill Name & Labels: Rename Product to CRYSTAL TYPE- done & verified  

GST & Discount Display Logic: If the value is 0, do not print it on the bill - Done & verified  

Order history - same row updated with the remarks - Done 

Smart Search with Dropdown- order / new orders / Add product - Done & verified 

Product Add - quantity update - deletion Bug to be Fixed - done and verified 

New order- Create order - Print option is required and the print formate should be same invoice bill formate - Done and verified

Mobile no should be 10 digital and start with only 7,8,9 and 6 - done and verified 

A4 Size - Print / invocie - Done & verified

Add shop name and address above invoice number - Done and verified 
Aloha Crystal World
Vedanta Heights, Shri Colony,
Dastur Nagar, Amravati.
Mob - 8369495476


Remove ** Tax Invoice** from Bill
Add date field while editing bill

