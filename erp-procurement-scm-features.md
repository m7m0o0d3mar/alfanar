# ERP Procurement, Supply Chain & Warehouse Management — Feature Reference

> Research compiled from SAP MM/SRM, Oracle Procurement/Inventory, Dynamics 365 SCM, Zoho Inventory/Procurement, Odoo Inventory/Purchase, IFS Cloud, and Infor CloudSuite.

---

## 1. SAP MM (Materials Management) + SAP SRM (Supplier Relationship Management)

### 1.1 Core Modules / Sub-modules

| Module | Sub-modules |
|--------|------------|
| **MM - Purchasing** | Purchase Requisition, RFQ, PO (Standard/Consignment/Subcontract/Stock Transfer), Contracts, Scheduling Agreements, Source List, Quota Arrangement, Info Records |
| **MM - Inventory Management** | Goods Receipt, Goods Issue, Transfer Posting, Stock Transport Order, Physical Inventory, Cycle Counting, Batch Management, Serial Number Management |
| **MM - Invoice Verification** | Invoice Receipt, Credit Memo, Subsequent Debit/Credit, ERS (Evaluated Receipt Settlement), GR/IR Account Maintenance, Automatic Blocking |
| **MM - Material Valuation** | Standard Price, Moving Average Price, Split Valuation, LIFO/FIFO, Material Ledger, Actual Costing |
| **MM - Vendor Master** | Business Partner (BP) concept, Purchasing data, Vendor evaluation |
| **MM - Material Master** | Multiple views (Basic, Purchasing, MRP, Accounting, Plant/Storage, Warehouse), Screen sequences per user group |
| **SRM - Strategic Sourcing** | RFx, Live Auction, Bid Evaluation, Contract Negotiation Cockpit |
| **SRM - Operational Procurement** | Self-Service Procurement, Plan-Driven, Service Procurement, Catalog Content Mgmt |
| **SRM - Analytics** | Spend Analysis, Supplier Evaluation |
| **SRM - Contract Management** | Central Contracts, Back-end Contracts, Mass Changes, Terms & Conditions |

### 1.2 Key Screens / Fiori Apps

| App Type | Fiori App Examples |
|----------|-------------------|
| **Dashboards** | My Purchase Requisitions, Purchasing Overview, Inventory Overview, Stock/Requirement List (MD04) |
| **Forms** | Manage Purchase Requisitions, Manage Purchase Orders (F2341), Manage Purchase Contracts (F0841), Create Supplier Invoice (F0859), Post Goods Receipt (F3112) |
| **Reports** | Monitor Purchase Order Items, Supplier Invoices List (F1060), Material Document List (MB51), Stock/Requirements, Inventory Aging, ABC Analysis |
| **Analytics** | Spend Analysis, Purchase Order Value, Contract Consumption, Supplier Performance Scorecard |

### 1.3 Procure-to-Pay Workflow

```
Requirement (PR creation) → Source Determination (Source List/Quota) 
→ RFQ/Quotation → PO Creation → PO Approval (Workflow) 
→ PO Transmission (Email/EDI) → Goods Receipt (MIGO) 
→ Invoice Receipt (MIRO) → Invoice Blocking (if tolerance exceeded) 
→ Payment (F-58)
```

### 1.4 Inventory Valuation

| Method | Notes |
|--------|-------|
| **Moving Average Price (V)** | Auto-updated on GR; fluctuations impact stock account |
| **Standard Price (S)** | Fixed period; variances posted to PRD account |
| **Split Valuation** | Same material, different valuations by origin/batch |
| **Material Ledger** | Actual costing, multiple currencies/valuations |
| **LIFO/FIFO (Balance Sheet)** | Periodic valuation adjustment via FIFO/LIFO run |

### 1.5 Unique / Standout Features

- **Business Partner (BP)** — unified vendor/customer master (CVI integration)
- **Universal Journal (ACDOCA)** — single table for MM and Finance postings
- **Flexible Workflow** — Fiori-based approval routing (PR, PO, Contract release)
- **Two-Envelope RFx** — separate technical and price evaluation
- **Evaluated Receipt Settlement (ERS)** — auto-invoice based on GR
- **Screen Sequences** — configurable per material type, user group, industry
- **Material Ledger** — actual costing with multiple currencies/valuations

