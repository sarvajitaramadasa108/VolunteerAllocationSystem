# Volunteer Allocation System

Volunteer allocation UI backed by Google Sheets through Google Apps Script.

## Spreadsheet layout

### Master Data
Headers:
`S No | Name | Mobile Number | Gender | Age | College / Working | Area of Stay | Allocated Service`

### Service Master
Use columns:
`B = Service Name`
`C = Service Coordinator Name`
`D = Service Coordinator Contact Number`
`E = Service Reporting Time`

## Setup

1. Paste `apps-script/Code.gs` into the Apps Script editor attached to the spreadsheet.
2. Set `SPREADSHEET_ID` inside the script if needed.
3. Deploy the script as a web app.
4. Set `APPS_SCRIPT_URL` in Vercel or local env.
5. Run the Next.js app.

## Pages

- `/allocate` - search, register, and allocate service
- `/lookup` - volunteer self-check page
