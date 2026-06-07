const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const XLSX = require("xlsx");
// const db = require("./db");
const path = require("path");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

/* ---------- FILE UPLOAD CONFIG ---------- */
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  }
});

/* ---------- UPLOAD & PARSE PDF ---------- */

app.post("/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
  return res.status(400).json({
    error: "No PDF file uploaded"
  });
}

const buffer = req.file.buffer;
      const pdfData = await pdfParse(buffer);
      console.log(pdfData)
const lines = pdfData.text.split("\n");

console.log("========= PDF TEXT =========");
lines.slice(0, 100).forEach((line, index) => {
  console.log(index, JSON.stringify(line));
});
console.log("============================");
      console.log("Total lines:", lines.length);
console.log("First 50 lines:");
console.log(lines.slice(0, 50));
  const cleanedLines = lines
  .map(line => line.trim())
  .filter(line => line.length > 0);

let allTrnasactions = [];

      function normalizeDate(dateStr) {
  const months = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  const parts = dateStr.replace(",", "").split(" ");

  if (parts.length !== 3) return null;

  const [mon, day, year] = parts;

  return `${year}-${months[mon]}-${day.padStart(2, "0")}`;
}

for (let i = 0; i < cleanedLines.length; i++) {

  const line = cleanedLines[i];

  if (/^[A-Z][a-z]{2}\s\d{2},\s\d{4}$/.test(line)) {

    const date = normalizeDate(line);

    const time = cleanedLines[i + 1] || "";

    const details = cleanedLines[i + 2] || "";

    const transactionID =
      (cleanedLines[i + 3] || "")
        .replace("Transaction ID :", "")
        .trim();

    const utrNo =
      (cleanedLines[i + 4] || "")
        .replace("UTR No :", "")
        .trim();

    const paidBy =
      (cleanedLines[i + 5] || "")
        .replace("Debited from", "")
        .trim();

    const amountLine = cleanedLines[i + 6] || "";

    const amountMatch =
      amountLine.match(/(Debit|Credit)INR\s*([\d,.]+)/i);

    if (!amountMatch) continue;

    const type = amountMatch[1].toUpperCase();

    const amount = parseFloat(
      amountMatch[2].replace(/,/g, "")
    );

    let category = "Other";

    const d = details.toLowerCase();

    if (
      d.includes("swiggy") ||
      d.includes("zomato") ||
      d.includes("blinkit") ||
      d.includes("dominos") ||
      d.includes("kfc")
    ) {
      category = "Food";
    }
    else if (
      d.includes("uber") ||
      d.includes("ola") ||
      d.includes("rapido")
    ) {
      category = "Travel";
    }
    else if (
      d.includes("amazon") ||
      d.includes("flipkart") ||
      d.includes("meesho") ||
      d.includes("myntra") ||
      d.includes("nykaa") ||
      d.includes("reliance")
    ) {
      category = "Shopping";
    }
    else if (
      d.includes("salary")
    ) {
      category = "Income";
    }

    allTrnasactions.push({
      date,
      time,
      type,
      amount,
      details,
      category,
      transactionID,
      utrNo,
      paidBy
    });
  }
}
const headers = [
  "DATE",
  "TIME",
  "TYPE",
  "AMOUNT",
  "DETAILS",
  "CATEGORY",
  "TRANSACTION ID",
  "UTR NO",
  "PAID BY",
];
      console.log("Transactions extracted:", allTrnasactions.length);

if (allTrnasactions.length > 0) {
  console.log("First transaction:", allTrnasactions[0]);
}
      console.log("Transactions extracted:", allTrnasactions.length);
console.log(allTrnasactions.slice(0, 5));
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(allTrnasactions,{
  skipHeader: true,
});

XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });

headers.forEach((_, index) => {
  const cellAddress = XLSX.utils.encode_cell({ r: 0, c: index });
  worksheet[cellAddress].s = {
    font: { bold: true },
  };
});

worksheet["!cols"] = headers.map(() => ({ wch: 22 }));
      
XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");

if (allTrnasactions.length === 0) {
  return res.status(400).json({
    error: "No transactions found in PDF"
  });
}

const firstDate = allTrnasactions[0]?.date || "unknown";
const lastDate = allTrnasactions[allTrnasactions.length - 1]?.date || "unknown";

const fileName = `expenses-${lastDate}-${firstDate}.xlsx`;

// ⬇️ generate Excel in memory
const excelBuffer = XLSX.write(workbook, {
  type: "buffer",
  bookType: "xlsx",
});

// ⬇️ send file as download
res.setHeader(
  "Content-Type",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
);
res.setHeader(
  "Content-Disposition",
  `attachment; filename="${fileName}"`
);

res.send(excelBuffer);

    //   res.json({ message: "PDF uploaded & processed" });
  
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "PDF parsing failed" });
    }
  });
  


/* ---------- FETCH TRANSACTIONS ---------- */
// app.get("/transactions", (req, res) => {
//   db.all(
//     "SELECT * FROM transactions ORDER BY date DESC",
//     (err, rows) => {
//       if (err) {
//         res.status(500).json({ error: "DB error" });
//       } else {
//         res.json(rows);
//       }
//     }
//   );
// });

/* ---------- EXPORT TO EXCEL ---------- */
// app.get("/export", (req, res) => {
//   db.all("SELECT * FROM transactions ORDER BY date DESC", (err, rows) => {
//     if (err) {
//       return res.status(500).json({ error: "DB error" });
//     }

//     const workbook = XLSX.utils.book_new();
//     const worksheet = XLSX.utils.json_to_sheet(rows);
//     XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");

//     const fileName = "expenses.xlsx";
//     XLSX.writeFile(workbook, fileName);
//     res.download(fileName);
//   });
// });

/* ---------- START SERVER ---------- */
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