---

## 2. Oracle Procurement Cloud + Oracle Inventory Management

### 2.1 Core Modules / Sub-modules

| Module | Sub-modules |
|--------|------------|
| **Self-Service Procurement** | Catalog-based requisitions, PunchOut (Amazon Business), Approval routing, Budget checking |
| **Purchasing** | Standard PO, Blanket Purchase Agreement (BPA), Contract Purchase Agreement, Planned PO, Amendment/Versioning |
| **Sourcing** | RFQ/RFP, Negotiation workbench, Reverse Auctions, Weighted scoring, Multi-round |
| **Supplier Management** | Self-service registration, Qualification management, Scorecards, Performance tracking, Supplier Portal |
| **Procurement Contracts** | Clause library, Contract authoring, Term extraction (AI), Deviation tracking, Expiry alerts |
| **Inventory Management** | Subinventories, Locators (bin/aisle/rack), Lot/Serial control, Cycle Counting, Physical Inventory, ABC Analysis, Material Status, LPN |
| **Supplier Portal** | PO confirmation, ASN, Invoice upload, Payment status, Kanban cards, Contract documents |

### 2.2 Key Screens / Pages

| Screen Type | Examples |
|-------------|----------|
| **Infolets / Dashboards** | Source-to-Settle infolets, Inventory Management work area info cards (picks, cycle counts, on-hand value) |
| **Forms** | Manage Suppliers, Manage Requisitions, Create/Manage POs, Manage Negotiations, Manage Contract Terms, Manage Item Quantities |
| **Reports** | Supplier Performance, Spend Analysis, PO History, Inventory Valuation, Cycle Count Hit/Miss, ABC Descending Value |
| **Redwood Pages** | Modern UX for Manage POs, Requisition Processing, Supplier Registration, Contract Terms |

### 2.3 Procure-to-Pay Workflow

```
Requisition → Approval Flow → Sourcing (if needed) 
→ PO Generation → Supplier Portal (PO acknowledgment) 
→ ASN → Goods Receipt (subinventory/locator) 
→ 3-Way Match (PO qty, GR qty, Invoice amount) 
→ Invoice → Payment
```

### 2.4 Inventory Features

| Feature | Details |
|---------|---------|
| **Subinventories** | Logical stock divisions (Raw, WIP, Finished, Receiving, Returns) |
| **Locators** | Flexible key flexfield (aisle/row/bin/rack), locator control per item |
| **Material Status** | User-defined (Quarantine, Hold, Blocked), assigned at subinventory/locator/lot/serial level |
| **Lot/Serial** | Full control, dynamic entry at receipt, lot grades, expiration actions |
| **Cycle Counting** | Count schedules, sequences, approve/adjust, opportunistic (triggered by pick), serialized count |
| **ABC Classification** | By quantity, value, or usage history; multiple classification sets |
| **Valuation** | Standard, Average, Actual/Lot-Serial level costing, LPN tracking |

### 2.5 Unique / Standout Features

- **Redwood UX** — modern infolet-driven work areas replacing classic pages
- **AI Contract Term Extraction** — GenAI to pull key clauses from contract docs
- **Kanban Cards in Supplier Portal** — suppliers manage visual pull signals
- **Lot/Serial Level Costing** — retain granular costs across transfers (AVCO/Actual)
- **Opportunistic Cycle Counting** — auto-triggered when picking from a bin
- **REST APIs for all SCM** — comprehensive integration capabilities

---

## 3. Microsoft Dynamics 365 Supply Chain Management

### 3.1 Core Modules / Sub-modules

