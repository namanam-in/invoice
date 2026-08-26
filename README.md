# GST Invoice Maker

A client-side professional GST invoice maker for Indian businesses.

## Features

- Seller/business GSTIN and business details
- Buyer/customer details
- Product/service rows
- HSN/SAC
- Quantity, unit, rate and discount
- GST rate selector: 0%, 5%, 12%, 18%, 28%, 40%
- Automatic intra-state CGST + SGST
- Automatic inter-state IGST
- Taxable amount, GST and round-off calculation
- Amount in words
- Invoice numbering
- Invoice history
- Paid / Pending / Partially Paid status
- Local browser storage
- A4 print-ready invoice
- Works on GitHub Pages without a server

## Run locally

Open `index.html` in a browser.

## Publish on GitHub Pages

1. Create a new GitHub repository.
2. Upload `index.html`, `style.css`, and `app.js`.
3. Open Settings → Pages.
4. Select "Deploy from a branch".
5. Select the `main` branch and `/root`.
6. Save.
7. GitHub will publish the website.

## Important

This version is a billing/invoice generator, not a GST IRP e-invoicing integration. It does not generate IRNs or authenticate with the GST/IRP system.

Data is stored in the browser's localStorage. Clearing browser data or switching devices will not carry the invoices over.

Before using invoices for statutory/commercial filing, have the GST calculation, HSN/SAC, place-of-supply and invoice requirements reviewed for your business by your CA/tax professional.

## Customization

Enter your own business information under "Business Settings". Never publish real GST credentials, API keys, passwords or private credentials in frontend JavaScript.
