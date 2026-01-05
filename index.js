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
      const buffer = req.file.buffer;
      const pdfData = await pdfParse(buffer);
      console.log(pdfData)
      const lines = pdfData.text.split("\n");
      let prevLines = [];
      let allTrnasactions=[];
      lines.forEach((line,i) => {
        line = line.trim();
      
        // Only lines starting with DEBIT or CREDIT
        const typeMatch = line.match(/^(DEBIT|CREDIT)/i);
        if (!typeMatch) {
            // Keep last 2 lines in memory
            prevLines.push(line);
            if (prevLines.length > 2) prevLines.shift(); // only keep 2 previous lines
            return; // skip this line
          }
      
        const type = typeMatch[1].toUpperCase(); // DEBIT or CREDIT
      
        // Amount comes after ₹ symbol
        const amountMatch = line.match(/₹([\d,]+(?:\.\d{1,2})?)/);
        if (!amountMatch) return; // skip if no amount found
      
        let amount = parseFloat(amountMatch[1].replace(/,/g, ""));
        if (type === "DEBIT") amount = Math.abs(amount); // always positive
        else if (type === "CREDIT") amount = Math.abs(amount);
      
        // Transaction details = everything after the amount
        let details = line.slice(line.indexOf(amountMatch[0]) + amountMatch[0].length).trim();

        if (details == 'Paid to\n' || details == 'Paid to'){
            if (i + 1 <= lines.length) 
            details = 'Paid to ' + lines[i+1].trim();
        }

        let date = "";
        function normalizeDate(dateStr) {
            // Expected format: "Jan 04, 2026"
            const months = {
              Jan: "01", Feb: "02", Mar: "03", Apr: "04",
              May: "05", Jun: "06", Jul: "07", Aug: "08",
              Sep: "09", Oct: "10", Nov: "11", Dec: "12"
            };
          
            const parts = dateStr.replace(",", "").split(" ");
            if (parts.length !== 3) return null;
          
            const [mon, day, year] = parts;
          
            if (!months[mon]) return null;
          
            return `${year}-${months[mon]}-${day.padStart(2, "0")}`;
          }
          
  if (prevLines.length >= 2) {
    date =  normalizeDate(prevLines[0]) // 2 lines back
  }

      // --- Next 4 lines
  let transactionID = "";
  let utrNo = "";
  let paidBy = "";

  for (let j = 1; j <= 5; j++) {
    if (i + j >= lines.length) break;
    const nextLine = lines[i + j].trim();

    if (/Transaction ID/i.test(nextLine)) {
      transactionID = nextLine.split("Transaction ID")[1].trim();
    } else if (/UTR No/i.test(nextLine)) {
      utrNo = nextLine.split("UTR No.")[1].trim();
    } else if (/XXXX/i.test(nextLine)) {
      paidBy = nextLine.split("\n")[0].trim();
    }
  }

        // Category logic
        let category = "Other";
        const d = details.toLowerCase();
        if (d.includes("swiggy") || d.includes("zomato") || d.includes("dominos") || d.includes("kfc") || d.includes("mc donalds") || d.includes("burger king") || d.includes("pizza hut") || d.includes("subway")  || d.includes("burger king") || d.includes("pizza hut") || d.includes("subway")|| d.includes("blinkit")) category = "Food";
        else if (d.includes("uber") || d.includes("ola") || d.includes("rapido")) category = "Travel";
        else if (d.includes("amazon") || d.includes("flipkart") || d.includes("MEESHO") || d.includes("Myntra") || d.includes("Nykaa") || d.includes("RELIANCE")) category = "Shopping";
        else if (d.includes("salary")) category = "Income";
      
        // Insert into DB
        // db.run(
        //     `INSERT INTO transactions (date, description, amount, type, category, transaction_id, utr_no, paid_by)
        //      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        //     [date, details, amount, type, category, transactionID, utrNo, paidBy]
        //   );
        
        //   // Optional: log for testing
        //   console.log(date, type, amount, details, category, transactionID, utrNo, paidBy);


          allTrnasactions.push({date, type, amount, details, category, transactionID, utrNo, paidBy});

      });

const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(allTrnasactions);
XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");

const fileName = `expenses-${allTrnasactions[allTrnasactions.length - 1].date}-${allTrnasactions[0].date}.xlsx`;

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