| Module | Sub-modules |
|--------|------------|
| **Procurement and Sourcing** | Purchase Requisitions, RFQ, Purchase Orders (Standard/Consignment/Blanket/Scheduling Agreements), Vendor Collaboration Portal, Trade Agreements |
| **Inventory Management** | On-hand, Reservations, Picking, Counting, Quality Orders, Inventory Status, Transfer Orders |
| **Warehouse Management (WMS)** | Locations (aisle/rack/shelf/bin), Location Directives, Work Templates, Wave Templates, Mobile App, License Plates (LP), Containerization |
| **Supplier Relationship Mgmt** | Vendor evaluation, Scorecards, Qualification, Certifications, Collaboration |
| **Product Information Mgmt** | Released products, Product masters, BOMs, Route versions |
| **Demand Planning + MRP** | Master planning, Forecast, Safety stock, Coverage groups |
| **Transportation Management** | Freight, Rates, Routes, Carrier integration |

### 3.2 Key Screens / Pages

| Screen Type | Examples |
|-------------|----------|
| **Dashboards** | Procurement Overview, Warehouse Performance, Inventory On-Hand, Vendor Collaboration workspace |
| **Forms** | My Purchase Requisitions, All Purchase Orders, Vendor Master, Released Products, Locations form, Work Templates, Wave Templates |
| **Mobile** | Warehouse Management mobile app (iOS/Android) — receiving, put-away, picking, cycle counting, barcode scanning |
| **Reports** | Spend Analysis, Vendor Performance, Inventory Aging, Inventory Value, ABC Classification, Cycle Count Status |

### 3.3 Procure-to-Pay Workflow

```
Purchase Requisition → Workflow Approval 
→ RFQ (optional, vendor portal) → PO Generation 
→ PO sent (Vendor Portal / EDI / Email) 
→ Arrival Registration → Product Receipt → 3-Way Matching 
→ Vendor Invoice Recording → Payment Processing
```

### 3.4 Warehouse Management Capabilities

| Feature | Details |
|---------|---------|
| **Location Formats** | Custom naming with segments (aisle/rack/shelf/bin), zones, location profiles |
| **Location Directives** | Query-based rules to determine pick/put locations |
| **Work Templates** | Define work operations (pick + put) per process (purchase, sales, transfer) |
| **Wave Templates** | Batch processing of orders (shipping, production, Kanban) with automated work creation |
| **Picking Strategies** | Single, batch, cluster, zone; FIFO/FEFO sorting; wave grouping |
| **Mobile Device Menu** | Directed operations, barcode/QR scan, LP receiving, offline mode |
| **Cycle Counting** | Auto-generated by location/item thresholds; mobile-driven counts |
| **Containerization** | Manual and automatic packing, cartonization |
| **Cross Docking** | Simple cross-dock from inbound to outbound |

### 3.5 Inventory Features

- **Reservation hierarchy** — controls how inventory is reserved (lot above location, etc.)
- **Batch/Serial** — full traceability, expiration dates, FEFO picking, batch reservation
- **License Plate (LP)** — track handling units, enables mobile WMS operations
- **Inventory Status** — control transaction flow (available, blocked, quarantine)
- **Quality Orders** — link to receipt process for inspection
- **Consignment** — vendor-owned stock at your location
- **Valuation** — Standard cost, Moving average, FIFO (via inventory close)

### 3.6 Unique / Standout Features

- **Vendor Collaboration Portal** — external vendors see POs, RFQs, invoices, master data; auto-confirmation option
- **Workspace-based UI** — role-specific landing pages with KPIs, tiles, Power BI integration
- **Wave Processing** — sophisticated batch logic for outbound fulfillment (30-50% pick reduction)
- **WMS-only mode** — dedicated legal entity for warehouse management only
- **AI Inventory Rebalancing** (2026) — AI-driven stock optimization
- **GS1 Barcode + Wearable support** (2026 releases)
- **Supplier Qualification Evaluation** (2026) — structured qualification flows

---

## 4. Zoho Inventory + Zoho Procurement

### 4.1 Core Modules / Sub-modules

| Module | Sub-modules |
|--------|------------|
| **Zoho Inventory — Core** | Items, Warehouses, Transfer Orders, Packing (Picklists), Shipments, Returns, Assemblies |
| **Zoho Inventory — Tracking** | Serial Number, Batch Tracking, Bin Locations, Barcode Scanning |
| **Zoho Procurement** | Purchase Requests, Vendor Management, RFQ/Bidding, Purchase Orders, Purchase Receives (GRN), Contracts, AP Automation |
| **Zoho Procurement — Supplier** | Vendor Portal (onboarding, bidding, PO, invoices), Scorecards, Performance KPIs |
| **Zoho Procurement — Sourcing** | RFQ/RFP events, Auction management, Catalog management, PunchOut |
| **Cross-module** | E-commerce integrations (Shopify, Amazon), AfterShip for tracking, Custom Modules/Workflows |

### 4.2 Key Screens / Pages

| Screen Type | Examples |
|-------------|----------|
| **Dashboards** | Inventory Dashboard (low stock, pending counts), Procurement Overview, Vendor Portal |
| **Forms** | New Item, New Warehouse, New Vendor, New PR, New PO, New RFQ, New Purchase Receive, New Contract |
| **Reports** | Warehouse Report, Bin Location Details, Stock Summary, Inventory Valuation (FIFO/WAC), Profit by Item, Supplier Performance, Purchase Trends |
| **Advanced** | Picklists with preferred bin, Barcode scanning in picklist, Audit trails, Custom workflow triggers, Vendor contracts |

### 4.3 Procure-to-Pay Workflow

```
Purchase Request (PR) → Approval Workflow → RFQ / Bid 
→ Vendor Selection → PO Creation → PO sent via Vendor Portal 
→ Goods Receipt (GRN/SRN) → 3-Way Match → Invoice 
→ Payment (ACH, through Zoho Books integration)
```

### 4.4 Warehouse & Inventory Features

| Feature | Details |
|---------|---------|
| **Multi-Warehouse** | Unlimited warehouses, primary/active/inactive, user-level permissions |
| **Bin Locations** | Per-item bin tracking, preferred bin in picklists, bin location reports |
| **Serial Numbers** | Per-item tracking, dynamic entry, status timeline (IN/OUT) |
| **Batch Tracking** | Batch ref, mfg batch, mfg date, expiry date, quantity per batch |
| **Picklists** | Warehouse picker interface, preferred bin, barcode scanning, audit trail |
| **Transfer Orders** | Source→destination warehouse, in-transit tracking, AfterShip integration, approvals |
| **Assemblies** | BOM-like composite items, dedicated module with reporting |
| **Replenishment** | Min/max reorder notifications, auto-PO generation |

### 4.5 Inventory Valuation

| Method | Notes |
|--------|-------|
| **FIFO (First In, First Out)** | Oldest inventory recorded as sold first |
| **WAC (Weighted Average Cost)** | Average cost determines COGS and remaining value |

### 4.6 Unique / Standout Features

- **Vendor Portal** — self-service: supplier updates info, bids, accesses POs, uploads invoices
- **Custom Module Access in Vendor Portal** — external stakeholders see custom records
- **Multi-Level Approval** — for inventory adjustments and transfer orders
- **AfterShip Integration** — real-time stock transfer tracking with timeline view
- **Barcode Scanning** — in picklist module for faster warehouse operations
- **Workflow Triggers** — custom triggers based on third-party app events
- **Accounting vs Physical Stock** — dual tracking method (books vs warehouse)
- **Price Lists** — supplier-specific pricing, volume-based tiers

---

## 5. Odoo Inventory + Odoo Purchase

### 5.1 Core Modules / Sub-modules

| Module | Sub-modules |
|--------|------------|
| **Inventory — Warehouse** | Warehouses, Locations (Virtual/Internal/Transit/Inventory Loss), Multi-Step Routes (2/3 step), Putaway rules, Removal strategies |
| **Inventory — Replenishment** | Reordering rules (Min/Max), MTO, JIT, Inter-warehouse resupply, Smart scheduler |
| **Inventory — Operations** | Receipt, Delivery, Internal Transfer, Barcode scanning, Batch/Wave picking, Cluster picking |
| **Inventory — Tracking** | Lot/Serial Numbers, Expiration Dates, Storage Categories, Traceability reports |
| **Purchase — RFQ/Tenders** | RFQ creation, Call for Tenders, Alternative RFQs, Compare Product Lines |
| **Purchase — Agreements** | Blanket Orders (Purchase Agreements), Purchase Tenders, Vendor Pricelists |
| **Purchase — Orders** | PO from RFQ, Automated procurement (from reordering rules), Receipt control, Backorders |
| **Purchase — Vendor** | Vendor master, pricelists, priority ranking, lead times |

### 5.2 Key Screens / Pages

| Screen Type | Examples |
|-------------|----------|
| **Dashboards** | Inventory Overview (Receipt/Pick/Pack/Delivery task cards), Purchase Dashboard (RFQ/PO status) |
| **Forms** | Create Warehouse, Manage Locations, Product Form, Reordering Rules, RFQ/PO form, Purchase Agreement |
| **Reporting** | Forecasted Report, Stock Report, Locations Report, Moves History, Inventory Valuation (FIFO/AVCO/Standard), Replenishment Report |
| **Operations** | Barcode scan interface, Batch picking, Internal transfer forms, Quality check |
| **Tracking** | Lot/Serial traceability report (end-to-end movement), Product location search |

### 5.3 Procure-to-Pay Workflow

```
Reordering Rule triggered (min stock) → RFQ Created 
→ Send RFQ to vendors → Compare Alternative RFQs/Line comparison 
→ Confirm PO → Receive Goods (GR) → Validate Receipt 
→ Vendor Bill → 3-Way Match → Payment
```

### 5.4 Warehouse Management Capabilities

| Feature | Details |
|---------|---------|
| **Warehouses** | Physical sites with address; auto-locations (Input, QC, Stock, Packing, Output) |
| **Locations** | 7 types: Virtual, Internal, Customer, Vendor, Transit, Production, Inventory Loss |
| **Multi-Step Routes** | 2-step (receive→stock, pick→ship) or 3-step (receive→QC→stock, pick→pack→ship) |
| **Putaway Strategies** | Storage categories, automated routing by product/capacity |
| **Removal Strategies** | FIFO, FEFO, LEFO, Nearest Available Zone — configurable per location |
| **Picking Methods** | Single, Batch, Cluster, Wave; smart batching by carrier/serial/weight |
| **Barcode Scanning** | GS1, EAN13, EAN14; all operations scannable |
| **Cycle Counts** | Recurring counts by location/product/lot; scheduled |
| **Traceability** | Full lot/serial origin-to-destination tracking, recall-capable |

### 5.5 Inventory Valuation

| Method | Accounting Modes | Notes |
|--------|------------------|-------|
| **Standard Price** | Periodic (manual) or Perpetual (auto, Real-time) | Fixed cost per product category; default |
| **AVCO (Average Cost)** | Periodic or Perpetual | Dynamic weighted average |
| **FIFO** | Periodic or Perpetual | Most accurate; individual lot valuation |
| **Landed Costs** | N/A | Distribute freight/duty/customs across products |

Note: Removal strategy (FIFO/FEFO/LIFO) is separate from valuation method. You can pick FEFO while valuing at AVCO.

### 5.6 Unique / Standout Features

- **Alternative RFQs** — side-by-side comparison of vendor quotes at product-line level
- **Purchase from Sales** — create PO directly from sales order automation
- **Blanket Orders** — long-term agreements with recurring order pricing
- **Integrated IoT** — connects to warehouse sensors via IoT Box
- **Customer Portal** — live order tracking, return initiation, barcode labels
- **Auto Scheduler** — triggers operations based on stock and forecast
- **Landed Costs** — distribute shipping, customs, insurance across products
- **Product Catalog** — multi-attribute search, enhanced material search UI

---

## 6. IFS Cloud — Procurement + Supply Chain

### 6.1 Core Modules / Sub-modules

| Module | Sub-modules |
|--------|------------|
| **Sourcing** | AI-assisted supplier selection, RFQ evaluation, Supplier rating/scorecards |
| **Supplier Contract Mgmt** | Full lifecycle: onboarding → performance → renewals, ECO footprint tracking |
| **Operational Procurement** | Requisitioning, Ordering, Goods receipt, Inspection, Returns, Self-service catalogs |
| **Supplier Relationship Mgmt** | Onboarding, Evaluation, B2B collaboration, Performance monitoring |
| **Warehouse Management** | Goods receipt to issue, Traceability, Shelf-life, Handling Units (LPN), Interactive Displays, Replenishment |
| **Supply Chain Planning** | AI-driven demand forecasting, Inventory replenishment, Safety stock calculation |
| **Supplier Agreements** | Blanket orders, Part-step pricing, Supplier assortments, Price update background jobs |

### 6.2 Key Screens / Pages

| Screen Type | Examples |
|-------------|----------|
| **Dashboards** | Procurement KPIs, Supplier performance, Warehouse operations |
| **Forms** | Purchase Requisition, Purchase Order lines/header, Supplier Agreement, Supplier for Purchase Part, Pre-posting PO |
| **AI Copilot** | IFS.ai Copilot for Supplier Selection (historically recommend suppliers), Freight Selection, Summarized Supply Chain Events |
| **Tracking** | Handling Unit management, Interactive Display labels, Location management |
| **Mobile** | Warehouse mobile, Barcode scanning |

### 6.3 Procure-to-Pay Workflow

```
Purchase Requisition → AI-Assisted Sourcing / Supplier Selection 
→ RFQ → Bid Evaluation (AI-supported) → PO Creation 
→ Supplier Agreement check → Goods Receipt → Inspection 
→ Invoice Verification → Payment
```

### 6.4 Unique / Standout Features

- **IFS.ai Copilot** — AI recommendations for supplier selection based on price, quality, delivery, carbon emissions
- **Interactive Displays** — electronic shelf labels on handling units/locations, auto-updated from IFS Cloud
- **Part-Step Pricing** — automatic price/discount adjustments based on cumulative purchase quantities
- **Multi-everything** — multi-language, multi-currency, multi-site, multi-country out of the box
- **ECO Footprint Tracking** — carbon emission scoring for supplier selection
- **Supplier Agreement Price Updates** — background job to update existing PO prices from new agreement terms
- **Landed Cost Distribution** — distribute charges across PO lines

---

## 7. Infor CloudSuite — Procurement

### 7.1 Core Modules / Sub-modules

| Module | Sub-modules |
|--------|------------|
| **Purchase Requisitions** | Multi-level approval routing by spend thresholds, cost centers, item categories; web+mobile |
| **Purchase Orders** | Auto-generation from approved requisitions/MRP, vendor selection, price comparison, delivery scheduling, quick entry form |
| **Supplier Management** | Centralized database, performance evaluation (delivery, quality, cost), scorecards, payment hold |
| **Contract Management** | Vendor contracts with pricing terms, volume discounts, rebates, expiration alerts, corporate contracts |
| **3-Way Matching** | PO ↔ Receipt ↔ Invoice matching with tolerance enforcement |
| **Spend Analytics** | Spend classification, leakage detection, compliance reporting |
| **Supplier Portal** | PO acknowledgment, ASN, invoice upload, payment status |
| **Scheduling Agreements** | Blanket orders, Master Buy Agreement |

### 7.2 Key Screens / Pages

| Screen Type | Examples |
|-------------|----------|
| **Dashboards** | Supplier Performance, Spend Analysis, PO Tracking |
| **Forms** | Vendor Contract Pricing, PO Quick Entry, PO Builder, Master Buy Agreement, Purchase Order Receiving |
| **Contracts** | Vendor Contacts, Contract Prices with break quantities, Effective dates, Approval status |
| **Reports** | Supplier evaluation reports, Spend analysis, PO history |

### 7.3 Unique / Standout Features

- **Master Buy Agreement** — group like items across sites for quantity cost breaks
- **Vendor Contract Pricing** — up to 5 price breaks per item, approval workflow, bulk status changes
- **Payment Hold** — block supplier payments for quality/service issues
- **PO Builder** — group items from multiple POs across sites for optimal pricing
- **Corporate Purchase Contracts** — central pricing, local logistics agreements in multi-company setups
- **Change Request** — controlled amendment workflow for contracts

---

## 8. Inventory Valuation Methods — Cross-Platform Comparison

| Method | SAP MM | Oracle | D365 | Odoo | Zoho | IFS |
|--------|--------|--------|------|------|------|-----|
| **Standard Price** | ✅ (S) | ✅ | ✅ | ✅ | — | ✅ |
| **Moving Average (AVCO)** | ✅ (V) | ✅ | ✅ | ✅ | ✅ (WAC) | ✅ |
| **FIFO** | ✅ (BS Val) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **LIFO** | ✅ (BS Val) | — | — | 🟡 (removal only) | — | — |
| **FEFO** | 🟡 (batch) | — | 🟡 (batch) | ✅ (removal) | — | 🟡 (shelf-life) |
| **Actual/Lot-Serial Cost** | ✅ (Split Val) | ✅ | — | ✅ | — | ✅ |
| **Perpetual** | ✅ | ✅ | ✅ | ✅ (since v19) | ✅ | ✅ |
| **Periodic** | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| **Landed Cost** | ✅ | ✅ | ✅ | ✅ | 🟡 (add-on) | ✅ |

---

## 9. Construction-Specific Bilingual ERP Systems (Middle East)

### Key Requirements for GCC Construction

- **Arabic/English bilingual** — RTL UI, bilingual BOQ line items, dual-language reports/invoices
- **BOQ (Bill of Quantities) Management** — import, versioning, variation orders, progress tracking
- **Subcontractor Management** — agreements, work orders, retention, certificates, milestone billing
- **Project Costing** — WBS/cost code, budget vs actual, committed cost, EAC
- **Site-to-Warehouse Workflow** — material requisition from site → approval → warehouse pick → dispatch
- **Local Compliance** — ZATCA (SA e-invoicing), WPS (UAE payroll), GOSI/Mudad, VAT
- **Tender/Procurement Integration** — native Ariba cXML for Aramco/SEC suppliers

### Platforms Found

| Platform | Region | Built On | Key Features |
|----------|--------|----------|--------------|
| **Smart System** (smartsystem.sa) | Saudi Arabia | Odoo | 7-stage tender w/ Arabic/English BOQ OCR, SEC Unified Contracts, Ariba cXML, 11 AI assistants |
| **Costruct** (afkaar.ai) | UAE/KSA/Egypt | Odoo | BOQ→PR→Site→Cost control, MEP workflows, Arabic-ready, subcontractor mgmt |
| **PACT ERP** (Aramis Solutions) | GCC-wide | Proprietary | Bilingual interface, MRP, BOQ, Subcontractor, Project Profitability |
| **HASSAAB** | GCC-wide | Proprietary SaaS | BOQ/IPC/Retention, ZATCA Phase 2, Arabic-first (RTL), multi-warehouse |
| **Hinawi ERP** | UAE/GCC | Proprietary | WPS payroll, VAT/e-invoicing, bilingual transactions/reports, retention handling |
| **FirstBit** | Saudi Arabia | Proprietary | BOQ-to-estimation, cost tracking, subcontractor mgmt, bilingual reports |
| **FALCON ERP** | UAE/GCC | Proprietary | BOQ tracking, job costing, subcontractor, project budgets |
| **Qimmah ERP** (qimmaa.com) | Saudi Arabia | Proprietary | Full Arabic ERP |

### Must-have Construction Procurement Features

```
Tender / Bid (BOQ import) → Project Budget (cost codes) 
→ Site Material Requisition → Approval → PO → Supplier 
→ Delivery to Site → Site Goods Receipt → Inventory consumption
→ Subcontractor Work Order → Retention (%) → Progress Certificate (IPC) 
→ Invoice (with retention holdback) → Payment
```

---

## 10. Feature Checklist for Building Your Own ERP Modules

### Procurement Module

- [ ] Purchase Requisition (PR) with multi-level approval workflow
- [ ] RFQ / RFP / Tender management with vendor invitation
- [ ] Bid comparison (side-by-side product lines, weighted scoring)
- [ ] PO creation from PR/RFQ (Standard, Blanket, Contract, Schedule)
- [ ] PO amendment/version control with change tracking
- [ ] Frame agreements / Blanket orders with validity periods
- [ ] Purchase contracts with pricing conditions, volume tiers
- [ ] Contract clause library with deviation tracking
- [ ] Goods receipt (GRN) / Service entry sheet
- [ ] 3-way matching (PO ⇄ GR ⇄ Invoice)
- [ ] Evaluated Receipt Settlement (auto-invoice)
- [ ] Vendor invoice processing with tolerance blocking
- [ ] Payment processing / AP automation

### Supplier Management

- [ ] Centralized supplier master (with Business Partner concept)
- [ ] Self-service supplier portal (onboarding, document upload)
- [ ] Supplier classification / segmentation
- [ ] Qualification management (questionnaires, scoring)
- [ ] Performance scorecards (delivery, quality, cost, compliance)
- [ ] RFQ/Bid invitation and response through portal
- [ ] PO acknowledgment, ASN, invoice via portal
- [ ] Supplier contract self-service view
- [ ] Payment hold / block functionality

### Inventory / Warehouse Management

- [ ] Multi-warehouse with site/location hierarchy
- [ ] Bin locations (aisle/rack/shelf/bin) with flexible format
- [ ] Storage categories / putaway rules
- [ ] Removal strategies (FIFO, FEFO, LIFO, nearest zone)
- [ ] Multi-step receiving (receive → QC → stock)
- [ ] Multi-step delivery (pick → pack → ship)
- [ ] Wave/batch/zone/cluster picking
- [ ] Barcode / QR scanning for all operations
- [ ] Lot/Batch tracking with expiry dates
- [ ] Serial number tracking (individual item)
- [ ] License Plate / Handling Unit tracking
- [ ] Transfer orders (inter-warehouse, in-transit tracking)
- [ ] Cycle counting (threshold-based, mobile-driven)
- [ ] Physical inventory (full count)
- [ ] ABC classification
- [ ] Inventory adjustments / scrap
- [ ] Consignment inventory (vendor-owned stock)
- [ ] Quality control checkpoints
- [ ] Cross-docking

### Inventory Valuation

- [ ] Standard price (fixed, manually updated)
- [ ] Moving average (dynamic weighted)
- [ ] FIFO (lot-level actual costing)
- [ ] Landed cost distribution (freight, duty, insurance)
- [ ] Perpetual (real-time GL postings)
- [ ] Periodic (period-end manual valuation)
- [ ] Revaluation / adjustment posting

### Analytics & Reporting

- [ ] Stock on-hand / availability dashboard
- [ ] Inventory aging report
- [ ] Inventory valuation report
- [ ] Cycle count hit/miss analysis
- [ ] ABC analysis
- [ ] Supplier performance scorecard
- [ ] Spend analysis (by category, supplier, project)
- [ ] PO cycle time / fulfillment rate
- [ ] Procurement savings tracking
- [ ] Traceability report (lot/serial end-to-end)

### Integration Points (Project / Execution)

- [ ] Material requisition from project tasks/WBS
- [ ] Direct procurement to project cost (cost code on PO)
- [ ] Subcontractor work order linked to project
- [ ] BOQ → Procurement requirement lines
- [ ] Budget control (hard/soft commit against project budget)
- [ ] Progress billing (IPC) with retention withholding
- [ ] Site inventory consumption tracked to project
- [ ] Equipment / asset tracking linked to project

### Construction-Specific (Middle East)

- [ ] Arabic/English bilingual UI (RTL support)
- [ ] Bilingual BOQ, PO, invoice, and reports
- [ ] Bill of Quantities (BOQ) import & management
- [ ] Variation order management
- [ ] Subcontractor management (agreements, work orders, certificates)
- [ ] Retention ledger (WIP holdback, release scheduling)
- [ ] Progress certificate (IPC) generation
- [ ] ZATCA / VAT / e-invoicing compliance
- [ ] WPS payroll integration
- [ ] Ariba cXML integration for supplier POs
